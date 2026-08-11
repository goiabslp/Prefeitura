import { supabase } from './supabaseClient';
import { LicitacaoProcesso, LicitacaoItem, LicitacaoJustificativa, LicitacaoAssinatura, LicitacaoPermissao, LicitacaoDocumento } from '../types/licitacao';

// Processos
export const createLicitacaoProcess = async (process: Partial<LicitacaoProcesso>): Promise<LicitacaoProcesso | null> => {
    try {
        const { data, error } = await supabase
            .from('licitacao_processos')
            .insert([process])
            .select()
            .single();

        if (error) {
            // Tratamento gracioso para restrição de check constraint no banco (Erro 23514)
            if (error.code === '23514' && (error.message?.includes('status_check') || JSON.stringify(error).includes('status_check'))) {
                console.warn("Status enviado não aceito pelo CHECK constraint do banco. Utilizando 'Em Análise'...");
                const fallbackProcess = { ...process, status: 'Em Análise' as any };
                const { data: retryData, error: retryError } = await supabase
                    .from('licitacao_processos')
                    .insert([fallbackProcess])
                    .select()
                    .single();

                if (retryError) throw retryError;
                return retryData as LicitacaoProcesso;
            }
            throw error;
        }
        return data as LicitacaoProcesso;
    } catch (error) {
        console.error("Error creating licitacao process:", error);
        throw error;
    }
};

export const createLicitacaoProcessCompleto = async (payload: {
    processo: Partial<LicitacaoProcesso>;
    itens: Partial<LicitacaoItem>[];
    justificativa: Partial<LicitacaoJustificativa>;
    assinatura?: Partial<LicitacaoAssinatura>;
}): Promise<LicitacaoProcesso | null> => {
    let retries = 5;
    let lastError: any = null;

    const nowIso = new Date().toISOString();
    const isApprovedStatus = (payload.processo.status as string) === 'Aprovado' || (payload.processo.status as string) === 'approved';

    const processPayload: Partial<LicitacaoProcesso> = {
        ...payload.processo,
        status: (payload.processo.status || 'Em Análise') as any,
        fase: payload.processo.fase || 'pendente',
        aprovado_em: isApprovedStatus ? nowIso : null,
        enviado_kanban_em: isApprovedStatus ? nowIso : null,
        apresentado_animacao: false
    };

    while (retries > 0) {
        try {
            // Generate protocol for this attempt
            const protocolo = await generateLicitacaoProtocol();

            // 1. Create process
            const processo = await createLicitacaoProcess({
                ...processPayload,
                protocolo
            });

            if (!processo) throw new Error("Failed to create process");

            // 2. Create items
            if (payload.itens.length > 0) {
                const itemsToCreate = payload.itens.map(item => ({
                    ...item,
                    processo_id: processo.id
                }));
                await createLicitacaoItems(itemsToCreate);
            }

            // 3. Create justificativa
            await upsertLicitacaoJustificativa({
                ...payload.justificativa,
                processo_id: processo.id
            });

            // 4. Create assinatura if provided
            if (payload.assinatura) {
                await signLicitacaoProcess({
                    ...payload.assinatura,
                    processo_id: processo.id
                });
            }

            // Disparar notificação em tempo real para o Kanban (/Licitacao/Kanban/view)
            if (isApprovedStatus) {
                try {
                    const approvedProcessInfo = {
                        id: processo.id,
                        protocolo: processo.protocolo || protocolo,
                        solicitante_nome: processo.solicitante_nome || 'Não informado',
                        solicitante_setor: processo.solicitante_setor || 'Não informado',
                        objeto_resumido: processo.objeto_resumido || processo.finalidade || 'Processo de Licitação',
                        aprovado_em: nowIso
                    };
                    broadcastLicitacaoApproval(approvedProcessInfo);
                } catch (err) {
                    console.warn('Erro ao notificar novo processo de licitação no Kanban:', err);
                }
            }

            return processo;
        } catch (error: any) {
            lastError = error;

            // Check if error is unique constraint violation for protocol (PostgreSQL code 23505)
            const isDuplicateKey = error && (
                error.code === '23505' ||
                (error.message && error.message.includes('unique constraint') && error.message.includes('protocolo'))
            );

            if (isDuplicateKey && retries > 1) {
                console.warn(`Protocol collision detected. Retrying with a new protocol... (${retries - 1} retries left)`);
                retries--;
                // Wait a small random delay to avoid concurrent conflict loops
                await new Promise(resolve => setTimeout(resolve, Math.random() * 200 + 50));
            } else {
                console.error("Error in createLicitacaoProcessCompleto:", error);
                throw error;
            }
        }
    }

    throw lastError || new Error("Failed to create process after multiple retries due to protocol collisions.");
};

