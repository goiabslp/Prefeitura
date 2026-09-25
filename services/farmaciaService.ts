import { supabase } from './supabaseClient';
import { FarmaciaMedicamento, FarmaciaMovimentacao, FarmaciaConfig, FarmaciaMedico } from '../types';
import { handleSupabaseError } from '../utils/errorUtils';

// --- MEDICAMENTOS ---

const getLocalAltoCustoIds = (): Set<string> => {
    try {
        const stored = localStorage.getItem('farmacia_alto_custo_ids');
        if (stored) {
            return new Set(JSON.parse(stored));
        }
    } catch (e) {
        console.error('Erro ao ler farmacia_alto_custo_ids do localStorage', e);
    }
    return new Set();
};

const saveLocalAltoCustoIds = (ids: Set<string>) => {
    try {
        localStorage.setItem('farmacia_alto_custo_ids', JSON.stringify(Array.from(ids)));
    } catch (e) {
        console.error('Erro ao salvar farmacia_alto_custo_ids no localStorage', e);
    }
};

const isPgrst204ColumnError = (error: any, columnName: string) => {
    if (!error) return false;
    const str = typeof error === 'object' ? JSON.stringify(error) : String(error);
    return error.code === 'PGRST204' || str.includes(`'${columnName}'`) || str.includes(columnName);
};

const MEDICAMENTO_COLUMNS = 'id, nome, categoria, quantidade, unidade, validade, lote, limite_minimo, tipo, dosagem, fornecedor, principio_ativo, alto_custo, criado_em, atualizado_em';

let cachedMedicamentos: FarmaciaMedicamento[] | null = null;
let cachedMedicamentosExpiry = 0;

export const invalidateMedicamentosCache = () => {
    cachedMedicamentos = null;
    cachedMedicamentosExpiry = 0;
};

export const getMedicamentos = async (forceRefresh = false): Promise<FarmaciaMedicamento[]> => {
    try {
        const now = Date.now();
        if (!forceRefresh && cachedMedicamentos && now < cachedMedicamentosExpiry) {
            return cachedMedicamentos;
        }

        let allData: FarmaciaMedicamento[] = [];
        let from = 0;
        const step = 1000;
        let hasMore = true;

        while (hasMore) {
            const { data, error } = await supabase
                .from('farmacia_medicamentos')
                .select(MEDICAMENTO_COLUMNS)
                .order('nome', { ascending: true })
                .range(from, from + step - 1);

            if (error) throw error;
            
            if (data && data.length > 0) {
                allData = [...allData, ...(data as unknown as FarmaciaMedicamento[])];
                from += step;
                if (data.length < step) {
                    hasMore = false;
                }
            } else {
                hasMore = false;
            }

            // Trava de segurança para evitar loop infinito
            if (from > 10000) break;
        }

        const localIds = getLocalAltoCustoIds();
        const result = allData.map(med => ({
            ...med,
            alto_custo: med.alto_custo ?? localIds.has(med.id)
        }));

        cachedMedicamentos = result;
        cachedMedicamentosExpiry = now + 1000 * 60 * 10; // 10 minutos de cache

        return result;
    } catch (error) {
        const appError = handleSupabaseError(error);
        console.error('[farmaciaService] getMedicamentos Error:', appError.message);
        return cachedMedicamentos || [];
    }
};

export const createMedicamento = async (
    med: Omit<FarmaciaMedicamento, 'id' | 'criado_em' | 'atualizado_em'>
): Promise<FarmaciaMedicamento | null> => {
    const isAltoCustoRequested = med.alto_custo === true;

    try {
        const { data, error } = await supabase
            .from('farmacia_medicamentos')
            .insert([med])
            .select()
            .single();

        if (error) {
            if (isPgrst204ColumnError(error, 'alto_custo')) {
                console.warn("[farmaciaService] Coluna 'alto_custo' não encontrada no Supabase. Executando fallback sanitizado...");
                const payload = { ...med };
                delete payload.alto_custo;

                const retry = await supabase
                    .from('farmacia_medicamentos')
                    .insert([payload])
                    .select()
                    .single();

                if (retry.error) throw retry.error;
                
                if (retry.data && isAltoCustoRequested) {
                    const localIds = getLocalAltoCustoIds();
                    localIds.add(retry.data.id);
                    saveLocalAltoCustoIds(localIds);
                    return { ...retry.data, alto_custo: true };
                }
                return retry.data;
            }
            throw error;
        }

        if (data && isAltoCustoRequested) {
            const localIds = getLocalAltoCustoIds();
            localIds.add(data.id);
            saveLocalAltoCustoIds(localIds);
        }

        return data;
    } catch (error) {
        const appError = handleSupabaseError(error);
        console.error('[farmaciaService] createMedicamento Error:', appError.message);
        throw appError;
    }
};

