import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { User, ConsultaPaciente, ConsultaAgendamento, ConsultaProcedimento, AppState, ConsultaVaga } from '../../types';
import { ArrowLeft, Search, Filter, Calendar, CheckCircle2, XCircle, Trash2, Loader2, Sparkles, Clock, FileDown, UserX, Repeat, X, Activity, Check, Edit2, ChevronDown, ChevronLeft, ChevronRight, User as UserIcon, BarChart3, Users } from 'lucide-react';
import * as db from '../../services/consultasService';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { ConsultaPdfGenerator } from './ConsultaPdfGenerator';
import { ConsultasReportPdfGenerator } from './ConsultasReportPdfGenerator';

const formatPatientName = (patient?: ConsultaPaciente | null) => {
    if (!patient) return '';
    return patient.nickname ? `${patient.name} (${patient.nickname})` : patient.name;
};

// Componente de Select Customizado Moderno com React Portal (frente de todos os elementos)
interface OptionItem {
    value: string;
    label: string;
}

interface ModernDropdownProps {
    value: string;
    options: OptionItem[];
    onChange: (val: string) => void;
    placeholder: string;
    icon?: React.ReactNode;
    minWidth?: string;
}

const ModernDropdown: React.FC<ModernDropdownProps> = ({
    value,
    options,
    onChange,
    placeholder,
    icon,
    minWidth = 'w-44 sm:w-52'
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

    const selectedOption = options.find(o => o.value === value);

    const updateCoords = () => {
        if (buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            let leftPos = rect.left;
            if (leftPos + 280 > window.innerWidth) {
                leftPos = Math.max(10, window.innerWidth - 290);
            }
            setCoords({
                top: rect.bottom + 6,
                left: Math.max(10, leftPos)
            });
        }
    };

    useEffect(() => {
        if (isOpen) {
            updateCoords();
            window.addEventListener('resize', updateCoords);
            window.addEventListener('scroll', updateCoords, true);
        }
        return () => {
            window.removeEventListener('resize', updateCoords);
            window.removeEventListener('scroll', updateCoords, true);
        };
    }, [isOpen]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                buttonRef.current && !buttonRef.current.contains(event.target as Node) &&
                dropdownRef.current && !dropdownRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className={`relative ${minWidth} shrink-0`}>
            <button
                ref={buttonRef}
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full bg-slate-50/90 hover:bg-slate-100/90 border transition-all rounded-2xl px-3 py-1.5 text-xs font-extrabold text-slate-800 flex items-center justify-between gap-1.5 shadow-2xs cursor-pointer ${
                    isOpen ? 'border-sky-500 ring-4 ring-sky-500/10 bg-white text-sky-700' : 'border-slate-200/90'
                }`}
            >
                <div className="flex items-center gap-1.5 min-w-0 truncate">
                    {icon && <span className="text-slate-400 shrink-0">{icon}</span>}
                    <span className="truncate uppercase font-extrabold text-slate-800">
                        {selectedOption && selectedOption.value !== '' ? selectedOption.label : placeholder}
                    </span>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${isOpen ? 'rotate-180 text-sky-600' : ''}`} />
            </button>

            {isOpen && createPortal(
                <div
                    ref={dropdownRef}
                    style={{
                        position: 'fixed',
                        top: `${coords.top}px`,
                        left: `${coords.left}px`,
                        zIndex: 99999
                    }}
                    className="min-w-[260px] max-w-[420px] w-max max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200/90 p-1.5 animate-in fade-in zoom-in-95 duration-150 max-h-72 overflow-y-auto custom-scrollbar"
                >
                    {options.map((opt) => {
                        const isSelected = opt.value === value;
                        return (
                            <button
                                key={opt.value || 'all'}
                                type="button"
                                onClick={() => {
                                    onChange(opt.value);
                                    setIsOpen(false);
                                }}
                                className={`w-full text-left px-3 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center justify-between gap-3 uppercase cursor-pointer ${
                                    isSelected 
                                    ? 'bg-sky-50 text-sky-700 font-black' 
                                    : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                                }`}
                            >
                                <span className="whitespace-normal leading-tight">{opt.label}</span>
                                {isSelected && <Check className="w-3.5 h-3.5 text-sky-600 shrink-0" />}
                            </button>
                        );
                    })}
                </div>,
                document.body
            )}
        </div>
    );
};

// Componente de Calendário Customizado Moderno com React Portal
interface ModernDatePickerProps {
    value: string;
    onChange: (val: string) => void;
    placeholder?: string;
}

