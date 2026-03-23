import { supabase } from './supabaseClient';
import { RhHorasExtras } from '../types';
import { handleSupabaseError } from '../utils/errorUtils';

export const saveRhHorasExtras = async (data: Omit<RhHorasExtras, 'id' | 'created_at'>): Promise<RhHorasExtras> => {
    try {
        const { data: savedData, error } = await supabase
            .from('rh_horas_extras')
            .insert([data])
            .select()
            .single();

        if (error) {
            throw error;
        }

        return savedData;
    } catch (error) {
        const appError = handleSupabaseError(error);
        console.error('[rhService] saveRhHorasExtras Error:', appError.message);
        throw appError;
    }
};

export const getRhHorasExtrasHistory = async (page: number = 1, limit: number = 50): Promise<{ data: RhHorasExtras[], count: number }> => {
    try {
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        const { data, error, count } = await supabase
            .from('rh_horas_extras')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(from, to);

        if (error) {
            throw error;
        }

        return { data: data || [], count: count || 0 };
    } catch (error) {
        const appError = handleSupabaseError(error);
        console.error('[rhService] getRhHorasExtrasHistory Error:', appError.message);
        return { data: [], count: 0 };
    }
};

export const getRhHorasExtrasById = async (id: string): Promise<RhHorasExtras | null> => {
    try {
        const { data, error } = await supabase
            .from('rh_horas_extras')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            throw error;
        }

        return data;
    } catch (error) {
        const appError = handleSupabaseError(error);
        console.error('[rhService] getRhHorasExtrasById Error:', appError.message);
        return null;
    }
};

export const deleteRhHorasExtras = async (id: string): Promise<boolean> => {
    try {
        const { error } = await supabase
            .from('rh_horas_extras')
            .delete()
            .eq('id', id);

        if (error) {
            throw error;
        }

        return true;
    } catch (error) {
        const appError = handleSupabaseError(error);
        console.error('[rhService] deleteRhHorasExtras Error:', appError.message);
        throw appError;
    }
};
export const updateRhHorasExtras = async (id: string, data: Partial<RhHorasExtras>): Promise<RhHorasExtras> => {
    try {
        const { data: updatedData, error } = await supabase
            .from('rh_horas_extras')
            .update(data)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            throw error;
        }

        return updatedData;
    } catch (error) {
        const appError = handleSupabaseError(error);
        console.error('[rhService] updateRhHorasExtras Error:', appError.message);
        throw appError;
    }
};
