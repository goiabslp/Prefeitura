// Tela de Liberação e Gestão de Vagas por Procedimento - Versão Compacta e Organizada
import React, { useState, useEffect, useMemo } from 'react';
import { User, ConsultaProcedimento, ConsultaAgendamento, ConsultaVaga } from '../../types';
import { 
    ArrowLeft, Search, Plus, Calendar, Clock, Edit2, Trash2, 
    PauseCircle, PlayCircle, Activity, Stethoscope, Sparkles, 
    ChevronLeft, ChevronRight, X, Loader2, CalendarDays,
    CheckCircle2, AlertTriangle, Sun, Sunset, Zap, RotateCcw, Check, CalendarCheck,
    Users, ChevronDown, Moon, Wand2, SlidersHorizontal, Layers, Timer, Flame
} from 'lucide-react';
import * as db from '../../services/consultasService';

interface LiberarVagasScreenProps {
    currentUser?: User | null;
    onBack: () => void;
    onNavigate?: (view: string) => void;
}

export const LiberarVagasScreen: React.FC<LiberarVagasScreenProps> = ({
    currentUser,
    onBack,
    onNavigate
}) => {
    const isAdmin = currentUser?.role === 'admin';

    // Estados de procedimentos e busca
    const [procedures, setProcedures] = useState<ConsultaProcedimento[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState<'Todos' | 'Consulta' | 'Exame' | 'Cirurgia'>('Todos');
    const [loading, setLoading] = useState(false);

    // Procedimento selecionado e suas vagas
    const [selectedProc, setSelectedProc] = useState<ConsultaProcedimento | null>(null);
    const [vagas, setVagas] = useState<ConsultaVaga[]>([]);
    const [bookings, setBookings] = useState<ConsultaAgendamento[]>([]);
    const [actionLoading, setActionLoading] = useState(false);

    // Modal de Adicionar Vagas (Calendário)
    const [isAddVagasModalOpen, setIsAddVagasModalOpen] = useState(false);
    const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
    const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
    const [selectedTimes, setSelectedTimes] = useState<string[]>([]);
    const [customTime, setCustomTime] = useState('');
    const [numVagasPorHorario, setNumVagasPorHorario] = useState<number>(1);

    // Estados do Select Moderno e Dinâmico de Horários
    const [isTimeDropdownOpen, setIsTimeDropdownOpen] = useState(false);
    const [timeSearchTerm, setTimeSearchTerm] = useState('');
    const timeDropdownRef = React.useRef<HTMLDivElement>(null);

    // Fechar dropdown ao clicar fora
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (timeDropdownRef.current && !timeDropdownRef.current.contains(event.target as Node)) {
                setIsTimeDropdownOpen(false);
            }
        };
        if (isTimeDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isTimeDropdownOpen]);
    // Modal de Editar Vaga
    const [editingVaga, setEditingVaga] = useState<ConsultaVaga | null>(null);
    const [editDate, setEditDate] = useState('');
    const [editTime, setEditTime] = useState('');
    const [editStatus, setEditStatus] = useState<'Disponível' | 'Pausada'>('Disponível');

    // Carregar procedimentos
    const fetchProcedures = async () => {
        setLoading(true);
        try {
            const data = await db.getProcedimentos();
            setProcedures(data);
        } catch (err) {
            console.error('Erro ao carregar procedimentos:', err);
        } finally {
            setLoading(false);
        }
    };

    // Carregar vagas do procedimento selecionado
    const reloadProcVagas = async (procId: string) => {
        setActionLoading(true);
        try {
            const [vagasData, bookingsData, updatedProcList] = await Promise.all([
                db.getVagas(procId),
                db.getAgendamentos({ procedimentoId: procId }),
                db.getProcedimentos()
            ]);
            setVagas(vagasData);
            setBookings(bookingsData);
            setProcedures(updatedProcList);

            const curr = updatedProcList.find(p => p.id === procId);
            if (curr) setSelectedProc(curr);
        } catch (err) {
            console.error('Erro ao atualizar vagas:', err);
        } finally {
            setActionLoading(false);
        }
    };

    // Inicialização
    useEffect(() => {
        fetchProcedures();
    }, []);

    // Sincronização em tempo real
    useEffect(() => {
        const handleSync = () => {
            fetchProcedures();
            if (selectedProc) {
                reloadProcVagas(selectedProc.id);
            }
        };

        window.addEventListener('consultas-vagas-changed', handleSync);
        window.addEventListener('consultas-procedimentos-changed', handleSync);
        window.addEventListener('consultas-agendamentos-changed', handleSync);

        return () => {
            window.removeEventListener('consultas-vagas-changed', handleSync);
            window.removeEventListener('consultas-procedimentos-changed', handleSync);
            window.removeEventListener('consultas-agendamentos-changed', handleSync);
        };
    }, [selectedProc]);

    useEffect(() => {
        if (selectedProc) {
            reloadProcVagas(selectedProc.id);
        } else {
            setVagas([]);
            setBookings([]);
        }
    }, [selectedProc?.id]);

    // Mapeamento de vagas x agendamentos
    const matchTime = (timeA: string, timeB: string) => {
        return timeA.substring(0, 5) === timeB.substring(0, 5);
    };

    const slotAssignments = useMemo(() => {
        const assignments = new Map<string, ConsultaAgendamento>();
        const slotsByDate: Record<string, ConsultaVaga[]> = {};
        
        vagas.forEach(v => {
            if (!slotsByDate[v.data]) slotsByDate[v.data] = [];
            slotsByDate[v.data].push(v);
        });

        const bookingsByDate: Record<string, ConsultaAgendamento[]> = {};
        bookings.forEach(b => {
            if (b.status === 'Cancelado' || b.status === 'Não Realizado' || !b.appointment_date) return;
            if (!bookingsByDate[b.appointment_date]) bookingsByDate[b.appointment_date] = [];
            bookingsByDate[b.appointment_date].push(b);
        });

        Object.keys(slotsByDate).forEach(dateStr => {
            const slots = slotsByDate[dateStr];
            const bList = bookingsByDate[dateStr] || [];
            const unmatchedBookings = [...bList];
            const matchedBookingIds = new Set<string>();

            // 1ª passada: match exato de horário
            slots.forEach(slot => {
                const exactMatch = bList.find(b => 
                    b.appointment_time && 
                    matchTime(b.appointment_time, slot.hora) &&
                    !matchedBookingIds.has(b.id)
                );
                if (exactMatch) {
                    assignments.set(slot.id, exactMatch);
                    matchedBookingIds.add(exactMatch.id);
                    const idx = unmatchedBookings.findIndex(b => b.id === exactMatch.id);
                    if (idx > -1) unmatchedBookings.splice(idx, 1);
                }
            });

            // 2ª passada: alocar bookings restantes
            slots.forEach(slot => {
                if (!assignments.has(slot.id) && unmatchedBookings.length > 0) {
                    const nextBooking = unmatchedBookings.shift()!;
                    assignments.set(slot.id, nextBooking);
                }
            });
        });

        return assignments;
    }, [vagas, bookings]);

    // Filtragem de procedimentos
    const filteredProcedures = useMemo(() => {
        return procedures.filter(p => {
            const matchesSearch = 
                p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (p.code && p.code.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (p.recurso && p.recurso.toLowerCase().includes(searchTerm.toLowerCase()));
            
            const matchesType = typeFilter === 'Todos' || p.type === typeFilter;
            return matchesSearch && matchesType;
        });
    }, [procedures, searchTerm, typeFilter]);

    // Métricas do procedimento selecionado
    const procStats = useMemo(() => {
        const total = vagas.length;
        const pausadas = vagas.filter(v => v.status === 'Pausada').length;
        const ocupadas = vagas.filter(v => slotAssignments.has(v.id)).length;
        const disponiveis = vagas.filter(v => v.status === 'Disponível' && !slotAssignments.has(v.id)).length;
        return { total, pausadas, ocupadas, disponiveis };
    }, [vagas, slotAssignments]);

    // Métricas gerais
    const globalStats = useMemo(() => {
        const totalProcs = procedures.length;
        const totalCotasDisponiveis = procedures.reduce((acc, p) => acc + (p.available_quantity || 0), 0);
        const totalCotasGerais = procedures.reduce((acc, p) => acc + (p.total_quantity || 0), 0);
        return { totalProcs, totalCotasDisponiveis, totalCotasGerais };
    }, [procedures]);

    // Helpers de data
    const formatDateToYYYYMMDD = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const formatReadableDate = (dateStr: string) => {
        try {
            const [year, month, day] = dateStr.split('-').map(Number);
            const d = new Date(year, month - 1, day);
            return d.toLocaleDateString('pt-BR', { 
                weekday: 'short', 
                day: '2-digit', 
                month: 'short', 
                year: 'numeric' 
            });
        } catch {
            return dateStr;
        }
    };

    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        const days: (Date | null)[] = [];
        for (let i = 0; i < firstDay; i++) {
            days.push(null);
        }
        for (let i = 1; i <= daysInMonth; i++) {
            days.push(new Date(year, month, i));
        }
        return days;
    };

    // Horários no modal - Lista ampla padronizada por turnos
    const HORARIOS_PADRAO = [
        // Manhã
        '07:00', '07:30', '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
        // Tarde
        '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
        // Noite
        '18:00', '18:30', '19:00', '19:30', '20:00'
    ];

    const allDisplayTimes = useMemo(() => {
        const set = new Set([...HORARIOS_PADRAO, ...selectedTimes]);
        return Array.from(set).sort();
    }, [selectedTimes]);

    const filteredSearchTimes = useMemo(() => {
        if (!timeSearchTerm.trim()) return allDisplayTimes;
        const clean = timeSearchTerm.trim().toLowerCase();
        return allDisplayTimes.filter(t => t.toLowerCase().includes(clean));
    }, [allDisplayTimes, timeSearchTerm]);
    // Vagas já cadastradas para a data atualmente selecionada no modal
    const selectedDateStr = selectedDate ? formatDateToYYYYMMDD(selectedDate) : '';
    const existingSlotsForSelectedDate = useMemo(() => {
        if (!selectedDateStr) return [];
        return vagas.filter(v => v.data === selectedDateStr);
    }, [vagas, selectedDateStr]);

    const toggleTime = (time: string) => {
        setSelectedTimes(prev => 
            prev.includes(time) ? prev.filter(t => t !== time) : [...prev, time]
        );
    };

    const handleRemoveTime = (time: string) => {
        setSelectedTimes(prev => prev.filter(t => t !== time));
    };

    const handleSetToday = () => {
        const today = new Date();
        setSelectedDate(today);
        setCurrentMonth(today);
    };

    const handleAddCustomTime = () => {
        if (!customTime) return;
        const formatted = customTime.substring(0, 5);
        if (!selectedTimes.includes(formatted)) {
            setSelectedTimes(prev => [...prev, formatted]);
        }
        setCustomTime('');
    };

    // Ações de Vagas
    const handleConfirmAddVagas = async () => {
        if (!selectedDate || selectedTimes.length === 0 || !selectedProc) return;
        setActionLoading(true);
        try {
            const formattedDate = formatDateToYYYYMMDD(selectedDate);
            const qtd = Math.max(1, numVagasPorHorario);
            const newVagas: Array<{ procedimento_id: string; data: string; hora: string }> = [];

            // Cria individualmente o número de vagas configurado para cada data e horário
            selectedTimes.forEach(t => {
                for (let i = 0; i < qtd; i++) {
                    newVagas.push({
                        procedimento_id: selectedProc.id,
                        data: formattedDate,
                        hora: t
                    });
                }
            });

            await db.createVagas(newVagas);
            setSelectedTimes([]);
            setNumVagasPorHorario(1);
            setIsAddVagasModalOpen(false);
            await reloadProcVagas(selectedProc.id);
        } catch (err: any) {
            console.error('Erro ao adicionar vagas:', err);
            alert(err.message || 'Erro ao adicionar vagas no sistema.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleTogglePauseSlot = async (vaga: ConsultaVaga) => {
        const isCurrentlyPaused = vaga.status === 'Pausada';
        setActionLoading(true);
        try {
            if (isCurrentlyPaused) {
                await db.unpauseVaga(vaga.id);
            } else {
                await db.pauseVaga(vaga.id);
            }
            if (selectedProc) {
                await reloadProcVagas(selectedProc.id);
            }
        } catch (err: any) {
            console.error('Erro ao alterar status da vaga:', err);
            alert(err.message || 'Erro ao pausar/despausar vaga.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleOpenEditSlot = (vaga: ConsultaVaga) => {
        setEditingVaga(vaga);
        setEditDate(vaga.data);
        setEditTime(vaga.hora.substring(0, 5));
        setEditStatus(vaga.status === 'Pausada' ? 'Pausada' : 'Disponível');
    };

    const handleSaveEditSlot = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingVaga || !editDate || !editTime) return;
        setActionLoading(true);
        try {
            await db.updateVaga(editingVaga.id, {
                data: editDate,
                hora: editTime,
                status: editStatus
            });
            setEditingVaga(null);
            if (selectedProc) {
                await reloadProcVagas(selectedProc.id);
            }
        } catch (err: any) {
            console.error('Erro ao salvar edição da vaga:', err);
            alert(err.message || 'Erro ao salvar alterações da vaga.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleDeleteSlot = async (slotId: string) => {
        if (!window.confirm('Deseja realmente excluir esta vaga?')) return;
        setActionLoading(true);
        try {
            await db.deleteVaga(slotId);
            if (selectedProc) {
                await reloadProcVagas(selectedProc.id);
            }
        } catch (err: any) {
            console.error('Erro ao excluir vaga:', err);
            alert(err.message || 'Erro ao excluir vaga.');
        } finally {
            setActionLoading(false);
        }
    };

    // Agrupamento de vagas por data
    const groupedVagas = useMemo(() => {
        const map: Record<string, ConsultaVaga[]> = {};
        vagas.forEach(v => {
            if (!map[v.data]) map[v.data] = [];
            map[v.data].push(v);
        });
        return map;
    }, [vagas]);

    const sortedDates = useMemo(() => {
        return Object.keys(groupedVagas).sort();
    }, [groupedVagas]);

    return (
        <div className="w-full max-w-[99%] 2xl:max-w-[1560px] mx-auto flex flex-col h-full max-h-full min-h-0 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in duration-200">
            
            {/* Header Compacto Sólido */}
            <div className="px-4 py-2.5 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                    <button 
                        onClick={() => {
                            if (selectedProc) {
                                setSelectedProc(null);
                            } else {
                                onBack();
                            }
                        }} 
                        className="p-1.5 -ml-1 text-slate-500 hover:text-sky-600 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-all cursor-pointer shrink-0"
                        title={selectedProc ? "Voltar para Lista de Procedimentos" : "Voltar ao Menu de Consultas"}
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </button>
                    
                    <div className="flex items-center gap-2 min-w-0">
                        <span className="p-1 rounded-md bg-sky-100 text-sky-600 shrink-0">
                            <CalendarDays className="w-3.5 h-3.5" />
                        </span>
                        <h3 className="font-extrabold text-slate-800 text-sm tracking-tight truncate uppercase">
                            {selectedProc ? selectedProc.name : "Liberar Vagas & Gestão de Procedimentos"}
                        </h3>
                        {selectedProc?.code && (
                            <span className="px-1.5 py-0.5 bg-slate-200 text-slate-700 rounded text-[10px] font-bold tracking-wider shrink-0">
                                CÓD. {selectedProc.code}
                            </span>
                        )}
                        {selectedProc?.recurso && selectedProc.recurso !== 'Não Se Aplica' && (
                            <span className="px-1.5 py-0.5 bg-amber-50 border border-amber-200 text-amber-700 rounded text-[10px] font-black uppercase shrink-0">
                                {selectedProc.recurso}
                            </span>
                        )}
                    </div>
                </div>

                {/* Métricas Compactas no Header */}
                <div className="flex items-center gap-2 shrink-0">
                    {!selectedProc ? (
                        <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 bg-white border border-slate-200 px-2.5 py-1 rounded-lg shadow-xs">
                            <span>Procedimentos: <strong className="text-slate-900 font-black">{globalStats.totalProcs}</strong></span>
                            <span className="text-slate-300">•</span>
                            <span>Cotas Livres: <strong className="text-emerald-700 font-black">{globalStats.totalCotasDisponiveis}</strong></span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-1.5">
                            <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 bg-white border border-slate-200 px-2.5 py-1 rounded-lg shadow-xs">
                                <span>Total: <strong className="text-slate-900 font-black">{procStats.total}</strong></span>
                                <span className="text-slate-300">•</span>
                                <span className="text-emerald-700">Livres: <strong className="font-black">{procStats.disponiveis}</strong></span>
                                <span className="text-slate-300">•</span>
                                <span className="text-amber-700">Pausadas: <strong className="font-black">{procStats.pausadas}</strong></span>
                            </div>

                            <button
                                onClick={() => {
                                    setSelectedDate(new Date());
                                    setCurrentMonth(new Date());
                                    setSelectedTimes([]);
                                    setNumVagasPorHorario(1);
                                    setIsAddVagasModalOpen(true);
                                }}
                                className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs uppercase tracking-wider rounded-lg shadow-xs active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Liberar Vagas</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Conteúdo Principal Sólido */}
            <div className="flex-1 overflow-hidden flex flex-col p-3 min-h-0 bg-slate-100">
                {!selectedProc ? (
                    /* LISTAGEM DE PROCEDIMENTOS COMPACTA E ORGANIZADA */
                    <div className="flex-1 flex flex-col min-h-0 space-y-2">
                        {/* Barra de Filtros Compacta */}
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 shrink-0 bg-white p-2 rounded-xl border border-slate-200 shadow-xs">
                            <div className="flex items-center gap-2 w-full sm:w-auto flex-1">
                                <div className="relative flex-1 sm:max-w-xs">
                                    <input
                                        type="text"
                                        placeholder="Filtrar por nome, código..."
                                        className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs font-semibold placeholder:text-slate-400 focus:outline-none focus:border-sky-500 focus:bg-white transition-all text-slate-800"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
                                </div>

                                {/* Filtro por Tipo */}
                                <div className="flex items-center p-0.5 bg-slate-100 rounded-lg shrink-0">
                                    {(['Todos', 'Consulta', 'Exame', 'Cirurgia'] as const).map(t => (
                                        <button
                                            key={t}
                                            onClick={() => setTypeFilter(t)}
                                            className={`px-2 py-1 rounded-md text-[11px] font-bold uppercase transition-all cursor-pointer ${
                                                typeFilter === t
                                                    ? 'bg-white text-slate-900 shadow-xs font-extrabold'
                                                    : 'text-slate-500 hover:text-slate-800'
                                            }`}
                                        >
                                            {t}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="text-[11px] font-bold text-slate-500 shrink-0">
                                {filteredProcedures.length} procedimento(s)
                            </div>
                        </div>

                        {/* Tabela / Lista Tabular Compacta com Background Sólido */}
                        <div className="flex-1 overflow-auto rounded-xl border border-slate-300 bg-white shadow-xs min-h-0">
                            {loading ? (
                                <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
                                    <Loader2 className="w-5 h-5 text-sky-600 animate-spin" />
                                    <span className="text-xs font-semibold">Carregando procedimentos...</span>
                                </div>
                            ) : filteredProcedures.length > 0 ? (
                                <table className="w-full text-left border-separate border-spacing-0 text-xs">
                                    <thead className="sticky top-0 z-20 select-none bg-slate-200">
                                        <tr className="bg-slate-200">
                                            <th className="bg-slate-200 py-2.5 px-3 w-16 text-center border-b border-slate-300 font-extrabold text-[10px] text-slate-700 uppercase tracking-wider sticky top-0" style={{ backgroundColor: '#e2e8f0' }}>Código</th>
                                            <th className="bg-slate-200 py-2.5 px-3 w-24 border-b border-slate-300 font-extrabold text-[10px] text-slate-700 uppercase tracking-wider sticky top-0" style={{ backgroundColor: '#e2e8f0' }}>Tipo</th>
                                            <th className="bg-slate-200 py-2.5 px-3 border-b border-slate-300 font-extrabold text-[10px] text-slate-700 uppercase tracking-wider sticky top-0" style={{ backgroundColor: '#e2e8f0' }}>Procedimento</th>
                                            <th className="bg-slate-200 py-2.5 px-3 w-28 text-center border-b border-slate-300 font-extrabold text-[10px] text-slate-700 uppercase tracking-wider sticky top-0" style={{ backgroundColor: '#e2e8f0' }}>Recurso</th>
                                            <th className="bg-slate-200 py-2.5 px-3 w-24 text-center border-b border-slate-300 font-extrabold text-[10px] text-slate-700 uppercase tracking-wider sticky top-0" style={{ backgroundColor: '#e2e8f0' }}>Status</th>
                                            <th className="bg-slate-200 py-2.5 px-3 w-32 text-right border-b border-slate-300 font-extrabold text-[10px] text-slate-700 uppercase tracking-wider sticky top-0" style={{ backgroundColor: '#e2e8f0' }}>Vagas Livres</th>
                                            <th className="bg-slate-200 py-2.5 px-3 w-28 text-center border-b border-slate-300 font-extrabold text-[10px] text-slate-700 uppercase tracking-wider sticky top-0" style={{ backgroundColor: '#e2e8f0' }}>Ação</th>
                                        </tr>
                                    </thead>
                                    <tbody className="font-medium bg-white">
                                        {filteredProcedures.map(p => {
                                            const typeBadge = (() => {
                                                switch (p.type) {
                                                    case 'Exame':
                                                        return 'bg-sky-50 text-sky-700 border-sky-200';
                                                    case 'Consulta':
                                                        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
                                                    case 'Cirurgia':
                                                    default:
                                                        return 'bg-rose-50 text-rose-700 border-rose-200';
                                                }
                                            })();

                                            const hasVagas = (p.available_quantity || 0) > 0;

                                            return (
                                                <tr 
                                                    key={p.id}
                                                    onClick={() => setSelectedProc(p)}
                                                    className="bg-white hover:bg-sky-50 transition-colors cursor-pointer group"
                                                >
                                                    {/* Código */}
                                                    <td className="py-2 px-3 text-center border-b border-slate-100 bg-white group-hover:bg-sky-50">
                                                        <span className="font-mono text-[10px] font-extrabold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                                                            {p.code || '----'}
                                                        </span>
                                                    </td>

                                                    {/* Tipo */}
                                                    <td className="py-2 px-3 border-b border-slate-100 bg-white group-hover:bg-sky-50">
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${typeBadge}`}>
                                                            {p.type}
                                                        </span>
                                                    </td>

                                                    {/* Nome do Procedimento */}
                                                    <td className="py-2 px-3 border-b border-slate-100 bg-white group-hover:bg-sky-50">
                                                        <span className="font-bold text-slate-800 text-xs group-hover:text-sky-700 transition-colors block truncate max-w-[500px]" title={p.name}>
                                                            {p.name}
                                                        </span>
                                                    </td>

                                                    {/* Recurso */}
                                                    <td className="py-2 px-3 text-center border-b border-slate-100 bg-white group-hover:bg-sky-50">
                                                        {p.recurso && p.recurso !== 'Não Se Aplica' ? (
                                                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-amber-50 text-amber-700 border border-amber-200">
                                                                {p.recurso}
                                                            </span>
                                                        ) : (
                                                            <span className="text-[10px] text-slate-300">-</span>
                                                        )}
                                                    </td>

                                                    {/* Status */}
                                                    <td className="py-2 px-3 text-center border-b border-slate-100 bg-white group-hover:bg-sky-50">
                                                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold ${p.status === 'Ativo' ? 'text-emerald-700' : 'text-slate-400'}`}>
                                                            <span className={`w-1.5 h-1.5 rounded-full ${p.status === 'Ativo' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                                                            {p.status}
                                                        </span>
                                                    </td>

                                                    {/* Vagas Livres */}
                                                    <td className="py-2 px-3 text-right font-mono border-b border-slate-100 bg-white group-hover:bg-sky-50">
                                                        <span className={`font-black text-xs ${hasVagas ? 'text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded' : 'text-slate-400'}`}>
                                                            {p.available_quantity || 0} cotas
                                                        </span>
                                                    </td>

                                                    {/* Botão Ação */}
                                                    <td className="py-2 px-3 text-center border-b border-slate-100 bg-white group-hover:bg-sky-50">
                                                        <button
                                                            type="button"
                                                            className="px-2.5 py-1 bg-sky-50 hover:bg-sky-600 text-sky-700 hover:text-white border border-sky-200 font-extrabold rounded-lg text-[10px] uppercase tracking-wider transition-all cursor-pointer inline-flex items-center gap-1"
                                                        >
                                                            <span>Liberar Vagas</span>
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="p-8 text-center text-slate-400 text-xs font-semibold">
                                    Nenhum procedimento encontrado para o filtro selecionado.
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    /* GESTÃO DE VAGAS DO PROCEDIMENTO SELECIONADO COMPACTA */
                    <div className="flex-1 overflow-auto space-y-3 min-h-0">
                        {actionLoading && (
                            <div className="flex items-center justify-center py-1.5 text-xs font-bold text-sky-600 gap-1.5 bg-white rounded-lg border border-slate-200 shadow-xs">
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Sincronizando vagas...</span>
                            </div>
                        )}

                        {/* Listagem das Datas e Horários Compacta */}
                        {sortedDates.length > 0 ? (
                            <div className="space-y-3">
                                {sortedDates.map(dateStr => {
                                    const dateSlots = groupedVagas[dateStr] || [];
                                    const sortedSlots = [...dateSlots].sort((a, b) => a.hora.localeCompare(b.hora));

                                    return (
                                        <div key={dateStr} className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs space-y-2">
                                            {/* Cabeçalho da Data Compacto */}
                                            <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 text-xs">
                                                <div className="flex items-center gap-2">
                                                    <Calendar className="w-3.5 h-3.5 text-sky-600" />
                                                    <span className="font-extrabold text-slate-800 capitalize">
                                                        {formatReadableDate(dateStr)}
                                                    </span>
                                                </div>
                                                <span className="text-[10px] font-bold text-slate-400">
                                                    {dateSlots.length} horário(s)
                                                </span>
                                            </div>

                                            {/* Pílulas Compactas de Horários */}
                                            <div className="flex flex-wrap gap-2">
                                                {sortedSlots.map(v => {
                                                    const activeBooking = slotAssignments.get(v.id);
                                                    const isPaused = v.status === 'Pausada';
                                                    const isBooked = !!activeBooking;
                                                    const patientName = activeBooking?.paciente?.name;

                                                    const pillStyle = (() => {
                                                        if (isBooked) {
                                                            return 'bg-indigo-50 border-indigo-200 text-indigo-900';
                                                        }
                                                        if (isPaused) {
                                                            return 'bg-amber-50 border-amber-200 text-amber-900';
                                                        }
                                                        return 'bg-slate-100 hover:bg-white border-slate-200 text-slate-800';
                                                    })();

                                                    return (
                                                        <div 
                                                            key={v.id}
                                                            className={`px-2.5 py-1 rounded-lg border text-xs font-semibold flex items-center gap-2 shadow-xs transition-all ${pillStyle}`}
                                                            title={patientName ? `Paciente: ${patientName}` : undefined}
                                                        >
                                                            {/* Horário */}
                                                            <div className="flex items-center gap-1 font-mono font-black text-xs">
                                                                <Clock className="w-3 h-3 text-slate-400" />
                                                                <span>{v.hora.substring(0, 5)}</span>
                                                            </div>

                                                            {/* Paciente ou Badge Status */}
                                                            {patientName ? (
                                                                <span className="text-[10px] font-bold text-indigo-700 max-w-[120px] truncate" title={patientName}>
                                                                    {patientName.split(' ')[0]}
                                                                </span>
                                                            ) : isPaused ? (
                                                                <span className="px-1 py-0.2 bg-amber-100 text-amber-800 rounded text-[9px] font-extrabold uppercase">
                                                                    Pausada
                                                                </span>
                                                            ) : (
                                                                <span className="px-1 py-0.2 bg-emerald-100 text-emerald-800 rounded text-[9px] font-extrabold uppercase">
                                                                    Livre
                                                                </span>
                                                            )}

                                                            {/* Ações Compactas no Hover / Inline */}
                                                            {!isBooked && (
                                                                <div className="flex items-center gap-1 ml-1 border-l border-slate-200 pl-1.5">
                                                                    {/* Pausar / Despausar */}
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleTogglePauseSlot(v)}
                                                                        disabled={actionLoading}
                                                                        className={`p-0.5 rounded transition-colors cursor-pointer ${
                                                                            isPaused 
                                                                                ? 'text-emerald-600 hover:bg-emerald-100' 
                                                                                : 'text-amber-600 hover:bg-amber-100'
                                                                        }`}
                                                                        title={isPaused ? "Reativar Vaga" : "Pausar Vaga"}
                                                                    >
                                                                        {isPaused ? <PlayCircle className="w-3 h-3" /> : <PauseCircle className="w-3 h-3" />}
                                                                    </button>

                                                                    {/* Editar */}
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleOpenEditSlot(v)}
                                                                        disabled={actionLoading}
                                                                        className="p-0.5 rounded text-slate-400 hover:text-sky-600 hover:bg-slate-200 transition-colors cursor-pointer"
                                                                        title="Editar Horário"
                                                                    >
                                                                        <Edit2 className="w-3 h-3" />
                                                                    </button>

                                                                    {/* Excluir */}
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleDeleteSlot(v.id)}
                                                                        disabled={actionLoading}
                                                                        className="p-0.5 rounded text-slate-400 hover:text-rose-600 hover:bg-slate-200 transition-colors cursor-pointer"
                                                                        title="Excluir Vaga"
                                                                    >
                                                                        <Trash2 className="w-3 h-3" />
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-center py-12 bg-white border border-dashed border-slate-200 rounded-2xl p-6 space-y-2">
                                <Calendar className="w-8 h-8 text-slate-300 mx-auto" />
                                <h4 className="text-xs font-bold text-slate-700 uppercase">
                                    Nenhuma vaga cadastrada para este procedimento
                                </h4>
                                <button
                                    onClick={() => {
                                        setSelectedDate(new Date());
                                        setCurrentMonth(new Date());
                                        setSelectedTimes([]);
                                        setNumVagasPorHorario(1);
                                        setIsAddVagasModalOpen(true);
                                    }}
                                    className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs uppercase rounded-lg shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    <span>Liberar Primeiras Vagas</span>
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* MODAL MODERNO E DINÂMICO: ADICIONAR VAGAS */}
            {isAddVagasModalOpen && selectedProc && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-white rounded-[2rem] shadow-2xl shadow-slate-900/20 w-full max-w-5xl lg:max-w-6xl overflow-hidden border border-slate-200/90 flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
                        
                        {/* Header Moderno com Cores e Tipografia Governamental Premium */}
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
                            <div className="flex items-center gap-3.5 min-w-0">
                                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-sky-500 via-indigo-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-sky-500/25 ring-4 ring-sky-50 shrink-0">
                                    <CalendarCheck className="w-5 h-5 drop-shadow-xs" />
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">
                                            Liberar Vagas por Horário
                                        </h3>
                                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-sky-50 text-sky-700 border border-sky-200 shadow-2xs">
                                            {selectedProc.type}
                                        </span>
                                        {selectedProc.code && (
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                                CÓD. {selectedProc.code}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs font-bold text-slate-500 truncate max-w-xl mt-0.5">
                                        {selectedProc.name}
                                    </p>
                                </div>
                            </div>

                            <button 
                                onClick={() => { setIsAddVagasModalOpen(false); setSelectedTimes([]); setNumVagasPorHorario(1); }} 
                                className="w-9 h-9 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-all cursor-pointer shadow-2xs hover:scale-105 active:scale-95 shrink-0 ml-2"
                                title="Fechar modal"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Corpo Modal Amplo em 2 Colunas */}
                        <div className="overflow-y-auto custom-scrollbar flex-1 flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-slate-100 bg-slate-50/20">
                            
                            {/* Lado Esquerdo: Calendário Espaçoso e Resumo da Data */}
                            <div className="w-full lg:w-[410px] shrink-0 p-6 flex flex-col space-y-4 bg-slate-50/40">
                                <div className="flex items-center justify-between pb-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                                            {currentMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={handleSetToday}
                                            className="px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider bg-sky-100 hover:bg-sky-200 text-sky-800 rounded-md transition-colors cursor-pointer"
                                        >
                                            Hoje
                                        </button>
                                    </div>

                                    <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
                                        <button 
                                            type="button"
                                            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
                                            className="w-7 h-7 flex items-center justify-center hover:bg-slate-100 rounded-lg text-slate-600 transition-colors cursor-pointer"
                                            title="Mês anterior"
                                        >
                                            <ChevronLeft className="w-4 h-4" />
                                        </button>
                                        <button 
                                            type="button"
                                            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
                                            className="w-7 h-7 flex items-center justify-center hover:bg-slate-100 rounded-lg text-slate-600 transition-colors cursor-pointer"
                                            title="Próximo mês"
                                        >
                                            <ChevronRight className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                {/* Cabeçalho dos Dias da Semana */}
                                <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] font-black text-slate-400 uppercase py-1.5 bg-white border border-slate-100 rounded-xl shadow-2xs">
                                    <span>Dom</span><span>Seg</span><span>Ter</span><span>Qua</span><span>Qui</span><span>Sex</span><span>Sáb</span>
                                </div>

                                {/* Grade de Dias Espaçosa */}
                                <div className="grid grid-cols-7 gap-1.5">
                                    {getDaysInMonth(currentMonth).map((day, idx) => {
                                        if (!day) return <div key={`empty-${idx}`} className="h-9"></div>;
                                        const formattedDay = formatDateToYYYYMMDD(day);
                                        const isSelected = selectedDate && formattedDay === formatDateToYYYYMMDD(selectedDate);
                                        const isToday = formattedDay === formatDateToYYYYMMDD(new Date());
                                        const isPast = day.getTime() < new Date(new Date().setHours(0,0,0,0)).getTime();
                                        const existingCount = vagas.filter(v => v.data === formattedDay).length;

                                        return (
                                            <button
                                                key={day.toISOString()}
                                                type="button"
                                                onClick={() => setSelectedDate(day)}
                                                disabled={isPast}
                                                className={`h-9 w-full rounded-xl text-xs font-bold transition-all relative flex flex-col items-center justify-center cursor-pointer ${
                                                    isSelected 
                                                    ? 'bg-gradient-to-br from-sky-600 to-indigo-600 text-white font-black shadow-md shadow-sky-500/30 scale-105 z-10 ring-2 ring-white' 
                                                    : isToday
                                                    ? 'border-2 border-sky-500 text-sky-700 bg-sky-50/70 hover:bg-sky-100 font-black'
                                                    : isPast
                                                    ? 'text-slate-300 cursor-not-allowed bg-slate-50/50'
                                                    : 'hover:bg-white text-slate-700 bg-white/60 hover:shadow-2xs border border-transparent hover:border-slate-200 active:scale-95'
                                                }`}
                                            >
                                                <span>{day.getDate()}</span>
                                                {/* Indicador de vagas existentes no dia */}
                                                {existingCount > 0 && (
                                                    <span 
                                                        className={`w-1.5 h-1.5 rounded-full absolute bottom-1 ${isSelected ? 'bg-white' : 'bg-emerald-500'}`} 
                                                        title={`${existingCount} vaga(s) já cadastrada(s)`} 
                                                    />
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>

                                <div className="flex items-center gap-4 pt-1 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                                    <span className="flex items-center gap-1.5">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-xs" />
                                        Com Vagas
                                    </span>
                                    <span className="flex items-center gap-1.5">
                                        <span className="w-2 h-2 rounded-full border-2 border-sky-500" />
                                        Hoje
                                    </span>
                                </div>

                                {/* Card da Data Selecionada e Vagas Existentes */}
                                <div className="mt-2 p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                                    <div className="flex items-center justify-between text-[10px] font-black uppercase text-sky-700 tracking-wider">
                                        <span>Data Selecionada</span>
                                        <Calendar className="w-4 h-4 text-sky-600" />
                                    </div>
                                    <div className="text-sm font-black text-slate-800 capitalize leading-snug">
                                        {selectedDate ? selectedDate.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }) : 'Nenhuma data selecionada'}
                                    </div>

                                    {/* Resumo de vagas já abertas neste dia */}
                                    <div className="pt-2.5 border-t border-slate-100">
                                        <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 mb-1.5">
                                            <span>Vagas existentes neste dia:</span>
                                            <span className={`px-2 py-0.2 rounded-full font-black text-[10px] ${existingSlotsForSelectedDate.length > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600'}`}>
                                                {existingSlotsForSelectedDate.length} vaga(s)
                                            </span>
                                        </div>
                                        {existingSlotsForSelectedDate.length > 0 ? (
                                            <div className="flex flex-wrap gap-1 max-h-[75px] overflow-y-auto custom-scrollbar pt-1">
                                                {existingSlotsForSelectedDate.map(v => (
                                                    <span key={v.id} className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                                                        {v.hora.substring(0, 5)} {v.status === 'Ocupada' ? '(Ocupada)' : ''}
                                                    </span>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-[10px] text-slate-400 italic">Grade livre para novos cadastros.</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Lado Direito: Seleção Dinâmica e Moderna de Horários */}
                            <div className="flex-1 p-6 flex flex-col space-y-5 bg-white">
                                
                                {/* 1. Controle de Vagas por Horário com Presets Rápidos */}
                                <div className="bg-gradient-to-r from-sky-50/70 via-indigo-50/40 to-slate-50/70 p-4 rounded-2xl border border-sky-100/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-2xl bg-white text-sky-700 border border-sky-200 flex items-center justify-center font-black shadow-xs shrink-0">
                                            <Users className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block leading-tight">
                                                Número de Vagas
                                            </span>
                                            <span className="text-xs font-bold text-slate-700 block">
                                                Criadas por cada horário selecionado
                                            </span>
                                        </div>
                                    </div>

                                    {/* Stepper numérico */}
                                    <div className="flex items-center self-end sm:self-auto">
                                        <div className="flex items-center bg-white border border-slate-200 rounded-xl p-0.5 shadow-2xs">
                                            <button
                                                type="button"
                                                onClick={() => setNumVagasPorHorario(prev => Math.max(1, prev - 1))}
                                                className="w-7 h-7 bg-slate-50 hover:bg-slate-100 active:scale-95 rounded-lg text-slate-700 font-black text-sm flex items-center justify-center cursor-pointer transition-all"
                                                title="Diminuir (-1)"
                                            >
                                                -
                                            </button>
                                            <span className="w-10 text-center font-mono font-black text-xs text-sky-700">
                                                {numVagasPorHorario}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => setNumVagasPorHorario(prev => Math.min(100, prev + 1))}
                                                className="w-7 h-7 bg-slate-50 hover:bg-slate-100 active:scale-95 rounded-lg text-slate-700 font-black text-sm flex items-center justify-center cursor-pointer transition-all"
                                                title="Aumentar (+1)"
                                            >
                                                +
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* 2. Select Moderno e Dinâmico de Horários (Compacto, não ocupa espaço vertical) */}
                                <div ref={timeDropdownRef} className="relative space-y-2">
                                    <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-slate-500">
                                        <span className="flex items-center gap-1.5">
                                            <Clock className="w-3.5 h-3.5 text-sky-600" />
                                            Horários da Agenda
                                        </span>
                                        {selectedTimes.length > 0 && (
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedTimes([]);
                                                }}
                                                className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase transition-colors cursor-pointer flex items-center gap-1"
                                                title="Desmarcar todos os horários"
                                            >
                                                <RotateCcw className="w-3 h-3" />
                                                <span>Limpar seleção ({selectedTimes.length})</span>
                                            </button>
                                        )}
                                    </div>

                                    {/* Botão Trigger do Select */}
                                    <button
                                        type="button"
                                        onClick={() => setIsTimeDropdownOpen(prev => !prev)}
                                        className={`w-full min-h-[48px] bg-white border rounded-2xl px-3.5 py-2 flex items-center justify-between gap-3 text-left transition-all cursor-pointer shadow-2xs ${
                                            isTimeDropdownOpen
                                                ? 'border-sky-500 ring-2 ring-sky-500/20 shadow-md'
                                                : 'border-slate-200/90 hover:border-sky-300 hover:bg-slate-50/50'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                                            {selectedTimes.length === 0 ? (
                                                <div className="flex items-center gap-2.5 text-slate-400 py-0.5">
                                                    <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                                                    <span className="text-xs font-semibold">
                                                        Toque para abrir e selecionar os horários...
                                                    </span>
                                                </div>
                                            ) : (
                                                <>
                                                    {selectedTimes.slice(0, 5).map(t => (
                                                        <span
                                                            key={t}
                                                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-sky-50 border border-sky-200 text-sky-800 text-xs font-mono font-black rounded-lg shadow-2xs"
                                                        >
                                                            <span>{t}</span>
                                                            <span
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleRemoveTime(t);
                                                                }}
                                                                className="hover:text-rose-600 cursor-pointer ml-0.5"
                                                                title="Remover este horário"
                                                            >
                                                                <X className="w-3 h-3" />
                                                            </span>
                                                        </span>
                                                    ))}
                                                    {selectedTimes.length > 5 && (
                                                        <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold rounded-lg">
                                                            +{selectedTimes.length - 5} outros
                                                        </span>
                                                    )}
                                                </>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0">
                                            {selectedTimes.length > 0 && (
                                                <span className="px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 text-[10px] font-black uppercase tracking-wider">
                                                    {selectedTimes.length} selecionado{selectedTimes.length > 1 ? 's' : ''}
                                                </span>
                                            )}
                                            <div className={`w-7 h-7 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 transition-transform duration-200 ${
                                                isTimeDropdownOpen ? 'rotate-180 bg-sky-100 text-sky-700' : ''
                                            }`}>
                                                <ChevronDown className="w-4 h-4" />
                                            </div>
                                        </div>
                                    </button>

                                    {/* Popover Dropdown Flutuante de Seleção Dinâmica */}
                                    {isTimeDropdownOpen && (
                                        <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-white rounded-2xl shadow-2xl shadow-slate-900/20 border border-slate-200/90 p-4 space-y-3.5 animate-in fade-in zoom-in-95 duration-150 ring-1 ring-black/5">
                                            
                                            {/* Barra de Filtro e Ações em Lote */}
                                            <div className="flex items-center gap-2">
                                                <div className="relative flex-1">
                                                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                                    <input
                                                        type="text"
                                                        value={timeSearchTerm}
                                                        onChange={(e) => setTimeSearchTerm(e.target.value)}
                                                        placeholder="Filtrar horários (ex: 08, 14:30)..."
                                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs font-mono font-bold text-slate-800 placeholder:text-slate-400 placeholder:font-sans outline-none focus:border-sky-500 focus:bg-white transition-colors"
                                                        autoFocus
                                                    />
                                                    {timeSearchTerm && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setTimeSearchTerm('')}
                                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                                        >
                                                            <X className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                </div>

                                                {/* Botão Selecionar Todos os Filtrados */}
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const allIncluded = filteredSearchTimes.every(t => selectedTimes.includes(t));
                                                        if (allIncluded) {
                                                            setSelectedTimes(prev => prev.filter(t => !filteredSearchTimes.includes(t)));
                                                        } else {
                                                            setSelectedTimes(prev => Array.from(new Set([...prev, ...filteredSearchTimes])).sort());
                                                        }
                                                    }}
                                                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] uppercase rounded-xl transition-colors cursor-pointer shrink-0"
                                                >
                                                    {filteredSearchTimes.every(t => selectedTimes.includes(t)) ? 'Desmarcar' : 'Marcar Todos'}
                                                </button>
                                            </div>

                                            {/* Grade Dinâmica com Rolagem Suave */}
                                            <div className="space-y-1.5">
                                                <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">
                                                    <span>Toque para marcar/desmarcar:</span>
                                                    <span>{filteredSearchTimes.length} horários listados</span>
                                                </div>

                                                <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5 max-h-[190px] overflow-y-auto custom-scrollbar p-1">
                                                    {filteredSearchTimes.length === 0 ? (
                                                        <div className="col-span-full py-6 text-center text-xs text-slate-400 font-medium">
                                                            Nenhum horário encontrado para "{timeSearchTerm}".
                                                        </div>
                                                    ) : (
                                                        filteredSearchTimes.map(t => {
                                                            const isSelected = selectedTimes.includes(t);
                                                            const hasExisting = existingSlotsForSelectedDate.some(v => v.hora.substring(0, 5) === t);

                                                            return (
                                                                <button
                                                                    key={t}
                                                                    type="button"
                                                                    onClick={() => toggleTime(t)}
                                                                    className={`py-2 px-1 rounded-xl text-xs font-mono font-bold transition-all border flex items-center justify-center gap-1 cursor-pointer relative ${
                                                                        isSelected
                                                                            ? 'bg-sky-600 border-sky-600 text-white font-black shadow-xs scale-[1.02]'
                                                                            : 'bg-slate-50/90 border-slate-200/90 text-slate-700 hover:bg-sky-50 hover:border-sky-300 hover:text-sky-700'
                                                                    }`}
                                                                >
                                                                    {isSelected && <Check className="w-3 h-3 shrink-0 stroke-[3]" />}
                                                                    <span>{t}</span>
                                                                    {hasExisting && (
                                                                        <span 
                                                                            className={`w-1.5 h-1.5 rounded-full absolute top-1 right-1 ${isSelected ? 'bg-amber-300' : 'bg-emerald-500'}`} 
                                                                            title="Já existe vaga cadastrada para este horário no dia"
                                                                        />
                                                                    )}
                                                                </button>
                                                            );
                                                        })
                                                    )}
                                                </div>
                                            </div>

                                            {/* Inclusão de Horário Avulso + Botão Concluir */}
                                            <div className="pt-2.5 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2.5">
                                                <div className="flex items-center gap-1.5 w-full sm:w-auto">
                                                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 shrink-0">
                                                        Avulso:
                                                    </span>
                                                    <input
                                                        type="time"
                                                        value={customTime}
                                                        onChange={(e) => setCustomTime(e.target.value)}
                                                        className="bg-slate-50 border border-slate-200 rounded-xl px-2 py-1 text-xs font-mono font-bold text-slate-800 outline-none focus:border-sky-500 w-24"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={handleAddCustomTime}
                                                        disabled={!customTime}
                                                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-900 disabled:opacity-30 text-white font-bold rounded-xl text-xs uppercase cursor-pointer transition-all shrink-0 flex items-center gap-1"
                                                    >
                                                        <Plus className="w-3 h-3" />
                                                        <span>Incluir</span>
                                                    </button>
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={() => setIsTimeDropdownOpen(false)}
                                                    className="w-full sm:w-auto px-4 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs uppercase rounded-xl cursor-pointer shadow-xs transition-all active:scale-95"
                                                >
                                                    Concluir Seleção ({selectedTimes.length})
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* 5. Resumo Visual dos Horários Selecionados */}
                                {selectedTimes.length > 0 && (
                                    <div className="p-3 bg-sky-50/80 rounded-2xl border border-sky-100 space-y-2">
                                        <div className="flex items-center justify-between text-[11px] font-black text-sky-950">
                                            <span className="flex items-center gap-1.5">
                                                <CheckCircle2 className="w-4 h-4 text-sky-600" />
                                                Horários Prontos para Liberação:
                                            </span>
                                            <span className="px-2.5 py-0.5 rounded-full bg-sky-200 text-sky-900 text-[10px] font-black tracking-wider shadow-2xs">
                                                {selectedTimes.length * numVagasPorHorario} vaga(s) no total
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap gap-1.5 max-h-[85px] overflow-y-auto custom-scrollbar pt-0.5">
                                            {selectedTimes.sort().map(t => (
                                                <span 
                                                    key={t}
                                                    onClick={() => handleRemoveTime(t)}
                                                    className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-sky-200 text-sky-900 rounded-lg font-mono text-[11px] font-black hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 cursor-pointer transition-all shadow-2xs group"
                                                    title="Clique para remover este horário"
                                                >
                                                    <span>{t}</span>
                                                    {numVagasPorHorario > 1 && (
                                                        <span className="text-[9px] text-sky-700 font-black bg-sky-100 px-1 rounded">
                                                            ×{numVagasPorHorario}
                                                        </span>
                                                    )}
                                                    <X className="w-3 h-3 text-slate-400 group-hover:text-rose-600 group-hover:scale-125 transition-transform" />
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer Moderno e Amplo */}
                        <div className="px-6 py-4 border-t border-slate-100 bg-white flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
                            <div className="text-xs font-semibold text-slate-500 text-center sm:text-left">
                                {selectedTimes.length > 0 ? (
                                    <span>
                                        Total a liberar: <strong className="text-sky-700 font-black text-sm">{selectedTimes.length * numVagasPorHorario} vaga(s)</strong> {numVagasPorHorario > 1 ? `(${selectedTimes.length} horários × ${numVagasPorHorario} vagas)` : `(${selectedTimes.length} horário(s))`} para <strong>{selectedDate ? selectedDate.toLocaleDateString('pt-BR') : ''}</strong>
                                    </span>
                                ) : (
                                    <span className="text-slate-400 font-medium">Selecione ao menos 1 horário no painel acima para liberar as vagas</span>
                                )}
                            </div>

                            <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                                <button
                                    type="button"
                                    onClick={() => { setIsAddVagasModalOpen(false); setSelectedTimes([]); setNumVagasPorHorario(1); }}
                                    className="px-4 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer shadow-2xs"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    onClick={handleConfirmAddVagas}
                                    disabled={!selectedDate || selectedTimes.length === 0 || actionLoading}
                                    className="px-6 py-2.5 bg-gradient-to-r from-sky-600 via-indigo-600 to-indigo-700 hover:from-sky-700 hover:to-indigo-800 text-white font-black rounded-xl shadow-lg shadow-sky-500/25 disabled:opacity-40 disabled:shadow-none transition-all text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                                >
                                    {actionLoading ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            <span>Salvando Vagas...</span>
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle2 className="w-4 h-4" />
                                            <span>Liberar Vagas ({selectedTimes.length * numVagasPorHorario})</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL: EDITAR VAGA */}
            {editingVaga && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden border border-slate-100 flex flex-col">
                        <div className="p-3.5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide">
                                Editar Vaga
                            </h3>
                            <button onClick={() => setEditingVaga(null)} className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <form onSubmit={handleSaveEditSlot} className="p-4 space-y-3">
                            <div>
                                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                                    Data da Vaga
                                </label>
                                <input
                                    type="date"
                                    value={editDate}
                                    onChange={(e) => setEditDate(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-800 outline-none"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                                    Horário da Vaga
                                </label>
                                <input
                                    type="time"
                                    value={editTime}
                                    onChange={(e) => setEditTime(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-800 outline-none"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                                    Status
                                </label>
                                <div className="flex gap-4 pt-1">
                                    {(['Disponível', 'Pausada'] as const).map(st => (
                                        <label key={st} className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-slate-700">
                                            <input
                                                type="radio"
                                                name="editSlotStatus"
                                                value={st}
                                                checked={editStatus === st}
                                                onChange={() => setEditStatus(st)}
                                                className="w-3.5 h-3.5 text-sky-600"
                                            />
                                            {st}
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setEditingVaga(null)}
                                    className="px-3 py-1.5 border border-slate-200 text-slate-600 font-bold rounded-lg text-xs uppercase cursor-pointer"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={actionLoading}
                                    className="px-4 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-lg text-xs uppercase shadow-xs flex items-center gap-1 cursor-pointer"
                                >
                                    {actionLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                                    Salvar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
