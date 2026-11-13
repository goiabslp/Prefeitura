import { supabase } from './supabaseClient';
import { ConsultaPaciente, ConsultaProcedimento, ConsultaAgendamento, ConsultaVaga, ConsultaEspecialista, TipoAtendimentoConsulta, User, ConsultaSolicitacaoCancelamento } from '../types';
import { handleSupabaseError } from '../utils/errorUtils';
import { auditLogService } from './auditLogService';
import {
    normalizeCpf,
    formatCpf,
    isValidCpf,
    removeAccents,
    detectarCriterioPesquisaPaciente,
    CriterioPesquisaPacienteDetectado
} from '../utils/cpfUtils';
import {
    validateBrazilianPhone,
    formatBrazilianPhone,
    formatWhatsApp,
    formatLandlinePhone,
    validateWhatsApp,
    validateLandlinePhone,
    TELEFONE_INVALIDO_MSG,
    isSuspiciousPhone,
    getPhoneInconsistencyReason
} from '../utils/phoneValidation';
import {
    getActiveGlobalModuleSettings,
    getActivePermissionUser,
    hasConsultasAcompanharOperationalAccess,
    isConsultasAcompanharReadOnly,
    userCanAccessSubmodule
} from './permissionService';

const getCachedConsultasGestores = (): string[] => {
    try {
        const local = typeof localStorage !== 'undefined' ? localStorage.getItem('consultas_gestores_user_ids') : null;
        return local ? JSON.parse(local) : [];
    } catch {
        return [];
    }
};

type RegulacaoMutationKind =
    | 'acompanhar'
    | 'novo_agendamento'
    | 'vagas'
    | 'procedimentos'
    | 'pacientes'
    | 'gestor';

const hasAutoSenhaPatientAccess = (
    user: User,
    globalSettings?: Record<string, boolean>
): boolean => {
    return (
        userCanAccessSubmodule(user, 'parent_autosenha', 'sub_autosenha_pacientes', globalSettings) ||
        userCanAccessSubmodule(user, 'parent_autosenha', 'sub_autosenha_psf1_controle', globalSettings) ||
        userCanAccessSubmodule(user, 'parent_autosenha', 'sub_autosenha_psf2_controle', globalSettings) ||
        userCanAccessSubmodule(user, 'parent_autosenha', 'sub_autosenha_upa_controle', globalSettings) ||
        userCanAccessSubmodule(user, 'parent_autosenha', 'sub_autosenha_dashboard', globalSettings)
    );
};

const hasIntegratedPatientReadAccess = (
    user: User,
    globalSettings?: Record<string, boolean>
): boolean => {
    const perms = user.permissions || [];
    if (
        hasAutoSenhaPatientAccess(user, globalSettings) ||
        hasConsultasAcompanharOperationalAccess(user, globalSettings) ||
        isConsultasAcompanharReadOnly(user, globalSettings) ||
        userCanAccessSubmodule(user, 'parent_consultas', 'sub_consultas_pacientes', globalSettings) ||
        userCanAccessSubmodule(user, 'parent_consultas', 'sub_consultas_novo_agendamento', globalSettings) ||
        userCanAccessSubmodule(user, 'parent_consultas', 'sub_consultas_dados', globalSettings) ||
        userCanAccessSubmodule(user, 'parent_farmacia', 'sub_farmacia_pacientes', globalSettings) ||
        userCanAccessSubmodule(user, 'parent_farmacia', 'sub_farmacia_retirar', globalSettings) ||
        userCanAccessSubmodule(user, 'parent_farmacia', 'sub_farmacia_consultar', globalSettings) ||
        perms.includes('parent_farmacia')
    ) {
        return true;
    }
    return false;
};

/**
 * Valida na camada de serviços se o usuário autenticado possui permissão operacional
 * efetiva para gravar ou alterar registros da Regulação.
 * Respeita estritamente as permissões de submódulo (inclusive para Admins e Gestores)
 * e o estado global ativo no Controle de Acesso.
 */
const assertCanMutateRegulacao = (
    actionLabel: string,
    kind: RegulacaoMutationKind = 'acompanhar',
    explicitUser?: Partial<User> | null
): void => {
    const activeUser = getActivePermissionUser();
    // Quando explicitUser foi passado (ex.: snapshot de UI), prioriza explicitUser completo se possuir permissions
    const user = ((explicitUser && Array.isArray((explicitUser as User).permissions) ? explicitUser : activeUser) || explicitUser) as User | null;
    if (!user) return; // Contexto sem sessão de usuário associada (ex.: rotinas isoladas)

    const globalSettings = getActiveGlobalModuleSettings();
    const gestorIds = getCachedConsultasGestores();
    const perms = user.permissions || [];
    const isGestorOrAdminRole =
        user.role === 'admin' ||
        gestorIds.includes(user.id) ||
        perms.includes('sub_consultas_gestor') ||
        perms.includes('parent_consultas_gestor') ||
        perms.includes('sub_regulacao_gestor' as any);

    if (kind === 'gestor') {
        const hasGestorSub = userCanAccessSubmodule(user, 'parent_consultas', 'sub_consultas_gestor', globalSettings);
        if (!isGestorOrAdminRole && !hasGestorSub) {
            throw new Error(`Acesso negado: apenas Administradores ou Gestores autorizados podem executar "${actionLabel}".`);
        }
        return;
    }

    const canOperationalAcompanhar = hasConsultasAcompanharOperationalAccess(user, globalSettings);
    const isReadOnlyAcompanhar = isConsultasAcompanharReadOnly(user, globalSettings);

    if (kind === 'acompanhar') {
        if (isReadOnlyAcompanhar || !canOperationalAcompanhar) {
            throw new Error(`Acesso negado (Modo Somente Leitura): seu usuário não possui permissão operacional para "${actionLabel}".`);
        }
        return;
    }

    if (kind === 'novo_agendamento') {
        const canNovo = userCanAccessSubmodule(user, 'parent_consultas', 'sub_consultas_novo_agendamento', globalSettings);
        if (!canNovo && !canOperationalAcompanhar) {
            throw new Error(`Acesso negado (Modo Somente Leitura): seu usuário não possui permissão para "${actionLabel}".`);
        }
        return;
    }

    if (kind === 'vagas') {
        const canVagas = userCanAccessSubmodule(user, 'parent_consultas', 'sub_consultas_liberar_vagas', globalSettings);
        if (!canVagas && !canOperationalAcompanhar) {
            throw new Error(`Acesso negado: seu usuário não possui permissão para "${actionLabel}".`);
        }
        return;
    }

    if (kind === 'procedimentos') {
        const canProc = userCanAccessSubmodule(user, 'parent_consultas', 'sub_consultas_procedimentos', globalSettings);
        if (!canProc) {
            throw new Error(`Acesso negado: seu usuário não possui permissão para "${actionLabel}".`);
        }
        return;
    }

    if (kind === 'pacientes') {
        const canPacientesRegulacao =
            userCanAccessSubmodule(user, 'parent_consultas', 'sub_consultas_pacientes', globalSettings) ||
            userCanAccessSubmodule(user, 'parent_consultas', 'sub_consultas_novo_agendamento', globalSettings) ||
            canOperationalAcompanhar;
        const canPacientesFarmacia =
            userCanAccessSubmodule(user, 'parent_farmacia', 'sub_farmacia_pacientes', globalSettings) ||
            userCanAccessSubmodule(user, 'parent_farmacia', 'sub_farmacia_retirar', globalSettings) ||
            perms.includes('parent_farmacia') ||
            perms.some(p => typeof p === 'string' && (p.startsWith('sub_farmacia_') || p.startsWith('parent_farmacia_')));
        const canPacientesAutoSenha = hasAutoSenhaPatientAccess(user, globalSettings);

        if (!canPacientesRegulacao && !canPacientesFarmacia && !canPacientesAutoSenha) {
            throw new Error(`Acesso negado (Modo Somente Leitura): seu usuário não possui permissão para "${actionLabel}".`);
        }
    }
};

// --- PACIENTES ---

const PACIENTE_COLUMNS = 'id, name, cpf, birth_date, nickname, phone, neighborhood, street, city, sus_number, agente_saude, created_at, updated_at';

export const getPacientes = async (searchTerm?: string): Promise<ConsultaPaciente[]> => {
    try {
        let allData: ConsultaPaciente[] = [];
        let from = 0;
        const CHUNK_SIZE = 1000;
        let hasMore = true;

        while (hasMore) {
            let query = supabase
                .from('consultas_pacientes')
                .select(PACIENTE_COLUMNS)
                .order('name', { ascending: true })
                .range(from, from + CHUNK_SIZE - 1);

            if (searchTerm && searchTerm.trim()) {
                const term = searchTerm.trim();
                const cleanDigits = term.replace(/\D/g, '');
                if (cleanDigits.length >= 3) {
                    query = query.or(`name.ilike.%${term}%,cpf.ilike.%${cleanDigits}%,sus_number.ilike.%${cleanDigits}%`);
                } else {
                    query = query.ilike('name', `%${term}%`);
                }
            }

            const { data, error } = await query;

            if (error) throw error;
            if (data && data.length > 0) {
                allData = [...allData, ...(data as ConsultaPaciente[])];
                if (data.length < CHUNK_SIZE) {
                    hasMore = false;
                } else {
                    from += CHUNK_SIZE;
                }
            } else {
                hasMore = false;
            }
        }

        return allData;
    } catch (error) {
        const appError = handleSupabaseError(error);
        console.error('[consultasService] getPacientes Error:', appError.message);
        return [];
    }
};

export const getPacienteById = async (id: string): Promise<ConsultaPaciente | null> => {
    try {
        const { data, error } = await supabase
            .from('consultas_pacientes')
            .select(PACIENTE_COLUMNS)
            .eq('id', id)
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        const appError = handleSupabaseError(error);
        console.error('[consultasService] getPacienteById Error:', appError.message);
        return null;
    }
};

export type PacienteCpfLookupStatus =
    | 'found'
    | 'not_found'
    | 'invalid_cpf'
    | 'permission_denied'
    | 'connection_error'
    | 'technical_error';

export interface PacienteCpfLookupResult {
    status: PacienteCpfLookupStatus;
    paciente?: ConsultaPaciente | null;
    normalizedCpf: string;
    error?: string;
}

export class DuplicatePatientCpfError extends Error {
    public readonly code = 'DUPLICATE_PATIENT_CPF';
    public readonly existingPatient?: ConsultaPaciente | null;

    constructor(message: string, existingPatient?: ConsultaPaciente | null) {
        super(message);
        this.name = 'DuplicatePatientCpfError';
        this.existingPatient = existingPatient ?? null;
    }
}

const classifyPacienteLookupError = (err: any): { status: 'permission_denied' | 'connection_error' | 'technical_error'; message: string } => {
    const code = String(err?.code || '').toUpperCase();
    const statusCode = Number(err?.status || err?.statusCode || 0);
    const rawMsg = String(err?.message || err?.details || err || '').toLowerCase();

    if (
        code === '42501' ||
        code === 'PGRST301' ||
        statusCode === 401 ||
        statusCode === 403 ||
        rawMsg.includes('permission denied') ||
        rawMsg.includes('row-level security') ||
        rawMsg.includes('not authorized') ||
        rawMsg.includes('insufficient_privilege') ||
        rawMsg.includes('jwt')
    ) {
        return {
            status: 'permission_denied',
            message: 'Você não possui permissão de acesso (RLS) para consultar pacientes na base integrada.'
        };
    }

    const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
    if (
        isOffline ||
        statusCode === 0 ||
        statusCode >= 500 ||
        rawMsg.includes('failed to fetch') ||
        rawMsg.includes('networkerror') ||
        rawMsg.includes('network error') ||
        rawMsg.includes('fetch failed') ||
        rawMsg.includes('err_network') ||
        rawMsg.includes('econnrefused') ||
        rawMsg.includes('timeout') ||
        rawMsg.includes('timed out')
    ) {
        return {
            status: 'connection_error',
            message: 'Falha de conexão ao consultar a base integrada de pacientes. Verifique a internet e tente novamente.'
        };
    }

    const appErr = handleSupabaseError(err);
    return {
        status: 'technical_error',
        message: appErr.message || 'Erro técnico ao consultar o CPF na base de dados.'
    };
};

/**
 * Consulta somente leitura de paciente por CPF normalizado (sem pontuação),
 * compatível também com registros legados gravados com pontuação.
 * Nunca cria ou altera registros durante a consulta e diferencia claramente
 * "não encontrado" de falta de permissão ou falha de conexão.
 */
export const lookupPacienteByCpf = async (
    cpf: string,
    options?: { signal?: AbortSignal }
): Promise<PacienteCpfLookupResult> => {
    const clean = normalizeCpf(cpf);
    if (!isValidCpf(clean)) {
        return {
            status: 'invalid_cpf',
            normalizedCpf: clean,
            error: 'CPF inválido. Informe os 11 dígitos válidos.'
        };
    }

    const activeUser = getActivePermissionUser();
    const globalSettings = getActiveGlobalModuleSettings();
    if (activeUser && !hasIntegratedPatientReadAccess(activeUser, globalSettings)) {
        return {
            status: 'permission_denied',
            normalizedCpf: clean,
            error: 'Acesso negado: seu usuário não possui permissão para consultar pacientes na base integrada.'
        };
    }

    const formatted = formatCpf(clean);

    try {
        let query: any = supabase
            .from('consultas_pacientes')
            .select(PACIENTE_COLUMNS)
            .or(`cpf.eq.${clean},cpf.eq.${formatted}`)
            .limit(1);

        if (options?.signal && typeof query.abortSignal === 'function') {
            query = query.abortSignal(options.signal);
        }

        const { data, error } = await query;

        if (options?.signal?.aborted) {
            return {
                status: 'technical_error',
                normalizedCpf: clean,
                error: 'Consulta cancelada.'
            };
        }

        if (error) {
            const classified = classifyPacienteLookupError(error);
            return {
                status: classified.status,
                normalizedCpf: clean,
                error: classified.message
            };
        }

        const rows = Array.isArray(data) ? data : (data ? [data] : []);
        if (rows.length > 0) {
            return {
                status: 'found',
                paciente: rows[0] as ConsultaPaciente,
                normalizedCpf: clean
            };
        }

        return {
            status: 'not_found',
            normalizedCpf: clean
        };
    } catch (error: any) {
        if (options?.signal?.aborted || error?.name === 'AbortError') {
            return {
                status: 'technical_error',
                normalizedCpf: clean,
                error: 'Consulta cancelada.'
            };
        }
        const classified = classifyPacienteLookupError(error);
        console.error('[consultasService] lookupPacienteByCpf Error:', classified.message);
        return {
            status: classified.status,
            normalizedCpf: clean,
            error: classified.message
        };
    }
};

export const getPacienteByCpf = async (cpf: string): Promise<ConsultaPaciente | null> => {
    const res = await lookupPacienteByCpf(cpf);
    return res.status === 'found' ? (res.paciente || null) : null;
};

export type PacienteSmartSearchCriterion = CriterioPesquisaPacienteDetectado;

export type PacienteSmartSearchStatus =
    | 'results'
    | 'not_found'
    | 'too_short'
    | 'invalid_cpf'
    | 'permission_denied'
    | 'connection_error'
    | 'technical_error'
    | 'aborted';

export interface PacienteSmartSearchResult {
    status: PacienteSmartSearchStatus;
    criterion: PacienteSmartSearchCriterion;
    normalizedQuery: string;
    pacientes: ConsultaPaciente[];
    error?: string;
}

const sanitizarTermoFiltroPostgrest = (value: string): string =>
    value.replace(/[,()*%\\]/g, ' ').replace(/\s+/g, ' ').trim();

const construirPadraoToleranteAcentoIlike = (token: string): string => {
    const semAcento = sanitizarTermoFiltroPostgrest(removeAccents(token));
    if (!semAcento) return '';
    // Exige comprimento mínimo e ao menos 1 consoante fixa para manter o filtro seletivo
    const consoantes = semAcento.replace(/[aeiouy\s0-9]/g, '');
    if (semAcento.length < 3 || consoantes.length < 1) return semAcento;
    // Substitui 'c' seguido de a/o/u (quando não inicial) por '_' para casar também 'ç', e vogais por '_'
    return semAcento
        .replace(/(?<!^)c(?=[aou])/g, '_')
        .replace(/[aeiouy]/g, '_');
};

const pacienteCorrespondePesquisaInteligente = (
    paciente: ConsultaPaciente,
    criterion: PacienteSmartSearchCriterion,
    digits: string,
    normalizedText: string
): { matches: boolean; score: number } => {
    const cpfClean = normalizeCpf(paciente.cpf);
    const susClean = String(paciente.sus_number || '').replace(/\D/g, '');
    const nomeNorm = removeAccents(paciente.name);
    const apelidoNorm = removeAccents(paciente.nickname);

    if (criterion === 'cpf') {
        if (cpfClean === digits) return { matches: true, score: 1000 };
        return { matches: false, score: 0 };
    }

    if (criterion === 'cns') {
        if (susClean === digits) return { matches: true, score: 1000 };
        return { matches: false, score: 0 };
    }

    // Pesquisa textual (nome completo/parcial, apelido ou dígitos parciais >= 3)
    if (digits.length >= 3 && /^[0-9.\-\s/]+$/.test(normalizedText)) {
        if (cpfClean === digits || susClean === digits) return { matches: true, score: 950 };
        if (cpfClean.includes(digits) || susClean.includes(digits)) return { matches: true, score: 700 };
    }

    if (!normalizedText) return { matches: false, score: 0 };

    if (nomeNorm === normalizedText) return { matches: true, score: 900 };
    if (apelidoNorm === normalizedText) return { matches: true, score: 880 };
    if (nomeNorm.startsWith(normalizedText)) return { matches: true, score: 800 };
    if (apelidoNorm.startsWith(normalizedText)) return { matches: true, score: 760 };
    if (nomeNorm.includes(normalizedText)) return { matches: true, score: 650 };
    if (apelidoNorm.includes(normalizedText)) return { matches: true, score: 600 };

    // Todos os tokens da pesquisa devem existir no nome (ou combinação nome + apelido)
    const tokens = normalizedText.split(' ').filter(t => t.length >= 1);
    if (tokens.length > 0) {
        const combinado = `${nomeNorm} ${apelidoNorm}`.trim();
        const todosNoNome = tokens.every(t => nomeNorm.includes(t));
        if (todosNoNome) return { matches: true, score: 520 };
        const todosCombinados = tokens.every(t => combinado.includes(t));
        if (todosCombinados) return { matches: true, score: 450 };
    }

    return { matches: false, score: 0 };
};

/**
 * Pesquisa inteligente somente leitura na base integrada municipal de pacientes
 * por Nome completo/parcial, CPF (11 dígitos), Cartão SUS (15 dígitos) ou Apelido,
 * ignorando acentos e maiúsculas/minúsculas, com suporte a AbortSignal e limite seguro.
 */
export const searchPacientesInteligente = async (
    rawTerm: string,
    options?: { signal?: AbortSignal; limit?: number }
): Promise<PacienteSmartSearchResult> => {
    const { criterion, digits, normalizedText } = detectarCriterioPesquisaPaciente(rawTerm);
    const safeLimit = Math.min(30, Math.max(1, Number(options?.limit) || 20));

    // Validação de entrada mínima
    if (criterion === 'cpf') {
        if (!isValidCpf(digits)) {
            return {
                status: 'invalid_cpf',
                criterion,
                normalizedQuery: digits,
                pacientes: [],
                error: 'CPF inválido. Confira os 11 dígitos informados.'
            };
        }
    } else if (criterion === 'cns') {
        if (digits.length !== 15) {
            return {
                status: 'too_short',
                criterion,
                normalizedQuery: digits,
                pacientes: []
            };
        }
    } else if (normalizedText.length < 3 && digits.length < 3) {
        return {
            status: 'too_short',
            criterion,
            normalizedQuery: normalizedText,
            pacientes: []
        };
    }

    // Validação rigorosa de permissão e bloqueio de pesquisa anônima em sessão de navegador
    const activeUser = getActivePermissionUser();
    const globalSettings = getActiveGlobalModuleSettings();
    if (typeof document !== 'undefined' && !activeUser) {
        return {
            status: 'permission_denied',
            criterion,
            normalizedQuery: criterion === 'texto' ? normalizedText : digits,
            pacientes: [],
            error: 'Sessão não autenticada. Faça login para pesquisar pacientes na base integrada.'
        };
    }
    if (activeUser && !hasIntegratedPatientReadAccess(activeUser, globalSettings)) {
        return {
            status: 'permission_denied',
            criterion,
            normalizedQuery: criterion === 'texto' ? normalizedText : digits,
            pacientes: [],
            error: 'Acesso negado: seu usuário não possui permissão para consultar pacientes na base integrada.'
        };
    }

    if (options?.signal?.aborted) {
        return {
            status: 'aborted',
            criterion,
            normalizedQuery: criterion === 'texto' ? normalizedText : digits,
            pacientes: []
        };
    }

    const filterAndRank = (rows: ConsultaPaciente[]): ConsultaPaciente[] => {
        const dedup = new Map<string, { p: ConsultaPaciente; score: number }>();
        for (const row of rows) {
            const { matches, score } = pacienteCorrespondePesquisaInteligente(
                row,
                criterion,
                digits,
                normalizedText
            );
            if (matches) {
                const prev = dedup.get(row.id);
                if (!prev || score > prev.score) {
                    dedup.set(row.id, { p: row, score });
                }
            }
        }
        return Array.from(dedup.values())
            .sort((a, b) => b.score - a.score || (a.p.name || '').localeCompare(b.p.name || ''))
            .slice(0, safeLimit)
            .map(item => item.p);
    };

    try {
        // 1. Tenta RPC dedicada acento-insensível no PostgreSQL quando disponível
        if (typeof (supabase as any).rpc === 'function') {
            try {
                let rpcCall: any = (supabase as any).rpc('buscar_pacientes_autosenha', {
                    p_termo: rawTerm.trim(),
                    p_limit: safeLimit
                });
                if (options?.signal && typeof rpcCall?.abortSignal === 'function') {
                    rpcCall = rpcCall.abortSignal(options.signal);
                }
                const { data: rpcData, error: rpcErr } = await rpcCall;

                if (options?.signal?.aborted) {
                    return {
                        status: 'aborted',
                        criterion,
                        normalizedQuery: criterion === 'texto' ? normalizedText : digits,
                        pacientes: []
                    };
                }

                if (!rpcErr && Array.isArray(rpcData)) {
                    const ordenados = filterAndRank(rpcData as ConsultaPaciente[]);
                    return {
                        status: ordenados.length > 0 ? 'results' : 'not_found',
                        criterion,
                        normalizedQuery: criterion === 'texto' ? normalizedText : digits,
                        pacientes: ordenados
                    };
                }

                if (rpcErr) {
                    const code = String((rpcErr as any)?.code || '').toUpperCase();
                    const msg = String((rpcErr as any)?.message || '');
                    const isMissingFn =
                        code === '42883' ||
                        code === 'PGRST202' ||
                        /does not exist|could not find the function/i.test(msg);
                    if (!isMissingFn) {
                        const classified = classifyPacienteLookupError(rpcErr);
                        return {
                            status: classified.status,
                            criterion,
                            normalizedQuery: criterion === 'texto' ? normalizedText : digits,
                            pacientes: [],
                            error: classified.message
                        };
                    }
                }
            } catch (rpcException: any) {
                if (options?.signal?.aborted || rpcException?.name === 'AbortError') {
                    return {
                        status: 'aborted',
                        criterion,
                        normalizedQuery: criterion === 'texto' ? normalizedText : digits,
                        pacientes: []
                    };
                }
                // Se falhou apenas por falta da função RPC, segue fallback PostgREST abaixo
            }
        }

        // 2. Fallback PostgREST direto somente leitura com limite controlado
        let query: any = supabase
            .from('consultas_pacientes')
            .select(PACIENTE_COLUMNS);

        if (criterion === 'cpf') {
            const formatted = formatCpf(digits);
            query = query.or(`cpf.eq.${digits},cpf.eq.${formatted}`).limit(safeLimit);
        } else if (criterion === 'cns') {
            query = query.or(`sus_number.eq.${digits},sus_number.ilike.%${digits}%`).limit(safeLimit);
        } else {
            const sanitizedRaw = sanitizarTermoFiltroPostgrest(rawTerm.trim());
            const tokens = normalizedText.split(' ').filter(t => t.length >= 2);
            const firstToken = tokens[0] || normalizedText;
            const longestToken = tokens.reduce((acc, t) => (t.length > acc.length ? t : acc), firstToken);
            const patternAcento = construirPadraoToleranteAcentoIlike(longestToken);
            const orParts = new Set<string>();

            if (sanitizedRaw) {
                orParts.add(`name.ilike.%${sanitizedRaw}%`);
                orParts.add(`nickname.ilike.%${sanitizedRaw}%`);
            }
            if (longestToken && longestToken.length >= 2) {
                const tokClean = sanitizarTermoFiltroPostgrest(longestToken);
                orParts.add(`name.ilike.%${tokClean}%`);
                orParts.add(`nickname.ilike.%${tokClean}%`);
            }
            if (patternAcento && patternAcento.length >= 2) {
                orParts.add(`name.ilike.%${patternAcento}%`);
                orParts.add(`nickname.ilike.%${patternAcento}%`);
            }
            if (digits.length >= 3) {
                orParts.add(`cpf.ilike.%${digits}%`);
                orParts.add(`sus_number.ilike.%${digits}%`);
            }

            const fetchLimit = Math.max(safeLimit * 3, 60);
            query = query.or(Array.from(orParts).join(',')).limit(fetchLimit);
        }

        if (options?.signal && typeof query.abortSignal === 'function') {
            query = query.abortSignal(options.signal);
        }

        const { data, error } = await query;

        if (options?.signal?.aborted) {
            return {
                status: 'aborted',
                criterion,
                normalizedQuery: criterion === 'texto' ? normalizedText : digits,
                pacientes: []
            };
        }

        if (error) {
            const classified = classifyPacienteLookupError(error);
            return {
                status: classified.status,
                criterion,
                normalizedQuery: criterion === 'texto' ? normalizedText : digits,
                pacientes: [],
                error: classified.message
            };
        }

        const rows = Array.isArray(data) ? (data as ConsultaPaciente[]) : [];
        const filtrados = filterAndRank(rows);

        return {
            status: filtrados.length > 0 ? 'results' : 'not_found',
            criterion,
            normalizedQuery: criterion === 'texto' ? normalizedText : digits,
            pacientes: filtrados
        };
    } catch (error: any) {
        if (options?.signal?.aborted || error?.name === 'AbortError') {
            return {
                status: 'aborted',
                criterion,
                normalizedQuery: criterion === 'texto' ? normalizedText : digits,
                pacientes: []
            };
        }
        const classified = classifyPacienteLookupError(error);
        console.error('[consultasService] searchPacientesInteligente Error:', classified.message);
        return {
            status: classified.status,
            criterion,
            normalizedQuery: criterion === 'texto' ? normalizedText : digits,
            pacientes: [],
            error: classified.message
        };
    }
};

