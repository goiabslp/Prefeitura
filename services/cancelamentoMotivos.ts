/**
 * Configuração oficial dos motivos e justificativas automáticas de cancelamento
 * Rota: /Regulacao/Acompanhar
 */

export interface MotivoCancelamentoOption {
    label: string;
    defaultJustificativa: string;
    isManualOnly?: boolean;
}

export const CONFIRMACAO_VERACIDADE_TEXT = 'Confirmo que as informações descritas na justificativa foram verificadas.';

export const MOTIVOS_CANCELAMENTO: MotivoCancelamentoOption[] = [
    {
        label: 'Desistência do paciente',
        defaultJustificativa: 'Em contato com o paciente, o mesmo informou que não deseja mais realizar o procedimento.'
    },
    {
        label: 'Procedimento já realizado',
        defaultJustificativa: 'Em contato com o paciente, o mesmo informou que já realizou o procedimento em outra unidade de saúde.'
    },
    {
        label: 'Problemas de saúde',
        defaultJustificativa: 'Em contato com o paciente, o mesmo informou que apresenta condições clínicas que impossibilitam a realização do procedimento.'
    },
    {
        label: 'Atendimento particular',
        defaultJustificativa: 'Em contato com o paciente, o mesmo informou que optou por realizar o procedimento na rede particular.'
    },
    {
        label: 'Mudança de município',
        defaultJustificativa: 'Em contato com o paciente, o mesmo informou que não reside mais no município.'
    },
    {
        label: 'Orientação médica',
        defaultJustificativa: 'Em contato com o paciente, o mesmo informou que, por orientação médica, o procedimento foi suspenso ou considerado desnecessário.'
    },
    {
        label: 'Falecimento do paciente',
        defaultJustificativa: 'Conforme informação recebida de familiar ou responsável, o paciente faleceu, impossibilitando a realização do procedimento.'
    },
    {
        label: 'Motivos pessoais ou familiares',
        defaultJustificativa: 'Em contato com o paciente, o mesmo informou que, por motivos pessoais ou familiares, não deseja prosseguir com o procedimento.'
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
export const normalizeJustificativa = (text: string): string => {
    return (text || '').replace(/\s+/g, ' ').trim();
};

/**
 * Validação rigorosa para a opção "Outro" (manual):
 * - Mínimo de 100 caracteres normalizados (sem espaços excedentes).
 * - Rejeita repetições abusivas do mesmo caractere consecutivo (ex: 'aaaaaaa', '.......').
 * - Rejeita padrões artificiais monótonos com poucos caracteres únicos.
 * - Rejeita textos compostos por palavras sem sentido ou repetições evidentes de uma só palavra.
 */
export const validateJustificativaManual = (text: string): { isValid: boolean; error?: string; length: number } => {
    const normalized = normalizeJustificativa(text);
    const length = normalized.length;

    if (length < 100) {
        return {
            isValid: false,
            length,
            error: `Descreva detalhadamente o motivo do cancelamento, utilizando no mínimo 100 caracteres. (Atual: ${length}/100)`
        };
    }

    // 1. Repetição do mesmo caractere consecutivo (5 ou mais vezes)
    if (/(.)\1{4,}/i.test(normalized)) {
        return {
            isValid: false,
            length,
            error: 'A justificativa contém repetição excessiva do mesmo caractere. Por favor, forneça um texto descritivo e compreensível.'
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

    // 4. Todas as palavras iguais (ex: "cancelar cancelar cancelar...")
    const distinctWords = new Set(words.map(w => w.toLowerCase()));
    if (distinctWords.size <= 2) {
        return {
            isValid: false,
            length,
            error: 'A justificativa contém repetição de palavras idênticas. Descreva o motivo real do cancelamento.'
        };
    }

    return { isValid: true, length };
};

/**
 * Valida o formulário completo de cancelamento antes da submissão.
 */
export const validateCancelamentoForm = (params: {
    motivo: string;
    justificativa: string;
    isConfirmedVeracidade: boolean;
}): { isValid: boolean; error?: string; normalizedLength: number } => {
    const { motivo, justificativa, isConfirmedVeracidade } = params;

    if (!motivo || !motivo.trim()) {
        return { isValid: false, error: 'Selecione obrigatoriamente o Motivo do Cancelamento.', normalizedLength: 0 };
    }

    const normalized = normalizeJustificativa(justificativa);
    const normalizedLength = normalized.length;

    if (!normalized) {
        return { isValid: false, error: 'O campo Justificativa do Cancelamento não pode ficar vazio.', normalizedLength: 0 };
    }

    if (motivo === 'Outro') {
        const manualCheck = validateJustificativaManual(justificativa);
        if (!manualCheck.isValid) {
            return { isValid: false, error: manualCheck.error, normalizedLength: manualCheck.length };
        }
    } else {
        if (normalizedLength < 10) {
            return { isValid: false, error: 'A justificativa informada é muito curta. Informe uma descrição clara.', normalizedLength };
        }
    }

    if (!isConfirmedVeracidade) {
        return {
            isValid: false,
            error: 'É obrigatório confirmar que as informações descritas na justificativa foram verificadas.',
            normalizedLength
        };
    }

    return { isValid: true, normalizedLength };
};
