import React, { useState, useEffect, useMemo } from 'react';
import { User, ConsultaPaciente, ConsultaProcedimento, ConsultaAgendamento, ConsultaVaga } from '../../types';
import { ArrowLeft, Users, Calendar, Settings, BarChart3, Plus, Edit2, Search, Check, AlertTriangle, Loader2, History, X, ChevronLeft, ChevronRight } from 'lucide-react';
import * as db from '../../services/consultasService';
import { ResponsiveContainer, AreaChart, XAxis, YAxis, Tooltip, Area, CartesianGrid } from 'recharts';

interface DadosScreenProps {
    currentUser: User;
    onBack: () => void;
    subView?: string;
    onNavigate?: (view: string) => void;
}

type TabType = 'dashboard' | 'pacientes' | 'historico' | 'procedimentos';

export const DadosScreen: React.FC<DadosScreenProps> = ({
    currentUser,
    onBack,
    subView,
    onNavigate
}) => {
    // Current Active Tab derived from URL sub-view state
    const activeTab = (() => {
        if (subView === 'dados-pacientes') return 'pacientes';
        if (subView === 'dados-procedimentos') return 'procedimentos';
        if (subView === 'dados-historico') return 'historico';
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

    // Patients States
    const [patients, setPatients] = useState<ConsultaPaciente[]>([]);
    const [patientSearch, setPatientSearch] = useState('');
    const [selectedPatient, setSelectedPatient] = useState<ConsultaPaciente | null>(null);
    const [patientHistory, setPatientHistory] = useState<ConsultaAgendamento[]>([]);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [isPatientModalOpen, setIsPatientModalOpen] = useState(false);
    const [editingPatient, setEditingPatient] = useState<ConsultaPaciente | null>(null);

    // Patient Form State
    const [patName, setPatName] = useState('');
    const [patNickname, setPatNickname] = useState('');
    const [patCpf, setPatCpf] = useState('');
    const [patBirthDate, setPatBirthDate] = useState('');
    const [patPhone, setPatPhone] = useState('');
    const [patNeighborhood, setPatNeighborhood] = useState('');
    const [patStreet, setPatStreet] = useState('');
    const [patCity, setPatCity] = useState('SÃO JOSÉ DO GOIABAL -MG');
    const [patError, setPatError] = useState('');

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
    const [procError, setProcError] = useState('');

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
            } else if (activeTab === 'pacientes') {
                const data = await db.getPacientes();
                setPatients(data);
            } else if (activeTab === 'historico') {
                const data = await db.getAgendamentos();
                setHistoryLogs(data);
            } else if (activeTab === 'procedimentos') {
                const data = await db.getProcedimentos();
                setProcedures(data);
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
        window.addEventListener('consultas-pacientes-changed', handleRealtimeChange);
        window.addEventListener('consultas-procedimentos-changed', handleRealtimeChange);
        window.addEventListener('consultas-vagas-changed', handleRealtimeChange);

        return () => {
            window.removeEventListener('consultas-agendamentos-changed', handleRealtimeChange);
            window.removeEventListener('consultas-pacientes-changed', handleRealtimeChange);
            window.removeEventListener('consultas-procedimentos-changed', handleRealtimeChange);
            window.removeEventListener('consultas-vagas-changed', handleRealtimeChange);
        };
    }, [activeTab, selectedProc]);

    // Patient Form Phone Mask
    const handlePatPhoneChange = (val: string) => {
        const clean = val.replace(/\D/g, '');
        let formatted = '';
        if (clean.length <= 2) {
            formatted = clean;
        } else if (clean.length <= 6) {
            formatted = `(${clean.slice(0, 2)}) ${clean.slice(2)}`;
        } else if (clean.length <= 10) {
            formatted = `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6)}`;
        } else {
            formatted = `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7, 11)}`;
        }
        setPatPhone(formatted);
    };

    // Patient Form CPF Mask
    const handleCpfMask = (val: string) => {
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
        setPatCpf(formatted);
    };

    // Patient Form validation & save
    const handleSavePatient = async (e: React.FormEvent) => {
        e.preventDefault();
        setPatError('');

        if (!patName.trim()) {
            setPatError('Nome completo é obrigatório.');
            return;
        }
        if (patCpf.replace(/\D/g, '').length !== 11) {
            setPatError('CPF inválido (deve conter 11 dígitos).');
            return;
        }
        if (!patBirthDate) {
            setPatError('Data de nascimento é obrigatória.');
            return;
        }

        setLoading(true);
        try {
            if (editingPatient) {
                await db.updatePaciente(editingPatient.id, {
                    name: patName,
                    nickname: patNickname.trim() || undefined,
                    cpf: patCpf,
                    birth_date: patBirthDate,
                    phone: patPhone.trim() || undefined,
                    neighborhood: patNeighborhood.trim() || undefined,
                    street: patStreet.trim() || undefined,
                    city: patCity.trim() || undefined
                });
            } else {
                await db.createPaciente({
                    name: patName,
                    nickname: patNickname.trim() || undefined,
                    cpf: patCpf,
                    birth_date: patBirthDate,
                    phone: patPhone.trim() || undefined,
                    neighborhood: patNeighborhood.trim() || undefined,
                    street: patStreet.trim() || undefined,
                    city: patCity.trim() || undefined
                });
            }
            setIsPatientModalOpen(false);
            fetchTabContent();
        } catch (err: any) {
            setPatError(err.message || 'Erro ao salvar paciente.');
        } finally {
            setLoading(false);
        }
    };

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

        setLoading(true);
        try {
            if (editingProc) {
                await db.updateProcedimento(editingProc.id, {
                    name: procName,
                    code: procCode,
                    type: procType,
                    status: procStatus
                });
            } else {
                await db.createProcedimento({
                    name: procName,
                    code: procCode,
                    type: procType,
                    total_quantity: 0,
                    available_quantity: 0,
                    status: procStatus
                });
            }
            setIsProcModalOpen(false);
            fetchTabContent();
        } catch (err: any) {
            setProcError(err.message || 'Erro ao salvar procedimento.');
        } finally {
            setLoading(false);
        }
    };

    // Patient History Drawer
    const handleOpenHistory = async (patient: ConsultaPaciente) => {
        setSelectedPatient(patient);
        const history = await db.getPacienteHistory(patient.id);
        setPatientHistory(history);
        setIsHistoryOpen(true);
    };

    // Open Patient Modal (Add or Edit)
    const handleOpenPatientModal = (patient: ConsultaPaciente | null = null) => {
        setEditingPatient(patient);
        if (patient) {
            setPatName(patient.name);
            setPatNickname(patient.nickname || '');
            // Format CPF for displaying
            const rawCpf = patient.cpf;
            let formatted = rawCpf;
            if (rawCpf.length === 11) {
                formatted = rawCpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
            }
            setPatCpf(formatted);
            setPatBirthDate(patient.birth_date);
            setPatPhone(patient.phone || '');
            setPatNeighborhood(patient.neighborhood || '');
            setPatStreet(patient.street || '');
            setPatCity(patient.city || 'SÃO JOSÉ DO GOIABAL -MG');
        } else {
            setPatName('');
            setPatNickname('');
            setPatCpf('');
            setPatBirthDate('');
            setPatPhone('');
            setPatNeighborhood('');
            setPatStreet('');
            setPatCity('SÃO JOSÉ DO GOIABAL -MG');
        }
        setPatError('');
        setIsPatientModalOpen(true);
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
        } else {
            setProcName('');
            setProcCode('');
            setProcType('Exame');
            setProcQty(0);
            setProcStatus('Ativo');
        }
        setProcError('');
        setIsProcModalOpen(true);
    };

    // Filters for list in patients and procedures
    const filteredPatients = patients.filter(p => 
        p.name.toLowerCase().includes(patientSearch.toLowerCase()) || 
        p.cpf.includes(patientSearch.replace(/\D/g, ''))
    );

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
            <div className="px-6 bg-slate-50 border-b border-slate-100 flex gap-4 shrink-0">
                {[
                    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
                    { id: 'pacientes', label: 'Pacientes', icon: Users },
                    { id: 'procedimentos', label: 'Exames & Consultas', icon: Settings },
                    { id: 'historico', label: 'Histórico Completo', icon: History }
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
                            className={`flex items-center gap-2 py-3 border-b-2 font-bold text-xs uppercase tracking-wider transition-all ${
                                isActive 
                                ? 'border-sky-600 text-sky-600' 
                                : 'border-transparent text-slate-400 hover:text-slate-700'
                            }`}
                        >
                            <Icon className="w-4 h-4" />
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
                                    {stats.availableQuantities.reduce((acc, curr) => acc + curr.available, 0)}
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
                                        const isCritical = item.available <= 5;
                                        return (
                                            <div key={idx} className={`p-3.5 border rounded-xl flex flex-col justify-between ${
                                                item.available === 0 
                                                ? 'bg-rose-50/50 border-rose-100' 
                                                : isCritical 
                                                ? 'bg-amber-50/50 border-amber-100' 
                                                : 'bg-slate-50 border-slate-100'
                                            }`}>
                                                <div className="font-extrabold text-xs text-slate-800 truncate">{item.name}</div>
                                                <div className="flex items-center justify-between mt-2">
                                                    <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400">{item.type}</span>
                                                    <span className={`text-xs font-black ${
                                                        item.available === 0 
                                                        ? 'text-rose-600' 
                                                        : isCritical 
                                                        ? 'text-amber-600' 
                                                        : 'text-slate-700'
                                                    }`}>
                                                        {item.available} vagas
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
                    <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                            <div className="relative w-full sm:max-w-md">
                                <input
                                    type="text"
                                    placeholder="Buscar paciente por nome ou CPF..."
                                    className="w-full bg-white border border-slate-200/80 rounded-xl pl-9 pr-3 py-2 text-xs font-semibold focus:outline-none focus:border-sky-500 transition-all text-slate-900"
                                    value={patientSearch}
                                    onChange={(e) => setPatientSearch(e.target.value)}
                                />
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                            </div>
                            <button
                                onClick={() => handleOpenPatientModal()}
                                className="w-full sm:w-auto px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-extrabold rounded-xl shadow-md hover:shadow-sky-500/10 active:scale-95 transition-all text-xs uppercase tracking-wider flex items-center justify-center gap-1.5"
                            >
                                <Plus className="w-4 h-4" /> Novo Paciente
                            </button>
                        </div>

                        {filteredPatients.length > 0 ? (
                            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                            <th className="p-4">Nome</th>
                                            <th className="p-4">CPF</th>
                                            <th className="p-4">Nascimento</th>
                                            <th className="p-4 text-right">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                                        {filteredPatients.map(p => (
                                            <tr key={p.id} className="hover:bg-slate-50/20">
                                                <td className="p-4 font-extrabold text-slate-900">{p.name}</td>
                                                <td className="p-4">{p.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}</td>
                                                <td className="p-4">{new Date(p.birth_date + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                                                <td className="p-4 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            onClick={() => handleOpenHistory(p)}
                                                            className="px-2.5 py-1 text-slate-500 hover:text-sky-600 hover:bg-sky-50 border border-slate-200 rounded-lg text-[10px] uppercase font-bold transition-all"
                                                        >
                                                            Histórico
                                                        </button>
                                                        <button
                                                            onClick={() => handleOpenPatientModal(p)}
                                                            className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-slate-100 rounded-lg transition-all"
                                                            title="Editar Dados"
                                                        >
                                                            <Edit2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="text-center text-xs font-bold text-slate-400 py-12">Nenhum paciente cadastrado.</div>
                        )}
                    </div>
                )}

                {/* 3. PROCEDIMENTOS TAB */}
                {activeTab === 'procedimentos' && (
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
                                                                        const patientName = activeBooking?.paciente?.name;

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
                                    <div className="relative w-full sm:max-w-md">
                                        <input
                                            type="text"
                                            placeholder="Buscar exame ou consulta..."
                                            className="w-full bg-white border border-slate-200/80 rounded-xl pl-9 pr-3 py-2 text-xs font-semibold focus:outline-none focus:border-sky-500 transition-all text-slate-900"
                                            value={procSearch}
                                            onChange={(e) => setProcSearch(e.target.value)}
                                        />
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                    </div>
                                    <button
                                        onClick={() => handleOpenProcModal()}
                                        className="w-full sm:w-auto px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-extrabold rounded-xl shadow-md hover:shadow-sky-500/10 active:scale-95 transition-all text-xs uppercase tracking-wider flex items-center justify-center gap-1.5"
                                    >
                                        <Plus className="w-4 h-4" /> Novo Procedimento
                                    </button>
                                </div>

                                {filteredProcedures.length > 0 ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                        {filteredProcedures.map(p => (
                                            <div 
                                                key={p.id} 
                                                onClick={() => setSelectedProc(p)}
                                                className="p-4 bg-white border border-slate-200 rounded-2xl flex flex-col justify-between h-[130px] shadow-sm relative group hover:border-sky-300 hover:shadow-md transition-all cursor-pointer"
                                            >
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleOpenProcModal(p);
                                                    }}
                                                    className="absolute top-3 right-3 p-1.5 text-slate-300 hover:text-sky-600 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                                    title="Editar Procedimento"
                                                >
                                                    <Edit2 className="w-3.5 h-3.5" />
                                                </button>
                                                
                                                <div>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className={`inline-block px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                                                            p.type === 'Exame' 
                                                            ? 'bg-sky-50 text-sky-600 border border-sky-100' 
                                                            : p.type === 'Consulta'
                                                            ? 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                                                            : 'bg-rose-50 text-rose-600 border border-rose-100'
                                                        }`}>
                                                            {p.type}
                                                        </span>
                                                        {p.code && (
                                                            <span className="text-[9px] text-slate-400 font-extrabold tracking-wider">
                                                                CÓD. {p.code}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <h4 className="font-extrabold text-slate-900 text-sm truncate max-w-[200px]">{p.name}</h4>
                                                </div>

                                                <div className="flex items-center justify-between pt-2 border-t border-slate-50 mt-2">
                                                    <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide border ${
                                                        p.status === 'Ativo' 
                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                                                        : 'bg-slate-100 text-slate-500 border-slate-200'
                                                    }`}>
                                                        {p.status}
                                                    </span>
                                                    <span className="text-xs font-black text-slate-700">{p.available_quantity} cotas</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center text-xs font-bold text-slate-400 py-12">Nenhum exame ou consulta cadastrado.</div>
                                )}
                            </>
                        )}
                    </div>
                )}

                {/* 4. HISTORICO TAB */}
                {activeTab === 'historico' && (
                    <div className="space-y-4">
                        <div className="relative w-full sm:max-w-md">
                            <input
                                type="text"
                                placeholder="Filtrar por Paciente ou Exame..."
                                className="w-full bg-white border border-slate-200/80 rounded-xl pl-9 pr-3 py-2 text-xs font-semibold focus:outline-none focus:border-sky-500 transition-all text-slate-900"
                                value={historySearch}
                                onChange={(e) => setHistorySearch(e.target.value)}
                            />
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
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
                                                    <div className="font-extrabold text-slate-900">{h.paciente?.name || 'Sistema'}</div>
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

            </div>

            {/* MODAL: ADD/EDIT PACIENTE */}
            {isPatientModalOpen && (
                <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
                        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
                            <h3 className="text-base font-black text-slate-800 uppercase tracking-wider">
                                {editingPatient ? 'Editar Paciente' : 'Novo Paciente'}
                            </h3>
                            <button onClick={() => setIsPatientModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-xl text-slate-400 hover:text-slate-700 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleSavePatient} className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
                            {patError && (
                                <div className="p-3 bg-rose-50 border border-rose-100 text-rose-600 text-xs font-bold rounded-xl flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                                    {patError}
                                </div>
                            )}
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5 ml-1">Nome Completo</label>
                                <input
                                    type="text"
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-900 focus:bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none transition-all text-xs font-semibold"
                                    placeholder="Ex: Maria Graça"
                                    value={patName}
                                    onChange={(e) => setPatName(e.target.value)}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5 ml-1">Apelido</label>
                                <input
                                    type="text"
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-900 focus:bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none transition-all text-xs font-semibold"
                                    placeholder="Ex: Netinho"
                                    value={patNickname}
                                    onChange={(e) => setPatNickname(e.target.value)}
                                />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5 ml-1">CPF</label>
                                    <input
                                        type="text"
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-900 focus:bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none transition-all text-xs font-bold tracking-wider"
                                        placeholder="000.000.000-00"
                                        value={patCpf}
                                        onChange={(e) => handleCpfMask(e.target.value)}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5 ml-1">Nascimento</label>
                                    <input
                                        type="date"
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-900 focus:bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none transition-all text-xs font-semibold"
                                        value={patBirthDate}
                                        onChange={(e) => setPatBirthDate(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5 ml-1">Telefone</label>
                                    <input
                                        type="text"
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-900 focus:bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none transition-all text-xs font-semibold"
                                        placeholder="(00) 00000-0000"
                                        value={patPhone}
                                        onChange={(e) => handlePatPhoneChange(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5 ml-1">Bairro</label>
                                    <input
                                        type="text"
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-900 focus:bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none transition-all text-xs font-semibold"
                                        placeholder="Ex: Centro"
                                        value={patNeighborhood}
                                        onChange={(e) => setPatNeighborhood(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5 ml-1">Rua</label>
                                    <input
                                        type="text"
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-900 focus:bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none transition-all text-xs font-semibold"
                                        placeholder="Ex: Rua Principal, 10"
                                        value={patStreet}
                                        onChange={(e) => setPatStreet(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5 ml-1">Cidade</label>
                                    <input
                                        type="text"
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-900 focus:bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none transition-all text-xs font-semibold"
                                        placeholder="Ex: São José do Goiabal - MG"
                                        value={patCity}
                                        onChange={(e) => setPatCity(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>
                            <div className="pt-4 border-t border-slate-50 flex justify-end gap-3 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setIsPatientModalOpen(false)}
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
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5 ml-1">Nome do Procedimento</label>
                                <input
                                    type="text"
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-900 focus:bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none transition-all text-xs font-semibold"
                                    placeholder="Ex: Hemograma Completo ou Consulta Geral"
                                    value={procName}
                                    onChange={(e) => setProcName(e.target.value)}
                                    required
                                />
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
                                        maxLength={4}
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-900 focus:bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none transition-all text-xs font-bold"
                                        placeholder="Ex: 0123"
                                        value={procCode}
                                        onChange={(e) => setProcCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                                        required
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5 ml-1">Status</label>
                                <div className="flex gap-4">
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

            {/* SIDE DRAWER: HISTÓRICO COMPLETO DO PACIENTE */}
            {isHistoryOpen && selectedPatient && (
                <div className="fixed inset-0 z-[999] flex justify-end">
                    <div className="absolute inset-0 bg-slate-900/25 backdrop-blur-[2px] animate-fade-in" onClick={() => setIsHistoryOpen(false)} />
                    <div className="relative z-10 w-full max-w-lg h-full bg-white border-l border-slate-200/80 shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col">
                        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h3 className="font-extrabold text-slate-900 text-base">Histórico Clínico</h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{selectedPatient.name}</p>
                            </div>
                            <button onClick={() => setIsHistoryOpen(false)} className="p-2 hover:bg-slate-200 rounded-xl text-slate-400 hover:text-slate-700 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-5 space-y-3 custom-scrollbar">
                            {patientHistory.length > 0 ? (
                                patientHistory.map(hist => (
                                    <div key={hist.id} className="p-4 bg-slate-50/50 border border-slate-100 rounded-2xl space-y-2.5">
                                        <div className="flex items-center justify-between">
                                            <span className="font-extrabold text-xs text-slate-800">{hist.procedimento?.name}</span>
                                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider border ${
                                                hist.status === 'Solicitado'
                                                ? 'bg-sky-50 text-sky-700 border-sky-100'
                                                : hist.status === 'Agendado' 
                                                ? 'bg-indigo-50 text-indigo-700 border-indigo-100' 
                                                : hist.status === 'Realizado' 
                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                                                : hist.status === 'Não Realizado'
                                                ? 'bg-slate-100 text-slate-600 border-slate-200'
                                                : hist.status === 'Fila de espera'
                                                ? 'bg-amber-50 text-amber-700 border-amber-100'
                                                : hist.status === 'Aguardando Data'
                                                ? 'bg-violet-50 text-violet-700 border-violet-100'
                                                : hist.status === 'Retorno'
                                                ? 'bg-teal-50 text-teal-700 border-teal-100'
                                                : 'bg-rose-50 text-rose-700 border-rose-100'
                                            }`}>
                                                {hist.status}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                            <span>Data: {new Date(hist.appointment_date + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                                            <span>Qtd: {hist.quantity}</span>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center text-xs font-bold text-slate-400 py-12">Nenhum agendamento registrado para este paciente.</div>
                            )}
                        </div>
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