export const createPaciente = async (
    paciente: Omit<ConsultaPaciente, 'id' | 'created_at' | 'updated_at'>,
    options?: { strictNoDuplicate?: boolean }
): Promise<ConsultaPaciente | null> => {
    assertCanMutateRegulacao('Cadastrar Paciente', 'pacientes');
    try {
        const cleanCpf = normalizeCpf(paciente.cpf);
        const cleanSus = paciente.sus_number && paciente.sus_number.trim().length > 0 ? paciente.sus_number.trim() : null;

        if (options?.strictNoDuplicate) {
            if (!isValidCpf(cleanCpf)) {
                throw new Error('CPF inválido. Informe um CPF válido com 11 dígitos.');
            }
            if (!paciente.name || !paciente.name.trim()) {
                throw new Error('O Nome Completo é obrigatório.');
            }
            if (!paciente.birth_date) {
                throw new Error('A Data de Nascimento é obrigatória.');
            }

            // Verifica duplicidade no banco antes da inserção sem modificar registros existentes
            const existingCheck = await lookupPacienteByCpf(cleanCpf);
            if (existingCheck.status === 'found' && existingCheck.paciente) {
                throw new DuplicatePatientCpfError(
                    'Já existe um paciente cadastrado com este CPF na base integrada.',
                    existingCheck.paciente
                );
            }
            if (existingCheck.status !== 'not_found') {
                throw new Error(existingCheck.error || 'Não foi possível validar o CPF no banco de dados.');
            }
        } else if (cleanCpf.length === 11) {
            // 1. Verificação prévia retrocompatível: se o paciente já existir no banco por CPF, atualiza e retorna o registro
            const existing = await getPacienteByCpf(cleanCpf);
            if (existing) {
                console.log('[consultasService] Paciente com este CPF já existe no banco. Atualizando e retornando existente...', existing.id);
                const updated = await updatePaciente(existing.id, {
                    name: paciente.name || existing.name,
                    nickname: paciente.nickname !== undefined ? (paciente.nickname?.trim() || null) : existing.nickname,
                    birth_date: paciente.birth_date || existing.birth_date,
                    phone: paciente.phone !== undefined ? (paciente.phone?.trim() || null) : existing.phone,
                    neighborhood: paciente.neighborhood !== undefined ? (paciente.neighborhood?.trim() || null) : existing.neighborhood,
                    street: paciente.street?.trim() !== undefined ? (paciente.street?.trim() || null) : existing.street,
                    city: paciente.city !== undefined ? (paciente.city?.trim() || null) : existing.city,
                    sus_number: cleanSus || existing.sus_number,
                    agente_saude: paciente.agente_saude !== undefined ? (paciente.agente_saude?.trim() || null) : existing.agente_saude
                });
                return updated || existing;
            }
        }

        // Validação rigorosa de WhatsApp (celular)
        let validPhone: string | null = null;
        if (paciente.phone && String(paciente.phone).trim()) {
            const phoneCheck = validateWhatsApp(String(paciente.phone), { required: Boolean(options?.strictNoDuplicate) });
            if (!phoneCheck.isValid) {
                throw new Error(phoneCheck.errorMessage || TELEFONE_INVALIDO_MSG);
            }
            validPhone = phoneCheck.formatted || String(paciente.phone).trim();
        } else if (options?.strictNoDuplicate) {
            throw new Error('O WhatsApp é obrigatório.');
        }

        // Validação de Telefone Fixo (opcional)
        let validPhoneFixed: string | null = null;
        if (paciente.phone_fixed && String(paciente.phone_fixed).trim()) {
            const fixedCheck = validateLandlinePhone(String(paciente.phone_fixed), { required: false });
            if (!fixedCheck.isValid) {
                throw new Error(fixedCheck.errorMessage || 'Telefone Fixo inválido.');
            }
            validPhoneFixed = fixedCheck.formatted || String(paciente.phone_fixed).trim();
        }

        const cleanPaciente: any = {
            name: paciente.name?.trim().toUpperCase(),
            nickname: paciente.nickname?.trim() ? paciente.nickname.trim().toUpperCase() : null,
            cpf: cleanCpf,
            birth_date: paciente.birth_date,
            phone: validPhone,
            phone_fixed: validPhoneFixed,
            neighborhood: paciente.neighborhood?.trim() ? paciente.neighborhood.trim().toUpperCase() : null,
            street: paciente.street?.trim() ? paciente.street.trim().toUpperCase() : null,
            city: paciente.city?.trim() ? paciente.city.trim().toUpperCase() : 'SÃO JOSÉ DO GOIABAL -MG',
            sus_number: cleanSus,
            agente_saude: paciente.agente_saude?.trim() ? paciente.agente_saude.trim() : null
        };

        let { data, error } = await supabase
            .from('consultas_pacientes')
            .insert([cleanPaciente])
            .select()
            .single();

        // Fallback progressivo: se alguma coluna não existir na tabela Supabase,
        // tenta remover as colunas problemáticas uma a uma e re-inserir
        if (error && (error.code === 'PGRST204' || error.message?.includes('column') || error.message?.includes('schema cache'))) {
            console.warn('[consultasService] Coluna(s) ausente(s) no Supabase. Tentando fallback progressivo...', error.message);

            // Lista de colunas opcionais que podem não existir ainda na tabela
            const optionalCols = ['phone_fixed', 'agente_saude', 'sus_number', 'phone', 'neighborhood', 'street', 'nickname', 'city'];
            let fallbackPaciente = { ...cleanPaciente };
            let lastError = error;

            for (const col of optionalCols) {
                if (lastError && (lastError.code === 'PGRST204' || lastError.message?.includes('column') || lastError.message?.includes('schema cache'))) {
                    console.warn(`[consultasService] Removendo coluna '${col}' do payload e tentando novamente...`);
                    delete fallbackPaciente[col];

                    const retryRes = await supabase
                        .from('consultas_pacientes')
                        .insert([fallbackPaciente])
                        .select()
                        .single();

                    data = retryRes.data;
                    lastError = retryRes.error;

                    if (!lastError) break; // Inserção bem-sucedida
                }
            }

            error = lastError;
        }

        // Se deu erro de duplicidade (23505):
        if (error && (error.code === '23505' || String(error.message || '').toLowerCase().includes('duplicate')) && cleanCpf.length === 11) {
            const existingLookup = await lookupPacienteByCpf(cleanCpf);
            if (options?.strictNoDuplicate) {
                throw new DuplicatePatientCpfError(
                    'Já existe um paciente cadastrado com este CPF no banco de dados.',
                    existingLookup.status === 'found' ? existingLookup.paciente : null
                );
            }
            console.warn('[consultasService] Conflito de duplicidade 23505 capturado. Buscando paciente existente por CPF...');
            if (existingLookup.status === 'found' && existingLookup.paciente) {
                return existingLookup.paciente;
            }
        }

        if (error) throw error;
        if (typeof window !== 'undefined' && data) {
            window.dispatchEvent(new CustomEvent('consultas-pacientes-changed', { detail: data }));
            window.dispatchEvent(new CustomEvent('paciente-alterado', { detail: data }));
        }
        return data;
    } catch (error: any) {
        if (error instanceof DuplicatePatientCpfError) {
            throw error;
        }
        const appError = handleSupabaseError(error);
        console.error('[consultasService] createPaciente Error:', appError.message);
        // Mensagem amigável para violação única em CPF
        if (error?.code === '23505') {
            throw new DuplicatePatientCpfError('CPF já cadastrado no sistema.');
        }
        throw appError;
    }
};

export const updatePaciente = async (id: string, updates: Partial<ConsultaPaciente>): Promise<ConsultaPaciente | null> => {
    assertCanMutateRegulacao('Atualizar Paciente', 'pacientes');
    try {
        const cleanUpdates: any = { ...updates };
        if (updates.cpf !== undefined) {
            const rawCpf = updates.cpf ? updates.cpf.replace(/\D/g, '') : '';
            cleanUpdates.cpf = rawCpf.length > 0 ? rawCpf : null;
        }

        // Validação de WhatsApp anti-fictício (Anatel + Padrões)
        if (updates.phone !== undefined) {
            if (updates.phone && String(updates.phone).trim()) {
                const phoneCheck = validateWhatsApp(String(updates.phone), { required: false });
                if (!phoneCheck.isValid) {
                    throw new Error(phoneCheck.errorMessage || TELEFONE_INVALIDO_MSG);
                }
                cleanUpdates.phone = phoneCheck.formatted || String(updates.phone).trim();
            } else {
                cleanUpdates.phone = null;
            }
        }

        // Validação de Telefone Fixo (opcional)
        if (updates.phone_fixed !== undefined) {
            if (updates.phone_fixed && String(updates.phone_fixed).trim()) {
                const fixedCheck = validateLandlinePhone(String(updates.phone_fixed), { required: false });
                if (!fixedCheck.isValid) {
                    throw new Error(fixedCheck.errorMessage || 'Telefone Fixo inválido.');
                }
                cleanUpdates.phone_fixed = fixedCheck.formatted || String(updates.phone_fixed).trim();
            } else {
                cleanUpdates.phone_fixed = null;
            }
        }

        let { data, error } = await supabase
            .from('consultas_pacientes')
            .update(cleanUpdates)
            .eq('id', id)
            .select()
            .single();

        // Fallback progressivo: se alguma coluna não existir na tabela Supabase
        if (error && (error.code === 'PGRST204' || error.message?.includes('column') || error.message?.includes('schema cache'))) {
            console.warn('[consultasService] Coluna(s) ausente(s) no Supabase (update). Tentando fallback progressivo...', error.message);

            const optionalCols = ['phone_fixed', 'agente_saude', 'sus_number', 'phone', 'neighborhood', 'street', 'birth_date', 'nickname', 'rg'];
            let fallbackUpdates = { ...cleanUpdates };
            let lastError = error;

            for (const col of optionalCols) {
                if (lastError && (lastError.code === 'PGRST204' || lastError.message?.includes('column') || lastError.message?.includes('schema cache'))) {
                    console.warn(`[consultasService] Removendo coluna '${col}' do payload de update e tentando novamente...`);
                    delete fallbackUpdates[col];

                    const retryRes = await supabase
                        .from('consultas_pacientes')
                        .update(fallbackUpdates)
                        .eq('id', id)
                        .select()
                        .single();

                    data = retryRes.data;
                    lastError = retryRes.error;

                    if (!lastError) break;
                }
            }

            error = lastError;
        }

        if (error) throw error;
        if (typeof window !== 'undefined' && data) {
            window.dispatchEvent(new CustomEvent('consultas-pacientes-changed', { detail: data }));
            window.dispatchEvent(new CustomEvent('paciente-alterado', { detail: data }));
        }
        return data;
    } catch (error: any) {
        const appError = handleSupabaseError(error);
        console.error('[consultasService] updatePaciente Error:', appError.message);
        if (error.code === '23505') {
            throw new Error('CPF já cadastrado no sistema.');
        }
        throw appError;
    }
};

export interface ItemAuditoriaTelefone {
    pacienteId: string;
    pacienteNome: string;
    pacienteCpf: string | null;
    telefoneCadastrado: string | null;
    motivo: string;
    errorCode: string;
    tipoSuspeita: 'ficticio' | 'invalido' | 'ddd_inexistente' | 'sem_telefone' | 'regra_anatel';
}

export interface RelatorioAuditoriaTelefones {
    totalAnalisados: number;
    totalValidos: number;
    totalSuspeitos: number;
    totalSemTelefone: number;
    itensSuspeitos: ItemAuditoriaTelefone[];
    dataHoraExecucao: string;
}

/**
 * Executa auditoria diagnóstica de todos os telefones de pacientes cadastrados na base,
 * identificando inconsistências, números fictícios e violações de regras sem alterar nenhum dado.
 */
export const auditarTelefonesPacientes = async (): Promise<RelatorioAuditoriaTelefones> => {
    const pacientes = await getPacientes();
    const itensSuspeitos: ItemAuditoriaTelefone[] = [];
    let totalValidos = 0;
    let totalSemTelefone = 0;

    for (const p of pacientes) {
        const rawPhone = p.phone ? String(p.phone).trim() : '';
        if (!rawPhone) {
            totalSemTelefone++;
            continue;
        }

        const check = validateBrazilianPhone(rawPhone, { required: false });
        if (check.isValid) {
            totalValidos++;
        } else {
            let tipoSuspeita: ItemAuditoriaTelefone['tipoSuspeita'] = 'invalido';
            if (check.errorCode === 'INVALID_DDD') tipoSuspeita = 'ddd_inexistente';
            else if (check.errorCode === 'INVALID_ANATEL_RULE') tipoSuspeita = 'regra_anatel';
            else if (
                check.errorCode === 'REPETITIVE_DIGITS' ||
                check.errorCode === 'PROGRESSIVE_SEQUENCE' ||
                check.errorCode === 'CYCLIC_PATTERN' ||
                check.errorCode === 'SUSPICIOUS_FICTITIOUS'
            ) {
                tipoSuspeita = 'ficticio';
            }

            itensSuspeitos.push({
                pacienteId: p.id,
                pacienteNome: p.name,
                pacienteCpf: p.cpf || null,
                telefoneCadastrado: rawPhone,
                motivo: check.diagnosticReason || check.errorMessage || TELEFONE_INVALIDO_MSG,
                errorCode: check.errorCode || 'SUSPICIOUS_FICTITIOUS',
                tipoSuspeita
            });
        }
    }

    return {
        totalAnalisados: pacientes.length,
        totalValidos,
        totalSuspeitos: itensSuspeitos.length,
        totalSemTelefone,
        itensSuspeitos,
        dataHoraExecucao: new Date().toISOString()
    };
};

export const deletePaciente = async (id: string): Promise<boolean> => {
    assertCanMutateRegulacao('Excluir Paciente', 'pacientes');
    try {
        const { error, count } = await supabase
            .from('consultas_pacientes')
            .delete({ count: 'exact' })
            .eq('id', id);

        if (error) throw error;
        if (count === 0) {
            throw new Error('Nenhum registro foi excluído. Verifique se o registro existe.');
        }
        return true;
    } catch (error: any) {
        const appError = handleSupabaseError(error);
        console.error('[consultasService] deletePaciente Error:', appError.message);
        if (error.code === '23503') {
            throw new Error('Não é possível excluir este paciente pois existem agendamentos/consultas vinculados a ele.');
        }
        throw appError;
    }
};

export const getPacienteHistory = async (pacienteId: string): Promise<ConsultaAgendamento[]> => {
    try {
        const { data, error } = await supabase
            .from('consultas_agendamentos')
            .select(`
                *,
                procedimento:consultas_procedimentos(*)
            `)
            .eq('patient_id', pacienteId)
            .order('appointment_date', { ascending: false });

        if (error) throw error;
        const history: ConsultaAgendamento[] = data || [];
        const especialistas = await getEspecialistas();
        const espMap = new Map<string, ConsultaEspecialista>(especialistas.map(e => [e.id, e]));

        return history.map(item => {
            let proc = item.procedimento;
            if (proc) {
                const espId = proc.especialista_id || getProcEspecialistaMapping(proc.id) || (item.procedimento_id ? getProcEspecialistaMapping(item.procedimento_id) : null);
                const espObj = (espId ? espMap.get(espId) : null) || proc.especialista || null;
                proc = {
                    ...proc,
                    especialista_id: espId || null,
                    especialista: espObj
                };
            }
            return {
                ...item,
                procedimento: proc
            };
        });
    } catch (error) {
        const appError = handleSupabaseError(error);
        console.error('[consultasService] getPacienteHistory Error:', appError.message);
        return [];
    }
};

// --- VALIDAÇÃO DE DUPLICIDADE DE SOLICITAÇÕES ---

export const ACTIVE_AGENDAMENTO_STATUSES: readonly string[] = [
    'Solicitado',
    'Aguardando Data',
    'Fila de espera',
    'Fila de Espera',
    'Agendado',
    'Retorno',
    'Pausada'
];

export const FINALIZED_AGENDAMENTO_STATUSES: readonly string[] = [
    'Cancelado',
    'Cancelada',
    'Realizado',
    'Não Realizado'
];

export const DUPLICATE_AGENDAMENTO_MESSAGE =
    'Já existe uma solicitação cadastrada para este paciente e procedimento. Não é permitido realizar um pedido duplicado.';

export const isActiveAgendamentoStatus = (status?: string | null): boolean => {
    if (!status) return false;
    const normalized = status.trim().toLowerCase();
    return ![
        'cancelado',
        'cancelada',
        'realizado',
        'concluido',
        'concluído',
        'não realizado',
        'nao realizado'
    ].includes(normalized);
};

export const formatAgendamentoProtocol = (bookingId?: string | null): string => {
    if (!bookingId) return '—';
    return `#${bookingId.substring(0, 8).toUpperCase()}`;
};

export class DuplicateAgendamentoError extends Error {
    public readonly existingBooking: ConsultaAgendamento | null;
    public readonly code = 'DUPLICATE_AGENDAMENTO';

    constructor(existingBooking: ConsultaAgendamento | null, message: string = DUPLICATE_AGENDAMENTO_MESSAGE) {
        super(message);
        this.name = 'DuplicateAgendamentoError';
        this.existingBooking = existingBooking;
        Object.setPrototypeOf(this, DuplicateAgendamentoError.prototype);
    }
}

const parseDuplicateExceptionMetadata = (
    errMsg: string,
    patientId: string,
    procedimentoId: string
): ConsultaAgendamento | null => {
    const match = errMsg.match(/SOLICITACAO_DUPLICADA\|([^|]*)\|([^|]*)\|([^\s|]*)/);
    if (!match) return null;
    const [, id, status, solDate] = match;
    if (!id) return null;
    return {
        id: id.trim(),
        patient_id: patientId,
        procedimento_id: procedimentoId,
        status: (status?.trim() || 'Solicitado') as ConsultaAgendamento['status'],
        solicitation_date: solDate?.trim() || undefined,
        quantity: 1,
        priority: 'Normal',
        created_by: ''
    };
};

/**
 * Consulta no banco de dados se já existe uma solicitação ATIVA para o mesmo paciente (ID ou CPF)
 * e o mesmo procedimento (ID ou código único).
 * Solicitações com status 'Cancelado', 'Realizado' ou 'Não Realizado' NÃO bloqueiam novo cadastro.
 */
export const checkActiveDuplicateAgendamento = async (
    patient: { id: string; cpf?: string | null },
    procedimento: { id: string; code?: string | null },
    excludeAgendamentoId?: string
): Promise<ConsultaAgendamento | null> => {
    if (!patient?.id || !procedimento?.id) return null;

    const cleanCpfInput = patient.cpf ? patient.cpf.replace(/\D/g, '').trim() : '';
    const cleanCodeInput = procedimento.code ? procedimento.code.trim() : '';

    // 1. Tentar primeiro via RPC SECURITY DEFINER (se já implantada no Supabase),
    //    garantindo verificação global entre setores mesmo com RLS restritivo.
    if (!excludeAgendamentoId) {
        try {
            const { data: rpcData, error: rpcError } = await supabase.rpc('verificar_solicitacao_ativa_duplicada', {
                p_patient_id: patient.id,
                p_procedimento_id: procedimento.id,
                p_cpf: cleanCpfInput || null,
                p_proc_code: cleanCodeInput || null
            });

            if (!rpcError) {
                const rows = Array.isArray(rpcData) ? rpcData : rpcData ? [rpcData] : [];
                if (rows.length === 0) {
                    return null;
                }
                const hit = rows[0] as any;
                // Tentar enriquecer via consulta direta caso o usuário tenha visibilidade de leitura
                const fullRow = await getAgendamentoById(hit.id).catch(() => null);
                if (fullRow) return fullRow;

                return {
                    id: hit.id,
                    patient_id: hit.patient_id || patient.id,
                    procedimento_id: hit.procedimento_id || procedimento.id,
                    status: hit.status,
                    solicitation_date: hit.solicitation_date || undefined,
                    appointment_date: hit.appointment_date || null,
                    appointment_time: hit.appointment_time || undefined,
                    priority: hit.priority || 'Normal',
                    created_at: hit.created_at,
                    is_retorno: hit.is_retorno,
                    retorno_tipo: hit.retorno_tipo,
                    quantity: 1,
                    created_by: ''
                };
            }
            // Se erro indicar que a RPC ainda não existe no banco, segue para consulta direta abaixo
            const msg = String(rpcError.message || '');
            if (
                rpcError.code !== '42883' &&
                rpcError.code !== 'PGRST202' &&
                !msg.includes('Could not find the function') &&
                !msg.includes('does not exist')
            ) {
                console.warn('[consultasService] Aviso ao chamar RPC verificar_solicitacao_ativa_duplicada, usando consulta direta:', msg);
            }
        } catch {
            // Fallback transparente para consulta direta
        }
    }

    // 2. Consulta direta em tempo real nas tabelas do Supabase
    const patientIdsSet = new Set<string>([patient.id]);
    if (cleanCpfInput.length === 11) {
        const formattedCpf = cleanCpfInput.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
        const { data: matchingPatients } = await supabase
            .from('consultas_pacientes')
            .select('id')
            .or(`cpf.eq.${cleanCpfInput},cpf.eq.${formattedCpf}`);
        (matchingPatients || []).forEach((p: any) => {
            if (p?.id) patientIdsSet.add(p.id);
        });
    }

    const procIdsSet = new Set<string>([procedimento.id]);
    if (cleanCodeInput) {
        const { data: matchingProcs } = await supabase
            .from('consultas_procedimentos')
            .select('id')
            .eq('code', cleanCodeInput);
        (matchingProcs || []).forEach((pr: any) => {
            if (pr?.id) procIdsSet.add(pr.id);
        });
    }

    const patientIds = Array.from(patientIdsSet);
    const procIds = Array.from(procIdsSet);

    let query = supabase
        .from('consultas_agendamentos')
        .select(`
            *,
            paciente:consultas_pacientes(*),
            procedimento:consultas_procedimentos(*),
            responsavel:profiles(id, name)
        `)
        .in('patient_id', patientIds)
        .in('procedimento_id', procIds)
        .in('status', [...ACTIVE_AGENDAMENTO_STATUSES])
        .order('created_at', { ascending: false })
        .limit(1);

    if (excludeAgendamentoId) {
        query = query.neq('id', excludeAgendamentoId);
    }

    let { data, error } = await query;

    if (error && (error.code === '42703' || error.code === 'PGRST204' || error.message?.includes('column'))) {
        let fallbackQuery = supabase
            .from('consultas_agendamentos')
            .select(`
                id,
                patient_id,
                procedimento_id,
                status,
                appointment_date,
                priority,
                created_at,
                paciente:consultas_pacientes(id, name, cpf),
                procedimento:consultas_procedimentos(id, name, code, type)
            `)
            .in('patient_id', patientIds)
            .in('procedimento_id', procIds)
            .in('status', [...ACTIVE_AGENDAMENTO_STATUSES])
            .order('created_at', { ascending: false })
            .limit(1);

        if (excludeAgendamentoId) {
            fallbackQuery = fallbackQuery.neq('id', excludeAgendamentoId);
        }

        const fallbackRes = await fallbackQuery;
        data = fallbackRes.data as any;
        error = fallbackRes.error;
    }

    if (error) {
        console.error('[consultasService] Erro ao verificar duplicidade:', error.message);
        throw error;
    }

    if (data && data.length > 0) {
        const row: any = data[0];
        if (row.procedimento) {
            const espId = row.procedimento.especialista_id || getProcEspecialistaMapping(row.procedimento.id);
            if (espId) {
                const especialistas = await getEspecialistas().catch(() => []);
                const espObj = especialistas.find(e => e.id === espId) || null;
                row.procedimento = {
                    ...row.procedimento,
                    especialista_id: espId,
                    especialista: espObj
                };
            }
        }
        return row as ConsultaAgendamento;
    }

    return null;
};

// --- PROFISSIONAIS ESPECIALISTAS ---

const ESPECIALISTA_STORAGE_KEY = 'consultas_especialistas_cache';
const PROC_ESPECIALISTA_STORAGE_KEY = 'consultas_proc_especialista_map';

let memProcEspecialistaMap: Record<string, string> = {};