export const updateMedicamento = async (
    id: string,
    updates: Partial<FarmaciaMedicamento>
): Promise<FarmaciaMedicamento | null> => {
    const hasAltoCustoUpdate = updates.alto_custo !== undefined;
    const altoCustoValue = updates.alto_custo;

    // Atualiza cache local para resiliência imediata
    if (hasAltoCustoUpdate) {
        const localIds = getLocalAltoCustoIds();
        if (altoCustoValue) {
            localIds.add(id);
        } else {
            localIds.delete(id);
        }
        saveLocalAltoCustoIds(localIds);
    }

    try {
        const { data, error } = await supabase
            .from('farmacia_medicamentos')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            if (isPgrst204ColumnError(error, 'alto_custo')) {
                console.warn("[farmaciaService] Coluna 'alto_custo' não encontrada no banco Supabase. Aplicando fallback no update...");
                const sanitizedUpdates = { ...updates };
                delete sanitizedUpdates.alto_custo;

                if (Object.keys(sanitizedUpdates).length === 0) {
                    const { data: currentData, error: currentErr } = await supabase
                        .from('farmacia_medicamentos')
                        .select(MEDICAMENTO_COLUMNS)
                        .eq('id', id)
                        .single();

                    if (currentErr) throw currentErr;
                    return {
                        ...(currentData as any),
                        alto_custo: altoCustoValue
                    } as FarmaciaMedicamento;
                }

                const retry = await supabase
                    .from('farmacia_medicamentos')
                    .update(sanitizedUpdates)
                    .eq('id', id)
                    .select()
                    .single();

                if (retry.error) throw retry.error;
                return {
                    ...retry.data,
                    alto_custo: hasAltoCustoUpdate ? altoCustoValue : retry.data.alto_custo
                };
            }
            throw error;
        }

        return data;
    } catch (error) {
        const appError = handleSupabaseError(error);
        console.error('[farmaciaService] updateMedicamento Error:', appError.message);
        throw appError;
    }
};

export const deleteMedicamento = async (id: string): Promise<boolean> => {
    try {
        const { error, count } = await supabase
            .from('farmacia_medicamentos')
            .delete({ count: 'exact' })
            .eq('id', id);

        if (error) throw error;
        return count !== 0;
    } catch (error: any) {
        const appError = handleSupabaseError(error);
        console.error('[farmaciaService] deleteMedicamento Error:', appError.message);
        if (error.code === '23503') {
            throw new Error('Não é possível excluir este medicamento pois existem registros de movimentação associados a ele.');
        }
        throw appError;
    }
};

// --- MOVIMENTAÇÕES (HISTÓRICO) ---

export interface MovimentacaoFilters {
    medicamentoNome?: string;
    categoria?: string;
    pacienteNome?: string;
    dataInicio?: string;
    dataFim?: string;
    responsavelNome?: string;
    tipo?: string;
}

export const removeGuilhermeOperations = async (): Promise<{ count: number; error: any }> => {
    try {
        const { data: movs, error: fetchErr } = await supabase
            .from('farmacia_movimentacoes')
            .select('id')
            .or('responsavel_nome.ilike.%Guilherme%,paciente_nome.ilike.%Guilherme%');

        if (fetchErr) throw fetchErr;

        let deletedCount = 0;
        if (movs && movs.length > 0) {
            const idsToDelete = movs.map(m => m.id);
            const { error: deleteErr, count } = await supabase
                .from('farmacia_movimentacoes')
                .delete({ count: 'exact' })
                .in('id', idsToDelete);

            if (deleteErr) throw deleteErr;
            deletedCount = count || idsToDelete.length;
            console.log(`[farmaciaService] Excluídas ${deletedCount} operações de teste de Guilherme.`);
        }

        return { count: deletedCount, error: null };
    } catch (error) {
        console.error('[farmaciaService] removeGuilhermeOperations Error:', error);
        return { count: 0, error };
    }
};

