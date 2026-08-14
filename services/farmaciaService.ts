import { supabase } from './supabaseClient';
import { FarmaciaMedicamento, FarmaciaMovimentacao, FarmaciaConfig } from '../types';
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

export const getMedicamentos = async (): Promise<FarmaciaMedicamento[]> => {
    try {
        let allData: FarmaciaMedicamento[] = [];
        let from = 0;
        const step = 1000;
        let hasMore = true;

        while (hasMore) {
            const { data, error } = await supabase
                .from('farmacia_medicamentos')
                .select('*')
                .order('nome', { ascending: true })
                .range(from, from + step - 1);

            if (error) throw error;
            
            if (data && data.length > 0) {
                allData = [...allData, ...data];
                from += step;
                if (data.length < step) {
                    hasMore = false;
                }
            } else {
                hasMore = false;
            }
        }

        const localIds = getLocalAltoCustoIds();
        return allData.map(med => ({
            ...med,
            alto_custo: med.alto_custo ?? localIds.has(med.id)
        }));
    } catch (error) {
        const appError = handleSupabaseError(error);
        console.error('[farmaciaService] getMedicamentos Error:', appError.message);
        return [];
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
                        .select('*')
                        .eq('id', id)
                        .single();

                    if (currentErr) throw currentErr;
                    return {
                        ...currentData,
                        alto_custo: altoCustoValue
                    };
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

        let query = supabase
            .from('farmacia_movimentacoes')
            .select('*')
            .order('data', { ascending: false });

        const { data, error } = await query;
        if (error) throw error;

        let filtered = (data || []).filter(m => 
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

        // Insert movement history log
        const { data, error } = await supabase
            .from('farmacia_movimentacoes')
            .insert([mov])
            .select()
            .single();

        if (error) throw error;
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

