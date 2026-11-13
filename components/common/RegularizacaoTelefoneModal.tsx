import React, { useState, useEffect, useRef } from 'react';
import { 
    Phone, 
    AlertTriangle, 
    Check, 
    X, 
    Loader2, 
    User as UserIcon, 
    ShieldAlert, 
    ArrowRight, 
    HelpCircle,
    CheckCircle2,
    Lock,
    Sparkles
} from 'lucide-react';
import { ConsultaPaciente, User } from '../../types';
import { updatePaciente } from '../../services/consultasService';
import { auditLogService } from '../../services/auditLogService';
import { getActivePermissionUser } from '../../services/permissionService';
import { 
    validateBrazilianPhone, 
    maskPhoneInput, 
    getMotivoIrregularidadeOperacao, 
    TELEFONE_INVALIDO_MSG 
} from '../../utils/phoneValidation';

export interface RegularizacaoTelefoneModalProps {
    isOpen: boolean;
    onClose: () => void;
    patient: ConsultaPaciente | null;
    currentUser?: User | null;
    moduloOrigem?: string; // ex: "Regulação - Novo Agendamento", "Farmácia Popular - Retirar"
    onSuccess: (updatedPatient: ConsultaPaciente) => void;
    onExceptionAllowed?: (patient: ConsultaPaciente, justificativa: string) => void;
}