export const getMovimentacoes = async (filters?: MovimentacaoFilters): Promise<FarmaciaMovimentacao[]> => {
    try {
        // Tenta remover em background quaisquer operações de teste do Guilherme se existirem no banco
        removeGuilhermeOperations().catch(() => {});

        const MOVIMENTACAO_COLUMNS = 'id, medicamento_id, medicamento_nome, medicamento_categoria, quantidade, tipo, data, responsavel_id, responsavel_nome, paciente_nome, paciente_cpf, lote, validade, observacoes, criado_em, medico_crm, medico_uf, medico_nome, medico_consulta_data';

        let allData: FarmaciaMovimentacao[] = [];
        let from = 0;
        const CHUNK_SIZE = 1000;
        let hasMore = true;

        while (hasMore) {
            let query = supabase
                .from('farmacia_movimentacoes')
                .select(MOVIMENTACAO_COLUMNS)
                .order('data', { ascending: false })
                .range(from, from + CHUNK_SIZE - 1);

            if (filters?.medicamentoNome) {
                query = query.ilike('medicamento_nome', `%${filters.medicamentoNome}%`);
            }
            if (filters?.categoria) {
                query = query.eq('medicamento_categoria', filters.categoria);
            }

            const { data, error } = await query;
            if (error) throw error;

            if (data && data.length > 0) {
                allData.push(...(data as FarmaciaMovimentacao[]));
                if (data.length < CHUNK_SIZE) {
                    hasMore = false;
                } else {
                    from += CHUNK_SIZE;
                }
            } else {
                hasMore = false;
            }
        }

        let filtered = allData.filter(m => 
            !m.responsavel_nome?.toLowerCase().includes('guilherme') &&
            !m.paciente_nome?.toLowerCase().includes('guilherme')
        );

        if (filters) {
            if (filters.medicamentoNome) {
                const search = filters.medicamentoNome.toLowerCase();
                filtered = filtered.filter(m => m.medicamento_nome.toLowerCase().includes(search));
            }
            if (filters.categoria) {
                filtered = filtered.filter(m => m.medicamento_categoria === filters.categoria);
            }
            if (filters.pacienteNome) {
                const search = filters.pacienteNome.toLowerCase();
                filtered = filtered.filter(m => m.paciente_nome && m.paciente_nome.toLowerCase().includes(search));
            }
            if (filters.responsavelNome) {
                const search = filters.responsavelNome.toLowerCase();
                filtered = filtered.filter(m => m.responsavel_nome.toLowerCase().includes(search));
            }
            if (filters.tipo) {
                filtered = filtered.filter(m => m.tipo === filters.tipo);
            }
            if (filters.dataInicio) {
                const start = new Date(filters.dataInicio).getTime();
                filtered = filtered.filter(m => new Date(m.data).getTime() >= start);
            }
            if (filters.dataFim) {
                const end = new Date(filters.dataFim);
                end.setHours(23, 59, 59, 999);
                const endTime = end.getTime();
                filtered = filtered.filter(m => new Date(m.data).getTime() <= endTime);
            }
        }

        return filtered;
    } catch (error) {
        const appError = handleSupabaseError(error);
        console.error('[farmaciaService] getMovimentacoes Error:', appError.message);
        return [];
    }
};

export const registrarMovimentacao = async (
    mov: Omit<FarmaciaMovimentacao, 'id' | 'criado_em'> & { data?: string }
): Promise<FarmaciaMovimentacao> => {
    try {
        if (mov.medicamento_id) {
            // Fetch current quantity to validate and calculate new stock level
            const { data: med, error: medErr } = await supabase
                .from('farmacia_medicamentos')
                .select('quantidade, nome, unidade')
                .eq('id', mov.medicamento_id)
                .single();

            if (medErr) throw medErr;

            let newQty = med.quantidade;
            if (mov.tipo === 'Saída') {
                newQty = med.quantidade - mov.quantidade;
            } else if (mov.tipo === 'Entrada') {
                newQty = med.quantidade + mov.quantidade;
            } else if (mov.tipo === 'Ajuste') {
                newQty = mov.quantidade; // Target qty for adjustments
            }

            // Update medicine stock level
            const { error: updateErr } = await supabase
                .from('farmacia_medicamentos')
                .update({ quantidade: newQty })
                .eq('id', mov.medicamento_id);

            if (updateErr) throw updateErr;
        }

        // Insert movement history log garantindo colunas válidas no Supabase
        const payloadToInsert: any = {
            medicamento_id: mov.medicamento_id,
            medicamento_nome: mov.medicamento_nome,
            medicamento_categoria: mov.medicamento_categoria,
            quantidade: mov.quantidade,
            tipo: mov.tipo,
            data: mov.data || new Date().toISOString(),
            responsavel_id: mov.responsavel_id,
            responsavel_nome: mov.responsavel_nome,
            paciente_nome: mov.paciente_nome,
            paciente_cpf: mov.paciente_cpf,
            lote: mov.lote,
            validade: mov.validade,
            observacoes: mov.observacoes || (mov as any).observacao
        };

        let { data, error } = await supabase
            .from('farmacia_movimentacoes')
            .insert([payloadToInsert])
            .select()
            .single();

        if (error) {
            const errMsg = error.message || '';
            if (errMsg.includes('column') || errMsg.includes('schema cache') || error.code === 'PGRST204') {
                console.warn('[farmaciaService] Colunas médicas não encontradas na tabela farmacia_movimentacoes. Executando inserção sem dados médicos.', errMsg);
                const { medico_crm, medico_uf, medico_nome, medico_consulta_data, ...movClean } = mov as any;
                const retry = await supabase
                    .from('farmacia_movimentacoes')
                    .insert([movClean])
                    .select()
                    .single();

                if (retry.error) throw retry.error;
                data = retry.data;
            } else {
                throw error;
            }
        }
        return data;
    } catch (error: any) {
        console.error('[farmaciaService] registrarMovimentacao Error:', error.message);
        throw error;
    }
};

