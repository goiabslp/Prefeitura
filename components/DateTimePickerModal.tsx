import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight, Calendar, Clock, Check } from 'lucide-react';

interface DateTimePickerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (date: Date) => void;
    initialDate?: Date;
    title: string;
    minDate?: Date;
    maxDate?: Date;
    shouldDisableDate?: (date: Date) => boolean;
    mode?: 'date' | 'time' | 'datetime';
}

export const DateTimePickerModal: React.FC<DateTimePickerModalProps> = ({
    isOpen,
    onClose,
    onSelect,
    initialDate,
    title,
    minDate,
    maxDate,
    shouldDisableDate,
    mode = 'datetime'
}) => {
    const [selectedDate, setSelectedDate] = useState(initialDate || new Date());
    const [viewDate, setViewDate] = useState(initialDate || new Date()); // For navigating months without changing selection
    const [activeView, setActiveView] = useState<'calendar' | 'time'>(mode === 'time' ? 'time' : 'calendar');
    const [isClosing, setIsClosing] = useState(false);

    useEffect(() => {
        if (isOpen) {
            const d = initialDate || new Date();
            setSelectedDate(d);
            setViewDate(d);
            setActiveView(mode === 'time' ? 'time' : 'calendar');
            setIsClosing(false);
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, initialDate, mode]);

    useEffect(() => {
        if (isOpen && (activeView === 'time' || window.innerWidth >= 768)) {
            // Scroll to selected time
            setTimeout(() => {
                const selectedHourBtn = document.getElementById(`hour-${selectedDate.getHours()}`);
                const selectedMinuteBtn = document.getElementById(`minute-${selectedDate.getMinutes()}`);

                if (selectedHourBtn) selectedHourBtn.scrollIntoView({ block: 'center', behavior: 'smooth' });
                if (selectedMinuteBtn) selectedMinuteBtn.scrollIntoView({ block: 'center', behavior: 'smooth' });
            }, 100);
        }
    }, [isOpen, activeView, selectedDate.getHours(), selectedDate.getMinutes()]);

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(() => {
            onClose();
            setIsClosing(false);
        }, 300);
    };

    const handleConfirm = () => {
        onSelect(selectedDate);
        handleClose();
    };



    // Calendar Logic
    const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const weekDays = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

    const calendarDays = useMemo(() => {
        const year = viewDate.getFullYear();
        const month = viewDate.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const days = [];

        // Previous month filler
        const prevMonthLast = new Date(year, month, 0).getDate();
        for (let i = firstDay - 1; i >= 0; i--) {
            days.push({ day: prevMonthLast - i, type: 'prev', date: new Date(year, month - 1, prevMonthLast - i) });
        }

        // Current month
        for (let i = 1; i <= daysInMonth; i++) {
            days.push({ day: i, type: 'current', date: new Date(year, month, i) });
        }

        // Next month filler
        let nextMonthDay = 1;
        while (days.length < 42) {
            days.push({ day: nextMonthDay++, type: 'next', date: new Date(year, month + 1, nextMonthDay - 1) });
        }

        return days;
    }, [viewDate]);

    const isDayDisabled = (date: Date) => {
        if (shouldDisableDate && shouldDisableDate(date)) return true;
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);

        if (minDate) {
            const min = new Date(minDate);
            min.setHours(0, 0, 0, 0);
            if (d < min) return true;
        }

        if (maxDate) {
            const max = new Date(maxDate);
            max.setHours(0, 0, 0, 0);
            if (d > max) return true;
        }

        return false;
    };

    const isSameDay = (d1: Date, d2: Date) => {
        return d1.getDate() === d2.getDate() && d1.getMonth() === d2.getMonth() && d1.getFullYear() === d2.getFullYear();
    };

    const changeMonth = (delta: number) => {
        const newDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + delta, 1);
        setViewDate(newDate);
    };

    // Time Logic
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const minutes = Array.from({ length: 60 }, (_, i) => i); // 0, 1, 2... 59

    const updateTime = (hour: number, minute: number) => {
        const newDate = new Date(selectedDate);
        newDate.setHours(hour);
        newDate.setMinutes(minute);
        setSelectedDate(newDate);
    };

    if (!isOpen && !isClosing) return null;

    return createPortal(
        <div className={`fixed inset-0 z-[10001] flex items-end sm:items-center justify-center sm:p-4 transition-all duration-300 ${isClosing ? 'opacity-0' : 'opacity-100'}`}>
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md transition-opacity" onClick={handleClose} />

            <div className={`
        relative w-full max-w-md ${mode === 'datetime' ? 'md:max-w-2xl' : 'md:max-w-md'} bg-white sm:rounded-[2.5rem] rounded-t-[2.5rem] shadow-2xl flex flex-col overflow-hidden border border-white/20
        transform transition-all duration-300 ease-out h-full sm:h-auto max-h-[96vh]
        ${isClosing ? 'translate-y-full sm:scale-95 sm:opacity-0' : 'translate-y-0 sm:scale-100 sm:opacity-100'}
        animate-slide-up
      `}>
                {/* Header */}
                <div className="px-8 py-6 border-b border-slate-100 bg-white z-10 shrink-0 flex items-center justify-between">
                    <div>
                        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">{title}</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                            {mode !== 'time' && selectedDate.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                            {mode === 'datetime' && ' • '}
                            {mode !== 'date' && selectedDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                    </div>
                    <button onClick={handleClose} className="p-2 bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-xl transition-all"><X className="w-5 h-5" /></button>
                </div>

                {/* View Switcher - Only for datetime mode on mobile */}
                {mode === 'datetime' && (
                    <div className="flex p-2 bg-slate-50 mx-6 mt-6 rounded-2xl md:hidden">
                        <button
                            onClick={() => setActiveView('calendar')}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${activeView === 'calendar' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <Calendar className="w-4 h-4" /> Data
                        </button>
                        <button
                            onClick={() => setActiveView('time')}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${activeView === 'time' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <Clock className="w-4 h-4" /> Horário
                        </button>
                    </div>
                )}

                <div className="p-6 h-auto min-h-[320px] md:flex md:gap-8 md:items-start justify-center">
                    {/* Calendar Section */}
                    {mode !== 'time' && (
                        <div className={`animate-fade-in flex-col h-full w-full md:w-auto md:flex-1 ${activeView === 'time' ? 'hidden md:flex' : 'flex'}`}>
                            <div className="flex items-center justify-between mb-4 px-2">
                                <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 transition-colors"><ChevronLeft className="w-5 h-5" /></button>
                                <span className="text-sm font-black text-slate-900 uppercase tracking-widest">{months[viewDate.getMonth()]} {viewDate.getFullYear()}</span>
                                <button onClick={() => changeMonth(1)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 transition-colors"><ChevronRight className="w-5 h-5" /></button>
                            </div>

                            <div className="grid grid-cols-7 mb-2">
                                {weekDays.map((d, i) => (
                                    <div key={i} className={`text-center text-[10px] font-black ${i === 0 || i === 6 ? 'text-amber-500' : 'text-slate-300'}`}>{d}</div>
                                ))}
                            </div>

                            <div className="grid grid-cols-7 gap-1 flex-1 content-start">
                                {calendarDays.map((d, i) => {
                                    const disabled = isDayDisabled(d.date);
                                    const selected = isSameDay(d.date, selectedDate);
                                    const isToday = isSameDay(d.date, new Date());

                                    if (d.type !== 'current') return <div key={i} className="" />; // Invisible placeholder

                                    return (
                                        <button
                                            key={i}
                                            disabled={disabled}
                                            onClick={() => {
                                                const newDate = new Date(d.date);
                                                newDate.setHours(selectedDate.getHours());
                                                newDate.setMinutes(selectedDate.getMinutes());
                                                setSelectedDate(newDate);
                                            }}
                                            className={`
                         aspect-square flex flex-col items-center justify-center rounded-xl transition-all relative text-sm font-bold
                         ${disabled ? 'opacity-20 cursor-not-allowed' : 'hover:scale-105'}
                         ${selected
                                                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                                                    : disabled
                                                        ? 'text-slate-400'
                                                        : 'text-slate-700 hover:bg-indigo-50 hover:text-indigo-600'
                                                }
                         ${isToday && !selected ? 'ring-2 ring-indigo-600/20' : ''}
                       `}
                                        >
                                            {d.day}
                                            {isToday && <div className={`w-1 h-1 rounded-full mt-0.5 ${selected ? 'bg-white' : 'bg-indigo-600'}`} />}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Divider for Desktop */}
                    {mode === 'datetime' && <div className="hidden md:block w-px bg-slate-100 self-stretch mx-2"></div>}

                    {/* Time Section */}
                    {mode !== 'date' && (
                        <div className={`animate-fade-in md:w-48 h-full flex gap-4 md:flex-col ${activeView === 'calendar' ? 'hidden md:flex' : 'flex'}`}>

                            {/* Time Header for Desktop */}
                            <div className="hidden md:flex items-center gap-2 mb-4 px-2 text-slate-400">
                                <Clock className="w-4 h-4" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Horário</span>
                            </div>

                            <div className="flex gap-4 h-[260px]">
                                {/* Hours */}
                                <div className="flex-1 flex flex-col">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center mb-2 md:hidden">Hora</span>
                                    <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50 rounded-2xl p-2 space-y-1">
                                        {hours.map(h => {
                                            let isDisabled = false;
                                            if (minDate && isSameDay(selectedDate, minDate)) {
                                                if (h < minDate.getHours()) isDisabled = true;
                                            }
                                            if (maxDate && isSameDay(selectedDate, maxDate)) {
                                                if (h > maxDate.getHours()) isDisabled = true;
                                            }

                                            return (
                                                <button
                                                    key={h}
                                                    id={`hour-${h}`}
                                                    disabled={isDisabled}
                                                    onClick={() => updateTime(h, selectedDate.getMinutes())}
                                                    className={`w-full py-2 rounded-lg text-sm font-bold transition-all ${selectedDate.getHours() === h ? 'bg-indigo-600 text-white shadow-md' : isDisabled ? 'text-slate-300 cursor-not-allowed opacity-50' : 'text-slate-600 hover:bg-white'}`}
                                                >
                                                    {String(h).padStart(2, '0')}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Minutes */}
                                <div className="flex-1 flex flex-col">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center mb-2 md:hidden">Minuto</span>
                                    <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50 rounded-2xl p-2 space-y-1">
                                        {minutes.map(m => {
                                            let isDisabled = false;
                                            if (minDate && isSameDay(selectedDate, minDate)) {
                                                if (selectedDate.getHours() === minDate.getHours() && m < minDate.getMinutes()) isDisabled = true;
                                                if (selectedDate.getHours() < minDate.getHours()) isDisabled = true;
                                            }
                                            if (maxDate && isSameDay(selectedDate, maxDate)) {
                                                if (selectedDate.getHours() === maxDate.getHours() && m > maxDate.getMinutes()) isDisabled = true;
                                                if (selectedDate.getHours() > maxDate.getHours()) isDisabled = true;
                                            }

                                            return (
                                                <button
                                                    key={m}
                                                    id={`minute-${m}`}
                                                    disabled={isDisabled}
                                                    onClick={() => updateTime(selectedDate.getHours(), m)}
                                                    className={`w-full py-2 rounded-lg text-sm font-bold transition-all ${selectedDate.getMinutes() === m ? 'bg-indigo-600 text-white shadow-md' : isDisabled ? 'text-slate-300 cursor-not-allowed opacity-50' : 'text-slate-600 hover:bg-white'}`}
                                                >
                                                    {String(m).padStart(2, '0')}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-6 bg-white border-t border-slate-100 flex gap-4">
                    <button onClick={handleClose} className="flex-1 py-4 text-slate-400 font-black uppercase tracking-widest text-xs hover:text-rose-600 transition-colors">Cancelar</button>
                    <button onClick={handleConfirm} className="flex-[2] py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-slate-900/20 hover:bg-indigo-600 hover:shadow-indigo-600/30 transition-all active:scale-95 flex items-center justify-center gap-2">
                        <Check className="w-4 h-4" /> Confirmar
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};