const ModernDatePicker: React.FC<ModernDatePickerProps> = ({
    value,
    onChange,
    placeholder = 'Filtrar Data'
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const calendarRef = useRef<HTMLDivElement>(null);
    const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

    const initialDate = value ? new Date(value + 'T00:00:00') : new Date();
    const [viewDate, setViewDate] = useState({ year: initialDate.getFullYear(), month: initialDate.getMonth() });

    const updateCoords = () => {
        if (buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            let leftPos = rect.left;
            if (leftPos + 260 > window.innerWidth) {
                leftPos = Math.max(10, window.innerWidth - 270);
            }
            setCoords({
                top: rect.bottom + 6,
                left: Math.max(10, leftPos)
            });
        }
    };

    useEffect(() => {
        if (isOpen) {
            updateCoords();
            window.addEventListener('resize', updateCoords);
            window.addEventListener('scroll', updateCoords, true);
        }
        return () => {
            window.removeEventListener('resize', updateCoords);
            window.removeEventListener('scroll', updateCoords, true);
        };
    }, [isOpen]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                buttonRef.current && !buttonRef.current.contains(event.target as Node) &&
                calendarRef.current && !calendarRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const weekDays = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

    const handlePrevMonth = (e: React.MouseEvent) => {
        e.stopPropagation();
        setViewDate(prev => {
            if (prev.month === 0) return { year: prev.year - 1, month: 11 };
            return { ...prev, month: prev.month - 1 };
        });
    };

    const handleNextMonth = (e: React.MouseEvent) => {
        e.stopPropagation();
        setViewDate(prev => {
            if (prev.month === 11) return { year: prev.year + 1, month: 0 };
            return { ...prev, month: prev.month + 1 };
        });
    };

    const daysInMonth = new Date(viewDate.year, viewDate.month + 1, 0).getDate();
    const firstDayIndex = new Date(viewDate.year, viewDate.month, 1).getDay();

    const formattedDisplay = value 
        ? new Date(value + 'T00:00:00').toLocaleDateString('pt-BR') 
        : placeholder;

    return (
        <div className="relative w-32 sm:w-36 shrink-0">
            <button
                ref={buttonRef}
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full bg-slate-50/90 hover:bg-slate-100/90 border transition-all rounded-2xl px-3 py-1.5 text-xs font-extrabold text-slate-800 flex items-center justify-between gap-1.5 shadow-2xs cursor-pointer ${
                    isOpen ? 'border-sky-500 ring-4 ring-sky-500/10 bg-white text-sky-700' : 'border-slate-200/90'
                }`}
            >
                <div className="flex items-center gap-1.5 min-w-0 truncate">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate uppercase font-extrabold text-slate-800">{formattedDisplay}</span>
                </div>
                {value ? (
                    <span
                        onClick={(e) => {
                            e.stopPropagation();
                            onChange('');
                        }}
                        className="text-slate-400 hover:text-rose-600 p-0.5 rounded-full hover:bg-slate-200/60 transition-colors"
                        title="Limpar Data"
                    >
                        <X className="w-3 h-3" />
                    </span>
                ) : (
                    <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${isOpen ? 'rotate-180 text-sky-600' : ''}`} />
                )}
            </button>

            {isOpen && createPortal(
                <div
                    ref={calendarRef}
                    style={{
                        position: 'fixed',
                        top: `${coords.top}px`,
                        left: `${coords.left}px`,
                        zIndex: 99999
                    }}
                    className="bg-white rounded-2xl shadow-2xl border border-slate-200/90 p-3 animate-in fade-in zoom-in-95 duration-150 w-64"
                >
                    {/* Header: Month & Year Nav */}
                    <div className="flex items-center justify-between mb-2">
                        <button
                            type="button"
                            onClick={handlePrevMonth}
                            className="p-1 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="text-xs font-black text-slate-900 uppercase">
                            {months[viewDate.month]} {viewDate.year}
                        </span>
                        <button
                            type="button"
                            onClick={handleNextMonth}
                            className="p-1 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Weekday Labels */}
                    <div className="grid grid-cols-7 gap-1 text-center mb-1">
                        {weekDays.map((wd, i) => (
                            <span key={i} className="text-[10px] font-black text-slate-400">
                                {wd}
                            </span>
                        ))}
                    </div>

                    {/* Calendar Days Grid */}
                    <div className="grid grid-cols-7 gap-1 text-center">
                        {Array.from({ length: firstDayIndex }).map((_, i) => (
                            <div key={`empty-${i}`} />
                        ))}
                        {Array.from({ length: daysInMonth }).map((_, i) => {
                            const dayNum = i + 1;
                            const monthStr = String(viewDate.month + 1).padStart(2, '0');
                            const dayStr = String(dayNum).padStart(2, '0');
                            const dateIso = `${viewDate.year}-${monthStr}-${dayStr}`;
                            const isSelected = value === dateIso;

                            return (
                                <button
                                    key={dateIso}
                                    type="button"
                                    onClick={() => {
                                        onChange(dateIso);
                                        setIsOpen(false);
                                    }}
                                    className={`py-1 text-xs font-extrabold rounded-xl transition-all cursor-pointer ${
                                        isSelected
                                        ? 'bg-sky-600 text-white shadow-sm font-black'
                                        : 'hover:bg-sky-50 hover:text-sky-700 text-slate-700'
                                    }`}
                                >
                                    {dayNum}
                                </button>
                            );
                        })}
                    </div>

                    {/* Quick Footer */}
                    <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-slate-100 text-[10px] font-black uppercase">
                        <button
                            type="button"
                            onClick={() => {
                                onChange('');
                                setIsOpen(false);
                            }}
                            className="text-slate-400 hover:text-rose-600 cursor-pointer"
                        >
                            Limpar
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                const todayStr = new Date().toISOString().split('T')[0];
                                onChange(todayStr);
                                setIsOpen(false);
                            }}
                            className="text-sky-600 hover:text-sky-700 cursor-pointer"
                        >
                            Hoje
                        </button>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

interface AcompanharScreenProps {
    currentUser: User;
    onBack: () => void;
    onNavigate?: (view: string) => void;
    subView?: string;
    appState: AppState;
}

export const AcompanharScreen: React.FC<AcompanharScreenProps> = ({
    currentUser,
    onBack,
    onNavigate,
    subView,
    appState
}) => {
    // Booking list and state
    const [bookings, setBookings] = useState<ConsultaAgendamento[]>([]);
    const [allBookings, setAllBookings] = useState<ConsultaAgendamento[]>([]);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [reportType, setReportType] = useState<'simplificado' | 'completo'>('simplificado');
    const [isPrintingReport, setIsPrintingReport] = useState(false);
    const [queuePositions, setQueuePositions] = useState<Record<string, number>>({});
    const [procedures, setProcedures] = useState<ConsultaProcedimento[]>([]);
    const [loading, setLoading] = useState(true);
    const [printingBooking, setPrintingBooking] = useState<ConsultaAgendamento | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);

    // States for Vagas Reservadas Pendentes
    const [reservedBookings, setReservedBookings] = useState<ConsultaAgendamento[]>([]);
    const [confirmedReservedBookings, setConfirmedReservedBookings] = useState<Record<string, ConsultaAgendamento>>({});
    const [reservedDates, setReservedDates] = useState<Record<string, string>>({});
    const [reservedTimes, setReservedTimes] = useState<Record<string, string>>({});
    const [reservedProceduresVagas, setReservedProceduresVagas] = useState<Record<string, ConsultaVaga[]>>({});
    const [reservedProceduresBookings, setReservedProceduresBookings] = useState<Record<string, ConsultaAgendamento[]>>({});

    // Filters
    const [globalSearch, setGlobalSearch] = useState('');
    const [filterDate, setFilterDate] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [isMobile, setIsMobile] = useState<boolean>(() => typeof window !== 'undefined' ? window.innerWidth < 768 : false);
    const [expandedBookingId, setExpandedBookingId] = useState<string | null>(null);

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 768);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Operations states
    const [operatingId, setOperatingId] = useState<string | null>(null);
    const [retornoBooking, setRetornoBooking] = useState<ConsultaAgendamento | null>(null);
    const [retornoDate, setRetornoDate] = useState('');
    const [isRetornoModalOpen, setIsRetornoModalOpen] = useState(false);

    // Cancel modal states
    const [gestorUserIds, setGestorUserIds] = useState<string[]>([]);
    const [cancelTarget, setCancelTarget] = useState<ConsultaAgendamento | null>(null);
    const [cancelReason, setCancelReason] = useState('');
    const [cancelError, setCancelError] = useState('');
    const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);

    // Edit modal states
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editTarget, setEditTarget] = useState<ConsultaAgendamento | null>(null);
    const [editPatientName, setEditPatientName] = useState('');
    const [editPatientCpf, setEditPatientCpf] = useState('');
    const [editPatientPhone, setEditPatientPhone] = useState('');
    const [editPatientNeighborhood, setEditPatientNeighborhood] = useState('');
    const [editPatientStreet, setEditPatientStreet] = useState('');
    const [editPatientSusNumber, setEditPatientSusNumber] = useState('');
    const [editProcedimentoId, setEditProcedimentoId] = useState('');
    const [editAppointmentDate, setEditAppointmentDate] = useState('');
    const [editAppointmentTime, setEditAppointmentTime] = useState('');
    const [editSolicitationDate, setEditSolicitationDate] = useState('');
    const [editPriority, setEditPriority] = useState<'Normal' | 'Urgência'>('Normal');
    const [editIsRetorno, setEditIsRetorno] = useState(false);
    const [editStatus, setEditStatus] = useState<ConsultaAgendamento['status']>('Solicitado');
    const [editQuantity, setEditQuantity] = useState(1);
    const [editError, setEditError] = useState('');
    const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

    const matchTime = (t1: string | undefined, t2: string) => {
        if (!t1 || !t2) return false;
        return t1.substring(0, 5) === t2.substring(0, 5);
    };

    const getSlotAssignmentsForProcedure = (vagasList: ConsultaVaga[], bookingsList: ConsultaAgendamento[]) => {
        const assignments = new Map<string, ConsultaAgendamento>();
        const slotsByDate: Record<string, ConsultaVaga[]> = {};
        vagasList.forEach(v => {
            if (!slotsByDate[v.data]) {
                slotsByDate[v.data] = [];
            }
            slotsByDate[v.data].push(v);
        });

        const bookingsByDate: Record<string, ConsultaAgendamento[]> = {};
        bookingsList.forEach(b => {
            if (b.status === 'Cancelado' || b.status === 'Não Realizado' || b.status === 'Fila de espera' || b.status === 'Aguardando Data' || !b.appointment_date) return;
            if (!bookingsByDate[b.appointment_date]) {
                bookingsByDate[b.appointment_date] = [];
            }
            bookingsByDate[b.appointment_date].push(b);
        });

        Object.keys(slotsByDate).forEach(dateStr => {
            const slots = slotsByDate[dateStr];
            const bookings = bookingsByDate[dateStr] || [];
            const unmatchedBookings = [...bookings];
            const matchedBookingIds = new Set<string>();

            slots.forEach(slot => {
                const exactMatch = bookings.find(b => 
                    b.appointment_time && 
                    matchTime(b.appointment_time, slot.hora) &&
                    !matchedBookingIds.has(b.id)
                );
                if (exactMatch) {
                    assignments.set(slot.id, exactMatch);
                    matchedBookingIds.add(exactMatch.id);
                    const idx = unmatchedBookings.findIndex(b => b.id === exactMatch.id);
                    if (idx > -1) {
                        unmatchedBookings.splice(idx, 1);
                    }
                }
            });

            slots.forEach(slot => {
                if (!assignments.has(slot.id) && unmatchedBookings.length > 0) {
                    const nextBooking = unmatchedBookings.shift()!;
                    assignments.set(slot.id, nextBooking);
                }
            });
        });

        return assignments;
    };

    const fetchReservedBookings = async () => {
        try {
            const data = await db.getAgendamentos({ status: 'Aguardando Data' });
            setReservedBookings(data);
            
            if (data.length > 0) {
                if (window.location.pathname !== '/Consultas/DefinirAgenda') {
                    window.history.replaceState({}, '', '/Consultas/DefinirAgenda');
                }
                const procIds = Array.from(new Set(data.map(b => b.procedimento_id)));
                const vagasMap: Record<string, ConsultaVaga[]> = {};
                const bookingsMap: Record<string, ConsultaAgendamento[]> = {};
                
                await Promise.all(procIds.map(async (procId) => {
                    try {
                        const [vagasData, bookingsData] = await Promise.all([
                            db.getVagas(procId),
                            db.getAgendamentos({ procedimentoId: procId })
                        ]);
                        vagasMap[procId] = vagasData;
                        bookingsMap[procId] = bookingsData;
                    } catch (e) {
                        console.error("Error loading reserved config for proc " + procId, e);
                    }
                }));
                
                setReservedProceduresVagas(vagasMap);
                setReservedProceduresBookings(bookingsMap);
            }
        } catch (err) {
            console.error('Error fetching reserved bookings in AcompanharScreen:', err);
        }
    };

    const handleConfirmReservedDateAndTime = async (id: string, dateParam?: string, timeParam?: string) => {
        const date = dateParam || reservedDates[id];
        const time = timeParam || reservedTimes[id];
        if (!date || !time) {
            alert('Por favor, preencha a data e a hora.');
            return;
        }
        setLoading(true);
        try {
            const result = await db.confirmarDataAgendamento(id, date, time);
            if (result) {
                setConfirmedReservedBookings(prev => ({ ...prev, [id]: result }));
            }
        } catch (err: any) {
            alert(err.message || 'Erro ao confirmar data e hora.');
        } finally {
            setLoading(false);
        }
    };

    const handleCloseReservedModal = () => {
        setConfirmedReservedBookings({});
        setReservedDates({});
        setReservedTimes({});
        if (typeof window !== 'undefined' && window.location.pathname === '/Consultas/DefinirAgenda') {
            window.history.replaceState({}, '', '/Consultas/Acompanhar');
        }
        if (onNavigate) {
            onNavigate('consultas:acompanhar');
        }
        fetchReservedBookings();
    };

    useEffect(() => {
        fetchReservedBookings();
    }, []);

    useEffect(() => {
        const fetchGestores = async () => {
            try {
                const gestores = await db.getConsultasGestores();
                setGestorUserIds(gestores);
            } catch (err) {
                console.error('Error fetching gestores in AcompanharScreen:', err);
            }
        };
        fetchGestores();
    }, []);

    // Permissions check: apenas gestores e administradores conseguem excluir!
    const isAdmin = currentUser.role === 'admin';
    const isGestor = gestorUserIds.includes(currentUser.id);
    const canCancel = currentUser.permissions?.includes('parent_consultas_novo_agendamento') || isAdmin || isGestor;
    const canComplete = currentUser.permissions?.includes('parent_consultas_novo_agendamento') || isAdmin || isGestor;
    const canEdit = currentUser.permissions?.includes('parent_consultas_novo_agendamento') || isAdmin || isGestor;
    const canDelete = isAdmin || isGestor;

    const formatDateBr = (d: string) => {
        if (!d) return '';
        const parts = d.split('-');
        if (parts.length !== 3) return d;
        const [year, month, day] = parts;
        return `${day}/${month}/${year}`;
    };

    // Groupings for complete report
    const reportDataCompleto = useMemo(() => {
        const groups: Record<string, Record<string, Record<string, ConsultaAgendamento[]>>> = {};
        allBookings.forEach(b => {
            const type = b.procedimento?.type || 'OUTRO';
            const priority = b.priority === 'Urgência' ? 'Urgência' : b.is_retorno ? 'Retorno' : 'Normal';
            const status = b.status || 'Solicitado';
            
            if (!groups[type]) groups[type] = {};
            if (!groups[type][priority]) groups[type][priority] = {};
            if (!groups[type][priority][status]) groups[type][priority][status] = [];
            
            groups[type][priority][status].push(b);
        });
        return groups;
    }, [allBookings]);

    // Groupings for waitlist report
    const reportDataFila = useMemo(() => {
        const groups: Record<string, ConsultaAgendamento[]> = {};
        const waitlist = allBookings.filter(b => b.status === 'Fila de espera');
        
        waitlist.forEach(b => {
            const name = b.procedimento?.name || 'PROCEDIMENTO INDEFINIDO';
            if (!groups[name]) groups[name] = [];
            groups[name].push(b);
        });

        // Sort each group by position
        Object.keys(groups).forEach(name => {
            groups[name].sort((a, b) => {
                const posA = queuePositions[a.id] || 9999;
                const posB = queuePositions[b.id] || 9999;
                return posA - posB;
            });
        });

        return groups;
    }, [allBookings, queuePositions]);

    // General stats
    const statsCompleto = useMemo(() => {
        const total = allBookings.length;
        const agendados = allBookings.filter(b => b.status === 'Agendado').length;
        const fila = allBookings.filter(b => b.status === 'Fila de espera').length;
        const realizados = allBookings.filter(b => b.status === 'Realizado').length;
        const solicitados = allBookings.filter(b => b.status === 'Solicitado').length;
        return { total, agendados, fila, realizados, solicitados };
    }, [allBookings]);

    const statsFila = useMemo(() => {
        const total = allBookings.filter(b => b.status === 'Fila de espera').length;
        const proceduresCount = Object.keys(reportDataFila).length;
        return { total, proceduresCount };
    }, [allBookings, reportDataFila]);

    // Load data
    const loadData = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const [allBookingData, procData] = await Promise.all([
                db.getAgendamentos(), // Fetch all unfiltered for correct queue calculation
                db.getProcedimentos()
            ]);
            setProcedures(procData);
            setAllBookings(allBookingData);

            // Group all waitlisted bookings by procedure_id to calculate position
            const waitlistByProc: Record<string, ConsultaAgendamento[]> = {};
            const allWaitlist = allBookingData.filter(b => b.status === 'Fila de espera');
            
            allWaitlist.forEach(b => {
                if (!waitlistByProc[b.procedimento_id]) {
                    waitlistByProc[b.procedimento_id] = [];
                }
                waitlistByProc[b.procedimento_id].push(b);
            });

            const positionMap: Record<string, number> = {};
            const getPriorityWeight = (booking: ConsultaAgendamento) => {
                if (booking.priority === 'Urgência') return 0;
                if (booking.is_retorno) return 1;
                return 2;
            };

            Object.keys(waitlistByProc).forEach(procId => {
                const list = waitlistByProc[procId];
                list.sort((a, b) => {
                    const weightA = getPriorityWeight(a);
                    const weightB = getPriorityWeight(b);
                    if (weightA !== weightB) {
                        return weightA - weightB;
                    }
                    const dateA = a.solicitation_date ? new Date(a.solicitation_date + 'T00:00:00').getTime() : (a.created_at ? new Date(a.created_at).getTime() : 0);
                    const dateB = b.solicitation_date ? new Date(b.solicitation_date + 'T00:00:00').getTime() : (b.created_at ? new Date(b.created_at).getTime() : 0);
                    if (dateA !== dateB) {
                        return dateA - dateB;
                    }
                    const cA = a.created_at ? new Date(a.created_at).getTime() : 0;
                    const cB = b.created_at ? new Date(b.created_at).getTime() : 0;
                    return cA - cB;
                });

                list.forEach((b, index) => {
                    positionMap[b.id] = index + 1;
                });
            });

            setQueuePositions(positionMap);

            // Apply filters in-memory (Apenas no Mobile: não exibe resultados antes da pesquisa se não houver filtro)
            if (isMobile && !globalSearch.trim() && !filterDate && !filterStatus) {
                setBookings([]);
                setLoading(false);
                return;
            }

            let filtered = allBookingData;
            if (globalSearch.trim()) {
                const rawSearch = globalSearch.toLowerCase().trim();
                const cleanNumbers = rawSearch.replace(/\D/g, '');

                filtered = filtered.filter(a => {
                    const nameMatch = a.paciente?.name ? a.paciente.name.toLowerCase().includes(rawSearch) : false;
                    const nicknameMatch = a.paciente?.nickname ? a.paciente.nickname.toLowerCase().includes(rawSearch) : false;
                    
                    const cpfClean = a.paciente?.cpf ? a.paciente.cpf.replace(/\D/g, '') : '';
                    const cpfMatch = cleanNumbers.length > 0 && cpfClean.includes(cleanNumbers);
                    
                    const susClean = a.paciente?.sus_number ? a.paciente.sus_number.replace(/\D/g, '') : '';
                    const susMatch = cleanNumbers.length > 0 && susClean.includes(cleanNumbers);
                    
                    const procNameMatch = a.procedimento?.name ? a.procedimento.name.toLowerCase().includes(rawSearch) : false;
                    const procCodeMatch = a.procedimento?.code ? a.procedimento.code.toLowerCase().includes(rawSearch) : false;

                    return nameMatch || nicknameMatch || cpfMatch || susMatch || procNameMatch || procCodeMatch;
                });
            }
            if (filterDate) {
                filtered = filtered.filter(a => a.appointment_date === filterDate);
            }
            if (filterStatus) {
                filtered = filtered.filter(a => a.status === filterStatus);
            }

            setBookings(filtered);
        } catch (error) {
            console.error('Error loading agendamentos:', error);
        } finally {
            setLoading(false);
        }
    };

    // Trigger loading on filter change
    useEffect(() => {
        loadData();
    }, [filterDate, filterStatus]);

    // Debounce manual typing search
    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            loadData(true);
        }, 350);

        return () => clearTimeout(delayDebounceFn);
    }, [globalSearch]);

    // Subscribe to realtime changes via event bus
    useEffect(() => {
        const handleRealtimeChange = () => {
            loadData(true);
        };

        window.addEventListener('consultas-agendamentos-changed', handleRealtimeChange);
        window.addEventListener('consultas-pacientes-changed', handleRealtimeChange);
        window.addEventListener('consultas-procedimentos-changed', handleRealtimeChange);

        return () => {
            window.removeEventListener('consultas-agendamentos-changed', handleRealtimeChange);
            window.removeEventListener('consultas-pacientes-changed', handleRealtimeChange);
            window.removeEventListener('consultas-procedimentos-changed', handleRealtimeChange);
        };
    }, [globalSearch, filterDate, filterStatus]);

    const handleStatusUpdate = async (id: string, newStatus: ConsultaAgendamento['status']) => {
        setOperatingId(id);
        try {
            const updated = await db.updateAgendamentoStatus(id, newStatus);
            if (updated) {
                setBookings(prev => prev.map(b => b.id === id ? updated : b));
            }
        } catch (error: any) {
            alert(error.message || 'Erro ao alterar o status do agendamento.');
            loadData(true);
        } finally {
            setOperatingId(null);
        }
    };

    const handleOpenCancelModal = (booking: ConsultaAgendamento) => {
        setCancelTarget(booking);
        setCancelReason('');
        setCancelError('');
        setIsCancelModalOpen(true);
    };

    const handleConfirmCancelWithReason = async () => {
        if (!cancelTarget) return;
        if (!cancelReason.trim()) {
            setCancelError('Por favor, informe a justificativa do cancelamento.');
            return;
        }
        setOperatingId(cancelTarget.id);
        try {
            await db.cancelAgendamentoWithReason(cancelTarget.id, cancelReason.trim(), {
                id: currentUser.id,
                name: currentUser.name
            });
            setIsCancelModalOpen(false);
            setCancelTarget(null);
            setCancelReason('');
            loadData(true);
        } catch (err: any) {
            setCancelError(err.message || 'Erro ao cancelar o agendamento.');
        } finally {
            setOperatingId(null);
        }
    };

    const handleConfirmRetorno = async () => {
        if (!retornoBooking || !retornoDate) return;
        setOperatingId(retornoBooking.id);
        setIsRetornoModalOpen(false);
        try {
            const newAgendamento = {
                patient_id: retornoBooking.patient_id,
                procedimento_id: retornoBooking.procedimento_id,
                appointment_date: retornoDate,
                quantity: 1,
                priority: 'Normal' as const,
                status: 'Retorno' as const,
                created_by: currentUser.id
            };
            await db.createAgendamento(newAgendamento);
            alert('Retorno agendado com sucesso!');
        } catch (error: any) {
            alert(error.message || 'Erro ao agendar o retorno.');
        } finally {
            setOperatingId(null);
            setRetornoBooking(null);
        }
    };

    // Edit modal handlers
    const handleEditCpfChange = (val: string) => {
        const clean = val.replace(/\D/g, '');
        let formatted = '';
        if (clean.length <= 3) {
            formatted = clean;
        } else if (clean.length <= 6) {
            formatted = `${clean.slice(0, 3)}.${clean.slice(3)}`;
        } else if (clean.length <= 9) {
            formatted = `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6)}`;
        } else {
            formatted = `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6, 9)}-${clean.slice(9, 11)}`;
        }
        setEditPatientCpf(formatted);
    };

    const handleOpenEditModal = (booking: ConsultaAgendamento) => {
        setEditTarget(booking);
        setEditPatientName(booking.paciente?.name || '');
        const rawCpf = booking.paciente?.cpf || '';
        const cleanCpf = rawCpf.replace(/\D/g, '');
        let formattedCpf = cleanCpf;
        if (cleanCpf.length === 11) {
            formattedCpf = cleanCpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
        }
        setEditPatientCpf(formattedCpf);
        setEditPatientPhone(booking.paciente?.phone || '');
        setEditPatientNeighborhood(booking.paciente?.neighborhood || '');
        setEditPatientStreet(booking.paciente?.street || '');
        setEditPatientSusNumber(booking.paciente?.sus_number || '');

        setEditProcedimentoId(booking.procedimento_id || '');
        setEditAppointmentDate(booking.appointment_date || '');
        setEditAppointmentTime(booking.appointment_time || '');
        setEditSolicitationDate(booking.solicitation_date || (booking.created_at ? booking.created_at.split('T')[0] : ''));
        setEditPriority(booking.priority || 'Normal');
        setEditIsRetorno(booking.is_retorno || false);
        setEditStatus(booking.status || 'Solicitado');
        setEditQuantity(booking.quantity || 1);
        setEditError('');
        setIsEditModalOpen(true);
    };

    const handleSaveEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editTarget) return;

        if (!editPatientName.trim()) {
            setEditError('Por favor, informe o nome do paciente.');
            return;
        }

        if (!editProcedimentoId) {
            setEditError('Por favor, selecione o exame ou consulta.');
            return;
        }

        setIsSubmittingEdit(true);
        setEditError('');

        try {
            const cleanCpf = editPatientCpf ? editPatientCpf.replace(/\D/g, '') : '';
            let patientId = editTarget.patient_id;

            // 1. Atualizar ou Criar Paciente
            if (patientId) {
                await db.updatePaciente(patientId, {
                    name: editPatientName.trim().toUpperCase(),
                    cpf: cleanCpf.length > 0 ? cleanCpf : undefined,
                    phone: editPatientPhone ? editPatientPhone.trim() : '',
                    neighborhood: editPatientNeighborhood ? editPatientNeighborhood.trim().toUpperCase() : '',
                    street: editPatientStreet ? editPatientStreet.trim().toUpperCase() : '',
                    sus_number: editPatientSusNumber ? editPatientSusNumber.trim() : ''
                });
            } else {
                const newPat = await db.createPaciente({
                    name: editPatientName.trim().toUpperCase(),
                    cpf: cleanCpf,
                    phone: editPatientPhone ? editPatientPhone.trim() : '',
                    neighborhood: editPatientNeighborhood ? editPatientNeighborhood.trim().toUpperCase() : '',
                    street: editPatientStreet ? editPatientStreet.trim().toUpperCase() : '',
                    sus_number: editPatientSusNumber ? editPatientSusNumber.trim() : ''
                });
                if (newPat) {
                    patientId = newPat.id;
                }
            }

            // 2. Atualizar Agendamento de forma segura
            const updatedBooking = await db.updateAgendamento(editTarget.id, {
                patient_id: patientId || editTarget.patient_id,
                procedimento_id: editProcedimentoId,
                appointment_date: editAppointmentDate ? editAppointmentDate : null,
                appointment_time: editAppointmentTime ? editAppointmentTime : null,
                solicitation_date: editSolicitationDate ? editSolicitationDate : null,
                priority: editPriority,
                is_retorno: editIsRetorno,
                status: editStatus,
                quantity: editQuantity
            });

            // 3. Atualizar estado local imediatamente
            if (updatedBooking) {
                setAllBookings(prev => prev.map(b => b.id === updatedBooking.id ? updatedBooking : b));
                setBookings(prev => prev.map(b => b.id === updatedBooking.id ? updatedBooking : b));
            }

            // Disparar eventos para sincronização em tempo real entre abas e módulos
            window.dispatchEvent(new CustomEvent('consultas-agendamentos-changed'));
            window.dispatchEvent(new CustomEvent('consultas-pacientes-changed'));

            setIsEditModalOpen(false);
            setEditTarget(null);
            await loadData(true);
        } catch (err: any) {
            console.error("Erro ao atualizar agendamento:", err);
            setEditError(err.message || 'Ocorreu um erro ao salvar as alterações.');
        } finally {
            setIsSubmittingEdit(false);
        }
    };

    // Download Receipt PDF
    const handleDownloadPdf = async (booking: ConsultaAgendamento) => {
        if (!booking.paciente || !booking.procedimento) return;
        setIsGenerating(true);
        setPrintingBooking(booking);

        // Allow template portal to render
        await new Promise(resolve => setTimeout(resolve, 500));

        try {
            const container = document.getElementById('consulta-pdf-content');
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

            const protocol = booking.id.substring(0, 8).toUpperCase();
            pdf.save(`Comprovante-Agendamento-${protocol}.pdf`);
        } catch (error) {
            console.error('Erro ao gerar PDF do agendamento:', error);
            alert('Não foi possível gerar o PDF no momento.');
        } finally {
            setIsGenerating(false);
            setPrintingBooking(null);
        }
    };

    // Handle Delete Booking
    const handleDelete = async (id: string) => {
        if (!window.confirm('Deseja realmente excluir este agendamento? Esta ação é permanente.')) return;
        
        setOperatingId(id);
        try {
            await db.deleteAgendamento(id);
            setBookings(prev => prev.filter(b => b.id !== id));
        } catch (error: any) {
            alert(error.message || 'Erro ao excluir agendamento.');
            loadData(true);
        } finally {
            setOperatingId(null);
        }
    };

    const sortedBookings = [...bookings].sort((a, b) => {
        if (filterStatus === 'Fila de espera') {
            const getPriorityWeight = (booking: ConsultaAgendamento) => {
                if (booking.priority === 'Urgência') return 0;
                if (booking.is_retorno) return 1;
                return 2;
            };
            const weightA = getPriorityWeight(a);
            const weightB = getPriorityWeight(b);
            if (weightA !== weightB) {
                return weightA - weightB;
            }
            const dateA = a.solicitation_date ? new Date(a.solicitation_date + 'T00:00:00').getTime() : (a.created_at ? new Date(a.created_at).getTime() : 0);
            const dateB = b.solicitation_date ? new Date(b.solicitation_date + 'T00:00:00').getTime() : (b.created_at ? new Date(b.created_at).getTime() : 0);
            if (dateA !== dateB) {
                return dateA - dateB;
            }
            const cA = a.created_at ? new Date(a.created_at).getTime() : 0;
            const cB = b.created_at ? new Date(b.created_at).getTime() : 0;
            return cA - cB;
        }
        return 0;
    });

    if (reservedBookings.length > 0) {
        return (
            <div className="w-full max-w-[96%] 2xl:max-w-[1440px] mx-auto flex flex-col h-full max-h-full min-h-0 bg-white/95 backdrop-blur-md rounded-[2.5rem] border border-slate-200/80 shadow-[0_20px_60px_rgba(0,0,0,0.06)] overflow-y-auto animate-in fade-in duration-300 p-6 space-y-6">
                {/* Header Banner */}
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-600 shadow-sm animate-pulse">
                            <Activity className="w-7 h-7" />
                        </div>
                        <div>
                            <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                                Fila de Espera Promovida
                            </span>
                            <h2 className="text-xl sm:text-2xl font-black text-slate-900 uppercase tracking-tight mt-1">
                                Vagas Reservadas Pendentes
                            </h2>
                        </div>
                    </div>
                </div>
                
                {/* Alert Box Explicativo Sem Asteriscos */}
                <div className="p-5 bg-amber-50/80 border border-amber-200 rounded-2xl text-xs sm:text-sm font-bold text-amber-900 leading-relaxed shadow-sm">
                    Os pacientes listados abaixo foram promovidos da fila de espera. Você deve preencher a <strong className="font-black text-amber-950 underline decoration-amber-400">Data</strong> e a <strong className="font-black text-amber-950 underline decoration-amber-400">Hora</strong> para cada um deles antes de prosseguir com o uso da tela.
                </div>
                
                {/* Cards de Pacientes Promovidos */}
                <div className="space-y-4 flex-1">
                    {reservedBookings.map((b) => {
                        const isConfirmed = !!confirmedReservedBookings[b.id];
                        const confirmedBooking = confirmedReservedBookings[b.id];
                        const dateVal = reservedDates[b.id] || '';
                        const timeVal = reservedTimes[b.id] || '';
                        
                        const procVagas = reservedProceduresVagas[b.procedimento_id] || [];
                        const procBookings = reservedProceduresBookings[b.procedimento_id] || [];
                        const assignments = getSlotAssignmentsForProcedure(procVagas, procBookings);
                        
                        const availableSlotsForProc = procVagas.filter(v => {
                            const statusNorm = (v.status || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                            const isAvail = statusNorm === 'disponivel' || statusNorm === 'livre' || !v.status || (statusNorm !== 'ocupada' && statusNorm !== 'ocupado');
                            return isAvail && !assignments.has(v.id);
                        });
                        
                        let uniqueDates: string[] = [];
                        let timesForSelectedDate: string[] = [];

                        if (availableSlotsForProc.length > 0) {
                            uniqueDates = Array.from(new Set(availableSlotsForProc.map(v => v.data))).sort();
                            timesForSelectedDate = availableSlotsForProc
                                .filter(v => v.data === dateVal)
                                .map(v => v.hora.substring(0, 5))
                                .sort();
                        } else {
                            const generatedDates: string[] = [];
                            const today = new Date();
                            for (let i = 0; i < 30; i++) {
                                const d = new Date(today);
                                d.setDate(d.getDate() + i);
                                const dateStr = d.toISOString().split('T')[0];
                                generatedDates.push(dateStr);
                            }
                            uniqueDates = generatedDates;
                            timesForSelectedDate = [
                                '07:00', '07:30', '08:00', '08:30', '09:00', '09:30',
                                '10:00', '10:30', '11:00', '11:30', '13:00', '13:30',
                                '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00'
                            ];
                        }
                        
                        return (
                            <div 
                                key={b.id} 
                                className={`p-6 rounded-3xl border transition-all ${
                                    isConfirmed 
                                    ? 'bg-emerald-50/40 border-emerald-200' 
                                    : 'bg-white border-slate-200 shadow-sm'
                                }`}
                            >
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4 mb-4">
                                    <div>
                                        <h3 className="font-black text-slate-900 uppercase text-base tracking-tight">
                                            {formatPatientName(b.paciente)}
                                        </h3>
                                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 font-bold">
                                            <span>CPF: {b.paciente?.cpf || 'Não informado'}</span>
                                            <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                                            <span className="text-sky-600 font-extrabold uppercase">{b.procedimento?.name}</span>
                                        </div>
                                    </div>
                                    {isConfirmed && (
                                        <span className="px-3 py-1 bg-emerald-100 text-emerald-800 font-black text-[10px] uppercase tracking-wider rounded-full self-start sm:self-auto border border-emerald-200">
                                            ✓ Confirmado
                                        </span>
                                    )}
                                </div>

                                {isConfirmed && confirmedBooking ? (
                                    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                        <div>
                                            <span className="text-xs text-emerald-800 font-bold">Agendado para: </span>
                                            <strong className="text-sm text-emerald-950 font-black">
                                                {confirmedBooking.appointment_date ? new Date(confirmedBooking.appointment_date + 'T12:00:00').toLocaleDateString('pt-BR') : ''} às {confirmedBooking.appointment_time}
                                            </strong>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setPrintingBooking(confirmedBooking)}
                                            className="px-4 py-2 bg-white border border-emerald-300 hover:bg-emerald-100 text-emerald-800 font-extrabold rounded-xl text-xs uppercase tracking-wider transition-all flex items-center gap-2 shadow-sm cursor-pointer"
                                        >
                                            <FileDown className="w-4 h-4 text-emerald-600" />
                                            Baixar Recibo
                                        </button>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                                        <div>
                                            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                                                Data da Consulta
                                            </label>
                                            <select
                                                value={dateVal}
                                                onChange={(e) => {
                                                    const d = e.target.value;
                                                    setReservedDates(prev => ({ ...prev, [b.id]: d }));
                                                    setReservedTimes(prev => ({ ...prev, [b.id]: '' }));
                                                }}
                                                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-800 focus:bg-white focus:border-sky-500 focus:outline-none"
                                            >
                                                <option value="">Selecione a Data...</option>
                                                {uniqueDates.map(d => (
                                                    <option key={d} value={d}>
                                                        {new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                                                Hora da Consulta
                                            </label>
                                            <select
                                                disabled={!dateVal}
                                                value={timeVal}
                                                onChange={(e) => {
                                                    setReservedTimes(prev => ({ ...prev, [b.id]: e.target.value }));
                                                }}
                                                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-800 focus:bg-white focus:border-sky-500 focus:outline-none disabled:opacity-50"
                                            >
                                                <option value="">Selecione o Horário...</option>
                                                {timesForSelectedDate.map(t => (
                                                    <option key={t} value={t}>{t}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <button
                                            type="button"
                                            disabled={!dateVal || !timeVal || loading}
                                            onClick={() => handleConfirmReservedDateAndTime(b.id, dateVal, timeVal)}
                                            className="w-full py-3 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 disabled:opacity-40 text-white font-black rounded-xl text-xs uppercase tracking-wider shadow-md shadow-sky-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                                        >
                                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                            Confirmar
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
                
                {/* Footer Bar */}
                <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 mt-auto">
                    <button
                        type="button"
                        onClick={() => {
                            if (typeof window !== 'undefined' && window.location.pathname === '/Consultas/DefinirAgenda') {
                                window.history.replaceState({}, '', '/Consultas');
                            }
                            onBack();
                        }}
                        className="w-full sm:w-auto px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold rounded-2xl text-xs uppercase tracking-wider active:scale-95 transition-all cursor-pointer"
                    >
                        Voltar ao Menu
                    </button>
                    
                    {reservedBookings.every(b => !!confirmedReservedBookings[b.id]) ? (
                        <button
                            type="button"
                            onClick={handleCloseReservedModal}
                            className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-extrabold rounded-2xl text-xs uppercase tracking-wider active:scale-95 transition-all shadow-lg shadow-emerald-500/20 hover:scale-[1.01] cursor-pointer"
                        >
                            Acessar Tela de Acompanhar
                        </button>
                    ) : (
                        <button
                            type="button"
                            disabled={true}
                            className="w-full sm:w-auto px-8 py-3.5 bg-slate-200 text-slate-400 font-extrabold rounded-2xl text-xs uppercase tracking-wider cursor-not-allowed opacity-70"
                        >
                            Defina todas as vagas para prosseguir
                        </button>
                    )}
                </div>
            </div>
        );
    }



    return (
        <div className="w-full mx-auto flex flex-col flex-1 h-full max-h-full min-h-0 bg-white rounded-3xl border border-slate-200/80 shadow-2xl shadow-slate-100 overflow-hidden">
            {/* Mobile Header (Limpa, igual FarmaciaPopular/Consultar, apenas 1 campo de busca) */}
            <div className="block md:hidden bg-white border-b border-slate-200/80 p-3.5 space-y-3 shrink-0">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <button 
                            onClick={onBack} 
                            className="p-2 -ml-1 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-2xl active:scale-95 transition-all cursor-pointer"
                            title="Voltar"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-sky-50 to-blue-50/80 border border-sky-200/80 flex items-center justify-center text-sky-600 shadow-2xs">
                            <Activity className="w-4.5 h-4.5" />
                        </div>
                        <div className="flex items-center gap-2">
                            <h3 className="font-black bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 bg-clip-text text-transparent tracking-tight text-base uppercase leading-none">
                                Acompanhar
                            </h3>
                            <span className="px-2.5 py-0.5 rounded-full bg-gradient-to-r from-sky-50 to-blue-50 text-sky-700 font-black text-[11px] uppercase border border-sky-200/80 shadow-2xs">
                                {bookings.length}
                            </span>
                        </div>
                    </div>
                </div>

                {/* 1 Único Campo de Busca Limpo no Mobile */}
                <div className="relative w-full">
                    <input
                        type="text"
                        placeholder="Buscar por nome, CPF, SUS ou exame..."
                        className="w-full bg-slate-50 border border-slate-200/90 focus:bg-white focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 rounded-2xl pl-9 pr-9 py-2 text-xs font-bold transition-all text-slate-900 placeholder:text-slate-400 shadow-2xs"
                        value={globalSearch}
                        onChange={(e) => setGlobalSearch(e.target.value)}
                    />
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
                    {globalSearch && (
                        <button
                            type="button"
                            onClick={() => setGlobalSearch('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-600 p-0.5 rounded-full hover:bg-slate-200/60 transition-colors"
                            title="Limpar busca"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            </div>

            {/* Desktop Integrated Single-Line Header */}
            <div className="hidden md:flex bg-white border-b border-slate-200/80 p-3 md:px-4 shrink-0 items-center justify-between gap-3 overflow-x-auto custom-scrollbar">
                {/* Left: Voltar + Icon + Title + Counter */}
                <div className="flex items-center gap-2.5 shrink-0">
                    <button 
                        onClick={onBack} 
                        className="p-2 -ml-1 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-2xl active:scale-95 transition-all cursor-pointer shrink-0"
                        title="Voltar"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="w-9.5 h-9.5 rounded-2xl bg-gradient-to-br from-sky-50 to-blue-50/80 border border-sky-200/80 flex items-center justify-center text-sky-600 shadow-2xs shrink-0">
                        <Activity className="w-5 h-5" />
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <h3 className="font-black bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 bg-clip-text text-transparent tracking-tight text-sm md:text-base uppercase leading-none whitespace-nowrap">
                            Acompanhar
                        </h3>
                        <span className="flex h-2 w-2 relative shrink-0">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full bg-gradient-to-r from-sky-50 to-blue-50 text-sky-700 font-black text-[11px] uppercase tracking-wider border border-sky-200/80 shadow-2xs shrink-0">
                            {bookings.length}
                        </span>
                    </div>
                </div>

                {/* Center / Right: Integrated Modern Single-Line Filters & Actions */}
                <div className="flex items-center gap-2 flex-1 justify-end min-w-0">
                    {/* 1 Único Campo de Busca Unificado (Nome, CPF, Cartão SUS ou Procedimento) */}
                    <div className="relative flex-1 min-w-[200px] max-w-md shrink-0">
                        <input
                            type="text"
                            placeholder="Buscar por Nome, CPF, Cartão SUS ou Procedimento..."
                            className="w-full bg-slate-50/90 hover:bg-slate-100/80 focus:bg-white border border-slate-200/90 focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 rounded-2xl pl-9 pr-8 py-1.5 text-xs font-semibold transition-all text-slate-900 placeholder:text-slate-400 shadow-2xs"
                            value={globalSearch}
                            onChange={(e) => setGlobalSearch(e.target.value)}
                        />
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
                        {globalSearch && (
                            <button
                                type="button"
                                onClick={() => setGlobalSearch('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-600 p-0.5 rounded-full hover:bg-slate-200/60 transition-colors cursor-pointer"
                                title="Limpar busca"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    {/* Filter: Custom Modern Date Picker */}
                    <ModernDatePicker
                        value={filterDate}
                        onChange={setFilterDate}
                        placeholder="Data"
                    />

                    {/* Filter: Status Select (Modern Popover Dropdown) */}
                    <ModernDropdown
                        value={filterStatus}
                        onChange={setFilterStatus}
                        options={[
                            { value: '', label: 'Todos os Status' },
                            { value: 'Solicitado', label: 'Solicitado' },
                            { value: 'Agendado', label: 'Agendado' },
                            { value: 'Aguardando Data', label: 'Aguardando Data' },
                            { value: 'Fila de espera', label: 'Fila de espera' },
                            { value: 'Realizado', label: 'Realizado' },
                            { value: 'Não Realizado', label: 'Não Realizado' },
                            { value: 'Cancelado', label: 'Cancelado' },
                        ]}
                        placeholder="Status"
                        minWidth="w-28 sm:w-32 lg:w-36"
                    />

                    {/* Action Button 1: Relatório */}
                    <button
                        onClick={() => setIsReportModalOpen(true)}
                        className="px-3.5 py-1.5 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-extrabold rounded-2xl shadow-md shadow-sky-500/20 hover:shadow-sky-500/35 active:scale-95 transition-all text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shrink-0"
                        title="Gerar Relatórios"
                    >
                        <FileDown className="w-3.5 h-3.5" />
                        <span className="hidden xl:inline">Relatório</span>
                    </button>

                    {/* Action Button 2: Fila de Espera */}
                    <button
                        onClick={() => setFilterStatus(prev => prev === 'Fila de espera' ? '' : 'Fila de espera')}
                        className={`px-3.5 py-1.5 font-extrabold rounded-2xl active:scale-95 transition-all text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shrink-0 ${
                            filterStatus === 'Fila de espera'
                            ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-md shadow-amber-500/25'
                            : 'bg-white hover:bg-amber-50/60 border border-amber-200/80 hover:border-amber-300 text-amber-700 shadow-2xs'
                        }`}
                        title="Filtrar por Pacientes na Fila de Espera"
                    >
                        <Clock className="w-3.5 h-3.5" />
                        <span className="hidden xl:inline">Fila</span>
                    </button>
                </div>
            </div>

            {/* List Table Area (Maximizes vertical height) */}
            <div className="flex-1 overflow-auto bg-slate-50/30 p-3 md:p-4 min-h-0">
                {loading ? (
                    <div className="h-full w-full flex flex-col items-center justify-center gap-2">
                        <Loader2 className="w-8 h-8 text-sky-600 animate-spin" />
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Carregando agendamentos...</span>
                    </div>
                ) : isMobile && !globalSearch.trim() && !filterDate && !filterStatus ? (
                    <div className="h-full w-full flex flex-col items-center justify-center p-8 text-center bg-slate-50/20 animate-in fade-in duration-300">
                        <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-sky-50 via-sky-100/60 to-blue-100 border border-sky-200/80 flex items-center justify-center text-sky-600 shadow-inner mb-4">
                            <Search className="w-8 h-8" />
                        </div>
                        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-1">
                            Qual agendamento você procura?
                        </h3>
                        <p className="text-xs font-semibold text-slate-500 max-w-md">
                            Digite o nome do paciente, apelido, CPF, Cartão SUS ou procedimento no campo de busca para consultar.
                        </p>
                    </div>
                ) : bookings.length > 0 ? (
                    <>
                        {/* LAYOUT MOBILE COMPACTO (block md:hidden) - Sem rolagem horizontal, apenas Nome, CPF e Procedimento, expansível para ver tudo */}
                        <div className="block md:hidden space-y-3 w-full">
                            {sortedBookings.map((booking) => {
                                const isExpanded = expandedBookingId === booking.id;
                                const isOperating = operatingId === booking.id;

                                return (
                                    <div 
                                        key={booking.id}
                                        className={`bg-white border rounded-2xl p-3.5 transition-all shadow-2xs w-full overflow-hidden ${
                                            isExpanded 
                                                ? 'border-sky-500 ring-2 ring-sky-500/10 shadow-md' 
                                                : 'border-slate-200/90 hover:border-slate-300'
                                        }`}
                                    >
                                        {/* Linha Compacta Principal: NOME, CPF, PROCEDIMENTO e STATUS */}
                                        <div 
                                            onClick={() => setExpandedBookingId(isExpanded ? null : booking.id)}
                                            className="flex items-start justify-between gap-2.5 cursor-pointer select-none"
                                        >
                                            <div className="min-w-0 flex-1 space-y-1">
                                                <div className="font-black text-slate-900 text-sm uppercase leading-tight truncate">
                                                    {booking.paciente ? formatPatientName(booking.paciente) : 'Carregando...'}
                                                </div>
                                                <div className="text-[11px] text-slate-500 font-bold flex items-center gap-2 flex-wrap">
                                                    <span>CPF: <span className="text-slate-800 font-extrabold">{booking.paciente?.cpf ? booking.paciente.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") : 'Não informado'}</span></span>
                                                </div>
                                                <div className="text-xs font-extrabold text-sky-700 uppercase flex items-center gap-1.5 flex-wrap pt-0.5">
                                                    <span className="truncate">{booking.procedimento?.name || 'Procedimento não informado'}</span>
                                                    {booking.procedimento?.code && (
                                                        <span className="text-[9px] text-slate-500 font-black bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                                                            {booking.procedimento.code}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex flex-col items-end gap-2 shrink-0">
                                                <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border shadow-2xs ${
                                                    booking.status === 'Solicitado'
                                                    ? 'bg-sky-50 text-sky-700 border-sky-300'
                                                    : booking.status === 'Agendado' 
                                                    ? 'bg-indigo-50 text-indigo-700 border-indigo-300' 
                                                    : booking.status === 'Realizado' 
                                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300' 
                                                    : booking.status === 'Não Realizado'
                                                    ? 'bg-slate-100 text-slate-700 border-slate-300'
                                                    : booking.status === 'Fila de espera'
                                                    ? 'bg-amber-50 text-amber-800 border-amber-300'
                                                    : booking.status === 'Aguardando Data'
                                                    ? 'bg-violet-50 text-violet-800 border-violet-300'
                                                    : booking.status === 'Retorno'
                                                    ? 'bg-teal-50 text-teal-800 border-teal-300'
                                                    : 'bg-rose-50 text-rose-800 border-rose-300'
                                                }`}>
                                                    {booking.status}
                                                </span>

                                                <div className={`w-7 h-7 rounded-xl flex items-center justify-center transition-transform ${isExpanded ? 'bg-sky-100 text-sky-700 rotate-180' : 'bg-slate-100 text-slate-500'}`}>
                                                    <ChevronDown className="w-4 h-4" />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Conteúdo Expandido com TODAS as informações do agendamento (AO ABRIR) */}
                                        {isExpanded && (
                                            <div className="mt-3 pt-3 border-t border-slate-100 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                                                {/* Grid de Informações Detalhadas */}
                                                <div className="grid grid-cols-2 gap-2 text-xs">
                                                    <div className="bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
                                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-0.5">Data Agendada</span>
                                                        <div className="font-bold text-slate-800">
                                                            {booking.status !== 'Fila de espera' && booking.status !== 'Aguardando Data' && (booking.appointment_time || booking.status === 'Agendado' || booking.status === 'Realizado') ? (
                                                                <span>
                                                                    {new Date(booking.appointment_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                                                                    {booking.appointment_time ? ` ${booking.appointment_time.substring(0, 5)}` : ''}
                                                                </span>
                                                            ) : (
                                                                <span className="text-amber-800 font-black text-[10px]">Aguardando Vaga</span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
                                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-0.5">Data Solicitada</span>
                                                        <div className="font-bold text-slate-800">
                                                            {booking.solicitation_date 
                                                                ? new Date(booking.solicitation_date + 'T00:00:00').toLocaleDateString('pt-BR') 
                                                                : (booking.created_at ? new Date(booking.created_at).toLocaleDateString('pt-BR') : '-')}
                                                        </div>
                                                    </div>

                                                    <div className="bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
                                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-0.5">Prioridade</span>
                                                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                                            booking.priority === 'Urgência'
                                                            ? 'bg-rose-500 text-white'
                                                            : booking.is_retorno
                                                            ? 'bg-teal-600 text-white'
                                                            : 'bg-slate-200 text-slate-700'
                                                        }`}>
                                                            {booking.priority === 'Urgência' ? 'Urgência' : booking.is_retorno ? 'Retorno' : 'Normal'}
                                                        </span>
                                                    </div>

                                                    <div className="bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
                                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-0.5">Cartão SUS</span>
                                                        <div className="font-bold text-slate-800 truncate">
                                                            {booking.paciente?.sus_number || 'Não informado'}
                                                        </div>
                                                    </div>

                                                    {booking.status === 'Fila de espera' && queuePositions[booking.id] && (
                                                        <div className="col-span-2 bg-amber-50 p-2.5 rounded-xl border border-amber-200/80 flex items-center justify-between">
                                                            <span className="text-[10px] font-black text-amber-800 uppercase tracking-wider">Posição na Fila de Espera</span>
                                                            <span className="font-black text-amber-700 text-xs px-2.5 py-0.5 bg-amber-100 rounded-full border border-amber-300">
                                                                {queuePositions[booking.id]}º lugar
                                                            </span>
                                                        </div>
                                                    )}

                                                    {booking.status === 'Cancelado' && (booking.cancellation_reason || booking.canceled_by_name) && (
                                                        <div className="col-span-2 bg-rose-50 p-2.5 rounded-xl border border-rose-200 text-rose-700 text-xs">
                                                            <span className="font-black uppercase text-[10px] block mb-0.5">Motivo do Cancelamento:</span>
                                                            <span>{booking.cancellation_reason || 'Sem justificativa'}</span>
                                                        </div>
                                                    )}

                                                    <div className="col-span-2 bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
                                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-0.5">Responsável pelo Cadastro</span>
                                                        <div className="font-bold text-slate-800">{booking.responsavel?.name || 'Sistema'}</div>
                                                        {booking.created_at && (
                                                            <span className="text-[9px] text-slate-400 block">{new Date(booking.created_at).toLocaleString('pt-BR')}</span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Ações disponíveis no Mobile */}
                                                <div className="pt-2 flex items-center justify-end gap-2 flex-wrap border-t border-slate-100">
                                                    {isOperating ? (
                                                        <Loader2 className="w-5 h-5 text-sky-600 animate-spin" />
                                                    ) : (
                                                        <>
                                                            {canEdit && (
                                                                <button
                                                                    onClick={() => handleOpenEditModal(booking)}
                                                                    className="px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all"
                                                                >
                                                                    <Edit2 className="w-3.5 h-3.5" /> Editar
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => handleDownloadPdf(booking)}
                                                                disabled={isGenerating}
                                                                className="px-3 py-1.5 bg-sky-50 text-sky-700 border border-sky-200 rounded-xl text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all"
                                                            >
                                                                <FileDown className="w-3.5 h-3.5" /> Comprovante
                                                            </button>
                                                            {booking.status === 'Realizado' && (
                                                                <button
                                                                    onClick={() => {
                                                                        setRetornoBooking(booking);
                                                                        const tomorrow = new Date();
                                                                        tomorrow.setDate(tomorrow.getDate() + 1);
                                                                        setRetornoDate(tomorrow.toISOString().split('T')[0]);
                                                                        setIsRetornoModalOpen(true);
                                                                    }}
                                                                    className="px-3 py-1.5 bg-teal-50 text-teal-700 border border-teal-200 rounded-xl text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all"
                                                                >
                                                                    <Repeat className="w-3.5 h-3.5" /> Retorno
                                                                </button>
                                                            )}
                                                            {booking.status === 'Solicitado' && (
                                                                <>
                                                                    {canComplete && (
                                                                        <button
                                                                            onClick={() => handleStatusUpdate(booking.id, 'Agendado')}
                                                                            className="px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all"
                                                                        >
                                                                            <CheckCircle2 className="w-3.5 h-3.5" /> Aprovar
                                                                        </button>
                                                                    )}
                                                                    {canCancel && (
                                                                        <button
                                                                            onClick={() => handleOpenCancelModal(booking)}
                                                                            className="px-3 py-1.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all"
                                                                        >
                                                                            <XCircle className="w-3.5 h-3.5" /> Rejeitar
                                                                        </button>
                                                                    )}
                                                                </>
                                                            )}
                                                            {booking.status === 'Agendado' && (
                                                                <>
                                                                    {canComplete && (
                                                                        <button
                                                                            onClick={() => handleStatusUpdate(booking.id, 'Realizado')}
                                                                            className="px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all"
                                                                        >
                                                                            <CheckCircle2 className="w-3.5 h-3.5" /> Concluir
                                                                        </button>
                                                                    )}
                                                                    {canComplete && (
                                                                        <button
                                                                            onClick={() => handleStatusUpdate(booking.id, 'Não Realizado')}
                                                                            className="px-3 py-1.5 bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all"
                                                                        >
                                                                            <UserX className="w-3.5 h-3.5" /> Faltou
                                                                        </button>
                                                                    )}
                                                                    {canCancel && (
                                                                        <button
                                                                            onClick={() => handleOpenCancelModal(booking)}
                                                                            className="px-3 py-1.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all"
                                                                        >
                                                                            <XCircle className="w-3.5 h-3.5" /> Cancelar
                                                                        </button>
                                                                    )}
                                                                </>
                                                            )}
                                                            {(booking.status === 'Fila de espera' || booking.status === 'Aguardando Data') && (
                                                                <>
                                                                    {canCancel && (
                                                                        <button
                                                                            onClick={() => handleOpenCancelModal(booking)}
                                                                            className="px-3 py-1.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all"
                                                                        >
                                                                            <XCircle className="w-3.5 h-3.5" /> Cancelar
                                                                        </button>
                                                                    )}
                                                                </>
                                                            )}
                                                            {canDelete && (
                                                                <button
                                                                    onClick={() => handleDelete(booking.id)}
                                                                    className="px-3 py-1.5 bg-slate-100 text-slate-600 border border-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all"
                                                                >
                                                                    <Trash2 className="w-3.5 h-3.5" /> Excluir
                                                                </button>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* TABELA COMPLETA DESKTOP (hidden md:block) */}
                        <div className="hidden md:block bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-2xs">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead className="sticky top-0 bg-slate-50 border-b border-slate-200/80 text-[10px] font-black text-slate-500 uppercase tracking-wider z-10 shadow-2xs">
                                        <tr>
                                            <th className="py-3 px-3 text-center w-16">Posição</th>
                                            <th className="py-3 px-3">Solicitado</th>
                                            <th className="py-3 px-3">Paciente / CPF</th>
                                            <th className="py-3 px-3">Exame / Procedimento</th>
                                            <th className="py-3 px-3">Data Agendada</th>
                                            <th className="py-3 px-3 text-center">Prioridade</th>
                                            <th className="py-3 px-3 text-center">Status</th>
                                            <th className="py-3 px-3">Responsável</th>
                                            <th className="py-3 px-3 text-right">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {sortedBookings.map((booking) => {
                                            const isOperating = operatingId === booking.id;
                                            return (
                                                <tr key={booking.id} className="hover:bg-sky-50/40 text-xs font-semibold text-slate-700 transition-colors">
                                                    <td className="py-3 px-3 text-center">
                                                        {booking.status === 'Fila de espera' && queuePositions[booking.id] ? (
                                                            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-300 font-black text-[10px] shadow-2xs">
                                                                {queuePositions[booking.id]}º
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-300 font-normal">-</span>
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-3 text-slate-500 whitespace-nowrap">
                                                        {booking.solicitation_date 
                                                            ? new Date(booking.solicitation_date + 'T00:00:00').toLocaleDateString('pt-BR') 
                                                            : (booking.created_at ? new Date(booking.created_at).toLocaleDateString('pt-BR') : '-')}
                                                    </td>
                                                    <td className="py-3 px-3">
                                                        <div className="font-extrabold text-slate-900 uppercase leading-tight">{booking.paciente ? formatPatientName(booking.paciente) : 'Carregando...'}</div>
                                                        <div className="text-[10px] text-slate-400 font-bold tracking-wider mt-0.5">
                                                            CPF: {booking.paciente?.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-3">
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            <span className="font-extrabold text-slate-800 uppercase">{booking.procedimento?.name || 'Carregando...'}</span>
                                                            {booking.procedimento?.code && (
                                                                <span className="text-[9px] text-slate-500 font-extrabold bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                                                    {booking.procedimento.code}
                                                                </span>
                                                            )}
                                                        </div>
                                                         <span className={`inline-block px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider rounded mt-0.5 ${
                                                             booking.procedimento?.type === 'Exame' 
                                                             ? 'bg-sky-50 text-sky-700 border border-sky-200/60' 
                                                             : booking.procedimento?.type === 'Consulta'
                                                             ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/60'
                                                             : 'bg-rose-50 text-rose-700 border border-rose-200/60'
                                                         }`}>
                                                            {booking.procedimento?.type}
                                                         </span>
                                                    </td>
                                                    <td className="py-3 px-3 text-slate-700 font-extrabold whitespace-nowrap">
                                                        {booking.status !== 'Fila de espera' && booking.status !== 'Aguardando Data' && (booking.appointment_time || booking.status === 'Agendado' || booking.status === 'Realizado') ? (
                                                            <span>
                                                                {new Date(booking.appointment_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                                                                {booking.appointment_time ? ` ${booking.appointment_time.substring(0, 5)}` : ''}
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex px-2 py-0.5 rounded text-[9px] font-black uppercase text-amber-800 bg-amber-50 border border-amber-300 shadow-2xs">
                                                                Aguardando Vaga
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-3 text-center whitespace-nowrap">
                                                         <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                                             booking.priority === 'Urgência'
                                                             ? 'bg-rose-500 text-white shadow-2xs'
                                                             : booking.is_retorno
                                                             ? 'bg-teal-600 text-white shadow-2xs'
                                                             : 'bg-slate-100 text-slate-600 border border-slate-200'
                                                         }`}>
                                                             {booking.priority === 'Urgência' ? 'Urgência' : booking.is_retorno ? 'Retorno' : 'Normal'}
                                                         </span>
                                                    </td>
                                                    <td className="py-3 px-3 text-center whitespace-nowrap">
                                                        <div className="flex flex-col items-center gap-1">
                                                            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border shadow-2xs ${
                                                                booking.status === 'Solicitado'
                                                                ? 'bg-sky-50 text-sky-700 border-sky-300'
                                                                : booking.status === 'Agendado' 
                                                                ? 'bg-indigo-50 text-indigo-700 border-indigo-300' 
                                                                : booking.status === 'Realizado' 
                                                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300' 
                                                                : booking.status === 'Não Realizado'
                                                                ? 'bg-slate-100 text-slate-700 border-slate-300'
                                                                : booking.status === 'Fila de espera'
                                                                ? 'bg-amber-50 text-amber-800 border-amber-300'
                                                                : booking.status === 'Aguardando Data'
                                                                ? 'bg-violet-50 text-violet-800 border-violet-300'
                                                                : booking.status === 'Retorno'
                                                                ? 'bg-teal-50 text-teal-800 border-teal-300'
                                                                : 'bg-rose-50 text-rose-800 border-rose-300'
                                                            }`}>
                                                                {booking.status}
                                                            </span>
                                                            {booking.status === 'Fila de espera' && queuePositions[booking.id] && (
                                                                <span className="text-[9px] text-amber-800 font-extrabold uppercase tracking-wide bg-amber-50 border border-amber-300 px-1.5 py-0.5 rounded shadow-2xs">
                                                                    {queuePositions[booking.id]}º na fila
                                                                </span>
                                                            )}
                                                            {booking.status === 'Cancelado' && (booking.cancellation_reason || booking.canceled_by_name) && (
                                                                <div className="text-[9px] text-rose-600 font-bold text-center max-w-[130px] truncate" title={`Cancelado por: ${booking.canceled_by_name || 'Usuário'} | Motivo: ${booking.cancellation_reason || 'Sem justificativa'}`}>
                                                                    Motivo: {booking.cancellation_reason || 'Não informado'}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-3 text-slate-500 whitespace-nowrap">
                                                        <div className="font-bold text-slate-700">{booking.responsavel?.name || 'Sistema'}</div>
                                                        <div className="text-[9px] text-slate-400 mt-0.5 font-semibold">
                                                            {booking.created_at && new Date(booking.created_at).toLocaleString('pt-BR')}
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-3 text-right whitespace-nowrap">
                                                        <div className="flex items-center justify-end gap-1.5">
                                                            {isOperating ? (
                                                                <Loader2 className="w-4 h-4 text-sky-600 animate-spin" />
                                                            ) : (
                                                                <>
                                                                    {canEdit && (
                                                                        <button
                                                                            onClick={() => handleOpenEditModal(booking)}
                                                                            className="p-1.5 text-amber-600 hover:text-white hover:bg-amber-500 rounded-lg border border-amber-200 hover:border-amber-500 transition-all flex items-center justify-center cursor-pointer shadow-2xs"
                                                                            title="Editar Agendamento / Paciente"
                                                                        >
                                                                            <Edit2 className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    )}
                                                                    <button
                                                                        onClick={() => handleDownloadPdf(booking)}
                                                                        disabled={isGenerating}
                                                                        className="p-1.5 text-sky-600 hover:text-white hover:bg-sky-500 rounded-lg border border-sky-200 hover:border-sky-500 transition-all flex items-center justify-center cursor-pointer shadow-2xs disabled:opacity-50"
                                                                        title="Imprimir Comprovante de Agendamento (PDF)"
                                                                    >
                                                                        <FileDown className="w-3.5 h-3.5" />
                                                                    </button>
                                                                    {booking.status === 'Realizado' && (
                                                                        <button
                                                                            onClick={() => {
                                                                                setRetornoBooking(booking);
                                                                                const tomorrow = new Date();
                                                                                tomorrow.setDate(tomorrow.getDate() + 1);
                                                                                setRetornoDate(tomorrow.toISOString().split('T')[0]);
                                                                                setIsRetornoModalOpen(true);
                                                                            }}
                                                                            className="p-1.5 text-teal-600 hover:text-white hover:bg-teal-500 rounded-lg border border-teal-200 hover:border-teal-500 transition-all flex items-center justify-center cursor-pointer shadow-2xs"
                                                                            title="Marcar Retorno para o Paciente"
                                                                        >
                                                                            <Repeat className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    )}
                                                                    {booking.status === 'Solicitado' && (
                                                                        <>
                                                                            {canComplete && (
                                                                                <button
                                                                                    onClick={() => handleStatusUpdate(booking.id, 'Agendado')}
                                                                                    className="p-1.5 text-emerald-600 hover:text-white hover:bg-emerald-500 rounded-lg border border-emerald-200 hover:border-emerald-500 transition-all flex items-center justify-center cursor-pointer shadow-2xs"
                                                                                    title="Aprovar Agendamento"
                                                                                >
                                                                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                                                                </button>
                                                                            )}
                                                                            {canCancel && (
                                                                                <button
                                                                                    onClick={() => handleOpenCancelModal(booking)}
                                                                                    className="p-1.5 text-rose-500 hover:text-white hover:bg-rose-500 rounded-lg border border-rose-200 hover:border-rose-500 transition-all flex items-center justify-center cursor-pointer shadow-2xs"
                                                                                    title="Rejeitar/Cancelar Agendamento"
                                                                                >
                                                                                    <XCircle className="w-3.5 h-3.5" />
                                                                                </button>
                                                                            )}
                                                                        </>
                                                                    )}
                                                                    {booking.status === 'Agendado' && (
                                                                        <>
                                                                            {canComplete && (
                                                                                <button
                                                                                    onClick={() => handleStatusUpdate(booking.id, 'Realizado')}
                                                                                    className="p-1.5 text-emerald-600 hover:text-white hover:bg-emerald-500 rounded-lg border border-emerald-200 hover:border-emerald-500 transition-all flex items-center justify-center cursor-pointer shadow-2xs"
                                                                                    title="Marcar Procedimento como Realizado"
                                                                                >
                                                                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                                                                </button>
                                                                            )}
                                                                            {canComplete && (
                                                                                <button
                                                                                    onClick={() => handleStatusUpdate(booking.id, 'Não Realizado')}
                                                                                    className="p-1.5 text-slate-500 hover:text-white hover:bg-slate-600 rounded-lg border border-slate-200 hover:border-slate-600 transition-all flex items-center justify-center cursor-pointer shadow-2xs"
                                                                                    title="Marcar como Não Realizado (Paciente Faltou)"
                                                                                >
                                                                                    <UserX className="w-3.5 h-3.5" />
                                                                                </button>
                                                                            )}
                                                                            {canCancel && (
                                                                                <button
                                                                                    onClick={() => handleOpenCancelModal(booking)}
                                                                                    className="p-1.5 text-rose-500 hover:text-white hover:bg-rose-500 rounded-lg border border-rose-200 hover:border-rose-500 transition-all flex items-center justify-center cursor-pointer shadow-2xs"
                                                                                    title="Cancelar Agendamento"
                                                                                >
                                                                                    <XCircle className="w-3.5 h-3.5" />
                                                                                </button>
                                                                            )}
                                                                        </>
                                                                    )}
                                                                    {(booking.status === 'Fila de espera' || booking.status === 'Aguardando Data') && (
                                                                        <>
                                                                            {canCancel && (
                                                                                <button
                                                                                    onClick={() => handleOpenCancelModal(booking)}
                                                                                    className="p-1.5 text-rose-500 hover:text-white hover:bg-rose-500 rounded-lg border border-rose-200 hover:border-rose-500 transition-all flex items-center justify-center cursor-pointer shadow-2xs"
                                                                                    title="Cancelar Agendamento"
                                                                                >
                                                                                    <XCircle className="w-3.5 h-3.5" />
                                                                                </button>
                                                                            )}
                                                                        </>
                                                                    )}
                                                                    {canDelete && (
                                                                        <button
                                                                            onClick={() => handleDelete(booking.id)}
                                                                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all flex items-center justify-center cursor-pointer"
                                                                            title="Excluir Agendamento"
                                                                        >
                                                                            <Trash2 className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    )}
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8">
                        <Sparkles className="w-12 h-12 mb-3 opacity-25 text-slate-500" />
                        <h4 className="text-sm font-extrabold text-slate-800">Sem agendamentos no momento</h4>
                        <p className="text-xs text-slate-500 mt-1 font-medium text-center">Nenhum registro corresponde aos filtros selecionados</p>
                    </div>
                )}
            </div>
            {printingBooking && (
                <ConsultaPdfGenerator
                    bookingId={printingBooking.id}
                    patient={printingBooking.paciente!}
                    procedure={printingBooking.procedimento!}
                    date={printingBooking.appointment_date}
                    quantity={printingBooking.quantity}
                    priority={printingBooking.priority}
                    is_retorno={printingBooking.is_retorno}
                    currentUser={currentUser}
                    state={appState}
                />
            )}
            {/* MODAL: DEFINIR DATA PARA RETORNO */}
            {isRetornoModalOpen && retornoBooking && (
                <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 flex flex-col transform transition-all">
                        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
                            <div>
                                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Agendar Retorno</h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Define a data de retorno do paciente</p>
                            </div>
                            <button 
                                onClick={() => {
                                    setIsRetornoModalOpen(false);
                                    setRetornoBooking(null);
                                }} 
                                className="p-2 hover:bg-slate-200 rounded-xl text-slate-400 hover:text-slate-700 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="p-3.5 bg-slate-50 border border-slate-200/50 rounded-2xl space-y-2 text-xs font-bold text-slate-600">
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Paciente:</span>
                                    <span className="text-slate-800 uppercase font-black">{formatPatientName(retornoBooking.paciente)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Procedimento:</span>
                                    <span className="text-slate-800 uppercase font-black">{retornoBooking.procedimento?.name}</span>
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5 ml-1">Data do Retorno</label>
                                <input
                                    type="date"
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-900 focus:bg-white focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 outline-none transition-all text-xs font-bold"
                                    value={retornoDate}
                                    onChange={(e) => setRetornoDate(e.target.value)}
                                    required
                                />
                            </div>
                        </div>
                        <div className="p-5 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 shrink-0">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsRetornoModalOpen(false);
                                    setRetornoBooking(null);
                                }}
                                className="px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 font-extrabold rounded-xl text-xs uppercase tracking-wider active:scale-95 transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmRetorno}
                                disabled={!retornoDate}
                                className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-extrabold rounded-xl text-xs uppercase tracking-wider active:scale-95 transition-all flex items-center gap-1.5 shadow-md"
                            >
                                Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* MODAL: RELATÓRIOS */}
            {isReportModalOpen && createPortal(
                <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in font-sans">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden border border-slate-100 flex flex-col transform transition-all animate-scale-in">
                        {/* Header */}
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
                            <div>
                                <h3 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                                    <FileDown className="w-5 h-5 text-sky-600" />
                                    Relatório de Agendamentos e Procedimentos
                                </h3>
                                <p className="text-xs text-slate-500 font-semibold mt-0.5">Quantitativo consolidado e listagem detalhada de pacientes por procedimento</p>
                            </div>
                            <button 
                                onClick={() => setIsReportModalOpen(false)} 
                                className="p-2 hover:bg-slate-200 rounded-xl text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Tabs Selector */}
                        <div className="px-6 py-3 bg-slate-100/40 border-b border-slate-100 flex gap-2 shrink-0">
                            <button
                                onClick={() => setReportType('simplificado')}
                                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
                                    reportType === 'simplificado'
                                    ? 'bg-sky-600 text-white shadow-md shadow-sky-200/50'
                                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                                }`}
                            >
                                <BarChart3 className="w-3.5 h-3.5" />
                                Relatório Simplificado (Quantitativo)
                            </button>
                            <button
                                onClick={() => setReportType('completo')}
                                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
                                    reportType === 'completo'
                                    ? 'bg-sky-600 text-white shadow-md shadow-sky-200/50'
                                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                                }`}
                            >
                                <Users className="w-3.5 h-3.5" />
                                Relatório Completo (Procedimentos e Pacientes)
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6 min-h-0 bg-slate-50/30">
                            {/* SEÇÃO 1: QUANTITATIVO POR PROCEDIMENTO (Exibido no Simplificado e no Completo) */}
                            <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm">
                                <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <BarChart3 className="w-4 h-4 text-sky-400" />
                                        <h4 className="text-xs font-black uppercase tracking-wider">Quantitativo dos Procedimentos</h4>
                                    </div>
                                    <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-slate-800 text-sky-300 border border-slate-700">
                                        Total Geral: {allBookings.reduce((acc, b) => acc + (b.quantity || 1), 0)} Solicitações
                                    </span>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-100 text-[10px] font-black uppercase text-slate-600 border-b border-slate-200">
                                                <th className="px-4 py-2.5">Procedimento</th>
                                                <th className="px-4 py-2.5 text-center w-28">Tipo</th>
                                                <th className="px-4 py-2.5 text-center w-36">Quantidade</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                                            {procedures.map(proc => {
                                                const procBookings = allBookings.filter(b => 
                                                    b.procedimento_id === proc.id || b.procedimento?.id === proc.id
                                                );
                                                const totalQty = procBookings.reduce((acc, b) => acc + (b.quantity || 1), 0);
                                                if (totalQty < 1) return null;

                                                return (
                                                    <tr key={proc.id} className="hover:bg-slate-50/60 transition-colors">
                                                        <td className="px-4 py-2">
                                                            <div className="font-extrabold text-slate-900 uppercase flex items-center gap-2">
                                                                <span>{proc.name}</span>
                                                                {proc.code && (
                                                                    <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                                                        {proc.code}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-2 text-center">
                                                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                                                proc.type === 'Exame'
                                                                    ? 'bg-sky-50 text-sky-700 border border-sky-200'
                                                                    : proc.type === 'Consulta'
                                                                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                                                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                                                            }`}>
                                                                {proc.type}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-2 text-center font-mono font-black text-slate-900 text-sm">
                                                            {totalQty}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* SEÇÃO 2: LISTA PACIENTE X PROCEDIMENTO (Apenas no Relatório Completo) */}
                            {reportType === 'completo' && (
                                <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm">
                                    <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Users className="w-4 h-4 text-sky-400" />
                                            <h4 className="text-xs font-black uppercase tracking-wider">Lista Paciente x Procedimento (Ordem Alfabética)</h4>
                                        </div>
                                        <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300">
                                            {allBookings.length} Registros
                                        </span>
                                    </div>
                                    <div className="overflow-x-auto max-h-[400px]">
                                        <table className="w-full text-left border-collapse">
                                            <thead className="sticky top-0 bg-slate-100 text-[10px] font-black uppercase text-slate-600 border-b border-slate-200 z-10">
                                                <tr>
                                                    <th className="px-3 py-2.5 text-center w-16">Posição</th>
                                                    <th className="px-3 py-2.5 text-center w-28">Solicitado</th>
                                                    <th className="px-4 py-2.5">Paciente / CPF</th>
                                                    <th className="px-4 py-2.5">Procedimento</th>
                                                    <th className="px-3 py-2.5 text-center w-36">Data Agendada</th>
                                                    <th className="px-3 py-2.5 text-center w-28">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700 uppercase">
                                                {allBookings
                                                    .sort((a, b) => {
                                                        const nameA = a.paciente?.name || '';
                                                        const nameB = b.paciente?.name || '';
                                                        const comp = nameA.localeCompare(nameB, 'pt-BR', { sensitivity: 'base' });
                                                        if (comp !== 0) return comp;
                                                        const dateA = a.solicitation_date ? new Date(a.solicitation_date + 'T00:00:00').getTime() : (a.created_at ? new Date(a.created_at).getTime() : 0);
                                                        const dateB = b.solicitation_date ? new Date(b.solicitation_date + 'T00:00:00').getTime() : (b.created_at ? new Date(b.created_at).getTime() : 0);
                                                        return dateB - dateA;
                                                    })
                                                    .map((booking, idx) => {
                                                        const isWaitlist = booking.status === 'Fila de espera';
                                                        const queuePos = queuePositions[booking.id];

                                                        return (
                                                            <tr key={booking.id} className="hover:bg-slate-50/60 transition-colors">
                                                                <td className="px-3 py-2 text-center font-black">
                                                                    {isWaitlist && queuePos ? (
                                                                        <span className="inline-block px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-300 text-[10px] font-black">
                                                                            {queuePos}º
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-slate-400 font-mono text-xs">
                                                                            #{idx + 1}
                                                                        </span>
                                                                    )}
                                                                </td>
                                                                <td className="px-3 py-2 text-center font-mono text-slate-600 text-[11px]">
                                                                    {formatDateBr(booking.solicitation_date || (booking.created_at ? booking.created_at.split('T')[0] : null))}
                                                                </td>
                                                                <td className="px-4 py-2">
                                                                    <div className="font-extrabold text-slate-900 leading-tight">
                                                                        {formatPatientName(booking.paciente)}
                                                                    </div>
                                                                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                                                        CPF: {booking.paciente?.cpf ? booking.paciente.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") : 'Não informado'}
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-2">
                                                                    <div className="font-extrabold text-slate-800 leading-tight">
                                                                        {booking.procedimento?.name || 'Procedimento não informado'}
                                                                    </div>
                                                                    {booking.procedimento?.code && (
                                                                        <span className="text-[9px] font-mono text-slate-500 bg-slate-100 px-1 py-0.2 rounded border border-slate-200 inline-block mt-0.5">
                                                                            {booking.procedimento.code}
                                                                        </span>
                                                                    )}
                                                                </td>
                                                                <td className="px-3 py-2 text-center font-mono text-[11px]">
                                                                    {booking.status !== 'Fila de espera' && booking.status !== 'Aguardando Data' && booking.appointment_date ? (
                                                                        <span className="font-bold text-slate-800">
                                                                            {new Date(booking.appointment_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                                                                            {booking.appointment_time ? ` ${booking.appointment_time.substring(0, 5)}` : ''}
                                                                        </span>
                                                                    ) : (
                                                                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase text-amber-800 bg-amber-50 border border-amber-200">
                                                                            Aguardando Vaga
                                                                        </span>
                                                                    )}
                                                                </td>
                                                                <td className="px-3 py-2 text-center">
                                                                    <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                                                                        booking.status === 'Solicitado'
                                                                            ? 'bg-sky-50 text-sky-700 border-sky-200'
                                                                            : booking.status === 'Agendado'
                                                                            ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                                                            : booking.status === 'Realizado'
                                                                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                                                            : booking.status === 'Fila de espera'
                                                                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                                                                            : booking.status === 'Aguardando Data'
                                                                            ? 'bg-violet-50 text-violet-800 border-violet-200'
                                                                            : booking.status === 'Retorno'
                                                                            ? 'bg-teal-50 text-teal-800 border-teal-200'
                                                                            : 'bg-rose-50 text-rose-800 border-rose-200'
                                                                    }`}>
                                                                        {booking.status}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer Actions */}
                        <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3 shrink-0">
                            <button
                                type="button"
                                onClick={() => setIsReportModalOpen(false)}
                                className="px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 font-extrabold rounded-xl text-xs uppercase tracking-wider active:scale-95 transition-all cursor-pointer"
                            >
                                Fechar
                            </button>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setReportType('simplificado');
                                        setIsPrintingReport(true);
                                    }}
                                    className={`px-4 py-2.5 font-extrabold rounded-xl text-xs uppercase tracking-wider active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer ${
                                        reportType === 'simplificado'
                                        ? 'bg-sky-600 hover:bg-sky-700 text-white shadow-md shadow-sky-600/20'
                                        : 'bg-white hover:bg-sky-50 text-sky-700 border border-sky-200'
                                    }`}
                                >
                                    <FileDown className="w-4 h-4" />
                                    Exportar Simplificado
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setReportType('completo');
                                        setIsPrintingReport(true);
                                    }}
                                    className={`px-4 py-2.5 font-extrabold rounded-xl text-xs uppercase tracking-wider active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer ${
                                        reportType === 'completo'
                                        ? 'bg-sky-600 hover:bg-sky-700 text-white shadow-md shadow-sky-600/20'
                                        : 'bg-white hover:bg-sky-50 text-sky-700 border border-sky-200'
                                    }`}
                                >
                                    <FileDown className="w-4 h-4" />
                                    Exportar Completo
                                </button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {isPrintingReport && (
                <ConsultasReportPdfGenerator
                    reportType={reportType}
                    bookings={allBookings}
                    procedures={procedures}
                    queuePositions={queuePositions}
                    state={appState}
                    currentUser={currentUser}
                    onClose={() => setIsPrintingReport(false)}
                />
            )}

            {/* MODAL DE CANCELAMENTO COM JUSTIFICATIVA */}
            {isCancelModalOpen && cancelTarget && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 flex flex-col transform transition-all animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="p-5 border-b border-rose-100 bg-rose-50/60 flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-rose-100 flex items-center justify-center text-rose-600 shadow-inner">
                                    <XCircle className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-rose-950 uppercase tracking-wider">Cancelar Agendamento</h3>
                                    <p className="text-[10px] text-rose-700/80 font-bold uppercase tracking-wider mt-0.5">Informe o motivo do cancelamento</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setIsCancelModalOpen(false);
                                    setCancelTarget(null);
                                }}
                                className="p-2 hover:bg-rose-100 rounded-xl text-rose-400 hover:text-rose-700 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Form Content */}
                        <div className="p-6 space-y-4">
                            {/* Summary Card */}
                            <div className="p-4 bg-slate-50 border border-slate-200/70 rounded-2xl space-y-2 text-xs font-semibold text-slate-700">
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Paciente:</span>
                                    <span className="font-black text-slate-900 uppercase">{formatPatientName(cancelTarget.paciente)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Procedimento:</span>
                                    <span className="font-extrabold text-sky-600 uppercase">{cancelTarget.procedimento?.name}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Data Atual:</span>
                                    <span className="font-bold text-slate-800">
                                        {cancelTarget.appointment_date ? new Date(cancelTarget.appointment_date + 'T12:00:00').toLocaleDateString('pt-BR') : 'Fila de Espera'}
                                    </span>
                                </div>
                            </div>

                            {/* Justificativa Field */}
                            <div className="space-y-1.5">
                                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-700">
                                    Justificativa do Cancelamento <span className="text-rose-500">*</span>
                                </label>
                                <textarea
                                    value={cancelReason}
                                    onChange={(e) => {
                                        setCancelReason(e.target.value);
                                        if (cancelError) setCancelError('');
                                    }}
                                    placeholder="Descreva detalhadamente a justificativa para o cancelamento deste agendamento..."
                                    rows={4}
                                    className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 outline-none focus:bg-white focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 transition-all resize-none"
                                />
                                {cancelError && (
                                    <p className="text-[11px] font-extrabold text-rose-600 mt-1 flex items-center gap-1">
                                        ⚠️ {cancelError}
                                    </p>
                                )}
                            </div>

                            {/* Operator Registration Notice */}
                            <div className="p-3 bg-rose-50/50 border border-rose-100 rounded-xl text-[10px] text-rose-700 font-bold flex items-center gap-2">
                                <span>🔒 Cancelamento será registrado por: <strong className="uppercase font-black text-rose-900">{currentUser.name}</strong></span>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-3 shrink-0">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsCancelModalOpen(false);
                                    setCancelTarget(null);
                                }}
                                className="px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-600 font-extrabold rounded-xl border border-slate-200 text-xs uppercase tracking-wider transition-all"
                            >
                                Manter Agendamento
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmCancelWithReason}
                                disabled={operatingId === cancelTarget.id}
                                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold rounded-xl shadow-lg shadow-rose-600/20 text-xs uppercase tracking-wider transition-all flex items-center gap-2 active:scale-95 cursor-pointer disabled:opacity-50"
                            >
                                {operatingId === cancelTarget.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                                Confirmar Cancelamento
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* MODAL DE EDIÇÃO DE CADASTRO DE AGENDAMENTO */}
            {isEditModalOpen && editTarget && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh] transform transition-all animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="p-6 border-b border-sky-100 bg-sky-50/60 flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-sky-100 flex items-center justify-center text-sky-600 shadow-inner">
                                    <Edit2 className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-base font-black text-slate-900 uppercase tracking-wider">Editar Cadastro do Agendamento</h3>
                                    <p className="text-xs text-sky-700/80 font-bold uppercase tracking-wider mt-0.5">
                                        Protocolo: #{editTarget.id.substring(0, 8).toUpperCase()}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setIsEditModalOpen(false);
                                    setEditTarget(null);
                                }}
                                className="p-2 hover:bg-slate-200/60 rounded-2xl text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Form Content */}
                        <form onSubmit={handleSaveEdit} className="p-6 space-y-6 overflow-y-auto flex-1">
                            {editError && (
                                <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-700 flex items-center gap-2">
                                    ⚠️ {editError}
                                </div>
                            )}

                            {/* SEÇÃO 1: DADOS DO PACIENTE */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                                    <UserIcon className="w-4 h-4 text-sky-600" />
                                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Dados do Paciente</h4>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Nome Completo *</label>
                                        <input
                                            type="text"
                                            value={editPatientName}
                                            onChange={(e) => setEditPatientName(e.target.value)}
                                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none uppercase"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">CPF</label>
                                        <input
                                            type="text"
                                            value={editPatientCpf}
                                            onChange={(e) => handleEditCpfChange(e.target.value)}
                                            maxLength={14}
                                            placeholder="000.000.000-00"
                                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Telefone</label>
                                        <input
                                            type="text"
                                            value={editPatientPhone}
                                            onChange={(e) => setEditPatientPhone(e.target.value)}
                                            placeholder="(00) 00000-0000"
                                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Cartão SUS</label>
                                        <input
                                            type="text"
                                            value={editPatientSusNumber}
                                            onChange={(e) => setEditPatientSusNumber(e.target.value)}
                                            placeholder="Número do SUS"
                                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Bairro</label>
                                        <input
                                            type="text"
                                            value={editPatientNeighborhood}
                                            onChange={(e) => setEditPatientNeighborhood(e.target.value)}
                                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none uppercase"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Endereço (Rua)</label>
                                        <input
                                            type="text"
                                            value={editPatientStreet}
                                            onChange={(e) => setEditPatientStreet(e.target.value)}
                                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none uppercase"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* SEÇÃO 2: DETALHES DO AGENDAMENTO */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                                    <Calendar className="w-4 h-4 text-sky-600" />
                                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Detalhes do Agendamento</h4>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="md:col-span-2">
                                        <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Exame / Consulta *</label>
                                        <select
                                            value={editProcedimentoId}
                                            onChange={(e) => setEditProcedimentoId(e.target.value)}
                                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none uppercase"
                                            required
                                        >
                                            <option value="">Selecione um procedimento</option>
                                            {procedures.map(p => (
                                                <option key={p.id} value={p.id}>
                                                    {p.name} {p.code ? `(CÓD: ${p.code})` : ''} - [{p.type}]
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Data Agendada</label>
                                        <input
                                            type="date"
                                            value={editAppointmentDate}
                                            onChange={(e) => setEditAppointmentDate(e.target.value)}
                                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Horário Agendado</label>
                                        <input
                                            type="time"
                                            value={editAppointmentTime}
                                            onChange={(e) => setEditAppointmentTime(e.target.value)}
                                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Data de Solicitação</label>
                                        <input
                                            type="date"
                                            value={editSolicitationDate}
                                            onChange={(e) => setEditSolicitationDate(e.target.value)}
                                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Prioridade</label>
                                        <select
                                            value={editPriority}
                                            onChange={(e) => setEditPriority(e.target.value as 'Normal' | 'Urgência')}
                                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none"
                                        >
                                            <option value="Normal">Normal</option>
                                            <option value="Urgência">Urgência</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Status</label>
                                        <select
                                            value={editStatus}
                                            onChange={(e) => setEditStatus(e.target.value as ConsultaAgendamento['status'])}
                                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none"
                                        >
                                            <option value="Solicitado">Solicitado</option>
                                            <option value="Agendado">Agendado</option>
                                            <option value="Realizado">Realizado</option>
                                            <option value="Fila de espera">Fila de espera</option>
                                            <option value="Aguardando Data">Aguardando Data</option>
                                            <option value="Retorno">Retorno</option>
                                            <option value="Não Realizado">Não Realizado</option>
                                            <option value="Cancelado">Cancelado</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">É Retorno?</label>
                                        <select
                                            value={editIsRetorno ? 'sim' : 'nao'}
                                            onChange={(e) => setEditIsRetorno(e.target.value === 'sim')}
                                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none"
                                        >
                                            <option value="nao">Não (Primeiro Atendimento)</option>
                                            <option value="sim">Sim (Paciente de Retorno)</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Quantidade de Vagas</label>
                                        <input
                                            type="number"
                                            min={1}
                                            value={editQuantity}
                                            onChange={(e) => setEditQuantity(parseInt(e.target.value) || 1)}
                                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-3 shrink-0 rounded-b-2xl">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsEditModalOpen(false);
                                        setEditTarget(null);
                                    }}
                                    className="px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-600 font-extrabold rounded-xl border border-slate-200 text-xs uppercase tracking-wider transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmittingEdit}
                                    className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-extrabold rounded-xl shadow-lg shadow-sky-600/20 text-xs uppercase tracking-wider transition-all flex items-center gap-2 active:scale-95 cursor-pointer disabled:opacity-50"
                                >
                                    {isSubmittingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                    Salvar Alterações
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};
