/**
 * Utilitários para validação rigorosa, normalização, formatação e detecção
 * de telefones fictícios/inválidos segundo as normas da Anatel e padrões de integridade cadastral.
 */

// Lista oficial dos 67 DDDs válidos no Brasil (Resoluções Anatel)
export const VALID_BRAZILIAN_DDDS: ReadonlySet<string> = new Set([
    // Região 1 (São Paulo)
    '11', '12', '13', '14', '15', '16', '17', '18', '19',
    // Região 2 (Rio de Janeiro e Espírito Santo)
    '21', '22', '24', '27', '28',
    // Região 3 (Minas Gerais)
    '31', '32', '33', '34', '35', '37', '38',
    // Região 4 (Paraná e Santa Catarina)
    '41', '42', '43', '44', '45', '46', '47', '48', '49',
    // Região 5 (Rio Grande do Sul)
    '51', '53', '54', '55',
    // Região 6 (Centro-Oeste, Tocantins, Acre e Rondônia)
    '61', '62', '63', '64', '65', '66', '67', '68', '69',
    // Região 7 (Bahia e Sergipe)
    '71', '73', '74', '75', '77', '79',
    // Região 8 (Pernambuco, Alagoas, Paraíba, Rio Grande do Norte, Ceará, Piauí)
    '81', '82', '83', '84', '85', '86', '87', '88', '89',
    // Região 9 (Pará, Amazonas, Roraima, Amapá, Maranhão)
    '91', '92', '93', '94', '95', '96', '97', '98', '99'
]);

export const TELEFONE_INVALIDO_MSG = 'Telefone inválido ou com padrão de preenchimento fictício. Informe um número válido para continuar.';

export type PhoneValidationErrorCode =
    | 'EMPTY'
    | 'INVALID_LENGTH'
    | 'INVALID_DDD'
    | 'INVALID_ANATEL_RULE'
    | 'REPETITIVE_DIGITS'
    | 'PROGRESSIVE_SEQUENCE'
    | 'CYCLIC_PATTERN'
    | 'SUSPICIOUS_FICTITIOUS';

export interface PhoneValidationResult {
    isValid: boolean;
    isEmpty: boolean;
    type?: 'mobile' | 'landline';
    ddd?: string;
    localNumber?: string;
    digits?: string;
    formatted?: string;
    errorCode?: PhoneValidationErrorCode;
    errorMessage?: string;
    diagnosticReason?: string;
}

export interface PhoneValidationOptions {
    required?: boolean;
    allowLandline?: boolean; // Padrão: true (aceita tanto celular quanto fixo)
}

/**
 * Remove toda pontuação e caracteres não numéricos.
 */
export const normalizePhone = (value?: string | null): string => {
    if (!value) return '';
    return String(value).replace(/\D/g, '');
};

/**
 * Aplica máscara progressiva padrão brasileira:
 * - 11 dígitos: (XX) XXXXX-XXXX
 * - 10 dígitos: (XX) XXXX-XXXX
 */
export const formatBrazilianPhone = (value?: string | null): string => {
    const digits = normalizePhone(value);
    if (!digits) return '';

    if (digits.length > 10) {
        return digits.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    }
    if (digits.length > 6) {
        if (digits.length === 10) {
            return digits.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
        }
        return digits.replace(/(\d{2})(\d{4,5})(\d{0,4})/, '($1) $2-$3');
    }
    if (digits.length > 2) {
        return digits.replace(/(\d{2})(\d{0,5})/, '($1) $2');
    }
    return digits;
};

/**
 * Máscara amigável para digitação contínua em inputs.
 */
export const maskPhoneInput = (value: string): string => {
    return formatBrazilianPhone(value);
};

/**
 * Aplica máscara de WhatsApp com o formato exato: (00) 0 0000-0000
 */
export const formatWhatsApp = (value?: string | null): string => {
    const digits = normalizePhone(value).slice(0, 11);
    if (!digits) return '';

    if (digits.length <= 2) {
        return `(${digits}`;
    }
    if (digits.length <= 3) {
        return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    }
    if (digits.length <= 7) {
        return `(${digits.slice(0, 2)}) ${digits.slice(2, 3)} ${digits.slice(3)}`;
    }
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 3)} ${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
};

/**
 * Máscara amigável para digitação contínua no campo WhatsApp.
 */
export const maskWhatsAppInput = (value: string): string => {
    return formatWhatsApp(value);
};

