import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ConsultaPaciente } from '../../../types';
import { useAgentesSaude } from '../../../services/agentesSaudeService';
import * as db from '../../../services/consultasService';
import {
    DuplicatePatientCpfError,
    PacienteSmartSearchCriterion,
    PacienteSmartSearchStatus
} from '../../../services/consultasService';
import {
    normalizeCpf,
    formatCpf,
    isValidCpf,
    formatBirthDateBr,
    calculateAgeYears,
    normalizeCns,
    isValidCns,
    maskCpfPartial,
    maskCnsPartial,
    detectarCriterioPesquisaPaciente
} from '../../../utils/cpfUtils';
import {
    validateBrazilianPhone,
    formatBrazilianPhone,
    formatWhatsApp,
    maskWhatsAppInput,
    formatLandlinePhone,
    maskLandlineInput,
    validateWhatsApp,
    validateLandlinePhone,
    TELEFONE_INVALIDO_MSG
} from '../../../utils/phoneValidation';
import {
    X,
    User,
    Save,
    Loader2,
    AlertTriangle,
    ShieldCheck,
    Search,
    CheckCircle2,
    UserCheck,
    UserPlus,
    Lock,
    WifiOff,
    ShieldAlert,
    RotateCcw,
    Calendar,
    CreditCard,
    ArrowLeft
} from 'lucide-react';

export interface PacienteFormSuccessMeta {
    isNew: boolean;
}

interface PacienteFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (paciente: ConsultaPaciente, meta?: PacienteFormSuccessMeta) => void;
    editingPatient?: ConsultaPaciente | null;
}

type ModalStep = 'search' | 'register' | 'error';

