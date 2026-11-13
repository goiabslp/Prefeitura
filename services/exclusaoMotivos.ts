/**
 * Configuração oficial dos motivos e justificativas automáticas de solicitação de exclusão
 * Rota: /Regulacao/Acompanhar
 */

export interface MotivoExclusaoOption {
    label: string;
    defaultJustificativa: string;
    isManualOnly?: boolean;
}

export const MOTIVOS_EXCLUSAO: MotivoExclusaoOption[] = [
    {
        label: 'Cadastro duplicado',
        defaultJustificativa: 'Solicitação de exclusão por duplicidade de cadastro do mesmo paciente e procedimento.'
    },
    {
        label: 'Paciente cadastrado incorretamente',
        defaultJustificativa: 'Solicitação de exclusão devido à seleção incorreta do paciente no momento do cadastro.'
    },
    {
        label: 'Procedimento selecionado incorretamente',
        defaultJustificativa: 'Solicitação de exclusão devido à seleção de procedimento diferente do solicitado pelo médico.'
    },
    {
        label: 'Erro de lançamento',
        defaultJustificativa: 'Solicitação de exclusão devido a erro operacional identificado durante o cadastramento.'
    },
    {
        label: 'Solicitação cadastrada indevidamente',
        defaultJustificativa: 'Solicitação de exclusão após identificação de registro realizado de forma indevida.'
    },
    {
        label: 'Documentação incorreta',
        defaultJustificativa: 'Solicitação de exclusão devido à identificação de documentação incompatível com o procedimento solicitado.'
    },
    {
        label: 'Solicitação de teste',
        defaultJustificativa: 'Solicitação de exclusão por se tratar de registro realizado exclusivamente para testes do sistema.'
    },
    {
        label: 'Correção administrativa',
        defaultJustificativa: 'Solicitação de exclusão para regularização de inconsistências administrativas identificadas no cadastro.'
    },
    {
        label: 'Outro',
        defaultJustificativa: '',
        isManualOnly: true
    }
];

/**
 * Normaliza o texto removendo espaços excedentes nas extremidades e espaços múltiplos internos.
 */
export const normalizeJustificativaExclusao = (text: string): string => {
    return (text || '').replace(/\s+/g, ' ').trim();
};

/**
 * Validação rigorosa para a opção "Outro" de exclusão:
 * - Mínimo de 100 caracteres normalizados.
 * - Rejeita repetições abusivas do mesmo caractere consecutivo (5 ou mais vezes).
 * - Rejeita padrões artificiais monótonos com poucos caracteres únicos.
 * - Rejeita textos monótonos ou repetições evidentes de palavras idênticas.
 */
export const validateJustificativaManualExclusao = (text: string): { isValid: boolean; error?: string; length: number } => {
    const normalized = normalizeJustificativaExclusao(text);
    const length = normalized.length;

    if (length < 100) {
        return {
            isValid: false,
            length,
            error: `Descreva detalhadamente o motivo da exclusão, utilizando no mínimo 100 caracteres. (Atual: ${length}/100)`
        };
    }

    // 1. Repetição do mesmo caractere consecutivo (5 ou mais vezes)
    if (/(.)\1{4,}/i.test(normalized)) {
        return {
            isValid: false,
            length,
            error: 'A justificativa contém repetição excessiva do mesmo caractere. Descreva com clareza a situação.'
        };
    }

    // 2. Poucos caracteres únicos (alfanuméricos)
    const uniqueChars = new Set(normalized.toLowerCase().replace(/[^a-z0-9]/gi, ''));
    if (uniqueChars.size < 8) {
        return {
            isValid: false,
            length,
            error: 'A justificativa apresenta padrões artificiais ou caracteres insuficientes para compor um relato legítimo.'
        };
    }

    // 3. Palavras com pelo menos 2 caracteres
    const words = normalized.split(' ').filter(w => w.trim().length >= 2);
    if (words.length < 5) {
        return {
            isValid: false,
            length,
            error: 'A justificativa deve conter palavras completas descrevendo claramente a situação.'
        };
    }

    // 4. Todas as palavras iguais
    const distinctWords = new Set(words.map(w => w.toLowerCase()));
    if (distinctWords.size <= 2) {
        return {
            isValid: false,
            length,
            error: 'A justificativa contém repetição de palavras idênticas. Descreva o motivo real da solicitação de exclusão.'
        };
    }

    return { isValid: true, length };
};

/**
 * Validação do formulário completo de solicitação de exclusão.
 */
export const validateExclusaoForm = (params: {
    motivo: string;
    justificativa: string;
}): { isValid: boolean; error?: string; normalizedLength: number } => {
    const { motivo, justificativa } = params;

    if (!motivo || !motivo.trim()) {
        return { isValid: false, error: 'Selecione obrigatoriamente o Motivo da Exclusão.', normalizedLength: 0 };
    }

    const normalized = normalizeJustificativaExclusao(justificativa);
    const normalizedLength = normalized.length;

    if (!normalized) {
        return { isValid: false, error: 'O campo Justificativa da Exclusão não pode ficar vazio.', normalizedLength: 0 };
    }

    if (motivo === 'Outro') {
        const manualCheck = validateJustificativaManualExclusao(justificativa);
        if (!manualCheck.isValid) {
            return { isValid: false, error: manualCheck.error, normalizedLength: manualCheck.length };
        }
    } else {
        if (normalizedLength < 10) {
            return { isValid: false, error: 'A justificativa informada é muito curta. Forneça uma descrição clara.', normalizedLength };
        }
    }

    return { isValid: true, normalizedLength };
};