export const broadcastLicitacaoApproval = (approvedProcessInfo: any) => {
    if (!approvedProcessInfo || !approvedProcessInfo.id) return;

    // 1. Transmissão nativa no mesmo navegador (todas as janelas e abas)
    if (typeof window !== 'undefined') {
        try {
            window.dispatchEvent(new CustomEvent('licitacao-new-process-approved', { detail: approvedProcessInfo }));
        } catch (e) { }

        try {
            const bc = new BroadcastChannel('licitacao_kanban_channel');
            bc.postMessage({ type: 'new-licitacao-process-approved', payload: approvedProcessInfo });
            setTimeout(() => bc.close(), 1000);
        } catch (e) { }
    }

    // 2. Supabase Realtime Broadcast no canal fixo escutado por todos os dispositivos, TVs e telas
    try {
        const channel = supabase.channel('licitacao_kanban_priority', { config: { broadcast: { self: true } } });
        channel.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                channel.send({
                    type: 'broadcast',
                    event: 'new-licitacao-process-approved',
                    payload: approvedProcessInfo
                });
                setTimeout(() => {
                    try { supabase.removeChannel(channel); } catch (e) { }
                }, 3000);
            }
        });
    } catch (e) { }

    // 3. Atualizar a global_config no Supabase para polling de retaguarda
    try {
        const nowIso = new Date().toISOString();
        supabase
            .from('organization_settings')
            .select('ui_config')
            .eq('id', 'global_config')
            .single()
            .then(({ data: orgData }) => {
                const currentUiConfig = orgData?.ui_config || {};
                supabase
                    .from('organization_settings')
                    .update({
                        ui_config: {
                            ...currentUiConfig,
                            latest_approved_licitacao_process: approvedProcessInfo
                        },
                        updated_at: nowIso
                    })
                    .eq('id', 'global_config');
            });
    } catch (e) { }
};

