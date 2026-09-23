import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, ChevronsLeft, ChevronsRight, Star, Users, Flag, Gift, Repeat, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import { NovoEventoPage } from './NovoEventoPage';
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

    const [isEventPageOpen, setIsEventPageOpen] = useState(false);
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

    // Detecção e sincronização de Rotas (/Calendario/Novo, /Calendario/Editar)
    useEffect(() => {
        const checkRoute = async () => {
            const rawPath = window.location.pathname;
            const path = rawPath.toLowerCase();
            if (path.startsWith('/calendario/novo')) {
                setIsEventPageOpen(true);
            } else if (path.startsWith('/calendario/editar')) {
                setIsEventPageOpen(true);
                const parts = rawPath.split('/').filter(Boolean);
                // Exemplo: ['Calendario', 'Editar', '7edc3332-a5f5-41eb-a99a-acf1c4a02547', 'Programacao']
                const eventId = parts[2];
                if (eventId && (!eventToEdit || eventToEdit.id !== eventId)) {
                    try {
                        const { data, error } = await supabase
                            .from('calendar_events')
                            .select('*')
                            .eq('id', eventId)
                            .single();
                        if (data && !error) {
                            setEventToEdit(data as CalendarEvent);
                        }
                    } catch (err) {
                        console.error('Erro ao carregar evento da URL:', err);
                    }
                }
            } else if (path === '/calendario') {
                setIsEventPageOpen(false);
                setEventToEdit(null);
            }
        };

        checkRoute();
        window.addEventListener('popstate', checkRoute);
        return () => window.removeEventListener('popstate', checkRoute);
    }, []);

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

    const [selectedMobileDate, setSelectedMobileDate] = useState<string>(() => getLocalISOData(new Date()).date);

    const prevDay = () => {
        const parts = selectedMobileDate.split('-').map(Number);
        const d = new Date(parts[0], parts[1] - 1, parts[2] - 1);
        const newDateStr = getLocalISOData(d).date;
        setSelectedMobileDate(newDateStr);
        if (d.getMonth() !== currentDate.getMonth() || d.getFullYear() !== currentDate.getFullYear()) {
            setCurrentDate(new Date(d.getFullYear(), d.getMonth(), 1));
        }
    };

    const nextDay = () => {
        const parts = selectedMobileDate.split('-').map(Number);
        const d = new Date(parts[0], parts[1] - 1, parts[2] + 1);
        const newDateStr = getLocalISOData(d).date;
        setSelectedMobileDate(newDateStr);
        if (d.getMonth() !== currentDate.getMonth() || d.getFullYear() !== currentDate.getFullYear()) {
            setCurrentDate(new Date(d.getFullYear(), d.getMonth(), 1));
        }
    };

    const getDayEvents = (dateStr: string) => {
        if (!dateStr) return [];
        return events.filter(e => {
            const isRecurringType = e.type === 'Aniversário' || e.type === 'Feriado Municipal' || e.is_recurring;

            if (isRecurringType) {
                let targetDate = e.start_date;
                if (e.type === 'Aniversário' && e.birth_date) {
                    targetDate = e.birth_date;
                }

                const [by, bm, bd] = targetDate.split('-').map(Number);
                const [sy, sm, sd] = dateStr.split('-').map(Number);
                return bm === sm && bd === sd;
            }

            return dateStr >= e.start_date && dateStr <= e.end_date;
        });
    };

    const formatSelectedDateHeader = (dateStr: string) => {
        if (!dateStr) return '';
        const [y, m, d] = dateStr.split('-').map(Number);
        const dateObj = new Date(y, m - 1, d, 12, 0, 0);
        const weekday = dateObj.toLocaleDateString('pt-BR', { weekday: 'long' });
        const monthName = dateObj.toLocaleDateString('pt-BR', { month: 'long' });
        const capWeekday = weekday.charAt(0).toUpperCase() + weekday.slice(1);
        const capMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
        return `${capWeekday}, ${d} de ${capMonth}`;
    };

    return (
        <div className="fixed inset-0 w-full h-full bg-[#FAFAFA] flex flex-col z-[100] font-sans">

            {/* HEADER FIXO DESKTOP (hidden no mobile) */}
            <div className="hidden md:flex h-20 shrink-0 bg-white border-b border-slate-200 shadow-sm items-center justify-between px-6 desktop:px-10 z-[110]">
                <div className="flex items-center gap-6">
                    <button
                        onClick={onBack}
                        className="group flex items-center justify-center w-10 h-10 rounded-full bg-slate-50 border border-slate-200 hover:bg-white hover:border-slate-300 hover:shadow-md transition-all active:scale-95 cursor-pointer"
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
                            setIsEventPageOpen(true);
                            window.history.pushState({ page: 'novo-evento' }, '', '/Calendario/Novo/Identificacao');
                        }}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-lg shadow-rose-500/30 hover:shadow-rose-500/50 hover:-translate-y-0.5 transition-all active:scale-95 cursor-pointer"
                    >
                        <Plus className="w-5 h-5" />
                        <span>Novo Evento</span>
                    </button>
                </div>
            </div>

            {/* HEADER MOBILE (visível apenas no mobile) */}
            <div className="flex md:hidden flex-col bg-white border-b border-slate-200 px-4 py-3 shrink-0 shadow-xs z-[110] gap-2.5">
                <div className="flex items-center justify-between gap-2.5">
                    <button
                        onClick={onBack}
                        className="p-2 -ml-1 text-slate-500 hover:text-rose-600 rounded-xl bg-slate-50 hover:bg-rose-50 border border-slate-200/80 flex items-center justify-center transition-all active:scale-95 shrink-0"
                        title="Voltar ao Dashboard"
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </button>

                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-rose-500 to-rose-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                            <CalendarIcon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                            <h1 className="text-sm font-black text-slate-900 tracking-tight leading-none uppercase truncate">
                                Calendário
                            </h1>
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block truncate mt-0.5">
                                Agenda Municipal
                            </span>
                        </div>
                    </div>

                    <button
                        onClick={() => {
                            setEventToEdit(null);
                            setSelectedDate(selectedMobileDate || getLocalISOData(new Date()).date);
                            setIsEventPageOpen(true);
                            window.history.pushState({ page: 'novo-evento' }, '', '/Calendario/Novo/Identificacao');
                        }}
                        className="px-3 py-2 bg-gradient-to-r from-rose-600 to-rose-700 active:scale-95 text-white font-black rounded-xl shadow-md shadow-rose-600/20 flex items-center gap-1.5 uppercase text-[10px] tracking-wider shrink-0 transition-all cursor-pointer"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Novo</span>
                    </button>
                </div>

                {/* Barra de Ações Rápidas Mobile */}
                <div className="grid grid-cols-3 gap-1.5 pt-0.5">
                    <button
                        onClick={goToToday}
                        className={`py-1.5 px-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1 border active:scale-95 ${
                            isToday(selectedMobileDate)
                                ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                    >
                        <CalendarIcon className="w-3 h-3" />
                        <span>Hoje</span>
                    </button>

                    <button
                        onClick={() => setIsMyEventsOpen(true)}
                        className="py-1.5 px-2 rounded-xl text-[10px] font-black uppercase tracking-wider bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100 transition-all flex items-center justify-center gap-1 active:scale-95"
                    >
                        <Star className="w-3 h-3 text-amber-500" />
                        <span>Meus</span>
                    </button>

                    <button
                        onClick={() => setIsMonthEventsOpen(true)}
                        className="py-1.5 px-2 rounded-xl text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-all flex items-center justify-center gap-1 active:scale-95"
                    >
                        <Repeat className="w-3 h-3 text-indigo-600" />
                        <span>Mês</span>
                    </button>
                </div>
            </div>

            {/* NAVEGAÇÃO E CONTROLES DESKTOP (hidden no mobile) */}
            <div className="hidden md:flex px-6 desktop:px-10 py-4 items-center justify-between bg-white/50 backdrop-blur-sm relative z-[105]">
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

            {/* NAVEGAÇÃO DE MÊS / MINI-CALENDÁRIO MOBILE (visível apenas no mobile) */}
            <div className="flex md:hidden flex-col bg-white border-b border-slate-200 shrink-0 shadow-xs">
                {/* Seletor do Mês Mobile */}
                <div className="flex items-center justify-between px-3 py-2 bg-slate-50/80 border-b border-slate-100">
                    <div className="flex items-center gap-1">
                        <button onClick={prevYear} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-white rounded-lg transition-colors" title="Ano Anterior">
                            <ChevronsLeft className="w-4 h-4" />
                        </button>
                        <button onClick={prevMonth} className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-white rounded-lg transition-colors" title="Mês Anterior">
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1">
                        <span>{monthNames[currentDate.getMonth()]}</span>
                        <span className="text-rose-600 font-extrabold">{currentDate.getFullYear()}</span>
                    </div>

                    <div className="flex items-center gap-1">
                        <button onClick={nextMonth} className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-white rounded-lg transition-colors" title="Próximo Mês">
                            <ChevronRight className="w-4 h-4" />
                        </button>
                        <button onClick={nextYear} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-white rounded-lg transition-colors" title="Próximo Ano">
                            <ChevronsRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Grade Mini-Calendário Mobile */}
                <div className="p-2.5 pb-2">
                    {/* Cabeçalho dos dias da semana */}
                    <div className="grid grid-cols-7 gap-1 mb-1">
                        {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, idx) => (
                            <div key={idx} className="text-center text-[10px] font-black text-slate-400 uppercase py-0.5">
                                {day}
                            </div>
                        ))}
                    </div>

                    {/* Dias do mês */}
                    <div className="grid grid-cols-7 gap-1">
                        {calendarGrid.map((slot, i) => {
                            if (!slot.isCurrentMonth || !slot.day) {
                                return <div key={i} className="h-8"></div>;
                            }

                            const isSelected = selectedMobileDate === slot.dateStr;
                            const isTodayDate = isToday(slot.dateStr);
                            const dayEvents = getDayEvents(slot.dateStr);

                            return (
                                <button
                                    key={i}
                                    onClick={() => setSelectedMobileDate(slot.dateStr)}
                                    className={`h-8.5 rounded-xl flex flex-col items-center justify-center relative transition-all active:scale-95 ${
                                        isSelected
                                            ? 'bg-gradient-to-br from-rose-500 to-rose-600 text-white font-black shadow-sm shadow-rose-500/30'
                                            : isTodayDate
                                            ? 'border-2 border-rose-500 bg-rose-50/60 text-rose-600 font-black'
                                            : slot.isWeekend
                                            ? 'text-indigo-900/60 hover:bg-slate-50'
                                            : 'text-slate-700 hover:bg-slate-50'
                                    }`}
                                >
                                    <span className="text-[11px] leading-none font-bold">
                                        {slot.day}
                                    </span>

                                    {/* Indicadores de Eventos (Dots) */}
                                    {dayEvents.length > 0 && (
                                        <div className="flex items-center gap-0.5 mt-0.5">
                                            {(() => {
                                                const types = new Set(dayEvents.map(e => e.type));
                                                const dots = [];
                                                if (types.has('Feriado') || types.has('Feriado Municipal')) {
                                                    dots.push('bg-red-500');
                                                }
                                                if (types.has('Aniversário')) {
                                                    dots.push('bg-pink-500');
                                                }
                                                if (types.has('Reunião')) {
                                                    dots.push('bg-indigo-500');
                                                }
                                                if (dots.length === 0 || types.has('Evento') || types.has('Oficial') || types.has('Notícia')) {
                                                    if (dots.length < 3) dots.push('bg-emerald-500');
                                                }

                                                return dots.slice(0, 3).map((dotClass, dIdx) => (
                                                    <span
                                                        key={dIdx}
                                                        className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white' : dotClass}`}
                                                    />
                                                ));
                                            })()}
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* PAINEL DE EVENTOS DO DIA SELECIONADO MOBILE (visível apenas no mobile) */}
            <div className="flex md:hidden flex-1 flex-col overflow-y-auto custom-scrollbar p-3.5 bg-slate-100 gap-3">
                {/* Cabeçalho do Dia Selecionado */}
                <div className="flex items-center justify-between bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
                    <button
                        onClick={prevDay}
                        className="p-1.5 text-slate-400 hover:text-slate-700 bg-slate-50 rounded-xl border border-slate-200/80 active:scale-95"
                        title="Dia Anterior"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>

                    <div className="text-center min-w-0 flex-1 px-2">
                        <div className="flex items-center justify-center gap-1.5">
                            <span className="text-xs font-black text-slate-900 uppercase truncate">
                                {formatSelectedDateHeader(selectedMobileDate)}
                            </span>
                            {isToday(selectedMobileDate) && (
                                <span className="bg-rose-100 text-rose-700 text-[8px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-wider shrink-0">
                                    Hoje
                                </span>
                            )}
                        </div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                            {getDayEvents(selectedMobileDate).length} compromisso(s)
                        </p>
                    </div>

                    <div className="flex items-center gap-1">
                        <button
                            onClick={nextDay}
                            className="p-1.5 text-slate-400 hover:text-slate-700 bg-slate-50 rounded-xl border border-slate-200/80 active:scale-95"
                            title="Próximo Dia"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Lista de Eventos do Dia */}
                <div className="flex flex-col gap-2.5">
                    {(() => {
                        const dayEvents = getDayEvents(selectedMobileDate);

                        if (dayEvents.length === 0) {
                            return (
                                <div className="p-8 bg-white rounded-2xl border border-dashed border-slate-200 text-center flex flex-col items-center justify-center space-y-3">
                                    <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300">
                                        <CalendarIcon className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="text-xs font-black text-slate-700 uppercase">Nenhum compromisso agendado</h3>
                                        <p className="text-[11px] text-slate-400 mt-0.5">Não há eventos cadastrados para esta data.</p>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setEventToEdit(null);
                                            setSelectedDate(selectedMobileDate);
                                            setIsEventPageOpen(true);
                                            window.history.pushState({ page: 'novo-evento' }, '', '/Calendario/Novo/Identificacao');
                                        }}
                                        className="px-4 py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-95"
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                        <span>Adicionar Evento</span>
                                    </button>
                                </div>
                            );
                        }

                        return dayEvents.map(event => {
                            const isHoliday = event.type === 'Feriado' || event.type === 'Feriado Municipal';
                            const isBirthday = event.type === 'Aniversário';
                            const isMeeting = event.type === 'Reunião';

                            let borderColor = 'border-l-emerald-500 border-emerald-100';
                            let iconBg = 'bg-emerald-50 text-emerald-600 border-emerald-200';
                            let IconComponent = Star;
                            let badgeBg = 'bg-emerald-50 text-emerald-700 border-emerald-200';

                            if (isHoliday) {
                                borderColor = 'border-l-rose-500 border-rose-100';
                                iconBg = 'bg-rose-50 text-rose-600 border-rose-200';
                                IconComponent = Flag;
                                badgeBg = 'bg-rose-50 text-rose-700 border-rose-200';
                            } else if (isBirthday) {
                                borderColor = 'border-l-pink-500 border-pink-100';
                                iconBg = 'bg-pink-50 text-pink-600 border-pink-200';
                                IconComponent = Gift;
                                badgeBg = 'bg-pink-50 text-pink-700 border-pink-200';
                            } else if (isMeeting) {
                                borderColor = 'border-l-indigo-500 border-indigo-100';
                                iconBg = 'bg-indigo-50 text-indigo-600 border-indigo-200';
                                IconComponent = Users;
                                badgeBg = 'bg-indigo-50 text-indigo-700 border-indigo-200';
                            }

                            return (
                                <div
                                    key={event.id}
                                    onClick={() => {
                                        setEventDetailsEvent(event);
                                        setIsEventDetailsOpen(true);
                                    }}
                                    className={`bg-white rounded-2xl border border-l-4 ${borderColor} p-3.5 shadow-xs flex flex-col gap-2 cursor-pointer active:scale-[0.99] transition-all`}
                                >
                                    <div className="flex items-start justify-between gap-2.5">
                                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center border shrink-0 mt-0.5 ${iconBg}`}>
                                                <IconComponent className="w-4 h-4" />
                                            </div>

                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md border ${badgeBg}`}>
                                                        {event.type}
                                                    </span>
                                                    {(event.start_time || event.end_time) ? (
                                                        <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                                                            {event.start_time?.slice(0, 5)} {event.end_time ? `às ${event.end_time.slice(0, 5)}` : ''}
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] font-bold text-slate-400">
                                                            Dia inteiro
                                                        </span>
                                                    )}
                                                </div>

                                                <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight mt-1 leading-snug">
                                                    {event.title}
                                                </h4>

                                                {event.description && (
                                                    <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5 font-medium">
                                                        {event.description}
                                                    </p>
                                                )}

                                                {event.location && (
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1 flex items-center gap-1 truncate">
                                                        <span>📍 {event.location}</span>
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-1 shrink-0">
                                            {(isAdmin || event.created_by === currentUserId) && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setEventToEdit(event);
                                                        setSelectedDate(event.start_date || selectedMobileDate);
                                                        setIsEventPageOpen(true);
                                                        window.history.pushState({ page: 'editar-evento' }, '', `/Calendario/Editar/${event.id}/Identificacao`);
                                                    }}
                                                    className="p-1.5 text-slate-400 hover:text-rose-600 bg-slate-50 hover:bg-rose-50 rounded-lg border border-slate-200/80 transition-all active:scale-90"
                                                    title="Editar Evento"
                                                >
                                                    <Plus className="w-3.5 h-3.5 rotate-45" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        });
                    })()}
                </div>
            </div>

            {/* GRADE DO CALENDÁRIO DESKTOP (hidden no mobile) */}
            <div className="hidden md:flex flex-1 flex-col bg-white overflow-hidden p-6 desktop:p-10 pt-2">
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

            {/* PÁGINA DEDICADA DE NOVO/EDITAR EVENTO COM ESTEIRA DE ABAS */}
            {isEventPageOpen && (
                <div className="fixed inset-0 z-[2500] bg-slate-900 flex flex-col">
                    <NovoEventoPage
                        onBack={() => {
                            setIsEventPageOpen(false);
                            setEventToEdit(null);
                        }}
                        onSaved={() => {
                            setIsEventPageOpen(false);
                            setEventToEdit(null);
                            fetchEvents(currentDate);
                            showToast("Evento salvo com sucesso no Calendário!");
                        }}
                        eventToEdit={eventToEdit}
                        selectedDate={selectedDate}
                        currentUserId={currentUserId}
                    />
                </div>
            )}

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
                    setIsDayDetailsOpen(false);
                    setIsEventPageOpen(true);
                    window.history.pushState({ page: 'novo-evento' }, '', '/Calendario/Novo/Identificacao');
                }}
                onEditEvent={(evt) => {
                    setEventToEdit(evt);
                    setSelectedDate(evt.start_date || selectedDate);
                    setIsDayDetailsOpen(false);
                    setIsEventPageOpen(true);
                    window.history.pushState({ page: 'editar-evento' }, '', `/Calendario/Editar/${evt.id}/Identificacao`);
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
                    setSelectedDate(ev.start_date || selectedDate);
                    setIsEventDetailsOpen(false);
                    setIsEventPageOpen(true);
                    window.history.pushState({ page: 'editar-evento' }, '', `/Calendario/Editar/${ev.id}/Identificacao`);
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
