import React from 'react';
import { X, Calendar as CalendarIcon, Plus, Edit2, Trash2, Clock, AlignLeft, Gift } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarEvent } from '../../services/calendarService';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    dateStr: string;
    events: CalendarEvent[];
    isAdmin: boolean;
    currentUserId?: string;
    onAddEvent: () => void;
    onEditEvent: (event: CalendarEvent) => void;
    onDeleteEvent: (event: CalendarEvent) => void;
}

export const DayDetailsModal: React.FC<Props> = ({
    isOpen, onClose, dateStr, events, isAdmin, currentUserId, onAddEvent, onEditEvent, onDeleteEvent
}) => {
    if (!isOpen) return null;

    // Format date for header (e.g., "15 de Agosto de 2026")
    const formatDate = (dateString: string) => {
        if (!dateString) return '';
        const [year, month, day] = dateString.split('-');
        const dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));

        return dateObj.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        });
    };

    const formattedDate = formatDate(dateStr);

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[2400] flex items-center justify-center p-4 sm:p-6">
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                    onClick={onClose}
                />

                {/* Modal Content */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="w-full max-w-2xl bg-white rounded-[2rem] shadow-2xl relative z-10 overflow-hidden flex flex-col max-h-[85vh]"
                >
                    {/* Header */}
                    <div className="bg-indigo-600 p-6 flex items-start justify-between shrink-0 relative overflow-hidden">
                        <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
                        <div className="absolute -left-10 -bottom-10 w-32 h-32 bg-black/10 rounded-full blur-xl" />

                        <div className="relative z-10">
                            <div className="flex items-center gap-3 text-white mb-2">
                                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-md">
                                    <CalendarIcon className="w-5 h-5 text-white" />
                                </div>
                                <h2 className="text-2xl font-black tracking-tight drop-shadow-sm">
                                    {formattedDate}
                                </h2>
                            </div>
                            <p className="text-indigo-100 text-sm font-medium ml-13">
                                {events.length === 0 ? 'Nenhum registro para esta data' : `${events.length} registro(s) encontrado(s)`}
                            </p>
                        </div>

                        <button
                            onClick={onClose}
                            className="relative z-10 w-10 h-10 flex items-center justify-center rounded-full bg-black/10 text-white hover:bg-black/20 transition-all active:scale-95"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Content (Events List) */}
                    <div className="p-6 overflow-y-auto flex-1 bg-slate-50/50 custom-scrollbar">
                        {events.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                                    <CalendarIcon className="w-10 h-10 text-slate-300" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-700 mb-1">Nenhum evento cadastrado</h3>
                                <p className="text-slate-500 text-sm">Não há reuniões, feriados ou eventos para esta data.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {events.map((event) => {
                                    const isFeriado = event.type === 'Feriado' || event.type === 'Feriado Municipal';
                                    const isReuniao = event.type === 'Reunião';
                                    const isAniversario = event.type === 'Aniversário';

                                    const colors = {
                                        bg: isFeriado ? 'bg-rose-50' : isReuniao ? 'bg-indigo-50' : isAniversario ? 'bg-pink-50' : 'bg-emerald-50',
                                        border: isFeriado ? 'border-rose-200' : isReuniao ? 'border-indigo-200' : isAniversario ? 'border-pink-200' : 'border-emerald-200',
                                        leftBorder: isFeriado ? 'border-l-rose-500' : isReuniao ? 'border-l-indigo-500' : isAniversario ? 'border-l-pink-500' : 'border-l-emerald-500',
                                        text: isFeriado ? 'text-rose-700' : isReuniao ? 'text-indigo-700' : isAniversario ? 'text-pink-700' : 'text-emerald-700',
                                        badgeBg: isFeriado ? 'bg-rose-100' : isReuniao ? 'bg-indigo-100' : isAniversario ? 'bg-pink-100' : 'bg-emerald-100',
                                    };

                                    return (
                                        <motion.div
                                            key={event.id}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className={`relative bg-white border ${colors.border} ${colors.leftBorder} border-l-[6px] rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow group overflow-hidden`}
                                        >
                                            <div className="flex justify-between items-start mb-3">
                                                <div className="flex flex-col gap-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest w-fit ${colors.badgeBg} ${colors.text}`}>
                                                            {event.type}
                                                        </span>
                                                        {isAniversario && (
                                                            <div className="w-5 h-5 rounded-full bg-pink-100 flex items-center justify-center">
                                                                <Gift className="w-3 h-3 text-pink-600" />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <h4 className="text-lg font-bold text-slate-800 leading-tight">
                                                        {isAniversario ? (event.professional_name || event.title) : event.title}
                                                    </h4>

                                                    <div className="flex flex-wrap items-center gap-2 mt-1">
                                                        {event.is_all_day ? (
                                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider bg-slate-100 text-slate-500 border border-slate-200">Dia Inteiro</span>
                                                        ) : (
                                                            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                                                <Clock className="w-3.5 h-3.5" />
                                                                <span>{event.start_time?.slice(0, 5)} as {event.end_time?.slice(0, 5)}</span>
                                                            </div>
                                                        )}

                                                        {event.start_date && event.end_date && event.start_date !== event.end_date && (
                                                            <div className="text-[11px] font-semibold text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                                                                De {event.start_date.split('-').reverse().join('/')} a {event.end_date.split('-').reverse().join('/')}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {(isAdmin || (currentUserId && event.created_by === currentUserId)) && (
                                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); onEditEvent(event); }}
                                                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                            title="Editar"
                                                        >
                                                            <Edit2 className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); onDeleteEvent(event); }}
                                                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                                            title="Excluir"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>

                                            {event.description && (
                                                <div className="mt-3 text-sm text-slate-600 bg-slate-50/50 p-3 rounded-xl border border-slate-100 flex items-start gap-2">
                                                    <AlignLeft className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                                                    <p className="whitespace-pre-wrap">{event.description}</p>
                                                </div>
                                            )}
                                        </motion.div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Footer Actions (Disponível para todos os usuários) */}
                    <div className="p-6 border-t border-slate-100 bg-white shrink-0">
                        <button
                            onClick={onAddEvent}
                            className="w-full py-4 bg-slate-900 hover:bg-black text-white rounded-xl font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-slate-900/20"
                        >
                            <Plus className="w-5 h-5" />
                            Adicionar Novo Registro
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};
