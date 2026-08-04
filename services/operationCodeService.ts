import { supabase } from './supabaseClient';
import { OperationCode } from '../types';

// Generate 6-char alphanumeric code (excluding ambiguous characters: 0, O, 1, I, L)
const generateCode = (): string => {
    const chars = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';
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
        
        // Fallback determinístico e único usando hash do recordId
        let hash = 0;
        const strId = String(recordId);
        for (let i = 0; i < strId.length; i++) {
            const char = strId.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash |= 0;
        }
        const chars = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';
        let hashStr = '';
        let val = Math.abs(hash);
        for (let i = 0; i < 4; i++) {
            hashStr += chars.charAt(val % chars.length);
            val = Math.floor(val / chars.length);
        }
        return 'OP' + hashStr;
    }
};

// Gera variações de códigos tratando caracteres visualmente ambíguos (ex: 0 e O, 1 e I/L)
export const getCodeVariations = (code: string): string[] => {
    const chars = code.toUpperCase().trim().split('');
    let results: string[][] = [[]];

    const ambiguityMap: { [key: string]: string[] } = {
        '0': ['0', 'O'],
        'O': ['0', 'O'],
        '1': ['1', 'I', 'L'],
        'I': ['1', 'I', 'L'],
        'L': ['1', 'I', 'L']
    };

    for (const char of chars) {
        const replacements = ambiguityMap[char] || [char];
        const newResults: string[][] = [];
        for (const res of results) {
            for (const rep of replacements) {
                newResults.push([...res, rep]);
            }
        }
        results = newResults;
    }

    return results.map(arr => arr.join(''));
};

export const getRecordByOperationCode = async (code: string): Promise<OperationCode | null> => {
    try {
        const variations = getCodeVariations(code);
        
        // Busca flexível tolerante a erros de digitação comuns
        const { data, error } = await supabase
            .from('operation_codes')
            .select('*')
            .in('code', variations);

        if (error) throw error;
        
        if (data && data.length > 0) {
            return data[0];
        }
        return null;
    } catch (err) {
        console.error('[operationCodeService] getRecordByOperationCode error:', err);
        return null;
    }
};