export const RegularizacaoTelefoneModal: React.FC<RegularizacaoTelefoneModalProps> = ({
    isOpen,
    onClose,
    patient,
    currentUser,
    moduloOrigem = 'Regulação / Farmácia',
    onSuccess,
    onExceptionAllowed
}) => {
    const inputRef = useRef<HTMLInputElement>(null);

    const [novoTelefone, setNovoTelefone] = useState('');
    const [telefoneError, setTelefoneError] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    // Estado do fluxo de Exceção Assistencial / Urgência
    const [showExceptionBox, setShowExceptionBox] = useState(false);
    const [justificativaExcecao, setJustificativaExcecao] = useState('');
    const [isSavingExcecao, setIsSavingExcecao] = useState(false);

    // Obtém o nome do usuário logado (preferindo prop, fallback para sessão global)
    const activeUser = currentUser || getActivePermissionUser();
    const nomeUsuario = activeUser?.name?.trim() || activeUser?.username || 'Operador';
    const nomePaciente = patient?.name || 'Paciente';

    // Foco automático e inicialização ao abrir
    useEffect(() => {
        if (isOpen) {
            setNovoTelefone('');
            setTelefoneError('');
            setErrorMessage('');
            setShowExceptionBox(false);
            setJustificativaExcecao('');
            setIsSaving(false);
            setIsSavingExcecao(false);

            setTimeout(() => {
                inputRef.current?.focus();
            }, 120);
        }
    }, [isOpen, patient?.id]);

    if (!isOpen || !patient) return null;

    const telefoneAtual = patient.phone ? String(patient.phone).trim() : '';
    const motivoIrregularidade = getMotivoIrregularidadeOperacao(telefoneAtual);

    const handleTelefoneChange = (val: string) => {
        const masked = maskPhoneInput(val);
        setNovoTelefone(masked);
        setErrorMessage('');

        const clean = masked.replace(/\D/g, '');
        if (!clean) {
            setTelefoneError('');
        } else if (clean.length >= 10) {
            const check = validateBrazilianPhone(masked, { required: true });
            if (!check.isValid) {
                setTelefoneError(check.errorMessage || TELEFONE_INVALIDO_MSG);
            } else {
                setTelefoneError('');
            }
        } else if (telefoneError) {
            setTelefoneError('');
        }
    };

    // Submissão de regularização do telefone
    const handleSalvarEContinuar = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        setErrorMessage('');

        const phoneValidation = validateBrazilianPhone(novoTelefone, { required: true });
        if (!phoneValidation.isValid) {
            const msg = phoneValidation.errorMessage || TELEFONE_INVALIDO_MSG;
            setTelefoneError(msg);
            setErrorMessage(msg);
            inputRef.current?.focus();
            return;
        }

        const phoneFormatado = phoneValidation.formatted || novoTelefone.trim();

        setIsSaving(true);
        try {
            // 1. Atualiza no Supabase
            const updated = await updatePaciente(patient.id, {
                phone: phoneFormatado
            });

            if (!updated) {
                throw new Error('Não foi possível salvar o telefone do paciente no banco de dados.');
            }

            // 2. Registra na Auditoria
            try {
                await auditLogService.logAction({
                    action_type: 'PACIENTE_TELEFONE_REGULARIZADO',
                    module: moduloOrigem,
                    description: `Telefone do paciente ${patient.name} (CPF: ${patient.cpf || 'S/N'}) regularizado de "${telefoneAtual || 'Sem telefone'}" para "${phoneFormatado}" pelo operador ${nomeUsuario}.`,
                    details: {
                        paciente_id: patient.id,
                        paciente_nome: patient.name,
                        telefone_anterior: telefoneAtual,
                        telefone_novo: phoneFormatado,
                        operador: nomeUsuario,
                        modulo_origem: moduloOrigem
                    },
                    user: activeUser ? {
                        id: activeUser.id,
                        name: activeUser.name,
                        email: activeUser.email
                    } : undefined
                });
            } catch (auditErr) {
                console.warn('[RegularizacaoTelefoneModal] Falha ao registrar log de auditoria:', auditErr);
            }

            // 3. Notifica listeners globais para atualização de caches
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('consultas-pacientes-changed', { detail: updated }));
                window.dispatchEvent(new CustomEvent('paciente-alterado', { detail: updated }));
                window.dispatchEvent(new CustomEvent('farmacia-pacientes-changed', { detail: updated }));
            }

            // 4. Conclui com sucesso liberando o fluxo da operação
            onSuccess(updated);
            onClose();
        } catch (err: any) {
            console.error('[RegularizacaoTelefoneModal] Erro ao salvar telefone:', err);
            setErrorMessage(err.message || 'Erro ao regularizar telefone. Tente novamente.');
        } finally {
            setIsSaving(false);
        }
    };

    // Submissão da Exceção Assistencial / Urgência
    const handleConfirmarExcecao = async () => {
        if (!justificativaExcecao.trim() || justificativaExcecao.trim().length < 10) {
            setErrorMessage('A justificativa da exceção assistencial é obrigatória (mínimo 10 caracteres).');
            return;
        }

        setIsSavingExcecao(true);
        try {
            // Registra auditoria da exceção assistencial
            try {
                await auditLogService.logAction({
                    action_type: 'EXCECAO_ASSISTENCIAL_TELEFONE',
                    module: moduloOrigem,
                    description: `Exceção assistencial/urgência autorizada para paciente ${patient.name} (CPF: ${patient.cpf || 'S/N'}) sem regularização de telefone pelo operador ${nomeUsuario}. Motivo: ${justificativaExcecao.trim()}`,
                    details: {
                        paciente_id: patient.id,
                        paciente_nome: patient.name,
                        telefone_atual: telefoneAtual,
                        justificativa: justificativaExcecao.trim(),
                        operador: nomeUsuario,
                        modulo_origem: moduloOrigem
                    },
                    user: activeUser ? {
                        id: activeUser.id,
                        name: activeUser.name,
                        email: activeUser.email
                    } : undefined
                });
            } catch (auditErr) {
                console.warn('[RegularizacaoTelefoneModal] Falha ao registrar log de auditoria da exceção:', auditErr);
            }

            if (onExceptionAllowed) {
                onExceptionAllowed(patient, justificativaExcecao.trim());
            } else {
                onSuccess(patient);
            }
            onClose();
        } catch (err: any) {
            console.error('[RegularizacaoTelefoneModal] Erro ao registrar exceção:', err);
            setErrorMessage(err.message || 'Erro ao registrar exceção assistencial.');
        } finally {
            setIsSavingExcecao(false);
        }
    };

    const isNovoTelefoneValido = validateBrazilianPhone(novoTelefone, { required: true }).isValid;

    return (
        <div 
            className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs select-none animate-in fade-in duration-150"
            role="dialog"
            aria-modal="true"
        >
            <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
                {/* 1. TOPO: Identificação e Alerta Personalizado */}
                <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 px-5 py-4 text-white relative">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSaving || isSavingExcecao}
                        className="absolute right-4 top-4 p-1 rounded-full text-white/80 hover:text-white hover:bg-white/20 transition-all cursor-pointer disabled:opacity-50"
                        title="Cancelar e voltar"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    <div className="flex items-start gap-3 pr-8">
                        <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0 shadow-inner">
                            <Phone className="w-5 h-5 text-white" />
                        </div>
                        <div className="min-w-0">
                            <span className="text-[10px] font-black uppercase tracking-widest text-amber-100 block">
                                Bloqueio Preventivo • {moduloOrigem}
                            </span>
                            <h3 className="text-base sm:text-lg font-black tracking-tight leading-snug">
                                Atenção, {nomeUsuario}!
                            </h3>
                        </div>
                    </div>

                    {/* Mensagem Personalizada Obrigatória */}
                    <div className="mt-3 bg-white/15 backdrop-blur-xs rounded-2xl p-3 border border-white/20 text-xs sm:text-[13px] leading-relaxed font-medium">
                        <p>
                            Para prosseguir com esta solicitação, por favor, solicite ao paciente <strong className="font-black text-white underline decoration-white/40">{nomePaciente}</strong> um número de telefone válido para contato.
                        </p>
                        <p className="mt-1 text-[11px] text-amber-100">
                            O telefone atualmente cadastrado está irregular e precisa ser atualizado antes de continuar.
                        </p>
                    </div>
                </div>

                {/* 2. CORPO DO MODAL */}
                <div className="p-5 sm:p-6 space-y-4 overflow-y-auto max-h-[70vh] no-scrollbar">
                    {/* Dados do Paciente e Telefone Atual Irregular */}
                    <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-3.5 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                                <div className="w-7 h-7 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center shrink-0 font-black text-xs uppercase">
                                    <UserIcon className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                    <h4 className="text-xs sm:text-sm font-black text-slate-900 uppercase truncate">
                                        {patient.name}
                                    </h4>
                                    <span className="text-[10px] font-mono font-bold text-slate-500">
                                        CPF: {patient.cpf ? patient.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : 'Sem CPF'}
                                    </span>
                                </div>
                            </div>

                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200 shrink-0">
                                Irregular
                            </span>
                        </div>

                        <div className="pt-2 border-t border-slate-200/70 flex flex-wrap items-center justify-between gap-1 text-xs">
                            <span className="text-slate-500 font-bold">Telefone Cadastrado:</span>
                            <span className="font-mono font-bold text-rose-700 bg-rose-50/80 px-2 py-0.5 rounded-md border border-rose-200 flex items-center gap-1">
                                <span className={telefoneAtual ? 'line-through' : ''}>
                                    {telefoneAtual || 'Nenhum telefone informado'}
                                </span>
                            </span>
                        </div>
                        {motivoIrregularidade && (
                            <p className="text-[11px] text-rose-600 font-semibold leading-tight">
                                Motivo: {motivoIrregularidade}
                            </p>
                        )}
                    </div>

                    {/* Mensagem de Erro Geral */}
                    {errorMessage && (
                        <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-start gap-2 animate-in fade-in">
                            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                            <span>{errorMessage}</span>
                        </div>
                    )}

                    {/* Formulário Principal de Regularização */}
                    {!showExceptionBox && (
                        <form onSubmit={handleSalvarEContinuar} className="space-y-3.5">
                            <div>
                                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5 flex items-center justify-between">
                                    <span className="flex items-center gap-1">
                                        <Phone className="w-3.5 h-3.5 text-indigo-600" />
                                        <span>Novo Telefone / WhatsApp *</span>
                                    </span>
                                    <span className="text-[10px] font-bold text-slate-400 normal-case">
                                        Celular (11 dígitos) ou Fixo
                                    </span>
                                </label>
                                
                                <div className="relative">
                                    <input
                                        ref={inputRef}
                                        type="tel"
                                        required
                                        autoFocus
                                        value={novoTelefone}
                                        onChange={(e) => handleTelefoneChange(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                void handleSalvarEContinuar();
                                            }
                                        }}
                                        placeholder="(31) 90000-0000"
                                        className={`w-full px-3.5 py-3 text-sm font-black font-mono rounded-2xl transition-all outline-none shadow-inner ${
                                            telefoneError 
                                                ? 'border-2 border-rose-400 bg-rose-50/50 text-rose-900 focus:bg-white focus:border-rose-500' 
                                                : isNovoTelefoneValido
                                                    ? 'border-2 border-emerald-400 bg-emerald-50/40 text-emerald-900 focus:bg-white'
                                                    : 'border-2 border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 text-slate-800'
                                        }`}
                                    />
                                    {isNovoTelefoneValido && (
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center animate-in zoom-in-75">
                                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                                        </div>
                                    )}
                                </div>

                                {telefoneError ? (
                                    <p className="text-[11px] font-bold text-rose-600 mt-1.5 flex items-center gap-1 animate-in fade-in">
                                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                                        <span>{telefoneError}</span>
                                    </p>
                                ) : isNovoTelefoneValido ? (
                                    <p className="text-[11px] font-bold text-emerald-600 mt-1.5 flex items-center gap-1 animate-in fade-in">
                                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
                                        <span>Telefone válido e em conformidade com as regras da Anatel.</span>
                                    </p>
                                ) : (
                                    <p className="text-[10px] font-medium text-slate-400 mt-1">
                                        Pressione <strong>Enter</strong> ou clique no botão para salvar e prosseguir.
                                    </p>
                                )}
                            </div>

                            {/* Botão Principal: Salvar e Continuar */}
                            <button
                                type="button"
                                onClick={() => handleSalvarEContinuar()}
                                disabled={isSaving || !novoTelefone.trim() || Boolean(telefoneError)}
                                className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-emerald-600/20 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSaving ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span>Atualizando Prontuário...</span>
                                    </>
                                ) : (
                                    <>
                                        <Check className="w-4 h-4 stroke-[3]" />
                                        <span>Salvar e Continuar Operação</span>
                                        <ArrowRight className="w-3.5 h-3.5" />
                                    </>
                                )}
                            </button>
                        </form>
                    )}

                    {/* Fluxo Excepcional Autorizado: Urgência / Assistência Essencial */}
                    {showExceptionBox ? (
                        <div className="bg-amber-50/80 border border-amber-300 rounded-2xl p-4 space-y-3 animate-in fade-in">
                            <div className="flex items-start gap-2">
                                <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                                <div className="space-y-0.5">
                                    <h5 className="text-xs font-black text-amber-900 uppercase">
                                        Exceção Assistencial de Urgência
                                    </h5>
                                    <p className="text-[11px] text-amber-800 leading-tight">
                                        Utilize esta opção apenas em casos de emergência médica ou assistência prioritária em que o paciente esteja impossibilitado de informar o telefone no momento.
                                    </p>
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-wider text-amber-900 mb-1">
                                    Justificativa Assistencial Obrigatória *
                                </label>
                                <textarea
                                    value={justificativaExcecao}
                                    onChange={(e) => setJustificativaExcecao(e.target.value)}
                                    placeholder="Descreva a razão médica/assistencial para liberar a operação sem telefone válido..."
                                    rows={2}
                                    className="w-full p-2.5 bg-white border border-amber-300 rounded-xl text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 shadow-inner"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-1">
                                <button
                                    type="button"
                                    onClick={() => setShowExceptionBox(false)}
                                    disabled={isSavingExcecao}
                                    className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-slate-600 text-xs font-bold hover:bg-slate-50 transition-all cursor-pointer"
                                >
                                    Voltar
                                </button>
                                <button
                                    type="button"
                                    onClick={handleConfirmarExcecao}
                                    disabled={isSavingExcecao || justificativaExcecao.trim().length < 10}
                                    className="px-4 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black uppercase tracking-wider shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                >
                                    {isSavingExcecao ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldAlert className="w-3.5 h-3.5" />}
                                    <span>Confirmar Exceção e Prosseguir</span>
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="pt-2 text-center">
                            <button
                                type="button"
                                onClick={() => setShowExceptionBox(true)}
                                className="text-[11px] font-bold text-slate-400 hover:text-amber-700 underline decoration-slate-300 hover:decoration-amber-500 transition-colors cursor-pointer inline-flex items-center gap-1"
                            >
                                <ShieldAlert className="w-3 h-3 text-slate-400" />
                                <span>Situação de emergência médica? Registrar Exceção Assistencial</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* 3. RODAPÉ INFORMATIVO */}
                <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-400 font-semibold">
                    <span>Base Integrada Municipal • Central de Regulação e Farmácia</span>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSaving || isSavingExcecao}
                        className="text-slate-500 hover:text-slate-800 font-bold uppercase transition-colors cursor-pointer"
                    >
                        Cancelar
                    </button>
                </div>
            </div>
        </div>
    );
};
