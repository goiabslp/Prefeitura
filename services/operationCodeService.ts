import { supabase } from './supabaseClient';
import { OperationCode } from '../types';

// Generate 6-char alphanumeric code
const generateCode = (): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
};

export const getOrCreateOperationCode = async (moduleName: string, recordId: string): Promise<string> => {
    try {
        // 1. Check if code already exists for this module & record_id
        const { data, error } = await supabase
            .from('operation_codes')
            .select('code')
            .eq('module', moduleName)
            .eq('record_id', recordId)
            .maybeSingle();

        if (error) throw error;
        if (data) return data.code;

        // 2. If it does not exist, generate and try to insert
        let attempts = 0;
        while (attempts < 10) {
            const newCode = generateCode();
            const { error: insertError } = await supabase
                .from('operation_codes')
                .insert([{
                    code: newCode,
                    module: moduleName,
                    record_id: recordId
                }]);

            if (!insertError) {
                return newCode;
            }
            attempts++;
        }
        throw new Error('Falha ao gerar código de operação único.');
    } catch (err) {
        console.error('[operationCodeService] getOrCreateOperationCode error:', err);
        // Fallback to a derived key if offline or database error
        return 'OP' + recordId.slice(0, 4).toUpperCase();
    }
};

export const getRecordByOperationCode = async (code: string): Promise<OperationCode | null> => {
    try {
        const { data, error } = await supabase
            .from('operation_codes')
            .select('*')
            .eq('code', code.toUpperCase())
            .maybeSingle();

        if (error) throw error;
        return data;
    } catch (err) {
        console.error('[operationCodeService] getRecordByOperationCode error:', err);
        return null;
    }
};