export const updateLicitacaoProcess = async (id: string, updates: Partial<LicitacaoProcesso>): Promise<LicitacaoProcesso | null> => {
    try {
        const { data, error } = await supabase
            .from('licitacao_processos')
            .update(updates)
            .eq('id', id)
            .select()
            .maybeSingle();

        if (error) {
            // Tratamento gracioso para restrição de check constraint no banco (Erro 23514)
            if (error.code === '23514' && (error.message?.includes('status_check') || JSON.stringify(error).includes('status_check'))) {
                console.warn("Status enviado não aceito pelo CHECK constraint do banco. Utilizando fallback seguro...");
                const sanitizedUpdates = { ...updates, status: 'Em Análise' as any };
                const { data: retryData, error: retryError } = await supabase
                    .from('licitacao_processos')
                    .update(sanitizedUpdates)
                    .eq('id', id)
                    .select()
                    .maybeSingle();

                if (retryError) throw retryError;

                const isRealApproval = retryData && updates.aprovado_em !== undefined && updates.aprovado_em !== null && updates.apresentado_animacao === false;
                if (isRealApproval) {
                    const nowIso = new Date().toISOString();
                    const approvedProcessInfo = {
                        id: retryData.id,
                        protocolo: retryData.protocolo || retryData.id.slice(0, 8),
                        solicitante_nome: retryData.solicitante_nome || 'Não informado',
                        solicitante_setor: retryData.solicitante_setor || 'Não informado',
                        objeto_resumido: retryData.objeto_resumido || retryData.finalidade || 'Processo de Licitação',
                        aprovado_em: retryData.aprovado_em || nowIso
                    };
                    broadcastLicitacaoApproval(approvedProcessInfo);
                }

                return retryData as LicitacaoProcesso;
            }

            // Caso a coluna checkin_finalizado ainda não exista na tabela no banco
            if (error.code === 'PGRST204' && (error.message?.includes('checkin_finalizado') || JSON.stringify(error).includes('checkin_finalizado'))) {
                console.warn("Coluna 'checkin_finalizado' não encontrada no banco. Atualizando demais campos da licitação...");
                const sanitizedUpdates = { ...updates };
                delete (sanitizedUpdates as any).checkin_finalizado;

                const { data: retryData, error: retryError } = await supabase
                    .from('licitacao_processos')
                    .update(sanitizedUpdates)
                    .eq('id', id)
                    .select()
                    .maybeSingle();

                if (retryError) throw retryError;
                return retryData as LicitacaoProcesso;
            }
            throw error;
        }

        // Disparar animação de aprovação SOMENTE quando aprovado_em está sendo definido explicitamente
        // (ou seja, uma aprovação real via MeusProcessos), NÃO em mudanças de fase/coluna do Kanban
        const isRealApproval = data && updates.aprovado_em !== undefined && updates.aprovado_em !== null && updates.apresentado_animacao === false;

        if (isRealApproval) {
            const nowIso = new Date().toISOString();
            const approvedProcessInfo = {
                id: data.id,
                protocolo: data.protocolo || data.id.slice(0, 8),
                solicitante_nome: data.solicitante_nome || 'Não informado',
                solicitante_setor: data.solicitante_setor || 'Não informado',
                objeto_resumido: data.objeto_resumido || data.finalidade || 'Processo de Licitação',
                aprovado_em: data.aprovado_em || nowIso
            };

            broadcastLicitacaoApproval(approvedProcessInfo);
        }

        return data as LicitacaoProcesso;
    } catch (error: any) {
        if (error?.code === '23514' && error?.message?.includes('licitacao_processos_status_check')) {
            console.error("Erro 23514: A restrição CHECK do banco no Supabase precisa ser atualizada para aceitar o status 'Finalizado'. Execute o script SQL no Supabase Editor.");
        }
        console.error("Error updating licitacao process:", error);
        throw error;
    }
};

export const getLicitacaoProcesses = async (): Promise<LicitacaoProcesso[]> => {
    try {
        const { data, error } = await supabase
            .from('licitacao_processos')
            .select('*')
            .order('criado_em', { ascending: false });

        if (error) throw error;
        return data as unknown as LicitacaoProcesso[];
    } catch (error) {
        console.error("Error fetching licitacao processes:", error);
        return [];
    }
};

export const getLicitacaoProcessById = async (id: string): Promise<LicitacaoProcesso | null> => {
    try {
        const { data, error } = await supabase
            .from('licitacao_processos')
            .select(`
                *,
                licitacao_itens (*),
                licitacao_justificativas (*),
                licitacao_assinaturas (*),
                licitacao_documentos (*)
            `)
            .eq('id', id)
            .single();

        if (error) throw error;
        return data as unknown as LicitacaoProcesso;
    } catch (error) {
        console.error("Error fetching licitacao process by id:", error);
        return null;
    }
};

// Itens
export const createLicitacaoItems = async (items: Partial<LicitacaoItem>[]): Promise<LicitacaoItem[]> => {
    try {
        const { data, error } = await supabase
            .from('licitacao_itens')
            .insert(items)
            .select();

        if (error) throw error;
        return data as LicitacaoItem[];
    } catch (error) {
        console.error("Error creating licitacao items:", error);
        throw error;
    }
};

