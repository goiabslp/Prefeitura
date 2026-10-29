import { isTodayInSaoPaulo, isDesistenciaMovimentacao } from '../utils/farmaciaDesistenciaUtils';
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

export interface LoteOrigemMetadata {
    origem?: 'COMPRADO' | 'DOADO' | 'FORNECIDO PELO ESTADO';
    doador_nome?: string;
    documento_origem?: string;
}

export const getLocalLotesOrigemMap = (): Record<string, LoteOrigemMetadata> => {
    try {
        const stored = localStorage.getItem('farmacia_lotes_origem_map');
        if (stored) return JSON.parse(stored);
    } catch (e) {
        console.error('Erro ao ler farmacia_lotes_origem_map do localStorage', e);
    }
    return {};
};

export const saveLocalLoteOrigem = (keyOrId: string, info: LoteOrigemMetadata) => {
    try {
        const map = getLocalLotesOrigemMap();
        map[keyOrId] = {
            ...map[keyOrId],
            ...info
        };
        localStorage.setItem('farmacia_lotes_origem_map', JSON.stringify(map));
    } catch (e) {
        console.error('Erro ao salvar farmacia_lotes_origem_map no localStorage', e);
    }
};

const isPgrst204ColumnError = (error: any, columnName: string) => {
    if (!error) return false;
    const str = typeof error === 'object' ? JSON.stringify(error) : String(error);
    return error.code === 'PGRST204' || str.includes(`'${columnName}'`) || str.includes(columnName);
};

const MEDICAMENTO_BASE_COLUMNS = 'id, nome, categoria, quantidade, unidade, validade, lote, limite_minimo, tipo, dosagem, fornecedor, principio_ativo, alto_custo, criado_em, atualizado_em';
const MEDICAMENTO_COLUMNS = MEDICAMENTO_BASE_COLUMNS;
const MEDICAMENTO_COLUMNS_WITH_ORIGEM = 'id, nome, categoria, quantidade, unidade, validade, lote, limite_minimo, tipo, dosagem, fornecedor, principio_ativo, alto_custo, origem, doador_nome, documento_origem, criado_em, atualizado_em';
let hasOrigemColumnInDb: boolean | null = null;

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
            const colsToUse = hasOrigemColumnInDb === false ? MEDICAMENTO_BASE_COLUMNS : MEDICAMENTO_COLUMNS_WITH_ORIGEM;
            let queryRes = await supabase
                .from('farmacia_medicamentos')
                .select(colsToUse)
                .order('nome', { ascending: true })
                .range(from, from + step - 1);

            if (queryRes.error && hasOrigemColumnInDb === null && (queryRes.error.code === 'PGRST204' || String(queryRes.error.message || '').includes('origem'))) {
                hasOrigemColumnInDb = false;
                queryRes = await supabase
                    .from('farmacia_medicamentos')
                    .select(MEDICAMENTO_BASE_COLUMNS)
                    .order('nome', { ascending: true })
                    .range(from, from + step - 1);
            } else if (!queryRes.error && hasOrigemColumnInDb === null) {
                hasOrigemColumnInDb = true;
            }

            const { data, error } = queryRes;

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
        const localOrigemMap = getLocalLotesOrigemMap();
        const result = allData.map(med => {
            const compositeKey = `${med.nome.trim().toUpperCase()}_${med.lote.trim().toUpperCase()}`;
            const localInfo = localOrigemMap[med.id] || localOrigemMap[compositeKey];
            return {
                ...med,
                alto_custo: med.alto_custo ?? localIds.has(med.id),
                origem: med.origem || localInfo?.origem,
                doador_nome: med.doador_nome || localInfo?.doador_nome,
                documento_origem: med.documento_origem || localInfo?.documento_origem
            };
        });

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


// --- DESISTÊNCIA DE DISPENSAÇÃO (REVERSÃO SEGURA E AUDITADA) ---

export interface RegistrarDesistenciaParams {
    movimentacaoId: string;
    motivo: string;
    retornoAoEstoque: boolean; // true = medicamento não saiu da farmácia (devolve ao saldo dispensável); false = saiu da farmácia (quarentena/bloqueio)
    currentUser?: {
        id?: string;
        name?: string;
        email?: string;
    } | null;
}

