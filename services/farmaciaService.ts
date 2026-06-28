import { supabase } from './supabaseClient';
import { FarmaciaMedicamento, FarmaciaMovimentacao, FarmaciaConfig } from '../types';
import { handleSupabaseError } from '../utils/errorUtils';

// --- MEDICAMENTOS ---

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
        return allData;
    } catch (error) {
        const appError = handleSupabaseError(error);
        console.error('[farmaciaService] getMedicamentos Error:', appError.message);
        return [];
    }
};

export const createMedicamento = async (
    med: Omit<FarmaciaMedicamento, 'id' | 'criado_em' | 'atualizado_em'>
): Promise<FarmaciaMedicamento | null> => {
    try {
        const { data, error } = await supabase
            .from('farmacia_medicamentos')
            .insert([med])
            .select()
            .single();

        if (error) throw error;
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
    try {
        const { data, error } = await supabase
            .from('farmacia_medicamentos')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
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

export const getMovimentacoes = async (filters?: MovimentacaoFilters): Promise<FarmaciaMovimentacao[]> => {
    try {
        let query = supabase
            .from('farmacia_movimentacoes')
            .select('*')
            .order('data', { ascending: false });

        const { data, error } = await query;
        if (error) throw error;

        let filtered = data || [];

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