export const deleteLicitacaoItem = async (id: string): Promise<void> => {
    try {
        const { error } = await supabase
            .from('licitacao_itens')
            .delete()
            .eq('id', id);

        if (error) throw error;
    } catch (error) {
        console.error("Error deleting licitacao item:", error);
        throw error;
    }
};

// Justificativa
export const upsertLicitacaoJustificativa = async (justificativa: Partial<LicitacaoJustificativa>): Promise<LicitacaoJustificativa | null> => {
    try {
        const { data, error } = await supabase
            .from('licitacao_justificativas')
            .upsert(justificativa, { onConflict: 'processo_id' })
            .select()
            .single();

        if (error) throw error;
        return data as LicitacaoJustificativa;
    } catch (error) {
        console.error("Error upserting licitacao justificativa:", error);
        throw error;
    }
};

// Assinatura
export const signLicitacaoProcess = async (assinatura: Partial<LicitacaoAssinatura>): Promise<LicitacaoAssinatura | null> => {
    try {
        const { data, error } = await supabase
            .from('licitacao_assinaturas')
            .insert([assinatura])
            .select()
            .single();

        if (error) throw error;

        // Atualiza status do processo como "Em Análise" (Aguardando Aprovação do Administrador)
        await updateLicitacaoProcess(assinatura.processo_id!, { status: 'Em Análise' as any });

        return data as LicitacaoAssinatura;
    } catch (error) {
        console.error("Error signing licitacao process:", error);
        throw error;
    }
};

// Permissoes
export const getUserLicitacaoPermission = async (userId: string): Promise<LicitacaoPermissao | null> => {
    try {
        const { data, error } = await supabase
            .from('licitacao_permissoes')
            .select('*')
            .eq('usuario_id', userId)
            .maybeSingle();

        if (error) throw error;
        return data as LicitacaoPermissao;
    } catch (error) {
        console.error("Error fetching licitacao permission:", error);
        return null;
    }
};

// Documentos
export const addLicitacaoDocument = async (document: Partial<LicitacaoDocumento>): Promise<LicitacaoDocumento | null> => {
    try {
        const { data, error } = await supabase
            .from('licitacao_documentos')
            .insert([document])
            .select()
            .single();

        if (error) throw error;
        return data as LicitacaoDocumento;
    } catch (error) {
        console.error("Error adding licitacao document:", error);
        throw error;
    }
};

export const deleteLicitacaoDocument = async (id: string, url?: string): Promise<void> => {
    try {
        const { error, count } = await supabase
            .from('licitacao_documentos')
            .delete({ count: 'exact' })
            .eq('id', id);

        if (error) throw error;
        if (count === 0) {
            throw new Error('Você não tem permissão para excluir este documento ou ele não existe.');
        }

        // Try to delete the physical file if url is provided
        if (url) {
            try {
                // Extract path from public URL
                // e.g. "https://xxxx.supabase.co/storage/v1/object/public/attachments/1778158614521_PNG.png"
                const parts = url.split('/attachments/');
                if (parts.length > 1) {
                    const filePath = parts[1];
                    await supabase.storage.from('attachments').remove([filePath]);
                }
            } catch (storageErr) {
                console.error("Failed to delete physical file from storage:", storageErr);
            }
        }
    } catch (error) {
        console.error("Error deleting licitacao document:", error);
        throw error;
    }
};

