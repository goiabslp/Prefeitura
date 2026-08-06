import React, { useState, useEffect, useMemo } from 'react';
import { User, ConsultaPaciente, ConsultaProcedimento, ConsultaAgendamento, ConsultaVaga } from '../../types';
import { ArrowLeft, Users, Calendar, Settings, BarChart3, Plus, Edit2, Search, Check, AlertTriangle, Loader2, History, X, ChevronLeft, ChevronRight, Activity, Stethoscope, Sparkles, Trash2, ShieldCheck, UserCheck, FileSpreadsheet, TrendingUp, UserCog } from 'lucide-react';
import * as db from '../../services/consultasService';
import { seedDefaultProcedures } from '../../services/procedimentosSeed';
import { ResponsiveContainer, AreaChart, XAxis, YAxis, Tooltip, Area, CartesianGrid } from 'recharts';
import { PacientesTab, formatPatientName } from '../common/PacientesTab';

interface DadosScreenProps {
    currentUser: User;
    onBack: () => void;
    subView?: string;
    onNavigate?: (view: string) => void;
}

type TabType = 'dashboard' | 'pacientes' | 'historico' | 'procedimentos' | 'gestor';

export const DadosScreen: React.FC<DadosScreenProps> = ({
    currentUser,
    onBack,
    subView,
    onNavigate
}) => {
    const isAdmin = currentUser.role === 'admin';
    // Current Active Tab derived from URL sub-view state
    const activeTab = (() => {
        if (subView === 'dados-pacientes') return 'pacientes';
        if (subView === 'dados-procedimentos') return 'procedimentos';
        if (subView === 'dados-historico') return 'historico';
        if (subView === 'dados-gestor' && isAdmin) return 'gestor';
        return 'dashboard';
    })();
    const [loading, setLoading] = useState(false);

    // Vagas / Detail states
    const [selectedProc, setSelectedProc] = useState<ConsultaProcedimento | null>(null);
    const [vagas, setVagas] = useState<ConsultaVaga[]>([]);
    const [procBookings, setProcBookings] = useState<ConsultaAgendamento[]>([]);
    const [isAddVagasModalOpen, setIsAddVagasModalOpen] = useState(false);
    
    // Calendar Picker Modal States
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
    const [selectedTimes, setSelectedTimes] = useState<string[]>([]);
    const [customTime, setCustomTime] = useState('');

    const matchTime = (timeA: string, timeB: string) => {
        const cleanA = timeA.substring(0, 5);
        const cleanB = timeB.substring(0, 5);
        return cleanA === cleanB;
    };

    const slotAssignments = useMemo(() => {
        const assignments = new Map<string, ConsultaAgendamento>();
        
        // Group slots by date
        const slotsByDate: { [date: string]: ConsultaVaga[] } = {};
        vagas.forEach(v => {
            if (!slotsByDate[v.data]) {
                slotsByDate[v.data] = [];
            }
            slotsByDate[v.data].push(v);
        });

        // Group bookings by date (excluding cancelados/não realizados)
        const bookingsByDate: { [date: string]: ConsultaAgendamento[] } = {};
        procBookings.forEach(b => {
            if (b.status === 'Cancelado' || b.status === 'Não Realizado' || !b.appointment_date) return;
            if (!bookingsByDate[b.appointment_date]) {
                bookingsByDate[b.appointment_date] = [];
            }
            bookingsByDate[b.appointment_date].push(b);
        });

        // Match for each date
        Object.keys(slotsByDate).forEach(dateStr => {
            const slots = slotsByDate[dateStr];
            const bookings = bookingsByDate[dateStr] || [];
            
            const unmatchedBookings = [...bookings];
            const matchedBookingIds = new Set<string>();

            // First pass: Match exact times
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

            // Second pass: Match remaining bookings to remaining unmatched slots
            slots.forEach(slot => {
                if (!assignments.has(slot.id) && unmatchedBookings.length > 0) {
                    const nextBooking = unmatchedBookings.shift()!;
                    assignments.set(slot.id, nextBooking);
                }
            });
        });

        return assignments;
    }, [vagas, procBookings]);

    // Fetch and reload vagas functions
    const reloadVagas = async () => {
        if (!selectedProc) return;
        try {
            const [vagasData, bookingsData] = await Promise.all([
                db.getVagas(selectedProc.id),
                db.getAgendamentos({ procedimentoId: selectedProc.id })
            ]);
            setVagas(vagasData);
            setProcBookings(bookingsData);
            
            // Also refresh stats so quantities stay in sync
            const statsData = await db.getDashboardStats();
            setStats(statsData);
            
            // And reload procedures list to show updated quantities
            const procData = await db.getProcedimentos();
            setProcedures(procData);
            
            // If the active procedure details are open, also update the selectedProc counts
            const updated = procData.find(p => p.id === selectedProc.id);
            if (updated) {
                setSelectedProc(updated);
            }
        } catch (err) {
            console.error('Error reloading data:', err);
        }
    };

    useEffect(() => {
        const fetchVagas = async () => {
            if (!selectedProc) return;
            setLoading(true);
            try {
                const [vagasData, bookingsData] = await Promise.all([
                    db.getVagas(selectedProc.id),
                    db.getAgendamentos({ procedimentoId: selectedProc.id })
                ]);
                setVagas(vagasData);
                setProcBookings(bookingsData);
            } catch (err) {
                console.error('Error fetching vagas:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchVagas();
    }, [selectedProc]);

    const toggleTime = (time: string) => {
        if (selectedTimes.includes(time)) {
            setSelectedTimes(selectedTimes.filter(t => t !== time));
        } else {
            setSelectedTimes([...selectedTimes, time]);
        }
    };

    const addCustomTime = () => {
        if (!customTime) return;
        if (!selectedTimes.includes(customTime)) {
            setSelectedTimes([...selectedTimes, customTime]);
        }
        setCustomTime('');
    };

    const formatDateToYYYYMMDD = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const handleConfirmAddVagas = async () => {
        if (!selectedDate || selectedTimes.length === 0 || !selectedProc) return;
        setLoading(true);
        try {
            const formattedDate = formatDateToYYYYMMDD(selectedDate);
            const newVagas = selectedTimes.map(t => ({
                procedimento_id: selectedProc.id,
                data: formattedDate,
                hora: t
            }));

            await db.createVagas(newVagas);
            
            setSelectedTimes([]);
            setIsAddVagasModalOpen(false);
            await reloadVagas();
        } catch (err) {
            console.error('Error creating vagas:', err);
            alert('Erro ao criar vagas. Por favor, verifique se a tabela de vagas foi criada no banco de dados.');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteSlot = async (slotId: string) => {
        if (!window.confirm('Deseja realmente excluir esta vaga?')) return;
        setLoading(true);
        try {
            await db.deleteVaga(slotId);
            await reloadVagas();
        } catch (err) {
            console.error('Error deleting vaga:', err);
            alert('Erro ao deletar vaga.');
        } finally {
            setLoading(false);
        }
    };

    const handleDeletePatient = async (patientId: string) => {
        if (!window.confirm('Deseja realmente excluir este paciente? Esta ação não pode ser desfeita.')) return;
        setLoading(true);
        try {
            await db.deletePaciente(patientId);
            await fetchTabContent();
        } catch (err: any) {
            console.error('Error deleting patient:', err);
            alert(err.message || 'Erro ao deletar paciente.');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteProcedure = async (procId: string) => {
        if (!window.confirm('Deseja realmente excluir este procedimento? Esta ação não pode ser desfeita.')) return;
        setLoading(true);
        try {
            await db.deleteProcedimento(procId);
            await fetchTabContent();
        } catch (err: any) {
            console.error('Error deleting procedure:', err);
            alert(err.message || 'Erro ao deletar procedimento.');
        } finally {
            setLoading(false);
        }
    };

    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDayIndex = new Date(year, month, 1).getDay();
        const totalDays = new Date(year, month + 1, 0).getDate();
        
        const days = [];
        for (let i = 0; i < firstDayIndex; i++) {
            days.push(null);
        }
        for (let i = 1; i <= totalDays; i++) {
            days.push(new Date(year, month, i));
        }
        return days;
    };

    // Procedures States
    const [procedures, setProcedures] = useState<ConsultaProcedimento[]>([]);
    const [procSearch, setProcSearch] = useState('');
    const [isProcModalOpen, setIsProcModalOpen] = useState(false);
    const [editingProc, setEditingProc] = useState<ConsultaProcedimento | null>(null);

    // Procedure Form State
    const [procName, setProcName] = useState('');
    const [procCode, setProcCode] = useState('');
    const [procType, setProcType] = useState<'Exame' | 'Consulta' | 'Cirurgia'>('Exame');
    const [procQty, setProcQty] = useState(0);
    const [procStatus, setProcStatus] = useState<'Ativo' | 'Inativo'>('Ativo');
    const [procRecurso, setProcRecurso] = useState<'Não Se Aplica' | 'FM' | 'PPI'>('Não Se Aplica');
    const [procError, setProcError] = useState('');

    // Gestores Management State
    const [systemUsers, setSystemUsers] = useState<any[]>([]);
    const [gestorUserIds, setGestorUserIds] = useState<string[]>([]);
    const [gestorSearch, setGestorSearch] = useState('');
    const [gestorFilter, setGestorFilter] = useState<'all' | 'gestores' | 'non_gestores'>('all');

    const handleToggleGestor = async (userId: string) => {
        if (!isAdmin) return;
        setLoading(true);
        try {
            if (gestorUserIds.includes(userId)) {
                await db.removeConsultasGestor(userId);
                setGestorUserIds(prev => prev.filter(id => id !== userId));
            } else {
                await db.addConsultasGestor(userId, currentUser.id);
                setGestorUserIds(prev => [...prev, userId]);
            }
        } catch (err) {
            console.error('Error toggling gestor:', err);
        } finally {
            setLoading(false);
        }
    };

    // History Log
    const [historyLogs, setHistoryLogs] = useState<ConsultaAgendamento[]>([]);
    const [historySearch, setHistorySearch] = useState('');

    // Dashboard Stats State
    const [stats, setStats] = useState<db.ConsultasDashboardStats>({
        totalPatients: 0,
        totalBookings: 0,
        popularProcedures: [],
        availableQuantities: [],
        bookingsByPeriod: []
    });

    // Load data based on tab
    const fetchTabContent = async () => {
        setLoading(true);
        try {
            if (activeTab === 'dashboard') {
                const data = await db.getDashboardStats();
                setStats(data);
            } else if (activeTab === 'historico') {
                const data = await db.getAgendamentos();
                setHistoryLogs(data);
            } else if (activeTab === 'procedimentos') {
                const data = await db.getProcedimentos();
                setProcedures(data);
            } else if (activeTab === 'gestor') {
                if (isAdmin) {
                    const [usersData, gestoresData] = await Promise.all([
                        db.getSystemUsers(),
                        db.getConsultasGestores()
                    ]);
                    setSystemUsers(usersData);
                    setGestorUserIds(gestoresData);
                }
            }
        } catch (error) {
            console.error('Error fetching tab data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTabContent();
        setSelectedProc(null);
    }, [activeTab]);

    // Realtime changes listener to keep dashboard/tables synced
    useEffect(() => {
        const handleRealtimeChange = () => {
            fetchTabContent();
            if (selectedProc) {
                reloadVagas();
            }
        };

        window.addEventListener('consultas-agendamentos-changed', handleRealtimeChange);
        window.addEventListener('consultas-procedimentos-changed', handleRealtimeChange);
        window.addEventListener('consultas-vagas-changed', handleRealtimeChange);
        window.addEventListener('consultas-gestores-changed', handleRealtimeChange);

        return () => {
            window.removeEventListener('consultas-agendamentos-changed', handleRealtimeChange);
            window.removeEventListener('consultas-procedimentos-changed', handleRealtimeChange);
            window.removeEventListener('consultas-vagas-changed', handleRealtimeChange);
            window.removeEventListener('consultas-gestores-changed', handleRealtimeChange);
        };
    }, [activeTab, selectedProc]);

    // Procedure Form validation & save
    const handleSaveProcedure = async (e: React.FormEvent) => {
        e.preventDefault();
        setProcError('');

        if (!procName.trim()) {
            setProcError('Nome do procedimento é obrigatório.');
            return;
        }
        if (!/^\d{4}$/.test(procCode)) {
            setProcError('Código do procedimento deve conter exatamente 4 dígitos numéricos (ex: 0123).');
            return;
        }

        // Validação local de duplicidade (mesmo nome e tipo)
        const isDuplicate = procedures.some(p => 
            p.name.trim().toUpperCase() === procName.trim().toUpperCase() &&
            p.type === procType &&
            (!editingProc || p.id !== editingProc.id)
        );

        if (isDuplicate) {
            setProcError('Já existe um procedimento cadastrado com o mesmo nome e tipo.');
            return;
        }

        setLoading(true);
        try {
            if (editingProc) {
                await db.updateProcedimento(editingProc.id, {
                    name: procName,
                    code: procCode,
                    type: procType,
                    status: procStatus,
                    recurso: 'Não Se Aplica'
                });
            } else {
                await db.createProcedimento({
                    name: procName,
                    code: procCode,
                    type: procType,
                    total_quantity: 0,
                    available_quantity: 0,
                    status: procStatus,
                    recurso: 'Não Se Aplica'
                });
            }
            setIsProcModalOpen(false);
            fetchTabContent();
        } catch (err: any) {
            if (err.message && (err.message.includes('unique_procedimento_nome_tipo') || err.message.includes('unique constraint') || err.message.includes('duplicate key'))) {
                setProcError('Já existe um procedimento cadastrado com o mesmo nome e tipo.');
            } else {
                setProcError(err.message || 'Erro ao salvar procedimento.');
            }
        } finally {
            setLoading(false);
        }
    };

    // Open Procedure Modal (Add or Edit)
    const handleOpenProcModal = (proc: ConsultaProcedimento | null = null) => {
        setEditingProc(proc);
        if (proc) {
            setProcName(proc.name);
            setProcCode(proc.code || '');
            setProcType(proc.type);
            setProcQty(proc.available_quantity);
            setProcStatus(proc.status);
            setProcRecurso(proc.recurso || 'Não Se Aplica');
        } else {
            setProcName('');
            // Auto-generate unique sequential 4-digit code
            const nextNum = procedures.reduce((max, p) => {
                const codeNum = parseInt(p.code || '0', 10);
                return isNaN(codeNum) ? max : Math.max(max, codeNum);
            }, 0) + 1;
            const nextCode = String(nextNum).padStart(4, '0');
            setProcCode(nextCode);
            setProcType('Exame');
            setProcQty(0);
            setProcStatus('Ativo');
            setProcRecurso('Não Se Aplica');
        }
        setProcError('');
        setIsProcModalOpen(true);
    };

    const handleClearAllProcedures = async () => {
        if (!window.confirm('ATENÇÃO: Tem certeza que deseja apagar TODOS os procedimentos cadastrados? Esta ação deixará a lista zerada.')) return;
        setLoading(true);
        try {
            for (const proc of procedures) {
                await db.deleteProcedimento(proc.id);
            }
            setProcedures([]);
            fetchTabContent();
        } catch (err: any) {
            console.error('Erro ao limpar procedimentos:', err);
            alert('Erro ao excluir procedimentos.');
        } finally {
            setLoading(false);
        }
    };

    const handleSeedProcedures = async () => {
        setLoading(true);
        try {
            const count = await seedDefaultProcedures();
            await fetchTabContent();
            alert(`${count} procedimentos padrão cadastrados com sucesso!`);
        } catch (err: any) {
            console.error('Erro ao popular procedimentos:', err);
            alert(err.message || 'Erro ao cadastrar procedimentos padrão.');
        } finally {
            setLoading(false);
        }
    };

    const filteredProcedures = procedures.filter(p => 
        p.name.toLowerCase().includes(procSearch.toLowerCase()) ||
        (p.code && p.code.includes(procSearch))
    );

    const filteredHistory = historyLogs.filter(h => 
        h.paciente?.name.toLowerCase().includes(historySearch.toLowerCase()) ||
        h.procedimento?.name.toLowerCase().includes(historySearch.toLowerCase())
    );

    return (
        <div className="w-full mx-auto flex flex-col flex-1 h-full max-h-full min-h-0 bg-white rounded-3xl border border-slate-200/80 shadow-2xl shadow-slate-100 overflow-hidden relative">
            
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
                <div className="flex items-center gap-3">
                    <button 
                        onClick={onBack} 
                        className="p-2 -ml-2 text-slate-400 hover:text-slate-800 hover:bg-slate-200 rounded-xl transition-all"
                        title="Voltar"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h3 className="font-extrabold text-slate-900 tracking-tight text-lg">Administração & Dados</h3>
                        <p className="text-xs text-slate-500 font-medium">Controle de pacientes, exames, quotas e relatórios estatísticos</p>
                    </div>
                </div>
            </div>

            {/* Tab Selector */}
            <div className="px-6 py-3 bg-slate-50/50 border-b border-slate-100 flex flex-wrap gap-2 shrink-0">
                {[
                    { 
                        id: 'dashboard', 
                        label: 'Dashboard', 
                        icon: BarChart3,
                        activeClass: 'bg-sky-50/80 text-sky-600 border-sky-200/60 shadow-sm shadow-sky-500/5'
                    },
                    { 
                        id: 'pacientes', 
                        label: 'Pacientes', 
                        icon: Users,
                        activeClass: 'bg-violet-50/80 text-violet-600 border-violet-200/60 shadow-sm shadow-violet-500/5'
                    },
                    { 
                        id: 'procedimentos', 
                        label: 'Exames & Consultas', 
                        icon: Settings,
                        activeClass: 'bg-indigo-50/80 text-indigo-600 border-indigo-200/60 shadow-sm shadow-indigo-500/5'
                    },
                    { 
                        id: 'historico', 
                        label: 'Histórico Completo', 
                        icon: History,
                        activeClass: 'bg-emerald-50/80 text-emerald-700 border-emerald-200/60 shadow-sm shadow-emerald-500/5'
                    },
                    ...(isAdmin ? [{ 
                        id: 'gestor', 
                        label: 'Gestor', 
                        icon: ShieldCheck,
                        activeClass: 'bg-amber-50/80 text-amber-700 border-amber-200/60 shadow-sm shadow-amber-500/5'
                    }] : [])
                ].map(t => {
                    const Icon = t.icon;
                    const isActive = activeTab === t.id;
                    return (
                        <button
                            key={t.id}
                            onClick={() => {
                                if (onNavigate) {
                                    onNavigate(`consultas:dados-${t.id}`);
                                }
                            }}
                            className={`flex items-center gap-2 px-4 py-2 border rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-300 transform active:scale-[0.97] select-none ${
                                isActive 
                                ? `${t.activeClass}` 
                                : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-100/70'
                            }`}
                        >
                            <Icon className={`w-4 h-4 transition-transform duration-300 ${isActive ? 'scale-110' : ''}`} />
                            {t.label}
                        </button>
                    );
                })}
            </div>

            {/* Content Body Area */}
            <div className="flex-1 overflow-auto bg-slate-50/20 p-6 min-h-0">

                {/* 1. DASHBOARD TAB */}
                {activeTab === 'dashboard' && (
                    <div className="space-y-6">
                        {/* Summary Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="p-5 bg-gradient-to-br from-sky-500 to-sky-600 text-white rounded-2xl shadow-md flex flex-col justify-between min-h-[110px]">
                                <span className="text-[10px] font-black uppercase tracking-widest text-sky-100">Total de Pacientes</span>
                                <span className="text-3xl font-black">{stats.totalPatients}</span>
                            </div>
                            <div className="p-5 bg-gradient-to-br from-indigo-500 to-indigo-600 text-white rounded-2xl shadow-md flex flex-col justify-between min-h-[110px]">
                                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-100">Total de Agendamentos</span>
                                <span className="text-3xl font-black">{stats.totalBookings}</span>
                            </div>
                            <div className="p-5 bg-gradient-to-br from-teal-500 to-teal-600 text-white rounded-2xl shadow-md flex flex-col justify-between min-h-[110px]">
                                <span className="text-[10px] font-black uppercase tracking-widest text-teal-100">Exame Mais Realizado</span>
                                <span className="text-lg font-black truncate">{stats.popularProcedures[0]?.name || 'Nenhum'}</span>
                            </div>
                            <div className="p-5 bg-gradient-to-br from-slate-700 to-slate-800 text-white rounded-2xl shadow-md flex flex-col justify-between min-h-[110px]">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">Vagas Totais Ativas</span>
                                <span className="text-3xl font-black">
                                    {stats.availableQuantities.reduce((acc, curr) => acc + Math.max(0, curr.available), 0)}
                                </span>
                            </div>
                        </div>

                        {/* Charts & Popular Grid */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Trend Area Chart (recharts) */}
                            <div className="lg:col-span-2 p-5 bg-white border border-slate-200/80 rounded-2xl shadow-sm flex flex-col h-[320px]">
                                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 mb-4">Fluxo de Agendamentos por Período</h4>
                                <div className="flex-1 w-full min-h-0">
                                    {stats.bookingsByPeriod.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={stats.bookingsByPeriod} margin={{ left: -20, right: 10, top: 10, bottom: 5 }}>
                                                <defs>
                                                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#0284c7" stopOpacity={0.2}/>
                                                        <stop offset="95%" stopColor="#0284c7" stopOpacity={0}/>
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                                <XAxis dataKey="date" stroke="#94a3b8" style={{ fontSize: 9, fontWeight: 'bold' }} />
                                                <YAxis stroke="#94a3b8" style={{ fontSize: 9, fontWeight: 'bold' }} />
                                                <Tooltip />
                                                <Area type="monotone" dataKey="count" name="Agendamentos" stroke="#0284c7" strokeWidth={2.5} fillOpacity={1} fill="url(#colorCount)" />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="h-full w-full flex items-center justify-center text-xs font-bold text-slate-400">Sem dados para exibir gráficos</div>
                                    )}
                                </div>
                            </div>

                            {/* Popular rankings */}
                            <div className="p-5 bg-white border border-slate-200/80 rounded-2xl shadow-sm space-y-4">
                                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">Mais Solicitados</h4>
                                <div className="space-y-3.5">
                                    {stats.popularProcedures.length > 0 ? (
                                        stats.popularProcedures.map((proc, idx) => (
                                            <div key={idx} className="flex items-center justify-between text-xs border-b border-slate-100 pb-2.5 last:border-0 last:pb-0">
                                                <div className="min-w-0 pr-2">
                                                    <div className="font-extrabold text-slate-800 truncate">{proc.name}</div>
                                                    <span className="text-[8px] font-black uppercase tracking-wider text-slate-400">{proc.type}</span>
                                                </div>
                                                <span className="shrink-0 px-2 py-0.5 bg-sky-50 border border-sky-100 text-sky-600 rounded-full font-black text-[10px]">
                                                    {proc.count} agend.
                                                </span>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center text-xs font-bold text-slate-400 py-8">Nenhum procedimento agendado ainda.</div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Critical availability warnings */}
                        <div className="p-5 bg-white border border-slate-200/80 rounded-2xl shadow-sm space-y-3.5">
                            <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">Monitoramento de Vagas Restantes</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                                {stats.availableQuantities.length > 0 ? (
                                    stats.availableQuantities.map((item, idx) => {
                                        const isCritical = item.available > 0 && item.available <= 5;
                                        return (
                                            <div key={idx} className={`p-3.5 border rounded-xl flex flex-col justify-between ${
                                                item.available <= 0 
                                                ? 'bg-rose-50/50 border-rose-100' 
                                                : isCritical 
                                                ? 'bg-amber-50/50 border-amber-100' 
                                                : 'bg-slate-50 border-slate-100'
                                            }`}>
                                                <div className="font-extrabold text-xs text-slate-800 truncate">{item.name}</div>
                                                <div className="flex items-center justify-between mt-2">
                                                    <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400">{item.type}</span>
                                                    <span className={`text-xs font-black ${
                                                        item.available <= 0 
                                                        ? 'text-rose-600' 
                                                        : isCritical 
                                                        ? 'text-amber-600' 
                                                        : 'text-slate-700'
                                                    }`}>
                                                        {Math.max(0, item.available)} vagas
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="col-span-full text-center text-xs font-bold text-slate-400 py-8">Nenhum exame cadastrado.</div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* 2. PACIENTES TAB */}
                {activeTab === 'pacientes' && (
                    <PacientesTab />
                )}

                {/* 3. PROCEDIMENTOS TAB */}
                {activeTab === 'procedimentos' && (() => {
                    const filteredProcedures = procedures.filter(p =>
                        p.name.toLowerCase().includes(procSearch.toLowerCase()) ||
                        (p.code && p.code.toLowerCase().includes(procSearch.toLowerCase())) ||
                        p.type.toLowerCase().includes(procSearch.toLowerCase()) ||
                        (p.recurso && p.recurso.toLowerCase().includes(procSearch.toLowerCase()))
                    );

                    return (
                        <div className="space-y-4">
                        {selectedProc ? (
                            /* DETALHES DO PROCEDIMENTO */
                            (() => {
                                const groupedVagas: Record<string, ConsultaVaga[]> = {};
                                vagas.forEach(v => {
                                    if (!groupedVagas[v.data]) {
                                        groupedVagas[v.data] = [];
                                    }
                                    groupedVagas[v.data].push(v);
                                });

                                const sortedDates = Object.keys(groupedVagas).sort();
                                const busyVagas = vagas.filter(v => slotAssignments.has(v.id)).length;
                                const availableVagas = vagas.filter(v => !slotAssignments.has(v.id)).length;

                                return (
                                    <div className="space-y-6">
                                        {/* Header block */}
                                        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                                            <div className="flex items-center gap-3">
                                                <button 
                                                    onClick={() => setSelectedProc(null)} 
                                                    className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-200 rounded-xl transition-all"
                                                    title="Voltar para Lista"
                                                >
                                                    <ArrowLeft className="w-4 h-4" />
                                                </button>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <h4 className="font-extrabold text-slate-900 text-sm uppercase">{selectedProc.name}</h4>
                                                        {selectedProc.code && (
                                                            <span className="text-[10px] text-slate-400 font-extrabold bg-slate-100 px-1.5 py-0.5 rounded">
                                                                CÓD. {selectedProc.code}
                                                            </span>
                                                        )}
                                                        <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                                                            selectedProc.type === 'Exame' 
                                                            ? 'bg-sky-50 text-sky-600 border border-sky-100' 
                                                            : selectedProc.type === 'Consulta'
                                                            ? 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                                                            : 'bg-rose-50 text-rose-600 border border-rose-100'
                                                        }`}>
                                                            {selectedProc.type}
                                                        </span>
                                                        {selectedProc.recurso && selectedProc.recurso !== 'Não Se Aplica' && (
                                                            <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-amber-50 text-amber-600 border border-amber-100">
                                                                {selectedProc.recurso}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Gestão de Vagas por Horário</p>
                                                </div>
                                            </div>

                                            <button
                                                onClick={() => {
                                                    setSelectedDate(new Date());
                                                    setCurrentMonth(new Date());
                                                    setSelectedTimes([]);
                                                    setIsAddVagasModalOpen(true);
                                                }}
                                                className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-extrabold rounded-xl shadow-md hover:shadow-sky-500/10 active:scale-95 transition-all text-xs uppercase tracking-wider flex items-center justify-center gap-1.5"
                                            >
                                                <Plus className="w-4 h-4" /> Adicionar Vagas
                                            </button>
                                        </div>

                                        {/* Stats grid */}
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                            <div className="p-4 bg-slate-50 border border-slate-200/60 rounded-2xl shadow-sm flex flex-col justify-between">
                                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">Vagas Totais</span>
                                                <span className="text-2xl font-black text-slate-800">{vagas.length}</span>
                                            </div>
                                            <div className="p-4 bg-emerald-50 border border-emerald-100/60 rounded-2xl shadow-sm flex flex-col justify-between">
                                                <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600 block mb-1">Disponíveis</span>
                                                <span className="text-2xl font-black text-emerald-700">{availableVagas}</span>
                                            </div>
                                            <div className="p-4 bg-indigo-50 border border-indigo-100/60 rounded-2xl shadow-sm flex flex-col justify-between">
                                                <span className="text-[9px] font-black uppercase tracking-widest text-indigo-600 block mb-1">Agendadas (Ocupadas)</span>
                                                <span className="text-2xl font-black text-indigo-700">{busyVagas}</span>
                                            </div>
                                        </div>

                                        {/* Slots grouped by Date */}
                                        <div className="space-y-4">
                                            <h5 className="text-xs font-black uppercase text-slate-700 tracking-wider">Visualização por Data</h5>
                                            
                                            {sortedDates.length > 0 ? (
                                                <div className="space-y-3">
                                                    {sortedDates.map(dateStr => {
                                                        const slots = groupedVagas[dateStr];
                                                        const formattedDate = new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
                                                        
                                                        return (
                                                            <div key={dateStr} className="p-5 bg-white border border-slate-200/60 rounded-[1.5rem] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                                                <div>
                                                                    <span className="text-xs font-extrabold text-slate-800 block capitalize">{formattedDate}</span>
                                                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mt-0.5">{slots.length} vaga(s) cadastrada(s)</span>
                                                                </div>
                                                                
                                                                <div className="flex flex-wrap gap-2 items-center">
                                                                    {slots.map(v => {
                                                                        const activeBooking = slotAssignments.get(v.id);
                                                                        const dynamicStatus = activeBooking ? activeBooking.status : 'Disponível';
                                                                        const patientName = activeBooking?.paciente ? formatPatientName(activeBooking.paciente) : undefined;

                                                                        const statusColors = (() => {
                                                                            switch (dynamicStatus) {
                                                                                case 'Solicitado':
                                                                                    return {
                                                                                        container: 'bg-sky-50 border-sky-100 text-sky-600',
                                                                                        badge: 'bg-sky-100 text-sky-700'
                                                                                    };
                                                                                case 'Agendado':
                                                                                    return {
                                                                                        container: 'bg-indigo-50 border-indigo-100 text-indigo-600',
                                                                                        badge: 'bg-indigo-100 text-indigo-700'
                                                                                    };
                                                                                case 'Realizado':
                                                                                    return {
                                                                                        container: 'bg-emerald-50 border-emerald-100 text-emerald-600',
                                                                                        badge: 'bg-emerald-100 text-emerald-700'
                                                                                    };
                                                                                case 'Retorno':
                                                                                    return {
                                                                                        container: 'bg-teal-50 border-teal-100 text-teal-600',
                                                                                        badge: 'bg-teal-100 text-teal-700'
                                                                                    };
                                                                                case 'Aguardando Data':
                                                                                    return {
                                                                                        container: 'bg-violet-50 border-violet-100 text-violet-600',
                                                                                        badge: 'bg-violet-100 text-violet-700'
                                                                                    };
                                                                                case 'Fila de espera':
                                                                                    return {
                                                                                        container: 'bg-amber-50 border-amber-100 text-amber-600',
                                                                                        badge: 'bg-amber-100 text-amber-700'
                                                                                    };
                                                                                case 'Cancelado':
                                                                                case 'Não Realizado':
                                                                                case 'Disponível':
                                                                                default:
                                                                                    return {
                                                                                        container: 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:border-slate-300',
                                                                                        badge: 'bg-emerald-100 text-emerald-700'
                                                                                    };
                                                                            }
                                                                        })();

                                                                        return (
                                                                            <div 
                                                                                key={v.id} 
                                                                                className={`px-3 py-1.5 border rounded-xl flex items-center gap-2 group text-xs font-bold shadow-sm transition-all ${statusColors.container}`}
                                                                                title={patientName ? `Paciente: ${patientName}` : undefined}
                                                                            >
                                                                                <span className="font-extrabold">{v.hora.slice(0, 5)}</span>
                                                                                {patientName && (
                                                                                    <span className="text-[10px] opacity-75 font-bold max-w-[80px] truncate" title={patientName}>
                                                                                        - {patientName.split(' ')[0]}
                                                                                    </span>
                                                                                )}
                                                                                <span className={`text-[8px] font-black uppercase px-1.5 py-0.2 rounded ${statusColors.badge}`}>
                                                                                    {dynamicStatus === 'Disponível' ? 'Disponível' : dynamicStatus}
                                                                                </span>
                                                                                {!activeBooking && (
                                                                                    <button
                                                                                        onClick={() => handleDeleteSlot(v.id)}
                                                                                        className="p-0.5 hover:bg-slate-200 rounded text-slate-400 hover:text-rose-600 transition-colors ml-0.5"
                                                                                        title="Excluir Vaga"
                                                                                    >
                                                                                        <X className="w-3.5 h-3.5" />
                                                                                    </button>
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
                                                <div className="p-8 bg-slate-50 border border-dashed border-slate-200 rounded-[2rem] text-center">
                                                    <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                                                    <span className="text-xs font-bold text-slate-400 block">Nenhuma vaga cadastrada por horário.</span>
                                                    <span className="text-[10px] text-slate-400 block mt-1">Utilize o botão "Adicionar Vagas" para alocar horários neste procedimento.</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })()
                        ) : (
                            /* LISTAGEM DE PROCEDIMENTOS */
                            <>
                                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                                    <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                                        <div className="relative w-full sm:w-72 md:w-80">
                                            <input
                                                type="text"
                                                placeholder="Buscar exame ou consulta..."
                                                className="w-full bg-white border border-slate-300 rounded-xl pl-10 pr-4 py-2.5 text-xs font-semibold placeholder:text-slate-500 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/15 transition-all text-slate-900 shadow-sm"
                                                value={procSearch}
                                                onChange={(e) => setProcSearch(e.target.value)}
                                            />
                                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                                        </div>

                                        {/* Badge do Número Total de Procedimentos Cadastrados */}
                                        <div className="flex items-center gap-2 px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl shadow-sm">
                                            <Activity className="w-4 h-4 text-sky-600 shrink-0" />
                                            <span className="text-xs font-bold text-slate-600">Total Cadastrados:</span>
                                            <span className="px-2.5 py-0.5 bg-sky-600 text-white rounded-lg text-xs font-black shadow-sm">
                                                {procedures.length}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 w-full sm:w-auto">
                                        {procedures.length > 0 && isAdmin && (
                                            <button
                                                onClick={handleClearAllProcedures}
                                                className="px-3.5 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 font-extrabold rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-xs"
                                                title="Apagar todos os procedimentos do sistema"
                                            >
                                                <Trash2 className="w-4 h-4 text-rose-600" /> Zerar Lista
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleOpenProcModal()}
                                            className="w-full sm:w-auto px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-extrabold rounded-xl shadow-md hover:shadow-sky-500/10 active:scale-95 transition-all text-xs uppercase tracking-wider flex items-center justify-center gap-1.5"
                                        >
                                            <Plus className="w-4 h-4" /> Novo Procedimento
                                        </button>
                                    </div>
                                </div>

                                {filteredProcedures.length > 0 ? (
                                    <div className="space-y-3">
                                        {filteredProcedures.map(p => {
                                            const typeConfig = (() => {
                                                switch (p.type) {
                                                    case 'Exame':
                                                        return {
                                                            icon: Activity,
                                                            colorClass: 'text-sky-600 bg-sky-50 border-sky-100',
                                                            hoverColorClass: 'group-hover:border-sky-300 group-hover:bg-sky-50/50'
                                                        };
                                                    case 'Consulta':
                                                        return {
                                                            icon: Stethoscope,
                                                            colorClass: 'text-indigo-600 bg-indigo-50 border-indigo-100',
                                                            hoverColorClass: 'group-hover:border-indigo-300 group-hover:bg-indigo-50/50'
                                                        };
                                                    case 'Cirurgia':
                                                    default:
                                                        return {
                                                            icon: Sparkles,
                                                            colorClass: 'text-rose-600 bg-rose-50 border-rose-100',
                                                            hoverColorClass: 'group-hover:border-rose-300 group-hover:bg-rose-50/50'
                                                        };
                                                }
                                            })();
                                            const IconComponent = typeConfig.icon;

                                            return (
                                                <div 
                                                    key={p.id} 
                                                    onClick={() => setSelectedProc(p)}
                                                    className="group relative bg-white hover:bg-slate-50/30 border border-slate-200/80 hover:border-sky-300/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-300 cursor-pointer shadow-sm hover:shadow-md hover:-translate-y-0.5"
                                                >
                                                    {/* Left side: Icon, Name and Code */}
                                                    <div className="flex items-center gap-4 min-w-0 flex-1">
                                                        <div className={`p-3 rounded-xl ${typeConfig.colorClass} border shrink-0 transition-transform duration-300 group-hover:scale-110 shadow-sm`}>
                                                            <IconComponent className="w-5 h-5" />
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex flex-wrap items-center gap-2 mb-1.5">
                                                                <span className="text-[9px] font-black tracking-wider text-slate-400 bg-slate-100 px-2 py-0.5 rounded uppercase">
                                                                    Cód. {p.code || '----'}
                                                                </span>
                                                                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${typeConfig.colorClass} border`}>
                                                                    {p.type}
                                                                </span>
                                                                {p.recurso && p.recurso !== 'Não Se Aplica' && (
                                                                    <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-amber-50 text-amber-600 border border-amber-100">
                                                                        {p.recurso}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <h4 className="font-extrabold text-slate-800 text-sm sm:text-base truncate group-hover:text-sky-700 transition-colors">
                                                                {p.name}
                                                            </h4>
                                                        </div>
                                                    </div>

                                                    {/* Middle/Right: Info Columns */}
                                                    <div className="flex items-center justify-between sm:justify-end gap-6 shrink-0 border-t border-slate-100 sm:border-t-0 pt-3 sm:pt-0">
                                                        {/* Status Badge */}
                                                        <div className="text-left sm:text-right">
                                                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Status</span>
                                                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide border ${
                                                                p.status === 'Ativo' 
                                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                                                                : 'bg-slate-100 text-slate-500 border-slate-200'
                                                            }`}>
                                                                {p.status === 'Ativo' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                                                                {p.status}
                                                            </span>
                                                        </div>

                                                        {/* Cotas Counter */}
                                                        <div className="text-left sm:text-right min-w-[90px]">
                                                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Cotas Disponíveis</span>
                                                            <div className="flex items-baseline gap-1 sm:justify-end">
                                                                <span className="text-base font-black text-slate-800">{Math.max(0, p.available_quantity)}</span>
                                                                <span className="text-[10px] font-bold text-slate-400">cotas</span>
                                                            </div>
                                                        </div>

                                                        {/* Actions Area */}
                                                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                                            <button
                                                                onClick={() => handleOpenProcModal(p)}
                                                                className="p-2 text-slate-400 hover:text-sky-600 hover:bg-sky-50 border border-slate-200/60 rounded-xl transition-all"
                                                                title="Editar Procedimento"
                                                            >
                                                                <Edit2 className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteProcedure(p.id)}
                                                                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-200/60 rounded-xl transition-all"
                                                                title="Excluir Procedimento"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                            <div className="hidden sm:flex p-2 text-slate-300 group-hover:text-sky-500 transition-colors">
                                                                <ChevronRight className="w-5 h-5 transform group-hover:translate-x-1 transition-transform" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="text-center py-12 p-8 bg-white border border-dashed border-slate-200 rounded-3xl space-y-4">
                                        <Activity className="w-12 h-12 text-sky-500 mx-auto opacity-75" />
                                        <div className="space-y-1">
                                            <h4 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">Nenhum procedimento cadastrado</h4>
                                            <p className="text-xs text-slate-500 max-w-md mx-auto">Você pode popular automaticamente a lista completa com todos os 122 procedimentos padrão (Consultas, Exames e Cirurgias com seus respectivos códigos de 4 dígitos) ou cadastrar individualmente.</p>
                                        </div>
                                        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                                            <button
                                                onClick={handleSeedProcedures}
                                                disabled={loading}
                                                className="px-5 py-3 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 disabled:opacity-50 text-white font-extrabold text-xs uppercase tracking-wider rounded-2xl shadow-lg shadow-sky-500/20 active:scale-95 transition-all flex items-center gap-2"
                                            >
                                                <Sparkles className="w-4 h-4 text-amber-300" />
                                                <span>Cadastrar Lista Padrão (122 Procedimentos)</span>
                                            </button>
                                            <button
                                                onClick={() => handleOpenProcModal()}
                                                className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs uppercase tracking-wider rounded-2xl transition-all flex items-center gap-2"
                                            >
                                                <Plus className="w-4 h-4" />
                                                <span>Cadastrar Manualmente</span>
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                );
            })()}

                {/* 4. HISTORICO TAB */}
                {activeTab === 'historico' && (
                    <div className="space-y-4">
                        <div className="relative w-full sm:max-w-md">
                            <input
                                type="text"
                                placeholder="Filtrar por Paciente ou Exame..."
                                className="w-full bg-white border border-slate-300 rounded-xl pl-10 pr-4 py-2.5 text-xs font-semibold placeholder:text-slate-500 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/15 transition-all text-slate-900 shadow-sm"
                                value={historySearch}
                                onChange={(e) => setHistorySearch(e.target.value)}
                            />
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                        </div>

                        {filteredHistory.length > 0 ? (
                            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                            <th className="p-4">Paciente</th>
                                            <th className="p-4">Exame / Procedimento</th>
                                            <th className="p-4">Data Solicitada</th>
                                            <th className="p-4 text-center">Status</th>
                                            <th className="p-4">Responsável / Data Registro</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                                        {filteredHistory.map(h => (
                                            <tr key={h.id} className="hover:bg-slate-50/20">
                                                <td className="p-4">
                                                    <div className="font-extrabold text-slate-900">{h.paciente ? formatPatientName(h.paciente) : 'Sistema'}</div>
                                                    <div className="text-[10px] text-slate-400">CPF: {h.paciente?.cpf}</div>
                                                </td>
                                                <td className="p-4">
                                                    <div className="font-bold text-slate-800">{h.procedimento?.name || 'Exame Deletado'}</div>
                                                    <span className="text-[9px] text-slate-400">{h.procedimento?.type}</span>
                                                </td>
                                                <td className="p-4 text-slate-500">
                                                    {new Date(h.appointment_date + 'T00:00:00').toLocaleDateString('pt-BR')}
                                                </td>
                                                <td className="p-4 text-center">
                                                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                                                        h.status === 'Solicitado'
                                                        ? 'bg-sky-50 text-sky-700 border-sky-100'
                                                        : h.status === 'Agendado' 
                                                        ? 'bg-indigo-50 text-indigo-700 border-indigo-100' 
                                                        : h.status === 'Realizado' 
                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                                                        : h.status === 'Não Realizado'
                                                        ? 'bg-slate-100 text-slate-600 border-slate-200'
                                                        : h.status === 'Fila de espera'
                                                        ? 'bg-amber-50 text-amber-700 border-amber-100'
                                                        : h.status === 'Aguardando Data'
                                                        ? 'bg-violet-50 text-violet-700 border-violet-100'
                                                        : h.status === 'Retorno'
                                                        ? 'bg-teal-50 text-teal-700 border-teal-100'
                                                        : 'bg-rose-50 text-rose-700 border-rose-100'
                                                    }`}>
                                                        {h.status}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-slate-500">
                                                    <div>{h.responsavel?.name || 'Sistema'}</div>
                                                    <div className="text-[9px] text-slate-400">
                                                        {h.created_at && new Date(h.created_at).toLocaleString('pt-BR')}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="text-center text-xs font-bold text-slate-400 py-12">Nenhum histórico disponível.</div>
                        )}
                    </div>
                )}

                {/* 5. GESTOR TAB (APENAS ADMINISTRADORES) */}
                {activeTab === 'gestor' && isAdmin && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        {/* Header Banner do Gestor */}
                        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-amber-950 text-white p-6 rounded-3xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-amber-500/20 relative overflow-hidden">
                            <div className="absolute right-0 top-0 bottom-0 w-72 bg-amber-500/10 blur-3xl pointer-events-none transform rotate-12"></div>
                            
                            <div className="flex items-center gap-4 relative z-10">
                                <div className="w-14 h-14 rounded-2xl bg-amber-500/20 backdrop-blur-md border border-amber-400/30 flex items-center justify-center text-amber-400 shadow-inner">
                                    <ShieldCheck className="w-8 h-8" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30">
                                            Acesso Exclusivo: Administradores
                                        </span>
                                    </div>
                                    <h3 className="text-xl font-black uppercase tracking-tight mt-1 text-white">Definição de Gestores do Módulo</h3>
                                    <p className="text-xs text-amber-200/80 font-medium">Selecione usuários cadastrados no sistema para autorizá-los como gestores no módulo de consultas.</p>
                                </div>
                            </div>
                        </div>

                        {/* Metric Summary Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="p-5 bg-white border border-slate-200/80 rounded-2xl shadow-sm space-y-1">
                                <div className="flex items-center justify-between text-slate-400">
                                    <span className="text-[10px] font-black uppercase tracking-wider">Gestores Autorizados</span>
                                    <ShieldCheck className="w-5 h-5 text-amber-600" />
                                </div>
                                <div className="font-black text-slate-900 text-3xl">{gestorUserIds.length}</div>
                                <div className="text-[10px] text-amber-600 font-extrabold">Usuários com função de gestor</div>
                            </div>

                            <div className="p-5 bg-white border border-slate-200/80 rounded-2xl shadow-sm space-y-1">
                                <div className="flex items-center justify-between text-slate-400">
                                    <span className="text-[10px] font-black uppercase tracking-wider">Usuários no Sistema</span>
                                    <Users className="w-5 h-5 text-sky-600" />
                                </div>
                                <div className="font-black text-slate-900 text-3xl">{systemUsers.length}</div>
                                <div className="text-[10px] text-slate-400 font-bold">Total de perfis cadastrados</div>
                            </div>

                            <div className="p-5 bg-white border border-slate-200/80 rounded-2xl shadow-sm space-y-1">
                                <div className="flex items-center justify-between text-slate-400">
                                    <span className="text-[10px] font-black uppercase tracking-wider">Perfil Atual</span>
                                    <UserCheck className="w-5 h-5 text-emerald-600" />
                                </div>
                                <div className="font-black text-slate-900 text-base truncate">{currentUser.name}</div>
                                <div className="text-[10px] text-emerald-600 font-extrabold uppercase bg-emerald-50 px-2 py-0.5 rounded-md inline-block">
                                    Administrador do Sistema
                                </div>
                            </div>
                        </div>

                        {/* Definição de Gestores Table Container */}
                        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                                <div>
                                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                                        <UserCog className="w-4 h-4 text-amber-600" />
                                        Usuários Cadastrados no Sistema
                                    </h4>
                                    <p className="text-[11px] text-slate-400 font-medium mt-0.5">Clique em "+ Definir como Gestor" ou "Remover Gestor" para alterar o acesso.</p>
                                </div>

                                <div className="flex flex-col sm:flex-row items-center gap-2">
                                    {/* Filter buttons */}
                                    <div className="flex bg-slate-100 p-1 rounded-xl gap-1 text-[10px] font-black uppercase tracking-wider">
                                        <button
                                            type="button"
                                            onClick={() => setGestorFilter('all')}
                                            className={`px-3 py-1.5 rounded-lg transition-all ${gestorFilter === 'all' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                                        >
                                            Todos ({systemUsers.length})
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setGestorFilter('gestores')}
                                            className={`px-3 py-1.5 rounded-lg transition-all ${gestorFilter === 'gestores' ? 'bg-white text-amber-700 shadow-sm font-extrabold' : 'text-slate-500 hover:text-amber-700'}`}
                                        >
                                            Gestores ({gestorUserIds.length})
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setGestorFilter('non_gestores')}
                                            className={`px-3 py-1.5 rounded-lg transition-all ${gestorFilter === 'non_gestores' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                                        >
                                            Não Gestores ({systemUsers.length - gestorUserIds.length})
                                        </button>
                                    </div>

                                    {/* Search input */}
                                    <div className="relative w-full sm:w-64">
                                        <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                                        <input
                                            type="text"
                                            value={gestorSearch}
                                            onChange={(e) => setGestorSearch(e.target.value)}
                                            placeholder="Buscar por nome ou email..."
                                            className="w-full pl-9 pr-3 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-amber-500 text-slate-800"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Users Table */}
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                            <th className="p-3">Usuário</th>
                                            <th className="p-3">E-mail</th>
                                            <th className="p-3">Cargo / Departamento</th>
                                            <th className="p-3 text-center">Status de Gestor</th>
                                            <th className="p-3 text-right">Ação</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                                        {(() => {
                                            const filtered = systemUsers.filter(u => {
                                                const matchesSearch = !gestorSearch || 
                                                    (u.name && u.name.toLowerCase().includes(gestorSearch.toLowerCase())) ||
                                                    (u.email && u.email.toLowerCase().includes(gestorSearch.toLowerCase())) ||
                                                    (u.job_title && u.job_title.toLowerCase().includes(gestorSearch.toLowerCase()));

                                                const isGestor = gestorUserIds.includes(u.id);

                                                if (gestorFilter === 'gestores' && !isGestor) return false;
                                                if (gestorFilter === 'non_gestores' && isGestor) return false;

                                                return matchesSearch;
                                            });

                                            if (filtered.length === 0) {
                                                return (
                                                    <tr>
                                                        <td colSpan={5} className="p-8 text-center text-slate-400 font-bold">
                                                            Nenhum usuário corresponde aos filtros selecionados.
                                                        </td>
                                                    </tr>
                                                );
                                            }

                                            return filtered.map(u => {
                                                const isUserAdmin = u.role === 'admin';
                                                const isGestor = gestorUserIds.includes(u.id);

                                                return (
                                                    <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                                                        <td className="p-3">
                                                            <div className="flex items-center gap-3">
                                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs ${isUserAdmin ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' : isGestor ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-slate-100 text-slate-600'}`}>
                                                                    {u.name ? u.name.substring(0, 2).toUpperCase() : 'U'}
                                                                </div>
                                                                <div>
                                                                    <div className="font-extrabold text-slate-900">{u.name || 'Sem Nome'}</div>
                                                                    <div className="text-[10px] text-slate-400 font-bold uppercase">{u.role || 'Usuário'}</div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="p-3 text-slate-500 font-medium">
                                                            {u.email || '-'}
                                                        </td>
                                                        <td className="p-3 text-slate-600 font-bold">
                                                            <div>{u.job_title || u.jobTitle || 'Servidor Municipal'}</div>
                                                            <div className="text-[10px] text-slate-400 font-normal">{u.department || 'Saúde'}</div>
                                                        </td>
                                                        <td className="p-3 text-center">
                                                            {isUserAdmin ? (
                                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-sm">
                                                                    <ShieldCheck className="w-3 h-3 text-indigo-600" />
                                                                    Admin (Poder Total)
                                                                </span>
                                                            ) : isGestor ? (
                                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200 shadow-sm">
                                                                    <Check className="w-3 h-3 text-amber-600" />
                                                                    Gestor Autorizado
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500 border border-slate-200">
                                                                    Usuário Padrão
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="p-3 text-right">
                                                            {isUserAdmin ? (
                                                                <span className="text-[10px] font-extrabold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-xl border border-indigo-100 inline-block">
                                                                    Poder Total Nativo
                                                                </span>
                                                            ) : isGestor ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleToggleGestor(u.id)}
                                                                    disabled={loading}
                                                                    className="px-3 py-1.5 bg-rose-50 hover:bg-rose-500 text-rose-600 hover:text-white rounded-xl border border-rose-200 font-extrabold text-[10px] uppercase tracking-wider transition-all active:scale-95 cursor-pointer inline-flex items-center gap-1"
                                                                >
                                                                    <X className="w-3 h-3" />
                                                                    Remover Gestor
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleToggleGestor(u.id)}
                                                                    disabled={loading}
                                                                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-extrabold text-[10px] uppercase tracking-wider shadow-sm shadow-amber-500/20 transition-all active:scale-95 cursor-pointer inline-flex items-center gap-1"
                                                                >
                                                                    <Plus className="w-3 h-3" />
                                                                    Definir como Gestor
                                                                </button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            });
                                        })()}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

            </div>

            {/* MODAL: ADD/EDIT PROCEDIMENTO */}
            {isProcModalOpen && (
                <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
                        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
                            <h3 className="text-base font-black text-slate-800 uppercase tracking-wider">
                                {editingProc ? 'Editar Procedimento' : 'Novo Procedimento'}
                            </h3>
                            <button onClick={() => setIsProcModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-xl text-slate-400 hover:text-slate-700 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleSaveProcedure} className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
                            {procError && (
                                <div className="p-3 bg-rose-50 border border-rose-100 text-rose-600 text-xs font-bold rounded-xl flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                                    {procError}
                                </div>
                            )}
                            <div className="relative group">
                                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5 ml-1">Nome do Procedimento</label>
                                <input
                                    type="text"
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-900 focus:bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none transition-all text-xs font-semibold uppercase"
                                    placeholder="EX: HEMOGRAMA COMPLETO OU CONSULTA GERAL"
                                    value={procName}
                                    onChange={(e) => setProcName(e.target.value.toUpperCase())}
                                    required
                                />
                                {procName && (
                                    <div className="absolute left-0 top-full mt-1 w-full bg-white rounded-xl shadow-2xl border border-slate-100 max-h-48 overflow-y-auto hidden group-focus-within:block hover:block z-50 custom-scrollbar animate-slide-up">
                                        {procedures.filter(p => 
                                            p.name.toLowerCase().includes(procName.toLowerCase()) && 
                                            (!editingProc || p.id !== editingProc.id)
                                        ).length > 0 && (
                                            procedures.filter(p => 
                                                p.name.toLowerCase().includes(procName.toLowerCase()) && 
                                                (!editingProc || p.id !== editingProc.id)
                                            ).map(p => (
                                                <button
                                                    key={p.id}
                                                    type="button"
                                                    onMouseDown={(e) => {
                                                        e.preventDefault(); // Evita a perda de foco imediata do input
                                                        setSelectedProc(p);
                                                        setIsProcModalOpen(false);
                                                    }}
                                                    className="w-full text-left px-4 py-3 hover:bg-sky-50 text-slate-700 text-xs font-semibold border-b border-slate-50 last:border-0 flex items-center justify-between group/item transition-colors"
                                                >
                                                    <span className="flex items-center gap-2">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
                                                        {p.name}
                                                    </span>
                                                    <span className="text-[9px] text-sky-600 font-black uppercase tracking-wider opacity-0 group-hover/item:opacity-100 transition-opacity">
                                                        Ir para Vagas
                                                    </span>
                                                </button>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5 ml-1">Tipo</label>
                                    <select
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-900 focus:bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none transition-all text-xs font-semibold appearance-none cursor-pointer"
                                        value={procType}
                                        onChange={(e) => setProcType(e.target.value as 'Exame' | 'Consulta' | 'Cirurgia')}
                                    >
                                        <option value="Exame">Exame</option>
                                        <option value="Consulta">Consulta</option>
                                        <option value="Cirurgia">Cirurgia</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5 ml-1">Código (4 dígitos)</label>
                                    <input
                                        type="text"
                                        className="w-full rounded-xl border border-slate-200 bg-slate-100 p-3 text-slate-500 outline-none transition-all text-xs font-bold cursor-not-allowed select-none"
                                        value={procCode}
                                        disabled
                                        required
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5 ml-1">Status</label>
                                <div className="flex gap-4 pt-2">
                                    {['Ativo', 'Inativo'].map(st => (
                                        <label key={st} className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                                            <input
                                                type="radio"
                                                name="procStatus"
                                                value={st}
                                                checked={procStatus === st}
                                                onChange={() => setProcStatus(st as 'Ativo' | 'Inativo')}
                                                className="w-4 h-4 text-sky-600 border-slate-300 focus:ring-sky-500"
                                            />
                                            {st}
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div className="pt-4 border-t border-slate-50 flex justify-end gap-3 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setIsProcModalOpen(false)}
                                    className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-extrabold rounded-xl text-xs uppercase tracking-wider"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="px-6 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-extrabold rounded-xl shadow-lg active:scale-95 transition-all text-xs uppercase tracking-wider flex items-center gap-1.5"
                                >
                                    {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                    Salvar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL: ADICIONAR VAGAS */}
            {isAddVagasModalOpen && selectedProc && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[95vh]">
                        {/* Header */}
                        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
                            <div>
                                <h3 className="text-base font-black text-slate-800 uppercase tracking-wider">Adicionar Vagas</h3>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">{selectedProc.name}</p>
                            </div>
                            <button onClick={() => { setIsAddVagasModalOpen(false); setSelectedTimes([]); }} className="p-2 hover:bg-slate-200 rounded-xl text-slate-400 hover:text-slate-700 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        
                        {/* Body */}
                        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 flex flex-col md:flex-row gap-6">
                            {/* Left side: Calendar */}
                            <div className="flex-1 space-y-4">
                                <div className="flex items-center justify-between px-1">
                                    <button 
                                        type="button"
                                        onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
                                        className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>
                                    <span className="text-xs font-black uppercase text-slate-800 tracking-wider">
                                        {currentMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                                    </span>
                                    <button 
                                        type="button"
                                        onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
                                        className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500"
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                                
                                <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                    <span>Dom</span><span>Seg</span><span>Ter</span><span>Qua</span><span>Qui</span><span>Sex</span><span>Sáb</span>
                                </div>
                                
                                <div className="grid grid-cols-7 gap-1">
                                    {getDaysInMonth(currentMonth).map((day, idx) => {
                                        if (!day) return <div key={`empty-${idx}`} className="h-8"></div>;
                                        const isSelected = selectedDate && formatDateToYYYYMMDD(day) === formatDateToYYYYMMDD(selectedDate);
                                        const isToday = formatDateToYYYYMMDD(day) === formatDateToYYYYMMDD(new Date());
                                        const isPast = day.getTime() < new Date(new Date().setHours(0,0,0,0)).getTime();
                                        
                                        return (
                                            <button
                                                key={day.toISOString()}
                                                type="button"
                                                onClick={() => setSelectedDate(day)}
                                                disabled={isPast}
                                                className={`h-8 w-full rounded-lg text-xs font-bold transition-all flex items-center justify-center ${
                                                    isSelected 
                                                    ? 'bg-sky-600 text-white shadow-md shadow-sky-500/20' 
                                                    : isToday
                                                    ? 'border border-sky-500 text-sky-600'
                                                    : isPast
                                                    ? 'text-slate-300 cursor-not-allowed'
                                                    : 'hover:bg-slate-100 text-slate-700'
                                                }`}
                                            >
                                                {day.getDate()}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            
                            {/* Right side: Time slots */}
                            <div className="w-full md:w-[260px] border-t md:border-t-0 md:border-l border-slate-100 pt-6 md:pt-0 md:pl-6 flex flex-col space-y-4">
                                <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">
                                    Horários de Vaga
                                </h4>
                                
                                {/* Selected Date indicator */}
                                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-center">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Dia Selecionado</span>
                                    <span className="text-xs font-bold text-slate-700">
                                        {selectedDate ? selectedDate.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }) : 'Nenhum'}
                                    </span>
                                </div>
                                
                                {/* Time slots grid */}
                                <div className="grid grid-cols-3 gap-1.5 max-h-[160px] overflow-y-auto pr-1">
                                    {['07:00', '08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00'].map(t => {
                                        const isTimeSelected = selectedTimes.includes(t);
                                        return (
                                            <button
                                                key={t}
                                                type="button"
                                                onClick={() => toggleTime(t)}
                                                className={`py-1.5 rounded-lg text-xs font-bold transition-all border ${
                                                    isTimeSelected
                                                    ? 'bg-indigo-50 border-indigo-300 text-indigo-600 shadow-sm'
                                                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                                }`}
                                            >
                                                {t}
                                            </button>
                                        );
                                    })}
                                </div>
                                
                                {/* Custom time input */}
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Outro Horário</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="time"
                                            value={customTime}
                                            onChange={(e) => setCustomTime(e.target.value)}
                                            className="bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-xs font-bold outline-none focus:border-indigo-500 focus:bg-white text-slate-800 flex-1"
                                        />
                                        <button
                                            type="button"
                                            onClick={addCustomTime}
                                            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg text-[10px] uppercase tracking-wider transition-colors"
                                        >
                                            Inserir
                                        </button>
                                    </div>
                                </div>
                                
                                {/* Selected summary */}
                                {selectedTimes.length > 0 && (
                                    <div className="p-2.5 bg-indigo-50/50 rounded-xl border border-indigo-100/50 text-xs">
                                        <span className="font-extrabold text-indigo-700 block mb-1">Resumo das Vagas:</span>
                                        <div className="flex flex-wrap gap-1">
                                            {selectedTimes.sort().map(t => (
                                                <span key={t} className="px-1.5 py-0.5 bg-white border border-indigo-200 rounded text-[10px] font-bold text-indigo-600">
                                                    {t}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        {/* Footer */}
                        <div className="p-5 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3 shrink-0">
                            <button
                                type="button"
                                onClick={() => { setIsAddVagasModalOpen(false); setSelectedTimes([]); }}
                                className="px-4 py-2 border border-slate-200 hover:bg-slate-100 text-slate-500 font-bold rounded-xl text-xs uppercase tracking-wider transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmAddVagas}
                                disabled={!selectedDate || selectedTimes.length === 0 || loading}
                                className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-extrabold rounded-xl shadow-md hover:shadow-sky-500/10 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-xs uppercase tracking-wider flex items-center justify-center gap-1.5"
                            >
                                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Confirmar Vagas'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};
