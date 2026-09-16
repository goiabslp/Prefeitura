import { supabase } from './supabaseClient';
import { Projeto, ProjetoHistory, ProjetoStatus } from '../types';
import { handleSupabaseError } from '../utils/errorUtils';

export const getProjetos = async (): Promise<Projeto[]> => {
    try {
        const PROJETO_COLUMNS = 'id, name, description, responsible_id, status, start_date, end_date, current_owner_id, current_sector_id, objectives, created_by, created_at, updated_at';
        const { data, error } = await supabase
            .from('projetos')
            .select(PROJETO_COLUMNS)
            .order('created_at', { ascending: false });

        if (error) {
            throw error;
        }

        return data || [];
    } catch (error) {
        const appError = handleSupabaseError(error);
        console.error('[projetosService] getProjetos Error:', appError.message);
        return [];
    }
};

export const getProjetoById = async (id: string): Promise<Projeto | null> => {
    try {
        const PROJETO_COLUMNS = 'id, name, description, responsible_id, status, start_date, end_date, current_owner_id, current_sector_id, objectives, created_by, created_at, updated_at';
        const { data, error } = await supabase
            .from('projetos')
            .select(PROJETO_COLUMNS)
            .eq('id', id)
            .single();

        if (error) {
            throw error;
        }

        return data;
    } catch (error) {
        const appError = handleSupabaseError(error);
        console.error('[projetosService] getProjetoById Error:', appError.message);
        return null;
    }
};

export const getProjetoHistory = async (projectId: string): Promise<ProjetoHistory[]> => {
    try {
        const HISTORY_COLUMNS = 'id, project_id, user_id, sector_id, action, message, attachments, created_at';
        const { data, error } = await supabase
            .from('projeto_history')
            .select(HISTORY_COLUMNS)
            .eq('project_id', projectId)
            .order('created_at', { ascending: true });

        if (error) {
            throw error;
        }

        return data || [];
    } catch (error) {
        const appError = handleSupabaseError(error);
        console.error('[projetosService] getProjetoHistory Error:', appError.message);
        return [];
    }
};

export const createProjeto = async (data: Omit<Projeto, 'id' | 'created_at' | 'updated_at'>, initialMessage?: string, attachments?: { url: string; name: string; caption?: string }[]): Promise<Projeto> => {
    try {
        // Create project
        const { data: savedData, error } = await supabase
            .from('projetos')
            .insert([data])
            .select()
            .single();

        if (error) {
            throw error;
        }

        // Add history entry for creation
        await supabase
            .from('projeto_history')
            .insert([{
                project_id: savedData.id,
                user_id: data.created_by,
                sector_id: data.current_sector_id,
                action: 'Criado',
                message: initialMessage || 'Projeto criado.',
                attachments: attachments || []
            }]);

        return savedData;
    } catch (error) {
        const appError = handleSupabaseError(error);
        console.error('[projetosService] createProjeto Error:', appError.message);
        throw appError;
    }
};

export const updateProjeto = async (id: string, updates: Partial<Projeto>): Promise<Projeto> => {
    try {
        const { data, error } = await supabase
            .from('projetos')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            throw error;
        }

        return data;
    } catch (error) {
        const appError = handleSupabaseError(error);
        console.error('[projetosService] updateProjeto Error:', appError.message);
        throw appError;
    }
};

export const deleteProjeto = async (id: string): Promise<boolean> => {
    try {
        const { error } = await supabase
            .from('projetos')
            .delete()
            .eq('id', id);

        if (error) {
            throw error;
        }

        return true;
    } catch (error) {
        const appError = handleSupabaseError(error);
        console.error('[projetosService] deleteProjeto Error:', appError.message);
        throw appError;
    }
};

export const forwardProjeto = async (
    projectId: string,
    fromUserId: string,
    fromSectorId: string | undefined,
    toUserId: string | null,
    toSectorId: string | null,
    message: string,
    newStatus?: ProjetoStatus,
    attachments?: { url: string; name: string; caption?: string }[]
): Promise<void> => {
    try {
        // Update project owner and/or status
        const updates: Partial<Projeto> = {};
        if (toUserId) updates.current_owner_id = toUserId;
        else updates.current_owner_id = undefined; // Forwarded to sector, no specific owner

        if (toSectorId) updates.current_sector_id = toSectorId;

        if (newStatus) updates.status = newStatus;

        const { error: updateError } = await supabase
            .from('projetos')
            .update(updates)
            .eq('id', projectId);

        if (updateError) {
            throw updateError;
        }

        // Action verb depends on status change or normal forward
        let action: ProjetoHistory['action'] = 'Encaminhado';
        if (newStatus === 'Concluído' || newStatus === 'Cancelado') {
            action = 'Status Alterado';
        }

        // Add history
        const { error: historyError } = await supabase
            .from('projeto_history')
            .insert([{
                project_id: projectId,
                user_id: fromUserId,
                sector_id: fromSectorId,
                action: action,
                message: message,
                attachments: attachments || []
            }]);

        if (historyError) {
            throw historyError;
        }
    } catch (error) {
        const appError = handleSupabaseError(error);
        console.error('[projetosService] forwardProjeto Error:', appError.message);
        throw appError;
    }
};

export const addProjetoMessage = async (
    projectId: string,
    userId: string,
    sectorId: string | undefined,
    message: string,
    attachments?: { url: string; name: string; caption?: string }[]
): Promise<void> => {
    try {
        const action: ProjetoHistory['action'] = (attachments && attachments.length > 0 && !message) ? 'Anexo' : 'Mensagem';

        const { error } = await supabase
            .from('projeto_history')
            .insert([{
                project_id: projectId,
                user_id: userId,
                sector_id: sectorId,
                action: action,
                message: message,
                attachments: attachments || []
            }]);

        if (error) {
            throw error;
        }

        // Touch the updated_at column on the project
        await supabase
            .from('projetos')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', projectId);

    } catch (error) {
        const appError = handleSupabaseError(error);
        console.error('[projetosService] addProjetoMessage Error:', appError.message);
        throw appError;
    }
};
