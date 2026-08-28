import React, { useState, useMemo } from 'react';
import { X, Calendar as CalendarIcon, FileDown, CheckCircle2, Circle, Loader2, Filter, Clock, Gift, Users, Flag, Repeat } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarEvent } from '../../services/calendarService';
import { AppState } from '../../types';
import { MonthEventsPdfGenerator } from './MonthEventsPdfGenerator';
// @ts-ignore
import { jsPDF } from 'jspdf';
// @ts-ignore
import html2canvas from 'html2canvas';

interface MonthEventsModalProps {
    isOpen: boolean;
    onClose: () => void;
    events: CalendarEvent[];
    currentMonth: number; // 0-indexed
    currentYear: number;
    appState: AppState;
}

export const MonthEventsModal: React.FC<MonthEventsModalProps> = ({
    isOpen,
    onClose,
    events,
    currentMonth,
    currentYear,
    appState
}) => {
    const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(new Set());
    const [isGenerating, setIsGenerating] = useState(false);
    const [filterType, setFilterType] = useState<string>('Todos');

    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

    // Sort events by date
    const sortedEvents = useMemo(() => {
        return [...events].sort((a, b) => {
            if (a.start_date !== b.start_date) {
                return a.start_date.localeCompare(b.start_date);
            }
            return (a.start_time || '').localeCompare(b.start_time || '');
        });
    }, [events]);

    const filteredEvents = useMemo(() => {
        if (filterType === 'Todos') return sortedEvents;
        return sortedEvents.filter(e => (e.type || "").trim() === filterType.trim());
    }, [sortedEvents, filterType]);

    const toggleSelection = (id: string) => {
        const newSelection = new Set(selectedEventIds);
        if (newSelection.has(id)) {
            newSelection.delete(id);
        } else {
            newSelection.add(id);
        }
        setSelectedEventIds(newSelection);
    };

    const toggleAll = () => {
        if (selectedEventIds.size === filteredEvents.length) {
            setSelectedEventIds(new Set());
        } else {
            setSelectedEventIds(new Set(filteredEvents.map(e => e.id)));
        }
    };

    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const handleDownloadPdf = async () => {
        setErrorMessage(null);
        setSuccessMessage(null);
        const count = selectedEventIds.size;
        if (count === 0) {
            setErrorMessage('Por favor, selecione ao menos um evento para exportar.');
            return;
        }

        setIsGenerating(true);
        // Delay maior para garantir renderização de múltiplas páginas
        await new Promise(resolve => setTimeout(resolve, 2500));

        try {
            const container = document.getElementById('month-events-pdf-container');
            if (!container) throw new Error("Recipiente do PDF não encontrado");

            const pageElements = container.querySelectorAll('.month-events-pdf-page');
            if (pageElements.length === 0) throw new Error("Nenhuma página gerada");

            const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            
            for (let i = 0; i < pageElements.length; i++) {
                const pageEl = pageElements[i] as HTMLElement;
                
                const canvas = await (html2canvas as any)(pageEl, {
                    scale: 2,
                    useCORS: true,
                    allowTaint: true,
                    backgroundColor: '#ffffff',
                    logging: false
                });

                const imgData = canvas.toDataURL('image/jpeg', 0.98);
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

                if (i > 0) pdf.addPage();
                pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
            }

            pdf.save(`Eventos_${monthNames[currentMonth]}_${currentYear}.pdf`);
            setSuccessMessage(`PDF gerado com sucesso contendo ${count} registros selecionados.`);
        } catch (error) {
            console.error('Erro ao gerar PDF:', error);
            setErrorMessage('Erro ao gerar PDF.');
        } finally {
            setIsGenerating(false);
        }
    };

    const eventTypes = useMemo(() => {
        return ['Todos', ...Array.from(new Set(events.map(e => (e.type || "").trim())))];
    }, [events]);

    const selectedEvents = useMemo(() => {
        return filteredEvents.filter(e => selectedEventIds.has(e.id));
    }, [filteredEvents, selectedEventIds]);

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[2500] flex items-center justify-center p-4 sm:p-6">
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
                    className="w-full max-w-4xl bg-white rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden flex flex-col max-h-[90vh]"
                >
                    {/* Header */}
                    <div className="bg-indigo-600 p-8 flex items-start justify-between shrink-0 relative overflow-hidden">
                        <div className="absolute -right-20 -top-20 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
                        
                        <div className="relative z-10">
                            <div className="flex items-center gap-4 text-white mb-2">
                                <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-md">
                                    <CalendarIcon className="w-6 h-6" />
                                </div>
                                <div>
                                    <h2 className="text-3xl font-black tracking-tight">Eventos de {monthNames[currentMonth]}</h2>
                                    <p className="text-indigo-100 font-medium opacity-80 uppercase tracking-widest text-xs mt-1">
                                        Calendário Institucional - Município de Piên
                                    </p>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={onClose}
                            className="relative z-10 w-12 h-12 flex items-center justify-center rounded-full bg-black/10 text-white hover:bg-black/20 transition-all active:scale-95"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    {errorMessage && (
                        <div className="mx-8 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold flex items-center justify-between animate-fade-in">
                            <span>{errorMessage}</span>
                            <button onClick={() => setErrorMessage(null)} className="text-rose-500 hover:text-rose-700 font-black">✕</button>
                        </div>
                    )}

                    {successMessage && (
                        <div className="mx-8 mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-xs font-bold flex items-center justify-between animate-fade-in">
                            <span>{successMessage}</span>
                            <button onClick={() => setSuccessMessage(null)} className="text-emerald-500 hover:text-emerald-700 font-black">✕</button>
                        </div>
                    )}

                    {/* Toolbar */}
                    <div className="px-8 py-4 bg-slate-50 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4 shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm">
                                <Filter className="w-4 h-4 text-slate-400" />
                                <select 
                                    value={filterType}
                                    onChange={(e) => setFilterType(e.target.value)}
                                    className="text-sm font-bold text-slate-700 bg-transparent border-none focus:ring-0 cursor-pointer"
                                >
                                    {eventTypes.map((t, i) => <option key={`${t}-${i}`} value={t}>{t}</option>)}
                                </select>
                            </div>

                            <button 
                                onClick={toggleAll}
                                className="px-4 py-2 text-xs font-black uppercase tracking-wider text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
                            >
                                {selectedEventIds.size === filteredEvents.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
                            </button>
                        </div>

                        <div className="flex items-center gap-4">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                                {selectedEventIds.size} de {filteredEvents.length} selecionados
                            </span>
                            <button
                                onClick={handleDownloadPdf}
                                disabled={isGenerating || selectedEventIds.size === 0}
                                className="flex items-center gap-2 px-6 py-3 bg-slate-900 hover:bg-black text-white rounded-xl font-bold uppercase tracking-widest text-xs transition-all active:scale-95 shadow-lg shadow-slate-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                                Exportar PDF
                            </button>
                        </div>
                    </div>

                    {/* Events List */}
                    <div className="p-8 overflow-y-auto flex-1 custom-scrollbar">
                        {filteredEvents.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-center opacity-40">
                                <CalendarIcon className="w-16 h-16 mb-4" />
                                <h3 className="text-xl font-bold">Nenhum evento neste mês</h3>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {filteredEvents.map((event, index) => {
                                    const isSelected = selectedEventIds.has(event.id);
                                    let Icon = CalendarIcon;
                                    let colorClass = "bg-indigo-50 text-indigo-600 border-indigo-100";
                                    
                                    if (event.type === 'Aniversário') {
                                        Icon = Gift;
                                        colorClass = "bg-pink-50 text-pink-600 border-pink-100";
                                    } else if (event.type === 'Reunião') {
                                        Icon = Users;
                                        colorClass = "bg-blue-50 text-blue-600 border-blue-100";
                                    } else if (event.type === 'Feriado' || event.type === 'Feriado Municipal') {
                                        Icon = Flag;
                                        colorClass = "bg-rose-50 text-rose-600 border-rose-100";
                                    }

                                    return (
                                        <div 
                                            key={`${event.id}-${index}`}
                                            onClick={() => toggleSelection(event.id)}
                                            className={`flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer group ${isSelected ? 'bg-indigo-50/50 border-indigo-200 shadow-sm' : 'bg-white border-slate-100 hover:border-slate-200 hover:bg-slate-50/50'}`}
                                        >
                                            <div className="shrink-0">
                                                {isSelected ? (
                                                    <CheckCircle2 className="w-6 h-6 text-indigo-600" />
                                                ) : (
                                                    <Circle className="w-6 h-6 text-slate-200 group-hover:text-slate-300" />
                                                )}
                                            </div>

                                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center border shrink-0 ${colorClass}`}>
                                                <Icon className="w-6 h-6" />
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                        {new Date(event.start_date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                                                    </span>
                                                    <span className={`text-[8pt] font-black uppercase tracking-tighter px-1.5 rounded ${colorClass}`}>
                                                        {event.type}
                                                    </span>
                                                    {(event.is_recurring || event.type === 'Aniversário') && <Repeat className="w-3 h-3 text-slate-300" />}
                                                </div>
                                                <h4 className="text-sm font-bold text-slate-800 truncate">
                                                    {event.type === 'Aniversário' ? `Aniversário de ${event.professional_name || event.title}` : event.title}
                                                </h4>
                                            </div>

                                            <div className="text-right shrink-0">
                                                <div className="flex items-center gap-1 text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-lg">
                                                    <Clock className="w-3.5 h-3.5" />
                                                    <span>{event.is_all_day ? 'Integral' : event.start_time?.slice(0, 5)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>
            {isGenerating && (
                <MonthEventsPdfGenerator 
                    events={selectedEvents} 
                    monthName={monthNames[currentMonth]} 
                    year={currentYear} 
                    state={appState} 
                />
            )}
        </AnimatePresence>
    );
};

export default MonthEventsModal;
