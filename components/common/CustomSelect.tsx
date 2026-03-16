import React, { useState, useRef, useEffect, useMemo, useDeferredValue, memo } from 'react';
import { ChevronDown, Search, Check, X } from 'lucide-react';

export interface Option {
    value: string;
    label: string;
    subtext?: string;
    _sortKey?: string;
    key?: string;
}

interface CustomSelectProps {
    label?: string;
    value: string;
    onChange: (value: string) => void;
    options: Option[];
    placeholder?: string;
    icon?: React.ElementType;
    required?: boolean;
    className?: string;
    mobileThreshold?: number;
    disableMobileModal?: boolean;
    forceDirection?: 'up' | 'down';
    disabled?: boolean;
    isLoading?: boolean;
    onFocus?: () => void;
    showSearch?: boolean;
}

// Sub-component for options to enable granular memoization
const SelectItem = memo(({
    option,
    isSelected,
    onClick,
    className
}: {
    option: Option;
    isSelected: boolean;
    onClick: (val: string) => void;
    className?: string;
}) => {
    return (
        <button
            type="button"
            onClick={(e) => {
                e.stopPropagation();
                onClick(option.value);
            }}
            className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all flex items-start wide:items-center justify-between group/item gap-2 ${className || ''}
                ${isSelected
                    ? 'bg-cyan-50 text-cyan-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
        >
            <div className="flex flex-col desktop:flex-row desktop:items-center gap-1 desktop:gap-2 flex-1 min-w-0">
                <span className="font-semibold truncate">{option.label}</span>
                {option.subtext && (
                    <span className={`text-xs desktop:text-sm truncate ${isSelected ? 'text-cyan-600/70' : 'text-slate-400'}`}>
                        {option.subtext}
                    </span>
                )}
            </div>
            {isSelected && <Check className="w-4 h-4 text-cyan-600 flex-shrink-0" />}
        </button>
    );
});

SelectItem.displayName = 'SelectItem';

export const CustomSelect: React.FC<CustomSelectProps> = memo(({
    label,
    value,
    onChange,
    options,
    placeholder = 'Selecione...',
    icon: Icon,
    required,
    className,
    mobileThreshold = 700,
    disableMobileModal = false,
    forceDirection,
    disabled = false,
    isLoading = false,
    onFocus,
    showSearch = true
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < mobileThreshold);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, [mobileThreshold]);

    const selectedOption = useMemo(() => options.find(opt => opt.value === value), [options, value]);
    const deferredSearchTerm = useDeferredValue(searchTerm);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (isMobile) return; // Don't close on outside click for mobile modal (use heavy overlay instead)
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            // Lock body scroll for mobile modal
            if (isMobile) {
                document.body.style.overflow = 'hidden';
            }
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.body.style.overflow = '';
        };
    }, [isOpen, isMobile]);

    const [dropdownStyle, setDropdownStyle] = useState<{ position: 'down' | 'up', maxHeight: number }>({ position: 'down', maxHeight: 300 });

    // Use layout effect to measure DOM before paint avoiding flicker
    const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? React.useLayoutEffect : React.useEffect;

    useIsomorphicLayoutEffect(() => {
        if (!isOpen || (isMobile && !disableMobileModal)) return;

        const updatePosition = () => {
            if (!containerRef.current) return;

            if (forceDirection) {
                setDropdownStyle({ position: forceDirection, maxHeight: 300 });
                return;
            }

            const rect = containerRef.current.getBoundingClientRect();
            const viewportHeight = window.innerHeight;

            // Margins
            const MARGIN = 10;

            // Available space
            const spaceBelow = viewportHeight - rect.bottom - MARGIN;
            const spaceAbove = rect.top - MARGIN;

            // Logic:
            // 1. Prefer DOWN if it fits (needs ~200px or at least more than 150)
            // 2. Else if UP has significantly more space, flip UP.

            const MIN_HEIGHT = 120; // Minimum usable height
            const DESIRED_HEIGHT = 300; // Target max height

            let newPos: 'down' | 'up' = 'down';
            let maxH = DESIRED_HEIGHT;

            // If enough space below, usage down (default limits)
            if (spaceBelow >= DESIRED_HEIGHT) {
                newPos = 'down';
                maxH = DESIRED_HEIGHT;
            }
            // If not enough below, check above
            else if (spaceAbove > spaceBelow && spaceAbove > MIN_HEIGHT) {
                newPos = 'up';
                // Use all available space up to DESIRED
                maxH = Math.min(spaceAbove, DESIRED_HEIGHT);
            }
            // If neither is great, pick the largest one
            else {
                if (spaceBelow >= spaceAbove) {
                    newPos = 'down';
                    maxH = Math.max(spaceBelow, MIN_HEIGHT);
                } else {
                    newPos = 'up';
                    maxH = Math.max(spaceAbove, MIN_HEIGHT);
                }
            }

            setDropdownStyle({ position: newPos, maxHeight: maxH });
        };

        updatePosition();
        // Optional: update on scroll/resize could be expensive, sticking to open-time calc + window resize
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition, true); // Capture scroll to reposition

        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [isOpen, isMobile, disableMobileModal, forceDirection]);

    useEffect(() => {
        if (isOpen && showSearch && searchInputRef.current) {
            // Focus search input after a short delay to allow transition
            setTimeout(() => {
                searchInputRef.current?.focus();
            }, 50);
        }
        if (!isOpen) {
            setSearchTerm('');
        }
    }, [isOpen, isMobile]);

    const filteredOptions = useMemo(() => {
        if (!deferredSearchTerm) return options;
        const lowerSearch = deferredSearchTerm.toLowerCase();
        return options.filter(opt =>
            opt.label.toLowerCase().includes(lowerSearch) ||
            (opt.subtext && opt.subtext.toLowerCase().includes(lowerSearch))
        );
    }, [options, deferredSearchTerm]);

    const displayOptions = useMemo(() => filteredOptions.slice(0, 50), [filteredOptions]);

    const labelClass = "block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 ml-1";
    const inputClass = "w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-900 focus:bg-white focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 outline-none transition-all flex items-center justify-between cursor-pointer group-hover:bg-white group-hover:border-cyan-200";

    const renderMobileModal = () => (
        <div className="fixed inset-0 z-[100] flex items-end wide:items-center justify-center">
            {/* Backdrop Blur */}
            <div
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
                onClick={() => setIsOpen(false)}
            />

            {/* Modal Content */}
            <div className="relative w-full wide:w-[500px] bg-white rounded-t-2xl wide:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in slide-in-from-bottom duration-300">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
                    <h3 className="font-bold text-slate-700">{label || placeholder}</h3>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="p-2 -mr-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Search */}
                {showSearch && (
                    <div className="p-3 border-b border-slate-50">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                ref={searchInputRef}
                                type="text"
                                className="w-full pl-9 pr-4 py-3 text-sm rounded-xl border border-slate-200 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 outline-none bg-slate-50 focus:bg-white transition-all placeholder:text-slate-400 font-medium"
                                placeholder="Buscar opção..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                )}

                {/* List */}
                <div className="overflow-y-auto p-2 custom-scrollbar flex-1 min-h-0">
                    {displayOptions.length > 0 ? (
                        <div className="space-y-1">
                            {displayOptions.map((option) => (
                                <SelectItem
                                    key={option.key || option.value}
                                    option={option}
                                    isSelected={value === option.value}
                                    onClick={(val) => {
                                        onChange(val);
                                        setIsOpen(false);
                                    }}
                                    className="text-base py-4 border-b border-slate-50 last:border-0"
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
                            <Search className="w-8 h-8 opacity-20" />
                            <span className="text-sm font-medium">Nenhum resultado encontrado</span>
                        </div>
                    )}
                    {filteredOptions.length > 50 && (
                        <div className="px-4 py-3 text-xs text-center text-slate-400 border-t border-slate-50 mt-2 font-medium">
                            Mostrando 50 de {filteredOptions.length} opções
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            {label && <label className={labelClass}>{label}</label>}

            <div
                className={`group relative ${(disabled || isLoading) ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}
                onClick={() => (!disabled && !isLoading) && setIsOpen(!isOpen)}
                onFocus={onFocus}
                tabIndex={disabled || isLoading ? -1 : 0}
            >
                <div className={`${inputClass} ${isOpen ? 'border-cyan-500 ring-2 ring-cyan-500/20 bg-white' : ''} ${(disabled || isLoading) ? 'bg-slate-100 hover:border-slate-200 pointer-events-none' : ''}`}>
                    <span className={`block truncate ${!selectedOption ? 'text-slate-400' : 'font-medium'} ${disabled || isLoading ? 'text-slate-500' : ''}`}>
                        {isLoading ? (
                            <span className="flex items-center gap-2">
                                <div className="w-3.5 h-3.5 border-2 border-slate-200 border-t-cyan-500 rounded-full animate-spin"></div>
                                Carregando...
                            </span>
                        ) : (
                            selectedOption ? selectedOption.label : placeholder
                        )}
                    </span>

                    <div className="flex items-center gap-2 text-slate-400">
                        {Icon && <Icon className={`w-5 h-5 transition-colors ${isOpen || selectedOption ? 'text-cyan-500' : 'group-hover:text-cyan-500'} ${disabled ? 'text-slate-300' : ''}`} />}
                        <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180 text-cyan-500' : ''} ${disabled ? 'text-slate-200' : ''}`} />
                    </div>
                </div>

                {isOpen && (
                    (isMobile && !disableMobileModal) ? renderMobileModal() : (
                        <div className={`absolute z-50 left-0 right-0 bg-white rounded-xl border border-slate-100 shadow-xl shadow-slate-200/50 overflow-hidden animate-in fade-in duration-200 ${dropdownStyle.position === 'up'
                            ? 'bottom-full mb-2 slide-in-from-bottom-2'
                            : 'mt-2 slide-in-from-top-2'
                            }`}>
                            {showSearch && (
                                <div className="p-2 border-b border-slate-50 bg-slate-50/50">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <input
                                            ref={searchInputRef}
                                            type="text"
                                            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-200 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/20 outline-none bg-white placeholder:text-slate-300"
                                            placeholder="Buscar..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    </div>
                                </div>
                            )}

                            <div
                                className="overflow-y-auto custom-scrollbar p-1"
                                style={{ maxHeight: `${dropdownStyle.maxHeight}px` }}
                            >
                                {displayOptions.length > 0 ? (
                                    displayOptions.map((option) => (
                                        <SelectItem
                                            key={option.key || option.value}
                                            option={option}
                                            isSelected={value === option.value}
                                            onClick={(val) => {
                                                onChange(val);
                                                setIsOpen(false);
                                            }}
                                        />
                                    ))
                                ) : (
                                    <div className="px-4 py-8 text-center text-slate-400 text-sm">
                                        Nenhum resultado encontrado
                                    </div>
                                )}
                                {filteredOptions.length > 50 && (
                                    <div className="px-4 py-2 text-[10px] text-center text-slate-400 border-t border-slate-50">
                                        Refine sua busca para ver mais resultados ({filteredOptions.length} total)
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                )}
            </div>

            {required && !value && !isOpen && (
                <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-400 opacity-50" />
            )}
        </div>
    );
});

CustomSelect.displayName = 'CustomSelect';