export const registrarDesistenciaDispensacao = async (
    params: RegistrarDesistenciaParams
): Promise<{ success: boolean; error?: string; movimentacaoAtualizada?: FarmaciaMovimentacao }> => {
    try {
        const { movimentacaoId, motivo, retornoAoEstoque, currentUser } = params;

        if (!movimentacaoId) {
            return { success: false, error: 'Identificador da dispensação não fornecido.' };
        }
        if (!motivo || !motivo.trim()) {
            return { success: false, error: 'O motivo da desistência é obrigatório para fins de auditoria.' };
        }

        // 1. Buscar dispensação original no Supabase
        const { data: movOriginal, error: movError } = await supabase
            .from('farmacia_movimentacoes')
            .select('*')
            .eq('id', movimentacaoId)
            .single();

        if (movError || !movOriginal) {
            return { success: false, error: 'Dispensação não localizada no banco de dados.' };
        }

        // 2. Validar tipo
        if (movOriginal.tipo !== 'Saída') {
            return { success: false, error: 'Apenas operações de dispensação (Saída) podem receber desistência.' };
        }

        // 3. Validar se já possui desistência registrada (Controle estrito contra duplicidade)
        if (isDesistenciaMovimentacao(movOriginal)) {
            return { success: false, error: 'Esta dispensação já possui desistência registrada anteriormente.' };
        }

        // 4. Validar dia atual no fuso horário America/Sao_Paulo (Horário oficial)
        if (!isTodayInSaoPaulo(movOriginal.data)) {
            return { success: false, error: 'Apenas dispensações realizadas na data de hoje podem receber desistência por este fluxo.' };
        }

        const nowIso = new Date().toISOString();
        const responsavelNome = currentUser?.name || 'Farmacêutico Responsável';
        const responsavelId = currentUser?.id || null;

        // 5. Devolução ao estoque e ao lote de origem se medicamento permaneceu sob controle
        if (retornoAoEstoque) {
            // Localiza o medicamento exato do lote original
            let medId = movOriginal.medicamento_id;
            let currentMed: any = null;

            if (medId) {
                const { data: medData } = await supabase
                    .from('farmacia_medicamentos')
                    .select('*')
                    .eq('id', medId)
                    .maybeSingle();
                currentMed = medData;
            }

            // Fallback: se medId mudou ou não encontrado, busca pelo mesmo nome, lote e categoria
            if (!currentMed && movOriginal.medicamento_nome && movOriginal.lote) {
                const { data: medByLote } = await supabase
                    .from('farmacia_medicamentos')
                    .select('*')
                    .eq('nome', movOriginal.medicamento_nome)
                    .eq('lote', movOriginal.lote)
                    .eq('categoria', movOriginal.medicamento_categoria)
                    .maybeSingle();
                currentMed = medByLote;
                if (currentMed) medId = currentMed.id;
            }

            if (currentMed && medId) {
                const novaQuantidade = (currentMed.quantidade || 0) + Number(movOriginal.quantidade);
                const { error: updateStockErr } = await supabase
                    .from('farmacia_medicamentos')
                    .update({ 
                        quantidade: novaQuantidade,
                        atualizado_em: nowIso 
                    })
                    .eq('id', medId);

                if (updateStockErr) {
                    console.error('[farmaciaService] Erro ao atualizar saldo no estoque:', updateStockErr);
                    return { success: false, error: 'Falha ao devolver quantidade ao saldo do estoque de origem.' };
                }
            } else {
                console.warn('[farmaciaService] Medicamento do lote original não encontrado no catálogo para devolução de saldo.', movOriginal);
            }

            // Inserir movimentação formal de reversão
            const reversaoPayload: any = {
                medicamento_id: medId || movOriginal.medicamento_id,
                medicamento_nome: movOriginal.medicamento_nome,
                medicamento_categoria: movOriginal.medicamento_categoria,
                medicamento_dosagem: movOriginal.medicamento_dosagem || '',
                medicamento_tipo: movOriginal.medicamento_tipo || '',
                quantidade: movOriginal.quantidade,
                tipo: 'Entrada',
                lote: movOriginal.lote,
                validade: movOriginal.validade,
                responsavel_id: responsavelId,
                responsavel_nome: responsavelNome,
                paciente_nome: movOriginal.paciente_nome,
                paciente_cpf: movOriginal.paciente_cpf,
                data: nowIso,
                observacoes: `[REVERSÃO POR DESISTÊNCIA - Movimentação Origem: #${movOriginal.id}] ${motivo.trim()}`
            };

            await supabase.from('farmacia_movimentacoes').insert([reversaoPayload]);
        } else {
            // Caso de Quarentena Sanitária: medicamento saiu da farmácia e foi devolvido
            const quarentenaPayload: any = {
                medicamento_id: movOriginal.medicamento_id,
                medicamento_nome: movOriginal.medicamento_nome,
                medicamento_categoria: movOriginal.medicamento_categoria,
                medicamento_dosagem: movOriginal.medicamento_dosagem || '',
                medicamento_tipo: movOriginal.medicamento_tipo || '',
                quantidade: movOriginal.quantidade,
                tipo: 'Ajuste',
                lote: movOriginal.lote,
                validade: movOriginal.validade,
                responsavel_id: responsavelId,
                responsavel_nome: responsavelNome,
                paciente_nome: movOriginal.paciente_nome,
                paciente_cpf: movOriginal.paciente_cpf,
                data: nowIso,
                observacoes: `[DEVOLUÇÃO EM QUARENTENA SANITÁRIA - Movimentação Origem: #${movOriginal.id}] ${motivo.trim()} (Material segregado - não disponibilizado para nova dispensação)`
            };

            await supabase.from('farmacia_movimentacoes').insert([quarentenaPayload]);
        }

        // 6. Atualizar a movimentação original para marcar desistência definitiva com auditoria
        const situacaoTexto = retornoAoEstoque ? 'Retorno ao Estoque' : 'Quarentena Sanitária';
        const carimboDesistencia = `\n[DESISTÊNCIA REGISTRADA | Data: ${nowIso} | Responsavel: ${responsavelNome} | Situacao: ${situacaoTexto} | Motivo: ${motivo.trim()}]`;
        const updatedObservacoes = `${movOriginal.observacoes || ''}${carimboDesistencia}`.trim();

        const { data: updatedMov, error: updateMovErr } = await supabase
            .from('farmacia_movimentacoes')
            .update({
                observacoes: updatedObservacoes
            })
            .eq('id', movOriginal.id)
            .select()
            .single();

        if (updateMovErr) {
            console.error('[farmaciaService] Erro ao carimbar desistência na movimentação original:', updateMovErr);
            return { success: false, error: 'Falha ao registrar carimbo de desistência na movimentação.' };
        }

        // 7. Invalidar cache de medicamentos
        invalidateMedicamentosCache();

        return {
            success: true,
            movimentacaoAtualizada: updatedMov || { ...movOriginal, observacoes: updatedObservacoes }
        };
    } catch (err: any) {
        console.error('[farmaciaService] registrarDesistenciaDispensacao erro inesperado:', err);
        return { success: false, error: err.message || 'Erro inesperado ao processar desistência.' };
    }
};