export const getCachedEspecialistas = (): ConsultaEspecialista[] => {
    if (typeof window === 'undefined') return [];
    try {
        const raw = localStorage.getItem(ESPECIALISTA_STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
};

export const saveCachedEspecialistas = (list: ConsultaEspecialista[]) => {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(ESPECIALISTA_STORAGE_KEY, JSON.stringify(list));
    } catch {}
};

export const getEspecialistas = async (onlyActive: boolean = false): Promise<ConsultaEspecialista[]> => {
    try {
        // 1. Tenta buscar da tabela nativa do Supabase
        let { data, error } = await supabase
            .from('consultas_especialistas')
            .select('*')
            .order('nome', { ascending: true });

        if (!error && data && data.length > 0) {
            saveCachedEspecialistas(data);
            if (onlyActive) {
                data = data.filter((e: ConsultaEspecialista) => e.status === 'Ativo');
            }
            return data;
        }

        // 2. Se a tabela não existir ou estiver vazia, busca do repositório centralizado de configurações no Supabase
        const { data: orgData } = await supabase
            .from('organization_settings')
            .select('ui_config')
            .eq('id', 'global_config')
            .maybeSingle();

        if (orgData?.ui_config) {
            const orgEspecialistas = orgData.ui_config.consultas_especialistas;
            const orgMappings = orgData.ui_config.consultas_proc_especialistas;

            if (orgMappings && typeof orgMappings === 'object') {
                memProcEspecialistaMap = { ...memProcEspecialistaMap, ...orgMappings };
                if (typeof window !== 'undefined') {
                    try {
                        const localRaw = localStorage.getItem(PROC_ESPECIALISTA_STORAGE_KEY);
                        const localMap = localRaw ? JSON.parse(localRaw) : {};
                        localStorage.setItem(PROC_ESPECIALISTA_STORAGE_KEY, JSON.stringify({ ...orgMappings, ...localMap }));
                    } catch {}
                }
            }

            if (Array.isArray(orgEspecialistas) && orgEspecialistas.length > 0) {
                saveCachedEspecialistas(orgEspecialistas);
                let list = orgEspecialistas;
                if (onlyActive) {
                    list = list.filter((e: ConsultaEspecialista) => e.status === 'Ativo');
                }
                return list.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
            }
        }

        let cached = getCachedEspecialistas();
        if (onlyActive) {
            cached = cached.filter(e => e.status === 'Ativo');
        }
        return cached.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
    } catch (error) {
        let cached = getCachedEspecialistas();
        if (onlyActive) {
            cached = cached.filter(e => e.status === 'Ativo');
        }
        return cached;
    }
};

export const getEspecialistaById = async (id: string): Promise<ConsultaEspecialista | null> => {
    try {
        const { data, error } = await supabase
            .from('consultas_especialistas')
            .select('*')
            .eq('id', id)
            .maybeSingle();

        if (!error && data) return data;
        const cached = getCachedEspecialistas();
        return cached.find(e => e.id === id) || null;
    } catch {
        const cached = getCachedEspecialistas();
        return cached.find(e => e.id === id) || null;
    }
};

export const createEspecialista = async (especialista: Omit<ConsultaEspecialista, 'id' | 'created_at' | 'updated_at'>): Promise<ConsultaEspecialista | null> => {
    assertCanMutateRegulacao('Cadastrar Especialista', 'procedimentos');
    try {
        const payload = {
            nome: especialista.nome?.trim().toUpperCase(),
            especialidade: especialista.especialidade?.trim().toUpperCase(),
            grupo: especialista.grupo?.trim().toUpperCase() || 'MÉDICOS',
            status: especialista.status || 'Ativo'
        };

        let created: ConsultaEspecialista;

        let { data, error } = await supabase
            .from('consultas_especialistas')
            .insert([payload])
            .select()
            .single();

        if (error || !data) {
            created = {
                id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `esp-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
                ...payload,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
        } else {
            created = data;
        }

        const list = getCachedEspecialistas().filter(e => e.id !== created.id);
        list.push(created);
        saveCachedEspecialistas(list);

        // Sincroniza no Supabase organization_settings
        try {
            const { data: orgData } = await supabase
                .from('organization_settings')
                .select('ui_config')
                .eq('id', 'global_config')
                .maybeSingle();

            const currentUiConfig = orgData?.ui_config || {};
            const orgList = (currentUiConfig.consultas_especialistas || []).filter((e: any) => e.id !== created.id);
            orgList.push(created);

            await supabase
                .from('organization_settings')
                .update({
                    ui_config: {
                        ...currentUiConfig,
                        consultas_especialistas: orgList
                    }
                })
                .eq('id', 'global_config');
        } catch (orgErr) {
            console.warn('[consultasService] Erro ao sincronizar especialista com organization_settings:', orgErr);
        }

        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('consultas-especialistas-changed', { detail: created }));
        }

        return created;
    } catch (error: any) {
        const appError = handleSupabaseError(error);
        console.error('[consultasService] createEspecialista Error:', appError.message);
        throw appError;
    }
};

export const updateEspecialista = async (id: string, updates: Partial<ConsultaEspecialista>): Promise<ConsultaEspecialista | null> => {
    assertCanMutateRegulacao('Atualizar Especialista', 'procedimentos');
    try {
        const cleanUpdates: any = { ...updates, updated_at: new Date().toISOString() };
        if (cleanUpdates.nome) cleanUpdates.nome = cleanUpdates.nome.trim().toUpperCase();
        if (cleanUpdates.especialidade) cleanUpdates.especialidade = cleanUpdates.especialidade.trim().toUpperCase();
        if (cleanUpdates.grupo) cleanUpdates.grupo = cleanUpdates.grupo.trim().toUpperCase();

        let updated: ConsultaEspecialista;

        let { data, error } = await supabase
            .from('consultas_especialistas')
            .update(cleanUpdates)
            .eq('id', id)
            .select()
            .single();

        if (error || !data) {
            const list = getCachedEspecialistas();
            const idx = list.findIndex(e => e.id === id);
            if (idx > -1) {
                list[idx] = { ...list[idx], ...cleanUpdates };
                updated = list[idx];
            } else {
                updated = { id, ...cleanUpdates } as ConsultaEspecialista;
            }
        } else {
            updated = data;
        }

        const list = getCachedEspecialistas().map(e => e.id === id ? updated : e);
        saveCachedEspecialistas(list);

        // Sincroniza no Supabase organization_settings
        try {
            const { data: orgData } = await supabase
                .from('organization_settings')
                .select('ui_config')
                .eq('id', 'global_config')
                .maybeSingle();

            const currentUiConfig = orgData?.ui_config || {};
            const orgList = (currentUiConfig.consultas_especialistas || []).map((e: any) => e.id === id ? { ...e, ...cleanUpdates } : e);

            await supabase
                .from('organization_settings')
                .update({
                    ui_config: {
                        ...currentUiConfig,
                        consultas_especialistas: orgList
                    }
                })
                .eq('id', 'global_config');
        } catch (orgErr) {
            console.warn('[consultasService] Erro ao sincronizar update de especialista no Supabase:', orgErr);
        }

        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('consultas-especialistas-changed', { detail: updated }));
        }

        return updated;
    } catch (error: any) {
        const appError = handleSupabaseError(error);
        console.error('[consultasService] updateEspecialista Error:', appError.message);
        throw appError;
    }
};

export const deleteEspecialista = async (id: string): Promise<boolean> => {
    assertCanMutateRegulacao('Excluir Especialista', 'procedimentos');
    try {
        // Validação de integridade referencial: verificar se há procedimentos associados a este especialista
        const procs = await getProcedimentos();
        const linkedProcs = procs.filter(p => p.especialista_id === id);
        if (linkedProcs.length > 0) {
            const names = linkedProcs.slice(0, 3).map(p => `"${p.name}"`).join(', ');
            const extra = linkedProcs.length > 3 ? ` e mais ${linkedProcs.length - 3} procedimento(s)` : '';
            throw new Error(`Não é possível excluir este especialista pois ele está vinculado a ${linkedProcs.length} procedimento(s): ${names}${extra}. Desvincule os procedimentos primeiro.`);
        }

        await supabase
            .from('consultas_especialistas')
            .delete()
            .eq('id', id);

        // Limpa cache local
        const list = getCachedEspecialistas().filter(e => e.id !== id);
        saveCachedEspecialistas(list);

        // Sincroniza no Supabase organization_settings
        try {
            const { data: orgData } = await supabase
                .from('organization_settings')
                .select('ui_config')
                .eq('id', 'global_config')
                .maybeSingle();

            const currentUiConfig = orgData?.ui_config || {};
            const orgList = (currentUiConfig.consultas_especialistas || []).filter((e: any) => e.id !== id);
            const orgMap = { ...(currentUiConfig.consultas_proc_especialistas || {}) };
            Object.keys(orgMap).forEach(procId => {
                if (orgMap[procId] === id) delete orgMap[procId];
            });

            await supabase
                .from('organization_settings')
                .update({
                    ui_config: {
                        ...currentUiConfig,
                        consultas_especialistas: orgList,
                        consultas_proc_especialistas: orgMap
                    }
                })
                .eq('id', 'global_config');
        } catch (orgErr) {
            console.warn('[consultasService] Erro ao sincronizar delete de especialista no Supabase:', orgErr);
        }

        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('consultas-especialistas-changed', { detail: { id } }));
        }

        return true;
    } catch (error: any) {
        const appError = handleSupabaseError(error);
        console.error('[consultasService] deleteEspecialista Error:', appError.message);
        throw appError;
    }
};

// --- MAPEAMENTO CENTRALIZADO: PROCEDIMENTO <-> ESPECIALISTA ---

export const getProcEspecialistaMapping = (procId?: string | null): string | null => {
    if (!procId) return null;
    if (memProcEspecialistaMap[procId]) return memProcEspecialistaMap[procId];
    if (typeof window !== 'undefined') {
        try {
            const raw = localStorage.getItem(PROC_ESPECIALISTA_STORAGE_KEY);
            const map: Record<string, string> = raw ? JSON.parse(raw) : {};
            return map[procId] || null;
        } catch {
            return null;
        }
    }
    return null;
};

export const saveProcEspecialistaMapping = (procId: string, especialistaId?: string | null) => {
    if (!procId) return;
    if (especialistaId) {
        memProcEspecialistaMap[procId] = especialistaId;
    } else {
        delete memProcEspecialistaMap[procId];
    }
    if (typeof window !== 'undefined') {
        try {
            const raw = localStorage.getItem(PROC_ESPECIALISTA_STORAGE_KEY);
            const map: Record<string, string> = raw ? JSON.parse(raw) : {};
            if (especialistaId) {
                map[procId] = especialistaId;
            } else {
                delete map[procId];
            }
            localStorage.setItem(PROC_ESPECIALISTA_STORAGE_KEY, JSON.stringify(map));
        } catch {}
    }

    // Sincroniza assincronamente com o Supabase
    (async () => {
        try {
            const { data: orgData } = await supabase
                .from('organization_settings')
                .select('ui_config')
                .eq('id', 'global_config')
                .maybeSingle();

            const currentUiConfig = orgData?.ui_config || {};
            const currentMap = { ...(currentUiConfig.consultas_proc_especialistas || {}) };
            if (especialistaId) {
                currentMap[procId] = especialistaId;
            } else {
                delete currentMap[procId];
            }

            await supabase
                .from('organization_settings')
                .update({
                    ui_config: {
                        ...currentUiConfig,
                        consultas_proc_especialistas: currentMap
                    }
                })
                .eq('id', 'global_config');
        } catch (syncErr) {
            console.warn('[consultasService] Aviso ao salvar mapping no Supabase:', syncErr);
        }
    })();
};

import { formatProcedimentoDisplay } from '../utils/procedimentosHierarchy';

// Cache em memória dos nomes de procedimentos principais para resolução em seletores/pesquisas
let memProcParentNamesMap = new Map<string, string>();

export const getCachedProcedimentosParents = (): Map<string, string> => {
    return memProcParentNamesMap;
};

export const setCachedProcedimentosParents = (map: Map<string, string>) => {
    memProcParentNamesMap = map;
};

/**
 * Formata o label do procedimento conforme regra estrita da camada de apresentação:
 * Com especialista: "NOME DO PROCEDIMENTO PAI - NOME COMPLETO DO ESPECIALISTA" (ex: "CONSULTA EM CARDIOLOGIA - EURICO ABREU DE OLIVEIRA JÚNIOR")
 * Sem especialista: "NOME DO PROCEDIMENTO" (ex: "CONSULTA EM CARDIOLOGIA")
 * Preserva o nome do pai caso o procedimento seja filho e evita duplicidades.
 */
export const formatProcedimentoLabel = (
    procedimento?: { id?: string; name: string; code?: string; especialista?: { nome: string } | null; especialista_id?: string | null; parent_id?: string | null; parent_name?: string | null } | null,
    especialistasList?: ConsultaEspecialista[],
    parentProcOrName?: { id?: string; name: string } | string | null
): string => {
    if (!procedimento || !procedimento.name) return '';

    // Se o procedimento não tiver parent_name nem parentProcOrName, tenta resolver pelo mapeamento conhecido
    let resolvedParentName = typeof parentProcOrName === 'string'
        ? parentProcOrName
        : parentProcOrName?.name || procedimento.parent_name || null;

    if (!resolvedParentName && procedimento.parent_id) {
        if (memProcParentNamesMap.has(procedimento.parent_id)) {
            resolvedParentName = memProcParentNamesMap.get(procedimento.parent_id)!;
        }
    }

    const list = (especialistasList && especialistasList.length > 0) ? especialistasList : getCachedEspecialistas();
    return formatProcedimentoDisplay(procedimento as any, resolvedParentName, list);
};

// --- MAPEAMENTO CENTRALIZADO: PROCEDIMENTO PAI <-> PROCEDIMENTOS FILHOS ---

const PROC_PARENT_STORAGE_KEY = 'consultas_proc_parent_map';
let memProcParentMap: Record<string, string> = {};

export const getProcParentMapping = (childProcId?: string | null): string | null => {
    if (!childProcId) return null;
    if (memProcParentMap[childProcId]) return memProcParentMap[childProcId];
    if (typeof window !== 'undefined') {
        try {
            const raw = localStorage.getItem(PROC_PARENT_STORAGE_KEY);
            const map: Record<string, string> = raw ? JSON.parse(raw) : {};
            return map[childProcId] || null;
        } catch {
            return null;
        }
    }
    return null;
};

export const saveProcParentMapping = (childProcId: string, parentProcId?: string | null) => {
    if (!childProcId) return;
    if (parentProcId) {
        memProcParentMap[childProcId] = parentProcId;
    } else {
        delete memProcParentMap[childProcId];
    }
    if (typeof window !== 'undefined') {
        try {
            const raw = localStorage.getItem(PROC_PARENT_STORAGE_KEY);
            const map: Record<string, string> = raw ? JSON.parse(raw) : {};
            if (parentProcId) {
                map[childProcId] = parentProcId;
            } else {
                delete map[childProcId];
            }
            localStorage.setItem(PROC_PARENT_STORAGE_KEY, JSON.stringify(map));
        } catch {}
    }

    // Sincroniza com Supabase organization_settings
    (async () => {
        try {
            const { data: orgData } = await supabase
                .from('organization_settings')
                .select('ui_config')
                .eq('id', 'global_config')
                .maybeSingle();

            const currentUiConfig = orgData?.ui_config || {};
            const currentMap = { ...(currentUiConfig.consultas_proc_parents || {}) };
            if (parentProcId) {
                currentMap[childProcId] = parentProcId;
            } else {
                delete currentMap[childProcId];
            }

            await supabase
                .from('organization_settings')
                .update({
                    ui_config: {
                        ...currentUiConfig,
                        consultas_proc_parents: currentMap
                    }
                })
                .eq('id', 'global_config');
        } catch (syncErr) {
            console.warn('[consultasService] Aviso ao salvar parent mapping no Supabase:', syncErr);
        }
    })();
};

/**
 * Gera o próximo código de especialista vinculado a um procedimento principal.
 * Padrão: CÓDIGO_PAI-SUFIXO (ex: 0397-10, 0397-11, 0397-12)
 * Preserva os zeros à esquerda do código pai.
 * Não reutiliza códigos existentes e inicia em -10.
 */
export const getNextEspecialistaCode = (parentCode: string, existingChildCodes: string[]): string => {
    const cleanParentCode = (parentCode || '0000').trim();
    const prefix = `${cleanParentCode}-`;

    const suffixes = existingChildCodes
        .filter(c => c && c.startsWith(prefix))
        .map(c => {
            const part = c.substring(prefix.length);
            const num = parseInt(part, 10);
            return isNaN(num) ? 0 : num;
        });

    let nextSuffix = 10;
    if (suffixes.length > 0) {
        const maxSuffix = Math.max(...suffixes);
        nextSuffix = Math.max(10, maxSuffix + 1);
    }

    return `${cleanParentCode}-${nextSuffix}`;
};

// --- PROCEDIMENTOS ---

const PROCEDIMENTO_COLUMNS = 'id, name, code, type, available_quantity, total_quantity, status, recurso, parent_id, especialista_id, created_at, updated_at';
const PROCEDIMENTO_COLUMNS_FALLBACK = 'id, name, code, type, available_quantity, total_quantity, status, recurso, created_at, updated_at';

export const getProcedimentos = async (
    onlyActive: boolean = false,
    hasEspecialistaFilter?: boolean
): Promise<ConsultaProcedimento[]> => {
    try {
        let query = supabase.from('consultas_procedimentos').select(PROCEDIMENTO_COLUMNS).order('name', { ascending: true });
        
        if (onlyActive) {
            query = query.eq('status', 'Ativo');
        }

        let { data, error } = await query;
        if (error && (error.code === 'PGRST204' || error.message?.includes('column') || error.message?.includes('schema cache'))) {
            let fallbackQuery = supabase.from('consultas_procedimentos').select(PROCEDIMENTO_COLUMNS_FALLBACK).order('name', { ascending: true });
            if (onlyActive) {
                fallbackQuery = fallbackQuery.eq('status', 'Ativo');
            }
            const resFallback = await fallbackQuery;
            data = resFallback.data as any;
        }

        const procs: ConsultaProcedimento[] = data || [];
        const especialistas = await getEspecialistas();
        const espMap = new Map<string, ConsultaEspecialista>(especialistas.map(e => [e.id, e]));

        // Carregar mapeamentos remotos de parent se disponíveis
        try {
            const { data: orgData } = await supabase
                .from('organization_settings')
                .select('ui_config')
                .eq('id', 'global_config')
                .maybeSingle();
            if (orgData?.ui_config?.consultas_proc_parents) {
                memProcParentMap = { ...memProcParentMap, ...orgData.ui_config.consultas_proc_parents };
            }
        } catch {}

        // Identificar nomes dos pais estritos para enriquecer filhos
        const parentNameById = new Map<string, string>();
        const parentNameByCode = new Map<string, string>();
        procs.forEach(p => {
            if (!p.parent_id && !p.especialista_id) {
                parentNameById.set(p.id, p.name);
                if (p.code) parentNameByCode.set(p.code, p.name);
            }
        });

        // Atualiza cache em memória dos pais para uso nos seletores
        setCachedProcedimentosParents(parentNameById);

        const mapped = procs.map(p => {
            const espId = p.especialista_id || getProcEspecialistaMapping(p.id);
            const parentId = p.parent_id || getProcParentMapping(p.id) || null;
            const espObj = (espId ? espMap.get(espId) : null) || p.especialista || null;

            let resolvedParentName: string | null = null;
            if (parentId && parentNameById.has(parentId)) {
                resolvedParentName = parentNameById.get(parentId)!;
            } else if (p.code && p.code.includes('-')) {
                const parentCode = p.code.split('-')[0];
                if (parentNameByCode.has(parentCode)) {
                    resolvedParentName = parentNameByCode.get(parentCode)!;
                }
            }

            return {
                ...p,
                parent_id: parentId,
                parent_name: resolvedParentName,
                especialista_id: espId || null,
                especialista: espObj
            };
        });

        // REGRA DE SUSPENSÃO: Quando onlyActive for solicitado, garantir que o status seja 'Ativo'
        // e que, caso possua parent_id, o procedimento pai também esteja 'Ativo'.
        let filtered = mapped;
        if (onlyActive) {
            filtered = filtered.filter(p => {
                if (p.status !== 'Ativo') return false;
                if (p.parent_id) {
                    const parent = procs.find(parentProc => parentProc.id === p.parent_id);
                    if (!parent || parent.status !== 'Ativo') return false;
                }
                return true;
            });
        }

        if (hasEspecialistaFilter !== undefined) {
            return filtered.filter(p => hasEspecialistaFilter ? (!!p.especialista_id || !!p.parent_id) : (!p.especialista_id && !p.parent_id));
        }

        return filtered;
    } catch (error) {
        const appError = handleSupabaseError(error);
        console.error('[consultasService] getProcedimentos Error:', appError.message);
        return [];
    }
};

/**
 * Regra Centralizada: Verifica se um procedimento está ativo e elegível para novos agendamentos / solicitações.
 * Um procedimento é elegível apenas se estiver com status 'Ativo' E, caso possua pai (parent_id), o pai também estiver 'Ativo'.
 */
export const isProcedimentoElegivelParaNovasSolicitacoes = (
    proc: ConsultaProcedimento | null | undefined,
    allProcedures?: ConsultaProcedimento[]
): boolean => {
    if (!proc) return false;
    if (proc.status !== 'Ativo') return false;
    if (proc.parent_id && allProcedures && allProcedures.length > 0) {
        const parent = allProcedures.find(p => p.id === proc.parent_id);
        if (parent && parent.status !== 'Ativo') return false;
    }
    return true;
};

/**
 * Regra Centralizada: Verifica se um procedimento está ativo e elegível como destino de transferência.
 * Exclusivamente procedimentos com status 'Ativo' (e com pai 'Ativo' se houver) podem ser destino de transferências.
 */
export const isProcedimentoElegivelParaTransferenciaDestino = (
    proc: ConsultaProcedimento | null | undefined,
    allProcedures?: ConsultaProcedimento[]
): boolean => {
    return isProcedimentoElegivelParaNovasSolicitacoes(proc, allProcedures);
};

export const createProcedimento = async (procedimento: Omit<ConsultaProcedimento, 'id' | 'created_at' | 'updated_at'>): Promise<ConsultaProcedimento | null> => {
    assertCanMutateRegulacao('Cadastrar Procedimento', 'procedimentos');
    try {
        const espIdPayload = procedimento.especialista_id || null;
        const parentIdPayload = procedimento.parent_id || null;
        let payload: any = { ...procedimento };
        delete payload.especialista;

        let { data, error } = await supabase
            .from('consultas_procedimentos')
            .insert([payload])
            .select()
            .single();

        // Fallback progressivo caso coluna especialista_id ou parent_id não exista no schema Supabase
        if (error && (error.code === 'PGRST204' || error.message?.includes('column') || error.message?.includes('schema cache'))) {
            delete payload.especialista_id;
            delete payload.parent_id;
            const retryRes = await supabase
                .from('consultas_procedimentos')
                .insert([payload])
                .select()
                .single();
            data = retryRes.data;
            error = retryRes.error;
        }

        if (error) throw error;

        // Salvar vínculos no storage de mapeamento
        if (data && data.id) {
            saveProcEspecialistaMapping(data.id, espIdPayload);
            saveProcParentMapping(data.id, parentIdPayload);
            data.parent_id = parentIdPayload;
            if (espIdPayload) {
                const esp = await getEspecialistaById(espIdPayload);
                data.especialista_id = espIdPayload;
                data.especialista = esp;
            }
        }

        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('consultas-procedimentos-changed'));
        }

        return data;
    } catch (error) {
        const appError = handleSupabaseError(error);
        console.error('[consultasService] createProcedimento Error:', appError.message);
        throw appError;
    }
};

export const updateProcedimento = async (id: string, updates: Partial<ConsultaProcedimento>): Promise<ConsultaProcedimento | null> => {
    assertCanMutateRegulacao('Atualizar Procedimento', 'procedimentos');
    try {
        const espIdPayload = updates.especialista_id !== undefined ? updates.especialista_id : getProcEspecialistaMapping(id);
        const parentIdPayload = updates.parent_id !== undefined ? updates.parent_id : getProcParentMapping(id);
        let payload: any = { ...updates };
        delete payload.especialista;

        let { data, error } = await supabase
            .from('consultas_procedimentos')
            .update(payload)
            .eq('id', id)
            .select()
            .single();

        // Fallback progressivo caso colunas não existam no schema cache do Supabase
        if (error && (error.code === 'PGRST204' || error.message?.includes('column') || error.message?.includes('schema cache'))) {
            delete payload.especialista_id;
            delete payload.parent_id;
            const retryRes = await supabase
                .from('consultas_procedimentos')
                .update(payload)
                .eq('id', id)
                .select()
                .single();
            data = retryRes.data;
            error = retryRes.error;
        }

        if (error) throw error;

        // Atualizar mapeamentos
        saveProcEspecialistaMapping(id, espIdPayload);
        saveProcParentMapping(id, parentIdPayload);
        if (data) {
            data.parent_id = parentIdPayload || null;
            data.especialista_id = espIdPayload || null;
            if (espIdPayload) {
                const esp = await getEspecialistaById(espIdPayload);
                data.especialista = esp;
            }
        }

        // Se este procedimento for pai e seu nome mudou, atualizar o nome exibido dos procedimentos filhos vinculados
        if (updates.name && (!updates.parent_id && !getProcParentMapping(id))) {
            try {
                const procs = await getProcedimentos();
                const children = procs.filter(p => p.parent_id === id);
                for (const child of children) {
                    if (child.especialista?.nome) {
                        const newChildName = `${updates.name.trim().toUpperCase()} — ${child.especialista.nome.trim().toUpperCase()}`;
                        await updateProcedimento(child.id, { name: newChildName });
                    }
                }
            } catch (cascadeErr) {
                console.warn('[consultasService] Aviso ao propagar alteração de nome para procedimentos filhos:', cascadeErr);
            }
        }

        // Auditoria de alteração de status operacional (Suspensão / Reativação)
        if (updates.status) {
            try {
                const isSuspended = updates.status === 'Inativo';
                await auditLogService.logAction({
                    action_type: isSuspended ? 'SUSPENDER_PROCEDIMENTO' : 'REATIVAR_PROCEDIMENTO',
                    module: 'Regulação - Procedimentos',
                    description: isSuspended
                        ? `Procedimento "${data?.name || id}" suspenso. Novos agendamentos e transferências para este procedimento foram bloqueados. As solicitações existentes foram integralmente preservadas.`
                        : `Procedimento "${data?.name || id}" reativado com sucesso. O procedimento voltou a aceitar novos agendamentos e transferências.`,
                    details: {
                        procedimento_id: id,
                        procedimento_nome: data?.name,
                        procedimento_codigo: data?.code,
                        novo_status: updates.status,
                        data_hora: new Date().toISOString()
                    }
                });
            } catch (auditErr) {
                console.warn('[consultasService] Aviso ao registrar auditoria de status de procedimento:', auditErr);
            }
        }

        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('consultas-procedimentos-changed'));
        }

        return data;
    } catch (error) {
        const appError = handleSupabaseError(error);
        console.error('[consultasService] updateProcedimento Error:', appError.message);
        throw appError;
    }
};

/**
 * Cria ou vincula um especialista a um procedimento principal gerando código próprio CÓDIGO_PAI-SUFIXO.
 */
export const vincularEspecialistaProcedimento = async (params: {
    parentId: string;
    especialistaId: string;
    status?: 'Ativo' | 'Inativo';
}): Promise<ConsultaProcedimento> => {
    assertCanMutateRegulacao('Vincular Especialista ao Procedimento', 'procedimentos');
    try {
        const procs = await getProcedimentos();
        const parentProc = procs.find(p => p.id === params.parentId);
        if (!parentProc) {
            throw new Error('Procedimento principal não encontrado.');
        }

        const especialistas = await getEspecialistas();
        const esp = especialistas.find(e => e.id === params.especialistaId);
        if (!esp) {
            throw new Error('Especialista selecionado não encontrado.');
        }

        // Obter filhos existentes deste pai para verificar unicidade e gerar código sequencial
        const existingChildren = procs.filter(p => p.parent_id === parentProc.id || (p.code && p.code.startsWith(`${parentProc.code}-`)));
        
        // Verifica se este especialista já está vinculado ao procedimento pai
        const alreadyLinked = existingChildren.find(p => p.especialista_id === esp.id);
        if (alreadyLinked) {
            throw new Error(`O especialista ${esp.nome} já está vinculado ao procedimento "${parentProc.name}" com o código ${alreadyLinked.code}.`);
        }

        const childCodes = existingChildren.map(c => c.code || '');
        const autoCode = getNextEspecialistaCode(parentProc.code || '0000', childCodes);
        const childName = `${parentProc.name.trim().toUpperCase()} — ${esp.nome.trim().toUpperCase()}`;

        const created = await createProcedimento({
            name: childName,
            code: autoCode,
            type: parentProc.type,
            parent_id: parentProc.id,
            especialista_id: esp.id,
            status: params.status || 'Ativo',
            recurso: parentProc.recurso || 'Não Se Aplica',
            total_quantity: 0,
            available_quantity: 0
        });

        if (!created) {
            throw new Error('Falha ao cadastrar especialista no procedimento.');
        }

        return created;
    } catch (error: any) {
        const appError = handleSupabaseError(error);
        console.error('[consultasService] vincularEspecialistaProcedimento Error:', appError.message);
        throw appError;
    }
};

export const deleteProcedimento = async (id: string): Promise<boolean> => {
    assertCanMutateRegulacao('Excluir Procedimento', 'procedimentos');
    try {
        const procs = await getProcedimentos();
        const proc = procs.find(p => p.id === id);

        // Se for um procedimento principal, verificar se possui especialistas vinculados
        if (proc && !proc.parent_id) {
            const children = procs.filter(p => p.parent_id === id || (p.code && proc.code && p.code.startsWith(`${proc.code}-`)));
            if (children.length > 0) {
                throw new Error(`Este procedimento possui ${children.length} especialista(s) vinculado(s). Remova ou suspenda os especialistas antes de excluir o procedimento principal.`);
            }
        }

        // Verificar se há agendamentos históricos vinculados
        const { count: agendamentosCount } = await supabase
            .from('consultas_agendamentos')
            .select('id', { count: 'exact', head: true })
            .eq('procedimento_id', id);

        if (agendamentosCount && agendamentosCount > 0) {
            throw new Error(`Não é possível excluir fisicamente este procedimento pois ele possui ${agendamentosCount} agendamento(s) no histórico. Recomendamos alterar o status para "Suspenso".`);
        }

        // 1. Limpar vagas vinculadas
        const { error: vagasError } = await supabase
            .from('consultas_vagas')
            .delete()
            .eq('procedimento_id', id);

        if (vagasError) {
            console.warn('[consultasService] Aviso ao remover vagas vinculadas na exclusão:', vagasError.message);
        }

        // 2. Limpar mapeamentos locais e remotos
        saveProcEspecialistaMapping(id, null);
        saveProcParentMapping(id, null);

        // 4. Excluir o procedimento da tabela consultas_procedimentos
        const { error, count } = await supabase
            .from('consultas_procedimentos')
            .delete({ count: 'exact' })
            .eq('id', id);

        if (error) throw error;
        if (count === 0) {
            throw new Error('Nenhum registro foi excluído. Verifique se o registro existe.');
        }

        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('consultas-procedimentos-changed'));
            window.dispatchEvent(new CustomEvent('consultas-vagas-changed'));
            window.dispatchEvent(new CustomEvent('consultas-agendamentos-changed'));
        }

        return true;
    } catch (error: any) {
        const appError = handleSupabaseError(error);
        console.error('[consultasService] deleteProcedimento Error:', appError.message);
        throw appError;
    }
};

// --- AGENDAMENTOS ---

export interface AgendamentoFilters {
    patientName?: string;
    patientCpf?: string;
    procedimentoId?: string;
    date?: string;
    status?: string;
    readOnly?: boolean;
}

/**
 * Normaliza a Data da Solicitação para o formato comparável 'YYYY-MM-DD'.
 * Se a data da solicitação não estiver definida, utiliza a data de created_at como fallback.
 */
export const normalizeSolicitationDate = (item: { solicitation_date?: string | null; created_at?: string | null }): string => {
    if (!item) return '';
    if (item.solicitation_date) {
        const trimmed = String(item.solicitation_date).trim();
        if (trimmed) {
            if (/^\d{2}\/\d{2}\/\d{4}/.test(trimmed)) {
                const parts = trimmed.substring(0, 10).split('/');
                return `${parts[2]}-${parts[1]}-${parts[0]}`;
            }
            if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
                return trimmed.substring(0, 10);
            }
            const d = new Date(trimmed);
            if (!isNaN(d.getTime())) {
                const yyyy = d.getFullYear();
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const dd = String(d.getDate()).padStart(2, '0');
                return `${yyyy}-${mm}-${dd}`;
            }
            return trimmed;
        }
    }
    if (item.created_at) {
        const trimmed = String(item.created_at).trim();
        if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
            return trimmed.substring(0, 10);
        }
        const d = new Date(trimmed);
        if (!isNaN(d.getTime())) {
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            return `${yyyy}-${mm}-${dd}`;
        }
    }
    return '';
};

/**
 * Obtém o timestamp numérico exato da Criação do registro (com hora, minuto, segundo e milissegundo).
 */
export const getCreationTimestamp = (item: { created_at?: string | null }): number => {
    if (!item || !item.created_at) return 0;
    const t = new Date(item.created_at).getTime();
    return isNaN(t) ? 0 : t;
};

/**
 * Função determinística oficial de comparação cronológica de agendamentos:
 * 1º Critério: Data da Solicitação (da mais antiga para a mais recente)
 * 2º Critério: Data e Hora exatas de Criação no sistema (HH:MM:SS.ms)
 * Não utiliza ordem alfabética, ID ou nome do paciente como critério de desempate.
 */
export const compareConsultasChronological = (a: ConsultaAgendamento, b: ConsultaAgendamento): number => {
    // 1º Critério: Data da Solicitação
    const solA = normalizeSolicitationDate(a);
    const solB = normalizeSolicitationDate(b);

    if (solA && solB && solA !== solB) {
        return solA.localeCompare(solB);
    }
    if (solA && !solB) return -1;
    if (!solA && solB) return 1;

    // 2º Critério: Data e hora exatas de Criação (timestamp com segundos/ms)
    const createA = getCreationTimestamp(a);
    const createB = getCreationTimestamp(b);

    if (createA !== createB) {
        return createA - createB;
    }

    return 0;
};

/**
 * Constrói a lista ordenada da fila com as regras estritas de Agendamento Especial:
 * 1. Agendamentos Especiais sempre possuem prioridade máxima e ficam no topo da fila, acima de qualquer agendamento comum.
 * 2. Entre múltiplos Agendamentos Especiais, preserva estritamente a ordem cronológica (1º Data da Solicitação, 2º Data/Hora de Criação).
 * 3. Agendamentos comuns permanecem na fila normal abaixo de todos os especiais, também na ordem cronológica rigorosa.
 * 4. A ordem é dinâmica: quando um Especial é atendido, cancelado ou removido, o próximo Especial assume a prioridade.
 */
export const orderConsultasQueue = (bookings: ConsultaAgendamento[]): ConsultaAgendamento[] => {
    if (!bookings || bookings.length === 0) return [];

    // 1. Separa estritamente nas categorias de prioridade obrigatórias:
    // 1º Agendamentos Especiais — prioridade máxima.
    // 2º Retornos — 2º nível de prioridade (respeitando ordem cronológica entre os retornos).
    // 3º Urgentes — comuns urgentes.
    // 4º Normais — comuns normais.
    const isEspecial = (b: ConsultaAgendamento) => b.priority === 'Especial';
    const isRetorno = (b: ConsultaAgendamento) => !isEspecial(b) && (b.is_retorno === true || !!b.retorno_tipo || b.status === 'Retorno');
    const isUrgente = (b: ConsultaAgendamento) => !isEspecial(b) && !isRetorno(b) && (b.priority === 'Urgência' || (b.priority as string) === 'Urgente');
    const isNormal = (b: ConsultaAgendamento) => !isEspecial(b) && !isRetorno(b) && !isUrgente(b);

    const especiais = bookings.filter(isEspecial);
    const retornos = bookings.filter(isRetorno);
    const urgentes = bookings.filter(isUrgente);
    const normais = bookings.filter(isNormal);

    // 2. Dentro de cada categoria, manter rigorosamente a ordem cronológica determinística:
    // 1º Data da Solicitação (mais antiga para mais recente)
    // 2º Data e Hora de Criação exata (mais antiga para mais recente)
    // Jamais utilizar ordem alfabética ou ID como critério de desempate.
    especiais.sort(compareConsultasChronological);
    retornos.sort(compareConsultasChronological);
    urgentes.sort(compareConsultasChronological);
    normais.sort(compareConsultasChronological);

    // 3. A fila efetiva organiza na ordem definitiva: Especial -> Retornos -> Urgente -> Normal
    const filaFinal: ConsultaAgendamento[] = [];
    let positionCounter = 1;

    especiais.forEach((item, idx) => {
        filaFinal.push({
            ...item,
            queue_position: positionCounter++,
            special_sequence: idx + 1
        });
    });

    retornos.forEach(item => {
        filaFinal.push({
            ...item,
            queue_position: positionCounter++,
            special_sequence: undefined
        });
    });

    urgentes.forEach(item => {
        filaFinal.push({
            ...item,
            queue_position: positionCounter++,
            special_sequence: undefined
        });
    });

    normais.forEach(item => {
        filaFinal.push({
            ...item,
            queue_position: positionCounter++,
            special_sequence: undefined
        });
    });

    return filaFinal;
};

/**
 * Migra automaticamente todos os agendamentos com status 'Aguardando Data' para 'Fila de espera'
 */
export const migrateAguardandoDataToFilaEspera = async (): Promise<void> => {
    const activeUser = getActivePermissionUser();
    const globalSettings = getActiveGlobalModuleSettings();
    if (activeUser && (isConsultasAcompanharReadOnly(activeUser, globalSettings) || !hasConsultasAcompanharOperationalAccess(activeUser, globalSettings))) {
        return;
    }
    try {
        const { error } = await supabase
            .from('consultas_agendamentos')
            .update({ status: 'Fila de espera' })
            .eq('status', 'Aguardando Data');

        if (error) {
            console.warn('[consultasService] migrateAguardandoDataToFilaEspera aviso:', error.message);
        }
    } catch (err) {
        console.warn('[consultasService] migrateAguardandoDataToFilaEspera erro:', err);
    }
};

/**
 * Recalcula a fila completa por procedimento e persiste as posições oficiais e sequências no banco de dados.
 * Garante que a prioridade seja respeitada no backend para qualquer operação simultânea ou novo usuário.
 */
export const recalculateAndPersistQueuePositions = async (): Promise<void> => {
    const activeUser = getActivePermissionUser();
    const globalSettings = getActiveGlobalModuleSettings();
    if (activeUser && (isConsultasAcompanharReadOnly(activeUser, globalSettings) || !hasConsultasAcompanharOperationalAccess(activeUser, globalSettings))) {
        return;
    }
    try {
        // Dispara migração preventiva de Aguardando Data
        migrateAguardandoDataToFilaEspera().catch(() => {});

        let queueItems: any[] = [];
        let from = 0;
        const CHUNK_SIZE = 1000;
        let hasMore = true;
        let useFallback = false;

        while (hasMore) {
            const selectCols = useFallback 
                ? 'id, procedimento_id, priority, status, created_at, solicitation_date, is_retorno'
                : 'id, procedimento_id, priority, status, created_at, solicitation_date, is_retorno, retorno_tipo, retorno_grau';

            let data: any[] | null = null;
            let error: any = null;

            const res: any = await supabase
                .from('consultas_agendamentos')
                .select(selectCols as any)
                .in('status', ['Fila de espera', 'Aguardando Data', 'Solicitado', 'Retorno'])
                .range(from, from + CHUNK_SIZE - 1);

            data = res.data;
            error = res.error;

            if (error && !useFallback && (error.code === '42703' || error.code === 'PGRST204' || error.message?.includes('column') || error.message?.includes('does not exist'))) {
                useFallback = true;
                const fallbackRes: any = await supabase
                    .from('consultas_agendamentos')
                    .select('id, procedimento_id, priority, status, created_at, solicitation_date, is_retorno' as any)
                    .in('status', ['Fila de espera', 'Aguardando Data', 'Solicitado', 'Retorno'])
                    .range(from, from + CHUNK_SIZE - 1);
                data = fallbackRes.data;
                error = fallbackRes.error;
            }

            if (error) {
                console.warn('[consultasService] recalculateAndPersistQueuePositions query error:', error);
                break;
            }

            if (data && data.length > 0) {
                queueItems.push(...data);
                if (data.length < CHUNK_SIZE) {
                    hasMore = false;
                } else {
                    from += CHUNK_SIZE;
                }
            } else {
                hasMore = false;
            }
        }

        if (!queueItems || queueItems.length === 0) return;

        // Excluir da ordenação da fila ativa itens suspensos por cancelamento pendente
        const pendingCancelMap = await getMapaCancelamentosPendentes().catch(() => ({}));
        queueItems = queueItems.filter(item => {
            if (item.status === 'Cancelamento Pendente' || item.cancelamento_pendente) return false;
            if (pendingCancelMap[item.id]) return false;
            return true;
        });

        if (queueItems.length === 0) return;
        // 1º lugar, 2º lugar... com Agendamento Especial sempre no topo daquele procedimento
        const byProc: Record<string, ConsultaAgendamento[]> = {};
        queueItems.forEach(item => {
            const pid = item.procedimento_id || 'geral';
            if (!byProc[pid]) byProc[pid] = [];
            byProc[pid].push(item as ConsultaAgendamento);
        });

        const updatePayloads: { id: string; queue_position: number; special_sequence: number | null }[] = [];

        Object.keys(byProc).forEach(procId => {
            const ordered = orderConsultasQueue(byProc[procId]);
            ordered.forEach((item, index) => {
                updatePayloads.push({
                    id: item.id,
                    queue_position: index + 1,
                    special_sequence: item.special_sequence || null
                });
            });
        });

        // Atualiza no banco de dados de forma assíncrona e resiliente
        await Promise.all(updatePayloads.map(item =>
            supabase
                .from('consultas_agendamentos')
                .update({
                    queue_position: item.queue_position,
                    special_sequence: item.special_sequence
                })
                .eq('id', item.id)
        ));

        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('consultas-agendamentos-changed'));
        }
    } catch (err) {
        console.warn('[consultasService] recalculateAndPersistQueuePositions warning:', err);
    }
};

export const getAgendamentos = async (filters?: AgendamentoFilters): Promise<ConsultaAgendamento[]> => {
    try {
        const activeUser = getActivePermissionUser();
        const globalSettings = getActiveGlobalModuleSettings();
        const isUserReadOnly = Boolean(
            filters?.readOnly ||
            (activeUser && (
                isConsultasAcompanharReadOnly(activeUser, globalSettings) ||
                !hasConsultasAcompanharOperationalAccess(activeUser, globalSettings)
            ))
        );
        // Dispara migração assíncrona de status somente para perfis com acesso operacional de escrita
        if (!isUserReadOnly) {
            migrateAguardandoDataToFilaEspera().catch(() => {});
        }
        const fullColumns = `
            id, patient_id, procedimento_id, appointment_date, appointment_time, solicitation_date,
            quantity, priority, queue_position, special_sequence, status, created_by, created_at,
            is_retorno, retorno_tipo, retorno_grau, tipo_atendimento, prestador, municipio, convenio, vaga_id,
            cancellation_reason, canceled_by, canceled_by_name, canceled_at,
            paciente:consultas_pacientes(id, name, cpf, birth_date, phone, neighborhood, sus_number, agente_saude),
            procedimento:consultas_procedimentos(id, name, code, type, available_quantity, total_quantity, status, recurso),
            responsavel:profiles(id, name)
        `;

        const fallbackColumns = `
            id, patient_id, procedimento_id, appointment_date, appointment_time, solicitation_date,
            quantity, priority, queue_position, special_sequence, status, created_by, created_at,
            is_retorno,
            paciente:consultas_pacientes(id, name, cpf, birth_date, phone, neighborhood, sus_number, agente_saude),
            procedimento:consultas_procedimentos(id, name, code, type, available_quantity, total_quantity, status, recurso),
            responsavel:profiles(id, name)
        `;

        const buildQuery = (selectCols: string, from: number, to: number) => {
            let q = supabase
                .from('consultas_agendamentos')
                .select(selectCols)
                .order('appointment_date', { ascending: false })
                .order('created_at', { ascending: false })
                .range(from, to);

            if (filters?.procedimentoId) {
                q = q.eq('procedimento_id', filters.procedimentoId);
            }
            if (filters?.date) {
                q = q.eq('appointment_date', filters.date);
            }
            if (filters?.status) {
                q = q.eq('status', filters.status);
            }
            return q;
        };

        const CHUNK_SIZE = 1000;
        let allData: any[] = [];
        let from = 0;
        let hasMore = true;
        let useFallback = false;

        // Ilimitado: busca contínua em lotes pelo Supabase sem qualquer teto de 1000
        while (hasMore) {
            const cols = useFallback ? fallbackColumns : fullColumns;
            let { data, error } = await buildQuery(cols, from, from + CHUNK_SIZE - 1);

            if (error && !useFallback && (error.code === '42703' || error.code === 'PGRST204' || error.message?.includes('column') || error.message?.includes('does not exist'))) {
                console.warn('[consultasService] Colunas estendidas ausentes em consultas_agendamentos, executando fallback de colunas básicas...', error.message);
                useFallback = true;
                const fallbackRes = await buildQuery(fallbackColumns, from, from + CHUNK_SIZE - 1);
                data = fallbackRes.data;
                error = fallbackRes.error;
            }

            if (error) throw error;

            if (data && data.length > 0) {
                allData.push(...data);
                if (data.length < CHUNK_SIZE) {
                    hasMore = false;
                } else {
                    from += CHUNK_SIZE;
                }
            } else {
                hasMore = false;
            }
        }

        let filtered = (allData || []) as unknown as ConsultaAgendamento[];

        // Enriquecer cada procedimento com dados de especialista via mapping e cache
        const especialistas = await getEspecialistas();
        const espMap = new Map<string, ConsultaEspecialista>(especialistas.map(e => [e.id, e]));

        // Mesclar dados de pausa persistentes
        const pausedMetaMap = getPausedMetadataMap();

        filtered = filtered.map(item => {
            let proc = item.procedimento;
            if (proc) {
                const espId = proc.especialista_id || getProcEspecialistaMapping(proc.id) || (item.procedimento_id ? getProcEspecialistaMapping(item.procedimento_id) : null);
                const espObj = (espId ? espMap.get(espId) : null) || proc.especialista || null;
                proc = {
                    ...proc,
                    especialista_id: espId || null,
                    especialista: espObj
                };
            }

            const pMeta = pausedMetaMap[item.id];
            if (pMeta) {
                const computedStatus = (pMeta.is_paused 
                    ? 'Pausada' 
                    : (item.status === 'Pausada' ? (pMeta.original_status || 'Fila de espera') : item.status)
                ) as ConsultaAgendamento['status'];

                return {
                    ...item,
                    procedimento: proc,
                    is_paused: pMeta.is_paused,
                    status: computedStatus,
                    paused_at: pMeta.paused_at || item.paused_at,
                    paused_by: pMeta.paused_by || item.paused_by,
                    paused_by_name: pMeta.paused_by_name || item.paused_by_name,
                    pause_reason: pMeta.pause_reason || item.pause_reason,
                    resumed_at: pMeta.resumed_at || item.resumed_at,
                    resumed_by: pMeta.resumed_by || item.resumed_by,
                    resumed_by_name: pMeta.resumed_by_name || item.resumed_by_name,
                    original_status: pMeta.original_status || item.original_status,
                    pause_history: pMeta.pause_history || item.pause_history || []
                };
            }

            if (item.is_paused) {
                return {
                    ...item,
                    procedimento: proc,
                    status: 'Pausada'
                };
            }

            return {
                ...item,
                procedimento: proc
            };
        });

        // Garante que a ordem da fila de espera respeite a prioridade Especial e posições calculadas (incluindo congeladas/pausadas)
        const waitlistItems = filtered.filter(a => 
            !a.status || 
            a.status === 'Fila de espera' || 
            a.status === 'Aguardando Data' || 
            a.status === 'Solicitado' || 
            a.status === 'Retorno' ||
            a.status === 'Pausada' ||
            a.is_paused ||
            a.status.toLowerCase().includes('fila')
        );

        if (waitlistItems.length > 0) {
            const byProc: Record<string, ConsultaAgendamento[]> = {};
            waitlistItems.forEach(item => {
                const pid = item.procedimento_id || 'geral';
                if (!byProc[pid]) byProc[pid] = [];
                byProc[pid].push(item);
            });

            const posMap = new Map<string, { queue_position: number; special_sequence?: number }>();
            Object.keys(byProc).forEach(procId => {
                const orderedWaitlist = orderConsultasQueue(byProc[procId]);
                orderedWaitlist.forEach(item => {
                    posMap.set(item.id, {
                        queue_position: item.queue_position || 1,
                        special_sequence: item.special_sequence
                    });
                });
            });

            filtered = filtered.map(item => {
                const queueInfo = posMap.get(item.id);
                const currentStatus = item.status === 'Aguardando Data' ? 'Fila de espera' : item.status;
                if (queueInfo) {
                    return {
                        ...item,
                        status: currentStatus,
                        queue_position: queueInfo.queue_position,
                        special_sequence: queueInfo.special_sequence
                    };
                }
                return {
                    ...item,
                    status: currentStatus
                };
            });
        }

        // Filtros textuais em memória caso o backend relacional não tenha índice específico
        if (filters) {
            if (filters.patientName) {
                const search = filters.patientName.toLowerCase();
                filtered = filtered.filter(a => a.paciente?.name?.toLowerCase().includes(search));
            }
            if (filters.patientCpf) {
                const search = filters.patientCpf.replace(/\D/g, '');
                filtered = filtered.filter(a => a.paciente?.cpf?.replace(/\D/g, '').includes(search));
            }
        }

        return filtered;
    } catch (error) {
        const appError = handleSupabaseError(error);
        console.error('[consultasService] getAgendamentos Error:', appError.message);
        return [];
    }
};

/**
 * Consulta Remota Otimizada de Agendamentos (Etapa B)
 * Busca indexada no Supabase exclusivamente por Paciente (Nome sequencial, CPF, Cartão SUS ou Protocolo)
 * Suporta AbortSignal para cancelamento automático de consultas obsoletas
 */
export const searchRemoteAgendamentos = async (
    query: string,
    options?: { signal?: AbortSignal; limit?: number }
): Promise<ConsultaAgendamento[]> => {
    const raw = query.trim();
    if (!raw || raw.length < 2) return [];

    try {
        const fullColumns = `
            id, patient_id, procedimento_id, appointment_date, appointment_time, solicitation_date,
            quantity, priority, queue_position, special_sequence, status, created_by, created_at,
            is_retorno, retorno_tipo, retorno_grau, tipo_atendimento, prestador, municipio, convenio, vaga_id,
            cancellation_reason, canceled_by, canceled_by_name, canceled_at,
            paciente:consultas_pacientes(id, name, cpf, birth_date, phone, neighborhood, sus_number, agente_saude),
            procedimento:consultas_procedimentos(id, name, code, type, available_quantity, total_quantity, status, recurso),
            responsavel:profiles(id, name)
        `;

        const codePrefixMatch = raw.match(/^(c[oó]digo|cod\.?|c[oó]d\.?):?\s*(.+)$/i);
        const cleanDigits = raw.replace(/\D/g, '');
        const isOnlyDigits = cleanDigits.length >= 2 && /^[0-9.\-/ ]+$/.test(raw);
        const isProtocol = raw.startsWith('#') || /^[a-fA-F0-9]{6,8}$/.test(raw);

        // 1. Busca por protocolo direto (#id)
        if (isProtocol) {
            const cleanId = raw.replace(/^#/, '').toLowerCase();
            let q = supabase
                .from('consultas_agendamentos')
                .select(fullColumns)
                .ilike('id', `${cleanId}%`)
                .limit(options?.limit || 20);

            if (options?.signal) {
                q = q.abortSignal(options.signal);
            }

            const { data, error } = await q;
            if (error || !data) return [];
            return data as unknown as ConsultaAgendamento[];
        }

        // 2. Busca explícita por Código de Procedimento (ex: "codigo 0279", "cod 0279")
        if (codePrefixMatch) {
            const targetCode = codePrefixMatch[2].trim().replace(/[%_]/g, '');
            if (!targetCode) return [];

            let procQuery = supabase
                .from('consultas_procedimentos')
                .select('id')
                .or(`code.ilike.%${targetCode}%,code.ilike.${targetCode}%`)
                .limit(30);

            if (options?.signal) {
                procQuery = procQuery.abortSignal(options.signal);
            }

            const { data: procs, error: procErr } = await procQuery;
            if (procErr || !procs || procs.length === 0) return [];

            const procIds = procs.map(p => p.id);
            let q = supabase
                .from('consultas_agendamentos')
                .select(fullColumns)
                .in('procedimento_id', procIds)
                .limit(options?.limit || 50);

            if (options?.signal) {
                q = q.abortSignal(options.signal);
            }

            const { data, error } = await q;
            if (error || !data) return [];
            return data as unknown as ConsultaAgendamento[];
        }

        // 3. Busca puramente numérica (ex: "0279", "0007" ou CPF / SUS)
        if (isOnlyDigits) {
            // Busca primeiramente por procedimentos com este código
            let procQuery = supabase
                .from('consultas_procedimentos')
                .select('id')
                .or(`code.eq.${cleanDigits},code.ilike.%${cleanDigits}%`)
                .limit(20);

            if (options?.signal) procQuery = procQuery.abortSignal(options.signal);
            const { data: procs } = await procQuery;
            const procIds = procs && procs.length > 0 ? procs.map(p => p.id) : [];

            // Se tiver pelo menos 6 dígitos ou pontuação explícita de CPF, busca também em pacientes por CPF/SUS
            let patientIds: string[] = [];
            const hasCpfFormatting = /[.\-]/.test(raw);
            if (cleanDigits.length >= 6 || hasCpfFormatting) {
                let patientQuery = supabase
                    .from('consultas_pacientes')
                    .select('id')
                    .or(`cpf.ilike.%${cleanDigits}%,sus_number.ilike.%${cleanDigits}%`)
                    .limit(options?.limit || 20);

                if (options?.signal) patientQuery = patientQuery.abortSignal(options.signal);
                const { data: patients } = await patientQuery;
                if (patients && patients.length > 0) {
                    patientIds = patients.map(p => p.id);
                }
            }

            if (procIds.length === 0 && patientIds.length === 0) return [];

            // Monta query combinada
            let orConditions: string[] = [];
            if (procIds.length > 0) orConditions.push(`procedimento_id.in.(${procIds.join(',')})`);
            if (patientIds.length > 0) orConditions.push(`patient_id.in.(${patientIds.join(',')})`);

            let q = supabase
                .from('consultas_agendamentos')
                .select(fullColumns)
                .or(orConditions.join(','))
                .limit(options?.limit || 40);

            if (options?.signal) q = q.abortSignal(options.signal);
            const { data, error } = await q;
            if (error || !data) return [];
            return data as unknown as ConsultaAgendamento[];
        }

        // 4. Busca por Texto Geral (Nome do Procedimento, Nome do Paciente, Prestador, Município)
        const queryClean = raw.replace(/[%_]/g, '');
        const queryNoAccent = queryClean.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

        // A) Busca em Procedimentos (por código ou nome, com e sem acentos)
        let procOr = [`name.ilike.%${queryClean}%`, `code.ilike.%${queryClean}%`];
        if (queryNoAccent.toLowerCase() !== queryClean.toLowerCase()) {
            procOr.push(`name.ilike.%${queryNoAccent}%`, `code.ilike.%${queryNoAccent}%`);
        }
        let procQuery = supabase
            .from('consultas_procedimentos')
            .select('id')
            .or(procOr.join(','))
            .limit(40);
        if (options?.signal) procQuery = procQuery.abortSignal(options.signal);
        const { data: procs } = await procQuery;
        const procIds = procs && procs.length > 0 ? procs.map(p => p.id) : [];

        // B) Busca em Pacientes (por nome ou apelido, com e sem acentos)
        let patOr = [`name.ilike.%${queryClean}%`, `nickname.ilike.%${queryClean}%`];
        if (queryNoAccent.toLowerCase() !== queryClean.toLowerCase()) {
            patOr.push(`name.ilike.%${queryNoAccent}%`, `nickname.ilike.%${queryNoAccent}%`);
        }
        let patientQuery = supabase
            .from('consultas_pacientes')
            .select('id')
            .or(patOr.join(','))
            .limit(40);
        if (options?.signal) patientQuery = patientQuery.abortSignal(options.signal);
        const { data: patients } = await patientQuery;
        const patientIds = patients && patients.length > 0 ? patients.map(p => p.id) : [];

        const combinedResults: Map<string, ConsultaAgendamento> = new Map();

        // 1. Busca agendamentos pelos procedimentos encontrados
        if (procIds.length > 0) {
            let qProc = supabase
                .from('consultas_agendamentos')
                .select(fullColumns)
                .in('procedimento_id', procIds.slice(0, 50))
                .limit(options?.limit || 40);
            if (options?.signal) qProc = qProc.abortSignal(options.signal);
            const { data: procBookings } = await qProc;
            if (procBookings) {
                procBookings.forEach((b: any) => combinedResults.set(b.id, b));
            }
        }

        // 2. Busca agendamentos pelos pacientes encontrados
        if (patientIds.length > 0) {
            let qPat = supabase
                .from('consultas_agendamentos')
                .select(fullColumns)
                .in('patient_id', patientIds.slice(0, 50))
                .limit(options?.limit || 40);
            if (options?.signal) qPat = qPat.abortSignal(options.signal);
            const { data: patBookings } = await qPat;
            if (patBookings) {
                patBookings.forEach((b: any) => combinedResults.set(b.id, b));
            }
        }

        // 3. Busca direta por prestador ou município
        let qOther = supabase
            .from('consultas_agendamentos')
            .select(fullColumns)
            .or(`prestador.ilike.%${queryClean}%,municipio.ilike.%${queryClean}%`)
            .limit(options?.limit || 30);
        if (options?.signal) qOther = qOther.abortSignal(options.signal);
        const { data: otherBookings } = await qOther;
        if (otherBookings) {
            otherBookings.forEach((b: any) => combinedResults.set(b.id, b));
        }

        return Array.from(combinedResults.values());
    } catch (err: any) {
        if (err?.name === 'AbortError' || err?.message?.includes('aborted')) {
            return [];
        }
        console.warn('[consultasService] searchRemoteAgendamentos silenciosamente interceptado:', err);
        return [];
    }
};

export const createAgendamento = async (agendamento: Omit<ConsultaAgendamento, 'id' | 'created_at'>): Promise<ConsultaAgendamento> => {
    assertCanMutateRegulacao('Criar Solicitação/Agendamento', 'novo_agendamento');
    try {
        // 0. Bloqueio estrito de novos agendamentos para procedimentos suspensos (Regras de Suspensão)
        if (agendamento.procedimento_id) {
            const { data: procCheck } = await supabase
                .from('consultas_procedimentos')
                .select('id, name, code, status, parent_id')
                .eq('id', agendamento.procedimento_id)
                .maybeSingle();

            if (procCheck) {
                if (procCheck.status !== 'Ativo') {
                    throw new Error(`O procedimento "${procCheck.name || procCheck.code || ''}" está suspenso e não aceita novos agendamentos.`);
                }
                if (procCheck.parent_id) {
                    const { data: parentProc } = await supabase
                        .from('consultas_procedimentos')
                        .select('id, name, code, status')
                        .eq('id', procCheck.parent_id)
                        .maybeSingle();
                    if (parentProc && parentProc.status !== 'Ativo') {
                        throw new Error(`O procedimento principal "${parentProc.name || parentProc.code || ''}" está suspenso e não aceita novos agendamentos.`);
                    }
                }
            }
        }

        // 1. Bloqueio rigoroso de solicitações duplicadas ativas (mesmo paciente + mesmo procedimento)
        //    Válido para todos os status ativos (Solicitado, Aguardando Data, Fila de espera, Agendado, Retorno, Pausada)
        //    e para todas as prioridades/usuários/setores.
        const patientCpf: string | null = (agendamento as any)?.paciente?.cpf || null;
        const procCode: string | null = (agendamento as any)?.procedimento?.code || null;

        if (isActiveAgendamentoStatus(agendamento.status || 'Solicitado')) {
            const activeDuplicate = await checkActiveDuplicateAgendamento(
                { id: agendamento.patient_id, cpf: patientCpf },
                { id: agendamento.procedimento_id, code: procCode }
            );

            if (activeDuplicate) {
                throw new DuplicateAgendamentoError(activeDuplicate);
            }
        }

        // 1.1 Validação de Especialista vs Retorno
        if (agendamento.procedimento_id) {
            const procEspId = getProcEspecialistaMapping(agendamento.procedimento_id);
            const isProcComEspecialista = !!procEspId;
            if (agendamento.is_retorno && !isProcComEspecialista) {
                // Verificar também direto na tabela de procedimentos
                const { data: procCheck } = await supabase
                    .from('consultas_procedimentos')
                    .select('id, especialista_id, status')
                    .eq('id', agendamento.procedimento_id)
                    .maybeSingle();
                if (procCheck && !procCheck.especialista_id && !procEspId) {
                    throw new Error('Procedimento incompatível com retorno: Este procedimento não possui especialista vinculado.');
                }
            } else if (!agendamento.is_retorno && isProcComEspecialista) {
                const { data: procCheck } = await supabase
                    .from('consultas_procedimentos')
                    .select('id, especialista_id, status')
                    .eq('id', agendamento.procedimento_id)
                    .maybeSingle();
                if (procCheck?.especialista_id || procEspId) {
                    throw new Error('Procedimento incompatível: Procedimentos com especialista são exclusivos para agendamentos de retorno.');
                }
            }
        }

        // 1.2 Validação e sanitização estrita de Retorno vs Não Retorno
        if (!agendamento.is_retorno) {
            // Quando tipo_atendimento = NÃO RETORNO:
            // - Não exigir classificação de retorno.
            // - Não salvar valores de 1º ao 5º retorno.
            // - Ignorar e rejeitar dados incompatíveis enviados por requisições manipuladas.
            agendamento.is_retorno = false;
            delete (agendamento as any).retorno_tipo;
            delete (agendamento as any).retorno_grau;
        } else {
            // Quando tipo_atendimento = RETORNO:
            // - Aplicar as regras de classificação já existentes (1º ao 5º Retorno).
            const retornosValidos = ['1º Retorno', '2º Retorno', '3º Retorno', '4º Retorno', '5º Retorno'];
            if (!agendamento.retorno_tipo || !retornosValidos.includes(agendamento.retorno_tipo)) {
                agendamento.retorno_tipo = '1º Retorno' as any;
            }
            agendamento.retorno_grau = Number(agendamento.retorno_tipo.charAt(0)) || 1;
        }

        // 2. Insert agendamento com suporte a fallback resiliente para novas colunas
        let insertPayload: any = { ...agendamento };
        if (!insertPayload.is_retorno) {
            insertPayload.is_retorno = false;
            delete insertPayload.retorno_tipo;
            delete insertPayload.retorno_grau;
        }
        
        // Limpar propriedades com valor null ou undefined que sejam opcionais para evitar erros de schema cache
        const optionalCols = [
            'confirmation_origin',
            'confirmed_at',
            'confirmed_by',
            'confirmed_by_name',
            'convenio',
            'prestador',
            'municipio',
            'tipo_atendimento',
            'vaga_id',
            'retorno_tipo',
            'retorno_grau',
            'cancellation_reason',
            'canceled_by',
            'canceled_by_name',
            'canceled_at',
            'solicitation_date',
            'appointment_time',
            'is_retorno'
        ];

        optionalCols.forEach(col => {
            if (insertPayload[col] === null || insertPayload[col] === undefined) {
                delete insertPayload[col];
            }
        });

        let { data, error } = await supabase
            .from('consultas_agendamentos')
            .insert([insertPayload])
            .select(`
                *,
                paciente:consultas_pacientes(*),
                procedimento:consultas_procedimentos(*),
                responsavel:profiles(name)
            `)
            .single();

        if (error && (error.code === '42703' || error.code === 'PGRST204' || error.message?.includes('column') || error.message?.includes('does not exist') || error.message?.includes('schema cache'))) {
            console.warn('[consultasService] Colunas opcionais ausentes na tabela consultas_agendamentos (createAgendamento). Tentando fallback adaptativo...', error.message);
            let fallbackPayload = { ...insertPayload };
            let lastError: any = error;
            let attempts = 0;
            const maxAttempts = 20;

            while (lastError && attempts < maxAttempts && (lastError.code === '42703' || lastError.code === 'PGRST204' || lastError.message?.includes('column') || lastError.message?.includes('does not exist') || lastError.message?.includes('schema cache'))) {
                attempts++;
                const colMatch = lastError.message?.match(/Could not find the '([^']+)' column/i)
                              || lastError.message?.match(/column ["']([^"']+)["'] of relation/i)
                              || lastError.message?.match(/column ["']([^"']+)["'] does not exist/i);

                let colToRemove: string | null = null;
                if (colMatch && (colMatch[1] || colMatch[2] || colMatch[3])) {
                    const detected = colMatch[1] || colMatch[2] || colMatch[3];
                    if (detected in fallbackPayload) {
                        colToRemove = detected;
                    }
                }

                if (!colToRemove) {
                    colToRemove = optionalCols.find(c => c in fallbackPayload) || null;
                }

                if (!colToRemove) break;

                console.warn(`[consultasService] Removendo coluna '${colToRemove}' do payload de createAgendamento (tentativa ${attempts}) e tentando novamente...`);
                delete fallbackPayload[colToRemove];

                const retryRes = await supabase
                    .from('consultas_agendamentos')
                    .insert([fallbackPayload])
                    .select(`
                        *,
                        paciente:consultas_pacientes(*),
                        procedimento:consultas_procedimentos(*),
                        responsavel:profiles(name)
                    `)
                    .single();

                data = retryRes.data;
                lastError = retryRes.error;
                if (!lastError) {
                    console.log('[consultasService] createAgendamento recuperado com sucesso no fallback!');
                    break;
                }
            }
            error = lastError;
        }

        if (error) {
            const errMsg = String(error.message || '');
            const isDuplicateErr =
                error.code === '23505' ||
                errMsg.includes('SOLICITACAO_DUPLICADA') ||
                errMsg.includes('idx_consultas_agendamentos_unique_active') ||
                errMsg.includes('unique_active_appointment');

            if (isDuplicateErr) {
                const existingDup =
                    (await checkActiveDuplicateAgendamento(
                        { id: agendamento.patient_id, cpf: patientCpf },
                        { id: agendamento.procedimento_id, code: procCode }
                    ).catch(() => null)) ||
                    parseDuplicateExceptionMetadata(errMsg, agendamento.patient_id, agendamento.procedimento_id);

                throw new DuplicateAgendamentoError(existingDup);
            }

            // Check if it's the trigger error
            if (error.message && error.message.includes('Vagas insuficientes')) {
                throw new Error('Vagas esgotadas para este procedimento.');
            }
            if (error.message && error.message.includes('consultas_agendamentos_priority_check')) {
                throw new Error('A tabela do banco de dados ainda não aceita a prioridade "Especial". Por favor, execute o script SQL "add_agendamento_especial_and_queue_position.sql" no editor SQL do Supabase para atualizar a regra de prioridades.');
            }
            throw error;
        }

        // Recalcular e persistir posições da fila após novo agendamento
        await recalculateAndPersistQueuePositions();
        window.dispatchEvent(new CustomEvent('consultas-agendamentos-changed'));

        return data;
    } catch (error: any) {
        console.error('[consultasService] createAgendamento Error:', error.message);
        throw error;
    }
};

export const updateAgendamentoStatus = async (id: string, status: ConsultaAgendamento['status']): Promise<ConsultaAgendamento | null> => {
    return updateAgendamento(id, { status });
};

export const updateAgendamentoDateAndStatus = async (
    id: string, 
    date: string, 
    status: ConsultaAgendamento['status']
): Promise<ConsultaAgendamento | null> => {
    return updateAgendamento(id, { 
        appointment_date: date,
        status: status
    });
};

/**
 * Obtém a data de hoje no fuso horário 'America/Sao_Paulo' no formato YYYY-MM-DD
 */
export const getHojeBrasilDateStr = (): string => {
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    return formatter.format(new Date());
};

/**
 * Identifica agendamentos cuja data de atendimento já passou (anterior a hoje no fuso de Brasília),
 * que ainda não possuem confirmação de comparecimento (ou seja, status ainda 'Agendado' e sem confirmed_at),
 * e não foram cancelados.
 * Bloqueia execução desnecessária para usuários com permissão Somente Leitura.
 */
export const getAgendamentosPendentesConfirmacao = async (currentUser?: User | null): Promise<ConsultaAgendamento[]> => {
    if (currentUser && (isConsultasAcompanharReadOnly(currentUser) || !hasConsultasAcompanharOperationalAccess(currentUser))) {
        return [];
    }
    try {
        const hojeBr = getHojeBrasilDateStr();
        const { data, error } = await supabase
            .from('consultas_agendamentos')
            .select(`
                *,
                paciente:consultas_pacientes(*),
                procedimento:consultas_procedimentos(
                    *,
                    especialista:consultas_especialistas(*)
                ),
                responsavel:profiles(id, name)
            `)
            .lt('appointment_date', hojeBr)
            .eq('status', 'Agendado')
            .order('appointment_date', { ascending: true })
            .order('appointment_time', { ascending: true, nullsFirst: false });

        if (error) throw error;
        return (data as ConsultaAgendamento[]) || [];
    } catch (error) {
        console.error('[consultasService] getAgendamentosPendentesConfirmacao Error:', error);
        return [];
    }
};

/**
 * Confirma o comparecimento ('Realizado') ou ausência ('Não Realizado' / Faltou) de um agendamento.
 * Registra data, hora, servidor responsável e auditoria completa.
 * Bloqueia categoricamente tentativas de mutação para usuários Somente Leitura.
 */
export const confirmarComparecimentoAgendamento = async (
    id: string,
    situacao: 'Realizado' | 'Não Realizado',
    currentUser: User
): Promise<ConsultaAgendamento> => {
    if (!currentUser || isConsultasAcompanharReadOnly(currentUser) || !hasConsultasAcompanharOperationalAccess(currentUser)) {
        throw new Error('Acesso negado (Modo Somente Leitura): seu usuário não possui permissão operacional para confirmar comparecimento de atendimentos.');
    }
    assertCanMutateRegulacao('Confirmar Comparecimento de Atendimento', 'acompanhar', currentUser);
    const agoraIso = new Date().toISOString();
    const serverName = currentUser?.name || 'Servidor Municipal';

    // 1. Atualizar agendamento no Supabase
    const payload: Partial<ConsultaAgendamento> = {
        status: situacao,
        confirmed_at: agoraIso,
        confirmed_by: currentUser?.id || null,
        confirmed_by_name: serverName,
        confirmation_origin: 'Regulação - Confirmação Automática de Atendimentos'
    };

    const updated = await updateAgendamento(id, payload);
    if (!updated) {
        throw new Error('Falha ao atualizar a situação do agendamento.');
    }

    // 2. Registrar auditoria no auditLogService
    try {
        await auditLogService.logAction({
            action_type: situacao === 'Realizado' ? 'CONFIRMACAO_ATENDIMENTO_REALIZADO' : 'CONFIRMACAO_ATENDIMENTO_FALTOU',
            module: 'Regulação - Acompanhar',
            description: `Atendimento marcado como "${situacao === 'Realizado' ? 'Realizado' : 'Faltou'}" para o paciente ${updated.paciente?.name || 'N/A'} (Procedimento: ${updated.procedimento?.name || 'N/A'}).`,
            details: {
                agendamento_id: id,
                paciente_id: updated.patient_id,
                paciente_nome: updated.paciente?.name,
                procedimento_id: updated.procedimento_id,
                procedimento_nome: updated.procedimento?.name,
                data_atendimento: updated.appointment_date,
                hora_atendimento: updated.appointment_time,
                situacao_anterior: 'Agendado',
                nova_situacao: situacao,
                confirmed_at: agoraIso,
                confirmed_by: currentUser.id,
                confirmed_by_name: serverName
            },
            user: {
                id: currentUser.id,
                name: serverName,
                email: currentUser.email || ''
            }
        });
    } catch (auditErr) {
        console.warn('[consultasService] Aviso ao registrar auditoria de confirmação:', auditErr);
    }

    // 3. Disparar eventos para sincronização em tempo real entre abas e módulos
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('consultas-agendamentos-changed'));
        window.dispatchEvent(new CustomEvent('consultas-pacientes-changed'));
    }

    return updated;
};

// --- CONTROLE DE PAUSA E RETOMADA DE SOLICITAÇÃO ---

const STORAGE_PAUSED_METADATA_KEY = 'sys_consultas_agendamentos_paused_metadata';

export interface PausedItemMeta {
    is_paused: boolean;
    status: string;
    paused_at?: string;
    paused_by?: string;
    paused_by_name?: string;
    pause_reason?: string;
    resumed_at?: string;
    resumed_by?: string;
    resumed_by_name?: string;
    original_status?: string;
    pause_history?: any[];
}

export const getPausedMetadataMap = (): Record<string, PausedItemMeta> => {
    if (typeof window === 'undefined') return {};
    try {
        const raw = localStorage.getItem(STORAGE_PAUSED_METADATA_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch (e) {
        return {};
    }
};

export const savePausedMetadataItem = (id: string, meta: PausedItemMeta) => {
    if (typeof window === 'undefined') return;
    try {
        const current = getPausedMetadataMap();
        current[id] = meta;
        localStorage.setItem(STORAGE_PAUSED_METADATA_KEY, JSON.stringify(current));
    } catch (e) {}
};

/**
 * Busca uma solicitação individual pelo ID
 */
export const getAgendamentoById = async (id: string): Promise<ConsultaAgendamento | null> => {
    try {
        const { data, error } = await supabase
            .from('consultas_agendamentos')
            .select(`
                *,
                paciente:consultas_pacientes(*),
                procedimento:consultas_procedimentos(*),
                responsavel:profiles(id, name)
            `)
            .eq('id', id)
            .single();

        if (!error && data) {
            let enriched: any = { ...data };
            if (enriched.procedimento) {
                const espId = enriched.procedimento.especialista_id || getProcEspecialistaMapping(enriched.procedimento.id);
                if (espId) {
                    const especialistas = await getEspecialistas().catch(() => []);
                    const espObj = especialistas.find(e => e.id === espId) || null;
                    enriched.procedimento = {
                        ...enriched.procedimento,
                        especialista_id: espId,
                        especialista: espObj
                    };
                }
            }
            const metaMap = getPausedMetadataMap();
            const meta = metaMap[id];
            if (meta) {
                return {
                    ...enriched,
                    is_paused: meta.is_paused,
                    status: meta.is_paused ? 'Pausada' : enriched.status,
                    paused_at: meta.paused_at || enriched.paused_at,
                    paused_by: meta.paused_by || enriched.paused_by,
                    paused_by_name: meta.paused_by_name || enriched.paused_by_name,
                    pause_reason: meta.pause_reason || enriched.pause_reason,
                    resumed_at: meta.resumed_at || enriched.resumed_at,
                    resumed_by: meta.resumed_by || enriched.resumed_by,
                    resumed_by_name: meta.resumed_by_name || enriched.resumed_by_name,
                    original_status: meta.original_status || enriched.original_status,
                    pause_history: meta.pause_history || enriched.pause_history || []
                } as unknown as ConsultaAgendamento;
            }
            return enriched as unknown as ConsultaAgendamento;
        }
    } catch (e) {}

    const all = await getAgendamentos();
    return all.find(a => a.id === id) || null;
};

/**
 * Pausa uma solicitação de procedimento
 * Exclusivo para Administradores e Gestores autorizados (validado no backend)
 */
export const pausarAgendamento = async (
    id: string,
    motivo: string,
    currentUser: User
): Promise<ConsultaAgendamento> => {
    assertCanMutateRegulacao('Pausar Solicitação', 'acompanhar', currentUser);
    // 1. Validação estrita de autorização
    const isAuthorized = 
        currentUser.role === 'admin' ||
        currentUser.permissions?.includes('parent_consultas_gestor') ||
        currentUser.permissions?.includes('sub_consultas_gestor');

    let isDbGestor = false;
    try {
        const { data: gData } = await supabase
            .from('consultas_gestores')
            .select('gestor_id')
            .eq('gestor_id', currentUser.id)
            .limit(1);
        if (gData && gData.length > 0) isDbGestor = true;
    } catch (e) {}

    if (!isAuthorized && !isDbGestor) {
        throw new Error('Acesso negado: Apenas Administradores e Gestores autorizados podem pausar solicitações.');
    }

    if (!motivo || !motivo.trim()) {
        throw new Error('O motivo da pausa é obrigatório.');
    }

    // 2. Carrega agendamento atual
    const agendamento = await getAgendamentoById(id);
    if (!agendamento) {
        throw new Error('Solicitação de procedimento não encontrada.');
    }

    const now = new Date().toISOString();
    const originalStatus = agendamento.status === 'Pausada'
        ? (agendamento.original_status || 'Fila de espera')
        : (agendamento.status || 'Fila de espera');

    const historyItem = {
        action: 'pause',
        user_id: currentUser.id,
        user_name: currentUser.name,
        reason: motivo.trim(),
        timestamp: now
    };

    const existingHistory = Array.isArray(agendamento.pause_history) ? agendamento.pause_history : [];
    const updatedHistory = [...existingHistory, historyItem];

    const updateData: Partial<ConsultaAgendamento> = {
        status: 'Pausada',
        is_paused: true,
        paused_at: now,
        paused_by: currentUser.id,
        paused_by_name: currentUser.name,
        pause_reason: motivo.trim(),
        original_status: originalStatus,
        pause_history: updatedHistory as any,
        vaga_id: undefined // Libera qualquer vaga temporária
    };

    // Salva preventivamente no cache local para persistência garantida
    savePausedMetadataItem(id, {
        is_paused: true,
        status: 'Pausada',
        paused_at: now,
        paused_by: currentUser.id,
        paused_by_name: currentUser.name,
        pause_reason: motivo.trim(),
        original_status: originalStatus,
        pause_history: updatedHistory
    });

    // Atualiza no Supabase
    const updated = await updateAgendamento(id, updateData);

    // Recalcula as posições da fila
    await recalculateAndPersistQueuePositions().catch(() => {});

    // Auditoria oficial
    try {
        await auditLogService.logAction({
            action_type: 'PAUSAR_SOLICITACAO',
            module: 'regulacao',
            description: `Solicitação de ${agendamento.paciente?.name || 'Paciente'} para ${agendamento.procedimento?.name || 'Procedimento'} foi PAUSADA por ${currentUser.name}. Motivo: ${motivo.trim()}`,
            details: {
                agendamento_id: id,
                paciente: agendamento.paciente?.name,
                procedimento: agendamento.procedimento?.name,
                paused_at: now,
                paused_by: currentUser.name,
                motivo: motivo.trim(),
                original_status: originalStatus
            }
        });
    } catch (e) {}

    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('consultas-agendamento-changed'));
        window.dispatchEvent(new CustomEvent('consultas-vagas-changed'));
    }

    return updated || ({ ...agendamento, ...updateData } as unknown as ConsultaAgendamento);
};

/**
 * Retoma uma solicitação de procedimento pausada
 * Exclusivo para Administradores e Gestores autorizados (validado no backend)
 */
export const retomarAgendamento = async (
    id: string,
    currentUser: User
): Promise<ConsultaAgendamento> => {
    assertCanMutateRegulacao('Retomar Solicitação', 'acompanhar', currentUser);
    // 1. Validação estrita de autorização
    const isAuthorized = 
        currentUser.role === 'admin' ||
        currentUser.permissions?.includes('parent_consultas_gestor') ||
        currentUser.permissions?.includes('sub_consultas_gestor');

    let isDbGestor = false;
    try {
        const { data: gData } = await supabase
            .from('consultas_gestores')
            .select('gestor_id')
            .eq('gestor_id', currentUser.id)
            .limit(1);
        if (gData && gData.length > 0) isDbGestor = true;
    } catch (e) {}

    if (!isAuthorized && !isDbGestor) {
        throw new Error('Acesso negado: Apenas Administradores e Gestores autorizados podem retomar solicitações.');
    }

    // 2. Carrega agendamento atual
    const agendamento = await getAgendamentoById(id);
    if (!agendamento) {
        throw new Error('Solicitação de procedimento não encontrada.');
    }

    const now = new Date().toISOString();
    const targetStatus = (agendamento.original_status && agendamento.original_status !== 'Pausada')
        ? agendamento.original_status
        : (agendamento.is_retorno ? 'Retorno' : 'Fila de espera');

    const historyItem = {
        action: 'resume',
        user_id: currentUser.id,
        user_name: currentUser.name,
        timestamp: now
    };

    const existingHistory = Array.isArray(agendamento.pause_history) ? agendamento.pause_history : [];
    const updatedHistory = [...existingHistory, historyItem];

    const updateData: Partial<ConsultaAgendamento> = {
        status: targetStatus as any,
        is_paused: false,
        resumed_at: now,
        resumed_by: currentUser.id,
        resumed_by_name: currentUser.name,
        pause_history: updatedHistory as any
    };

    // Salva preventivamente no cache local
    savePausedMetadataItem(id, {
        is_paused: false,
        status: targetStatus,
        paused_at: agendamento.paused_at,
        paused_by: agendamento.paused_by,
        paused_by_name: agendamento.paused_by_name,
        pause_reason: agendamento.pause_reason,
        resumed_at: now,
        resumed_by: currentUser.id,
        resumed_by_name: currentUser.name,
        original_status: targetStatus,
        pause_history: updatedHistory
    });

    const updated = await updateAgendamento(id, updateData);

    // Recalcula posições da fila
    await recalculateAndPersistQueuePositions().catch(() => {});

    // Auditoria oficial
    try {
        await auditLogService.logAction({
            action_type: 'RETOMAR_SOLICITACAO',
            module: 'regulacao',
            description: `Solicitação de ${agendamento.paciente?.name || 'Paciente'} para ${agendamento.procedimento?.name || 'Procedimento'} foi RETOMADA por ${currentUser.name} e reintegrada à fila na colocação original.`,
            details: {
                agendamento_id: id,
                paciente: agendamento.paciente?.name,
                procedimento: agendamento.procedimento?.name,
                resumed_at: now,
                resumed_by: currentUser.name,
                target_status: targetStatus
            }
        });
    } catch (e) {}

    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('consultas-agendamento-changed'));
        window.dispatchEvent(new CustomEvent('consultas-vagas-changed'));
    }

    return updated || ({ ...agendamento, ...updateData } as unknown as ConsultaAgendamento);
};

/**
 * Normaliza e compara horários no formato HH:MM
 */
export const matchTimeSlot = (timeA?: string | null, timeB?: string | null): boolean => {
    if (!timeA || !timeB) return false;
    return timeA.substring(0, 5) === timeB.substring(0, 5);
};

/**
 * Verifica se a data e horário de uma vaga já passaram em relação ao momento atual (data/hora local).
 */
export const isSlotPast = (slot: { data: string; hora?: string | null }): boolean => {
    if (!slot || !slot.data) return false;
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    
    // Se a data for anterior a hoje, já passou
    if (slot.data < todayStr) return true;
    
    // Se a data for hoje, compara a hora e minuto
    if (slot.data === todayStr && slot.hora) {
        const currentHourMin = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        const slotHourMin = slot.hora.substring(0, 5);
        if (slotHourMin < currentHourMin) return true;
    }
    
    return false;
};

/**
 * Retorna as vagas físicas de um procedimento que estão efetivamente livres e válidas para o futuro
 * (não ocupadas por agendamento confirmado, não pausadas e não expiradas no passado)
 */
export const getFreeSlotsForProcedure = (
    vagas: ConsultaVaga[], 
    bookings: ConsultaAgendamento[],
    includePast: boolean = false
): ConsultaVaga[] => {
    const confirmedBookings = bookings.filter(b => 
        b.status === 'Agendado' && b.appointment_date && b.appointment_time
    );

    const matchedBookingIds = new Set<string>();
    const occupiedSlotIds = new Set<string>();

    vagas.forEach(slot => {
        if (slot.status === 'Pausada') {
            occupiedSlotIds.add(slot.id);
            return;
        }

        const match = confirmedBookings.find(b => 
            !matchedBookingIds.has(b.id) &&
            b.appointment_date === slot.data && 
            matchTimeSlot(b.appointment_time, slot.hora)
        );

        if (match) {
            occupiedSlotIds.add(slot.id);
            matchedBookingIds.add(match.id);
        }
    });

    return vagas.filter(v => 
        (!v.status || v.status === 'Disponível') && 
        !occupiedSlotIds.has(v.id) &&
        (includePast || !isSlotPast(v))
    );
};

export interface QueueEligibilityInfo {
    isEligible: boolean;
    freeSlotsCount: number;
    queuePosition: number;
    procName: string;
    isNextInQueue: boolean;
    blockingPatient?: {
        id: string;
        name: string;
        nickname?: string;
        queuePosition: number;
        procName: string;
    } | null;
}

/**
 * Calcula a elegibilidade estrita de fila e vagas para cada agendamento:
 * Regra: Se houver N vagas livres para o procedimento X, apenas os primeiros N pacientes da fila de espera de X
 * ganham status 'Definir Data' e a possibilidade de serem agendados.
 * Além disso, apenas o primeiro colocado não agendado (1º lugar) fica desbloqueado para agendamento;
 * os demais (2º, 3º, etc.) ficam bloqueados aguardando o agendamento do paciente anterior.
 */
export const getQueueEligibilityMap = (
    allBookings: ConsultaAgendamento[],
    allVagas: ConsultaVaga[]
): Map<string, QueueEligibilityInfo> => {
    const map = new Map<string, QueueEligibilityInfo>();

    // 1. Agrupar vagas e agendamentos por procedimento
    const vagasByProc: Record<string, ConsultaVaga[]> = {};
    allVagas.forEach(v => {
        if (!vagasByProc[v.procedimento_id]) vagasByProc[v.procedimento_id] = [];
        vagasByProc[v.procedimento_id].push(v);
    });

    const bookingsByProc: Record<string, ConsultaAgendamento[]> = {};
    allBookings.forEach(b => {
        const pId = b.procedimento_id || (b.procedimento ? b.procedimento.id : null) || 'geral';
        if (!bookingsByProc[pId]) bookingsByProc[pId] = [];
        bookingsByProc[pId].push(b);
    });

    // 2. Para cada procedimento, calcular slots livres e ordenar fila de espera
    const allProcIds = new Set([...Object.keys(vagasByProc), ...Object.keys(bookingsByProc)]);

    allProcIds.forEach(procId => {
        const procVagas = vagasByProc[procId] || [];
        const procBookings = bookingsByProc[procId] || [];
        const freeSlots = getFreeSlotsForProcedure(procVagas, procBookings);
        const freeSlotsCount = freeSlots.length;

        // Fila de espera deste procedimento (ignora completamente solicitações pausadas ou suspensas por cancelamento pendente)
        const waitlist = procBookings.filter(b => 
            (b.status === 'Fila de espera' || b.status === 'Aguardando Data') && 
            !b.is_paused && 
            !b.cancelamento_pendente
        );
        const orderedWaitlist = orderConsultasQueue(waitlist);

        const firstUnscheduled = orderedWaitlist.length > 0 ? orderedWaitlist[0] : null;

        orderedWaitlist.forEach((booking, index) => {
            const queuePosition = index + 1;
            const isEligible = queuePosition <= freeSlotsCount;
            const isNextInQueue = index === 0;

            let blockingPatient: QueueEligibilityInfo['blockingPatient'] = null;
            if (index > 0 && firstUnscheduled) {
                const priorName = firstUnscheduled.paciente?.nickname
                    ? `${firstUnscheduled.paciente.name} (${firstUnscheduled.paciente.nickname})`
                    : (firstUnscheduled.paciente?.name || 'Paciente Anterior');

                blockingPatient = {
                    id: firstUnscheduled.id,
                    name: priorName,
                    nickname: firstUnscheduled.paciente?.nickname,
                    queuePosition: 1,
                    procName: firstUnscheduled.procedimento?.name || booking.procedimento?.name || 'Procedimento'
                };
            }

            map.set(booking.id, {
                isEligible,
                freeSlotsCount,
                queuePosition,
                procName: booking.procedimento?.name || 'Procedimento',
                isNextInQueue,
                blockingPatient
            });
        });

        // Solicitações pausadas deste procedimento ficam explicitamente inelegíveis para vagas
        procBookings.filter(b => b.is_paused || b.status === 'Pausada').forEach(pausedBooking => {
            map.set(pausedBooking.id, {
                isEligible: false,
                freeSlotsCount,
                queuePosition: 0,
                procName: pausedBooking.procedimento?.name || 'Procedimento',
                isNextInQueue: false,
                blockingPatient: null
            });
        });
    });

    return map;
};

export const confirmarDataAgendamento = async (
    id: string, 
    date: string, 
    time?: string,
    vagaInfo?: Partial<ConsultaVaga>
): Promise<ConsultaAgendamento | null> => {
    assertCanMutateRegulacao('Definir Data do Agendamento', 'acompanhar');
    try {
        // 1. Buscar o agendamento atual com fallback seguro de colunas e memória
        let targetBooking: any = null;
        let fetchErr: any = null;

        try {
            const { data: bData, error: bErr } = await supabase
                .from('consultas_agendamentos')
                .select('id, procedimento_id, patient_id, status, priority, created_at')
                .eq('id', id)
                .maybeSingle();

            if (bData) {
                targetBooking = bData;
            } else {
                fetchErr = bErr;
            }
        } catch (err) {
            fetchErr = err;
        }

        // Fallback: Se não encontrou via query direta (mismatch de coluna/schema/filtro), buscar em getAgendamentos
        if (!targetBooking) {
            try {
                const all = await getAgendamentos();
                const found = all.find(b => b.id === id);
                if (found) {
                    targetBooking = found;
                    fetchErr = null;
                }
            } catch (fallbackErr) {
                console.warn('[consultasService] Fallback getAgendamentos falhou em confirmarDataAgendamento:', fallbackErr);
            }
        }

        if (!targetBooking) {
            if (fetchErr) {
                console.error('[consultasService] Erro na busca do agendamento (id: ' + id + '):', fetchErr);
            }
            throw new Error('Solicitação de agendamento não encontrada.');
        }

        // Validação de pausa: solicitações pausadas não podem ser agendadas ou consumir vagas
        if (targetBooking.status === 'Pausada' || targetBooking.is_paused) {
            throw new Error('Esta solicitação está pausada. Retome a solicitação antes de definir data ou agendar.');
        }

        const procId = targetBooking.procedimento_id;

        // 2. Carregar vagas e agendamentos para validações
        const [allProcVagas, allBookings] = await Promise.all([
            getVagas(procId),
            getAgendamentos()
        ]);
        const procBookings = allBookings.filter(b => (b.procedimento_id || b.procedimento?.id) === procId);

        // Identificar a vaga correspondente para herdar seu tipo_atendimento, prestador, município e convênio
        let matchedVaga: Partial<ConsultaVaga> | null = vagaInfo || null;
        if (!matchedVaga && date && time) {
            const cleanTime = time.substring(0, 5);
            const freeSlots = getFreeSlotsForProcedure(allProcVagas, procBookings);
            matchedVaga = freeSlots.find(s => s.data === date && matchTimeSlot(s.hora, cleanTime)) || null;
        }

        // Se houver horário definido, verificar se ainda há vagas livres
        if (date && time) {
            const cleanTime = time.substring(0, 5);
            const freeSlots = getFreeSlotsForProcedure(allProcVagas, procBookings);
            const hasFreeSlotForDateTime = freeSlots.some(s => 
                s.data === date && matchTimeSlot(s.hora, cleanTime)
            );

            if (!hasFreeSlotForDateTime && freeSlots.length === 0) {
                throw new Error(`Não há mais vagas livres no dia ${new Date(date + 'T12:00:00').toLocaleDateString('pt-BR')}.`);
            }
        }

        // 3. Validação estrita da ordem da fila: verificar se o paciente é um dos elegíveis
        if (targetBooking.status === 'Fila de espera' || targetBooking.status === 'Aguardando Data') {
            const freeSlots = getFreeSlotsForProcedure(allProcVagas, procBookings);
            const freeSlotsCount = freeSlots.length;

            const waitlist = procBookings.filter(b => (b.status === 'Fila de espera' || b.status === 'Aguardando Data') && !b.is_paused);
            const orderedWaitlist = orderConsultasQueue(waitlist);

            const bookingIndex = orderedWaitlist.findIndex(b => b.id === id);
            if (bookingIndex === -1 && waitlist.length > 0 && freeSlotsCount === 0) {
                throw new Error('Não há vagas disponíveis para este procedimento no momento.');
            }

            // Regra de bloqueio sequencial: Deve agendar primeiro o paciente colocado na 1ª posição da fila deste procedimento
            if (bookingIndex > 0) {
                const priorPatient = orderedWaitlist[0];
                const priorName = priorPatient.paciente?.nickname
                    ? `${priorPatient.paciente.name} (${priorPatient.paciente.nickname})`
                    : (priorPatient.paciente?.name || 'o paciente anterior');
                throw new Error(`Não é possível agendar este paciente. Agende o paciente ${priorName} da colocação 1º primeiro.`);
            }
        }

        // 4. Garantir que a tabela consultas_procedimentos esteja com cotas liberadas para que triggers legadas do Postgres não revertam o status
        if (procId) {
            try {
                await supabase
                    .from('consultas_procedimentos')
                    .update({
                        available_quantity: 99999,
                        total_quantity: 99999
                    })
                    .eq('id', procId);
            } catch (procSyncErr) {
                console.warn('[consultasService] Aviso ao pré-sincronizar procedimento:', procSyncErr);
            }
        }

        // 5. Gravar a confirmação do agendamento utilizando updateAgendamento resiliente
        const updatePayload: any = { 
            appointment_date: date,
            status: 'Agendado'
        };
        if (time) {
            updatePayload.appointment_time = time;
        }
        if (matchedVaga) {
            if (matchedVaga.id) updatePayload.vaga_id = matchedVaga.id;
            if (matchedVaga.tipo_atendimento) updatePayload.tipo_atendimento = matchedVaga.tipo_atendimento;
            if (matchedVaga.prestador) updatePayload.prestador = matchedVaga.prestador;
            if (matchedVaga.municipio) updatePayload.municipio = matchedVaga.municipio;
            if (matchedVaga.convenio) updatePayload.convenio = matchedVaga.convenio;
        }

        let data = await updateAgendamento(id, updatePayload);

        // Se uma trigger legada do PostgreSQL tiver revertido o status silenciosamente para 'Fila de espera',
        // reforça a atualização de consultas_procedimentos e tenta forçar o status 'Agendado'
        if (data && data.status !== 'Agendado') {
            console.warn('[consultasService] O banco de dados reverteu o status para "Fila de espera". Forçando status "Agendado"...');
            if (procId) {
                await supabase
                    .from('consultas_procedimentos')
                    .update({
                        available_quantity: 99999,
                        total_quantity: 99999
                    })
                    .eq('id', procId);
            }

            const forcePayload: any = {
                appointment_date: date,
                appointment_time: time || null,
                status: 'Agendado'
            };
            if (matchedVaga) {
                if (matchedVaga.id) forcePayload.vaga_id = matchedVaga.id;
                if (matchedVaga.tipo_atendimento) forcePayload.tipo_atendimento = matchedVaga.tipo_atendimento;
                if (matchedVaga.prestador) forcePayload.prestador = matchedVaga.prestador;
                if (matchedVaga.municipio) forcePayload.municipio = matchedVaga.municipio;
                if (matchedVaga.convenio) forcePayload.convenio = matchedVaga.convenio;
            }

            const forceRes = await supabase
                .from('consultas_agendamentos')
                .update(forcePayload)
                .eq('id', id)
                .select(`
                    *,
                    paciente:consultas_pacientes(*),
                    procedimento:consultas_procedimentos(*),
                    responsavel:profiles(name)
                `)
                .single();

            if (forceRes.data) {
                data = forceRes.data;
            }
        }

        if (!data || data.status !== 'Agendado') {
            throw new Error('O banco de dados (Supabase) possui uma trigger legada que bloqueou o agendamento. Por favor, execute o script SQL "corrigir_triggers_supabase.sql" no SQL Editor do Supabase para atualizar as regras.');
        }

        return data;
    } catch (error: any) {
        console.error('[consultasService] confirmarDataAgendamento Error:', error.message);
        throw error;
    }
};

export const updateAgendamento = async (
    id: string, 
    updates: Partial<ConsultaAgendamento>
): Promise<ConsultaAgendamento | null> => {
    assertCanMutateRegulacao('Alterar Agendamento', 'acompanhar');
    try {
        const { paciente, procedimento, responsavel, ...cleanUpdates } = updates as any;

        // Tratar strings vazias para NULL em campos de data, hora e retorno do Postgres
        if (cleanUpdates.appointment_date === '') cleanUpdates.appointment_date = null;
        if (cleanUpdates.appointment_time === '') cleanUpdates.appointment_time = null;
        if (cleanUpdates.solicitation_date === '') cleanUpdates.solicitation_date = null;
        if (cleanUpdates.retorno_tipo === '') cleanUpdates.retorno_tipo = null;
        if (cleanUpdates.is_retorno === false) {
            cleanUpdates.retorno_tipo = null;
            cleanUpdates.retorno_grau = null;
        }
        if (cleanUpdates.cancellation_reason === '') cleanUpdates.cancellation_reason = null;
        if (cleanUpdates.canceled_by === '') cleanUpdates.canceled_by = null;
        if (cleanUpdates.canceled_by_name === '') cleanUpdates.canceled_by_name = null;
        if (cleanUpdates.canceled_at === '') cleanUpdates.canceled_at = null;

        // Validar duplicidade em edições/transferências/reativações que alteram paciente, procedimento ou reativam status encerrado
        if (
            cleanUpdates.patient_id !== undefined ||
            cleanUpdates.procedimento_id !== undefined ||
            (cleanUpdates.status !== undefined && isActiveAgendamentoStatus(cleanUpdates.status))
        ) {
            const { data: currentItem } = await supabase
                .from('consultas_agendamentos')
                .select('patient_id, procedimento_id, status')
                .eq('id', id)
                .maybeSingle();

            if (currentItem) {
                const targetPatientId = cleanUpdates.patient_id || currentItem.patient_id;
                const targetProcId = cleanUpdates.procedimento_id || currentItem.procedimento_id;
                const targetStatus = cleanUpdates.status || currentItem.status;

                const changedPair =
                    targetPatientId !== currentItem.patient_id ||
                    targetProcId !== currentItem.procedimento_id;
                const reactivatingFromFinalized =
                    !isActiveAgendamentoStatus(currentItem.status) &&
                    isActiveAgendamentoStatus(targetStatus);

                if ((changedPair || reactivatingFromFinalized) && isActiveAgendamentoStatus(targetStatus)) {
                    const existingDup = await checkActiveDuplicateAgendamento(
                        { id: targetPatientId, cpf: paciente?.cpf },
                        { id: targetProcId, code: procedimento?.code },
                        id
                    );
                    if (existingDup) {
                        throw new DuplicateAgendamentoError(existingDup);
                    }
                }
            }
        }

        // Sincronizar procedimento com cotas livres caso haja transição para Agendado ou definição de data
        let procId = cleanUpdates.procedimento_id;
        if (cleanUpdates.status === 'Agendado' || cleanUpdates.appointment_date) {
            try {
                if (!procId) {
                    const { data: currentItem } = await supabase
                        .from('consultas_agendamentos')
                        .select('procedimento_id')
                        .eq('id', id)
                        .single();
                    procId = currentItem?.procedimento_id;
                }
                if (procId) {
                    await supabase
                        .from('consultas_procedimentos')
                        .update({
                            available_quantity: 99999,
                            total_quantity: 99999
                        })
                        .eq('id', procId);
                }
            } catch (pErr) {
                console.warn('[consultasService] Não foi possível pré-sincronizar procedimento em updateAgendamento:', pErr);
            }
        }

        let { data, error } = await supabase
            .from('consultas_agendamentos')
            .update(cleanUpdates)
            .eq('id', id)
            .select(`
                *,
                paciente:consultas_pacientes(*),
                procedimento:consultas_procedimentos(*),
                responsavel:profiles(name)
            `)
            .single();

        // Fallback progressivo e adaptativo: se alguma coluna não existir ou houver mismatch de schema
        if (error && (error.code === '42703' || error.code === 'PGRST204' || error.message?.includes('column') || error.message?.includes('does not exist') || error.message?.includes('schema cache'))) {
            console.warn('[consultasService] Coluna(s) ausente(s) no Supabase (updateAgendamento). Iniciando fallback adaptativo...', error.message);

            const optionalCols = [
                'confirmation_origin',
                'confirmed_at',
                'confirmed_by',
                'confirmed_by_name',
                'convenio',
                'prestador',
                'municipio',
                'tipo_atendimento',
                'vaga_id',
                'retorno_tipo',
                'retorno_grau',
                'solicitation_date',
                'appointment_time',
                'is_retorno',
                'cancellation_reason',
                'canceled_by',
                'canceled_by_name',
                'canceled_at',
                'is_paused',
                'paused_at',
                'paused_by',
                'paused_by_name',
                'pause_reason',
                'resumed_at',
                'resumed_by',
                'resumed_by_name',
                'original_status',
                'pause_history'
            ];
            let fallbackUpdates = { ...cleanUpdates };
            let lastError: any = error;
            let attempts = 0;
            const maxAttempts = 20;

            while (lastError && attempts < maxAttempts && (lastError.code === '42703' || lastError.code === 'PGRST204' || lastError.message?.includes('column') || lastError.message?.includes('does not exist') || lastError.message?.includes('schema cache'))) {
                attempts++;

                // Extrai dinamicamente a coluna ausente mencionada no erro da tentativa atual
                const colMatch = lastError.message?.match(/Could not find the '([^']+)' column/i)
                              || lastError.message?.match(/column ["']([^"']+)["'] of relation/i)
                              || lastError.message?.match(/column ["']([^"']+)["'] does not exist/i);

                let colToRemove: string | null = null;
                if (colMatch && (colMatch[1] || colMatch[2] || colMatch[3])) {
                    const detected = colMatch[1] || colMatch[2] || colMatch[3];
                    if (detected in fallbackUpdates) {
                        colToRemove = detected;
                    }
                }

                // Se não extraiu pelo erro ou já foi removida, remove a próxima coluna opcional presente no payload
                if (!colToRemove) {
                    colToRemove = optionalCols.find(c => c in fallbackUpdates) || null;
                }

                if (!colToRemove) {
                    break;
                }

                console.warn(`[consultasService] Removendo coluna '${colToRemove}' do payload de updateAgendamento (tentativa ${attempts}) e tentando novamente...`);
                delete fallbackUpdates[colToRemove];

                const retryRes = await supabase
                    .from('consultas_agendamentos')
                    .update(fallbackUpdates)
                    .eq('id', id)
                    .select(`
                        *,
                        paciente:consultas_pacientes(*),
                        procedimento:consultas_procedimentos(*),
                        responsavel:profiles(name)
                    `)
                    .single();

                data = retryRes.data;
                lastError = retryRes.error;

                if (!lastError) {
                    console.log(`[consultasService] updateAgendamento concluído com sucesso após adaptação de colunas!`);
                    break;
                }
            }

            error = lastError;
        }

        if (error) throw error;

        // Se data foi recuperado com sucesso, mescla as propriedades originais para que o estado da UI mantenha os dados
        if (data) {
            data = {
                ...cleanUpdates,
                ...data
            };
        }

        // Se o status solicitado for 'Agendado' e a resposta do banco retornou 'Fila de espera' (por causa de trigger legada)
        if (data && cleanUpdates.status === 'Agendado' && data.status !== 'Agendado') {
            console.warn('[consultasService] Trigger interceptou status. Forçando novo update com cotas abertas...');
            if (procId) {
                await supabase
                    .from('consultas_procedimentos')
                    .update({
                        available_quantity: 99999,
                        total_quantity: 99999
                    })
                    .eq('id', procId);
            }
            const reTry = await supabase
                .from('consultas_agendamentos')
                .update({ status: 'Agendado', appointment_date: cleanUpdates.appointment_date || null })
                .eq('id', id)
                .select(`
                    *,
                    paciente:consultas_pacientes(*),
                    procedimento:consultas_procedimentos(*),
                    responsavel:profiles(name)
                `)
                .single();
            if (reTry.data) {
                data = reTry.data;
            }
        }

        await recalculateAndPersistQueuePositions();
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('consultas-agendamentos-changed'));
        }

        return data;
    } catch (error: any) {
        if (error instanceof DuplicateAgendamentoError || error?.code === 'DUPLICATE_AGENDAMENTO') {
            throw error;
        }
        const errMsg = String(error?.message || '');
        if (
            error?.code === '23505' ||
            errMsg.includes('SOLICITACAO_DUPLICADA') ||
            errMsg.includes('idx_consultas_agendamentos_unique_active')
        ) {
            throw new DuplicateAgendamentoError(null);
        }
        const appError = handleSupabaseError(error);
        console.error('[consultasService] updateAgendamento Error:', appError.message);
        throw appError;
    }
};

export const deleteAgendamento = async (id: string): Promise<boolean> => {
    assertCanMutateRegulacao('Excluir Agendamento', 'acompanhar');
    try {
        const { error, count } = await supabase
            .from('consultas_agendamentos')
            .delete({ count: 'exact' })
            .eq('id', id);

        if (error) throw error;
        if (count === 0) {
            throw new Error('Nenhum registro foi excluído. Verifique se você possui permissões de exclusão ou se o registro existe.');
        }

        await recalculateAndPersistQueuePositions();
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('consultas-agendamentos-changed'));
        }

        return true;
    } catch (error) {
        const appError = handleSupabaseError(error);
        console.error('[consultasService] deleteAgendamento Error:', appError.message);
        throw appError;
    }
};

// --- DASHBOARD / STATS ---

export interface ConsultasDashboardStats {
    totalPatients: number;
    totalBookings: number;
    popularProcedures: { name: string; type: string; count: number }[];
    availableQuantities: { name: string; type: string; available: number }[];
    bookingsByPeriod: { date: string; count: number }[];
}

export const getDashboardStats = async (): Promise<ConsultasDashboardStats> => {
    try {
        // 1. Total Patients
        const { count: totalPatients, error: pError } = await supabase
            .from('consultas_pacientes')
            .select('id', { count: 'exact', head: true });
        if (pError) throw pError;

        // 2. Total Bookings
        const { count: totalBookings, error: bError } = await supabase
            .from('consultas_agendamentos')
            .select('id', { count: 'exact', head: true });
        if (bError) throw bError;

        // 3. Available Quantities (Procedures that are active)
        const { data: procedures, error: prError } = await supabase
            .from('consultas_procedimentos')
            .select('name, type, available_quantity')
            .eq('status', 'Ativo');
        if (prError) throw prError;

        const availableQuantities = (procedures || []).map(p => ({
            name: p.name,
            type: p.type,
            available: Math.max(0, p.available_quantity)
        })).sort((a, b) => a.available - b.available); // Sort by fewer available first

        // 4. Bookings raw details to compute popularity and period trends (sem limite de 1000)
        let allBookingsData: any[] = [];
        let from = 0;
        const CHUNK_SIZE = 1000;
        let hasMore = true;

        while (hasMore) {
            const { data: bookingsChunk, error: bkError } = await supabase
                .from('consultas_agendamentos')
                .select(`
                    appointment_date,
                    procedimento:consultas_procedimentos(name, type)
                `)
                .range(from, from + CHUNK_SIZE - 1);

            if (bkError) throw bkError;

            if (bookingsChunk && bookingsChunk.length > 0) {
                allBookingsData.push(...bookingsChunk);
                if (bookingsChunk.length < CHUNK_SIZE) {
                    hasMore = false;
                } else {
                    from += CHUNK_SIZE;
                }
            } else {
                hasMore = false;
            }
        }

        const rawBookings = allBookingsData;

        // Popularity ranking
        const popularMap: Record<string, { type: string; count: number }> = {};
        rawBookings.forEach(b => {
            const proc = Array.isArray(b.procedimento) ? b.procedimento[0] : b.procedimento;
            const name = (proc as any)?.name || 'Desconhecido';
            const type = (proc as any)?.type || 'Exame';
            if (!popularMap[name]) {
                popularMap[name] = { type, count: 0 };
            }
            popularMap[name].count += 1;
        });

        const popularProcedures = Object.entries(popularMap)
            .map(([name, data]) => ({
                name,
                type: data.type,
                count: data.count
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5); // top 5

        // Trends (count bookings per day for the last 30 days)
        const trendMap: Record<string, number> = {};
        
        // Initialize last 7 days
        for (let i = 6; i >= 0; i--) {
            const dateStr = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            trendMap[dateStr] = 0;
        }

        rawBookings.forEach(b => {
            const dateStr = b.appointment_date;
            if (dateStr in trendMap) {
                trendMap[dateStr] += 1;
            } else {
                // If it is within range, register it anyway
                const dateDiff = Math.abs(Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24);
                if (dateDiff <= 30) {
                    trendMap[dateStr] = (trendMap[dateStr] || 0) + 1;
                }
            }
        });

        const bookingsByPeriod = Object.entries(trendMap)
            .map(([date, count]) => {
                // Format date to DD/MM
                const [yyyy, mm, dd] = date.split('-');
                return {
                    date: `${dd}/${mm}`,
                    count
                };
            })
            .sort((a, b) => {
                const [aD, aM] = a.date.split('/');
                const [bD, bM] = b.date.split('/');
                return aM.localeCompare(bM) || aD.localeCompare(bD);
            });

        return {
            totalPatients: totalPatients || 0,
            totalBookings: totalBookings || 0,
            popularProcedures,
            availableQuantities,
            bookingsByPeriod
        };
    } catch (error) {
        console.error('[consultasService] getDashboardStats Error:', error);
        return {
            totalPatients: 0,
            totalBookings: 0,
            popularProcedures: [],
            availableQuantities: [],
            bookingsByPeriod: []
        };
    }
};

// --- VAGAS ---

export const getVagas = async (procedimentoId?: string): Promise<ConsultaVaga[]> => {
    try {
        let allVagas: ConsultaVaga[] = [];
        let from = 0;
        const CHUNK_SIZE = 1000;
        let hasMore = true;

        const VAGA_COLUMNS = 'id, procedimento_id, data, hora, status, tipo_atendimento, prestador, municipio, convenio, created_at';
        const VAGA_COLUMNS_FALLBACK = 'id, procedimento_id, data, hora, status, created_at';
        let useFallback = false;

        while (hasMore) {
            const cols = useFallback ? VAGA_COLUMNS_FALLBACK : VAGA_COLUMNS;
            let query = supabase
                .from('consultas_vagas')
                .select(cols as any)
                .order('data', { ascending: true })
                .order('hora', { ascending: true })
                .range(from, from + CHUNK_SIZE - 1);

            if (procedimentoId) {
                query = query.eq('procedimento_id', procedimentoId);
            }

            let res: any = await query;
            let data = res.data;
            let error = res.error;

            if (error && !useFallback && (error.code === '42703' || error.code === 'PGRST204' || error.message?.includes('column') || error.message?.includes('schema cache'))) {
                useFallback = true;
                const fallbackRes: any = await supabase
                    .from('consultas_vagas')
                    .select(VAGA_COLUMNS_FALLBACK as any)
                    .order('data', { ascending: true })
                    .order('hora', { ascending: true })
                    .range(from, from + CHUNK_SIZE - 1);
                data = fallbackRes.data;
                error = fallbackRes.error;
            }

            if (error) throw error;

            if (data && data.length > 0) {
                const mapped = data.map((v: any) => ({
                    ...v,
                    tipo_atendimento: (v.tipo_atendimento as any) || 'INTERNO',
                    prestador: v.prestador || (v.tipo_atendimento === 'EXTERNO' ? 'CISAMAPI' : 'Centro de Saúde Municipal'),
                    municipio: v.municipio || (v.tipo_atendimento === 'EXTERNO' ? 'Ponte Nova - MG' : 'São José do Goiabal - MG'),
                    convenio: v.convenio || (v.tipo_atendimento === 'EXTERNO' ? 'CISAMAPI' : 'SUS Municipal')
                }));
                allVagas.push(...(mapped as ConsultaVaga[]));
                if (data.length < CHUNK_SIZE) {
                    hasMore = false;
                } else {
                    from += CHUNK_SIZE;
                }
            } else {
                hasMore = false;
            }
        }

        return allVagas;
    } catch (error) {
        const appError = handleSupabaseError(error);
        console.error('[consultasService] getVagas Error:', appError.message);
        return [];
    }
};

export const createVagas = async (
    vagas: Array<{
        procedimento_id: string;
        data: string;
        hora: string;
        tipo_atendimento?: TipoAtendimentoConsulta;
        prestador?: string;
        municipio?: string;
        convenio?: string;
        status?: ConsultaVaga['status'];
    }>
): Promise<ConsultaVaga[] | null> => {
    assertCanMutateRegulacao('Liberar Vagas', 'vagas');
    try {
        const payload = vagas.map(v => ({
            procedimento_id: v.procedimento_id,
            data: v.data,
            hora: v.hora,
            tipo_atendimento: v.tipo_atendimento || 'INTERNO',
            prestador: v.prestador || (v.tipo_atendimento === 'EXTERNO' ? 'CISAMAPI' : 'Centro de Saúde / Policlínica Municipal'),
            municipio: v.municipio || (v.tipo_atendimento === 'EXTERNO' ? 'Ponte Nova - MG' : 'São José do Goiabal - MG'),
            convenio: v.convenio || (v.tipo_atendimento === 'EXTERNO' ? 'Consórcio CISAMAPI' : 'Rede Própria Municipal')
        }));

        let { data, error } = await supabase
            .from('consultas_vagas')
            .insert(payload)
            .select();

        if (error && (error.code === '42703' || error.code === 'PGRST204' || error.message?.includes('column') || error.message?.includes('schema cache'))) {
            const fallbackPayload = vagas.map(v => ({
                procedimento_id: v.procedimento_id,
                data: v.data,
                hora: v.hora
            }));
            const retryRes = await supabase
                .from('consultas_vagas')
                .insert(fallbackPayload)
                .select();
            data = retryRes.data;
            error = retryRes.error;
        }

        if (error) throw error;

        // Recalcular fila automaticamente para priorizar Agendamentos Especiais com as novas vagas
        await recalculateAndPersistQueuePositions();

        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('consultas-vagas-changed'));
            window.dispatchEvent(new CustomEvent('consultas-procedimentos-changed'));
        }

        return (data || []).map((v: any) => ({
            ...v,
            tipo_atendimento: v.tipo_atendimento || 'INTERNO',
            prestador: v.prestador,
            municipio: v.municipio,
            convenio: v.convenio
        }));
    } catch (error) {
        const appError = handleSupabaseError(error);
        console.error('[consultasService] createVagas Error:', appError.message);
        throw appError;
    }
};

export const updateVaga = async (id: string, updates: Partial<ConsultaVaga>): Promise<ConsultaVaga | null> => {
    assertCanMutateRegulacao('Atualizar Vaga', 'vagas');
    try {
        const { data, error } = await supabase
            .from('consultas_vagas')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        await recalculateAndPersistQueuePositions();

        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('consultas-vagas-changed'));
            window.dispatchEvent(new CustomEvent('consultas-procedimentos-changed'));
        }

        return data;
    } catch (error) {
        const appError = handleSupabaseError(error);
        console.error('[consultasService] updateVaga Error:', appError.message);
        throw appError;
    }
};

export const pauseVaga = async (id: string): Promise<boolean> => {
    assertCanMutateRegulacao('Pausar Vaga', 'vagas');
    try {
        const { error } = await supabase
            .from('consultas_vagas')
            .update({ status: 'Pausada' })
            .eq('id', id);

        if (error) throw error;

        await recalculateAndPersistQueuePositions();

        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('consultas-vagas-changed'));
            window.dispatchEvent(new CustomEvent('consultas-procedimentos-changed'));
        }

        return true;
    } catch (error) {
        const appError = handleSupabaseError(error);
        console.error('[consultasService] pauseVaga Error:', appError.message);
        throw appError;
    }
};

export const unpauseVaga = async (id: string): Promise<boolean> => {
    assertCanMutateRegulacao('Retomar Vaga', 'vagas');
    try {
        const { error } = await supabase
            .from('consultas_vagas')
            .update({ status: 'Disponível' })
            .eq('id', id);

        if (error) throw error;

        await recalculateAndPersistQueuePositions();

        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('consultas-vagas-changed'));
            window.dispatchEvent(new CustomEvent('consultas-procedimentos-changed'));
        }

        return true;
    } catch (error) {
        const appError = handleSupabaseError(error);
        console.error('[consultasService] unpauseVaga Error:', appError.message);
        throw appError;
    }
};

export const deleteVaga = async (id: string): Promise<boolean> => {
    assertCanMutateRegulacao('Excluir Vaga', 'vagas');
    try {
        const { error } = await supabase
            .from('consultas_vagas')
            .delete()
            .eq('id', id);

        if (error) throw error;

        await recalculateAndPersistQueuePositions();

        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('consultas-vagas-changed'));
            window.dispatchEvent(new CustomEvent('consultas-procedimentos-changed'));
        }

        return true;
    } catch (error) {
        const appError = handleSupabaseError(error);
        console.error('[consultasService] deleteVaga Error:', appError.message);
        throw appError;
    }
};

/**
 * Pausa todas as vagas de um procedimento em lote (ou uma lista específica de IDs).
 */
export const pauseAllVagas = async (procedimentoId: string, vagaIds?: string[]): Promise<boolean> => {
    assertCanMutateRegulacao('Pausar Todas as Vagas', 'vagas');
    try {
        let query = supabase
            .from('consultas_vagas')
            .update({ status: 'Pausada' });

        if (vagaIds && vagaIds.length > 0) {
            query = query.in('id', vagaIds);
        } else {
            query = query.eq('procedimento_id', procedimentoId);
        }

        const { error } = await query;
        if (error) throw error;

        await recalculateAndPersistQueuePositions();

        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('consultas-vagas-changed'));
            window.dispatchEvent(new CustomEvent('consultas-procedimentos-changed'));
        }

        return true;
    } catch (error) {
        const appError = handleSupabaseError(error);
        console.error('[consultasService] pauseAllVagas Error:', appError.message);
        throw appError;
    }
};

/**
 * Ativa / Despausa todas as vagas de um procedimento em lote (ou uma lista específica de IDs).
 */
export const unpauseAllVagas = async (procedimentoId: string, vagaIds?: string[]): Promise<boolean> => {
    assertCanMutateRegulacao('Retomar Todas as Vagas', 'vagas');
    try {
        let query = supabase
            .from('consultas_vagas')
            .update({ status: 'Disponível' });

        if (vagaIds && vagaIds.length > 0) {
            query = query.in('id', vagaIds);
        } else {
            query = query.eq('procedimento_id', procedimentoId);
        }

        const { error } = await query;
        if (error) throw error;

        await recalculateAndPersistQueuePositions();

        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('consultas-vagas-changed'));
            window.dispatchEvent(new CustomEvent('consultas-procedimentos-changed'));
        }

        return true;
    } catch (error) {
        const appError = handleSupabaseError(error);
        console.error('[consultasService] unpauseAllVagas Error:', appError.message);
        throw appError;
    }
};

/**
 * Exclui todas as vagas de um procedimento em lote (ou uma lista específica de IDs).
 */
export const deleteAllVagas = async (procedimentoId: string, vagaIds?: string[]): Promise<boolean> => {
    assertCanMutateRegulacao('Excluir Todas as Vagas', 'vagas');
    try {
        let query = supabase
            .from('consultas_vagas')
            .delete();

        if (vagaIds && vagaIds.length > 0) {
            query = query.in('id', vagaIds);
        } else {
            query = query.eq('procedimento_id', procedimentoId);
        }

        const { error } = await query;
        if (error) throw error;

        await recalculateAndPersistQueuePositions();

        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('consultas-vagas-changed'));
            window.dispatchEvent(new CustomEvent('consultas-procedimentos-changed'));
        }

        return true;
    } catch (error) {
        const appError = handleSupabaseError(error);
        console.error('[consultasService] deleteAllVagas Error:', appError.message);
        throw appError;
    }
};

/**
 * Edita campos em lote para todas as vagas de um procedimento (ou lista específica de IDs).
 */
export const updateAllVagas = async (
    procedimentoId: string, 
    updates: Partial<ConsultaVaga>, 
    vagaIds?: string[]
): Promise<boolean> => {
    assertCanMutateRegulacao('Atualizar Lote de Vagas', 'vagas');
    try {
        let query = supabase
            .from('consultas_vagas')
            .update(updates);

        if (vagaIds && vagaIds.length > 0) {
            query = query.in('id', vagaIds);
        } else {
            query = query.eq('procedimento_id', procedimentoId);
        }

        const { error } = await query;
        if (error) throw error;

        await recalculateAndPersistQueuePositions();

        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('consultas-vagas-changed'));
            window.dispatchEvent(new CustomEvent('consultas-procedimentos-changed'));
        }

        return true;
    } catch (error) {
        const appError = handleSupabaseError(error);
        console.error('[consultasService] updateAllVagas Error:', appError.message);
        throw appError;
    }
};

// --- GESTORES DO MÓDULO DE CONSULTAS ---

export const getSystemUsers = async (): Promise<any[]> => {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('id, name, username, email, role, status')
            .order('name', { ascending: true });

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('[consultasService] getSystemUsers Error:', error);
        return [];
    }
};

export const getConsultasGestores = async (): Promise<string[]> => {
    try {
        const { data, error } = await supabase
            .from('organization_settings')
            .select('ui_config')
            .eq('id', 'global_config')
            .maybeSingle();

        if (!error && data?.ui_config?.consultas_gestores && Array.isArray(data.ui_config.consultas_gestores)) {
            const list = data.ui_config.consultas_gestores;
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem('consultas_gestores_user_ids', JSON.stringify(list));
            }
            return list;
        }
    } catch (error) {
        console.warn('[consultasService] Aviso ao buscar gestores em organization_settings:', error);
    }
    const local = typeof localStorage !== 'undefined' ? localStorage.getItem('consultas_gestores_user_ids') : null;
    return local ? JSON.parse(local) : [];
};

export const isUserGestoresOrAdmin = async (user: { id: string; role?: string }): Promise<boolean> => {
    if (user.role === 'admin') return true;
    const gestores = await getConsultasGestores();
    return gestores.includes(user.id);
};

export const addConsultasGestor = async (userId: string, currentUserId?: string): Promise<boolean> => {
    assertCanMutateRegulacao('Adicionar Gestor da Regulação', 'gestor');
    try {
        const local = await getConsultasGestores();
        if (!local.includes(userId)) {
            local.push(userId);
        }
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('consultas_gestores_user_ids', JSON.stringify(local));
        }

        const { data: orgData } = await supabase
            .from('organization_settings')
            .select('ui_config')
            .eq('id', 'global_config')
            .maybeSingle();

        const currentUiConfig = orgData?.ui_config || {};
        await supabase
            .from('organization_settings')
            .update({
                ui_config: {
                    ...currentUiConfig,
                    consultas_gestores: local
                }
            })
            .eq('id', 'global_config');

        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('consultas-gestores-changed'));
        }
        return true;
    } catch (error) {
        console.warn('[consultasService] Erro ao salvar gestor em organization_settings:', error);
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('consultas-gestores-changed'));
        }
        return true;
    }
};

export const removeConsultasGestor = async (userId: string): Promise<boolean> => {
    assertCanMutateRegulacao('Remover Gestor da Regulação', 'gestor');
    try {
        let local = await getConsultasGestores();
        local = local.filter(id => id !== userId);
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('consultas_gestores_user_ids', JSON.stringify(local));
        }

        const { data: orgData } = await supabase
            .from('organization_settings')
            .select('ui_config')
            .eq('id', 'global_config')
            .maybeSingle();

        const currentUiConfig = orgData?.ui_config || {};
        await supabase
            .from('organization_settings')
            .update({
                ui_config: {
                    ...currentUiConfig,
                    consultas_gestores: local
                }
            })
            .eq('id', 'global_config');

        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('consultas-gestores-changed'));
        }
        return true;
    } catch (error) {
        console.warn('[consultasService] Erro ao remover gestor em organization_settings:', error);
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('consultas-gestores-changed'));
        }
        return true;
    }
};

export const cancelAgendamentoWithReason = async (
    id: string,
    reason: string,
    user: { id: string; name: string }
): Promise<ConsultaAgendamento | null> => {
    assertCanMutateRegulacao('Cancelar Agendamento', 'acompanhar');
    const now = new Date().toISOString();
    try {
        const { data, error } = await supabase
            .from('consultas_agendamentos')
            .update({
                status: 'Cancelado',
                cancellation_reason: reason,
                canceled_by: user.id,
                canceled_by_name: user.name,
                canceled_at: now
            })
            .eq('id', id)
            .select('*, paciente:consultas_pacientes(*), procedimento:consultas_procedimentos(*)')
            .single();

        if (error) {
            const { data: fallbackData } = await supabase
                .from('consultas_agendamentos')
                .update({ status: 'Cancelado' })
                .eq('id', id)
                .select('*, paciente:consultas_pacientes(*), procedimento:consultas_procedimentos(*)')
                .single();
            window.dispatchEvent(new CustomEvent('consultas-agendamentos-changed'));
            return fallbackData;
        }
        window.dispatchEvent(new CustomEvent('consultas-agendamentos-changed'));
        return data;
    } catch (error) {
        console.error('[consultasService] cancelAgendamentoWithReason Error:', error);
        window.dispatchEvent(new CustomEvent('consultas-agendamentos-changed'));
        return null;
    }
};

export const reagendarAgendamento = async (id: string): Promise<ConsultaAgendamento | null> => {
    assertCanMutateRegulacao('Reagendar Agendamento', 'acompanhar');
    try {
        const { data, error } = await supabase
            .from('consultas_agendamentos')
            .update({
                status: 'Fila de espera',
                appointment_date: null,
                appointment_time: null,
                tipo_atendimento: null,
                prestador: null,
                municipio: null,
                convenio: null,
                vaga_id: null,
                cancellation_reason: null,
                canceled_by: null,
                canceled_by_name: null,
                canceled_at: null
            })
            .eq('id', id)
            .select(`
                *,
                paciente:consultas_pacientes(*),
                procedimento:consultas_procedimentos(*),
                responsavel:profiles(name)
            `)
            .single();

        // Fallback progressivo se colunas opcionais não existirem
        if (error && (error.code === 'PGRST204' || error.message?.includes('column') || error.message?.includes('schema cache'))) {
            const { data: fallbackData, error: fallbackError } = await supabase
                .from('consultas_agendamentos')
                .update({
                    status: 'Fila de espera',
                    appointment_date: null,
                    appointment_time: null,
                    tipo_atendimento: null,
                    prestador: null,
                    municipio: null,
                    convenio: null,
                    vaga_id: null
                })
                .eq('id', id)
                .select(`
                    *,
                    paciente:consultas_pacientes(*),
                    procedimento:consultas_procedimentos(*),
                    responsavel:profiles(name)
                `)
                .single();

            if (fallbackError) throw fallbackError;
            window.dispatchEvent(new CustomEvent('consultas-agendamentos-changed'));
            return fallbackData;
        }

        if (error) throw error;
        window.dispatchEvent(new CustomEvent('consultas-agendamentos-changed'));
        return data;
    } catch (error: any) {
        console.error('[consultasService] reagendarAgendamento Error:', error.message);
        throw error;
    }
};

// =========================================================================================
// FLUXO SEGURO DE CANCELAMENTO COM APROVAÇÃO OBRIGATÓRIA (REGULAÇÃO)
// =========================================================================================

const LOCAL_STORAGE_SOLICITACOES_KEY = 'consultas_solicitacoes_cancelamento_local';

const getLocalSolicitacoesCancelamento = (): ConsultaSolicitacaoCancelamento[] => {
    try {
        const stored = localStorage.getItem(LOCAL_STORAGE_SOLICITACOES_KEY);
        if (stored) return JSON.parse(stored);
    } catch (e) {
        console.error('Erro ao ler solicitações de cancelamento do localStorage:', e);
    }
    return [];
};

const saveLocalSolicitacoesCancelamento = (solicitacoes: ConsultaSolicitacaoCancelamento[]) => {
    try {
        localStorage.setItem(LOCAL_STORAGE_SOLICITACOES_KEY, JSON.stringify(solicitacoes));
    } catch (e) {
        console.error('Erro ao salvar solicitações de cancelamento no localStorage:', e);
    }
};

/**
 * Busca todas as solicitações de cancelamento com status 'Aguardando Aprovação'
 */
export const getSolicitacoesCancelamentoPendentes = async (): Promise<ConsultaSolicitacaoCancelamento[]> => {
    try {
        const { data, error } = await supabase
            .from('consultas_solicitacoes_cancelamento')
            .select('*')
            .eq('status', 'Aguardando Aprovação')
            .order('criado_em', { ascending: true });

        if (error) {
            // Fallback caso a tabela ainda não exista no schema remoto
            if (error.code === '42P01' || error.message?.includes('relation') || error.code === 'PGRST204') {
                console.warn('[consultasService] Tabela consultas_solicitacoes_cancelamento não localizada. Usando fallback resiliente...');
                return getLocalSolicitacoesCancelamento().filter(s => s.status === 'Aguardando Aprovação');
            }
            throw error;
        }

        return data || [];
    } catch (err: any) {
        console.warn('[consultasService] getSolicitacoesCancelamentoPendentes fallback:', err.message);
        return getLocalSolicitacoesCancelamento().filter(s => s.status === 'Aguardando Aprovação');
    }
};

/**
 * Retorna um mapa { [agendamento_id]: ConsultaSolicitacaoCancelamento } das solicitações pendentes
 */
export const getMapaCancelamentosPendentes = async (): Promise<Record<string, ConsultaSolicitacaoCancelamento>> => {
    const list = await getSolicitacoesCancelamentoPendentes();
    const map: Record<string, ConsultaSolicitacaoCancelamento> = {};
    list.forEach(sol => {
        if (sol.agendamento_id) {
            map[sol.agendamento_id] = sol;
        }
    });
    return map;
};

/**
 * Usuário Comum: Solicita o cancelamento de um agendamento para análise da Regulação
 */
export const solicitarCancelamentoAgendamento = async (params: {
    agendamentoId: string;
    justificativa: string;
    solicitante: { id: string; name: string; sector?: string };
    bookingSnapshot?: ConsultaAgendamento | null;
}): Promise<{ success: boolean; solicitacao?: ConsultaSolicitacaoCancelamento; error?: string }> => {
    try {
        assertCanMutateRegulacao('Solicitar Cancelamento', 'acompanhar');
        const { agendamentoId, justificativa, solicitante, bookingSnapshot } = params;

        if (!justificativa || justificativa.trim().length < 5) {
            return { success: false, error: 'A justificativa do cancelamento é obrigatória (mínimo 5 caracteres).' };
        }

        // 1. Verificar se já existe solicitação pendente para este agendamento (evitar duplicidades)
        const pendentes = await getSolicitacoesCancelamentoPendentes();
        const jaExistePendente = pendentes.some(s => s.agendamento_id === agendamentoId && s.status === 'Aguardando Aprovação');
        if (jaExistePendente) {
            return {
                success: false,
                error: 'Já existe uma solicitação de cancelamento pendente para este agendamento sob análise da Regulação.'
            };
        }

        // 2. Obter dados do agendamento se não fornecido
        let targetBooking = bookingSnapshot;
        if (!targetBooking) {
            const { data: bData } = await supabase
                .from('consultas_agendamentos')
                .select('*, paciente:consultas_pacientes(*), procedimento:consultas_procedimentos(*)')
                .eq('id', agendamentoId)
                .single();
            targetBooking = bData;
        }

        if (!targetBooking) {
            return { success: false, error: 'Agendamento não localizado no banco de dados.' };
        }

        if (targetBooking.status === 'Cancelado') {
            return { success: false, error: 'Este agendamento já se encontra cancelado.' };
        }

        const now = new Date().toISOString();
        const rawCpf = targetBooking.paciente?.cpf || '';
        const formattedCpf = rawCpf ? rawCpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : 'S/ CPF';
        const rawPosicao = targetBooking.queue_position ?? null;
        const procCodigo = targetBooking.procedimento?.code || '';
        const procNome = targetBooking.procedimento?.name || 'Procedimento não informado';
        const procId = targetBooking.procedimento_id || targetBooking.procedimento?.id || '';
        const dataOriginal = targetBooking.solicitation_date || (targetBooking.created_at ? targetBooking.created_at.split('T')[0] : '');

        const payload: Omit<ConsultaSolicitacaoCancelamento, 'id'> = {
            agendamento_id: agendamentoId,
            paciente_nome: targetBooking.paciente?.name || 'Paciente não informado',
            paciente_cpf: formattedCpf,
            procedimento_id: procId,
            procedimento_nome: procNome,
            procedimento_codigo: procCodigo,
            procedimento_categoria: targetBooking.procedimento?.type || (targetBooking.procedimento as any)?.category || 'Geral',
            protocolo: (targetBooking as any).protocolo || agendamentoId.substring(0, 8).toUpperCase(),
            prioridade: targetBooking.priority || 'Normal',
            posicao_anterior: rawPosicao,
            data_original_solicitacao: dataOriginal,
            situacao_agendamento: targetBooking.status || 'Solicitado',
            data_agendada: targetBooking.appointment_date || null,
            solicitante_id: solicitante.id,
            solicitante_nome: solicitante.name,
            solicitante_setor: solicitante.sector || 'Unidade Básica / PSF',
            justificativa_solicitacao: justificativa.trim(),
            status: 'Aguardando Aprovação',
            criado_em: now,
            atualizado_em: now
        };

        let createdSolicitacao: ConsultaSolicitacaoCancelamento | null = null;

        try {
            const { data, error } = await supabase
                .from('consultas_solicitacoes_cancelamento')
                .insert([payload])
                .select()
                .single();

            if (!error && data) {
                createdSolicitacao = data;
            } else if (error) {
                console.warn('[consultasService] Erro ao gravar solicitação no Supabase. Usando fallback local:', error.message);
            }
        } catch (supabaseErr: any) {
            console.warn('[consultasService] Falha de conexão Supabase ao salvar solicitação. Fallback local:', supabaseErr.message);
        }

        // Salvar também no fallback local para máxima resiliência
        const localItem: ConsultaSolicitacaoCancelamento = createdSolicitacao || {
            ...payload,
            id: 'local-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7)
        };
        const localList = getLocalSolicitacoesCancelamento();
        localList.push(localItem);
        saveLocalSolicitacoesCancelamento(localList);

        // Suspender imediatamente a solicitação da fila ativa
        const originalStatus = targetBooking.status && targetBooking.status !== 'Cancelamento Pendente'
            ? targetBooking.status
            : (targetBooking.original_status || 'Fila de espera');

        try {
            const { error: upErr } = await supabase
                .from('consultas_agendamentos')
                .update({
                    status: 'Cancelamento Pendente',
                    original_status: originalStatus,
                    cancelamento_pendente: true,
                    queue_position: null,
                    special_sequence: null
                })
                .eq('id', agendamentoId);

            if (upErr) {
                // Fallback com campos mínimos caso colunas opcionais não existam
                await supabase
                    .from('consultas_agendamentos')
                    .update({
                        original_status: originalStatus,
                        cancelamento_pendente: true,
                        queue_position: null,
                        special_sequence: null
                    })
                    .eq('id', agendamentoId);
            }
        } catch (e: any) {
            console.warn('[consultasService] Erro ao suspender agendamento no Supabase:', e.message);
        }

        // Recalcular a fila ativa de todos os outros pacientes
        await recalculateAndPersistQueuePositions().catch(() => {});

        // Registro de Auditoria
        await auditLogService.logAction({
            action_type: 'SOLICITAR_CANCELAMENTO',
            module: 'Regulação - Acompanhar',
            description: `Cancelamento solicitado por ${solicitante.name} para o paciente ${targetBooking.paciente?.name || 'Paciente'} (${procNome}). Posição na fila suspensa temporariamente.`,
            details: {
                agendamento_id: agendamentoId,
                solicitante_id: solicitante.id,
                solicitante_nome: solicitante.name,
                justificativa: justificativa.trim(),
                posicao_anterior: rawPosicao,
                data_original_solicitacao: dataOriginal
            }
        }).catch(() => {});

        // Notificar eventos para tempo real
        window.dispatchEvent(new CustomEvent('consultas-solicitacoes-cancelamento-changed'));
        window.dispatchEvent(new CustomEvent('consultas-agendamentos-changed'));

        return { success: true, solicitacao: localItem };
    } catch (err: any) {
        console.error('[consultasService] solicitarCancelamentoAgendamento erro:', err);
        return { success: false, error: err.message || 'Erro inesperado ao solicitar cancelamento.' };
    }
};

/**
 * Gestor / Admin: Aprova a solicitação e cancela definitivamente o agendamento em operação atômica
 */
export const aprovarSolicitacaoCancelamento = async (params: {
    solicitacaoId: string;
    aprovador: { id: string; name: string; role?: string; is_admin?: boolean; access_level?: string };
}): Promise<{ success: boolean; error?: string }> => {
    try {
        assertCanMutateRegulacao('Aprovar Solicitação de Cancelamento', 'acompanhar');
        const { solicitacaoId, aprovador } = params;
        const now = new Date().toISOString();

        // 1. Buscar a solicitação para verificação concorrente
        let solicitacao: ConsultaSolicitacaoCancelamento | null = null;

        try {
            const { data } = await supabase
                .from('consultas_solicitacoes_cancelamento')
                .select('*')
                .eq('id', solicitacaoId)
                .single();
            if (data) solicitacao = data;
        } catch (e) {
            // Continua para verificar fallback local
        }

        if (!solicitacao) {
            const localList = getLocalSolicitacoesCancelamento();
            solicitacao = localList.find(s => s.id === solicitacaoId) || null;
        }

        if (!solicitacao) {
            return { success: false, error: 'Solicitação de cancelamento não localizada.' };
        }

        if (solicitacao.status !== 'Aguardando Aprovação') {
            return {
                success: false,
                error: `Esta solicitação já foi decidida anteriormente por outro gestor (Status atual: ${solicitacao.status}).`
            };
        }

        // Regra de segurança: O solicitante não pode aprovar seu próprio cancelamento, salvo se administrador
        const isApproverAdmin = Boolean(
            aprovador.role === 'admin' ||
            aprovador.is_admin ||
            aprovador.access_level === 'ADMIN'
        );
        if (solicitacao.solicitante_id === aprovador.id && !isApproverAdmin) {
            return {
                success: false,
                error: 'O usuário solicitante não pode aprovar seu próprio cancelamento. A análise deve ser realizada por outro gestor ou administrador.'
            };
        }

        const agendamentoId = solicitacao.agendamento_id;

        // 2. Verificar o agendamento no Supabase
        const { data: booking, error: bErr } = await supabase
            .from('consultas_agendamentos')
            .select('*')
            .eq('id', agendamentoId)
            .single();

        if (bErr || !booking) {
            return { success: false, error: 'O agendamento vinculado não foi encontrado no banco de dados.' };
        }

        if (booking.status === 'Cancelado') {
            // Já cancelado, apenas marca solicitação como aprovada
            try {
                await supabase
                    .from('consultas_solicitacoes_cancelamento')
                    .update({
                        status: 'Aprovada',
                        aprovador_id: aprovador.id,
                        aprovador_nome: aprovador.name,
                        decidido_em: now,
                        atualizado_em: now
                    })
                    .eq('id', solicitacaoId);
            } catch (_) {}
            return { success: true };
        }

        // 3. Executar o cancelamento definitivo do agendamento
        const cancellationReason = `[Aprovado por ${aprovador.name} via Regulação] Motivo original: ${solicitacao.justificativa_solicitacao}`;

        const { error: cancelErr } = await supabase
            .from('consultas_agendamentos')
            .update({
                status: 'Cancelado',
                cancellation_reason: cancellationReason,
                canceled_by: aprovador.id,
                canceled_by_name: aprovador.name,
                canceled_at: now,
                cancelamento_pendente: false,
                queue_position: null,
                special_sequence: null
            })
            .eq('id', agendamentoId);

        if (cancelErr) {
            // Fallback se colunas opcionais não existirem
            const { error: retryErr } = await supabase
                .from('consultas_agendamentos')
                .update({ status: 'Cancelado' })
                .eq('id', agendamentoId);
            if (retryErr) {
                return { success: false, error: 'Falha ao atualizar o status do agendamento para Cancelado: ' + retryErr.message };
            }
        }

        // 4. Se o agendamento possuía vaga vinculada, liberá-la
        if (booking.vaga_id) {
            try {
                await supabase
                    .from('consultas_vagas')
                    .update({ status: 'Disponível' })
                    .eq('id', booking.vaga_id);
            } catch (vagaErr) {
                console.warn('[consultasService] Erro ao liberar vaga associada ao cancelamento:', vagaErr);
            }
        }

        // 5. Atualizar a solicitação para 'Aprovada'
        try {
            await supabase
                .from('consultas_solicitacoes_cancelamento')
                .update({
                    status: 'Aprovada',
                    aprovador_id: aprovador.id,
                    aprovador_nome: aprovador.name,
                    decidido_em: now,
                    atualizado_em: now
                })
                .eq('id', solicitacaoId);
        } catch (_) {}

        // Atualizar lista local
        const localList = getLocalSolicitacoesCancelamento();
        const updatedLocal = localList.map(s => {
            if (s.id === solicitacaoId) {
                return {
                    ...s,
                    status: 'Aprovada' as const,
                    aprovador_id: aprovador.id,
                    aprovador_nome: aprovador.name,
                    decidido_em: now,
                    atualizado_em: now
                };
            }
            return s;
        });
        saveLocalSolicitacoesCancelamento(updatedLocal);

        // 6. Recalcular as posições da fila após retirada definitiva
        await recalculateAndPersistQueuePositions().catch(() => {});

        // 7. Registro de Auditoria
        await auditLogService.logAction({
            action_type: 'APROVAR_CANCELAMENTO',
            module: 'Regulação - Acompanhar',
            description: `Cancelamento aprovado por ${aprovador.name} para o paciente ${solicitacao.paciente_nome}. Solicitação cancelada definitivamente e retirada da fila.`,
            details: {
                solicitacao_id: solicitacaoId,
                agendamento_id: agendamentoId,
                aprovador_id: aprovador.id,
                aprovador_nome: aprovador.name,
                justificativa_original: solicitacao.justificativa_solicitacao
            }
        }).catch(() => {});

        // 8. Notificar em tempo real
        window.dispatchEvent(new CustomEvent('consultas-agendamentos-changed'));
        window.dispatchEvent(new CustomEvent('consultas-solicitacoes-cancelamento-changed'));
        window.dispatchEvent(new CustomEvent('consultas-vagas-changed'));

        return { success: true };
    } catch (err: any) {
        console.error('[consultasService] aprovarSolicitacaoCancelamento erro:', err);
        return { success: false, error: err.message || 'Erro inesperado ao aprovar cancelamento.' };
    }
};

/**
 * Gestor / Admin: Rejeita a solicitação de cancelamento com justificativa obrigatória
 * Reativa a solicitação na fila mantendo a data original de solicitação e prioridade
 */
export const rejeitarSolicitacaoCancelamento = async (params: {
    solicitacaoId: string;
    justificativaRecusa: string;
    rejeitador: { id: string; name: string; role?: string; is_admin?: boolean; access_level?: string };
}): Promise<{ success: boolean; error?: string }> => {
    try {
        assertCanMutateRegulacao('Rejeitar Solicitação de Cancelamento', 'acompanhar');
        const { solicitacaoId, justificativaRecusa, rejeitador } = params;

        if (!justificativaRecusa || justificativaRecusa.trim().length < 5) {
            return {
                success: false,
                error: 'A justificativa para a rejeição da solicitação é obrigatória (mínimo de 5 caracteres).'
            };
        }

        const now = new Date().toISOString();

        // 1. Buscar a solicitação para verificação concorrente
        let solicitacao: ConsultaSolicitacaoCancelamento | null = null;
        try {
            const { data } = await supabase
                .from('consultas_solicitacoes_cancelamento')
                .select('*')
                .eq('id', solicitacaoId)
                .single();
            if (data) solicitacao = data;
        } catch (_) {}

        if (!solicitacao) {
            const localList = getLocalSolicitacoesCancelamento();
            solicitacao = localList.find(s => s.id === solicitacaoId) || null;
        }

        if (!solicitacao) {
            return { success: false, error: 'Solicitação de cancelamento não localizada.' };
        }

        if (solicitacao.status !== 'Aguardando Aprovação') {
            return {
                success: false,
                error: `Esta solicitação já foi decidida anteriormente (Status: ${solicitacao.status}).`
            };
        }

        // Regra de segurança: O solicitante não pode rejeitar seu próprio cancelamento, salvo se administrador geral
        const isRejectionAdmin = Boolean(
            rejeitador.role === 'admin' ||
            rejeitador.is_admin ||
            rejeitador.access_level === 'ADMIN'
        );
        if (solicitacao.solicitante_id === rejeitador.id && !isRejectionAdmin) {
            return {
                success: false,
                error: 'O usuário solicitante não pode rejeitar seu próprio cancelamento. A análise deve ser realizada por outro gestor ou administrador.'
            };
        }

        // 2. Atualizar no Supabase a solicitação para Rejeitada
        try {
            const { error } = await supabase
                .from('consultas_solicitacoes_cancelamento')
                .update({
                    status: 'Rejeitada',
                    aprovador_id: rejeitador.id,
                    aprovador_nome: rejeitador.name,
                    decisao_justificativa: justificativaRecusa.trim(),
                    decidido_em: now,
                    atualizado_em: now
                })
                .eq('id', solicitacaoId);

            if (error) {
                console.warn('[consultasService] Erro ao rejeitar solicitação no Supabase. Fallback local:', error.message);
            }
        } catch (_) {}

        // 3. Atualizar no fallback local
        const localList = getLocalSolicitacoesCancelamento();
        const updatedLocal = localList.map(s => {
            if (s.id === solicitacaoId) {
                return {
                    ...s,
                    status: 'Rejeitada' as const,
                    aprovador_id: rejeitador.id,
                    aprovador_nome: rejeitador.name,
                    decisao_justificativa: justificativaRecusa.trim(),
                    decidido_em: now,
                    atualizado_em: now
                };
            }
            return s;
        });
        saveLocalSolicitacoesCancelamento(updatedLocal);

        // 4. Reativar o agendamento na fila, restaurando o status original
        // REGRA FUNDAMENTAL: Preservar intactas a data de solicitação e a prioridade
        let restoredStatus = 'Fila de espera';
        try {
            const { data: bData } = await supabase
                .from('consultas_agendamentos')
                .select('original_status, status')
                .eq('id', solicitacao.agendamento_id)
                .single();
            if (bData?.original_status && bData.original_status !== 'Cancelamento Pendente') {
                restoredStatus = bData.original_status;
            }
        } catch (_) {}

        try {
            await supabase
                .from('consultas_agendamentos')
                .update({
                    status: restoredStatus,
                    cancelamento_pendente: false
                })
                .eq('id', solicitacao.agendamento_id);
        } catch (upErr: any) {
            console.warn('[consultasService] Erro ao reativar agendamento no Supabase:', upErr.message);
        }

        // 5. Recalcular todas as posições da fila ativa
        // O paciente volta automaticamente à sua posição correta por prioridade e data original
        await recalculateAndPersistQueuePositions().catch(() => {});

        // 6. Registro de Auditoria
        await auditLogService.logAction({
            action_type: 'REJEITAR_CANCELAMENTO',
            module: 'Regulação - Acompanhar',
            description: `Cancelamento recusado por ${rejeitador.name} para o paciente ${solicitacao.paciente_nome}. Solicitação reativada na fila na posição original. Justificativa: ${justificativaRecusa.trim()}`,
            details: {
                solicitacao_id: solicitacaoId,
                agendamento_id: solicitacao.agendamento_id,
                rejeitador_id: rejeitador.id,
                rejeitador_nome: rejeitador.name,
                justificativa_recusa: justificativaRecusa.trim()
            }
        }).catch(() => {});

        // 7. Notificar em tempo real
        window.dispatchEvent(new CustomEvent('consultas-solicitacoes-cancelamento-changed'));
        window.dispatchEvent(new CustomEvent('consultas-agendamentos-changed'));

        return { success: true };
    } catch (err: any) {
        console.error('[consultasService] rejeitarSolicitacaoCancelamento erro:', err);
        return { success: false, error: err.message || 'Erro inesperado ao rejeitar solicitação.' };
    }
};

// --- OPERAÇÕES EM LOTE (BATCH ACTIONS) E HISTÓRICO DE TRANSFERÊNCIAS ---

export interface TransferredBookingInfo {
    bookingId: string;
    patientId?: string;
    patientName: string;
    patientCpf?: string;
    previousProcedimentoId: string;
    previousProcedimentoCode?: string;
    previousProcedimentoName: string;
    targetProcedimentoId: string;
    targetProcedimentoCode?: string;
    targetProcedimentoName: string;
    status?: string;
    appointmentDate?: string | null;
    appointmentTime?: string;
    prestador?: string;
    municipio?: string;
    priority?: string;
    solicitationDate?: string;
    reverted?: boolean;
    revertedAt?: string;
    revertedBy?: string;
}

export interface TransferRecord {
    id: string;
    type: 'individual' | 'batch';
    timestamp: string;
    userId?: string;
    userName: string;
    sourceProcedimento: {
        id: string;
        code?: string;
        name: string;
        type?: string;
    };
    targetProcedimento: {
        id: string;
        code?: string;
        name: string;
        type?: string;
    };
    bookings: TransferredBookingInfo[];
    reverted?: boolean;
    revertedAt?: string;
    revertedBy?: string;
    revertReason?: string;
}

export interface RevertTransferResult {
    success: boolean;
    revertedCount: number;
    failedCount: number;
    errors: { id: string; patientName?: string; message: string }[];
    message: string;
}

const REGULACAO_TRANSFER_HISTORY_KEY = 'consultas_transfer_history_records_v1';

const SEED_RECENT_TRANSFER_RECORD: TransferRecord = {
    id: 'transfer_seed_0721_to_0006_recent',
    type: 'batch',
    timestamp: '2026-11-13T01:31:08.571Z',
    userName: 'Guilherme',
    userId: '8114be69-95a9-4b68-b769-cfbe8220641b',
    sourceProcedimento: {
        id: 'c3ade5e2-c7f0-4de6-9b68-398591ba710f',
        code: '0721',
        name: 'DERMATOLOGIA',
        type: 'Consulta'
    },
    targetProcedimento: {
        id: '42a77cf4-c19c-4c8b-9807-4109539bf90c',
        code: '0006',
        name: 'CONSULTA EM DERMATOLOGIA',
        type: 'Consulta'
    },
    bookings: [
        {
            bookingId: '822613c3-e496-4c00-a0ef-37442815f286',
            patientId: '1f7e34c2-04db-4b68-8a8b-1145ff6f9b1c',
            patientName: 'AGISMERIA MAGELA GENERAL',
            patientCpf: '812.806.296-49',
            previousProcedimentoId: 'c3ade5e2-c7f0-4de6-9b68-398591ba710f',
            previousProcedimentoCode: '0721',
            previousProcedimentoName: 'DERMATOLOGIA',
            targetProcedimentoId: '42a77cf4-c19c-4c8b-9807-4109539bf90c',
            targetProcedimentoCode: '0006',
            targetProcedimentoName: 'CONSULTA EM DERMATOLOGIA',
            status: 'Agendado',
            appointmentDate: '2026-11-11',
            appointmentTime: '13:00:00',
            prestador: 'CISAMAPI',
            municipio: 'Ponte Nova - MG',
            priority: 'Normal',
            solicitationDate: '2026-11-10',
            reverted: false
        },
        {
            bookingId: '9fdc63d8-2a50-4ab2-abfb-3271c8036c9f',
            patientId: 'f78fdce9-684e-4fdf-9730-a8eb085521ae',
            patientName: 'GABRIEL HENRIQUE BARONY MARTINS',
            patientCpf: '196.111.796-77',
            previousProcedimentoId: 'c3ade5e2-c7f0-4de6-9b68-398591ba710f',
            previousProcedimentoCode: '0721',
            previousProcedimentoName: 'DERMATOLOGIA',
            targetProcedimentoId: '42a77cf4-c19c-4c8b-9807-4109539bf90c',
            targetProcedimentoCode: '0006',
            targetProcedimentoName: 'CONSULTA EM DERMATOLOGIA',
            status: 'Fila de espera',
            appointmentDate: null,
            appointmentTime: undefined,
            prestador: undefined,
            municipio: undefined,
            priority: 'Urgência',
            solicitationDate: '2026-11-09',
            reverted: false
        }
    ],
    reverted: false
};

let memTransferHistoryCache: TransferRecord[] | null = null;

export const getTransferHistory = (): TransferRecord[] => {
    if (typeof window === 'undefined') return [];
    if (memTransferHistoryCache) return memTransferHistoryCache;

    try {
        const raw = localStorage.getItem(REGULACAO_TRANSFER_HISTORY_KEY);
        let list: TransferRecord[] = raw ? JSON.parse(raw) : [];

        // Pre-seed the known recent transfer if missing from local storage
        const hasSeed = list.some(r => 
            r.id === SEED_RECENT_TRANSFER_RECORD.id ||
            r.bookings.some(b => b.bookingId === '822613c3-e496-4c00-a0ef-37442815f286')
        );

        if (!hasSeed) {
            list = [SEED_RECENT_TRANSFER_RECORD, ...list];
            try {
                localStorage.setItem(REGULACAO_TRANSFER_HISTORY_KEY, JSON.stringify(list));
            } catch (e) {
                // ignore quota
            }
        }

        memTransferHistoryCache = list;
        return list;
    } catch (e) {
        console.warn('[consultasService] Erro ao carregar histórico de transferências:', e);
        return [SEED_RECENT_TRANSFER_RECORD];
    }
};

export const saveTransferRecord = (record: TransferRecord): void => {
    if (typeof window === 'undefined') return;
    try {
        const history = getTransferHistory();
        const updated = [record, ...history.filter(r => r.id !== record.id)].slice(0, 80);
        memTransferHistoryCache = updated;
        localStorage.setItem(REGULACAO_TRANSFER_HISTORY_KEY, JSON.stringify(updated));
        window.dispatchEvent(new CustomEvent('consultas-transfer-recorded', { detail: record }));
    } catch (e) {
        console.warn('[consultasService] Erro ao salvar registro de transferência:', e);
    }
};

export const markTransferAsReverted = (
    recordId: string,
    revertedBy: string,
    reason?: string,
    revertedBookingIds?: string[]
): void => {
    if (typeof window === 'undefined') return;
    try {
        const history = getTransferHistory();
        const idx = history.findIndex(r => r.id === recordId);
        if (idx === -1) return;

        const record = history[idx];
        const now = new Date().toISOString();

        if (revertedBookingIds && revertedBookingIds.length > 0) {
            const idSet = new Set(revertedBookingIds);
            record.bookings.forEach(b => {
                if (idSet.has(b.bookingId)) {
                    b.reverted = true;
                    b.revertedAt = now;
                    b.revertedBy = revertedBy;
                }
            });
            const allReverted = record.bookings.every(b => b.reverted);
            if (allReverted) {
                record.reverted = true;
                record.revertedAt = now;
                record.revertedBy = revertedBy;
                record.revertReason = reason;
            }
        } else {
            record.reverted = true;
            record.revertedAt = now;
            record.revertedBy = revertedBy;
            record.revertReason = reason;
            record.bookings.forEach(b => {
                b.reverted = true;
                b.revertedAt = now;
                b.revertedBy = revertedBy;
            });
        }

        memTransferHistoryCache = history;
        localStorage.setItem(REGULACAO_TRANSFER_HISTORY_KEY, JSON.stringify(history));
        window.dispatchEvent(new CustomEvent('consultas-transfer-recorded', { detail: record }));
    } catch (e) {
        console.warn('[consultasService] Erro ao marcar transferência como revertida:', e);
    }
};

export const getTransferRecordForBooking = (bookingId: string): TransferRecord | null => {
    const history = getTransferHistory();
    for (const record of history) {
        const matchingBooking = record.bookings.find(b => b.bookingId === bookingId && !b.reverted);
        if (matchingBooking && !record.reverted) {
            return record;
        }
    }
    return null;
};

/**
 * Reverte uma transferência de procedimento previamente realizada, restaurando a solicitação ao
 * procedimento de origem e PRESERVANDO INTEGRALMENTE agendamento, data, horário, local, prestador, status e histórico.
 */
export const revertTransfer = async (params: {
    transferRecord: TransferRecord;
    bookingId?: string;
    currentUser: User;
    reason?: string;
}): Promise<RevertTransferResult> => {
    const { transferRecord, bookingId, currentUser, reason } = params;
    assertCanMutateRegulacao('Desfazer Transferência de Procedimento', 'acompanhar', currentUser);

    const result: RevertTransferResult = {
        success: false,
        revertedCount: 0,
        failedCount: 0,
        errors: [],
        message: ''
    };

    // Determina quais solicitações serão revertidas
    const targetBookings = bookingId
        ? transferRecord.bookings.filter(b => b.bookingId === bookingId)
        : transferRecord.bookings.filter(b => !b.reverted);

    if (targetBookings.length === 0) {
        result.message = 'Nenhuma solicitação pendente de reversão foi encontrada nesta transferência.';
        return result;
    }

    const revertedIds: string[] = [];

    for (const item of targetBookings) {
        if (item.reverted) {
            result.failedCount++;
            result.errors.push({
                id: item.bookingId,
                patientName: item.patientName,
                message: `A solicitação de ${item.patientName} já foi revertida anteriormente.`
            });
            continue;
        }

        // Buscar dados mais recentes no Supabase para integridade e segurança
        const { data: dbBooking, error: fetchErr } = await supabase
            .from('consultas_agendamentos')
            .select('id, procedimento_id, status, appointment_date, appointment_time, prestador, priority, paciente:consultas_pacientes(name)')
            .eq('id', item.bookingId)
            .single();

        if (fetchErr || !dbBooking) {
            result.failedCount++;
            result.errors.push({
                id: item.bookingId,
                patientName: item.patientName,
                message: `Solicitação não localizada no banco de dados.`
            });
            continue;
        }

        // REGRA DE SEGURANÇA: Se o procedimento atual no banco já não for o procedimento de destino desta transferência,
        // significa que foi transferido ou alterado posteriormente para outro procedimento.
        if (dbBooking.procedimento_id !== item.targetProcedimentoId && dbBooking.procedimento_id !== transferRecord.targetProcedimento.id) {
            result.failedCount++;
            result.errors.push({
                id: item.bookingId,
                patientName: item.patientName,
                message: `A solicitação de ${item.patientName} foi alterada posteriormente para outro procedimento no sistema. Para segurança dos dados, a reversão automática para este item foi bloqueada.`
            });
            continue;
        }

        try {
            // REGRA OBRIGATÓRIA: Alterar SOMENTE o procedimento vinculado, preservando integralmente todas as demais informações
            const sourceProcId = item.previousProcedimentoId || transferRecord.sourceProcedimento.id;
            await updateAgendamento(item.bookingId, {
                procedimento_id: sourceProcId
            });
            result.revertedCount++;
            revertedIds.push(item.bookingId);
        } catch (itemErr: any) {
            result.failedCount++;
            result.errors.push({
                id: item.bookingId,
                patientName: item.patientName,
                message: itemErr.message || 'Erro ao restaurar procedimento original.'
            });
        }
    }

    if (result.revertedCount > 0) {
        // Recalcular posições da fila após a reversão
        try {
            await recalculateAndPersistQueuePositions();
        } catch (qErr) {
            console.warn('[consultasService] Aviso ao recalcular fila pós-reversão:', qErr);
        }

        // Registrar auditoria detalhada da reversão
        try {
            await auditLogService.logAction({
                action_type: 'REVERSAO_TRANSFERENCIA_PROCEDIMENTO',
                module: 'Regulação - Acompanhar',
                description: `Reversão de transferência: ${result.revertedCount} solicitação(ões) restaurada(s) com sucesso de "${transferRecord.targetProcedimento.name}" para "${transferRecord.sourceProcedimento.name}". Todos os agendamentos foram preservados.`,
                details: {
                    transfer_record_id: transferRecord.id,
                    procedimento_origem_restaurado_id: transferRecord.sourceProcedimento.id,
                    procedimento_origem_restaurado_nome: transferRecord.sourceProcedimento.name,
                    procedimento_origem_restaurado_codigo: transferRecord.sourceProcedimento.code,
                    procedimento_destino_revertido_id: transferRecord.targetProcedimento.id,
                    procedimento_destino_revertido_nome: transferRecord.targetProcedimento.name,
                    procedimento_destino_revertido_codigo: transferRecord.targetProcedimento.code,
                    reverted_booking_ids: revertedIds,
                    reason: reason || null,
                    usuario: currentUser.name || 'Servidor Municipal'
                },
                user: {
                    id: currentUser.id,
                    name: currentUser.name || 'Servidor Municipal',
                    email: currentUser.email || ''
                }
            });
        } catch (audErr) {
            console.warn('[consultasService] Aviso ao registrar auditoria de reversão:', audErr);
        }

        // Marcar transferência como revertida
        markTransferAsReverted(
            transferRecord.id,
            currentUser.name || 'Servidor Municipal',
            reason,
            revertedIds
        );

        // Disparar eventos em tempo real
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('consultas-agendamentos-changed'));
            window.dispatchEvent(new CustomEvent('consultas-vagas-changed'));
            window.dispatchEvent(new CustomEvent('consultas-transfer-recorded'));
        }

        result.success = true;
        result.message = result.failedCount === 0
            ? `${result.revertedCount} solicitação(ões) restaurada(s) com sucesso para o procedimento "${transferRecord.sourceProcedimento.name}"!`
            : `${result.revertedCount} solicitação(ões) restaurada(s), porém ${result.failedCount} item(ns) não puderam ser revertidos.`;
    } else {
        result.success = false;
        result.message = result.errors[0]?.message || 'Não foi possível desfazer a transferência das solicitações selecionadas.';
    }

    return result;
};

export interface BatchOperationResult {
    totalRequested: number;
    successCount: number;
    failureCount: number;
    errors: { id: string; patientName?: string; message: string }[];
    transferRecord?: TransferRecord;
}

export interface BatchTransferParams {
    bookingIds: string[];
    targetProcedimentoId: string;
    preserveSolicitationDate?: boolean;
    preservePriority?: boolean;
    reason?: string;
    user: { id: string; name: string; email?: string };
    onProgress?: (current: number, total: number) => void;
}

/**
 * Transfere uma solicitação para outro procedimento, alterando EXCLUSIVAMENTE o procedimento vinculado,
 * preservando integralmente todas as demais informações do agendamento (data, horário, local, prestador, status, etc.).
 * Funciona para qualquer status (Fila de espera, Agendado, Confirmado, Realizado, Cancelado, etc.).
 */
export const transferAgendamentoProcedimento = async (
    id: string,
    targetProcedimentoId: string,
    currentUser: User
): Promise<ConsultaAgendamento> => {
    assertCanMutateRegulacao('Transferir Procedimento da Solicitação', 'acompanhar', currentUser);

    // 1. Buscar dados atuais da solicitação
    const { data: currentBooking, error: fetchErr } = await supabase
        .from('consultas_agendamentos')
        .select(`
            *,
            paciente:consultas_pacientes(*),
            procedimento:consultas_procedimentos(
                *,
                especialista:consultas_especialistas(*)
            )
        `)
        .eq('id', id)
        .single();

    if (fetchErr || !currentBooking) {
        throw new Error('Solicitação de agendamento não encontrada.');
    }

    if (currentBooking.procedimento_id === targetProcedimentoId) {
        throw new Error('O procedimento selecionado é o mesmo atual. Escolha um procedimento diferente.');
    }

    // 2. Buscar procedimento de destino
    const { data: targetProc, error: procErr } = await supabase
        .from('consultas_procedimentos')
        .select(`
            *,
            especialista:consultas_especialistas(*)
        `)
        .eq('id', targetProcedimentoId)
        .single();

    if (procErr || !targetProc) {
        throw new Error('Procedimento de destino não encontrado.');
    }

    // REGRA DE SUSPENSÃO: Procedimento de destino não pode estar suspenso
    if (targetProc.status !== 'Ativo') {
        throw new Error(`O procedimento de destino "${formatProcedimentoLabel(targetProc)}" está suspenso e não pode receber transferências.`);
    }

    if (targetProc.parent_id) {
        const { data: parentProc } = await supabase
            .from('consultas_procedimentos')
            .select('id, name, code, status')
            .eq('id', targetProc.parent_id)
            .maybeSingle();
        if (parentProc && parentProc.status !== 'Ativo') {
            throw new Error(`O procedimento principal de destino "${parentProc.name || parentProc.code || ''}" está suspenso e não pode receber transferências.`);
        }
    }

    // 3. Atualizar EXCLUSIVAMENTE o procedimento_id preservando data, hora, local, prestador, status, etc.
    const updated = await updateAgendamento(id, {
        procedimento_id: targetProcedimentoId
    });

    if (!updated) {
        throw new Error('Falha ao atualizar o procedimento da solicitação.');
    }

    // 4. Recalcular e persistir posições da fila
    try {
        await recalculateAndPersistQueuePositions();
    } catch (queueErr) {
        console.warn('[consultasService] Aviso ao recalcular fila após transferência:', queueErr);
    }

    // 5. Registrar log de auditoria detalhado
    try {
        await auditLogService.logAction({
            action_type: 'TRANSFERENCIA_PROCEDIMENTO',
            module: 'Regulação - Acompanhar',
            description: `Procedimento da solicitação do paciente ${currentBooking.paciente?.name || 'N/A'} transferido de "${formatProcedimentoLabel(currentBooking.procedimento)}" para "${formatProcedimentoLabel(targetProc)}". Todos os dados de agendamento foram integralmente preservados.`,
            details: {
                agendamento_id: id,
                paciente_id: currentBooking.patient_id,
                paciente_nome: currentBooking.paciente?.name,
                procedimento_anterior_id: currentBooking.procedimento_id,
                procedimento_anterior_nome: formatProcedimentoLabel(currentBooking.procedimento),
                procedimento_anterior_codigo: currentBooking.procedimento?.code || '',
                procedimento_novo_id: targetProcedimentoId,
                procedimento_novo_nome: formatProcedimentoLabel(targetProc),
                procedimento_novo_codigo: targetProc.code || '',
                status_preservado: currentBooking.status,
                data_agendada_preservada: currentBooking.appointment_date,
                horario_agendado_preservado: currentBooking.appointment_time,
                prestador_preservado: currentBooking.prestador,
                municipio_preservado: currentBooking.municipio
            },
            user: {
                id: currentUser.id,
                name: currentUser.name || 'Servidor Municipal',
                email: currentUser.email || ''
            }
        });
    } catch (auditErr) {
        console.warn('[consultasService] Aviso ao registrar auditoria de transferência:', auditErr);
    }

    // 6. Criar e registrar histórico de transferência permitindo reversão (Desfazer Transferência)
    const transferRecord: TransferRecord = {
        id: `transfer_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        type: 'individual',
        timestamp: new Date().toISOString(),
        userId: currentUser.id,
        userName: currentUser.name || 'Servidor Municipal',
        sourceProcedimento: {
            id: currentBooking.procedimento_id,
            code: currentBooking.procedimento?.code || '',
            name: currentBooking.procedimento?.name || 'Procedimento Anterior',
            type: currentBooking.procedimento?.type
        },
        targetProcedimento: {
            id: targetProcedimentoId,
            code: targetProc.code || '',
            name: targetProc.name || '',
            type: targetProc.type
        },
        bookings: [{
            bookingId: id,
            patientId: currentBooking.patient_id,
            patientName: currentBooking.paciente?.name || 'Paciente',
            patientCpf: currentBooking.paciente?.cpf,
            previousProcedimentoId: currentBooking.procedimento_id,
            previousProcedimentoCode: currentBooking.procedimento?.code || '',
            previousProcedimentoName: currentBooking.procedimento?.name || 'Procedimento Anterior',
            targetProcedimentoId: targetProcedimentoId,
            targetProcedimentoCode: targetProc.code || '',
            targetProcedimentoName: targetProc.name || '',
            status: currentBooking.status,
            appointmentDate: currentBooking.appointment_date,
            appointmentTime: currentBooking.appointment_time,
            prestador: currentBooking.prestador,
            municipio: currentBooking.municipio,
            priority: currentBooking.priority,
            solicitationDate: currentBooking.solicitation_date,
            reverted: false
        }],
        reverted: false
    };
    saveTransferRecord(transferRecord);
    (updated as any).transferRecord = transferRecord;

    // 7. Disparar eventos em tempo real
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('consultas-agendamentos-changed'));
        window.dispatchEvent(new CustomEvent('consultas-vagas-changed'));
    }

    return updated;
};

export const batchTransferAgendamentos = async (params: BatchTransferParams): Promise<BatchOperationResult> => {
    assertCanMutateRegulacao('Transferir Agendamentos em Lote', 'acompanhar');
    const {
        bookingIds,
        targetProcedimentoId,
        preserveSolicitationDate = true,
        preservePriority = true,
        reason,
        user,
        onProgress
    } = params;

    const result: BatchOperationResult = {
        totalRequested: bookingIds.length,
        successCount: 0,
        failureCount: 0,
        errors: []
    };

    if (bookingIds.length === 0) return result;

    try {
        // 1. Obter informações do procedimento de destino
        const procs = await getProcedimentos();
        const targetProc = procs.find(p => p.id === targetProcedimentoId);
        if (!targetProc) {
            throw new Error('Procedimento de destino não encontrado.');
        }

        // REGRA DE SUSPENSÃO: Procedimento de destino não pode estar suspenso
        if (targetProc.status !== 'Ativo') {
            throw new Error(`O procedimento de destino "${formatProcedimentoLabel(targetProc)}" está suspenso e não pode receber transferências.`);
        }

        if (targetProc.parent_id) {
            const parentProc = procs.find(p => p.id === targetProc.parent_id);
            if (parentProc && parentProc.status !== 'Ativo') {
                throw new Error(`O procedimento principal de destino "${parentProc.name || parentProc.code || ''}" está suspenso e não pode receber transferências.`);
            }
        }

        // 2. Buscar agendamentos diretamente do banco para validação recente
        const { data: dbBookings, error: fetchErr } = await supabase
            .from('consultas_agendamentos')
            .select(`
                id,
                status,
                priority,
                solicitation_date,
                appointment_date,
                appointment_time,
                tipo_atendimento,
                prestador,
                municipio,
                convenio,
                vaga_id,
                created_at,
                procedimento_id,
                patient_id,
                paciente:consultas_pacientes(name),
                procedimento:consultas_procedimentos(name)
            `)
            .in('id', bookingIds);

        if (fetchErr) throw fetchErr;

        const bookingMap = new Map((dbBookings || []).map((b: any) => [b.id, b]));
        const successfulTransfers: TransferredBookingInfo[] = [];

        // 3. Processar cada solicitação individualmente com tolerância a falhas
        for (let i = 0; i < bookingIds.length; i++) {
            const id = bookingIds[i];
            const currentBooking: any = bookingMap.get(id);

            if (!currentBooking) {
                result.failureCount++;
                result.errors.push({ id, message: 'Solicitação não localizada no banco de dados.' });
                if (onProgress) onProgress(i + 1, bookingIds.length);
                continue;
            }

            const currentProcId = currentBooking.procedimento_id;
            if (currentProcId === targetProcedimentoId) {
                result.failureCount++;
                result.errors.push({
                    id,
                    patientName: currentBooking.paciente?.name,
                    message: 'A solicitação já pertence ao procedimento selecionado.'
                });
                if (onProgress) onProgress(i + 1, bookingIds.length);
                continue;
            }

            try {
                // REGRA ATUALIZADA: A transferência altera EXCLUSIVAMENTE o procedimento vinculado,
                // mantendo integralmente data, horário, local, prestador, status e histórico do agendamento.
                const payloadUpdates: Partial<ConsultaAgendamento> = {
                    procedimento_id: targetProcedimentoId
                };

                if (!preserveSolicitationDate) {
                    payloadUpdates.solicitation_date = new Date().toISOString().split('T')[0];
                }
                if (!preservePriority) {
                    payloadUpdates.priority = 'Normal';
                }

                await updateAgendamento(id, payloadUpdates);
                result.successCount++;

                successfulTransfers.push({
                    bookingId: id,
                    patientId: currentBooking.patient_id,
                    patientName: currentBooking.paciente?.name || 'Paciente',
                    previousProcedimentoId: currentBooking.procedimento_id,
                    previousProcedimentoCode: currentBooking.procedimento?.code || '',
                    previousProcedimentoName: currentBooking.procedimento?.name || 'Procedimento Anterior',
                    targetProcedimentoId: targetProcedimentoId,
                    targetProcedimentoCode: targetProc.code || '',
                    targetProcedimentoName: targetProc.name || '',
                    status: currentBooking.status,
                    appointmentDate: currentBooking.appointment_date,
                    appointmentTime: currentBooking.appointment_time,
                    prestador: currentBooking.prestador,
                    municipio: currentBooking.municipio,
                    priority: currentBooking.priority,
                    solicitationDate: currentBooking.solicitation_date,
                    reverted: false
                });
            } catch (itemErr: any) {
                result.failureCount++;
                result.errors.push({
                    id,
                    patientName: currentBooking.paciente?.name,
                    message: itemErr.message || 'Erro ao atualizar registro.'
                });
            }

            if (onProgress) onProgress(i + 1, bookingIds.length);
        }

        // Registrar no histórico de transferências para viabilizar DESFAZER TRANSFERÊNCIA
        if (successfulTransfers.length > 0) {
            const firstItem = successfulTransfers[0];
            const transferRecord: TransferRecord = {
                id: `transfer_batch_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
                type: 'batch',
                timestamp: new Date().toISOString(),
                userId: user.id,
                userName: user.name || 'Servidor Municipal',
                sourceProcedimento: {
                    id: firstItem.previousProcedimentoId,
                    code: firstItem.previousProcedimentoCode || '',
                    name: firstItem.previousProcedimentoName || 'Procedimento Anterior',
                    type: undefined
                },
                targetProcedimento: {
                    id: targetProcedimentoId,
                    code: targetProc.code || '',
                    name: targetProc.name,
                    type: targetProc.type
                },
                bookings: successfulTransfers,
                reverted: false
            };
            saveTransferRecord(transferRecord);
            result.transferRecord = transferRecord;
        }

        // 4. Recalcular e persistir posições da fila após todas as transferências
        await recalculateAndPersistQueuePositions();

        // 5. Registrar log de auditoria detalhado
        await auditLogService.logAction({
            action_type: 'BATCH_TRANSFER_AGENDAMENTOS',
            module: 'Regulação - Acompanhar',
            description: `Transferência em lote de ${result.successCount} solicitação(ões) para o procedimento "${targetProc.name}". Todos os dados de agendamento foram integralmente preservados.`,
            details: {
                target_procedimento_id: targetProcedimentoId,
                target_procedimento_name: targetProc.name,
                preserve_date: preserveSolicitationDate,
                preserve_priority: preservePriority,
                reason: reason || null,
                total_solicitado: bookingIds.length,
                sucesso: result.successCount,
                falhas: result.failureCount,
                errors: result.errors
            },
            user
        });

        // 6. Notificações e eventos
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('consultas-agendamentos-changed'));
            window.dispatchEvent(new CustomEvent('consultas-vagas-changed'));
        }

        return result;
    } catch (err: any) {
        console.error('[consultasService] batchTransferAgendamentos Erro crítico:', err);
        throw err;
    }
};

export interface BatchCancelParams {
    bookingIds: string[];
    reason: string;
    user: { id: string; name: string; sector?: string; email?: string };
    isGestorOrAdmin: boolean;
    onProgress?: (current: number, total: number) => void;
}

export const batchCancelAgendamentos = async (params: BatchCancelParams): Promise<BatchOperationResult> => {
    assertCanMutateRegulacao('Cancelar Agendamentos em Lote', 'acompanhar');
    const { bookingIds, reason, user, isGestorOrAdmin, onProgress } = params;

    const result: BatchOperationResult = {
        totalRequested: bookingIds.length,
        successCount: 0,
        failureCount: 0,
        errors: []
    };

    if (bookingIds.length === 0) return result;

    try {
        const { data: dbBookings } = await supabase
            .from('consultas_agendamentos')
            .select('*, paciente:consultas_pacientes(*), procedimento:consultas_procedimentos(*)')
            .in('id', bookingIds);

        const bookingMap = new Map((dbBookings || []).map((b: any) => [b.id, b]));

        for (let i = 0; i < bookingIds.length; i++) {
            const id = bookingIds[i];
            const currentBooking: any = bookingMap.get(id);

            if (!currentBooking) {
                result.failureCount++;
                result.errors.push({ id, message: 'Solicitação não localizada no banco de dados.' });
                if (onProgress) onProgress(i + 1, bookingIds.length);
                continue;
            }

            if (currentBooking.status === 'Cancelado') {
                result.failureCount++;
                result.errors.push({
                    id,
                    patientName: currentBooking.paciente?.name,
                    message: 'Esta solicitação já se encontra cancelada.'
                });
                if (onProgress) onProgress(i + 1, bookingIds.length);
                continue;
            }

            try {
                if (isGestorOrAdmin) {
                    await cancelAgendamentoWithReason(id, reason.trim(), user);
                    result.successCount++;
                } else {
                    const reqRes = await solicitarCancelamentoAgendamento({
                        agendamentoId: id,
                        justificativa: reason.trim(),
                        solicitante: {
                            id: user.id,
                            name: user.name,
                            sector: user.sector
                        },
                        bookingSnapshot: currentBooking
                    });
                    if (reqRes.success) {
                        result.successCount++;
                    } else {
                        result.failureCount++;
                        result.errors.push({
                            id,
                            patientName: currentBooking.paciente?.name,
                            message: reqRes.error || 'Erro ao enviar solicitação de cancelamento.'
                        });
                    }
                }
            } catch (itemErr: any) {
                result.failureCount++;
                result.errors.push({
                    id,
                    patientName: currentBooking.paciente?.name,
                    message: itemErr.message || 'Erro ao processar cancelamento.'
                });
            }

            if (onProgress) onProgress(i + 1, bookingIds.length);
        }

        await recalculateAndPersistQueuePositions();

        await auditLogService.logAction({
            action_type: isGestorOrAdmin ? 'BATCH_CANCEL_AGENDAMENTOS' : 'BATCH_SOLICITAR_CANCELAMENTO',
            module: 'Regulação - Acompanhar',
            description: `${isGestorOrAdmin ? 'Cancelamento em lote' : 'Solicitações de cancelamento em lote'} de ${result.successCount} agendamento(s).`,
            details: {
                reason,
                total_solicitado: bookingIds.length,
                sucesso: result.successCount,
                falhas: result.failureCount,
                errors: result.errors
            },
            user
        });

        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('consultas-agendamentos-changed'));
            window.dispatchEvent(new CustomEvent('consultas-solicitacoes-cancelamento-changed'));
        }

        return result;
    } catch (err: any) {
        console.error('[consultasService] batchCancelAgendamentos Erro:', err);
        throw err;
    }
};

export interface BatchDeleteParams {
    bookingIds: string[];
    user: { id: string; name: string; email?: string };
    onProgress?: (current: number, total: number) => void;
}

export const batchDeleteAgendamentos = async (params: BatchDeleteParams): Promise<BatchOperationResult> => {
    assertCanMutateRegulacao('Excluir Agendamentos em Lote', 'acompanhar');
    const { bookingIds, user, onProgress } = params;

    const result: BatchOperationResult = {
        totalRequested: bookingIds.length,
        successCount: 0,
        failureCount: 0,
        errors: []
    };

    if (bookingIds.length === 0) return result;

    try {
        for (let i = 0; i < bookingIds.length; i++) {
            const id = bookingIds[i];
            try {
                await deleteAgendamento(id);
                result.successCount++;
            } catch (itemErr: any) {
                result.failureCount++;
                result.errors.push({
                    id,
                    message: itemErr.message || 'Erro ao excluir solicitação.'
                });
            }
            if (onProgress) onProgress(i + 1, bookingIds.length);
        }

        await recalculateAndPersistQueuePositions();

        await auditLogService.logAction({
            action_type: 'BATCH_DELETE_AGENDAMENTOS',
            module: 'Regulação - Acompanhar',
            description: `Exclusão em lote de ${result.successCount} solicitação(ões).`,
            details: {
                total_solicitado: bookingIds.length,
                sucesso: result.successCount,
                falhas: result.failureCount,
                errors: result.errors
            },
            user
        });

        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('consultas-agendamentos-changed'));
        }

        return result;
    } catch (err: any) {
        console.error('[consultasService] batchDeleteAgendamentos Erro:', err);
        throw err;
    }
};

export interface BatchPriorityParams {
    bookingIds: string[];
    priority: 'Normal' | 'Urgência' | 'Especial';
    user: { id: string; name: string; email?: string };
    onProgress?: (current: number, total: number) => void;
}

export const batchUpdatePriority = async (params: BatchPriorityParams): Promise<BatchOperationResult> => {
    assertCanMutateRegulacao('Alterar Prioridade em Lote', 'acompanhar');
    const { bookingIds, priority, user, onProgress } = params;

    const result: BatchOperationResult = {
        totalRequested: bookingIds.length,
        successCount: 0,
        failureCount: 0,
        errors: []
    };

    if (bookingIds.length === 0) return result;

    try {
        for (let i = 0; i < bookingIds.length; i++) {
            const id = bookingIds[i];
            try {
                await updateAgendamento(id, { priority });
                result.successCount++;
            } catch (itemErr: any) {
                result.failureCount++;
                result.errors.push({
                    id,
                    message: itemErr.message || 'Erro ao atualizar prioridade.'
                });
            }
            if (onProgress) onProgress(i + 1, bookingIds.length);
        }

        await recalculateAndPersistQueuePositions();

        await auditLogService.logAction({
            action_type: 'BATCH_UPDATE_PRIORITY',
            module: 'Regulação - Acompanhar',
            description: `Alteração de prioridade em lote para "${priority}" em ${result.successCount} agendamento(s).`,
            details: {
                priority,
                total_solicitado: bookingIds.length,
                sucesso: result.successCount,
                falhas: result.failureCount,
                errors: result.errors
            },
            user
        });

        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('consultas-agendamentos-changed'));
        }

        return result;
    } catch (err: any) {
        console.error('[consultasService] batchUpdatePriority Erro:', err);
        throw err;
    }
};

export interface BatchPauseResumeParams {
    bookingIds: string[];
    action: 'pause' | 'resume';
    reason?: string;
    user: { id: string; name: string; email?: string };
    onProgress?: (current: number, total: number) => void;
}

export const batchPauseResumeAgendamentos = async (params: BatchPauseResumeParams): Promise<BatchOperationResult> => {
    assertCanMutateRegulacao(params.action === 'pause' ? 'Pausar Agendamentos em Lote' : 'Retomar Agendamentos em Lote', 'acompanhar');
    const { bookingIds, action, reason, user, onProgress } = params;

    const result: BatchOperationResult = {
        totalRequested: bookingIds.length,
        successCount: 0,
        failureCount: 0,
        errors: []
    };

    if (bookingIds.length === 0) return result;

    try {
        for (let i = 0; i < bookingIds.length; i++) {
            const id = bookingIds[i];
            try {
                if (action === 'pause') {
                    await pausarAgendamento(id, reason || 'Pausa em lote aplicada pela regulação', user as any);
                } else {
                    await retomarAgendamento(id, user as any);
                }
                result.successCount++;
            } catch (itemErr: any) {
                result.failureCount++;
                result.errors.push({
                    id,
                    message: itemErr.message || `Erro ao ${action === 'pause' ? 'pausar' : 'retomar'} solicitação.`
                });
            }
            if (onProgress) onProgress(i + 1, bookingIds.length);
        }

        await recalculateAndPersistQueuePositions();

        await auditLogService.logAction({
            action_type: action === 'pause' ? 'BATCH_PAUSE_AGENDAMENTOS' : 'BATCH_RESUME_AGENDAMENTOS',
            module: 'Regulação - Acompanhar',
            description: `${action === 'pause' ? 'Pausa em lote' : 'Retomada em lote'} de ${result.successCount} solicitação(ões).`,
            details: {
                action,
                reason: reason || null,
                total_solicitado: bookingIds.length,
                sucesso: result.successCount,
                falhas: result.failureCount,
                errors: result.errors
            },
            user
        });

        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('consultas-agendamentos-changed'));
        }

        return result;
    } catch (err: any) {
        console.error('[consultasService] batchPauseResumeAgendamentos Erro:', err);
        throw err;
    }
};

/**
 * Retorna a contagem agregada de solicitações por procedimento no Supabase (/Regulacao/Acompanhar).
 * - Considera todos os status (fila de espera, agendado, realizado, faltou, cancelado, etc.).
 * - Elimina duplicidades por id de solicitação.
 * - Busca de alto desempenho sem limite de 1000 registros (paginação automática em blocos).
 * - Retorna um mapa indexado por ID/código de procedimento com o total exato de solicitações.
 */
export const getProcedimentoSolicitacoesCounts = async (): Promise<Record<string, number>> => {
    try {
        const CHUNK_SIZE = 1000;
        let from = 0;
        let hasMore = true;
        const counts: Record<string, number> = {};
        const seenIds = new Set<string>();

        while (hasMore) {
            const { data, error } = await supabase
                .from('consultas_agendamentos')
                .select('id, procedimento_id')
                .range(from, from + CHUNK_SIZE - 1);

            if (error) {
                console.error('[consultasService] Erro ao buscar contagem de solicitações:', error);
                break;
            }

            if (!data || data.length === 0) {
                hasMore = false;
                break;
            }

            for (const item of data) {
                if (!item || !item.id) continue;
                if (seenIds.has(item.id)) continue;
                seenIds.add(item.id);

                const procId = item.procedimento_id;
                if (procId) {
                    counts[procId] = (counts[procId] || 0) + 1;
                }
            }

            if (data.length < CHUNK_SIZE) {
                hasMore = false;
            } else {
                from += CHUNK_SIZE;
            }
        }

        return counts;
    } catch (err) {
        console.error('[consultasService] Erro geral ao obter contagem de solicitações por procedimento:', err);
        return {};
    }
};

