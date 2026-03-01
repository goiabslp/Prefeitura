import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, Check } from 'lucide-react';

interface Option {
    value: string | number;
    label: string;
}

interface ModernSelectProps {
    label?: string;
    value: string | number;
    onChange: (value: string) => void;
    options: Option[];
    placeholder?: string;
    icon?: React.ElementType;
    className?: string;
    searchable?: boolean;
}

export const ModernSelect: React.FC<ModernSelectProps> = ({
    label,
    value,
    onChange,
    options,
    placeholder = 'Selecione...',
    icon: Icon,
    className = '',
    searchable = false
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);

    const selectedOption = options.find(opt => String(opt.value) === String(value));

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredOptions = options.filter(opt =>
        opt.label.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className={`relative ${className}`} ref={dropdownRef}>
            {label && (
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 ml-1">
                    {label}
                </label>
            )}

            <div
                className={`
                    w-full flex items-center justify-between gap-3 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl
                    hover:bg-white hover:border-indigo-300 hover:shadow-md hover:shadow-indigo-500/10
                    transition-all duration-300 outline-none cursor-text
                    ${isOpen ? 'bg-white border-indigo-500 ring-4 ring-indigo-500/10' : ''}
                `}
                onClick={() => {
                    setIsOpen(true);
                }}
            >
                <div className="flex items-center gap-3 overflow-hidden flex-1">
                    {Icon && (
                        <Icon className={`w-4 h-4 shrink-0 ${isOpen ? 'text-indigo-500' : 'text-slate-400'}`} />
                    )}
                    {searchable ? (
                        <input
                            type="text"
                            value={isOpen ? searchTerm : (selectedOption ? selectedOption.label : '')}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                setIsOpen(true);
                            }}
                            onFocus={() => {
                                setIsOpen(true);
                                setSearchTerm(''); // Clear text to search when focused
                            }}
                            onBlur={() => {
                                // Delay clearing search so click event on option fires
                                setTimeout(() => {
                                    setSearchTerm('');
                                }, 200);
                            }}
                            placeholder={selectedOption && !isOpen ? selectedOption.label : placeholder}
                            className={`w-full bg-transparent text-sm font-bold outline-none truncate placeholder:text-slate-400 placeholder:font-bold ${isOpen || !selectedOption ? 'text-slate-700' : 'text-slate-700'}`}
                        />
                    ) : (
                        <span className={`text-sm font-bold truncate ${selectedOption ? 'text-slate-700' : 'text-slate-400'}`}>
                            {selectedOption ? selectedOption.label : placeholder}
                        </span>
                    )}
                </div>
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsOpen(!isOpen);
                    }}
                    className="p-1 -mr-1 outline-none shrink-0"
                >
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180 text-indigo-500' : ''}`} />
                </button>
            </div>

            {/* Dropdown */}
            <div className={`
                absolute top-[calc(100%+8px)] left-0 w-full bg-white rounded-xl border border-slate-100 shadow-xl shadow-indigo-500/10
                z-50 overflow-hidden transition-all duration-300 origin-top
                ${isOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'}
            `}>
                {/* Dropped duplicate internal search bar code here to adhere to direct search behavior. */}

                <div className="max-h-[240px] overflow-y-auto custom-scrollbar p-1.5 space-y-0.5">
                    {filteredOptions.length > 0 ? (
                        filteredOptions.map((option) => (
                            <button
                                key={option.value}
                                onClick={() => {
                                    onChange(String(option.value));
                                    setIsOpen(false);
                                    setSearchTerm('');
                                }}
                                className={`
                                    w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-bold transition-colors
                                    ${String(value) === String(option.value)
                                        ? 'bg-indigo-50 text-indigo-600'
                                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}
                                `}
                            >
                                <span className="text-left flex-1 truncate pr-2">{option.label}</span>
                                {String(value) === String(option.value) && (
                                    <Check className="w-3.5 h-3.5 shrink-0" />
                                )}
                            </button>
                        ))
                    ) : (
                        <div className="p-4 text-center">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                Nenhuma opção
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
