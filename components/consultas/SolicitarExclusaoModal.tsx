import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
    X,
    Trash2,
    Clock,
    AlertTriangle,
    Loader2,
    Calendar,
    User as UserIcon,
    FileText,
    CheckCircle2,
    AlertCircle,
    Hash,
    Layers
} from 'lucide-react';
import { ConsultaAgendamento, User } from '../../types';
import * as db from '../../services/consultasService';
import {
    MOTIVOS_EXCLUSAO,
    normalizeJustificativaExclusao,
    validateExclusaoForm
} from '../../services/exclusaoMotivos';

interface SolicitarExclusaoModalProps {
    isOpen: boolean;
    onClose: () => void;
    booking: ConsultaAgendamento | null;
    currentUser: User;
    onSuccess?: () => void;
}

export const SolicitarExclusaoModal: React.FC<SolicitarExclusaoModalProps> = ({
    isOpen,
    onClose,
    booking,
    currentUser,
    onSuccess
}) => {
    const [selectedMotivo, setSelectedMotivo] = useState<string>('');
    const [justificativa, setJustificativa] = useState<string>('');
    const [lastDefaultJustificativa, setLastDefaultJustificativa] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string>('');
    const [feedbackSuccess, setFeedbackSuccess] = useState<string>('');

    // Resetar formulário ao abrir
    useEffect(() => {
        if (isOpen && booking) {
            setSelectedMotivo('');
            setJustificativa('');
            setLastDefaultJustificativa('');
            setIsSubmitting(false);
            setErrorMessage('');
            setFeedbackSuccess('');
        }
    }, [isOpen, booking?.id]);

    // Contagem em tempo real de caracteres normalizados
    const normalizedLength = useMemo(() => {
        return normalizeJustificativaExclusao(justificativa).length;
    }, [justificativa]);

    // Validação em tempo real
    const formValidation = useMemo(() => {
        if (!isOpen || !booking) return { isValid: false, normalizedLength: 0 };
        return validateExclusaoForm({
            motivo: selectedMotivo,
            justificativa
        });
    }, [isOpen, booking, selectedMotivo, justificativa]);

    if (!isOpen || !booking || typeof document === 'undefined') {
        return null;
    }

    const isManualOption = selectedMotivo === 'Outro';

    // Troca de motivo com confirmação se o usuário editou o texto anterior
    const handleMotivoChange = (newMotivoLabel: string) => {
        if (!newMotivoLabel) {
            setSelectedMotivo('');
            setJustificativa('');
            setLastDefaultJustificativa('');
            return;
        }

        const newOption = MOTIVOS_EXCLUSAO.find(m => m.label === newMotivoLabel);
        if (!newOption) return;

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

        const validation = validateExclusaoForm({
            motivo: selectedMotivo,
            justificativa
        });

        if (!validation.isValid) {
            setErrorMessage(validation.error || 'Por favor, preencha todos os campos obrigatórios corretamente.');
            return;
        }

        setIsSubmitting(true);
        setErrorMessage('');

        try {
            const res = await db.solicitarExclusaoAgendamento({
                agendamentoId: booking.id,
                motivo: selectedMotivo,
                justificativa: justificativa.trim(),
                solicitante: {
                    id: currentUser.id,
                    name: currentUser.name,
                    sector: currentUser.sector
                },
                bookingSnapshot: booking
            });

            if (!res.success) {
                setErrorMessage(res.error || 'Erro ao enviar solicitação de exclusão.');
                setIsSubmitting(false);
                return;
            }

            setFeedbackSuccess('Solicitação de exclusão encaminhada com sucesso para aprovação dos gestores!');
            setTimeout(() => {
                onClose();
                if (onSuccess) {
                    onSuccess();
                }
            }, 1200);
        } catch (err: any) {
            console.error('[SolicitarExclusaoModal] Erro ao enviar solicitação de exclusão:', err);
            setErrorMessage(err.message || 'Erro inesperado ao processar solicitação de exclusão.');
            setIsSubmitting(false);
        }
    };

    // Formatações auxiliares
    const formatDateBr = (dateStr?: string | null): string => {
        if (!dateStr) return 'Não informada';
        try {
            const clean = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
            const parts = clean.split('-');
            if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
            return new Date(dateStr).toLocaleDateString('pt-BR');
        } catch {
            return dateStr;
        }
    };

    const formatCpf = (rawCpf?: string | null): string => {
        if (!rawCpf) return 'S/ CPF';
        const cleaned = rawCpf.replace(/\D/g, '');
        if (cleaned.length === 11) {
            return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
        }
        return rawCpf;
    };

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
                <div className="px-4 py-3 sm:px-6 sm:py-3.5 border-b border-rose-200 bg-gradient-to-r from-rose-600 via-rose-700 to-rose-800 text-white flex justify-between items-center shrink-0 shadow-sm">
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-white shadow-inner shrink-0">
                            <Trash2 className="w-5 h-5 animate-pulse" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-white truncate">
                                Solicitar Exclusão de Procedimento
                            </h3>
                            <p className="text-[10px] text-rose-100 font-bold uppercase tracking-wider mt-0.5 truncate">
                                Aprovação Obrigatória pelos Gestores da Regulação
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={handleClose}
                        disabled={isSubmitting}
                        className="p-1.5 hover:bg-white/20 active:bg-white/30 rounded-xl text-white transition-colors cursor-pointer shrink-0 ml-2"
                        title="Fechar modal de solicitação de exclusão"
                        aria-label="Fechar"
                    >
                        <X className="w-5 h-5 text-white" />
                    </button>
                </div>

                {/* 2. Corpo do Modal — Compacto, Responsivo e Sem Rolagem em Desktop */}
                <div className="p-3.5 sm:p-5 overflow-y-auto custom-scrollbar space-y-3 sm:space-y-3.5 text-xs select-text">
                    {/* Alerta de Feedback de Sucesso */}
                    {feedbackSuccess && (
                        <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 font-black text-xs flex items-center gap-2 animate-in fade-in">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>{feedbackSuccess}</span>
                        </div>
                    )}

                    {/* Dados Apresentados (Grid Compacto de 6 dados organizados em cards) */}
                    <div className="p-3 sm:p-3.5 bg-slate-50/90 rounded-2xl border border-slate-200/90 space-y-2">
                        <div className="flex items-center justify-between border-b border-slate-200/70 pb-1">
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                                <FileText className="w-3.5 h-3.5 text-slate-400" />
                                <span>Dados da Solicitação</span>
                            </span>
                            <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-mono">
                                ID: {booking.id.substring(0, 8).toUpperCase()}
                            </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-2.5">
                            {/* 1. Nome do Paciente */}
                            <div className="p-2 bg-white rounded-xl border border-slate-200">
                                <span className="text-[9px] font-bold uppercase text-slate-400 block truncate flex items-center gap-1">
                                    <UserIcon className="w-3 h-3 text-slate-400" />
                                    <span>Paciente</span>
                                </span>
                                <span className="font-black text-slate-900 text-xs block truncate uppercase mt-0.5" title={booking.paciente?.name}>
                                    {booking.paciente?.name || 'Paciente não informado'}
                                </span>
                                <span className="text-[9.5px] font-mono text-slate-500 block truncate">
                                    CPF: {formatCpf(booking.paciente?.cpf)}
                                </span>
                            </div>

                            {/* 2. Procedimento e Código */}
                            <div className="p-2 bg-white rounded-xl border border-slate-200">
                                <span className="text-[9px] font-bold uppercase text-slate-400 block truncate">Procedimento</span>
                                <span className="font-black text-sky-700 text-xs block truncate uppercase mt-0.5" title={booking.procedimento?.name}>
                                    {booking.procedimento?.name || 'Procedimento'}
                                </span>
                                <span className="text-[9.5px] font-mono font-bold text-slate-500 block truncate">
                                    CÓD. {booking.procedimento?.code || 'N/A'}
                                </span>
                            </div>

                            {/* 3. Data Original da Solicitação */}
                            <div className="p-2 bg-white rounded-xl border border-slate-200">
                                <span className="text-[9px] font-bold uppercase text-slate-400 block truncate flex items-center gap-1">
                                    <Calendar className="w-3 h-3 text-slate-400" />
                                    <span>Data Original</span>
                                </span>
                                <span className="font-black text-slate-800 text-xs block truncate mt-0.5">
                                    {formatDateBr(booking.solicitation_date || booking.created_at)}
                                </span>
                                <span className="text-[9.5px] text-slate-500 block truncate">
                                    {booking.appointment_date ? `Agendado: ${formatDateBr(booking.appointment_date)}` : 'Sem agendamento'}
                                </span>
                            </div>

                            {/* 4. Prioridade */}
                            <div className="p-2 bg-white rounded-xl border border-slate-200">
                                <span className="text-[9px] font-bold uppercase text-slate-400 block truncate flex items-center gap-1">
                                    <Layers className="w-3 h-3 text-slate-400" />
                                    <span>Prioridade</span>
                                </span>
                                <span className={`inline-flex px-1.5 py-0.5 rounded text-[9.5px] font-black uppercase tracking-wider mt-0.5 ${
                                    booking.priority === 'Urgência'
                                        ? 'bg-rose-100 text-rose-700 border border-rose-200'
                                        : booking.priority === 'Especial'
                                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                        : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                }`}>
                                    {booking.priority || 'Normal'}
                                </span>
                            </div>

                            {/* 5. Situação Atual */}
                            <div className="p-2 bg-white rounded-xl border border-slate-200">
                                <span className="text-[9px] font-bold uppercase text-slate-400 block truncate">Situação Atual</span>
                                <span className="font-black text-slate-800 text-xs block truncate uppercase mt-0.5">
                                    {booking.status || 'Solicitado'}
                                </span>
                            </div>

                            {/* 6. Posição na Fila */}
                            <div className="p-2 bg-white rounded-xl border border-slate-200">
                                <span className="text-[9px] font-bold uppercase text-slate-400 block truncate flex items-center gap-1">
                                    <Hash className="w-3 h-3 text-slate-400" />
                                    <span>Posição na Fila</span>
                                </span>
                                <span className="font-mono font-black text-amber-950 text-xs block truncate mt-0.5">
                                    {booking.queue_position ? `${booking.queue_position}º Lugar` : 'Fila de Espera'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* 3. Campos: Motivo da Exclusão e Justificativa */}
                    <div className="space-y-3">
                        {/* Select: Motivo da Exclusão */}
                        <div className="space-y-1">
                            <label className="block text-[10.5px] font-black uppercase tracking-wider text-slate-800">
                                Motivo da Exclusão <span className="text-rose-600">*</span>
                            </label>
                            <select
                                value={selectedMotivo}
                                onChange={(e) => handleMotivoChange(e.target.value)}
                                disabled={isSubmitting}
                                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 shadow-2xs transition-all cursor-pointer"
                                required
                            >
                                <option value="">Selecione o motivo da solicitação de exclusão...</option>
                                {MOTIVOS_EXCLUSAO.map((motivo) => (
                                    <option key={motivo.label} value={motivo.label}>
                                        {motivo.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Campo: Justificativa da Exclusão */}
                        <div className="space-y-1">
                            <div className="flex items-center justify-between">
                                <label className="block text-[10.5px] font-black uppercase tracking-wider text-slate-800">
                                    Justificativa da Exclusão <span className="text-rose-600">*</span>
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
                                        ? "Descreva detalhadamente o motivo da exclusão, utilizando no mínimo 100 caracteres..."
                                        : selectedMotivo
                                        ? "A justificativa foi preenchida automaticamente. Você pode editar, corrigir ou complementar se necessário..."
                                        : "Selecione primeiro o Motivo da Exclusão acima para carregar a justificativa automática..."
                                }
                                className={`w-full p-3 bg-white border rounded-xl text-xs font-medium text-slate-800 outline-none transition-all resize-none shadow-2xs leading-relaxed ${
                                    isManualOption && normalizedLength < 100
                                        ? 'border-amber-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20'
                                        : 'border-slate-300 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20'
                                }`}
                                required
                            />

                            {isManualOption && (
                                <p className="text-[10.5px] text-amber-800 font-semibold leading-snug flex items-center gap-1.5 mt-0.5">
                                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                    <span>Descreva detalhadamente o motivo da exclusão, utilizando no mínimo 100 caracteres.</span>
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Mensagem de Erro */}
                    {errorMessage && (
                        <div className="p-2.5 sm:p-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 font-extrabold text-xs flex items-center gap-2 animate-in fade-in">
                            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                            <span className="leading-snug">{errorMessage}</span>
                        </div>
                    )}

                    {/* Aviso Informativo de Suspensão e Decisão */}
                    <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[10.5px] font-bold flex items-center gap-2 leading-relaxed">
                        <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>
                            Ao enviar, a solicitação será alterada para <strong>Suspensa — Exclusão Pendente</strong>, preservando sua posição original até a decisão do gestor.
                        </span>
                    </div>
                </div>

                {/* 4. Rodapé e Botões */}
                <div className="px-4 py-3 sm:px-6 sm:py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5 sm:gap-3 shrink-0">
                    <button
                        type="button"
                        onClick={handleClose}
                        disabled={isSubmitting}
                        className="px-3.5 sm:px-4 py-2 sm:py-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-2xs text-center"
                    >
                        Manter Solicitação
                    </button>

                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={isSubmitting || !formValidation.isValid}
                        className="px-4 sm:px-5 py-2 sm:py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
                        title={
                            !selectedMotivo
                                ? 'Selecione o motivo da exclusão'
                                : isManualOption && normalizedLength < 100
                                ? 'A opção Outro exige no mínimo 100 caracteres'
                                : 'Enviar Solicitação de Exclusão'
                        }
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                                <span>Enviando...</span>
                            </>
                        ) : (
                            <>
                                <Trash2 className="w-4 h-4 shrink-0" />
                                <span>Enviar Solicitação de Exclusão</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

