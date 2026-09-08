// Tela de Agendar - Marcação Oficial de Vagas para Agendamentos Promovidos
import React, { useState, useEffect, useMemo } from 'react';
import { User, AppState, ConsultaAgendamento, ConsultaProcedimento, ConsultaVaga } from '../../types';
import { 
    ArrowLeft, CalendarCheck, Clock, Calendar, CheckCircle2, 
    Sparkles, AlertCircle, Search, Filter, Loader2, User as UserIcon,
    Activity, Stethoscope, ChevronRight, Check, RefreshCw
} from 'lucide-react';
import * as db from '../../services/consultasService';

interface AgendarScreenProps {
    currentUser?: User | null;
    onBack: () => void;
    onNavigate?: (view: string) => void;
    appState?: AppState;
}

export const AgendarScreen: React.FC<AgendarScreenProps> = ({
    currentUser,
    onBack,
    onNavigate
}) => {
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    // Estados principais
    const [promotedBookings, setPromotedBookings] = useState<ConsultaAgendamento[]>([]);
    const [procedures, setProcedures] = useState<ConsultaProcedimento[]>([]);
    const [vagasMap, setVagasMap] = useState<Record<string, ConsultaVaga[]>>({});
    const [bookingsMap, setBookingsMap] = useState<Record<string, ConsultaAgendamento[]>>({});

    // Seleção de data/hora por agendamento
    const [selectedDates, setSelectedDates] = useState<Record<string, string>>({});
    const [selectedTimes, setSelectedTimes] = useState<Record<string, string>>({});

    // Filtros e busca
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedProcedureFilter, setSelectedProcedureFilter] = useState<string>('todos');

    // Mapeamento de vagas ocupadas
    const matchTime = (timeA: string, timeB: string) => timeA.substring(0, 5) === timeB.substring(0, 5);

    const getSlotAssignments = (vagas: ConsultaVaga[], procBookings: ConsultaAgendamento[]) => {
        const assignments = new Map<string, ConsultaAgendamento>();
        const slotsByDate: Record<string, ConsultaVaga[]> = {};
        vagas.forEach(v => {
            if (!slotsByDate[v.data]) slotsByDate[v.data] = [];
            slotsByDate[v.data].push(v);
        });

        const bookingsByDate: Record<string, ConsultaAgendamento[]> = {};
        procBookings.forEach(b => {
            if (b.status === 'Cancelado' || b.status === 'Não Realizado' || !b.appointment_date) return;
            if (!bookingsByDate[b.appointment_date]) bookingsByDate[b.appointment_date] = [];
            bookingsByDate[b.appointment_date].push(b);
        });

        Object.keys(slotsByDate).forEach(dateStr => {
            const slots = slotsByDate[dateStr];
            const bList = bookingsByDate[dateStr] || [];
            const sortedBList = [...bList].sort((a, b) => {
                if (a.priority === 'Especial' && b.priority !== 'Especial') return -1;
                if (a.priority !== 'Especial' && b.priority === 'Especial') return 1;
                return 0;
            });
            const unmatchedBookings = [...sortedBList];
            const matchedBookingIds = new Set<string>();

            slots.forEach(slot => {
                const exactMatch = sortedBList.find(b =>
                    b.appointment_time && matchTime(b.appointment_time, slot.hora) && !matchedBookingIds.has(b.id)
                );
                if (exactMatch) {
                    assignments.set(slot.id, exactMatch);
                    matchedBookingIds.add(exactMatch.id);
                    const idx = unmatchedBookings.findIndex(b => b.id === exactMatch.id);
                    if (idx > -1) unmatchedBookings.splice(idx, 1);
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

    // Carregar dados
    const loadAgendarData = async (silent = false) => {
        if (!silent) setLoading(true);
        setErrorMessage('');
        try {
            const [allAgendamentos, procs] = await Promise.all([
                db.getAgendamentos(),
                db.getProcedimentos()
            ]);

            setProcedures(procs);

            // 1. Agendamentos promovidos ou na fila com prioridade
            // Considera 'Aguardando Data' e agendamentos na fila que já têm vaga disponível
            const candidatos = allAgendamentos.filter(b => 
                b.status === 'Aguardando Data' || b.status === 'Fila de espera'
            );

            // Busca as vagas de todos os procedimentos envolvidos
            const procIds = Array.from(new Set(candidatos.map(b => b.procedimento_id)));
            const vMap: Record<string, ConsultaVaga[]> = {};
            const bMap: Record<string, ConsultaAgendamento[]> = {};

            await Promise.all(procIds.map(async (pId) => {
                try {
                    const [vData, bData] = await Promise.all([
                        db.getVagas(pId),
                        db.getAgendamentos({ procedimentoId: pId })
                    ]);
                    vMap[pId] = vData;
                    bMap[pId] = bData;
                } catch (e) {
                    console.error('Erro ao carregar vagas do procedimento ' + pId, e);
                }
            }));

            setVagasMap(vMap);
            setBookingsMap(bMap);

            // Filtra exclusivamente quem tem vaga disponível compatível:
            // Regra: Agendamento promovido + vaga disponível = aparece em /Consultas/Agendar
            const elegiveis: ConsultaAgendamento[] = [];

            // Agrupa os candidatos por procedimento
            const candidatosByProc: Record<string, ConsultaAgendamento[]> = {};
            candidatos.forEach(c => {
                if (!candidatosByProc[c.procedimento_id]) candidatosByProc[c.procedimento_id] = [];
                candidatosByProc[c.procedimento_id].push(c);
            });

            // Para cada procedimento, ordena com a regra oficial (Especial no topo)
            // e aloca até a quantidade de vagas livres existentes
            Object.keys(candidatosByProc).forEach(procId => {
                const procVagas = vMap[procId] || [];
                const procBookings = bMap[procId] || [];
                const assignments = getSlotAssignments(procVagas, procBookings);

                // Vagas livres disponíveis para este procedimento
                const freeSlots = procVagas.filter(v => 
                    (v.status === 'Disponível' || !v.status) && !assignments.has(v.id)
                );

                const totalVagasLivres = freeSlots.length;
                if (totalVagasLivres > 0) {
                    // Ordena a fila respeitando estritamente a prioridade de Agendamentos Especiais
                    const ordered = db.orderConsultasQueue(candidatosByProc[procId]);
                    // Apenas os N primeiros que possuem vaga física disponível aparecem
                    const aptos = ordered.slice(0, totalVagasLivres);
                    elegiveis.push(...aptos);
                }
            });

            // Ordena o conjunto final preservando a queue_position de cada procedimento (Especiais primeiro)
            elegiveis.sort((a, b) => {
                const isSpecialA = a.priority === 'Especial';
                const isSpecialB = b.priority === 'Especial';
                if (isSpecialA !== isSpecialB) return isSpecialA ? -1 : 1;
                const posA = a.queue_position ?? 999;
                const posB = b.queue_position ?? 999;
                if (posA !== posB) return posA - posB;
                const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
                const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
                return timeA - timeB;
            });
            setPromotedBookings(elegiveis);

            // Pré-seleciona a primeira vaga livre para cada agendamento elegível
            const initDates: Record<string, string> = {};
            const initTimes: Record<string, string> = {};

            elegiveis.forEach(b => {
                const procVagas = vMap[b.procedimento_id] || [];
                const procBookings = bMap[b.procedimento_id] || [];
                const assignments = getSlotAssignments(procVagas, procBookings);
                const freeSlots = procVagas.filter(v => 
                    (v.status === 'Disponível' || !v.status) && !assignments.has(v.id)
                );

                if (freeSlots.length > 0) {
                    const firstDate = freeSlots[0].data;
                    initDates[b.id] = firstDate;
                    const timesForDate = freeSlots.filter(s => s.data === firstDate).map(s => s.hora.substring(0, 5));
                    if (timesForDate.length > 0) {
                        initTimes[b.id] = timesForDate[0];
                    }
                }
            });

            setSelectedDates(prev => ({ ...initDates, ...prev }));
            setSelectedTimes(prev => ({ ...initTimes, ...prev }));

        } catch (err: any) {
            console.error('[AgendarScreen] Erro ao carregar dados:', err);
            setErrorMessage(err.message || 'Erro ao carregar agendamentos aptos para marcação.');
        } finally {
            if (!silent) setLoading(false);
        }
    };

    useEffect(() => {
        loadAgendarData();
    }, []);

    // Sincronização em tempo real quando houver novas vagas, novos agendamentos ou cancelamentos
    useEffect(() => {
        const handleSync = () => {
            loadAgendarData(true);
        };

        window.addEventListener('consultas-vagas-changed', handleSync);
        window.addEventListener('consultas-agendamentos-changed', handleSync);
        window.addEventListener('consultas-procedimentos-changed', handleSync);

        return () => {
            window.removeEventListener('consultas-vagas-changed', handleSync);
            window.removeEventListener('consultas-agendamentos-changed', handleSync);
            window.removeEventListener('consultas-procedimentos-changed', handleSync);
        };
    }, []);

    // Confirmar Agendamento
    const handleConfirmBooking = async (booking: ConsultaAgendamento) => {
        const date = selectedDates[booking.id];
        const time = selectedTimes[booking.id];

        if (!date || !time) {
            alert('Por favor, selecione uma Data e um Horário para confirmar a marcação.');
            return;
        }

        setActionLoading(booking.id);
        setErrorMessage('');
        setSuccessMessage('');

        try {
            const result = await db.confirmarDataAgendamento(booking.id, date, time);
            if (!result) throw new Error('Falha ao confirmar agendamento.');

            setSuccessMessage(`Consulta de ${booking.paciente?.name || 'paciente'} agendada com sucesso para ${date.split('-').reverse().join('/')} às ${time}!`);
            
            // Recarrega os dados imediatamente
            await loadAgendarData(true);

            setTimeout(() => {
                setSuccessMessage('');
            }, 5000);
        } catch (err: any) {
            console.error('[AgendarScreen] Erro ao agendar:', err);
            setErrorMessage(err.message || 'Erro ao efetivar agendamento.');
        } finally {
            setActionLoading(null);
        }
    };

    // Filtragem em memória
    const filteredBookings = useMemo(() => {
        return promotedBookings.filter(b => {
            const matchesSearch = !searchTerm.trim() || 
                b.paciente?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (b.paciente?.cpf && b.paciente.cpf.includes(searchTerm.replace(/\D/g, ''))) ||
                b.procedimento?.name.toLowerCase().includes(searchTerm.toLowerCase());

            const matchesProc = selectedProcedureFilter === 'todos' || b.procedimento_id === selectedProcedureFilter;

            return matchesSearch && matchesProc;
        });
    }, [promotedBookings, searchTerm, selectedProcedureFilter]);

    const totalEspeciais = promotedBookings.filter(b => b.priority === 'Especial').length;
    const totalComuns = promotedBookings.filter(b => b.priority !== 'Especial').length;

    return (
        <div className="w-full mx-auto flex flex-col flex-1 h-full max-h-full min-h-0 bg-white rounded-3xl border border-slate-200/80 shadow-2xl shadow-slate-100 overflow-hidden">
            {/* Header Superior */}
            <div className="bg-white border-b border-slate-200/80 p-4 md:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shrink-0">
                <div className="flex items-center gap-3">
                    <button
                        onClick={onBack}
                        className="p-2.5 rounded-2xl bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200/70 transition-all active:scale-95 cursor-pointer"
                        title="Voltar ao módulo de Consultas"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20 ring-4 ring-emerald-50">
                        <CalendarCheck className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl md:text-2xl font-black text-slate-900 uppercase tracking-tight">
                                Agendar
                            </h1>
                            <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
                                Vagas Disponíveis
                            </span>
                        </div>
                        <p className="text-xs font-semibold text-slate-500 mt-0.5">
                            Efetivação de marcações para agendamentos promovidos com vagas liberadas
                        </p>
                    </div>
                </div>

                {/* Métricas Rápidas */}
                <div className="flex items-center gap-2 self-stretch sm:self-auto flex-wrap">
                    <div className="px-3.5 py-2 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-amber-600" />
                        <div>
                            <span className="block text-[8px] font-black uppercase tracking-widest text-amber-800">Especiais Aptos</span>
                            <span className="text-sm font-black text-amber-950">{totalEspeciais}</span>
                        </div>
                    </div>

                    <div className="px-3.5 py-2 rounded-2xl bg-sky-50 border border-sky-200/80 flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-sky-600" />
                        <div>
                            <span className="block text-[8px] font-black uppercase tracking-widest text-sky-800">Total Aptos</span>
                            <span className="text-sm font-black text-sky-950">{promotedBookings.length}</span>
                        </div>
                    </div>

                    <button
                        onClick={() => loadAgendarData()}
                        disabled={loading}
                        className="p-2.5 rounded-2xl bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/70 transition-all active:scale-95 cursor-pointer ml-1"
                        title="Atualizar dados da fila"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-sky-600' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Alertas de Sucesso / Erro */}
            {successMessage && (
                <div className="mx-4 md:mx-6 mt-4 p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-bold text-emerald-900 flex items-center gap-2 animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{successMessage}</span>
                </div>
            )}

            {errorMessage && (
                <div className="mx-4 md:mx-6 mt-4 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-900 flex items-center gap-2 animate-in fade-in">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{errorMessage}</span>
                </div>
            )}

            {/* Barra de Filtros e Busca */}
            <div className="p-4 md:p-6 pb-2 border-b border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
                <div className="relative flex-1 max-w-md">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder="Buscar por nome do paciente, CPF ou exame..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-slate-50/80 border border-slate-200/80 rounded-2xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    />
                </div>

                <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-slate-400 shrink-0" />
                    <select
                        value={selectedProcedureFilter}
                        onChange={(e) => setSelectedProcedureFilter(e.target.value)}
                        className="py-2 px-3 bg-slate-50/80 border border-slate-200/80 rounded-2xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all uppercase"
                    >
                        <option value="todos">Todos os Procedimentos ({promotedBookings.length})</option>
                        {procedures.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Área Principal de Conteúdo */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-3">
                        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
                        <span className="text-xs font-bold uppercase tracking-wider">Carregando agendamentos com vagas disponíveis...</span>
                    </div>
                ) : filteredBookings.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 text-center bg-slate-50/60 border border-dashed border-slate-200 rounded-3xl">
                        <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200/60 flex items-center justify-center text-emerald-600 mb-3">
                            <CalendarCheck className="w-8 h-8" />
                        </div>
                        <h3 className="text-base font-black text-slate-800 uppercase tracking-tight mb-1">
                            Nenhum agendamento pendente com vaga disponível
                        </h3>
                        <p className="text-xs font-semibold text-slate-500 max-w-md leading-relaxed">
                            Assim que surgirem novas vagas compatíveis com os pacientes promovidos da fila de espera, eles aparecerão automaticamente aqui para marcação oficial.
                        </p>
                        <div className="mt-4 flex items-center gap-2">
                            <button
                                onClick={() => onNavigate?.('consultas:liberar-vagas')}
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all shadow-sm active:scale-95 cursor-pointer"
                            >
                                Ir para Liberar Vagas
                            </button>
                            <button
                                onClick={() => onNavigate?.('consultas:acompanhar')}
                                className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all shadow-2xs active:scale-95 cursor-pointer"
                            >
                                Ver Fila em Acompanhar
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4">
                        {filteredBookings.map((b, index) => {
                            const isSpecial = b.priority === 'Especial';
                            const procVagas = vagasMap[b.procedimento_id] || [];
                            const procBookings = bookingsMap[b.procedimento_id] || [];
                            const assignments = getSlotAssignments(procVagas, procBookings);

                            const freeSlots = procVagas.filter(v => 
                                (v.status === 'Disponível' || !v.status) && !assignments.has(v.id)
                            );

                            const uniqueDates = Array.from(new Set(freeSlots.map(s => s.data))).sort();
                            const curSelectedDate = selectedDates[b.id] || (uniqueDates.length > 0 ? uniqueDates[0] : '');
                            const timesForDate = freeSlots
                                .filter(s => s.data === curSelectedDate)
                                .map(s => s.hora.substring(0, 5))
                                .sort();
                            const curSelectedTime = selectedTimes[b.id] || (timesForDate.length > 0 ? timesForDate[0] : '');

                            const patientName = b.paciente ? (b.paciente.nickname ? `${b.paciente.name} (${b.paciente.nickname})` : b.paciente.name) : 'Paciente não informado';
                            const rawCpf = b.paciente?.cpf || '';
                            const formattedCpf = rawCpf ? rawCpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") : 'S/ CPF';
                            const solDate = b.solicitation_date 
                                ? new Date(b.solicitation_date + 'T00:00:00').toLocaleDateString('pt-BR')
                                : (b.created_at ? new Date(b.created_at).toLocaleDateString('pt-BR') : '-');

                            const isSubmitting = actionLoading === b.id;

                            return (
                                <div
                                    key={b.id}
                                    className={`p-4 md:p-5 rounded-2xl border transition-all duration-300 relative overflow-hidden bg-white shadow-xs ${
                                        isSpecial
                                            ? 'border-amber-300 ring-2 ring-amber-400/20 hover:shadow-md'
                                            : 'border-slate-200/80 hover:border-emerald-200 hover:shadow-md'
                                    }`}
                                >
                                    {/* Faixa lateral indicadora */}
                                    <div className={`absolute top-0 left-0 w-1.5 h-full ${
                                        isSpecial ? 'bg-amber-400' : 'bg-emerald-500'
                                    }`} />

                                    <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-4 pl-2">
                                        {/* Coluna 1: Posição, Paciente e Dados Clínicos */}
                                        <div className="flex items-start gap-3 flex-1 min-w-0">
                                            {/* Posição na Fila / Badge Especial */}
                                            <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex flex-col items-center justify-center shrink-0 border shadow-2xs ${
                                                isSpecial
                                                    ? 'bg-gradient-to-br from-amber-100 via-yellow-100 to-amber-200 border-amber-400 text-amber-950'
                                                    : 'bg-emerald-50 border-emerald-200 text-emerald-950'
                                            }`}>
                                                <span className="text-[8px] font-black uppercase tracking-wider text-amber-900 leading-none">
                                                    {isSpecial ? 'ESPECIAL' : 'POSIÇÃO'}
                                                </span>
                                                <span className="text-xl sm:text-2xl font-black font-mono leading-none my-0.5">
                                                    {b.queue_position ? `${b.queue_position}º` : `${index + 1}º`}
                                                </span>
                                                <span className="text-[7px] font-black uppercase tracking-widest text-slate-600 leading-none">
                                                    FILA
                                                </span>
                                            </div>

                                            {/* Informações do Paciente e Exame */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                                                    {isSpecial && (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider text-amber-950 bg-gradient-to-r from-amber-200 via-yellow-100 to-amber-200 border border-amber-400 shadow-2xs ring-1 ring-amber-400/30">
                                                            <Sparkles className="w-3 h-3 text-amber-700 fill-amber-500 animate-pulse shrink-0" />
                                                            <span>AGENDAMENTO ESPECIAL</span>
                                                            {b.special_sequence ? (
                                                                <span className="ml-1 bg-amber-950/15 px-1 py-0.2 rounded text-[8px] font-black">
                                                                    Nº {b.special_sequence}
                                                                </span>
                                                            ) : null}
                                                        </span>
                                                    )}
                                                    <span className="px-2 py-0.5 rounded-md text-[8.5px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
                                                        Vaga Disponível
                                                    </span>
                                                    <span className="px-2 py-0.5 rounded-md text-[8.5px] font-black uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                                                        {b.priority === 'Urgência' ? 'Urgência' : b.is_retorno ? 'Retorno' : 'Normal'}
                                                    </span>
                                                </div>

                                                <h3 className="text-sm sm:text-base font-black text-slate-900 uppercase truncate" title={patientName}>
                                                    {patientName}
                                                </h3>

                                                <div className="flex items-center gap-3 text-xs font-semibold text-slate-500 mt-1 flex-wrap">
                                                    <span className="font-mono flex items-center gap-1">
                                                        <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                                                        CPF: {formattedCpf}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <Activity className="w-3.5 h-3.5 text-slate-400" />
                                                        <strong className="text-slate-800 uppercase">{b.procedimento?.name || 'Procedimento'}</strong>
                                                        {b.procedimento?.code && (
                                                            <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-mono font-bold">
                                                                {b.procedimento.code}
                                                            </span>
                                                        )}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                                        Solicitado: {solDate}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Coluna 2: Seletor de Vagas Disponíveis e Ação de Agendamento */}
                                        <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200/70 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
                                            {/* Data Disponível */}
                                            <div className="flex flex-col min-w-[140px]">
                                                <label className="text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1">
                                                    <Calendar className="w-3 h-3 text-emerald-600" />
                                                    Data da Vaga
                                                </label>
                                                <select
                                                    value={curSelectedDate}
                                                    onChange={(e) => {
                                                        const newDate = e.target.value;
                                                        setSelectedDates(prev => ({ ...prev, [b.id]: newDate }));
                                                        const newTimes = freeSlots
                                                            .filter(s => s.data === newDate)
                                                            .map(s => s.hora.substring(0, 5))
                                                            .sort();
                                                        if (newTimes.length > 0) {
                                                            setSelectedTimes(prev => ({ ...prev, [b.id]: newTimes[0] }));
                                                        }
                                                    }}
                                                    className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-black text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                                                >
                                                    {uniqueDates.map(d => (
                                                        <option key={d} value={d}>
                                                            {d.split('-').reverse().join('/')}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>

                                            {/* Horário Disponível */}
                                            <div className="flex flex-col min-w-[110px]">
                                                <label className="text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1">
                                                    <Clock className="w-3 h-3 text-emerald-600" />
                                                    Horário
                                                </label>
                                                <select
                                                    value={curSelectedTime}
                                                    onChange={(e) => setSelectedTimes(prev => ({ ...prev, [b.id]: e.target.value }))}
                                                    className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-black text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono"
                                                >
                                                    {timesForDate.map(t => (
                                                        <option key={t} value={t}>
                                                            {t}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>

                                            {/* Responsável e Botão Agendar */}
                                            <div className="flex flex-col justify-end">
                                                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-1 hidden sm:block">
                                                    Operador: {currentUser?.name ? currentUser.name.split(' ')[0] : 'Sistema'}
                                                </span>
                                                <button
                                                    type="button"
                                                    disabled={isSubmitting || !curSelectedDate || !curSelectedTime}
                                                    onClick={() => handleConfirmBooking(b)}
                                                    className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95 cursor-pointer ${
                                                        isSpecial
                                                            ? 'bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-white shadow-amber-500/20'
                                                            : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                                                    }`}
                                                >
                                                    {isSubmitting ? (
                                                        <>
                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                            <span>Agendando...</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Check className="w-4 h-4" />
                                                            <span>Agendar</span>
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};
