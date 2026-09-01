import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, ChevronsLeft, ChevronsRight, Star, Users, Flag, Gift, Repeat, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import { EventModal } from './EventModal';
import { DayDetailsModal } from './DayDetailsModal';
import { EventDetailsModal } from './EventDetailsModal';
import { generateHolidaysForYear } from './holidays';
import { getLocalISOData, safelyParseDate } from '../../utils/dateUtils';
import { calendarService, CalendarEvent } from '../../services/calendarService';
import { googleCalendarService } from '../../services/googleCalendarService';
import { MyEventsModal } from './MyEventsModal';
import { PendingInvitesModal } from './PendingInvitesModal';
import { MonthEventsModal } from './MonthEventsModal';
import { User, AppState } from '../../types';

interface CalendarioProps {
    onBack: () => void;
    userRole: string;
    currentUserId: string;
    currentUser?: User | null;
    appState: AppState;
}

export const Calendario: React.FC<CalendarioProps> = ({ onBack, userRole, currentUserId, currentUser, appState }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSyncingGoogle, setIsSyncingGoogle] = useState(false);
    const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({ show: false, message: '', type: 'success' });

    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3500);
    };

    const isAdmin = userRole === 'admin';
    const [direction, setDirection] = useState(0); // For animation: -1 left, 1 right

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [eventToEdit, setEventToEdit] = useState<CalendarEvent | null>(null);
    const [selectedDate, setSelectedDate] = useState('');

    const [isDayDetailsOpen, setIsDayDetailsOpen] = useState(false);
    const [selectedDayEvents, setSelectedDayEvents] = useState<CalendarEvent[]>([]);

    const [eventDetailsEvent, setEventDetailsEvent] = useState<CalendarEvent | null>(null);
    const [isEventDetailsOpen, setIsEventDetailsOpen] = useState(false);

    // My Events
    const [isMyEventsOpen, setIsMyEventsOpen] = useState(false);

    // Month Events
    const [isMonthEventsOpen, setIsMonthEventsOpen] = useState(false);

    // Fetch events for current month (and slightly padding)
    const fetchEvents = async (date: Date) => {
        setLoading(true);
        try {
            const year = date.getFullYear();
            let prevMonth = date.getMonth();
            let prevYear = year;
            if (prevMonth === 0) { prevMonth = 12; prevYear--; }

            let nextMonth = date.getMonth() + 2;
            let nextYear = year;
            if (nextMonth === 13) { nextMonth = 1; nextYear++; }

            const startDateStr = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`;
            const lastDayOfNextMonth = new Date(nextYear, nextMonth, 0).getDate();
            const endDateStr = `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(lastDayOfNextMonth).padStart(2, '0')}`;

            const data = await calendarService.fetchEvents(startDateStr, endDateStr);

            // Gen recurring holidays for the current view and surroundings
            const holidaysData = [
                ...generateHolidaysForYear(prevYear),
                ...((prevYear !== nextYear) && (nextYear !== year) ? generateHolidaysForYear(year) : []),
                ...((prevYear !== nextYear) ? generateHolidaysForYear(nextYear) : [])
            ];

            // Deduplicate generated holidays since there could be overlaps depending on the month
            const uniqueHolidays = Array.from(new Map(holidaysData.map(h => [h.id, h])).values());

            setEvents([...uniqueHolidays, ...(data || [])]);
        } catch (error) {
            console.error('Erro ao buscar eventos do calendário:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchEvents(currentDate);
    }, [currentDate.getFullYear(), currentDate.getMonth()]);

    const nextMonth = () => {
        setDirection(1);
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    };

    const prevMonth = () => {
        setDirection(-1);
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    };

    const nextYear = () => {
        setDirection(1);
        setCurrentDate(new Date(currentDate.getFullYear() + 1, currentDate.getMonth(), 1));
    };

    const prevYear = () => {
        setDirection(-1);
        setCurrentDate(new Date(currentDate.getFullYear() - 1, currentDate.getMonth(), 1));
    };

    const goToToday = () => {
        const now = new Date();
        const yearDiff = now.getFullYear() - currentDate.getFullYear();
        const monthDiff = now.getMonth() - currentDate.getMonth();

        if (yearDiff === 0 && monthDiff === 0) return; // Already today

        // Determine animation direction
        if (yearDiff > 0 || (yearDiff === 0 && monthDiff > 0)) {
            setDirection(1);
        } else {
            setDirection(-1);
        }

        setCurrentDate(new Date(now.getFullYear(), now.getMonth(), 1));
    };

    const today = new Date();

    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

    // Generate calendar grid
    const calendarGrid = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();

        // First day of the month
        const firstDayOfMonth = new Date(year, month, 1);
        const startingDayOfWeek = firstDayOfMonth.getDay();

        // Last day of the month
        const lastDayOfMonth = new Date(year, month + 1, 0);
        const totalDaysInMonth = lastDayOfMonth.getDate();

        const days = [];

        // Padding from previous month (empty slots)
        for (let i = 0; i < startingDayOfWeek; i++) {
            days.push({ day: null, isCurrentMonth: false, dateStr: '', isWeekend: false });
        }

        // Current month days
        for (let day = 1; day <= totalDaysInMonth; day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayOfWeek = new Date(year, month, day).getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            days.push({ day, isCurrentMonth: true, dateStr, isWeekend });
        }

        return days;
    }, [currentDate]);

    const isToday = (dateStr: string) => {
        const t = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        return dateStr === t;
    };

    const variants = {
        enter: (direction: number) => {
            return {
                x: direction > 0 ? 100 : -100,
                opacity: 0
            };
        },
        center: {
            zIndex: 1,
            x: 0,
            opacity: 1
        },
        exit: (direction: number) => {
            return {
                zIndex: 0,
                x: direction < 0 ? 100 : -100,
                opacity: 0
            };
        }
    };

    return (
        <div className="fixed inset-0 w-full h-full bg-[#FAFAFA] flex flex-col z-[100] font-sans">

            {/* HEADER FIXO */}
            <div className="h-20 shrink-0 bg-white border-b border-slate-200 shadow-sm flex items-center justify-between px-6 desktop:px-10 z-[110]">

                <div className="flex items-center gap-6">
                    <button
                        onClick={onBack}
                        className="group flex items-center justify-center w-10 h-10 rounded-full bg-slate-50 border border-slate-200 hover:bg-white hover:border-slate-300 hover:shadow-md transition-all active:scale-95"
                        title="Voltar ao Dashboard"
                    >
                        <ArrowLeft className="w-5 h-5 text-slate-500 group-hover:text-slate-800 transition-colors" />
                    </button>

                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-rose-600 flex items-center justify-center shadow-lg shadow-rose-500/20">
                            <CalendarIcon className="w-5 h-5 text-white" />
                        </div>
                        <h1 className="text-2xl font-black text-slate-800 tracking-tight">Calendário Institucional</h1>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {googleCalendarService.getStoredStatus(currentUser || {}).isConnected && (
                        <button
                            onClick={async () => {
                                if (!currentUser) return;
                                setIsSyncingGoogle(true);
                                const result = await googleCalendarService.syncAllUserEvents(currentUser);
                                setIsSyncingGoogle(false);
                                showToast(`${result.syncedCount} evento(s) sincronizado(s) com o Google Agenda!`);
                            }}
                            className="flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold border border-indigo-200 text-xs transition-all active:scale-95 cursor-pointer"
                            title="Sincronizar eventos com seu Google Agenda"
                        >
                            <RefreshCw className={`w-4 h-4 ${isSyncingGoogle ? 'animate-spin' : ''}`} />
                            <span className="hidden sm:inline">Google Agenda</span>
                        </button>
                    )}

                    <button
                        onClick={() => setIsMyEventsOpen(true)}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-all active:scale-95 cursor-pointer"
                    >
                        <CalendarIcon className="w-5 h-5" />
                        <span>Meus Eventos</span>
                    </button>

                    <button
                        onClick={() => {
                            setEventToEdit(null);
                            setSelectedDate(getLocalISOData(new Date()).date);
                            setIsModalOpen(true);
                        }}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-lg shadow-rose-500/30 hover:shadow-rose-500/50 hover:-translate-y-0.5 transition-all active:scale-95 cursor-pointer"
                    >
                        <Plus className="w-5 h-5" />
                        <span>Novo Evento</span>
                    </button>
                </div>
            </div>

            {/* NAVEGAÇÃO E CONTROLES */}
            <div className="px-6 desktop:px-10 py-4 flex items-center justify-between bg-white/50 backdrop-blur-sm relative z-[105]">
                <div className="flex items-center gap-2">
                    <button onClick={prevYear} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer" title="Ano Anterior">
                        <ChevronsLeft className="w-5 h-5" />
                    </button>
                    <button onClick={prevMonth} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer" title="Mês Anterior">
                        <ChevronLeft className="w-6 h-6" />
                    </button>
                </div>

                <div className="flex flex-col items-center">
                    <div className="w-64 flex justify-center overflow-hidden">
                        <AnimatePresence mode="popLayout" initial={false} custom={direction}>
                            <motion.div
                                key={`${currentDate.getFullYear()}-${currentDate.getMonth()}`}
                                custom={direction}
                                variants={variants}
                                initial="enter"
                                animate="center"
                                exit="exit"
                                transition={{
                                    x: { type: "spring", stiffness: 300, damping: 30 },
                                    opacity: { duration: 0.2 }
                                }}
                                className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-slate-800 to-slate-600 uppercase tracking-wider text-center"
                            >
                                {monthNames[currentDate.getMonth()]} <span className="text-rose-500">{currentDate.getFullYear()}</span>
                            </motion.div>
                        </AnimatePresence>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={goToToday}
                            className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold uppercase tracking-wider rounded-md transition-colors cursor-pointer"
                        >
                            Hoje
                        </button>
                        <button
                            onClick={() => setIsMonthEventsOpen(true)}
                            className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-xs font-bold uppercase tracking-wider rounded-md transition-colors flex items-center gap-1.5 cursor-pointer"
                            title="Ver todos os eventos deste mês"
                        >
                            <CalendarIcon className="w-3.5 h-3.5" />
                            <span>Eventos do Mês</span>
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button onClick={nextMonth} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer" title="Próximo Mês">
                        <ChevronRight className="w-6 h-6" />
                    </button>
                    <button onClick={nextYear} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer" title="Próximo Ano">
                        <ChevronsRight className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* GRADE DO CALENDÁRIO */}
            <div className="flex-1 flex flex-col bg-white overflow-hidden p-6 desktop:p-10 pt-2">
                {/* Cabeçalho dos dias da semana */}
                <div className="grid grid-cols-7 gap-2 mb-2 shrink-0">
                    {weekDays.map(day => (
                        <div key={day} className="text-center py-2 text-xs font-black text-slate-400 uppercase tracking-widest border-b-2 border-slate-100">
                            {day}
                        </div>
                    ))}
                </div>

                {/* Grid principal dinâmico */}
                <div className="flex-1 grid grid-cols-7 auto-rows-fr gap-2 min-h-0 relative">
                    <AnimatePresence mode="wait">
                        {loading && (
                            <motion.div
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                className="absolute inset-0 z-10 bg-white/50 backdrop-blur-[2px] flex items-center justify-center rounded-2xl"
                            >
                                <div className="w-10 h-10 border-4 border-rose-200 border-t-rose-600 rounded-full animate-spin"></div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {calendarGrid.map((slot, i) => {
                        if (!slot.isCurrentMonth || !slot.day) {
                            return <div key={i} className="flex flex-col rounded-2xl border-none bg-transparent"></div>;
                        }

                        const isTodaySlot = isToday(slot.dateStr);
                        const dayEvents = events.filter(e => {
                            const isRecurringType = e.type === 'Aniversário' || e.type === 'Feriado Municipal' || e.is_recurring;

                            if (isRecurringType) {
                                let targetDate = e.start_date;
                                if (e.type === 'Aniversário' && e.birth_date) {
                                    targetDate = e.birth_date;
                                }

                                const [by, bm, bd] = targetDate.split('-').map(Number);
                                const [sy, sm, sd] = slot.dateStr.split('-').map(Number);
                                return bm === sm && bd === sd;
                            }

                            return slot.dateStr >= e.start_date && slot.dateStr <= e.end_date;
                        });

                        let bgClass = slot.isWeekend ? 'bg-indigo-50/30' : 'bg-white';
                        let borderClass = 'border-slate-100 shadow-sm hover:shadow-md hover:border-indigo-200';
                        let headerBgClass = slot.isWeekend ? 'bg-indigo-50/50 border-b border-indigo-100/50' : 'border-b border-slate-50';
                        let textClass = slot.isWeekend ? 'text-indigo-900/60' : 'text-slate-700';

                        if (isTodaySlot) {
                            bgClass = 'bg-blue-50';
                            borderClass = 'border-blue-400 shadow-md ring-1 ring-blue-400';
                            headerBgClass = 'bg-blue-600 border-b border-blue-700';
                            textClass = 'text-white';
                        }

                        return (
                            <div
                                key={i}
                                onClick={() => {
                                    setSelectedDate(slot.dateStr);
                                    setSelectedDayEvents(dayEvents);
                                    setIsDayDetailsOpen(true);
                                }}
                                className={`flex flex-col min-h-[90px] desktop:min-h-[110px] rounded-2xl border overflow-hidden transition-all duration-300 group cursor-pointer ${bgClass} ${borderClass}`}
                            >
                                {/* Cabeçalho do Dia */}
                                <div className={`flex justify-between items-center p-2 px-3 ${headerBgClass}`}>
                                    <span className={`text-sm font-bold ${textClass}`}>
                                        {slot.day === 1 && slot.dateStr
                                            ? new Date(slot.dateStr + 'T12:00:00')
                                                .toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' })
                                                .replace('.', '')
                                            : slot.day}
                                    </span>
                                    <div className="flex items-center gap-0.5">
                                        {/* Icons summary */}
                                        {dayEvents.length > 0 && (
                                            <div className="flex items-center -space-x-1 mr-0.5">
                                                {(() => {
                                                    const displayedTypes = new Set();
                                                    const uniqueTypeEvents = dayEvents.filter(e => {
                                                        if (displayedTypes.has(e.type)) return false;
                                                        displayedTypes.add(e.type);
                                                        return true;
                                                    });

                                                    return uniqueTypeEvents.slice(0, 3).map((e, idx) => {
                                                        let Icon = Star;
                                                        let colorClass = "text-emerald-600 bg-emerald-50 border-emerald-200";
                                                        if (e.type === 'Reunião') {
                                                            Icon = Users;
                                                            colorClass = "text-indigo-600 bg-indigo-50 border-indigo-200";
                                                        } else if (e.type === 'Feriado' || e.type === 'Feriado Municipal') {
                                                            Icon = Flag;
                                                            colorClass = "text-red-600 bg-red-50 border-red-200";
                                                        } else if (e.type === 'Aniversário') {
                                                            Icon = Gift;
                                                            colorClass = "text-pink-600 bg-pink-50 border-pink-200";
                                                        }

                                                        const title = e.type === 'Aniversário' 
                                                            ? `${dayEvents.filter(ev => ev.type === 'Aniversário').length} Aniversariante(s)`
                                                            : e.title;

                                                        return (
                                                            <div key={`${e.id}-${idx}`} title={title} className={`w-5 h-5 flex items-center justify-center rounded-full border relative shadow-sm ${colorClass}`} style={{ zIndex: 10 - idx }}>
                                                                <Icon className="w-[10px] h-[10px]" />
                                                            </div>
                                                        );
                                                    });
                                                })()}
                                                {dayEvents.length > 3 && (
                                                    <div className="w-5 h-5 flex items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm text-[9px] font-black text-slate-600 relative z-0">
                                                        +{dayEvents.length - 3}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedDate(slot.dateStr);
                                                setSelectedDayEvents(dayEvents);
                                                setIsDayDetailsOpen(true);
                                            }}
                                            className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-rose-100 hover:text-rose-600 transition-all shrink-0 cursor-pointer"
                                            title="Adicionar / Visualizar eventos deste dia"
                                        >
                                            <Plus className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                {/* Eventos do Dia */}
                                <div className="flex-1 overflow-y-hidden p-1 flex flex-col gap-0.5 relative">
                                    {(() => {
                                        const nonBirthdayEvents = dayEvents.filter(e => e.type !== 'Aniversário');
                                        return (
                                            <>
                                                {nonBirthdayEvents.slice(0, 3).map(event => (
                                                    <div
                                                        key={event.id}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setEventDetailsEvent(event);
                                                            setIsEventDetailsOpen(true);
                                                        }}
                                                        className="px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-semibold transition-transform cursor-pointer hover:opacity-80 truncate"
                                                        style={{
                                                            backgroundColor: event.type === 'Feriado' || event.type === 'Feriado Municipal' ? '#fee2e2' : event.type === 'Reunião' ? '#e0e7ff' : '#dcfce7',
                                                            color: event.type === 'Feriado' || event.type === 'Feriado Municipal' ? '#991b1b' : event.type === 'Reunião' ? '#3730a3' : '#166534',
                                                            borderLeft: `2px solid ${event.type === 'Feriado' || event.type === 'Feriado Municipal' ? '#ef4444' : event.type === 'Reunião' ? '#6366f1' : '#22c55e'}`
                                                        }}
                                                    >
                                                        <span className="truncate flex items-center gap-1 font-bold leading-tight">
                                                            {(event.type === 'Feriado Municipal' || event.is_recurring) && (
                                                                <Repeat className="w-1.5 h-1.5 opacity-50 shrink-0" />
                                                            )}
                                                            <span className="truncate">{event.title}</span>
                                                        </span>
                                                    </div>
                                                ))}

                                                {nonBirthdayEvents.length > 3 && (
                                                    <div
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedDate(slot.dateStr);
                                                            setSelectedDayEvents(dayEvents);
                                                            setIsDayDetailsOpen(true);
                                                        }}
                                                        className="text-[9px] font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded px-1.5 py-0.5 mt-auto cursor-pointer text-left transition-colors"
                                                    >
                                                        +{nonBirthdayEvents.length - 3} mais...
                                                    </div>
                                                )}
                                            </>
                                        );
                                    })()}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <EventModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSaved={() => {
                    setIsModalOpen(false);
                    fetchEvents(currentDate);
                }}
                eventToEdit={eventToEdit}
                selectedDate={selectedDate}
                currentUserId={currentUserId}
            />

            <DayDetailsModal
                isOpen={isDayDetailsOpen}
                onClose={() => setIsDayDetailsOpen(false)}
                dateStr={selectedDate}
                events={events.filter(e => {
                    const isRecurringType = e.type === 'Aniversário' || e.type === 'Feriado Municipal' || e.is_recurring;
                    if (isRecurringType) {
                        let targetDate = e.start_date;
                        if (e.type === 'Aniversário' && e.birth_date) {
                            targetDate = e.birth_date;
                        }
                        const [by, bm, bd] = targetDate.split('-').map(Number);
                        const [sy, sm, sd] = selectedDate.split('-').map(Number);
                        return bm === sm && bd === sd;
                    }
                    return selectedDate >= e.start_date && selectedDate <= e.end_date;
                })}
                isAdmin={isAdmin}
                currentUserId={currentUserId}
                onAddEvent={() => {
                    setEventToEdit(null);
                    setIsModalOpen(true);
                }}
                onEditEvent={(evt) => {
                    setEventToEdit(evt);
                    setIsModalOpen(true);
                }}
                onDeleteEvent={async (evt) => {
                    try {
                        const { error } = await supabase.from('calendar_events').delete().eq('id', evt.id);
                        if (error) throw error;
                        fetchEvents(currentDate);
                    } catch (e) {
                        console.error(e);
                        showToast("Erro ao remover evento.", "error");
                    }
                }}
            />

            <EventDetailsModal
                isOpen={isEventDetailsOpen}
                onClose={() => setIsEventDetailsOpen(false)}
                event={eventDetailsEvent}
                isAdmin={isAdmin || eventDetailsEvent?.created_by === currentUserId}
                onEditEvent={(ev) => {
                    setEventToEdit(ev);
                    setIsModalOpen(true);
                }}
                onDeleteSuccess={() => {
                    fetchEvents(currentDate);
                }}
                appState={appState}
            />

            <MyEventsModal
                isOpen={isMyEventsOpen}
                onClose={() => setIsMyEventsOpen(false)}
                currentUserId={currentUserId}
                isAdmin={isAdmin}
                onEventClick={(evt) => {
                    setEventDetailsEvent(evt);
                    setIsEventDetailsOpen(true);
                }}
            />

            <PendingInvitesModal
                currentUserId={currentUserId}
                onClose={() => { }}
                onResolved={() => fetchEvents(currentDate)}
            />

            <MonthEventsModal
                isOpen={isMonthEventsOpen}
                onClose={() => setIsMonthEventsOpen(false)}
                events={events.filter(e => {
                    const year = currentDate.getFullYear();
                    const month = currentDate.getMonth();
                    const eType = (e.type || "").trim();

                    const isRecurringType = eType === 'Aniversário' || eType === 'Feriado Municipal' || e.is_recurring;

                    if (isRecurringType) {
                        const targetDate = eType === 'Aniversário' && e.birth_date ? e.birth_date : e.start_date;
                        const dateObj = safelyParseDate(targetDate);
                        
                        if (!dateObj) return false;
                        return (dateObj.getMonth()) === month;
                    }

                    const firstDayOfMonth = getLocalISOData(new Date(year, month, 1)).date;
                    const lastDayOfMonth = getLocalISOData(new Date(year, month + 1, 0)).date;

                    return (e.start_date || '') <= lastDayOfMonth && (e.end_date || e.start_date || '') >= firstDayOfMonth;
                })}
                currentMonth={currentDate.getMonth()}
                currentYear={currentDate.getFullYear()}
                appState={appState}
            />

            {toast.show && createPortal(
                <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[3000] px-6 py-3.5 rounded-2xl shadow-2xl border flex items-center gap-3 animate-slide-up ${toast.type === 'success' ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-rose-600 border-rose-500 text-white'}`}>
                    {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                    <span className="font-bold text-xs uppercase tracking-wider">{toast.message}</span>
                </div>,
                document.body
            )}
        </div>
    );
};
