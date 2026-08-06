import React, { useState, useRef, useEffect } from 'react';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Calendar, Check, RotateCcw } from 'lucide-react';

interface MonthYearPickerProps {
    selectedMonth: number; // 0 to 11
    selectedYear: number;
    onChange: (month: number, year: number) => void;
    
    // Suporte ao Modelo Diário (Intervalo de Datas)
    periodMode?: 'monthly' | 'daily';
    startDate?: string; // YYYY-MM-DD
    endDate?: string;   // YYYY-MM-DD
    onPeriodModeChange?: (mode: 'monthly' | 'daily') => void;
    onDateRangeChange?: (startDate: string, endDate: string) => void;
    onReset?: () => void;
    
    className?: string;
}

export const MonthYearPicker: React.FC<MonthYearPickerProps> = ({
    selectedMonth,
    selectedYear,
    onChange,
    periodMode = 'monthly',
    startDate = '',
    endDate = '',
    onPeriodModeChange,
    onDateRangeChange,
    onReset,
    className = ''
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [filterMode, setFilterMode] = useState<'monthly' | 'daily'>(periodMode);
    const [viewYear, setViewYear] = useState(selectedYear);
    const [viewMonth, setViewMonth] = useState(selectedMonth);
    
    // Estado interno para seleção diária de intervalo
    const [tempStartDate, setTempStartDate] = useState(startDate);
    const [tempEndDate, setTempEndDate] = useState(endDate);
    const [selectingStep, setSelectingStep] = useState<'start' | 'end'>('start');

    const dropdownRef = useRef<HTMLDivElement>(null);

    const months = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];

    const monthsShort = [
        'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
        'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
    ];

    const weekDaysShort = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

    useEffect(() => {
        setFilterMode(periodMode);
    }, [periodMode]);

    useEffect(() => {
        setViewYear(selectedYear);
        setViewMonth(selectedMonth);
    }, [selectedYear, selectedMonth]);

    useEffect(() => {
        if (startDate) setTempStartDate(startDate);
        if (endDate) setTempEndDate(endDate);
    }, [startDate, endDate]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Formatação amigável das datas para exibição no botão
    const formatDisplayDate = (dateStr: string) => {
        if (!dateStr) return '';
        const [y, m, d] = dateStr.split('-');
        return `${d}/${m}/${y}`;
    };

    const getDisplayText = () => {
        if (filterMode === 'daily') {
            if (tempStartDate && tempEndDate) {
                return `${formatDisplayDate(tempStartDate)} - ${formatDisplayDate(tempEndDate)}`;
            } else if (tempStartDate) {
                return `De ${formatDisplayDate(tempStartDate)}`;
            }
            return 'Selecione o intervalo';
        }
        return `${months[selectedMonth]} de ${selectedYear}`;
    };

    // Ação do Botão Limpar: Restaura por padrão o mês atual no modo mensal
    const handleReset = () => {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        setFilterMode('monthly');
        setViewMonth(currentMonth);
        setViewYear(currentYear);

        onChange(currentMonth, currentYear);
        onPeriodModeChange?.('monthly');

        if (onReset) {
            onReset();
        }
        setIsOpen(false);
    };

    // Auxiliares do calendário diário
    const getDaysInMonth = (month: number, year: number) => new Date(year, month + 1, 0).getDate();
    const getFirstDayIndex = (month: number, year: number) => new Date(year, month, 1).getDay();

    const handleDayClick = (day: number) => {
        const clickedMonthStr = String(viewMonth + 1).padStart(2, '0');
        const clickedDayStr = String(day).padStart(2, '0');
        const formattedDate = `${viewYear}-${clickedMonthStr}-${clickedDayStr}`;

        if (selectingStep === 'start' || !tempStartDate) {
            setTempStartDate(formattedDate);
            setTempEndDate('');
            setSelectingStep('end');
        } else {
            let finalStart = tempStartDate;
            let finalEnd = formattedDate;

            if (formattedDate < tempStartDate) {
                finalStart = formattedDate;
                finalEnd = tempStartDate;
            }

            setTempStartDate(finalStart);
            setTempEndDate(finalEnd);
            setSelectingStep('start');

            if (onDateRangeChange) {
                onDateRangeChange(finalStart, finalEnd);
            }
        }
    };

    const handlePrevMonth = () => {
        if (viewMonth === 0) {
            setViewMonth(11);
            setViewYear(prev => prev - 1);
        } else {
            setViewMonth(prev => prev - 1);
        }
    };

    const handleNextMonth = () => {
        if (viewMonth === 11) {
            setViewMonth(0);
            setViewYear(prev => prev + 1);
        } else {
            setViewMonth(prev => prev + 1);
        }
    };

    return (
        <div className={`relative ${className}`} ref={dropdownRef}>
            {/* Botão de Disparo do Filtro de Período */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`
                    w-full flex items-center justify-between gap-3 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl
                    hover:bg-white hover:border-cyan-400 hover:shadow-md hover:shadow-cyan-500/10
                    transition-all duration-300 outline-none text-slate-800 font-bold text-sm shadow-xs cursor-pointer
                    ${isOpen ? 'bg-white border-cyan-500 ring-4 ring-cyan-500/10' : ''}
                `}
            >
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 bg-cyan-50 rounded-lg flex items-center justify-center text-cyan-600 shrink-0 font-bold border border-cyan-100/80">
                        {filterMode === 'daily' ? <Calendar className="w-4 h-4" /> : <CalendarDays className="w-4 h-4" />}
                    </div>
                    <div className="flex flex-col text-left truncate">
                        <span className="text-[9px] font-black uppercase tracking-wider text-cyan-700 leading-none mb-0.5">
                            Filtro: {filterMode === 'daily' ? 'Diário (Intervalo)' : 'Mensal'}
                        </span>
                        <span className="capitalize font-black text-slate-800 text-xs sm:text-sm truncate">
                            {getDisplayText()}
                        </span>
                    </div>
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180 text-cyan-600' : ''}`} />
            </button>

            {/* Popover do Seletor */}
            {isOpen && (
                <div className="absolute right-0 left-0 sm:left-auto top-full mt-2 w-full sm:w-80 bg-white rounded-3xl shadow-2xl border border-slate-100 p-4 z-[100] animate-in fade-in zoom-in-95 duration-200">
                    {/* Botões de Troca de Modo: Mensal x Diário */}
                    <div className="flex bg-slate-100 p-1 rounded-2xl mb-3 border border-slate-200/80">
                        <button
                            type="button"
                            onClick={() => {
                                setFilterMode('monthly');
                                onPeriodModeChange?.('monthly');
                            }}
                            className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                                filterMode === 'monthly'
                                    ? 'bg-white text-cyan-700 shadow-sm font-black'
                                    : 'text-slate-500 hover:text-slate-800'
                            }`}
                        >
                            <CalendarDays className="w-3.5 h-3.5" />
                            Mensal
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setFilterMode('daily');
                                onPeriodModeChange?.('daily');
                            }}
                            className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                                filterMode === 'daily'
                                    ? 'bg-white text-cyan-700 shadow-sm font-black'
                                    : 'text-slate-500 hover:text-slate-800'
                            }`}
                        >
                            <Calendar className="w-3.5 h-3.5" />
                            Diário (Datas)
                        </button>
                    </div>

                    {/* MODO 1: SELETOR MENSAL (Grade de Meses) */}
                    {filterMode === 'monthly' && (
                        <>
                            {/* Navegação de Ano */}
                            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                                <button
                                    type="button"
                                    onClick={() => setViewYear(prev => prev - 1)}
                                    className="p-1.5 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded-xl transition-all flex items-center gap-1 font-bold text-xs"
                                    title="Ano Anterior"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                    <span>{viewYear - 1}</span>
                                </button>
                                <span className="font-black text-slate-900 text-base tracking-tight">{viewYear}</span>
                                <button
                                    type="button"
                                    onClick={() => setViewYear(prev => prev + 1)}
                                    className="p-1.5 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded-xl transition-all flex items-center gap-1 font-bold text-xs"
                                    title="Próximo Ano"
                                >
                                    <span>{viewYear + 1}</span>
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Grade de Meses (Modelo 4x3) */}
                            <div className="grid grid-cols-3 gap-2">
                                {monthsShort.map((mShort, idx) => {
                                    const isSelected = selectedMonth === idx && selectedYear === viewYear;
                                    const isCurrentRealMonth = new Date().getMonth() === idx && new Date().getFullYear() === viewYear;

                                    return (
                                        <button
                                            key={idx}
                                            type="button"
                                            onClick={() => {
                                                onChange(idx, viewYear);
                                                setIsOpen(false);
                                            }}
                                            className={`
                                                py-2.5 px-2 text-xs font-bold rounded-xl transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer
                                                ${isSelected
                                                    ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/30 font-black scale-105'
                                                    : 'hover:bg-cyan-50 hover:text-cyan-600 text-slate-700 bg-slate-50/80 border border-slate-100'
                                                }
                                                ${isCurrentRealMonth && !isSelected ? 'ring-2 ring-cyan-500/40 border-cyan-200' : ''}
                                            `}
                                        >
                                            <span>{mShort}</span>
                                            <span className={`text-[8px] uppercase tracking-widest ${isSelected ? 'text-white/80' : 'text-slate-400'}`}>
                                                {months[idx].substring(0, 3)}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Rodapé com Botão Limpar no Modo Mensal */}
                            <div className="pt-3 mt-3 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={handleReset}
                                    className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                                >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    Limpar (Mês Atual)
                                </button>
                            </div>
                        </>
                    )}

                    {/* MODO 2: SELETOR DIÁRIO (Calendário Diário para Data Inicial e Final) */}
                    {filterMode === 'daily' && (
                        <div className="space-y-3">
                            {/* Painel com Data Inicial e Data Final */}
                            <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-200/60 text-xs">
                                <div
                                    onClick={() => setSelectingStep('start')}
                                    className={`p-2 rounded-xl cursor-pointer transition-all ${
                                        selectingStep === 'start'
                                            ? 'bg-white border border-cyan-500 shadow-sm text-cyan-900 font-bold'
                                            : 'bg-transparent text-slate-600'
                                    }`}
                                >
                                    <span className="block text-[8px] font-black uppercase text-slate-400">Data Inicial</span>
                                    <span className="font-mono text-[11px]">{tempStartDate ? formatDisplayDate(tempStartDate) : 'Clique no dia...'}</span>
                                </div>
                                <div
                                    onClick={() => setSelectingStep('end')}
                                    className={`p-2 rounded-xl cursor-pointer transition-all ${
                                        selectingStep === 'end'
                                            ? 'bg-white border border-cyan-500 shadow-sm text-cyan-900 font-bold'
                                            : 'bg-transparent text-slate-600'
                                    }`}
                                >
                                    <span className="block text-[8px] font-black uppercase text-slate-400">Data Final</span>
                                    <span className="font-mono text-[11px]">{tempEndDate ? formatDisplayDate(tempEndDate) : 'Clique no dia...'}</span>
                                </div>
                            </div>

                            {/* Navegação de Mês no Modelo Diário */}
                            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                <button
                                    type="button"
                                    onClick={handlePrevMonth}
                                    className="p-1.5 hover:bg-slate-100 text-slate-600 rounded-xl transition-all"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <span className="font-black text-slate-800 text-xs uppercase tracking-wider">
                                    {months[viewMonth]} {viewYear}
                                </span>
                                <button
                                    type="button"
                                    onClick={handleNextMonth}
                                    className="p-1.5 hover:bg-slate-100 text-slate-600 rounded-xl transition-all"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Dias da Semana */}
                            <div className="grid grid-cols-7 text-center text-[10px] font-black text-slate-400 uppercase">
                                {weekDaysShort.map((wd, i) => (
                                    <span key={i}>{wd}</span>
                                ))}
                            </div>

                            {/* Grade de Dias do Mês */}
                            <div className="grid grid-cols-7 gap-1 text-center text-xs">
                                {/* Espaços vazios antes do dia 1 */}
                                {Array.from({ length: getFirstDayIndex(viewMonth, viewYear) }).map((_, i) => (
                                    <div key={`empty-${i}`} />
                                ))}

                                {/* Dias do mês */}
                                {Array.from({ length: getDaysInMonth(viewMonth, viewYear) }).map((_, i) => {
                                    const day = i + 1;
                                    const mStr = String(viewMonth + 1).padStart(2, '0');
                                    const dStr = String(day).padStart(2, '0');
                                    const fullDateStr = `${viewYear}-${mStr}-${dStr}`;

                                    const isStart = tempStartDate === fullDateStr;
                                    const isEnd = tempEndDate === fullDateStr;
                                    const isInRange = tempStartDate && tempEndDate && fullDateStr > tempStartDate && fullDateStr < tempEndDate;

                                    return (
                                        <button
                                            key={day}
                                            type="button"
                                            onClick={() => handleDayClick(day)}
                                            className={`
                                                py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center
                                                ${isStart || isEnd
                                                    ? 'bg-cyan-600 text-white font-black shadow-md shadow-cyan-600/30 scale-105 rounded-xl'
                                                    : isInRange
                                                    ? 'bg-cyan-100 text-cyan-900 font-bold rounded-none'
                                                    : 'hover:bg-slate-100 text-slate-700'
                                                }
                                            `}
                                        >
                                            {day}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Botões de Ação no Modo Diário */}
                            <div className="pt-2 flex gap-2">
                                <button
                                    type="button"
                                    onClick={handleReset}
                                    className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer"
                                    title="Resetar para o Mês Atual no Modo Mensal"
                                >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    Limpar
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (tempStartDate && tempEndDate && onDateRangeChange) {
                                            onDateRangeChange(tempStartDate, tempEndDate);
                                        }
                                        setIsOpen(false);
                                    }}
                                    disabled={!tempStartDate || !tempEndDate}
                                    className="flex-[2] py-2 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                                >
                                    <Check className="w-3.5 h-3.5" />
                                    Aplicar Intervalo
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
