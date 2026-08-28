import React, { useState } from 'react';
import { X, Calendar as CalendarIcon, Clock, Edit2, Trash2, CalendarDays, AlignLeft, Users, Star, User, Gift, Repeat } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarEvent } from '../../services/calendarService';
import { supabase } from '../../services/supabaseClient';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { EventPdfGenerator } from './EventPdfGenerator';
import { FileDown, Loader2 } from 'lucide-react';
import { AppState } from '../../types';

interface EventDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    event: CalendarEvent | null;
    isAdmin: boolean;
    onEditEvent: (event: CalendarEvent) => void;
    onDeleteSuccess: () => void;
    appState: AppState;
}

export const EventDetailsModal: React.FC<EventDetailsModalProps> = ({
    isOpen,
    onClose,
    event,
    isAdmin,
    onEditEvent,
    onDeleteSuccess,
    appState
}) => {
    const [activeTab, setActiveTab] = useState<'details' | 'invites'>('details');
    const [isGenerating, setIsGenerating] = useState(false);

    if (!isOpen || !event) return null;

    const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const colors: Record<string, { bg: string; text: string; border: string; icon: string }> = {
        Oficial: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', icon: 'text-indigo-500' },
        Reunião: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: 'text-emerald-500' },
        Prazo: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', icon: 'text-rose-500' },
        Aniversário: { bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-200', icon: 'text-pink-500' },
        'Feriado Municipal': { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', icon: 'text-red-500' },
        Pessoal: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', icon: 'text-amber-500' }
    };

    const theme = colors[event.type] || { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200', icon: 'text-slate-500' };

    const formatTime = (t: string) => t.slice(0, 5);
    const formatDateBr = (d: string) => d.split('-').reverse().join('/');

    const confirmDelete = async () => {
        setIsConfirmDeleteOpen(false);
        setErrorMessage(null);
        try {
            const { error } = await supabase.from('calendar_events').delete().eq('id', event.id);
            if (error) throw error;
            onDeleteSuccess();
            onClose();
        } catch (e) {
            console.error(e);
            setErrorMessage("Erro ao excluir o evento.");
        }
    };

    const handleDownloadPdf = async () => {
        setIsGenerating(true);
        setErrorMessage(null);

        // Allow React to render the invisible portal first
        await new Promise(resolve => setTimeout(resolve, 500));

        try {
            const container = document.getElementById('event-pdf-content');
            if (!container) {
                console.error("PDF container not found");
                return;
            }

            const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

            const canvas = await html2canvas(container, {
                scale: 2,
                useCORS: true,
                allowTaint: true,
                logging: false,
                backgroundColor: '#ffffff',
                scrollY: 0,
                scrollX: 0,
                width: container.offsetWidth,
                height: container.offsetHeight
            });

            const imgData = canvas.toDataURL('image/jpeg', 0.98);
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

            pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);

            const sanitaizedName = event.title.replace(/[^a-zA-Z0-9_-]/g, '_');
            const dataStr = formatDateBr(event.start_date).replace(/\//g, '-');
            pdf.save(`Evento-${sanitaizedName}-${dataStr}.pdf`);

        } catch (error) {
            console.error('Erro ao gerar PDF do evento:', error);
            setErrorMessage('Não foi possível gerar o PDF no momento.');
        } finally {
            setIsGenerating(false);
        }
    };

    const hasInvites = event.invites && event.invites.length > 0;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 sm:p-6">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                />

                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="w-full max-w-lg bg-white rounded-3xl shadow-2xl relative z-10 overflow-hidden flex flex-col max-h-[85vh]"
                >
                    {/* Header */}
                    <div className={`${theme.bg} p-6 flex flex-col border-b ${theme.border} shrink-0`}>
                        <div className="flex items-start justify-between">
                            <div className="flex gap-4">
                                <div className={`mt-1 bg-white p-2 text-center rounded-xl shadow-sm border ${theme.border}`}>
                                    {event.type === 'Aniversário' ? <Gift className={`w-6 h-6 ${theme.icon}`} /> : <CalendarIcon className={`w-6 h-6 ${theme.icon}`} />}
                                </div>
                                <div>
                                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] uppercase font-black tracking-widest bg-white border mb-2 shadow-sm ${theme.border} ${theme.text}`}>
                                        {event.type}
                                        {(event.is_recurring || event.type === 'Aniversário' || event.type === 'Feriado Municipal') && (
                                            <Repeat className="w-3 h-3" />
                                        )}
                                    </span>
                                    <h2 className="text-xl font-bold text-slate-800 leading-tight">
                                        {event.type === 'Aniversário' ? `Aniversário de ${event.professional_name || event.title}` : event.title}
                                    </h2>
                                </div>
                            </div>

                            <button
                                onClick={onClose}
                                className={`p-2 rounded-full hover:bg-white/50 transition-colors ${theme.text}`}
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Tabs */}
                        {hasInvites && (
                            <div className="flex items-center gap-2 mt-6 bg-white/50 p-1 rounded-xl w-fit">
                                <button
                                    onClick={() => setActiveTab('details')}
                                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'details' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:bg-white/50'}`}
                                >
                                    Detalhes
                                </button>
                                <button
                                    onClick={() => setActiveTab('invites')}
                                    className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'invites' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:bg-white/50'}`}
                                >
                                    <Users className="w-3.5 h-3.5" />
                                    Convidados
                                    <span className={`px-1.5 py-0.5 rounded-full text-[9px] ${activeTab === 'invites' ? `${theme.bg} ${theme.text}` : 'bg-slate-200/50 text-slate-500'}`}>
                                        {event.invites!.length}
                                    </span>
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Content */}
                    <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                        {activeTab === 'details' ? (
                            <div className="space-y-6">
                                {/* Time and Date Context */}
                                <div className="flex flex-col gap-3">
                                    <div className="flex items-center gap-3 text-slate-600">
                                        <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                                            <CalendarDays className="w-4 h-4 text-slate-400" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Datas</p>
                                            <p className="text-sm font-medium">
                                                {event.start_date === event.end_date
                                                    ? formatDateBr(event.start_date)
                                                    : `De ${formatDateBr(event.start_date)} a ${formatDateBr(event.end_date)}`
                                                }
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 text-slate-600">
                                        <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                                            <Clock className="w-4 h-4 text-slate-400" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Horário</p>
                                            <p className="text-sm font-medium">
                                                {event.is_all_day
                                                    ? 'Dia Inteiro'
                                                    : `${formatTime(event.start_time!)} às ${formatTime(event.end_time!)}`
                                                }
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Description */}
                                {event.description && (
                                    <div className="pt-4 border-t border-slate-100">
                                        <div className="flex items-start gap-3 text-slate-600">
                                            <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                                                <AlignLeft className="w-4 h-4 text-slate-400" />
                                            </div>
                                            <div className="flex-1 pb-2">
                                                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Descrição</p>
                                                <div className="text-sm border-l-2 pl-3 border-slate-200 text-slate-600 whitespace-pre-wrap leading-relaxed">
                                                    {event.description}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                                    <span>Criado em: {new Date(event.created_at!).toLocaleDateString('pt-BR')}</span>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <h3 className="text-sm font-bold text-slate-800 mb-4">Lista de Convidados</h3>
                                {event.invites?.map(inv => (
                                    <div key={inv.id} className="flex flex-col p-3 border border-slate-200 rounded-xl bg-slate-50/50 hover:bg-white transition-colors">
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${inv.role === 'Colaborador' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-200 text-slate-500'}`}>
                                                    {inv.role === 'Colaborador' ? <Star className="w-4 h-4" /> : <User className="w-4 h-4" />}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-slate-800">{inv.user_name || 'Usuário Desconhecido'}</p>
                                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{inv.role === 'Colaborador' ? 'Organizador' : 'Participante'}</p>
                                                </div>
                                            </div>

                                            <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest ${inv.status === 'Aceito' ? 'bg-emerald-100 text-emerald-700' :
                                                inv.status === 'Recusado' ? 'bg-rose-100 text-rose-700' :
                                                    'bg-slate-200 text-slate-600'
                                                }`}>
                                                {inv.status}
                                            </span>
                                        </div>

                                        {inv.status === 'Recusado' && inv.decline_reason && (
                                            <div className="mt-3 text-xs bg-rose-50 border border-rose-100 rounded-lg p-2.5 text-rose-800">
                                                <span className="font-bold flex block mb-0.5">Motivo da Recusa:</span>
                                                <span className="opacity-90 leading-relaxed block">{inv.decline_reason}</span>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Actions and Footer */}
                    <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
                        {/* Download PDF Button - Visible to anyone who can see the event */}
                        <button
                            onClick={handleDownloadPdf}
                            disabled={isGenerating}
                            className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-xl font-bold uppercase tracking-wider text-xs transition-colors disabled:opacity-50"
                        >
                            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                            {isGenerating ? 'Gerando...' : 'Gerar PDF'}
                        </button>
                        {isAdmin && !event.id.startsWith('system-') && (
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setIsConfirmDeleteOpen(true)}
                                    className="flex items-center gap-2 px-4 py-2 text-rose-600 hover:bg-rose-50 rounded-xl font-bold uppercase tracking-wider text-xs transition-colors cursor-pointer"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    Excluir
                                </button>
                                <button
                                    onClick={() => {
                                        onClose();
                                        onEditEvent(event);
                                    }}
                                    className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow shadow-indigo-200 rounded-xl font-bold uppercase tracking-wider text-xs transition-colors cursor-pointer"
                                >
                                    <Edit2 className="w-4 h-4" />
                                    Editar
                                </button>
                            </div>
                        )}
                    </div>
                </motion.div>

                {/* Modal de Confirmação Customizado (Substituindo confirm()) */}
                {isConfirmDeleteOpen && (
                    <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in">
                        <div className="bg-white rounded-[2rem] p-6 max-w-sm w-full space-y-4 shadow-2xl border border-slate-100 text-center">
                            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
                                <Trash2 className="w-6 h-6" />
                            </div>
                            <h3 className="text-base font-extrabold text-slate-800">Excluir Evento?</h3>
                            <p className="text-xs text-slate-500">
                                Tem certeza que deseja remover este compromisso? Esta ação não poderá ser desfeita.
                            </p>
                            <div className="flex items-center gap-3 pt-2">
                                <button
                                    onClick={() => setIsConfirmDeleteOpen(false)}
                                    className="flex-1 py-3 text-slate-500 hover:text-slate-700 font-bold text-xs uppercase tracking-wider rounded-xl hover:bg-slate-100 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={confirmDelete}
                                    className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-rose-500/20 active:scale-95 transition-all"
                                >
                                    Confirmar
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            {isGenerating && <EventPdfGenerator event={event} state={appState} />}
        </AnimatePresence>
    );
};