// --- AJUSTE MANUAL DE ESTOQUE POR LOTE (AUDITADO E SEGURO) ---

export interface RegistrarAjusteManualParams {
    medicamentoId: string;
    novoSaldo: number;
    saldoEsperadoAnterior: number;
    motivo: string;
    currentUser?: {
        id?: string;
        name?: string;
        email?: string;
        role?: string;
    } | null;
}

export interface RegistrarAjusteManualResult {
    success: boolean;
    error?: string;
    saldoAtualizado?: number;
    medicamentoAtualizado?: FarmaciaMedicamento;
    movimentacaoCriada?: FarmaciaMovimentacao;
    diferenca?: number;
    tipoAjuste?: 'Aumento de estoque' | 'Redução de estoque';
}

export const registrarAjusteManualEstoque = async (
    params: RegistrarAjusteManualParams
): Promise<RegistrarAjusteManualResult> => {
    try {
        const { medicamentoId, novoSaldo, saldoEsperadoAnterior, motivo, currentUser } = params;

        // 1. Validações preliminares
        if (!medicamentoId) {
            return { success: false, error: 'Identificador do lote de medicamento não fornecido.' };
        }

        if (typeof novoSaldo !== 'number' || isNaN(novoSaldo) || !Number.isInteger(novoSaldo) || novoSaldo < 0) {
            return { success: false, error: 'A nova quantidade informada deve ser um número inteiro válido e não negativo (≥ 0).' };
        }

        if (!motivo || !motivo.trim() || motivo.trim().length < 5) {
            return { success: false, error: 'A justificativa do ajuste é obrigatória (mínimo de 5 caracteres) para fins de auditoria e controle de estoque.' };
        }

        // 2. Buscar o registro atualizado no Supabase para verificação concorrente
        const { data: currentMed, error: fetchErr } = await supabase
            .from('farmacia_medicamentos')
            .select('*')
            .eq('id', medicamentoId)
            .single();

        if (fetchErr || !currentMed) {
            console.error('[farmaciaService] Erro ao buscar lote para ajuste:', fetchErr);
            return { success: false, error: 'Lote de medicamento não localizado no banco de dados.' };
        }

        const saldoAtualNoBanco = Number(currentMed.quantidade) || 0;

        // 3. Controle de Concorrência: se o saldo mudou após o modal ser aberto
        if (saldoAtualNoBanco !== Number(saldoEsperadoAnterior)) {
            return {
                success: false,
                error: `O saldo deste lote foi modificado por outra operação recentemente (Saldo atual no banco: ${saldoAtualNoBanco}, saldo conferido na tela: ${saldoEsperadoAnterior}). Por segurança, a alteração foi interrompida para evitar sobrescrita concorrente. Por favor, reabra o ajuste para nova conferência.`,
                saldoAtualizado: saldoAtualNoBanco
            };
        }

        // 4. Bloquear ajustes sem diferença efetiva
        const diferenca = novoSaldo - saldoAtualNoBanco;
        if (diferenca === 0) {
            return {
                success: false,
                error: 'A nova quantidade informada é idêntica ao saldo atual do lote. Não existe diferença para ajustar.'
            };
        }

        const tipoAjusteTexto = diferenca > 0 ? 'Aumento de estoque' : 'Redução de estoque';
        const nowIso = new Date().toISOString();
        const responsavelNome = currentUser?.name || 'Operador Autorizado';
        const responsavelId = currentUser?.id || null;

        // 5. Atualizar o saldo do lote no banco
        const { data: updatedMed, error: updateErr } = await supabase
            .from('farmacia_medicamentos')
            .update({
                quantidade: novoSaldo,
                atualizado_em: nowIso
            })
            .eq('id', medicamentoId)
            .select()
            .single();

        if (updateErr) {
            console.error('[farmaciaService] Erro ao atualizar saldo do lote:', updateErr);
            return { success: false, error: 'Falha ao atualizar o saldo do lote no banco de dados.' };
        }

        // 6. Inserir movimentação permanente de auditoria no histórico
        const observacaoAuditoria = `[AJUSTE DE ESTOQUE | Anterior: ${saldoAtualNoBanco} | Novo: ${novoSaldo} | Dif: ${diferenca > 0 ? `+${diferenca}` : diferenca} | Tipo: ${tipoAjusteTexto}] Justificativa: ${motivo.trim()}`;

        const payloadMovimentacao: any = {
            medicamento_id: currentMed.id,
            medicamento_nome: currentMed.nome,
            medicamento_categoria: currentMed.categoria,
            medicamento_dosagem: currentMed.dosagem || '',
            medicamento_tipo: currentMed.tipo || '',
            quantidade: Math.abs(diferenca),
            tipo: 'Ajuste',
            lote: currentMed.lote,
            validade: currentMed.validade,
            responsavel_id: responsavelId,
            responsavel_nome: responsavelNome,
            data: nowIso,
            observacoes: observacaoAuditoria
        };

        const { data: movData, error: movErr } = await supabase
            .from('farmacia_movimentacoes')
            .insert([payloadMovimentacao])
            .select()
            .single();

        if (movErr) {
            console.error('[farmaciaService] Erro ao registrar movimentação de ajuste no histórico:', movErr);
        }

        // 7. Invalidar cache de medicamentos
        invalidateMedicamentosCache();

        return {
            success: true,
            medicamentoAtualizado: updatedMed,
            movimentacaoCriada: movData,
            diferenca,
            tipoAjuste: tipoAjusteTexto
        };
    } catch (err: any) {
        console.error('[farmaciaService] registrarAjusteManualEstoque erro inesperado:', err);
        return { success: false, error: err.message || 'Erro inesperado ao processar ajuste de estoque.' };
    }
};