/**
 * Aplica máscara de Telefone Fixo com o formato exato: (00) 0000-0000
 */
export const formatLandlinePhone = (value?: string | null): string => {
    const digits = normalizePhone(value).slice(0, 10);
    if (!digits) return '';

    if (digits.length <= 2) {
        return `(${digits}`;
    }
    if (digits.length <= 6) {
        return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    }
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6, 10)}`;
};

/**
 * Máscara amigável para digitação contínua no campo Telefone Fixo.
 */
export const maskLandlineInput = (value: string): string => {
    return formatLandlinePhone(value);
};

/**
 * Verifica se uma string de dígitos é uma sequência puramente progressiva ou regressiva.
 * Ex: "12345678", "123456789", "987654321", "87654321"
 */
const isSequential = (str: string): boolean => {
    if (str.length < 5) return false;
    let isAsc = true;
    let isDesc = true;

    for (let i = 0; i < str.length - 1; i++) {
        const curr = Number(str[i]);
        const next = Number(str[i + 1]);
        if ((curr + 1) % 10 !== next) isAsc = false;
        if ((curr - 1 + 10) % 10 !== next) isDesc = false;
        if (!isAsc && !isDesc) return false;
    }

    return isAsc || isDesc;
};

/**
 * Detecta se a string contém uma subsequência de pelo menos 6 dígitos consecutivos
 * estritamente crescentes ou decrescentes.
 * Ex: "987654320" contém os 8 dígitos "98765432"
 */
const hasLongSequentialRun = (str: string, minLength = 6): boolean => {
    if (str.length < minLength) return false;

    let ascRun = 1;
    let descRun = 1;

    for (let i = 0; i < str.length - 1; i++) {
        const curr = Number(str[i]);
        const next = Number(str[i + 1]);

        if (curr + 1 === next) {
            ascRun++;
            if (ascRun >= minLength) return true;
        } else {
            ascRun = 1;
        }

        if (curr - 1 === next) {
            descRun++;
            if (descRun >= minLength) return true;
        } else {
            descRun = 1;
        }
    }

    return false;
};

/**
 * Detecta padrões cíclicos artificiais repetitivos (blocos de 2, 3 ou 4 dígitos).
 * Ex: "12121212", "123123123", "12341234"
 */
const isCyclicPattern = (str: string): boolean => {
    if (str.length < 6) return false;

    // Blocos de tamanho 2 a 4
    for (let blockSize = 2; blockSize <= 4; blockSize++) {
        if (str.length >= blockSize * 2) {
            const block = str.slice(0, blockSize);
            // Verifica se o bloco não é composto apenas pelo mesmo dígito (já pego por repetitivo)
            if (/^(\d)\1+$/.test(block)) continue;

            let matches = true;
            for (let i = 0; i < str.length; i++) {
                if (str[i] !== block[i % blockSize]) {
                    matches = false;
                    break;
                }
            }
            if (matches) return true;
        }
    }

    return false;
};

/**
 * Validação rigorosa e completa de telefone celular ou fixo brasileiro.
 */
export const validateBrazilianPhone = (
    value?: string | null,
    options?: PhoneValidationOptions
): PhoneValidationResult => {
    const isRequired = options?.required ?? false;
    const allowLandline = options?.allowLandline ?? true;
    const digits = normalizePhone(value);

    // 1. Campo Vazio
    if (!digits) {
        if (isRequired) {
            return {
                isValid: false,
                isEmpty: true,
                errorCode: 'EMPTY',
                errorMessage: 'O Telefone / WhatsApp é obrigatório.',
                diagnosticReason: 'Campo obrigatório não informado'
            };
        }
        return {
            isValid: true,
            isEmpty: true
        };
    }

    // 2. Comprimento de dígitos (deve ser 10 ou 11)
    if (digits.length !== 10 && digits.length !== 11) {
        return {
            isValid: false,
            isEmpty: false,
            digits,
            errorCode: 'INVALID_LENGTH',
            errorMessage: TELEFONE_INVALIDO_MSG,
            diagnosticReason: `Quantidade incorreta de dígitos (${digits.length} dígitos; esperado 10 ou 11)`
        };
    }

    // 3. Dígitos todos iguais em todo o número (ex: 11111111111, 99999999999, 00000000000)
    if (/^(\d)\1+$/.test(digits)) {
        return {
            isValid: false,
            isEmpty: false,
            digits,
            errorCode: 'REPETITIVE_DIGITS',
            errorMessage: TELEFONE_INVALIDO_MSG,
            diagnosticReason: 'Todos os dígitos são iguais'
        };
    }

    // 4. Validação do DDD
    const ddd = digits.slice(0, 2);
    if (!VALID_BRAZILIAN_DDDS.has(ddd)) {
        return {
            isValid: false,
            isEmpty: false,
            digits,
            ddd,
            errorCode: 'INVALID_DDD',
            errorMessage: TELEFONE_INVALIDO_MSG,
            diagnosticReason: `DDD "${ddd}" inexistente na lista oficial da Anatel`
        };
    }

    const localNumber = digits.slice(2);
    const isMobile = digits.length === 11;
    const type: 'mobile' | 'landline' = isMobile ? 'mobile' : 'landline';

    // 5. Restrição de telefone fixo caso desabilitado
    if (!allowLandline && !isMobile) {
        return {
            isValid: false,
            isEmpty: false,
            digits,
            ddd,
            localNumber,
            type,
            errorCode: 'INVALID_ANATEL_RULE',
            errorMessage: 'Informe um número de celular válido com 9 dígitos locais e DDD.',
            diagnosticReason: 'Telefone fixo não permitido nesta operação'
        };
    }

    // 6. Regras da Anatel para o primeiro dígito do número local
    if (isMobile) {
        // Celular (11 dígitos):
        // 1º dígito local (pos 2) DEVE ser 9
        if (localNumber[0] !== '9') {
            return {
                isValid: false,
                isEmpty: false,
                digits,
                ddd,
                localNumber,
                type,
                errorCode: 'INVALID_ANATEL_RULE',
                errorMessage: TELEFONE_INVALIDO_MSG,
                diagnosticReason: `Celular inválido: deve iniciar com dígito 9 (iniciou com "${localNumber[0]}")`
            };
        }
        // 2º dígito local (pos 3) não pode ser 0 ou 1 (padrão celular civil Anatel: 96, 97, 98, 99 ou 9[2-9])
        if (localNumber[1] === '0' || localNumber[1] === '1') {
            return {
                isValid: false,
                isEmpty: false,
                digits,
                ddd,
                localNumber,
                type,
                errorCode: 'INVALID_ANATEL_RULE',
                errorMessage: TELEFONE_INVALIDO_MSG,
                diagnosticReason: `Celular com prefixo 9${localNumber[1]} inexistente nas regras de numeração móvel`
            };
        }
    } else {
        // Fixo (10 dígitos):
        // 1º dígito local (pos 2) DEVE ser entre 2 e 5
        const firstDigit = Number(localNumber[0]);
        if (isNaN(firstDigit) || firstDigit < 2 || firstDigit > 5) {
            return {
                isValid: false,
                isEmpty: false,
                digits,
                ddd,
                localNumber,
                type,
                errorCode: 'INVALID_ANATEL_RULE',
                errorMessage: TELEFONE_INVALIDO_MSG,
                diagnosticReason: `Telefone fixo inválido: primeiro dígito local deve ser entre 2 e 5 (iniciou com "${localNumber[0]}")`
            };
        }
    }

    // 7. Corpo local composto inteiramente pelo mesmo dígito
    // Ex: (31) 0 0000-0000, (31) 9 9999-9999, (31) 1 1111-1111, (11) 2222-2222
    if (/^(\d)\1+$/.test(localNumber)) {
        return {
            isValid: false,
            isEmpty: false,
            digits,
            ddd,
            localNumber,
            type,
            errorCode: 'REPETITIVE_DIGITS',
            errorMessage: TELEFONE_INVALIDO_MSG,
            diagnosticReason: 'Número local composto exclusivamente pelo mesmo dígito repetido'
        };
    }

    // 8. Sequências repetitivas com o mesmo dígito do DDD
    // Ex: (11) 1 1111-1111, (22) 2 2222-2222, (33) 3 3333-3333
    if (ddd[0] === ddd[1]) {
        const fullRepetitive = ddd[0].repeat(digits.length);
        if (digits === fullRepetitive) {
            return {
                isValid: false,
                isEmpty: false,
                digits,
                ddd,
                localNumber,
                type,
                errorCode: 'REPETITIVE_DIGITS',
                errorMessage: TELEFONE_INVALIDO_MSG,
                diagnosticReason: `Sequência repetitiva evidente com o DDD: (${ddd}) ${ddd[0]} ${ddd[0].repeat(4)}-${ddd[0].repeat(4)}`
            };
        }
    }

    // 9. Zeros excessivos no corpo local
    // Ex: celular 90000-0000, fixo 2000-0000
    if (/^[2-9]0{7,}$/.test(localNumber)) {
        return {
            isValid: false,
            isEmpty: false,
            digits,
            ddd,
            localNumber,
            type,
            errorCode: 'SUSPICIOUS_FICTITIOUS',
            errorMessage: TELEFONE_INVALIDO_MSG,
            diagnosticReason: 'Número fictício composto por prefixo seguido de zeros'
        };
    }

    // 10. Sequências progressivas ou regressivas no corpo local
    // Ex: 123456789, 987654321, 012345678, 87654321, 987654320
    if (isSequential(localNumber) || (isMobile && isSequential(localNumber.slice(1))) || hasLongSequentialRun(localNumber, 6)) {
        return {
            isValid: false,
            isEmpty: false,
            digits,
            ddd,
            localNumber,
            type,
            errorCode: 'PROGRESSIVE_SEQUENCE',
            errorMessage: TELEFONE_INVALIDO_MSG,
            diagnosticReason: `Sequência ${localNumber.startsWith('1') || localNumber.startsWith('0') ? 'progressiva' : 'regressiva'} evidente no número local (${localNumber})`
        };
    }

    // 11. Padrões cíclicos artificiais
    // Ex: 121212121, 123123123, 12341234
    if (isCyclicPattern(localNumber)) {
        return {
            isValid: false,
            isEmpty: false,
            digits,
            ddd,
            localNumber,
            type,
            errorCode: 'CYCLIC_PATTERN',
            errorMessage: TELEFONE_INVALIDO_MSG,
            diagnosticReason: `Padrão de repetição artificial/cíclica (${localNumber})`
        };
    }

    // No celular, se o bloco após o '9' for cíclico: ex: 9 1212-1212, 9 1231-2312
    if (isMobile && isCyclicPattern(localNumber.slice(1))) {
        return {
            isValid: false,
            isEmpty: false,
            digits,
            ddd,
            localNumber,
            type,
            errorCode: 'CYCLIC_PATTERN',
            errorMessage: TELEFONE_INVALIDO_MSG,
            diagnosticReason: `Padrão de repetição cíclica após o 9 (${localNumber})`
        };
    }

    // 12. Detecção de dígito único excessivo no corpo local
    // No celular (9 dígitos): se 8 dígitos após o primeiro forem o mesmo (ex: 988888888, 911111111)
    if (isMobile && /^(\d)\1{7,}$/.test(localNumber.slice(1))) {
        return {
            isValid: false,
            isEmpty: false,
            digits,
            ddd,
            localNumber,
            type,
            errorCode: 'REPETITIVE_DIGITS',
            errorMessage: TELEFONE_INVALIDO_MSG,
            diagnosticReason: 'Sufixo composto por 8 dígitos consecutivos idênticos'
        };
    }

    // Se 6 ou mais dígitos consecutivos forem idênticos (ex: 983333332, 23444444)
    if (/(\d)\1{5,}/.test(localNumber)) {
        return {
            isValid: false,
            isEmpty: false,
            digits,
            ddd,
            localNumber,
            type,
            errorCode: 'REPETITIVE_DIGITS',
            errorMessage: TELEFONE_INVALIDO_MSG,
            diagnosticReason: '6 ou mais dígitos idênticos consecutivos no número'
        };
    }

    // Número Válido!
    return {
        isValid: true,
        isEmpty: false,
        type,
        ddd,
        localNumber,
        digits,
        formatted: formatBrazilianPhone(digits)
    };
};

/**
 * Retorna true se o telefone não estiver vazio e apresentar qualquer inconsistência/suspeita.
 */
export const isSuspiciousPhone = (value?: string | null): boolean => {
    if (!value || !value.trim()) return false;
    const res = validateBrazilianPhone(value, { required: false });
    return !res.isValid;
};

/**
 * Retorna a justificativa descritiva do motivo de um telefone ser considerado suspeito.
 * Útil para relatórios e auditorias.
 */
export const getPhoneInconsistencyReason = (value?: string | null): string | null => {
    if (!value || !value.trim()) return null;
    const res = validateBrazilianPhone(value, { required: false });
    return res.isValid ? null : (res.diagnosticReason || TELEFONE_INVALIDO_MSG);
};

/**
 * Retorna true se o telefone do paciente for considerado irregular para operações bloqueantes
 * (como agendamentos, solicitações de exames/consultas ou retirada de medicamentos).
 * Bloqueia se o telefone estiver vazio/nulo, se tiver formato incorreto, DDD inexistente,
 * repetições fictícias ou violações das regras Anatel.
 */
export const isTelefoneIrregularParaOperacao = (value?: string | null): boolean => {
    if (!value || !value.trim()) return true;
    const res = validateBrazilianPhone(value, { required: true });
    return !res.isValid;
};

/**
 * Retorna o diagnóstico detalhado da irregularidade de um telefone para uma operação bloqueante.
 */
export const getMotivoIrregularidadeOperacao = (value?: string | null): string => {
    if (!value || !value.trim()) {
        return 'Nenhum telefone de contato informado no prontuário do paciente.';
    }
    const res = validateBrazilianPhone(value, { required: true });
    return res.isValid ? '' : (res.diagnosticReason || TELEFONE_INVALIDO_MSG);
};

/**
 * Validação rigorosa e exclusiva para o campo WhatsApp:
 * - Exige número celular brasileiro (11 dígitos, nono dígito '9')
 * - DDD válido
 * - Bloqueia sequências fictícias, repetitivas e padrões artificiais
 */
export const validateWhatsApp = (
    value?: string | null,
    options?: { required?: boolean }
): PhoneValidationResult => {
    const required = options?.required ?? true;
    const digits = normalizePhone(value);

    if (!digits) {
        if (required) {
            return {
                isValid: false,
                isEmpty: true,
                errorCode: 'EMPTY',
                errorMessage: 'O WhatsApp é obrigatório.',
                diagnosticReason: 'Campo obrigatório não informado'
            };
        }
        return { isValid: true, isEmpty: true };
    }

    if (digits.length !== 11) {
        return {
            isValid: false,
            isEmpty: false,
            digits,
            errorCode: 'INVALID_LENGTH',
            errorMessage: 'WhatsApp inválido. Deve conter DDD + 9 dígitos (ex: (31) 9 8379-0670).',
            diagnosticReason: `Quantidade incorreta de dígitos (${digits.length} dígitos; esperado 11 para WhatsApp celular)`
        };
    }

    const res = validateBrazilianPhone(digits, { required, allowLandline: false });
    if (!res.isValid) {
        return {
            ...res,
            errorMessage: res.errorCode === 'EMPTY' ? 'O WhatsApp é obrigatório.' : res.errorMessage
        };
    }

    return {
        ...res,
        formatted: formatWhatsApp(digits)
    };
};

/**
 * Validação para o campo Telefone Fixo:
 * - Opcional por padrão (se vazio, é válido)
 * - Se preenchido, exige 10 dígitos (DDD + 8 dígitos)
 * - Início do número local entre 2 e 5 (regras Anatel)
 * - DDD válido e sem repetições artificiais/fictícias
 */
export const validateLandlinePhone = (
    value?: string | null,
    options?: { required?: boolean }
): PhoneValidationResult => {
    const required = options?.required ?? false;
    const digits = normalizePhone(value);

    if (!digits) {
        if (required) {
            return {
                isValid: false,
                isEmpty: true,
                errorCode: 'EMPTY',
                errorMessage: 'O Telefone Fixo é obrigatório.',
                diagnosticReason: 'Campo obrigatório não informado'
            };
        }
        return { isValid: true, isEmpty: true };
    }

    if (digits.length !== 10) {
        return {
            isValid: false,
            isEmpty: false,
            digits,
            errorCode: 'INVALID_LENGTH',
            errorMessage: 'Telefone Fixo inválido. Deve conter DDD + 8 dígitos (ex: (31) 3837-1234).',
            diagnosticReason: `Quantidade incorreta de dígitos (${digits.length} dígitos; esperado 10 para telefone fixo)`
        };
    }

    const res = validateBrazilianPhone(digits, { required, allowLandline: true });
    if (!res.isValid) {
        return res;
    }

    if (res.type !== 'landline') {
        return {
            isValid: false,
            isEmpty: false,
            digits,
            errorCode: 'INVALID_ANATEL_RULE',
            errorMessage: 'Número informado não é um telefone fixo válido.',
            diagnosticReason: 'O número informado não segue o padrão de telefonia fixa'
        };
    }

    return {
        ...res,
        formatted: formatLandlinePhone(digits)
    };
};
