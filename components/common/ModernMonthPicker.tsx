import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react';

interface ModernMonthPickerProps {
    value: string; // format 'YYYY-MM'
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
}

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export const ModernMonthPicker: React.FC<ModernMonthPickerProps> = ({
    value,
    onChange,
    placeholder = 'Selecione o mês...',
    className = ''
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [viewYear, setViewYear] = useState(() => {
        if (value) {
            const [y] = value.split('-');
            return parseInt(y, 10);
        }
        return new Date().getFullYear();
    });
    const [isClosing, setIsClosing] = useState(false);

    // Sync viewYear when modal opens
    useEffect(() => {
        if (isOpen) {
            if (value) {
                const [y] = value.split('-');
                setViewYear(parseInt(y, 10));
            } else {
                setViewYear(new Date().getFullYear());
            }
            document.body.style.overflow = 'hidden';
            setIsClosing(false);
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, value]);

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(() => {
            setIsOpen(false);
            setIsClosing(false);
        }, 300);
    };

    const handleSelect = (monthIndex: number) => {
        const mm = String(monthIndex + 1).padStart(2, '0');
        onChange(`${viewYear}-${mm}`);
        handleClose();
    };

    const handleClear = () => {
        onChange('');
        handleClose();
    };

    const handleThisMonth = () => {
        const d = new Date();
        const yy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        onChange(`${yy}-${mm}`);
        handleClose();
    };

    const getDisplayValue = () => {
        if (!value) return '';
        const [y, m] = value.split('-');
        const monthIndex = parseInt(m, 10) - 1;
        const monthName = MONTHS[monthIndex];
        if (!monthName) return value;
        return `${monthName} de ${y}`;
    };

    const renderModal = () => {
        if (!isOpen && !isClosing) return null;

        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth();

        return createPortal(
            <div className={`fixed inset-0 z-[10001] flex items-center justify-center p-4 transition-all duration-300 ${isClosing ? 'opacity-0' : 'opacity-100'}`}>
                <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={handleClose} />

                <div className={`
                    relative w-full max-w-sm bg-white rounded-[2rem] shadow-2xl flex flex-col overflow-hidden border border-slate-100
                    transform transition-all duration-300 ease-out
                    ${isClosing ? 'scale-95 opacity-0 translate-y-4' : 'scale-100 opacity-100 translate-y-0'}
                `}>
                    {/* Header: Year Selector */}
                    <div className="px-6 py-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                        <button onClick={() => setViewYear(prev => prev - 1)} className="p-2 hover:bg-white rounded-xl text-slate-500 hover:text-indigo-600 transition-colors shadow-sm">
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <span className="text-xl font-black text-slate-800 tracking-tight">{viewYear}</span>
                        <button onClick={() => setViewYear(prev => prev + 1)} className="p-2 hover:bg-white rounded-xl text-slate-500 hover:text-indigo-600 transition-colors shadow-sm">
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Body: Months Grid */}
                    <div className="p-6 grid grid-cols-3 gap-3">
                        {MONTHS.map((month, index) => {
                            let isSelected = false;
                            if (value) {
                                const [y, m] = value.split('-');
                                if (parseInt(y, 10) === viewYear && parseInt(m, 10) - 1 === index) {
                                    isSelected = true;
                                }
                            }
                            const isCurrentMonth = viewYear === currentYear && index === currentMonth;

                            return (
                                <button
                                    key={month}
                                    onClick={() => handleSelect(index)}
                                    className={`
                                        py-3 rounded-xl font-bold uppercase tracking-widest text-xs transition-all duration-200
                                        ${isSelected 
                                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 scale-105' 
                                            : 'bg-slate-50 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600'
                                        }
                                        ${isCurrentMonth && !isSelected ? 'ring-2 ring-indigo-200' : ''}
                                    `}
                                >
                                    {month}
                                </button>
                            );
                        })}
                    </div>

                    {/* Footer: Actions */}
                    <div className="px-6 py-4 border-t border-slate-100 flex justify-between items-center bg-slate-50">
                        <button 
                            onClick={handleClear}
                            className="text-xs font-black uppercase tracking-widest text-slate-400 hover:text-rose-500 transition-colors py-2"
                        >
                            Limpar
                        </button>
                        <button 
                            onClick={handleThisMonth}
                            className="text-xs font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-700 transition-colors py-2"
                        >
                            Este mês
                        </button>
                    </div>
                </div>
            </div>,
            document.body
        );
    };

    return (
        <div className={`relative ${className}`}>
            <div
                className={`
                    w-full px-4 py-2 bg-slate-50/50 border rounded-xl text-sm transition-all flex items-center justify-between cursor-pointer group
                    ${isOpen ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-white' : 'border-slate-200 hover:border-indigo-300 hover:bg-white'}
                `}
                onClick={() => setIsOpen(true)}
            >
                <span className={`font-medium ${!value ? 'text-slate-400' : 'text-slate-700 capitalize'}`}>
                    {getDisplayValue() || placeholder}
                </span>
                <Calendar className={`w-4 h-4 transition-colors ${isOpen ? 'text-indigo-500' : 'text-slate-400 group-hover:text-indigo-500'}`} />
            </div>

            {renderModal()}
        </div>
    );
};
