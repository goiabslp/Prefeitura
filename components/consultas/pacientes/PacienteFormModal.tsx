import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ConsultaPaciente } from '../../../types';
import { useAgentesSaude } from '../../../services/agentesSaudeService';
import * as db from '../../../services/consultasService';
import { DuplicatePatientCpfError, PacienteCpfLookupStatus } from '../../../services/consultasService';
import { normalizeCpf, formatCpf, isValidCpf, formatBirthDateBr, calculateAgeYears } from '../../../utils/cpfUtils';
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
    Phone,
    MapPin,
    CreditCard,
    Users
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

type ModalStep = 'cpf_lookup' | 'found' | 'register' | 'error';

export const PacienteFormModal: React.FC<PacienteFormModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
    editingPatient
}) => {
    const { items: agentesSaudeItems } = useAgentesSaude();

    // Controle de etapa do fluxo único por CPF
    const [step, setStep] = useState<ModalStep>('cpf_lookup');
    const [cpfInput, setCpfInput] = useState('');
    const [cpfValidationError, setCpfValidationError] = useState('');
    const [isSearchingCpf, setIsSearchingCpf] = useState(false);
    const [lookupErrorState, setLookupErrorState] = useState<{
        status: PacienteCpfLookupStatus;
        message: string;
    } | null>(null);
    const [foundPatient, setFoundPatient] = useState<ConsultaPaciente | null>(null);
    const [duplicateConflictPatient, setDuplicateConflictPatient] = useState<ConsultaPaciente | null>(null);

    // Controle anti-corrida e prevenção de requisições simultâneas duplicadas
    const activeAbortControllerRef = useRef<AbortController | null>(null);
    const inFlightCpfRef = useRef<string | null>(null);
    const lookupSequenceRef = useRef<number>(0);
    const cpfFieldRef = useRef<HTMLInputElement>(null);
    const nomeFieldRef = useRef<HTMLInputElement>(null);

    // Estados do formulário completo (exibido somente quando CPF não existe ou em edição)
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [nome, setNome] = useState('');
    const [apelido, setApelido] = useState('');
    const [cpf, setCpf] = useState('');
    const [dataNascimento, setDataNascimento] = useState('');
    const [telefone, setTelefone] = useState('');
    const [bairro, setBairro] = useState('');
    const [rua, setRua] = useState('');
    const [cidade, setCidade] = useState('SÃO JOSÉ DO GOIABAL -MG');
    const [susNumber, setSusNumber] = useState('');
    const [agenteSaude, setAgenteSaude] = useState('');

    // Cancela consultas pendentes ao fechar ou desmontar
    const cancelPendingLookup = () => {
        if (activeAbortControllerRef.current) {
            activeAbortControllerRef.current.abort();
            activeAbortControllerRef.current = null;
        }
        inFlightCpfRef.current = null;
    };

    const resetFormFields = (lockedCleanCpf = '') => {
        setNome('');
        setApelido('');
        setCpf(lockedCleanCpf ? formatCpf(lockedCleanCpf) : '');
        setDataNascimento('');
        setTelefone('');
        setBairro('');
        setRua('');
        setCidade('SÃO JOSÉ DO GOIABAL -MG');
        setSusNumber('');
        setAgenteSaude('');
        setError('');
        setDuplicateConflictPatient(null);
    };

    useEffect(() => {
        if (!isOpen) {
            cancelPendingLookup();
            return;
        }

        if (editingPatient) {
            setStep('register');
            setNome(editingPatient.name || '');
            setApelido(editingPatient.nickname || '');
            const formattedExistingCpf = formatCpf(editingPatient.cpf || '');
            setCpf(formattedExistingCpf);
            setCpfInput(formattedExistingCpf);
            setDataNascimento(editingPatient.birth_date || '');
            setTelefone(editingPatient.phone || '');
            setBairro(editingPatient.neighborhood || '');
            setRua(editingPatient.street || '');
            setCidade(editingPatient.city || 'SÃO JOSÉ DO GOIABAL -MG');
            setSusNumber(editingPatient.sus_number || '');
            setAgenteSaude(editingPatient.agente_saude || '');
            setError('');
            setCpfValidationError('');
            setLookupErrorState(null);
            setFoundPatient(null);
            setDuplicateConflictPatient(null);
        } else {
            // Layout inicial estritamente compacto: apenas Localizar Paciente + CPF
            cancelPendingLookup();
            setStep('cpf_lookup');
            setCpfInput('');
            setCpfValidationError('');
            setIsSearchingCpf(false);
            setLookupErrorState(null);
            setFoundPatient(null);
            resetFormFields('');
            setTimeout(() => cpfFieldRef.current?.focus(), 60);
        }
    }, [editingPatient, isOpen]);

    useEffect(() => {
        if (isOpen && step === 'register' && !editingPatient) {
            setTimeout(() => nomeFieldRef.current?.focus(), 140);
        }
    }, [isOpen, step, editingPatient]);

    useEffect(() => {
        return () => cancelPendingLookup();
    }, []);

    if (!isOpen) return null;

    // Executa consulta automática ao atingir CPF válido de 11 dígitos
    const runCpfLookup = async (rawCpfValue: string) => {
        const clean = normalizeCpf(rawCpfValue);

        if (clean.length < 11) {
            cancelPendingLookup();
            setIsSearchingCpf(false);
            setCpfValidationError('');
            setLookupErrorState(null);
            return;
        }

        if (!isValidCpf(clean)) {
            cancelPendingLookup();
            setIsSearchingCpf(false);
            setLookupErrorState(null);
            setFoundPatient(null);
            setCpfValidationError('CPF inválido. Confira os 11 dígitos informados.');
            return;
        }

        // Evita múltiplas consultas simultâneas para o mesmo CPF
        if (inFlightCpfRef.current === clean) {
            return;
        }

        cancelPendingLookup();
        const controller = new AbortController();
        activeAbortControllerRef.current = controller;
        inFlightCpfRef.current = clean;
        const seqId = ++lookupSequenceRef.current;

        setCpfValidationError('');
        setLookupErrorState(null);
        setFoundPatient(null);
        setIsSearchingCpf(true);

        try {
            const result = await db.lookupPacienteByCpf(clean, { signal: controller.signal });

            // Descarta resposta se uma busca mais nova foi iniciada ou cancelada
            if (controller.signal.aborted || lookupSequenceRef.current !== seqId) {
                return;
            }

            if (result.status === 'invalid_cpf') {
                setCpfValidationError(result.error || 'CPF inválido.');
                setStep('cpf_lookup');
                return;
            }

            if (result.status === 'found' && result.paciente) {
                setFoundPatient(result.paciente);
                setStep('found');
                return;
            }

            if (result.status === 'not_found') {
                resetFormFields(clean);
                setStep('register');
                return;
            }

            // Erro de conexão, falta de permissão ou erro técnico: NUNCA abre cadastro de novo paciente
            setLookupErrorState({
                status: result.status,
                message: result.error || 'Não foi possível consultar o CPF na base integrada.'
            });
            setStep('error');
        } finally {
            if (lookupSequenceRef.current === seqId) {
                setIsSearchingCpf(false);
                if (inFlightCpfRef.current === clean) {
                    inFlightCpfRef.current = null;
                }
            }
        }
    };

    const handleInitialCpfChange = (val: string) => {
        const masked = formatCpf(val);
        const clean = normalizeCpf(masked);
        setCpfInput(masked);
        setCpfValidationError('');
        setLookupErrorState(null);

        if (clean.length < 11) {
            cancelPendingLookup();
            setIsSearchingCpf(false);
            setFoundPatient(null);
            if (step !== 'cpf_lookup') {
                setStep('cpf_lookup');
            }
            return;
        }

        // Dispara validação + consulta automática imediatamente ao completar 11 dígitos
        void runCpfLookup(clean);
    };

    const handleResetToCpfLookup = () => {
        cancelPendingLookup();
        setStep('cpf_lookup');
        setFoundPatient(null);
        setLookupErrorState(null);
        setCpfValidationError('');
        setCpfInput('');
        resetFormFields('');
        setTimeout(() => cpfFieldRef.current?.focus(), 60);
    };

    const handleSelectExistingPatient = (patient: ConsultaPaciente) => {
        onSuccess(patient, { isNew: false });
        onClose();
    };

    const handleTelefoneChange = (val: string) => {
        const numbers = val.replace(/\D/g, '').slice(0, 11);
        let masked = numbers;
        if (numbers.length > 10) masked = numbers.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
        else if (numbers.length > 6) masked = numbers.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
        else if (numbers.length > 2) masked = numbers.replace(/(\d{2})(\d{0,5})/, '($1) $2');
        setTelefone(masked);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setDuplicateConflictPatient(null);

        const cleanCpf = normalizeCpf(editingPatient ? cpf : cpfInput || cpf);
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

        setLoading(true);
        try {
            const payload = {
                name: nome.trim().toUpperCase(),
                nickname: apelido.trim() ? apelido.trim().toUpperCase() : null,
                cpf: cleanCpf,
                birth_date: dataNascimento,
                phone: telefone.trim() || null,
                neighborhood: bairro.trim() ? bairro.trim().toUpperCase() : null,
                street: rua.trim() ? rua.trim().toUpperCase() : null,
                city: cidade.trim() ? cidade.trim().toUpperCase() : 'SÃO JOSÉ DO GOIABAL -MG',
                sus_number: susNumber.trim() || null,
                agente_saude: agenteSaude ? agenteSaude.toUpperCase() : null
            };

            let saved: ConsultaPaciente | null = null;
            if (editingPatient) {
                saved = await db.updatePaciente(editingPatient.id, payload as any);
            } else {
                // Cadastro estrito: verifica duplicidade no serviço e no banco sem alterar registros existentes
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
    const cleanCurrentCpf = normalizeCpf(cpfInput);
    const isCpfComplete = cleanCurrentCpf.length === 11;
    const isCpfMathematicallyValid = isCpfComplete && isValidCpf(cleanCurrentCpf);

    const foundAge = foundPatient ? calculateAgeYears(foundPatient.birth_date) : null;

    const modalContent = (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
            role="dialog"
            aria-modal="true"
            aria-labelledby="paciente-modal-title"
        >
            <div
                className={`bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-h-[92vh] flex flex-col overflow-hidden transition-all duration-300 ease-out animate-in zoom-in-95 ${
                    isExpandedForm ? 'max-w-2xl' : 'max-w-md'
                }`}
            >
                {/* Cabeçalho Unificado */}
                <div className="p-4 sm:p-5 bg-gradient-to-r from-sky-600 to-indigo-600 text-white flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center border border-white/25 shrink-0">
                            {editingPatient ? (
                                <User className="w-5 h-5 text-white" />
                            ) : step === 'found' ? (
                                <UserCheck className="w-5 h-5 text-white" />
                            ) : step === 'register' ? (
                                <UserPlus className="w-5 h-5 text-white" />
                            ) : (
                                <Search className="w-5 h-5 text-white" />
                            )}
                        </div>
                        <div className="min-w-0">
                            <h3 id="paciente-modal-title" className="text-base font-black tracking-tight truncate">
                                {editingPatient
                                    ? 'Editar Cadastro do Paciente'
                                    : step === 'register'
                                    ? 'Cadastrar Novo Paciente'
                                    : 'Localizar Paciente'}
                            </h3>
                            <p className="text-[11px] sm:text-xs text-sky-100 font-medium truncate">
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
                        className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                        title="Fechar"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* ETAPA 1: BUSCA COMPACTA POR CPF (SEM EXIBIR OS DEMAIS CAMPOS ANTES DA CONSULTA) */}
                {!editingPatient && step === 'cpf_lookup' && (
                    <div className="p-5 sm:p-6 space-y-4">
                        <div className="space-y-1.5">
                            <label
                                htmlFor="paciente-lookup-cpf"
                                className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center justify-between"
                            >
                                <span>CPF *</span>
                                {isSearchingCpf && (
                                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-sky-600 normal-case">
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        Consultando base...
                                    </span>
                                )}
                            </label>
                            <div className="relative">
                                <input
                                    id="paciente-lookup-cpf"
                                    ref={cpfFieldRef}
                                    type="text"
                                    inputMode="numeric"
                                    autoComplete="off"
                                    maxLength={14}
                                    value={cpfInput}
                                    onChange={(e) => handleInitialCpfChange(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            void runCpfLookup(cpfInput);
                                        }
                                    }}
                                    placeholder="000.000.000-00"
                                    className={`w-full bg-slate-50 border rounded-2xl px-4 py-3 text-base font-black tracking-wider text-slate-900 placeholder:text-slate-400 placeholder:font-semibold focus:bg-white focus:ring-4 transition-all font-mono ${
                                        cpfValidationError
                                            ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-500/10'
                                            : 'border-slate-200 focus:border-sky-500 focus:ring-sky-500/10'
                                    }`}
                                />
                                {isSearchingCpf && (
                                    <Loader2 className="w-5 h-5 text-sky-600 animate-spin absolute right-3.5 top-1/2 -translate-y-1/2" />
                                )}
                                {!isSearchingCpf && isCpfMathematicallyValid && (
                                    <CheckCircle2 className="w-5 h-5 text-emerald-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
                                )}
                            </div>
                        </div>

                        {cpfValidationError && (
                            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3 text-xs text-rose-800 font-semibold flex items-center gap-2 animate-in fade-in duration-150">
                                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                                <span>{cpfValidationError}</span>
                            </div>
                        )}

                        {!cpfValidationError && !isSearchingCpf && (
                            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-start gap-2.5 text-[11px] text-slate-600">
                                <ShieldCheck className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                                <span>
                                    Informe os 11 dígitos do CPF. A consulta na base municipal inicia automaticamente ao concluir o preenchimento.
                                </span>
                            </div>
                        )}

                        <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
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

                {/* ETAPA 2A: PACIENTE ENCONTRADO NA BASE INTEGRADA */}
                {!editingPatient && step === 'found' && foundPatient && (
                    <div className="p-5 sm:p-6 space-y-4 overflow-y-auto no-scrollbar animate-in fade-in duration-200">
                        <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900">
                            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                            <div className="text-xs font-bold leading-snug">
                                Paciente já cadastrado na base integrada municipal. Confirme os dados abaixo para vincular ao atendimento.
                            </div>
                        </div>

                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-3">
                            <div>
                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                                    Nome Completo
                                </span>
                                <div className="flex flex-wrap items-center gap-2 mt-0.5">
                                    <h4 className="text-sm sm:text-base font-black text-slate-900 uppercase leading-tight">
                                        {foundPatient.name}
                                    </h4>
                                    {foundPatient.nickname && (
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800">
                                            "{foundPatient.nickname}"
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-slate-200/70 text-xs">
                                <div className="flex items-center gap-2 text-slate-700">
                                    <CreditCard className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                    <div>
                                        <span className="text-[10px] uppercase font-bold text-slate-400 block leading-none">CPF</span>
                                        <span className="font-mono font-bold text-slate-800">
                                            {formatCpf(foundPatient.cpf)}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 text-slate-700">
                                    <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                    <div>
                                        <span className="text-[10px] uppercase font-bold text-slate-400 block leading-none">Nascimento</span>
                                        <span className="font-bold text-slate-800">
                                            {formatBirthDateBr(foundPatient.birth_date)}
                                            {foundAge !== null && (
                                                <span className="ml-1.5 text-[11px] text-emerald-700 font-black">
                                                    ({foundAge} anos)
                                                </span>
                                            )}
                                        </span>
                                    </div>
                                </div>

                                {foundPatient.sus_number && (
                                    <div className="flex items-center gap-2 text-slate-700">
                                        <ShieldCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                        <div>
                                            <span className="text-[10px] uppercase font-bold text-slate-400 block leading-none">Cartão SUS</span>
                                            <span className="font-mono font-bold text-slate-800">{foundPatient.sus_number}</span>
                                        </div>
                                    </div>
                                )}

                                {foundPatient.phone && (
                                    <div className="flex items-center gap-2 text-slate-700">
                                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                        <div>
                                            <span className="text-[10px] uppercase font-bold text-slate-400 block leading-none">Telefone</span>
                                            <span className="font-bold text-slate-800">{foundPatient.phone}</span>
                                        </div>
                                    </div>
                                )}

                                {(foundPatient.neighborhood || foundPatient.street) && (
                                    <div className="sm:col-span-2 flex items-start gap-2 text-slate-700">
                                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                                        <div>
                                            <span className="text-[10px] uppercase font-bold text-slate-400 block leading-none">Endereço / Bairro</span>
                                            <span className="font-semibold text-slate-800 uppercase">
                                                {[foundPatient.street, foundPatient.neighborhood].filter(Boolean).join(' — ')}
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {foundPatient.agente_saude && (
                                    <div className="sm:col-span-2 flex items-center gap-2 text-slate-700">
                                        <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                        <div>
                                            <span className="text-[10px] uppercase font-bold text-slate-400 block leading-none">Agente de Saúde (ACS)</span>
                                            <span className="font-semibold text-slate-800 uppercase">{foundPatient.agente_saude}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="pt-2 border-t border-slate-100 flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-2.5">
                            <button
                                type="button"
                                onClick={handleResetToCpfLookup}
                                className="px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                            >
                                <RotateCcw className="w-3.5 h-3.5" />
                                Consultar outro CPF
                            </button>

                            <button
                                type="button"
                                onClick={() => handleSelectExistingPatient(foundPatient)}
                                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider shadow-md shadow-emerald-600/20 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                            >
                                <UserCheck className="w-4 h-4" />
                                <span>Selecionar Paciente</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* ETAPA 2B: ERRO TÉCNICO / CONEXÃO / PERMISSÃO (NUNCA ABRE FORMULÁRIO DE CADASTRO) */}
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
                                        ? 'Acesso Negado na Consulta'
                                        : lookupErrorState.status === 'connection_error'
                                        ? 'Falha de Conexão'
                                        : 'Erro Técnico na Consulta'}
                                </p>
                                <p className="font-medium leading-relaxed">{lookupErrorState.message}</p>
                            </div>
                        </div>

                        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                            <button
                                type="button"
                                onClick={handleResetToCpfLookup}
                                className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all cursor-pointer"
                            >
                                Alterar CPF
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
                                        setStep('cpf_lookup');
                                        void runCpfLookup(cpfInput);
                                    }}
                                    disabled={isSearchingCpf}
                                    className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-black uppercase tracking-wider shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                                >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    Tentar Novamente
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ETAPA 3: EXPANSÃO SUAVE COM FORMULÁRIO COMPLETO QUANDO CPF NÃO EXISTE (OU EDIÇÃO) */}
                {isExpandedForm && (
                    <form onSubmit={handleSave} className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 no-scrollbar animate-in fade-in duration-200">
                        {!editingPatient && (
                            <div className="p-3 bg-sky-50 border border-sky-200/80 rounded-2xl flex flex-wrap items-center justify-between gap-2 text-xs text-sky-900">
                                <div className="flex items-center gap-2">
                                    <UserPlus className="w-4 h-4 text-sky-600 shrink-0" />
                                    <span className="font-semibold">
                                        CPF não localizado na base. Preencha os dados para cadastrar e selecionar o paciente.
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleResetToCpfLookup}
                                    disabled={loading}
                                    className="text-[11px] font-black uppercase tracking-wider text-sky-700 hover:text-sky-900 underline cursor-pointer shrink-0"
                                >
                                    Alterar CPF
                                </button>
                            </div>
                        )}

                        {error && (
                            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3 text-xs text-rose-800 space-y-2">
                                <div className="flex items-center gap-2 font-semibold">
                                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                                    <span>{error}</span>
                                </div>
                                {duplicateConflictPatient && (
                                    <div className="pt-1 flex flex-wrap items-center justify-between gap-2 border-t border-rose-200/80">
                                        <span className="text-[11px] font-bold text-rose-900 uppercase">
                                            Cadastro encontrado: {duplicateConflictPatient.name}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => handleSelectExistingPatient(duplicateConflictPatient)}
                                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black uppercase tracking-wider cursor-pointer inline-flex items-center gap-1.5"
                                        >
                                            <UserCheck className="w-3.5 h-3.5" />
                                            Selecionar Existente
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            <div className="sm:col-span-2">
                                <label className="text-xs font-black uppercase tracking-wider text-slate-700 block mb-1">
                                    Nome Completo *
                                </label>
                                <input
                                    ref={nomeFieldRef}
                                    type="text"
                                    required
                                    value={nome}
                                    onChange={(e) => setNome(e.target.value)}
                                    placeholder="Nome completo do paciente"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-500/10 transition-all uppercase"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5 mb-1">
                                    <span>CPF *</span>
                                    {!editingPatient && (
                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md border border-slate-200 normal-case">
                                            <Lock className="w-2.5 h-2.5" />
                                            Bloqueado
                                        </span>
                                    )}
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={cpf}
                                    readOnly={!editingPatient}
                                    disabled={!editingPatient}
                                    onChange={(e) => {
                                        if (editingPatient) setCpf(formatCpf(e.target.value));
                                    }}
                                    placeholder="000.000.000-00"
                                    className={`w-full border rounded-xl px-3 py-2 text-xs font-black font-mono transition-all ${
                                        !editingPatient
                                            ? 'bg-slate-100 border-slate-200 text-slate-600 cursor-not-allowed select-all'
                                            : 'bg-slate-50 border-slate-200 text-slate-800 focus:bg-white focus:border-sky-500'
                                    }`}
                                />
                            </div>

                            <div>
                                <label className="text-xs font-black uppercase tracking-wider text-slate-700 block mb-1">
                                    Data de Nascimento *
                                </label>
                                <input
                                    type="date"
                                    required
                                    max={todayDateMax}
                                    value={dataNascimento}
                                    onChange={(e) => setDataNascimento(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:border-sky-500 transition-all"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-black uppercase tracking-wider text-slate-700 block mb-1">
                                    Apelido / Como prefere ser chamado
                                </label>
                                <input
                                    type="text"
                                    value={apelido}
                                    onChange={(e) => setApelido(e.target.value)}
                                    placeholder="Apelido opcional"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:border-sky-500 transition-all uppercase"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-black uppercase tracking-wider text-slate-700 block mb-1">
                                    Telefone de Contato
                                </label>
                                <input
                                    type="text"
                                    value={telefone}
                                    onChange={(e) => handleTelefoneChange(e.target.value)}
                                    placeholder="(00) 00000-0000"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:border-sky-500 transition-all"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-black uppercase tracking-wider text-slate-700 block mb-1">
                                    Cartão SUS (CNS)
                                </label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={susNumber}
                                    onChange={(e) => setSusNumber(e.target.value.replace(/\D/g, '').slice(0, 15))}
                                    placeholder="15 dígitos do Cartão SUS"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:border-sky-500 transition-all font-mono"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-black uppercase tracking-wider text-slate-700 block mb-1">
                                    Agente Comunitário de Saúde (ACS)
                                </label>
                                <select
                                    value={agenteSaude}
                                    onChange={(e) => setAgenteSaude(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:border-sky-500 transition-all uppercase"
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
                                <label className="text-xs font-black uppercase tracking-wider text-slate-700 block mb-1">
                                    Bairro
                                </label>
                                <input
                                    type="text"
                                    value={bairro}
                                    onChange={(e) => setBairro(e.target.value)}
                                    placeholder="Nome do Bairro"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:border-sky-500 transition-all uppercase"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-black uppercase tracking-wider text-slate-700 block mb-1">
                                    Endereço / Rua / Número
                                </label>
                                <input
                                    type="text"
                                    value={rua}
                                    onChange={(e) => setRua(e.target.value)}
                                    placeholder="Logradouro completo"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:border-sky-500 transition-all uppercase"
                                />
                            </div>
                        </div>

                        <div className="p-3 bg-sky-50/50 rounded-2xl border border-sky-100 flex items-center gap-2 text-xs text-sky-800">
                            <ShieldCheck className="w-4 h-4 text-sky-600 shrink-0" />
                            <span>Este cadastro é compartilhado de forma unificada entre Regulação, Farmácia Popular e AutoSenha sem duplicar dados.</span>
                        </div>

                        {/* Rodapé */}
                        <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                            <button
                                type="button"
                                onClick={() => {
                                    cancelPendingLookup();
                                    onClose();
                                }}
                                disabled={loading}
                                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-black uppercase text-slate-600 hover:bg-slate-50 transition-all cursor-pointer disabled:opacity-50"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-black uppercase tracking-wider shadow-md shadow-sky-600/20 active:scale-95 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-60"
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