export const PacienteFormModal: React.FC<PacienteFormModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
    editingPatient
}) => {
    const { items: agentesSaudeItems } = useAgentesSaude();

    // Etapa do modal: Pesquisa Inteligente, Cadastro/Edição ou Erro de Consulta
    const [step, setStep] = useState<ModalStep>('search');
    const [searchTerm, setSearchTerm] = useState('');
    const [detectedCriterion, setDetectedCriterion] = useState<PacienteSmartSearchCriterion>('texto');
    const [isSearching, setIsSearching] = useState(false);
    const [searchStatus, setSearchStatus] = useState<PacienteSmartSearchStatus | 'idle'>('idle');
    const [searchValidationError, setSearchValidationError] = useState('');
    const [searchResults, setSearchResults] = useState<ConsultaPaciente[]>([]);
    const [lookupErrorState, setLookupErrorState] = useState<{
        status: PacienteSmartSearchStatus;
        message: string;
    } | null>(null);
    const [duplicateConflictPatient, setDuplicateConflictPatient] = useState<ConsultaPaciente | null>(null);

    // Controle de corrida, debounce e prevenção de requisições duplicadas
    const activeAbortControllerRef = useRef<AbortController | null>(null);
    const inFlightQueryKeyRef = useRef<string | null>(null);
    const lastCompletedQueryKeyRef = useRef<string | null>(null);
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lookupSequenceRef = useRef<number>(0);
    const searchFieldRef = useRef<HTMLInputElement>(null);
    const nomeFieldRef = useRef<HTMLInputElement>(null);

    // Estados do formulário de cadastro/edição
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [whatsappError, setWhatsappError] = useState('');
    const [telefoneFixoError, setTelefoneFixoError] = useState('');
    const [cpfLocked, setCpfLocked] = useState(false);
    const [nome, setNome] = useState('');
    const [apelido, setApelido] = useState('');
    const [cpf, setCpf] = useState('');
    const [dataNascimento, setDataNascimento] = useState('');
    const [whatsapp, setWhatsapp] = useState('');
    const [telefoneFixo, setTelefoneFixo] = useState('');
    const [bairro, setBairro] = useState('');
    const [rua, setRua] = useState('');
    const [cidade, setCidade] = useState('SÃO JOSÉ DO GOIABAL -MG');
    const [susNumber, setSusNumber] = useState('');
    const [agenteSaude, setAgenteSaude] = useState('');

    const cancelPendingLookup = () => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
            debounceTimerRef.current = null;
        }
        if (activeAbortControllerRef.current) {
            activeAbortControllerRef.current.abort();
            activeAbortControllerRef.current = null;
        }
        inFlightQueryKeyRef.current = null;
    };

    const resetFormFields = (opts?: { lockedCleanCpf?: string; prefillCns?: string; prefillNome?: string }) => {
        setNome(opts?.prefillNome ? opts.prefillNome.trim().toUpperCase() : '');
        setApelido('');
        const cleanCpf = opts?.lockedCleanCpf ? normalizeCpf(opts.lockedCleanCpf) : '';
        setCpf(cleanCpf ? formatCpf(cleanCpf) : '');
        setCpfLocked(Boolean(cleanCpf));
        setDataNascimento('');
        setWhatsapp('');
        setTelefoneFixo('');
        setBairro('');
        setRua('');
        setCidade('SÃO JOSÉ DO GOIABAL -MG');
        setSusNumber(opts?.prefillCns ? normalizeCns(opts.prefillCns) : '');
        setAgenteSaude('');
        setError('');
        setWhatsappError('');
        setTelefoneFixoError('');
        setDuplicateConflictPatient(null);
    };

    useEffect(() => {
        if (!isOpen) {
            cancelPendingLookup();
            return;
        }

        if (editingPatient) {
            cancelPendingLookup();
            setStep('register');
            setCpfLocked(false);
            setNome(editingPatient.name || '');
            setApelido(editingPatient.nickname || '');
            setCpf(formatCpf(editingPatient.cpf || ''));
            setDataNascimento(editingPatient.birth_date || '');
            setWhatsapp(editingPatient.phone ? formatWhatsApp(editingPatient.phone) : '');
            setTelefoneFixo(editingPatient.phone_fixed ? formatLandlinePhone(editingPatient.phone_fixed) : '');
            setBairro(editingPatient.neighborhood || '');
            setRua(editingPatient.street || '');
            setCidade(editingPatient.city || 'SÃO JOSÉ DO GOIABAL -MG');
            setSusNumber(editingPatient.sus_number || '');
            setAgenteSaude(editingPatient.agente_saude || '');
            setError('');
            setWhatsappError('');
            setTelefoneFixoError('');
            setSearchValidationError('');
            setLookupErrorState(null);
            setDuplicateConflictPatient(null);
        } else {
            cancelPendingLookup();
            setStep('search');
            setSearchTerm('');
            setDetectedCriterion('texto');
            setIsSearching(false);
            setSearchStatus('idle');
            setSearchValidationError('');
            setSearchResults([]);
            setLookupErrorState(null);
            lastCompletedQueryKeyRef.current = null;
            resetFormFields();
            setTimeout(() => searchFieldRef.current?.focus(), 60);
        }
    }, [editingPatient, isOpen]);

    useEffect(() => {
        if (isOpen && step === 'register' && !editingPatient) {
            setTimeout(() => nomeFieldRef.current?.focus(), 140);
        }
    }, [isOpen, step, editingPatient]);

    // Trava rolagem do fundo enquanto modal aberto e fecha com ESC
    useEffect(() => {
        if (!isOpen) return;
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !loading) {
                cancelPendingLookup();
                onClose();
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => {
            document.body.style.overflow = prevOverflow;
            window.removeEventListener('keydown', onKeyDown);
        };
    }, [isOpen, loading, onClose]);

    useEffect(() => {
        return () => cancelPendingLookup();
    }, []);

    if (!isOpen) return null;

    // Executa pesquisa inteligente somente leitura na base integrada
    const executeSmartSearch = async (rawQuery: string, forceRefresh = false) => {
        const { criterion, digits, normalizedText } = detectarCriterioPesquisaPaciente(rawQuery);
        setDetectedCriterion(criterion);

        // Validações prévias antes de consultar o servidor
        if (criterion === 'cpf') {
            if (!isValidCpf(digits)) {
                cancelPendingLookup();
                setIsSearching(false);
                setSearchStatus('invalid_cpf');
                setSearchResults([]);
                setSearchValidationError('CPF inválido. Confira os 11 dígitos informados.');
                return;
            }
        } else if (criterion === 'cns') {
            if (digits.length < 15) return;
        } else if (normalizedText.length < 3 && digits.length < 3) {
            cancelPendingLookup();
            setIsSearching(false);
            setSearchStatus('idle');
            setSearchResults([]);
            setSearchValidationError('');
            return;
        }

        const queryKey = `${criterion}:${criterion === 'texto' ? normalizedText : digits}`;
        if (!forceRefresh && (inFlightQueryKeyRef.current === queryKey || lastCompletedQueryKeyRef.current === queryKey)) {
            return;
        }

        cancelPendingLookup();
        const controller = new AbortController();
        activeAbortControllerRef.current = controller;
        inFlightQueryKeyRef.current = queryKey;
        const seqId = ++lookupSequenceRef.current;

        setSearchValidationError('');
        setLookupErrorState(null);
        setIsSearching(true);

        try {
            const result = await db.searchPacientesInteligente(rawQuery, {
                signal: controller.signal,
                limit: 20
            });

            if (controller.signal.aborted || lookupSequenceRef.current !== seqId || result.status === 'aborted') {
                return;
            }

            if (result.status === 'invalid_cpf') {
                setSearchStatus('invalid_cpf');
                setSearchResults([]);
                setSearchValidationError(result.error || 'CPF inválido.');
                return;
            }

            if (result.status === 'too_short') {
                setSearchStatus('idle');
                setSearchResults([]);
                return;
            }

            if (result.status === 'results') {
                lastCompletedQueryKeyRef.current = queryKey;
                setSearchResults(result.pacientes);
                setSearchStatus('results');
                return;
            }

            if (result.status === 'not_found') {
                lastCompletedQueryKeyRef.current = queryKey;
                setSearchResults([]);
                setSearchStatus('not_found');
                return;
            }

            // Erro de conexão, falta de permissão ou falha técnica: NUNCA abre cadastro automaticamente
            setLookupErrorState({
                status: result.status,
                message: result.error || 'Não foi possível pesquisar na base integrada municipal.'
            });
            setStep('error');
        } finally {
            if (lookupSequenceRef.current === seqId) {
                setIsSearching(false);
                if (inFlightQueryKeyRef.current === queryKey) {
                    inFlightQueryKeyRef.current = null;
                }
            }
        }
    };

    const handleSearchInputChange = (val: string) => {
        setSearchTerm(val);
        setSearchValidationError('');
        setLookupErrorState(null);
        lastCompletedQueryKeyRef.current = null;

        const { criterion, digits, normalizedText } = detectarCriterioPesquisaPaciente(val);
        setDetectedCriterion(criterion);

        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
            debounceTimerRef.current = null;
        }

        if (criterion === 'cpf') {
            // CPF completo (11 dígitos): consulta imediata sem exigir escolha de filtro
            void executeSmartSearch(val);
            return;
        }

        if (criterion === 'cns') {
            // CNS completo (15 dígitos): consulta imediata
            void executeSmartSearch(val);
            return;
        }

        // Pesquisa textual: inicia somente após 3 caracteres com debounce ~350 ms
        if (normalizedText.length < 3 && digits.length < 3) {
            cancelPendingLookup();
            setIsSearching(false);
            setSearchResults([]);
            setSearchStatus('idle');
            return;
        }

        debounceTimerRef.current = setTimeout(() => {
            void executeSmartSearch(val);
        }, 350);
    };

    const handleOpenRegisterFromSearch = () => {
        cancelPendingLookup();
        const { criterion, digits } = detectarCriterioPesquisaPaciente(searchTerm);
        const rawTrim = searchTerm.trim();
        const hasLetters = /[a-zA-ZÀ-ÿ]/.test(rawTrim);

        if (criterion === 'cpf' && isValidCpf(digits)) {
            resetFormFields({ lockedCleanCpf: digits });
        } else if (criterion === 'cns' || (digits.length === 15 && !hasLetters && isValidCns(digits))) {
            resetFormFields({ prefillCns: digits });
        } else if (hasLetters && rawTrim.length >= 3) {
            resetFormFields({ prefillNome: rawTrim });
        } else {
            resetFormFields();
        }
        setStep('register');
    };

    const handleBackToSearch = () => {
        cancelPendingLookup();
        setStep('search');
        setError('');
        setDuplicateConflictPatient(null);
        setTimeout(() => searchFieldRef.current?.focus(), 60);
    };

    const handleSelectExistingPatient = (patient: ConsultaPaciente) => {
        cancelPendingLookup();
        onSuccess(patient, { isNew: false });
        onClose();
    };

    const handleWhatsAppChange = (val: string) => {
        const masked = maskWhatsAppInput(val);
        setWhatsapp(masked);

        const clean = masked.replace(/\D/g, '');
        if (!clean) {
            setWhatsappError('O WhatsApp é obrigatório.');
        } else if (clean.length === 11) {
            const check = validateWhatsApp(masked, { required: true });
            if (!check.isValid) {
                setWhatsappError(check.errorMessage || 'WhatsApp celular inválido.');
            } else {
                setWhatsappError('');
            }
        } else if (clean.length > 2 && clean[2] !== '9') {
            setWhatsappError('O WhatsApp celular deve iniciar com o dígito 9.');
        } else {
            setWhatsappError('');
        }
    };

    const handleTelefoneFixoChange = (val: string) => {
        const masked = maskLandlineInput(val);
        setTelefoneFixo(masked);

        const clean = masked.replace(/\D/g, '');
        if (!clean) {
            setTelefoneFixoError('');
        } else if (clean.length === 10) {
            const check = validateLandlinePhone(masked, { required: false });
            if (!check.isValid) {
                setTelefoneFixoError(check.errorMessage || 'Telefone Fixo inválido.');
            } else {
                setTelefoneFixoError('');
            }
        } else if (clean.length > 2) {
            const first = Number(clean[2]);
            if (first < 2 || first > 5) {
                setTelefoneFixoError('Telefone fixo deve iniciar com dígito entre 2 e 5.');
            } else {
                setTelefoneFixoError('');
            }
        } else {
            setTelefoneFixoError('');
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setDuplicateConflictPatient(null);

        const cleanCpf = normalizeCpf(cpf);
        if (!isValidCpf(cleanCpf)) {
            setError('CPF inválido. Informe um CPF com 11 dígitos verificadores válidos.');
            return;
        }

        if (!nome.trim()) {
            setError('O Nome Completo é obrigatório.');
            return;
        }

        if (!dataNascimento) {
            setError('A Data de Nascimento é obrigatória.');
            return;
        }

        const todayIso = new Date().toISOString().split('T')[0];
        if (dataNascimento > todayIso) {
            setError('A Data de Nascimento não pode ser futura.');
            return;
        }

        // Validação Obrigatória de WhatsApp (Celular)
        const whatsappValidation = validateWhatsApp(whatsapp, { required: true });
        if (!whatsappValidation.isValid) {
            const errorMsg = whatsappValidation.errorMessage || 'Informe um número de WhatsApp celular válido.';
            setWhatsappError(errorMsg);
            setError(errorMsg);
            return;
        }
        const phoneFormatted = whatsappValidation.formatted || whatsapp.trim();

        // Validação de Telefone Fixo (Opcional)
        let phoneFixedFormatted: string | null = null;
        if (telefoneFixo.trim()) {
            const fixoValidation = validateLandlinePhone(telefoneFixo, { required: false });
            if (!fixoValidation.isValid) {
                const errorMsg = fixoValidation.errorMessage || 'Informe um Telefone Fixo válido.';
                setTelefoneFixoError(errorMsg);
                setError(errorMsg);
                return;
            }
            phoneFixedFormatted = fixoValidation.formatted || telefoneFixo.trim();
        }

        setLoading(true);
        try {
            // Verifica novamente a existência na base antes de salvar (quando novo cadastro)
            if (!editingPatient) {
                const checkExisting = await db.lookupPacienteByCpf(cleanCpf);
                if (checkExisting.status === 'found' && checkExisting.paciente) {
                    setDuplicateConflictPatient(checkExisting.paciente);
                    setError('Já existe um paciente cadastrado com este CPF na base integrada.');
                    setLoading(false);
                    return;
                }
                if (checkExisting.status === 'permission_denied' || checkExisting.status === 'connection_error') {
                    setError(checkExisting.error || 'Não foi possível verificar duplicidade na base integrada.');
                    setLoading(false);
                    return;
                }
            }

            const payload = {
                name: nome.trim().toUpperCase(),
                nickname: apelido.trim() ? apelido.trim().toUpperCase() : null,
                cpf: cleanCpf,
                birth_date: dataNascimento,
                phone: phoneFormatted,
                phone_fixed: phoneFixedFormatted,
                neighborhood: bairro.trim() ? bairro.trim().toUpperCase() : null,
                street: rua.trim() ? rua.trim().toUpperCase() : null,
                city: cidade.trim() ? cidade.trim().toUpperCase() : 'SÃO JOSÉ DO GOIABAL -MG',
                sus_number: susNumber.trim() ? normalizeCns(susNumber) : null,
                agente_saude: agenteSaude ? agenteSaude.toUpperCase() : null
            };

            let saved: ConsultaPaciente | null = null;
            if (editingPatient) {
                saved = await db.updatePaciente(editingPatient.id, payload as any);
            } else {
                saved = await db.createPaciente(payload as any, { strictNoDuplicate: true });
            }

            if (saved) {
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('consultas-pacientes-changed', { detail: saved }));
                    window.dispatchEvent(new CustomEvent('paciente-alterado', { detail: saved }));
                }
                onSuccess(saved, { isNew: !editingPatient });
                onClose();
            } else {
                setError('Não foi possível salvar o paciente no banco de dados.');
            }
        } catch (err: any) {
            console.error('Erro ao salvar paciente:', err);
            if (err instanceof DuplicatePatientCpfError || err?.code === 'DUPLICATE_PATIENT_CPF') {
                setDuplicateConflictPatient(err.existingPatient || null);
                setError(err.message || 'Já existe um paciente cadastrado com este CPF na base integrada.');
            } else {
                setError(err?.message || 'Erro ao salvar paciente.');
            }
        } finally {
            setLoading(false);
        }
    };

    const isExpandedForm = step === 'register' || Boolean(editingPatient);
    const todayDateMax = new Date().toISOString().split('T')[0];

    const badgeCriterio = () => {
        if (!searchTerm.trim()) return null;
        if (detectedCriterion === 'cpf') {
            return (
                <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-black uppercase">
                    CPF (11 dígitos)
                </span>
            );
        }
        if (detectedCriterion === 'cns') {
            return (
                <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-black uppercase">
                    Cartão SUS (15 dígitos)
                </span>
            );
        }
        return (
            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-bold">
                Nome ou Apelido
            </span>
        );
    };

    const modalContent = (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
            onClick={(e) => {
                if (e.target === e.currentTarget && !loading) {
                    cancelPendingLookup();
                    onClose();
                }
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="paciente-modal-title"
        >
            <div
                className={`bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-h-[96vh] sm:max-h-[92vh] flex flex-col overflow-hidden transition-all duration-200 ease-out animate-in zoom-in-95 ${
                    isExpandedForm ? 'max-w-xl sm:max-w-2xl lg:max-w-3xl' : 'max-w-xl'
                }`}
            >
                {/* Cabeçalho Azul e Roxo Preservado */}
                <div className="px-4 py-3 sm:px-5 sm:py-3.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-white/15 flex items-center justify-center border border-white/25 shrink-0">
                            {editingPatient ? (
                                <User className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-white" />
                            ) : step === 'register' ? (
                                <UserPlus className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-white" />
                            ) : (
                                <Search className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-white" />
                            )}
                        </div>
                        <div className="min-w-0">
                            <h3 id="paciente-modal-title" className="text-sm sm:text-base font-black tracking-tight truncate">
                                {editingPatient
                                    ? 'Editar Cadastro do Paciente'
                                    : step === 'register'
                                    ? 'Cadastrar Novo Paciente'
                                    : 'Localizar Paciente'}
                            </h3>
                            <p className="text-[10px] sm:text-xs text-indigo-100 font-medium truncate">
                                Base Integrada Municipal (Regulação, Farmácia Popular e AutoSenha)
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            cancelPendingLookup();
                            onClose();
                        }}
                        disabled={loading}
                        className="p-1.5 sm:p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                        title="Fechar"
                        aria-label="Fechar modal Localizar Paciente"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* ETAPA 1: PESQUISA INTELIGENTE DE PACIENTES */}
                {!editingPatient && step === 'search' && (
                    <div className="p-4 sm:p-6 flex flex-col gap-4 flex-1 min-h-0 overflow-hidden">
                        {/* Campo Único Amplo e Destacado */}
                        <div className="space-y-1.5 shrink-0">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <label
                                    htmlFor="paciente-pesquisa-inteligente"
                                    className="text-xs font-black uppercase tracking-wider text-slate-700"
                                >
                                    Localizar Paciente
                                </label>
                                <div className="flex items-center gap-2">
                                    {badgeCriterio()}
                                    {isSearching && (
                                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-indigo-600">
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            Pesquisando...
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="relative">
                                <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                                <input
                                    id="paciente-pesquisa-inteligente"
                                    ref={searchFieldRef}
                                    type="text"
                                    autoComplete="off"
                                    value={searchTerm}
                                    onChange={(e) => handleSearchInputChange(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            void executeSmartSearch(searchTerm, true);
                                        }
                                    }}
                                    placeholder="Digite nome, CPF, Cartão SUS ou apelido..."
                                    className={`w-full bg-slate-50 border-2 rounded-2xl pl-12 pr-11 py-3.5 text-sm sm:text-base font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-medium focus:bg-white focus:ring-4 transition-all outline-none ${
                                        searchValidationError
                                            ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-500/10'
                                            : 'border-slate-200 focus:border-indigo-500 focus:ring-indigo-500/10'
                                    }`}
                                />
                                {isSearching ? (
                                    <Loader2 className="w-5 h-5 text-indigo-600 animate-spin absolute right-3.5 top-1/2 -translate-y-1/2" />
                                ) : searchTerm ? (
                                    <button
                                        type="button"
                                        onClick={() => handleSearchInputChange('')}
                                        className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer"
                                        title="Limpar pesquisa"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                ) : null}
                            </div>
                        </div>

                        {searchValidationError && (
                            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3 text-xs text-rose-800 font-semibold flex items-center gap-2 shrink-0 animate-in fade-in duration-150">
                                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                                <span>{searchValidationError}</span>
                            </div>
                        )}

                        {/* Área de Resultados / Orientação / Não Encontrado */}
                        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                            {searchStatus === 'idle' && !searchValidationError && !isSearching && (
                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-start gap-3 text-xs text-slate-600">
                                    <ShieldCheck className="w-4.5 h-4.5 text-indigo-600 shrink-0 mt-0.5" />
                                    <div className="space-y-1 leading-relaxed">
                                        <p className="font-bold text-slate-700">Pesquisa automática na base municipal</p>
                                        <p className="text-[11px] text-slate-500">
                                            Digite ao menos <strong>3 caracteres</strong> para pesquisar por nome ou apelido (sem diferenciar acentos ou maiúsculas), os <strong>11 dígitos</strong> do CPF ou os <strong>15 dígitos</strong> do Cartão SUS.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {searchStatus === 'results' && searchResults.length > 0 && (
                                <div className="flex flex-col flex-1 min-h-0 gap-2">
                                    <div className="flex items-center justify-between text-[11px] text-slate-500 font-bold px-1 shrink-0">
                                        <span>
                                            {searchResults.length}{' '}
                                            {searchResults.length === 1 ? 'paciente encontrado' : 'pacientes encontrados'}
                                        </span>
                                        {searchResults.length >= 20 && (
                                            <span className="text-slate-400">Exibindo os 20 mais relevantes</span>
                                        )}
                                    </div>

                                    <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
                                        {searchResults.map((p) => {
                                            const idade = calculateAgeYears(p.birth_date);
                                            const susMask = p.sus_number ? maskCnsPartial(p.sus_number) : '';
                                            return (
                                                <div
                                                    key={p.id}
                                                    className="p-3.5 rounded-2xl border border-slate-200 hover:border-indigo-300 bg-slate-50/70 hover:bg-indigo-50/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                                                >
                                                    <div className="min-w-0 flex-1 space-y-1">
                                                        <div className="flex flex-wrap items-center gap-1.5">
                                                            <h4 className="text-sm font-black text-slate-900 uppercase leading-tight break-words">
                                                                {p.name}
                                                            </h4>
                                                            {p.nickname && (
                                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 shrink-0">
                                                                    "{p.nickname}"
                                                                </span>
                                                            )}
                                                        </div>

                                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-600 font-medium">
                                                            <span className="inline-flex items-center gap-1">
                                                                <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                                                                <span>
                                                                    Nasc.:{' '}
                                                                    <strong className="text-slate-800">
                                                                        {formatBirthDateBr(p.birth_date)}
                                                                    </strong>
                                                                    {idade !== null ? ` (${idade} anos)` : ''}
                                                                </span>
                                                            </span>

                                                            <span className="inline-flex items-center gap-1">
                                                                <CreditCard className="w-3 h-3 text-slate-400 shrink-0" />
                                                                <span>
                                                                    CPF:{' '}
                                                                    <strong className="font-mono text-slate-800">
                                                                        {maskCpfPartial(p.cpf)}
                                                                    </strong>
                                                                </span>
                                                            </span>

                                                            {susMask && (
                                                                <span className="inline-flex items-center gap-1">
                                                                    <ShieldCheck className="w-3 h-3 text-slate-400 shrink-0" />
                                                                    <span>
                                                                        SUS:{' '}
                                                                        <strong className="font-mono text-slate-800">
                                                                            {susMask}
                                                                        </strong>
                                                                    </span>
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <button
                                                        type="button"
                                                        onClick={() => handleSelectExistingPatient(p)}
                                                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider shadow-xs active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                                                    >
                                                        <UserCheck className="w-3.5 h-3.5" />
                                                        <span>Selecionar Paciente</span>
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {searchStatus === 'not_found' && !isSearching && (
                                <div className="p-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 text-center space-y-3">
                                    <div className="w-10 h-10 rounded-2xl bg-slate-200/80 text-slate-600 flex items-center justify-center mx-auto">
                                        <UserPlus className="w-5 h-5" />
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-sm font-black text-slate-800">
                                            Nenhum paciente encontrado para esta pesquisa.
                                        </p>
                                        <p className="text-xs text-slate-500 max-w-md mx-auto">
                                            Confira os dados digitados ou conclua um novo cadastro na base integrada municipal.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleOpenRegisterFromSearch}
                                        className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider shadow-md shadow-indigo-600/20 active:scale-95 transition-all inline-flex items-center gap-2 cursor-pointer"
                                    >
                                        <UserPlus className="w-4 h-4" />
                                        <span>Cadastrar Novo Paciente</span>
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Rodapé da Etapa de Pesquisa */}
                        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 shrink-0">
                            {searchStatus === 'results' ? (
                                <button
                                    type="button"
                                    onClick={handleOpenRegisterFromSearch}
                                    className="text-xs font-black text-indigo-700 hover:text-indigo-900 flex items-center gap-1.5 cursor-pointer"
                                >
                                    <UserPlus className="w-3.5 h-3.5" />
                                    <span>Não encontrou? Cadastrar Novo Paciente</span>
                                </button>
                            ) : (
                                <span />
                            )}
                            <button
                                type="button"
                                onClick={() => {
                                    cancelPendingLookup();
                                    onClose();
                                }}
                                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-black uppercase text-slate-600 hover:bg-slate-50 transition-all cursor-pointer"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                )}

                {/* ETAPA 2: ERRO DE CONEXÃO / FALTA DE PERMISSÃO (NUNCA ABRE CADASTRO) */}
                {!editingPatient && step === 'error' && lookupErrorState && (
                    <div className="p-5 sm:p-6 space-y-4 animate-in fade-in duration-150">
                        <div
                            className={`p-4 rounded-2xl border flex items-start gap-3 ${
                                lookupErrorState.status === 'permission_denied'
                                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                                    : 'bg-rose-50 border-rose-200 text-rose-900'
                            }`}
                        >
                            {lookupErrorState.status === 'permission_denied' ? (
                                <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                            ) : (
                                <WifiOff className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                            )}
                            <div className="space-y-1 text-xs">
                                <p className="font-black uppercase tracking-wider">
                                    {lookupErrorState.status === 'permission_denied'
                                        ? 'Acesso Negado na Pesquisa'
                                        : lookupErrorState.status === 'connection_error'
                                        ? 'Falha de Conexão'
                                        : 'Erro Técnico na Pesquisa'}
                                </p>
                                <p className="font-medium leading-relaxed">{lookupErrorState.message}</p>
                            </div>
                        </div>

                        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                            <button
                                type="button"
                                onClick={handleBackToSearch}
                                className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all cursor-pointer flex items-center gap-1.5"
                            >
                                <ArrowLeft className="w-3.5 h-3.5" />
                                Voltar à Pesquisa
                            </button>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-black uppercase text-slate-600 hover:bg-slate-50 transition-all cursor-pointer"
                                >
                                    Fechar
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setStep('search');
                                        void executeSmartSearch(searchTerm, true);
                                    }}
                                    disabled={isSearching}
                                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                                >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    Tentar Novamente
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ETAPA 3: FORMULÁRIO DE CADASTRO COMPLETO (OU EDIÇÃO) */}
                {isExpandedForm && (
                    <form
                        onSubmit={handleSave}
                        className="p-3.5 sm:p-5 overflow-y-auto sm:overflow-y-visible flex-1 flex flex-col justify-between gap-2 sm:gap-2.5 scrollbar-none animate-in fade-in duration-200"
                    >
                        {!editingPatient && (
                            <div className="px-3 py-1.5 sm:py-2 bg-indigo-50 border border-indigo-200/80 rounded-xl flex flex-wrap items-center justify-between gap-1.5 text-xs text-indigo-900 shrink-0">
                                <div className="flex items-center gap-2">
                                    <UserPlus className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                    <span className="font-semibold text-[11px] sm:text-xs">
                                        Preencha os dados para cadastrar e vincular o paciente à fila.
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleBackToSearch}
                                    disabled={loading}
                                    className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-indigo-700 hover:text-indigo-900 underline cursor-pointer shrink-0 flex items-center gap-1"
                                >
                                    <ArrowLeft className="w-3 h-3" />
                                    Voltar à Pesquisa
                                </button>
                            </div>
                        )}

                        {error && (
                            <div className="bg-rose-50 border border-rose-200 rounded-xl p-2.5 text-xs text-rose-800 space-y-1.5 shrink-0">
                                <div className="flex items-center gap-2 font-semibold">
                                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                                    <span>{error}</span>
                                </div>
                                {duplicateConflictPatient && (
                                    <div className="pt-1 flex flex-wrap items-center justify-between gap-2 border-t border-rose-200/80">
                                        <span className="text-[10px] sm:text-[11px] font-bold text-rose-900 uppercase">
                                            Cadastro existente: {duplicateConflictPatient.name}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => handleSelectExistingPatient(duplicateConflictPatient)}
                                            className="px-3 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] sm:text-[11px] font-black uppercase tracking-wider cursor-pointer inline-flex items-center gap-1.5"
                                        >
                                            <UserCheck className="w-3.5 h-3.5" />
                                            Selecionar Paciente
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3.5 sm:gap-x-4 gap-y-2 sm:gap-y-2.5 flex-1">
                            {/* Linha 1: Nome Completo */}
                            <div className="sm:col-span-2">
                                <label className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-slate-700 block mb-0.5 sm:mb-1">
                                    Nome Completo *
                                </label>
                                <input
                                    ref={nomeFieldRef}
                                    type="text"
                                    required
                                    value={nome}
                                    onChange={(e) => setNome(e.target.value)}
                                    placeholder="NOME COMPLETO DO PACIENTE"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 sm:py-2 text-xs font-bold text-slate-800 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all uppercase"
                                />
                            </div>

                            {/* Linha 2: CPF | Data de Nascimento */}
                            <div>
                                <label className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5 mb-0.5 sm:mb-1">
                                    <span>CPF *</span>
                                    {!editingPatient && cpfLocked && (
                                        <span className="inline-flex items-center gap-1 text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200 normal-case">
                                            <Lock className="w-2.5 h-2.5" />
                                            Da pesquisa
                                        </span>
                                    )}
                                </label>
                                <input
                                    type="text"
                                    required
                                    inputMode="numeric"
                                    maxLength={14}
                                    value={cpf}
                                    readOnly={!editingPatient && cpfLocked}
                                    disabled={!editingPatient && cpfLocked}
                                    onChange={(e) => setCpf(formatCpf(e.target.value))}
                                    placeholder="000.000.000-00"
                                    className={`w-full border rounded-xl px-3 py-1.5 sm:py-2 text-xs font-black font-mono transition-all ${
                                        !editingPatient && cpfLocked
                                            ? 'bg-slate-100 border-slate-200 text-slate-600 cursor-not-allowed select-all'
                                            : 'bg-slate-50 border-slate-200 text-slate-800 focus:bg-white focus:border-indigo-500'
                                    }`}
                                />
                            </div>

                            <div>
                                <label className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-slate-700 block mb-0.5 sm:mb-1">
                                    Data de Nascimento *
                                </label>
                                <input
                                    type="date"
                                    required
                                    max={todayDateMax}
                                    value={dataNascimento}
                                    onChange={(e) => setDataNascimento(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 sm:py-2 text-xs font-bold text-slate-800 focus:bg-white focus:border-indigo-500 transition-all"
                                />
                            </div>

                            {/* Linha 3: Apelido / Como prefere ser chamado | WhatsApp */}
                            <div>
                                <label className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-slate-700 block mb-0.5 sm:mb-1">
                                    Apelido / Como prefere ser chamado
                                </label>
                                <input
                                    type="text"
                                    value={apelido}
                                    onChange={(e) => setApelido(e.target.value)}
                                    placeholder="EX: ZÉ, DONA MARIA"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 sm:py-2 text-xs font-bold text-slate-800 focus:bg-white focus:border-indigo-500 transition-all uppercase"
                                />
                            </div>

                            <div>
                                <label className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-slate-700 flex items-center justify-between mb-0.5 sm:mb-1">
                                    <span>WhatsApp *</span>
                                    <span className="text-[10px] text-indigo-600 font-bold normal-case">Celular</span>
                                </label>
                                <input
                                    type="tel"
                                    required
                                    maxLength={17}
                                    value={whatsapp}
                                    onChange={(e) => handleWhatsAppChange(e.target.value)}
                                    onBlur={() => {
                                        if (whatsapp.trim()) {
                                            const check = validateWhatsApp(whatsapp, { required: true });
                                            if (!check.isValid) {
                                                setWhatsappError(check.errorMessage || 'WhatsApp inválido.');
                                            } else {
                                                setWhatsappError('');
                                            }
                                        } else {
                                            setWhatsappError('O WhatsApp é obrigatório.');
                                        }
                                    }}
                                    placeholder="(00) 0 0000-0000"
                                    className={`w-full rounded-xl px-3 py-1.5 sm:py-2 text-xs font-bold transition-all font-mono ${
                                        whatsappError
                                            ? 'border-2 border-rose-400 bg-rose-50/50 text-rose-900 focus:bg-white focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20'
                                            : 'bg-slate-50 border border-slate-200 text-slate-800 focus:bg-white focus:border-indigo-500'
                                    }`}
                                />
                                {whatsappError && (
                                    <div className="flex items-start gap-1 mt-0.5 text-[10px] font-bold text-rose-600 leading-tight">
                                        <AlertTriangle className="w-3 h-3 shrink-0 text-rose-500 mt-0.5" />
                                        <span>{whatsappError}</span>
                                    </div>
                                )}
                            </div>

                            {/* Linha 4: Telefone Fixo | Cartão SUS (CNS) */}
                            <div>
                                <label className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-slate-700 flex items-center justify-between mb-0.5 sm:mb-1">
                                    <span>Telefone Fixo</span>
                                    <span className="text-[10px] text-slate-400 font-normal normal-case">Opcional</span>
                                </label>
                                <input
                                    type="tel"
                                    maxLength={14}
                                    value={telefoneFixo}
                                    onChange={(e) => handleTelefoneFixoChange(e.target.value)}
                                    onBlur={() => {
                                        if (telefoneFixo.trim()) {
                                            const check = validateLandlinePhone(telefoneFixo, { required: false });
                                            if (!check.isValid) {
                                                setTelefoneFixoError(check.errorMessage || 'Telefone Fixo inválido.');
                                            } else {
                                                setTelefoneFixoError('');
                                            }
                                        } else {
                                            setTelefoneFixoError('');
                                        }
                                    }}
                                    placeholder="(00) 0000-0000"
                                    className={`w-full rounded-xl px-3 py-1.5 sm:py-2 text-xs font-bold transition-all font-mono ${
                                        telefoneFixoError
                                            ? 'border-2 border-rose-400 bg-rose-50/50 text-rose-900 focus:bg-white focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20'
                                            : 'bg-slate-50 border border-slate-200 text-slate-800 focus:bg-white focus:border-indigo-500'
                                    }`}
                                />
                                {telefoneFixoError && (
                                    <div className="flex items-start gap-1 mt-0.5 text-[10px] font-bold text-rose-600 leading-tight">
                                        <AlertTriangle className="w-3 h-3 shrink-0 text-rose-500 mt-0.5" />
                                        <span>{telefoneFixoError}</span>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-slate-700 block mb-0.5 sm:mb-1">
                                    Cartão SUS (CNS)
                                </label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={15}
                                    value={susNumber}
                                    onChange={(e) => setSusNumber(e.target.value.replace(/\D/g, '').slice(0, 15))}
                                    placeholder="15 dígitos do Cartão SUS"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 sm:py-2 text-xs font-bold text-slate-800 focus:bg-white focus:border-indigo-500 transition-all font-mono"
                                />
                            </div>

                            {/* Linha 5: Agente Comunitário de Saúde (ACS) | Bairro */}
                            <div>
                                <label className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-slate-700 block mb-0.5 sm:mb-1">
                                    Agente Comunitário de Saúde (ACS)
                                </label>
                                <select
                                    value={agenteSaude}
                                    onChange={(e) => setAgenteSaude(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 sm:py-2 text-xs font-bold text-slate-800 focus:bg-white focus:border-indigo-500 transition-all uppercase"
                                >
                                    <option value="">Selecione o Agente de Saúde...</option>
                                    {agentesSaudeItems.map(a => (
                                        <option key={a.id} value={a.nome}>
                                            {a.nome} {a.psf ? `(${a.psf})` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-slate-700 block mb-0.5 sm:mb-1">
                                    Bairro
                                </label>
                                <input
                                    type="text"
                                    value={bairro}
                                    onChange={(e) => setBairro(e.target.value)}
                                    placeholder="NOME DO BAIRRO"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 sm:py-2 text-xs font-bold text-slate-800 focus:bg-white focus:border-indigo-500 transition-all uppercase"
                                />
                            </div>

                            {/* Linha 6: Endereço / Rua / Número */}
                            <div className="sm:col-span-2">
                                <label className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-slate-700 block mb-0.5 sm:mb-1">
                                    Endereço / Rua / Número
                                </label>
                                <input
                                    type="text"
                                    value={rua}
                                    onChange={(e) => setRua(e.target.value)}
                                    placeholder="LOGRADOURO COMPLETO"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 sm:py-2 text-xs font-bold text-slate-800 focus:bg-white focus:border-indigo-500 transition-all uppercase"
                                />
                            </div>
                        </div>

                        {/* Rodapé sempre acessível */}
                        <div className="pt-2.5 sm:pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5 shrink-0">
                            <button
                                type="button"
                                onClick={() => {
                                    cancelPendingLookup();
                                    onClose();
                                }}
                                disabled={loading}
                                className="px-4 py-2 sm:py-2.5 rounded-xl border border-slate-200 text-xs font-black uppercase text-slate-600 hover:bg-slate-50 transition-all cursor-pointer disabled:opacity-50"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="px-5 py-2 sm:py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider shadow-md shadow-indigo-600/20 active:scale-95 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-60"
                            >
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                <span>{editingPatient ? 'Salvar Alterações' : 'Cadastrar e Selecionar Paciente'}</span>
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );

    if (typeof document !== 'undefined') {
        return createPortal(modalContent, document.body);
    }

    return modalContent;
};
