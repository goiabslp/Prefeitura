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

        if (error) throw error;
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
    try {
        // 1. Create process
        const processo = await createLicitacaoProcess({
            ...payload.processo,
            protocolo: await generateLicitacaoProtocol()
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

        return processo;
    } catch (error) {
        console.error("Error in createLicitacaoProcessCompleto:", error);
        throw error;
    }
};

export const updateLicitacaoProcess = async (id: string, updates: Partial<LicitacaoProcesso>): Promise<LicitacaoProcesso | null> => {
    try {
        const { data, error } = await supabase
            .from('licitacao_processos')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data as LicitacaoProcesso;
    } catch (error) {
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
        
        // Atualiza status do processo
        await updateLicitacaoProcess(assinatura.processo_id!, { status: 'Assinado' });

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
        // Forma simples (usando contagem local da tabela)
        const { count, error } = await supabase
            .from('licitacao_processos')
            .select('*', { count: 'exact', head: true })
            .gte('criado_em', `${year}-01-01T00:00:00Z`);
            
        if (error) throw error;
        
        const nextNumber = (count || 0) + 1;
        return `LIC-${nextNumber.toString().padStart(4, '0')}/${year}`;
    } catch (error) {
        console.error("Error generating protocol:", error);
        return `LIC-${Date.now()}`;
    }
};

// --- Backwards Compatibility Shims for App.tsx ---

export const saveLicitacaoProcess = async (process: any): Promise<any> => {
    // Map generic 'Order' status back to 'LicitacaoProcesso' status if needed
    let dbStatus = process.status;
    if (process.status === 'pending') dbStatus = 'Rascunho';
    if (process.status === 'awaiting_approval') dbStatus = 'Aguardando Assinatura';
    if (process.status === 'in_progress') dbStatus = 'Em Análise';
    if (process.status === 'completed') dbStatus = 'Concluído';
    if (process.status === 'rejected') dbStatus = 'Rejeitado';

    // Sanitize the payload to only include columns from licitacao_processos
    const sanitizedProcess = {
        solicitante_nome: process.documentSnapshot?.content?.requesterName || process.userName,
        solicitante_setor: process.documentSnapshot?.content?.requesterSector || process.requestingSector,
        finalidade: process.documentSnapshot?.content?.objeto || process.documentSnapshot?.content?.description || process.title,
        status: dbStatus,
    };

    if (process.id) {
        return updateLicitacaoProcess(process.id, sanitizedProcess) as any;
    }
    return createLicitacaoProcess(sanitizedProcess) as any;
};

export const deleteLicitacaoProcess = async (id: string): Promise<void> => {
    const { error, count } = await supabase.from('licitacao_processos').delete({ count: 'exact' }).eq('id', id);
    if (error) throw error;
    if (count === 0) throw new Error("Aviso: Falha ao excluir. Verifique se você executou a instrução SQL no banco de dados para adicionar a permissão de exclusão (DELETE).");
};

export const getAllLicitacaoProcesses = async (): Promise<any[]> => {
    return getLicitacaoProcesses() as any;
};