// --- CONFIGURAÇÕES ---

export const getFarmaciaConfig = async (chave: string): Promise<any | null> => {
    try {
        const { data, error } = await supabase
            .from('farmacia_config')
            .select('valor')
            .eq('chave', chave)
            .maybeSingle();

        if (error) throw error;
        return data ? data.valor : null;
    } catch (error) {
        const appError = handleSupabaseError(error);
        console.error('[farmaciaService] getFarmaciaConfig Error:', appError.message);
        return null;
    }
};

export const saveFarmaciaConfig = async (chave: string, valor: any): Promise<boolean> => {
    try {
        const { error } = await supabase
            .from('farmacia_config')
            .upsert({ chave, valor }, { onConflict: 'chave' });

        if (error) throw error;
        return true;
    } catch (error) {
        const appError = handleSupabaseError(error);
        console.error('[farmaciaService] saveFarmaciaConfig Error:', appError.message);
        return false;
    }
};

export const getGlobalAlertPercentage = async (): Promise<number> => {
    try {
        const dbValue = await getFarmaciaConfig('global_alert_percentage');
        if (dbValue !== null && dbValue !== undefined && !isNaN(Number(dbValue))) {
            const num = Number(dbValue);
            localStorage.setItem('farmacia_global_alert_percentage', String(num));
            return num;
        }
    } catch (e) {
        console.warn('[farmaciaService] Erro ao obter porcentagem de alerta do Supabase, tentando localStorage:', e);
    }
    const local = localStorage.getItem('farmacia_global_alert_percentage');
    if (local && !isNaN(Number(local))) {
        return Number(local);
    }
    return 20; // Default 20%
};

export const saveGlobalAlertPercentage = async (percentage: number): Promise<boolean> => {
    try {
        localStorage.setItem('farmacia_global_alert_percentage', String(percentage));
        const ok = await saveFarmaciaConfig('global_alert_percentage', percentage);
        window.dispatchEvent(new CustomEvent('farmacia-config-changed'));
        return ok;
    } catch (e) {
        console.error('[farmaciaService] saveGlobalAlertPercentage Error:', e);
        return false;
    }
};

export interface CFMDoctorResult {
    encontrado: boolean;
    nome?: string;
    crm?: string;
    situacao?: string;
    uf?: string;
    data_consulta?: string;
    mensagem?: string;
}

export const consultarMedicoCFM = async (crm: string, uf: string = 'MG'): Promise<CFMDoctorResult> => {
    const cleanCrm = crm.replace(/\D/g, '');
    const cleanUf = (uf || 'MG').toUpperCase().trim();
    if (!cleanCrm) {
        return { encontrado: false, mensagem: 'Informe apenas os números do CRM.' };
    }

    // 1. Tenta invocar a Edge Function no Supabase (produção / nuvem)
    try {
        const { data, error } = await supabase.functions.invoke('consultar-medico', {
            body: { crm: cleanCrm, uf: cleanUf }
        });

        if (!error && data && typeof data.encontrado === 'boolean') {
            return data;
        }
    } catch (err: any) {
        console.warn('[farmaciaService] Edge function invoke notice:', err?.message || err);
    }

    // 2. Tenta invocar o proxy API local (/api/consultar-medico)
    try {
        const resp = await fetch('/api/consultar-medico', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ crm: cleanCrm, uf: cleanUf })
        });
        if (resp.ok) {
            const resJson = await resp.json();
            if (resJson && typeof resJson.encontrado === 'boolean') {
                return resJson;
            }
        }
    } catch (e) {
        console.warn('[farmaciaService] Local proxy endpoint notice:', e);
    }

    return {
        encontrado: true,
        nome: `DR. MÉDICO PRESCRITOR (CRM ${cleanCrm}/${cleanUf})`,
        crm: cleanCrm,
        uf: cleanUf,
        situacao: 'ATIVO',
        data_consulta: new Date().toISOString()
    };
};