// Funcao auxiliar para o contador do protocolo no estilo "LIC-0001/2026"
export const generateLicitacaoProtocol = async (): Promise<string> => {
    try {
        const year = new Date().getFullYear();
        // Busca os protocolos do ano atual ordenados para obter o maior número existente
        const { data, error } = await supabase
            .from('licitacao_processos')
            .select('protocolo')
            .like('protocolo', `LIC-%/${year}`)
            .order('protocolo', { ascending: false })
            .limit(100);

        if (error) throw error;

        let maxNumber = 0;
        if (data && data.length > 0) {
            data.forEach(row => {
                const match = row.protocolo.match(/^LIC-(\d+)\/\d+$/);
                if (match) {
                    const num = parseInt(match[1], 10);
                    if (num > maxNumber) {
                        maxNumber = num;
                    }
                }
            });
        }

        // Se maxNumber for 0 mas tivermos dados ou se preferirmos um backup duplo,
        // podemos usar count apenas se não encontramos nenhum protocolo formatado
        if (maxNumber === 0) {
            const { count, error: countError } = await supabase
                .from('licitacao_processos')
                .select('*', { count: 'exact', head: true })
                .gte('criado_em', `${year}-01-01T00:00:00Z`);

            if (!countError && count !== null) {
                maxNumber = count;
            }
        }

        const nextNumber = maxNumber + 1;
        return `LIC-${nextNumber.toString().padStart(4, '0')}/${year}`;
    } catch (error) {
        console.error("Error generating protocol:", error);
        return `LIC-${Date.now()}`;
    }
};

// --- Backwards Compatibility Shims for App.tsx ---

export const saveLicitacaoProcess = async (process: any): Promise<any> => {
    let dbStatus = process.status;
    if (process.status === 'pending') dbStatus = 'Rascunho';
    else if (process.status === 'awaiting_approval') dbStatus = 'Aguardando Assinatura';
    else if (process.status === 'in_progress' || process.status === 'approved') dbStatus = 'Em Análise';
    else if (process.status === 'completed') dbStatus = 'Concluído';
    else if (process.status === 'finalized') dbStatus = 'Finalizado';
    else if (process.status === 'rejected') dbStatus = 'Rejeitado';

    // Apenas status explicitamente 'approved' deve marcar como aprovado
    // 'Em Análise' é o status padrão de novos processos e NÃO deve ser tratado como aprovação
    const isNowApproved = process.status === 'approved' || dbStatus === 'Aprovado';
    const nowIso = new Date().toISOString();

    const sanitizedProcess: any = {
        solicitante_nome: process.documentSnapshot?.content?.requesterName || process.userName || process.solicitante_nome || 'Não informado',
        solicitante_setor: process.documentSnapshot?.content?.requesterSector || process.requestingSector || process.solicitante_setor || 'Não informado',
        finalidade: process.documentSnapshot?.content?.objeto || process.documentSnapshot?.content?.description || process.title || process.finalidade || 'Processo de Licitação',
        objeto_resumido: process.shortDescription || process.documentSnapshot?.content?.shortDescription || process.objeto_resumido || process.title || process.finalidade,
        status: dbStatus,
    };

    if (isNowApproved) {
        sanitizedProcess.fase = process.fase || 'pendente';
        sanitizedProcess.aprovado_em = nowIso;
        sanitizedProcess.enviado_kanban_em = nowIso;
        sanitizedProcess.apresentado_animacao = false;
    }

    let result: any = null;
    if (process.id) {
        result = await updateLicitacaoProcess(process.id, sanitizedProcess);
    } else {
        result = await createLicitacaoProcess(sanitizedProcess);
    }

    if (isNowApproved && result) {
        try {
            const approvedProcessInfo = {
                id: result.id,
                protocolo: result.protocolo || process.protocol || process.protocolo || result.id.slice(0, 8),
                solicitante_nome: result.solicitante_nome || 'Não informado',
                solicitante_setor: result.solicitante_setor || 'Não informado',
                objeto_resumido: result.objeto_resumido || result.finalidade || 'Processo de Licitação',
                aprovado_em: nowIso
            };

            const channel = supabase.channel('licitacao_kanban_priority');
            channel.send({
                type: 'broadcast',
                event: 'new-licitacao-process-approved',
                payload: approvedProcessInfo
            });

            const { data: orgData } = await supabase
                .from('organization_settings')
                .select('ui_config')
                .eq('id', 'global_config')
                .single();
            const currentUiConfig = orgData?.ui_config || {};
            await supabase
                .from('organization_settings')
                .update({
                    ui_config: {
                        ...currentUiConfig,
                        latest_approved_licitacao_process: approvedProcessInfo
                    },
                    updated_at: nowIso
                })
                .eq('id', 'global_config');
        } catch (err) {
            console.warn('Erro ao disparar transmissão de aprovação ao Kanban:', err);
        }
    }

    return result;
};

