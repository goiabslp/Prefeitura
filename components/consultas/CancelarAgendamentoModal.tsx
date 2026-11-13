import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
    X,
    XCircle,
    Clock,
    AlertTriangle,
    Loader2,
    Calendar,
    User as UserIcon,
    FileText,
    ShieldAlert,
    CheckCircle2,
    AlertCircle
} from 'lucide-react';
import { ConsultaAgendamento, ConsultaSolicitacaoCancelamento, User } from '../../types';
import * as db from '../../services/consultasService';
import {
    MOTIVOS_CANCELAMENTO,
    CONFIRMACAO_VERACIDADE_TEXT,
    normalizeJustificativa,
    validateCancelamentoForm,
    validateJustificativaManual
} from '../../services/cancelamentoMotivos';

interface CancelarAgendamentoModalProps {
    isOpen: boolean;
    onClose: () => void;
    booking: ConsultaAgendamento | null;
    currentUser: User;
    isGestorOrAdmin: boolean;
    pendingCancelRequest?: ConsultaSolicitacaoCancelamento | null;
    onSuccess?: () => void;
}

export const CancelarAgendamentoModal: React.FC<CancelarAgendamentoModalProps> = ({
    isOpen,
    onClose,
    booking,
    currentUser,
    isGestorOrAdmin,
    pendingCancelRequest,
    onSuccess
}) => {
    const [selectedMotivo, setSelectedMotivo] = useState<string>('');
    const [justificativa, setJustificativa] = useState<string>('');
    const [lastDefaultJustificativa, setLastDefaultJustificativa] = useState<string>('');
    const [isConfirmedVeracidade, setIsConfirmedVeracidade] = useState<boolean>(false);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string>('');

    // Resetar formulário ao abrir para um novo agendamento
    useEffect(() => {
        if (isOpen && booking) {
            setSelectedMotivo('');
            setJustificativa('');
            setLastDefaultJustificativa('');
            setIsConfirmedVeracidade(false);
            setIsSubmitting(false);
            setErrorMessage('');
        }
    }, [isOpen, booking?.id]);

    // Cálculo em tempo real dos caracteres normalizados (sem espaços excedentes)
    const normalizedLength = useMemo(() => {
        return normalizeJustificativa(justificativa).length;
    }, [justificativa]);

    // Validação em tempo real
    const formValidation = useMemo(() => {
        if (!isOpen || !booking) return { isValid: false, normalizedLength: 0 };
        return validateCancelamentoForm({
            motivo: selectedMotivo,
            justificativa,
            isConfirmedVeracidade
        });
    }, [isOpen, booking, selectedMotivo, justificativa, isConfirmedVeracidade]);

    if (!isOpen || !booking || typeof document === 'undefined') {
        return null;
    }

    const isManualOption = selectedMotivo === 'Outro';

    // Troca de motivo com confirmação caso o usuário tenha customizado o texto anterior
    const handleMotivoChange = (newMotivoLabel: string) => {
        if (!newMotivoLabel) {
            setSelectedMotivo('');
            setJustificativa('');
            setLastDefaultJustificativa('');
            return;
        }

        const newOption = MOTIVOS_CANCELAMENTO.find(m => m.label === newMotivoLabel);
        if (!newOption) return;

        // Verifica se a justificativa atual foi modificada pelo usuário
        const isCustomized = Boolean(
            selectedMotivo &&
            justificativa.trim() !== '' &&
            justificativa.trim() !== lastDefaultJustificativa.trim()
        );

        if (isCustomized) {
            const confirmReplace = window.confirm(
                'A justificativa atual foi personalizada.\n\nDeseja substituí-la pelo texto padrão do novo motivo selecionado?'
            );
            if (!confirmReplace) {
                // Preserva o texto digitado pelo usuário e apenas altera o motivo
                setSelectedMotivo(newMotivoLabel);
                return;
            }
        }

        setSelectedMotivo(newMotivoLabel);
        setJustificativa(newOption.defaultJustificativa);
        setLastDefaultJustificativa(newOption.defaultJustificativa);
        if (errorMessage) setErrorMessage('');
    };

    const handleClose = () => {
        if (isSubmitting) return;
        onClose();
    };

    const handleSubmit = async () => {
        if (!booking) return;

        // Validação final de segurança no frontend
        const validation = validateCancelamentoForm({
            motivo: selectedMotivo,
            justificativa,
            isConfirmedVeracidade
        });

        if (!validation.isValid) {
            setErrorMessage(validation.error || 'Por favor, preencha todos os campos obrigatórios corretamente.');
            return;
        }

        setIsSubmitting(true);
        setErrorMessage('');

        try {
            if (isGestorOrAdmin) {
                // Fluxo Executivo Imediato: Cancelamento definitivo direto no Supabase com auditoria
                const res = await db.cancelAgendamentoImediato({
                    agendamentoId: booking.id,
                    motivo: selectedMotivo,
                    justificativa: justificativa.trim(),
                    usuario: {
                        id: currentUser.id,
                        name: currentUser.name,
                        sector: currentUser.sector,
                        role: currentUser.role,
                        is_admin: (currentUser as any).is_admin,
                        access_level: (currentUser as any).access_level
                    },
                    confirmacaoVeracidade: isConfirmedVeracidade,
                    bookingSnapshot: booking
                });

                if (!res.success) {
                    setErrorMessage(res.error || 'Erro ao realizar cancelamento imediato.');
                    setIsSubmitting(false);
                    return;
                }
            } else {
                // Fluxo Solicitante Comum: Encaminha solicitação de cancelamento para os Gestores
                const res = await db.solicitarCancelamentoAgendamento({
                    agendamentoId: booking.id,
                    motivo: selectedMotivo,
                    justificativa: justificativa.trim(),
                    confirmacaoVeracidade: isConfirmedVeracidade,
                    solicitante: {
                        id: currentUser.id,
                        name: currentUser.name,
                        sector: currentUser.sector
                    },
                    bookingSnapshot: booking
                });

                if (!res.success) {
                    setErrorMessage(res.error || 'Erro ao enviar solicitação de cancelamento.');
                    setIsSubmitting(false);
                    return;
                }
            }

            // Sucesso: fecha o modal e notifica
            onClose();
            if (onSuccess) {
                onSuccess();
            }
        } catch (err: any) {
            console.error('[CancelarAgendamentoModal] Erro ao submeter cancelamento:', err);
            setErrorMessage(err.message || 'Erro inesperado ao processar cancelamento.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Formatação de data brasileira
    const formatDateBr = (dateStr?: string | null): string => {
        if (!dateStr) return 'Fila de Espera';
        try {
            const cleanDate = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
            const parts = cleanDate.split('-');
            if (parts.length === 3) {
                return `${parts[2]}/${parts[1]}/${parts[0]}`;
            }
            return new Date(dateStr).toLocaleDateString('pt-BR');
        } catch {
            return dateStr;
        }
    };

    // Formatação de CPF
    const formatCpf = (rawCpf?: string | null): string => {
        if (!rawCpf) return 'S/ CPF';
        const cleaned = rawCpf.replace(/\D/g, '');
        if (cleaned.length === 11) {
            return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
        }
        return rawCpf;
    };

    const hasPendingCancel = Boolean(pendingCancelRequest);

    return createPortal(
        <div
            className="fixed inset-0 z-[99999] flex items-center justify-center p-2.5 sm:p-4 md:p-6 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-200 select-none cursor-pointer"
            role="dialog"
            aria-modal="true"
            onClick={handleClose}
        >
            <div
                className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-2xl lg:max-w-3xl max-h-[92vh] overflow-hidden border border-rose-200/90 flex flex-col animate-in zoom-in-95 duration-200 cursor-default"
                onClick={(e) => e.stopPropagation()}
            >
                {/* 1. Cabeçalho */}
                <div className={`px-4 py-3 sm:px-6 sm:py-3.5 border-b flex justify-between items-center shrink-0 shadow-xs ${
                    isGestorOrAdmin
                        ? 'border-rose-200 bg-gradient-to-r from-rose-50 via-rose-100/70 to-amber-50 text-rose-950'
                        : 'border-amber-200 bg-gradient-to-r from-amber-50 via-amber-100/70 to-yellow-50 text-amber-950'
                }`}>
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                        <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shadow-inner shrink-0 ${
                            isGestorOrAdmin ? 'bg-rose-600 text-white shadow-rose-200' : 'bg-amber-600 text-white shadow-amber-200'
                        }`}>
                            {isGestorOrAdmin ? <XCircle className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider truncate">
                                {isGestorOrAdmin ? 'Cancelar Agendamento Imediatamente' : 'Solicitar Cancelamento de Agendamento'}
                            </h3>
                            <p className="text-[10px] font-bold uppercase tracking-wider mt-0.5 opacity-90 truncate">
                                {isGestorOrAdmin
                                    ? 'Ação de Gestora — Cancelamento Definitivo'
                                    : 'Aprovação Obrigatória pelos Gestores da Regulação'}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={handleClose}
                        disabled={isSubmitting}
                        className="p-1.5 hover:bg-slate-200/60 active:bg-slate-300/60 rounded-xl text-slate-400 hover:text-slate-700 transition-colors cursor-pointer shrink-0 ml-2"
                        title="Fechar modal de cancelamento"
                        aria-label="Fechar"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Corpo do Modal — Layout Compacto e Responsivo */}
                <div className="p-3.5 sm:p-5 overflow-y-auto custom-scrollbar space-y-3 sm:space-y-3.5 text-xs select-text">
                    {/* Alerta de solicitação já pendente para este agendamento */}
                    {hasPendingCancel && pendingCancelRequest && (
                        <div className="p-3 bg-amber-50 border border-amber-300 rounded-2xl text-amber-900 space-y-1.5 animate-in fade-in">
                            <div className="flex items-center gap-2 font-black text-xs uppercase text-amber-800">
                                <Clock className="w-4 h-4 text-amber-600 animate-pulse" />
                                <span>Solicitação Já Enviada e em Análise pela Regulação</span>
                            </div>
                            <p className="text-[11px] font-medium leading-relaxed">
                                Este agendamento já possui uma solicitação de cancelamento aberta aguardando aprovação dos gestores.
                            </p>
                            <div className="pt-2 border-t border-amber-200/70 text-[10px] grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                <div><span className="font-bold">Solicitante:</span> {pendingCancelRequest.solicitante_nome}</div>
                                <div><span className="font-bold">Setor:</span> {pendingCancelRequest.solicitante_setor}</div>
                                <div className="sm:col-span-2"><span className="font-bold">Justificativa Original:</span> "{pendingCancelRequest.justificativa_solicitacao}"</div>
                            </div>
                        </div>
                    )}

                    {/* 2. Informações do Agendamento (Grid Compacto de 4 colunas em Desktop) */}
                    <div className="p-3 sm:p-3.5 bg-slate-50/90 rounded-2xl border border-slate-200/90 space-y-2">
                        <div className="flex items-center justify-between border-b border-slate-200/70 pb-1">
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                                <FileText className="w-3.5 h-3.5 text-slate-400" />
                                <span>Informações do Agendamento</span>
                            </span>
                            <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-slate-200/70 text-slate-700 font-mono">
                                ID: {booking.id.substring(0, 8).toUpperCase()}
                            </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
                            {/* Paciente */}
                            <div className="p-2 bg-white rounded-xl border border-slate-200">
                                <span className="text-[9px] font-bold uppercase text-slate-400 block truncate">Paciente</span>
                                <span className="font-black text-slate-900 text-xs block truncate uppercase mt-0.5" title={booking.paciente?.name}>
                                    {booking.paciente?.name || 'Paciente não informado'}
                                </span>
                                <span className="text-[9.5px] font-mono text-slate-500 block truncate">
                                    CPF: {formatCpf(booking.paciente?.cpf)}
                                </span>
                            </div>

                            {/* Procedimento */}
                            <div className="p-2 bg-white rounded-xl border border-slate-200">
                                <span className="text-[9px] font-bold uppercase text-slate-400 block truncate">Procedimento</span>
                                <span className="font-black text-sky-700 text-xs block truncate uppercase mt-0.5" title={booking.procedimento?.name}>
                                    {booking.procedimento?.name || 'Procedimento'}
                                </span>
                                <span className="text-[9.5px] font-mono font-bold text-slate-500 block truncate">
                                    CÓD. {booking.procedimento?.code || 'N/A'}
                                </span>
                            </div>

                            {/* Data Atual */}
                            <div className="p-2 bg-white rounded-xl border border-slate-200">
                                <span className="text-[9px] font-bold uppercase text-slate-400 block truncate">Data Atual</span>
                                <span className="font-black text-slate-800 text-xs block truncate mt-0.5">
                                    {formatDateBr(booking.appointment_date)}
                                </span>
                                <span className="text-[9.5px] text-slate-500 block truncate">
                                    {booking.appointment_time ? `${booking.appointment_time}h` : (booking.appointment_date ? 'Horário a definir' : 'Sem agendamento')}
                                </span>
                            </div>

                            {/* Situação */}
                            <div className="p-2 bg-white rounded-xl border border-slate-200">
                                <span className="text-[9px] font-bold uppercase text-slate-400 block truncate">Situação</span>
                                <span className="inline-flex px-1.5 py-0.5 rounded text-[9.5px] font-black uppercase tracking-wider mt-0.5 bg-slate-100 text-slate-800 border border-slate-200 truncate">
                                    {booking.status || 'Solicitado'}
                                </span>
                                <span className="text-[9px] text-slate-400 block truncate mt-0.5">
                                    {booking.priority ? `Prioridade ${booking.priority}` : 'Prioridade Normal'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* 3. Motivo e Justificativa */}
                    <div className="space-y-3">
                        {/* Select: Motivo do Cancelamento */}
                        <div className="space-y-1">
                            <label className="block text-[10.5px] font-black uppercase tracking-wider text-slate-800">
                                Motivo do Cancelamento <span className="text-rose-600">*</span>
                            </label>
                            <select
                                value={selectedMotivo}
                                onChange={(e) => handleMotivoChange(e.target.value)}
                                disabled={isSubmitting}
                                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 shadow-2xs transition-all cursor-pointer"
                                required
                            >
                                <option value="">Selecione o motivo do cancelamento...</option>
                                {MOTIVOS_CANCELAMENTO.map((motivo) => (
                                    <option key={motivo.label} value={motivo.label}>
                                        {motivo.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Campo: Justificativa do Cancelamento */}
                        <div className="space-y-1">
                            <div className="flex items-center justify-between">
                                <label className="block text-[10.5px] font-black uppercase tracking-wider text-slate-800">
                                    Justificativa do Cancelamento <span className="text-rose-600">*</span>
                                </label>
                                {isManualOption && (
                                    <span className={`text-[10.5px] font-mono font-black ${
                                        normalizedLength >= 100 ? 'text-emerald-700' : 'text-amber-700'
                                    }`}>
                                        {normalizedLength}/100 caracteres {normalizedLength >= 100 ? '✓' : '(mínimo 100)'}
                                    </span>
                                )}
                            </div>

                            <textarea
                                value={justificativa}
                                onChange={(e) => {
                                    setJustificativa(e.target.value);
                                    if (errorMessage) setErrorMessage('');
                                }}
                                disabled={isSubmitting}
                                rows={3}
                                placeholder={
                                    isManualOption
                                        ? "Descreva detalhadamente o motivo do cancelamento, utilizando no mínimo 100 caracteres..."
                                        : selectedMotivo
                                        ? "A justificativa foi preenchida automaticamente. Você pode editar, corrigir ou complementar se necessário..."
                                        : "Selecione primeiro o Motivo do Cancelamento acima para carregar a justificativa automática..."
                                }
                                className={`w-full p-3 bg-white border rounded-xl text-xs font-medium text-slate-800 outline-none transition-all resize-none shadow-2xs leading-relaxed ${
                                    isManualOption && normalizedLength < 100
                                        ? 'border-amber-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20'
                                        : 'border-slate-300 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20'
                                }`}
                                required
                            />

                            {/* Mensagem orientativa exclusiva para a opção "Outro" */}
                            {isManualOption && (
                                <p className="text-[10.5px] text-amber-800 font-semibold leading-snug flex items-center gap-1.5 mt-0.5">
                                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                    <span>Descreva detalhadamente o motivo do cancelamento, utilizando no mínimo 100 caracteres.</span>
                                </p>
                            )}
                        </div>

                        {/* Confirmação de Veracidade das Informações */}
                        <label className={`flex items-start gap-2.5 p-3 rounded-xl border transition-all cursor-pointer shadow-2xs ${
                            isConfirmedVeracidade
                                ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950'
                                : 'bg-slate-50/90 border-slate-200 hover:bg-slate-100/80 text-slate-800'
                        }`}>
                            <input
                                type="checkbox"
                                checked={isConfirmedVeracidade}
                                onChange={(e) => {
                                    setIsConfirmedVeracidade(e.target.checked);
                                    if (errorMessage) setErrorMessage('');
                                }}
                                disabled={isSubmitting}
                                className="mt-0.5 w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer shrink-0"
                            />
                            <span className="text-xs font-bold leading-snug select-none">
                                {CONFIRMACAO_VERACIDADE_TEXT} <span className="text-rose-600">*</span>
                            </span>
                        </label>
                    </div>

                    {/* Alerta de erro de validação */}
                    {errorMessage && (
                        <div className="p-2.5 sm:p-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 font-extrabold text-xs flex items-center gap-2 animate-in fade-in">
                            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                            <span className="leading-snug">{errorMessage}</span>
                        </div>
                    )}

                    {/* Aviso de Auditoria e Perfil */}
                    <div className={`p-2.5 rounded-xl text-[10px] font-bold flex items-center gap-2 border ${
                        isGestorOrAdmin
                            ? 'bg-rose-50/60 border-rose-200 text-rose-800'
                            : 'bg-amber-50/60 border-amber-200 text-amber-800'
                    }`}>
                        <span>
                            {isGestorOrAdmin
                                ? `🔒 Cancelamento executivo imediato registrado com auditoria indelével por: ${currentUser.name}`
                                : `📋 Solicitação será encaminhada para aprovação dos Gestores da Regulação. O agendamento permanecerá ativo até a decisão.`}
                        </span>
                    </div>
                </div>

                {/* 4. Rodapé e Botões de Ação */}
                <div className="px-4 py-3 sm:px-6 sm:py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5 sm:gap-3 shrink-0">
                    <button
                        type="button"
                        onClick={handleClose}
                        disabled={isSubmitting}
                        className="px-3.5 sm:px-4 py-2 sm:py-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-2xs text-center"
                    >
                        Manter Agendamento
                    </button>

                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={isSubmitting || !formValidation.isValid}
                        className={`px-4 sm:px-5 py-2 sm:py-2.5 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 ${
                            isGestorOrAdmin
                                ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
                                : 'bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-700 hover:to-rose-700 shadow-amber-600/20'
                        }`}
                        title={
                            !selectedMotivo
                                ? 'Selecione o motivo do cancelamento'
                                : isManualOption && normalizedLength < 100
                                ? 'A opção Outro exige no mínimo 100 caracteres'
                                : !isConfirmedVeracidade
                                ? 'Confirme a veracidade das informações para prosseguir'
                                : isGestorOrAdmin
                                ? 'Confirmar Cancelamento Imediato'
                                : 'Solicitar Cancelamento'
                        }
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                                <span>Processando...</span>
                            </>
                        ) : isGestorOrAdmin ? (
                            <>
                                <XCircle className="w-4 h-4 shrink-0" />
                                <span>Confirmar Cancelamento Imediato</span>
                            </>
                        ) : (
                            <>
                                <Clock className="w-4 h-4 shrink-0" />
                                <span>Solicitar Cancelamento</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};