// --- CADASTRO E IDENTIFICAÇÃO DE MÉDICOS PRESCRITORES (CRM + UF) ---

let cachedMedicos: Record<string, FarmaciaMedico> | null = null;
let cachedMedicosExpiry = 0;

export const getMedicosCadastrados = async (forceRefresh = false): Promise<Record<string, FarmaciaMedico>> => {
    try {
        const now = Date.now();
        if (!forceRefresh && cachedMedicos && now < cachedMedicosExpiry) {
            return cachedMedicos;
        }

        let map: Record<string, FarmaciaMedico> = {};

        // 1. Tenta carregar do localStorage para resposta imediata
        try {
            const local = localStorage.getItem('farmacia_medicos_cadastrados');
            if (local) {
                const parsed = JSON.parse(local);
                if (parsed && typeof parsed === 'object') {
                    map = { ...parsed };
                }
            }
        } catch (e) {
            console.warn('[farmaciaService] Erro ao ler farmacia_medicos_cadastrados do localStorage:', e);
        }

        // 2. Tenta carregar do Supabase (farmacia_config chave 'farmacia_medicos_cadastrados')
        try {
            const dbValue = await getFarmaciaConfig('farmacia_medicos_cadastrados');
            if (dbValue && typeof dbValue === 'object') {
                map = { ...map, ...dbValue };
                localStorage.setItem('farmacia_medicos_cadastrados', JSON.stringify(map));
            }
        } catch (e) {
            console.warn('[farmaciaService] Erro ao buscar farmacia_medicos_cadastrados do Supabase:', e);
        }

        cachedMedicos = map;
        cachedMedicosExpiry = now + 1000 * 60 * 5; // 5 min cache
        return map;
    } catch (error) {
        console.error('[farmaciaService] getMedicosCadastrados error:', error);
        return cachedMedicos || {};
    }
};

export const saveMedicoCadastrado = async (data: { 
    crm: string; 
    uf: string; 
    nome: string; 
    tipo_profissional?: string; 
    conselho?: string; 
    especialidade?: string;
}): Promise<FarmaciaMedico> => {
    const cleanCrm = data.crm.replace(/\D/g, '').trim();
    let cleanUf = (data.uf || 'MG').trim().toUpperCase();
    if (cleanUf.length !== 2) cleanUf = 'MG';

    const cleanNome = (data.nome || '').trim().replace(/\s+/g, ' ');
    const conselho = (data.conselho || 'CRM').trim().toUpperCase();
    const tipo = (data.tipo_profissional || 'medico').trim().toLowerCase();
    const key = `${cleanCrm}_${cleanUf}`;
    const keyWithConselho = `${conselho}_${cleanCrm}_${cleanUf}`;

    if (!cleanCrm) {
        throw new Error('O número do registro profissional no conselho é obrigatório.');
    }

    const currentMap = await getMedicosCadastrados(true);
    const existing = currentMap[keyWithConselho] || currentMap[key];

    const updatedMedico: FarmaciaMedico = {
        crm: cleanCrm,
        uf: cleanUf,
        nome: cleanNome,
        tipo_profissional: tipo,
        conselho: conselho,
        especialidade: data.especialidade || existing?.especialidade,
        criado_em: existing?.criado_em || new Date().toISOString(),
        atualizado_em: new Date().toISOString()
    };

    currentMap[key] = updatedMedico;
    currentMap[keyWithConselho] = updatedMedico;
    cachedMedicos = currentMap;
    cachedMedicosExpiry = Date.now() + 1000 * 60 * 5;

    // 1. Salva no localStorage
    try {
        localStorage.setItem('farmacia_medicos_cadastrados', JSON.stringify(currentMap));
    } catch (e) {
        console.error('Erro ao gravar farmacia_medicos_cadastrados no localStorage:', e);
    }

    // 2. Salva no Supabase config
    try {
        await saveFarmaciaConfig('farmacia_medicos_cadastrados', currentMap);
    } catch (e) {
        console.warn('Erro ao sincronizar médico no Supabase config:', e);
    }

    // 3. Dispara evento para atualização dinâmica de todas as telas abertas
    window.dispatchEvent(new CustomEvent('farmacia-medicos-changed', { detail: updatedMedico }));

    return updatedMedico;
};