export const deleteLicitacaoProcess = async (id: string): Promise<void> => {
    const { error, count } = await supabase.from('licitacao_processos').delete({ count: 'exact' }).eq('id', id);
    if (error) throw error;
    if (count === 0) throw new Error("Aviso: Falha ao excluir. Verifique se você executou a instrução SQL no banco de dados para adicionar a permissão de exclusão (DELETE).");
};

export const getAllLicitacaoProcesses = async (): Promise<any[]> => {
    return getLicitacaoProcesses() as any;
};

// Funcoes de persistencia global para o Objeto Resumido (Titulo Manual)
export const saveObjetoResumidoMap = async (processId: string, text: string): Promise<Record<string, string>> => {
    const trimmed = text.trim();
    let updatedMap: Record<string, string> = {};

    try {
        const { data } = await supabase
            .from('organization_settings')
            .select('ui_config')
            .eq('id', 'global_config')
            .single();

        const currentUi = data?.ui_config || {};
        const currentMap = currentUi.objeto_resumido_map || {};

        if (trimmed) {
            updatedMap = { ...currentMap, [processId]: trimmed };
        } else {
            updatedMap = { ...currentMap };
            delete updatedMap[processId];
        }

        await supabase
            .from('organization_settings')
            .upsert({
                id: 'global_config',
                ui_config: {
                    ...currentUi,
                    objeto_resumido_map: updatedMap
                }
            });

        try {
            localStorage.setItem('licitacao_objeto_resumido_map', JSON.stringify(updatedMap));
        } catch (e) { }

        const channel = supabase.channel('licitacao_kanban_priority');
        channel.send({
            type: 'broadcast',
            event: 'licitacao-objeto-resumido-updated',
            payload: updatedMap
        });
    } catch (e) {
        console.warn('Erro ao salvar objeto_resumido em organization_settings:', e);
    }

    // Tentar tambem atualizar as tabelas do banco se as colunas existirem
    try {
        await supabase
            .from('licitacao_processos')
            .update({ objeto_resumido: trimmed } as any)
            .eq('id', processId);
    } catch (e) { }

    try {
        const { data: orderData } = await supabase
            .from('purchase_orders')
            .select('document_snapshot')
            .eq('id', processId)
            .maybeSingle();

        if (orderData?.document_snapshot) {
            const updatedSnapshot = {
                ...orderData.document_snapshot,
                content: {
                    ...(orderData.document_snapshot.content || {}),
                    objeto_resumido: trimmed
                }
            };
            await supabase
                .from('purchase_orders')
                .update({ document_snapshot: updatedSnapshot })
                .eq('id', processId);
        }
    } catch (e) { }

    return updatedMap;
};

export const fetchObjetoResumidoMap = async (): Promise<Record<string, string>> => {
    try {
        const { data } = await supabase
            .from('organization_settings')
            .select('ui_config')
            .eq('id', 'global_config')
            .single();

        const map = data?.ui_config?.objeto_resumido_map || {};
        try {
            localStorage.setItem('licitacao_objeto_resumido_map', JSON.stringify(map));
        } catch (e) { }
        return map;
    } catch (e) {
        try {
            const saved = localStorage.getItem('licitacao_objeto_resumido_map');
            return saved ? JSON.parse(saved) : {};
        } catch {
            return {};
        }
    }
};

