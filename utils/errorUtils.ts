import { PostgrestError } from '@supabase/supabase-js';
import { errorMonitor } from '../services/errorMonitorService';

export interface AppError {
    message: string;
    code?: string;
    details?: string;
    hint?: string;
}

export const handleSupabaseError = (error: PostgrestError | any): AppError => {
    // Enhanced logging for debugging
    console.error('[Supabase Error]', {
        message: error?.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint
    });

    const code = error?.code || 'UNKNOWN';

    // Notifica o monitor global de erros para exibição no modal
    try {
        errorMonitor.captureError(error?.message || 'Erro na operação do banco de dados', {
            type: `Erro do Supabase (${code})`,
            details: error?.details ? `${error.details} ${error?.hint || ''}`.trim() : error?.hint
        });
    } catch {
        // Não quebra caso o monitor falhe
    }

    switch (code) {
        case '23505': // unique_violation
            return {
                message: 'Este registro já existe. Verifique se não está duplicando dados.',
                code,
            };
        case '23503': // foreign_key_violation
            return {
                message: 'A operação depende de um registro que não existe ou foi removido.',
                code,
            };
        case '42501': // insufficient_privilege
            return {
                message: 'Você não tem permissão para realizar esta ação.',
                code,
            };
        case 'PGRST116': // The result contains 0 rows
            return {
                message: 'Registro não encontrado.',
                code,
            };
        case '42703': // undefined_column
            return {
                message: 'Erro interno de estrutura de dados (coluna não encontrada).',
                code,
            };
        case '57014': // query_canceled
        case '504': // Gateway Timeout (HTTP)
            return {
                code,
                message: 'A operação demorou muito e foi cancelada. Tente novamente ou refine seus filtros.'
            };
        default:
            if (error.status === 500 || error.status === 502 || error.status === 520 || error.status === 522) {
                return {
                    code: String(error.status),
                    message: 'Erro de conexão com o servidor. Verifique sua internet ou tente mais tarde.'
                }
            }
            return {
                message: error.message || 'Ocorreu um erro desconhecido.',
                code,
                details: error.details,
                hint: error.hint
            };
    }
};
