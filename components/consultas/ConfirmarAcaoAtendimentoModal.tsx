import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { ConsultaAgendamento, User } from '../../types';
import { 
    CheckCircle2, 
    XCircle, 
    ArrowLeft, 
    Loader2, 
    Calendar, 
    Clock, 
    User as UserIcon, 
    Stethoscope, 
    Phone, 
    ShieldCheck, 
    AlertTriangle 
} from 'lucide-react';
import { formatProcedimentoLabel } from '../../services/consultasService';

export interface ConfirmarAcaoAtendimentoModalProps {
    isOpen: boolean;
    onClose: () => void;
    booking: ConsultaAgendamento;
    situacao: 'Realizado' | 'Não Realizado';
    currentUser: User;
    onConfirm: (contatoInfo: { contatoConfirmado: boolean; declaracaoContato: string }) => Promise<void>;
}

export const ConfirmarAcaoAtendimentoModal: React.FC<ConfirmarAcaoAtendimentoModalProps> = ({
    isOpen,
    onClose,
    booking,
    situacao,
    currentUser,
    onConfirm
}) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    if (!isOpen || !booking) return null;

    const isRealizado = situacao === 'Realizado';
    const userName = (currentUser.name || 'Servidor').trim();
    const pacienteNome = booking.paciente?.name || 'Paciente';
    const procedimentoNome = formatProcedimentoLabel(booking.procedimento) || booking.procedimento?.name || 'Procedimento';

    // Formatar data em DD/MM/AAAA
    let dataFormatted = 'Data não informada';
    if (booking.appointment_date) {
        try {
            const [y, m, d] = booking.appointment_date.split('-');
            if (y && m && d) {
                dataFormatted = `${d}/${m}/${y}`;
            }
        } catch {
            dataFormatted = booking.appointment_date;
        }
    }

    const horarioFormatted = booking.appointment_time 
        ? (booking.appointment_time.length > 5 ? booking.appointment_time.substring(0, 5) : booking.appointment_time)
        : 'Horário não informado';

    const handleConfirm = async () => {
        if (isSubmitting) return;
        setIsSubmitting(true);
        setErrorMessage(null);

        const declaracaoContato = isRealizado
            ? `Olá, ${userName}! Você entrou em contato com o paciente ${pacienteNome} e confirmou que ele realmente realizou o procedimento ${procedimentoNome}? [CONFIRMADO PELO OPERADOR EM ${new Date().toLocaleString('pt-BR')}]`
            : `Olá, ${userName}! Você entrou em contato com o paciente ${pacienteNome} e confirmou que ele realmente não compareceu ao procedimento ${procedimentoNome}? [CONFIRMADO PELO OPERADOR EM ${new Date().toLocaleString('pt-BR')}]`;

        try {
            await onConfirm({
                contatoConfirmado: true,
                declaracaoContato
            });
            onClose();
        } catch (err: any) {
            console.error('Erro na confirmação expressa do atendimento:', err);
            setErrorMessage(err.message || 'Falha ao confirmar atendimento. Verifique sua conexão e tente novamente.');
            setIsSubmitting(false);
        }
    };

    const modalContent = (
        <div 
            onClick={(e) => {
                if (e.target === e.currentTarget && !isSubmitting) {
                    onClose();
                }
            }}
            className="fixed inset-0 z-[10001] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200 select-none"
        >
            <div 
                className="w-full max-w-[500px] bg-white rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col transform transition-all animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* 1. Cabeçalho Compacto e Temático */}
                <header className={`px-5 py-4 border-b shrink-0 flex items-center justify-between gap-3 ${
                    isRealizado 
                        ? 'bg-gradient-to-r from-emerald-50 via-teal-50/50 to-white border-emerald-100' 
                        : 'bg-gradient-to-r from-rose-50 via-red-50/50 to-white border-rose-100'
                }`}>
                    <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
                            isRealizado 
                                ? 'bg-emerald-600 text-white' 
                                : 'bg-rose-600 text-white'
                        }`}>
                            {isRealizado ? (
                                <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
                            ) : (
                                <XCircle className="w-5 h-5 stroke-[2.5]" />
                            )}
                        </div>
                        <div className="min-w-0">
                            <span className={`text-[10px] font-black uppercase tracking-wider block leading-none mb-1 ${
                                isRealizado ? 'text-emerald-700' : 'text-rose-700'
                            }`}>
                                {isRealizado ? 'Confirmação Positiva' : 'Confirmação de Falta'}
                            </span>
                            <h2 className="text-sm sm:text-base font-black text-slate-900 tracking-tight leading-tight truncate">
                                {isRealizado ? 'Confirmar Atendimento Realizado' : 'Confirmar Ausência do Paciente'}
                            </h2>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100 transition-colors disabled:opacity-40 cursor-pointer"
                        title="Fechar janela"
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </button>
                </header>

                {/* 2. Corpo do Modal (Compacto, sem rolagem interna em telas normais) */}
                <div className="p-5 sm:p-6 flex flex-col gap-4">
                    {/* Mensagem Personalizada Obrigatória */}
                    <div className={`p-4 rounded-2xl border ${
                        isRealizado 
                            ? 'bg-emerald-50/70 border-emerald-200/80 text-emerald-950' 
                            : 'bg-rose-50/70 border-rose-200/80 text-rose-950'
                    }`}>
                        <p className="text-xs sm:text-sm font-semibold leading-relaxed">
                            Olá, <strong className="font-black underline decoration-2">{userName}</strong>!<br />
                            {isRealizado ? (
                                <>
                                    Você entrou em contato com o paciente <strong className="font-black">{pacienteNome}</strong> e confirmou que ele realmente realizou o procedimento <strong className="font-black">{procedimentoNome}</strong>?
                                </>
                            ) : (
                                <>
                                    Você entrou em contato com o paciente <strong className="font-black">{pacienteNome}</strong> e confirmou que ele realmente não compareceu ao procedimento <strong className="font-black">{procedimentoNome}</strong>?
                                </>
                            )}
                        </p>
                    </div>

                    {/* Resumo Rápido dos Dados do Atendimento */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        {/* Paciente */}
                        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5 flex items-start gap-2">
                            <UserIcon className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                            <div className="min-w-0 flex-1">
                                <span className="text-[9.5px] font-black uppercase text-slate-400 block tracking-wider leading-none">
                                    Paciente
                                </span>
                                <span className="font-bold text-slate-800 text-[11px] truncate block mt-0.5" title={pacienteNome}>
                                    {pacienteNome}
                                </span>
                                {booking.paciente?.cpf && (
                                    <span className="text-[9.5px] text-slate-500 block">
                                        CPF: {booking.paciente.cpf}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Procedimento */}
                        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5 flex items-start gap-2">
                            <Stethoscope className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                            <div className="min-w-0 flex-1">
                                <span className="text-[9.5px] font-black uppercase text-slate-400 block tracking-wider leading-none">
                                    Procedimento
                                </span>
                                <span className="font-bold text-slate-800 text-[11px] truncate block mt-0.5" title={procedimentoNome}>
                                    {procedimentoNome}
                                </span>
                                {booking.procedimento?.code && (
                                    <span className="text-[9.5px] font-mono text-slate-500 block">
                                        Cód: {booking.procedimento.code}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Data e Horário */}
                        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5 flex items-start gap-2">
                            <Calendar className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                            <div className="min-w-0 flex-1">
                                <span className="text-[9.5px] font-black uppercase text-slate-400 block tracking-wider leading-none">
                                    Data & Horário
                                </span>
                                <span className="font-bold text-slate-800 text-[11px] block mt-0.5">
                                    {dataFormatted} • {horarioFormatted}
                                </span>
                            </div>
                        </div>

                        {/* Situação Selecionada */}
                        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5 flex items-start gap-2">
                            <ShieldCheck className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                            <div className="min-w-0 flex-1">
                                <span className="text-[9.5px] font-black uppercase text-slate-400 block tracking-wider leading-none">
                                    Situação
                                </span>
                                <span className={`inline-flex items-center gap-1 font-black text-[11px] uppercase tracking-wider px-2 py-0.5 rounded-md mt-0.5 ${
                                    isRealizado 
                                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                                        : 'bg-rose-100 text-rose-800 border border-rose-300'
                                }`}>
                                    {isRealizado ? 'Realizado' : 'Faltou'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Mensagem de Erro, se houver */}
                    {errorMessage && (
                        <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl p-3 flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                            <span className="font-semibold">{errorMessage}</span>
                        </div>
                    )}
                </div>

                {/* 3. Rodapé com Botões de Ação */}
                <footer className="px-5 py-4 bg-slate-50 border-t border-slate-200/90 flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5 shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                    >
                        Voltar
                    </button>

                    <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={isSubmitting}
                        className={`w-full sm:w-auto px-5 py-2.5 rounded-xl text-white text-xs font-black uppercase tracking-wider shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                            isRealizado 
                                ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/25' 
                                : 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/25'
                        }`}
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Gravando...</span>
                            </>
                        ) : isRealizado ? (
                            <>
                                <CheckCircle2 className="w-4 h-4" />
                                <span>Confirmar Atendimento Realizado</span>
                            </>
                        ) : (
                            <>
                                <XCircle className="w-4 h-4" />
                                <span>Confirmar Ausência</span>
                            </>
                        )}
                    </button>
                </footer>
            </div>
        </div>
    );

    if (typeof document === 'undefined') return null;
    return createPortal(modalContent, document.body);
};

