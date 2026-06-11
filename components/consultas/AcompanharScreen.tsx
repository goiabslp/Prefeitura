import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { User, ConsultaAgendamento, ConsultaProcedimento, AppState } from '../../types';
import { ArrowLeft, Search, Filter, Calendar, CheckCircle2, XCircle, Trash2, Loader2, Sparkles, Clock, FileDown, UserX, Repeat, X } from 'lucide-react';
import * as db from '../../services/consultasService';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { ConsultaPdfGenerator } from './ConsultaPdfGenerator';
import { ConsultasReportPdfGenerator } from './ConsultasReportPdfGenerator';

interface AcompanharScreenProps {
    currentUser: User;
    onBack: () => void;
    appState: AppState;
}

export const AcompanharScreen: React.FC<AcompanharScreenProps> = ({
    currentUser,
    onBack,
    appState
}) => {
    // Booking list and state
    const [bookings, setBookings] = useState<ConsultaAgendamento[]>([]);
    const [allBookings, setAllBookings] = useState<ConsultaAgendamento[]>([]);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [reportType, setReportType] = useState<'completo' | 'fila'>('completo');
    const [isPrintingReport, setIsPrintingReport] = useState(false);
    const [queuePositions, setQueuePositions] = useState<Record<string, number>>({});
    const [procedures, setProcedures] = useState<ConsultaProcedimento[]>([]);
    const [loading, setLoading] = useState(true);
    const [printingBooking, setPrintingBooking] = useState<ConsultaAgendamento | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);

    // Filters
    const [filterName, setFilterName] = useState('');
    const [filterCpf, setFilterCpf] = useState('');
    const [filterProcId, setFilterProcId] = useState('');
    const [filterDate, setFilterDate] = useState('');
    const [filterStatus, setFilterStatus] = useState('');

    // Operations states
    const [operatingId, setOperatingId] = useState<string | null>(null);
    const [retornoBooking, setRetornoBooking] = useState<ConsultaAgendamento | null>(null);
    const [retornoDate, setRetornoDate] = useState('');
    const [isRetornoModalOpen, setIsRetornoModalOpen] = useState(false);

    // Permissions check
    const isAdmin = currentUser.role === 'admin';
    const canCancel = currentUser.permissions?.includes('parent_consultas_novo_agendamento') || isAdmin;
    const canComplete = currentUser.permissions?.includes('parent_consultas_novo_agendamento') || isAdmin;
    const canDelete = isAdmin; // Delete strictly admin

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

            // Apply filters in-memory
            let filtered = allBookingData;
            if (filterName) {
                const search = filterName.toLowerCase();
                filtered = filtered.filter(a => a.paciente?.name.toLowerCase().includes(search));
            }
            if (filterCpf) {
                const search = filterCpf.replace(/\D/g, '');
                filtered = filtered.filter(a => a.paciente?.cpf.includes(search));
            }
            if (filterProcId) {
                filtered = filtered.filter(a => a.procedimento_id === filterProcId);
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
    }, [filterProcId, filterDate, filterStatus]);

    // Debounce manual typing filters (Name/CPF)
    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            loadData(true);
        }, 400);

        return () => clearTimeout(delayDebounceFn);
    }, [filterName, filterCpf]);

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
    }, [filterName, filterCpf, filterProcId, filterDate, filterStatus]);

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
            loadData(true);
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

    return (
        <div className="w-full mx-auto flex flex-col flex-1 h-full max-h-full min-h-0 bg-white rounded-3xl border border-slate-200/80 shadow-2xl shadow-slate-100 overflow-hidden">
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
                        <h3 className="font-extrabold text-slate-900 tracking-tight text-lg flex items-center gap-2">
                            Acompanhar Agendamentos 
                            <span className="flex h-2 w-2 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                        </h3>
                        <p className="text-xs text-slate-500 font-medium">Lista de agendamentos realizados e andamento em tempo real</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setIsReportModalOpen(true)}
                        className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all shadow-sm border bg-white text-sky-600 border-sky-100 hover:bg-sky-50 hover:text-sky-700"
                        title="Gerar Relatórios"
                    >
                        <FileDown className="w-3.5 h-3.5" />
                        Relatório
                    </button>
                    <button
                        onClick={() => setFilterStatus(prev => prev === 'Fila de espera' ? '' : 'Fila de espera')}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all shadow-sm border ${
                            filterStatus === 'Fila de espera'
                            ? 'bg-amber-500 text-white border-amber-600 shadow-amber-200/50 hover:bg-amber-600'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-800'
                        }`}
                        title="Filtrar por Pacientes na Fila de Espera"
                    >
                        <Clock className="w-3.5 h-3.5" />
                        Fila de Espera
                    </button>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="p-4 bg-slate-50 border-b border-slate-100 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 shrink-0">
                <div className="relative">
                    <input
                        type="text"
                        placeholder="Filtrar por Paciente..."
                        className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-xs font-semibold focus:outline-none focus:border-sky-500 transition-all text-slate-900"
                        value={filterName}
                        onChange={(e) => setFilterName(e.target.value)}
                    />
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
                </div>
                <div className="relative">
                    <input
                        type="text"
                        placeholder="Filtrar por CPF..."
                        className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-xs font-semibold focus:outline-none focus:border-sky-500 transition-all text-slate-900"
                        value={filterCpf}
                        onChange={(e) => setFilterCpf(e.target.value)}
                    />
                    <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
                </div>
                <div>
                    <select
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-sky-500 transition-all text-slate-900 appearance-none cursor-pointer"
                        value={filterProcId}
                        onChange={(e) => setFilterProcId(e.target.value)}
                    >
                        <option value="">Todos os Exames/Consultas</option>
                        {procedures.map(p => (
                            <option key={p.id} value={p.id}>{p.name} {p.code ? `[${p.code}]` : ''} ({p.type})</option>
                        ))}
                    </select>
                </div>
                <div>
                    <input
                        type="date"
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-sky-500 transition-all text-slate-900"
                        value={filterDate}
                        onChange={(e) => setFilterDate(e.target.value)}
                    />
                </div>
                <div>
                    <select
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-sky-500 transition-all text-slate-900 appearance-none cursor-pointer"
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                    >
                        <option value="">Todos os Status</option>
                        <option value="Solicitado">Solicitado</option>
                        <option value="Agendado">Agendado</option>
                        <option value="Aguardando Data">Aguardando Data</option>
                        <option value="Fila de espera">Fila de espera</option>
                        <option value="Realizado">Realizado</option>
                        <option value="Não Realizado">Não Realizado</option>
                        <option value="Cancelado">Cancelado</option>
                    </select>
                </div>
            </div>

            {/* List Table Area */}
            <div className="flex-1 overflow-auto bg-slate-50/35 p-6 min-h-0">
                {loading ? (
                    <div className="h-full w-full flex flex-col items-center justify-center gap-2">
                        <Loader2 className="w-8 h-8 text-sky-600 animate-spin" />
                        <span className="text-xs font-bold text-slate-500">Carregando agendamentos...</span>
                    </div>
                ) : bookings.length > 0 ? (
                    <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                        <th className="p-4 text-center w-24">Posição</th>
                                        <th className="p-4">Solicitado</th>
                                        <th className="p-4">Paciente / CPF</th>
                                        <th className="p-4">Exame / Procedimento</th>
                                        <th className="p-4">Data Agendada</th>
                                        <th className="p-4 text-center">Prioridade</th>
                                        <th className="p-4 text-center">Status</th>
                                        <th className="p-4">Responsável</th>
                                        <th className="p-4 text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {sortedBookings.map((booking) => {
                                        const isOperating = operatingId === booking.id;
                                        return (
                                            <tr key={booking.id} className="hover:bg-slate-50/30 text-xs font-semibold text-slate-700 transition-colors">
                                                <td className="p-4 text-center">
                                                    {booking.status === 'Fila de espera' && queuePositions[booking.id] ? (
                                                        <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full bg-amber-50 text-amber-600 border border-amber-200 font-extrabold text-[11px] shadow-sm animate-pulse">
                                                            {queuePositions[booking.id]}º
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-300 font-normal">-</span>
                                                    )}
                                                </td>
                                                <td className="p-4 text-slate-500">
                                                    {booking.solicitation_date 
                                                        ? new Date(booking.solicitation_date + 'T00:00:00').toLocaleDateString('pt-BR') 
                                                        : (booking.created_at ? new Date(booking.created_at).toLocaleDateString('pt-BR') : '-')}
                                                </td>
                                                <td className="p-4">
                                                    <div className="font-extrabold text-slate-900">{booking.paciente?.name || 'Carregando...'}</div>
                                                    <div className="text-[10px] text-slate-400 mt-0.5 font-bold">
                                                        CPF: {booking.paciente?.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}
                                                    </div>
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex items-center gap-2">
                                                        <div className="font-bold text-slate-800">{booking.procedimento?.name || 'Carregando...'}</div>
                                                        {booking.procedimento?.code && (
                                                            <span className="text-[9px] text-slate-400 font-extrabold bg-slate-100 px-1.5 py-0.5 rounded">
                                                                {booking.procedimento.code}
                                                            </span>
                                                        )}
                                                    </div>
                                                     <span className={`inline-block px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider rounded mt-1 ${
                                                         booking.procedimento?.type === 'Exame' 
                                                         ? 'bg-sky-50 text-sky-600' 
                                                         : booking.procedimento?.type === 'Consulta'
                                                         ? 'bg-indigo-50 text-indigo-600'
                                                         : 'bg-rose-50 text-rose-600'
                                                     }`}>
                                                        {booking.procedimento?.type}
                                                     </span>
                                                </td>
                                                <td className="p-4 text-slate-500">
                                                    {new Date(booking.appointment_date + 'T00:00:00').toLocaleDateString('pt-BR')}
                                                </td>
                                                <td className="p-4 text-center">
                                                     <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                                         booking.priority === 'Urgência'
                                                         ? 'bg-rose-500 text-white shadow-sm'
                                                         : booking.is_retorno
                                                         ? 'bg-teal-500 text-white shadow-sm'
                                                         : 'bg-slate-100 text-slate-600'
                                                     }`}>
                                                         {booking.priority === 'Urgência' ? 'Urgência' : booking.is_retorno ? 'Retorno' : 'Normal'}
                                                     </span>
                                                </td>
                                                <td className="p-4 text-center">
                                                    <div className="flex flex-col items-center gap-1">
                                                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                                                            booking.status === 'Solicitado'
                                                            ? 'bg-sky-50 text-sky-700 border-sky-100'
                                                            : booking.status === 'Agendado' 
                                                            ? 'bg-indigo-50 text-indigo-700 border-indigo-100' 
                                                            : booking.status === 'Realizado' 
                                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                                                            : booking.status === 'Não Realizado'
                                                            ? 'bg-slate-100 text-slate-600 border-slate-200'
                                                            : booking.status === 'Fila de espera'
                                                            ? 'bg-amber-50 text-amber-700 border-amber-100'
                                                            : booking.status === 'Aguardando Data'
                                                            ? 'bg-violet-50 text-violet-700 border-violet-100'
                                                            : booking.status === 'Retorno'
                                                            ? 'bg-teal-50 text-teal-700 border-teal-100'
                                                            : 'bg-rose-50 text-rose-700 border-rose-100'
                                                        }`}>
                                                            {booking.status}
                                                        </span>
                                                        {booking.status === 'Fila de espera' && queuePositions[booking.id] && (
                                                            <span className="text-[10px] text-amber-600 font-extrabold uppercase tracking-wide bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded shadow-sm">
                                                                {queuePositions[booking.id]}º na fila
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="p-4 text-slate-500">
                                                    <div>{booking.responsavel?.name || 'Sistema'}</div>
                                                    <div className="text-[9px] text-slate-400 mt-0.5">
                                                        {booking.created_at && new Date(booking.created_at).toLocaleString('pt-BR')}
                                                    </div>
                                                </td>
                                                <td className="p-4 text-right">
                                                    <div className="flex items-center justify-end gap-2.5">
                                                        {isOperating ? (
                                                            <Loader2 className="w-5 h-5 text-sky-600 animate-spin" />
                                                        ) : (
                                                            <>
                                                                <button
                                                                    onClick={() => handleDownloadPdf(booking)}
                                                                    disabled={isGenerating}
                                                                    className="p-1.5 text-sky-600 hover:text-white hover:bg-sky-500 rounded-lg border border-sky-100 hover:border-sky-500 transition-all flex items-center justify-center disabled:opacity-50"
                                                                    title="Baixar Comprovante PDF"
                                                                >
                                                                    {isGenerating && printingBooking?.id === booking.id ? (
                                                                        <Loader2 className="w-4.5 h-4.5 animate-spin" />
                                                                    ) : (
                                                                        <FileDown className="w-4 h-4" />
                                                                    )}
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
                                                                        className="p-1.5 text-teal-600 hover:text-white hover:bg-teal-500 rounded-lg border border-teal-100 hover:border-teal-500 transition-all flex items-center justify-center"
                                                                        title="Agendar Retorno"
                                                                    >
                                                                        <Repeat className="w-4 h-4" />
                                                                    </button>
                                                                )}
                                                                {booking.status === 'Solicitado' && (
                                                                    <>
                                                                        {canComplete && (
                                                                            <button
                                                                                onClick={() => handleStatusUpdate(booking.id, 'Agendado')}
                                                                                className="p-1.5 text-emerald-500 hover:text-white hover:bg-emerald-500 rounded-lg border border-emerald-100 hover:border-emerald-500 transition-all flex items-center justify-center"
                                                                                title="Aprovar Agendamento"
                                                                            >
                                                                                <CheckCircle2 className="w-4 h-4" />
                                                                            </button>
                                                                        )}
                                                                        {canCancel && (
                                                                            <button
                                                                                onClick={() => handleStatusUpdate(booking.id, 'Cancelado')}
                                                                                className="p-1.5 text-rose-400 hover:text-white hover:bg-rose-500 rounded-lg border border-rose-100 hover:border-rose-500 transition-all flex items-center justify-center"
                                                                                title="Rejeitar/Cancelar Agendamento"
                                                                            >
                                                                                <XCircle className="w-4 h-4" />
                                                                            </button>
                                                                        )}
                                                                    </>
                                                                )}
                                                                {booking.status === 'Agendado' && (
                                                                    <>
                                                                        {canComplete && (
                                                                            <button
                                                                                onClick={() => handleStatusUpdate(booking.id, 'Realizado')}
                                                                                className="p-1.5 text-emerald-500 hover:text-white hover:bg-emerald-500 rounded-lg border border-emerald-100 hover:border-emerald-500 transition-all flex items-center justify-center"
                                                                                title="Confirmar Realização"
                                                                            >
                                                                                <CheckCircle2 className="w-4 h-4" />
                                                                            </button>
                                                                        )}
                                                                        {canComplete && (
                                                                            <button
                                                                                onClick={() => handleStatusUpdate(booking.id, 'Não Realizado')}
                                                                                className="p-1.5 text-slate-500 hover:text-white hover:bg-slate-500 rounded-lg border border-slate-200 hover:border-slate-500 transition-all flex items-center justify-center"
                                                                                title="Marcar Falta (Não Realizado)"
                                                                            >
                                                                                <UserX className="w-4 h-4" />
                                                                            </button>
                                                                        )}
                                                                        {canCancel && (
                                                                            <button
                                                                                onClick={() => handleStatusUpdate(booking.id, 'Cancelado')}
                                                                                className="p-1.5 text-rose-400 hover:text-white hover:bg-rose-500 rounded-lg border border-rose-100 hover:border-rose-500 transition-all flex items-center justify-center"
                                                                                title="Cancelar Agendamento"
                                                                            >
                                                                                <XCircle className="w-4 h-4" />
                                                                            </button>
                                                                        )}
                                                                    </>
                                                                )}
                                                                {(booking.status === 'Fila de espera' || booking.status === 'Aguardando Data') && (
                                                                    <>
                                                                        {canCancel && (
                                                                            <button
                                                                                onClick={() => handleStatusUpdate(booking.id, 'Cancelado')}
                                                                                className="p-1.5 text-rose-400 hover:text-white hover:bg-rose-500 rounded-lg border border-rose-100 hover:border-rose-500 transition-all flex items-center justify-center"
                                                                                title="Cancelar Agendamento"
                                                                            >
                                                                                <XCircle className="w-4 h-4" />
                                                                            </button>
                                                                        )}
                                                                    </>
                                                                )}
                                                                {canDelete && (
                                                                    <button
                                                                        onClick={() => handleDelete(booking.id)}
                                                                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg border border-slate-200 hover:border-slate-700 transition-all"
                                                                        title="Excluir Registro"
                                                                    >
                                                                        <Trash2 className="w-4 h-4" />
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
                                    <span className="text-slate-800 uppercase font-black">{retornoBooking.paciente?.name}</span>
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
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden border border-slate-100 flex flex-col transform transition-all animate-scale-in">
                        {/* Header */}
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
                            <div>
                                <h3 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                                    <FileDown className="w-5 h-5 text-sky-600" />
                                    Painel de Relatórios Municipais
                                </h3>
                                <p className="text-xs text-slate-500 font-semibold mt-0.5">Visualize e exporte informações de agendamentos e filas em tempo real</p>
                            </div>
                            <button 
                                onClick={() => setIsReportModalOpen(false)} 
                                className="p-2 hover:bg-slate-200 rounded-xl text-slate-400 hover:text-slate-700 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Tabs Selector */}
                        <div className="px-6 py-3 bg-slate-100/40 border-b border-slate-100 flex gap-2 shrink-0">
                            <button
                                onClick={() => setReportType('completo')}
                                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                                    reportType === 'completo'
                                    ? 'bg-sky-600 text-white shadow-md shadow-sky-200/50'
                                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                                }`}
                            >
                                <FileDown className="w-3.5 h-3.5" />
                                Relatório Completo
                            </button>
                            <button
                                onClick={() => setReportType('fila')}
                                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                                    reportType === 'fila'
                                    ? 'bg-amber-500 text-white shadow-md shadow-amber-200/50'
                                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                                }`}
                            >
                                <Clock className="w-3.5 h-3.5" />
                                Fila de Espera
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6 min-h-0 bg-slate-50/30">
                            {reportType === 'completo' ? (
                                <>
                                    {/* Stats Grid */}
                                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
                                        <div className="bg-white border border-slate-200/60 p-4 rounded-2xl shadow-sm flex flex-col justify-between">
                                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total</span>
                                            <span className="text-xl font-black text-slate-800 mt-1">{statsCompleto.total}</span>
                                        </div>
                                        <div className="bg-white border border-slate-200/60 p-4 rounded-2xl shadow-sm flex flex-col justify-between">
                                            <span className="text-[10px] font-black uppercase tracking-wider text-sky-500">Solicitados</span>
                                            <span className="text-xl font-black text-sky-600 mt-1">{statsCompleto.solicitados}</span>
                                        </div>
                                        <div className="bg-white border border-slate-200/60 p-4 rounded-2xl shadow-sm flex flex-col justify-between">
                                            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-500">Agendados</span>
                                            <span className="text-xl font-black text-indigo-600 mt-1">{statsCompleto.agendados}</span>
                                        </div>
                                        <div className="bg-white border border-slate-200/60 p-4 rounded-2xl shadow-sm flex flex-col justify-between">
                                            <span className="text-[10px] font-black uppercase tracking-wider text-amber-500">Em Fila</span>
                                            <span className="text-xl font-black text-amber-600 mt-1">{statsCompleto.fila}</span>
                                        </div>
                                        <div className="bg-white border border-slate-200/60 p-4 rounded-2xl shadow-sm flex flex-col justify-between col-span-2 md:col-span-1">
                                            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-500">Realizados</span>
                                            <span className="text-xl font-black text-emerald-600 mt-1">{statsCompleto.realizados}</span>
                                        </div>
                                    </div>

                                    {/* Grouped Data Preview */}
                                    <div className="space-y-6">
                                        {Object.keys(reportDataCompleto).length === 0 ? (
                                            <div className="text-center py-12 text-slate-400 font-bold">Nenhum registro encontrado.</div>
                                        ) : (
                                            Object.keys(reportDataCompleto).sort().map(type => (
                                                <div key={type} className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
                                                    {/* Procedure Type Header */}
                                                    <div className="px-5 py-3.5 bg-sky-50/60 border-b border-sky-100/50 flex justify-between items-center">
                                                        <h4 className="text-xs font-black text-sky-800 uppercase tracking-widest flex items-center gap-2">
                                                            <span className="w-2 h-2 rounded-full bg-sky-500"></span>
                                                            Procedimento: {type}
                                                        </h4>
                                                        <span className="px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 text-[10px] font-black">
                                                            {Object.values(reportDataCompleto[type]).reduce((acc, curr) => 
                                                                acc + Object.values(curr).reduce((sAcc, sCurr) => sAcc + sCurr.length, 0)
                                                            , 0)} reg.
                                                        </span>
                                                    </div>

                                                    {/* Priorities Level */}
                                                    <div className="p-4 space-y-5">
                                                        {Object.keys(reportDataCompleto[type]).map(priority => (
                                                            <div key={priority} className="space-y-3 pl-2 border-l-2 border-slate-200">
                                                                <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                                                    <span className={`w-1.5 h-1.5 rounded-full ${
                                                                        priority === 'Urgência' ? 'bg-rose-500 animate-pulse' : priority === 'Retorno' ? 'bg-teal-500' : 'bg-slate-400'
                                                                    }`}></span>
                                                                    Prioridade: {priority}
                                                                </h5>

                                                                {/* Status Level */}
                                                                <div className="space-y-3.5 pl-4">
                                                                    {Object.keys(reportDataCompleto[type][priority]).map(status => {
                                                                        const bookingsGroup = reportDataCompleto[type][priority][status];
                                                                        return (
                                                                            <div key={status} className="space-y-2">
                                                                                <div className="flex items-center gap-2">
                                                                                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Status:</span>
                                                                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border tracking-wider ${
                                                                                        status === 'Solicitado'
                                                                                        ? 'bg-sky-50 text-sky-700 border-sky-100'
                                                                                        : status === 'Agendado' 
                                                                                        ? 'bg-indigo-50 text-indigo-700 border-indigo-100' 
                                                                                        : status === 'Realizado' 
                                                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                                                                                        : status === 'Fila de espera'
                                                                                        ? 'bg-amber-50 text-amber-700 border-amber-100'
                                                                                        : 'bg-slate-100 text-slate-600 border-slate-200'
                                                                                    }`}>
                                                                                        {status}
                                                                                    </span>
                                                                                    <span className="text-[9px] font-bold text-slate-400">({bookingsGroup.length})</span>
                                                                                </div>

                                                                                {/* Bookings List Table */}
                                                                                <div className="border border-slate-100 rounded-xl overflow-hidden shadow-sm bg-white">
                                                                                    <table className="w-full text-left border-collapse">
                                                                                        <thead>
                                                                                            <tr className="bg-slate-50 border-b border-slate-100 text-[9px] font-extrabold uppercase text-slate-400 tracking-wider">
                                                                                                <th className="px-4 py-2 w-[45%]">Paciente / CPF</th>
                                                                                                <th className="px-4 py-2 w-[30%]">Procedimento/Exame</th>
                                                                                                <th className="px-4 py-2 text-center w-[25%]">Data</th>
                                                                                            </tr>
                                                                                        </thead>
                                                                                        <tbody className="divide-y divide-slate-100 text-[11px] font-semibold text-slate-600 uppercase">
                                                                                            {bookingsGroup.map(b => (
                                                                                                <tr key={b.id} className="hover:bg-slate-50/40">
                                                                                                    <td className="px-4 py-1.5 font-bold">
                                                                                                        <div className="font-extrabold text-slate-900">{b.paciente?.name}</div>
                                                                                                        <div className="text-[9px] text-slate-400 font-bold mt-0.5">
                                                                                                            CPF: {b.paciente?.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}
                                                                                                        </div>
                                                                                                    </td>
                                                                                                    <td className="px-4 py-1.5">{b.procedimento?.name}</td>
                                                                                                    <td className="px-4 py-1.5 text-center font-mono text-slate-500">
                                                                                                        {formatDateBr(b.appointment_date)}
                                                                                                    </td>
                                                                                                </tr>
                                                                                            ))}
                                                                                        </tbody>
                                                                                    </table>
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </>
                            ) : (
                                <>
                                    {/* Waitlist Stats */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-white border border-slate-200/60 p-5 rounded-2xl shadow-sm flex flex-col justify-between">
                                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total na Fila de Espera</span>
                                            <span className="text-2xl font-black text-amber-500 mt-1">{statsFila.total}</span>
                                        </div>
                                        <div className="bg-white border border-slate-200/60 p-5 rounded-2xl shadow-sm flex flex-col justify-between">
                                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Procedimentos com Fila</span>
                                            <span className="text-2xl font-black text-slate-800 mt-1">{statsFila.proceduresCount}</span>
                                        </div>
                                    </div>

                                    {/* Fila De Espera Groups */}
                                    <div className="space-y-6">
                                        {Object.keys(reportDataFila).length === 0 ? (
                                            <div className="text-center py-12 text-slate-400 font-bold bg-white rounded-3xl border border-slate-200">
                                                Nenhum paciente na fila de espera no momento.
                                            </div>
                                        ) : (
                                            Object.keys(reportDataFila).sort().map(procName => {
                                                const waitlistGroup = reportDataFila[procName];
                                                return (
                                                    <div key={procName} className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
                                                        <div className="px-5 py-3.5 bg-amber-50/40 border-b border-amber-100 flex justify-between items-center">
                                                            <h4 className="text-xs font-black text-amber-800 uppercase tracking-widest flex items-center gap-2">
                                                                <Clock className="w-4 h-4 text-amber-500" />
                                                                Fila: {procName}
                                                            </h4>
                                                            <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black">
                                                                {waitlistGroup.length} pacientes
                                                            </span>
                                                        </div>

                                                        <div className="p-4">
                                                            <div className="border border-slate-100 rounded-xl overflow-hidden bg-white shadow-sm">
                                                                <table className="w-full text-left border-collapse">
                                                                    <thead>
                                                                        <tr className="bg-slate-50 border-b border-slate-100 text-[9px] font-extrabold uppercase text-slate-400 tracking-wider">
                                                                            <th className="px-4 py-2.5 text-center w-[12%]">Posição</th>
                                                                            <th className="px-4 py-2.5 w-[50%]">Paciente / CPF</th>
                                                                            <th className="px-4 py-2.5 text-center w-[18%]">Prioridade</th>
                                                                            <th className="px-4 py-2.5 text-center w-[20%]">Registrado em</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="divide-y divide-slate-100 text-[11px] font-semibold text-slate-600 uppercase">
                                                                        {waitlistGroup.map(b => (
                                                                            <tr key={b.id} className="hover:bg-slate-50/40">
                                                                                <td className="px-4 py-2 text-center font-black text-amber-600">
                                                                                    {queuePositions[b.id]}º
                                                                                </td>
                                                                                <td className="px-4 py-2 font-bold">
                                                                                    <div className="font-extrabold text-slate-900">{b.paciente?.name}</div>
                                                                                    <div className="text-[9px] text-slate-400 font-bold mt-0.5">
                                                                                        CPF: {b.paciente?.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}
                                                                                    </div>
                                                                                </td>
                                                                                <td className="px-4 py-2 text-center">
                                                                                    <span className={`inline-flex px-2 py-0.5 rounded text-[8px] font-black uppercase text-white ${
                                                                                        b.priority === 'Urgência' ? 'bg-rose-500' : b.is_retorno ? 'bg-teal-500' : 'bg-slate-400'
                                                                                    }`}>
                                                                                        {b.priority === 'Urgência' ? 'Urgência' : b.is_retorno ? 'Retorno' : 'Normal'}
                                                                                    </span>
                                                                                </td>
                                                                                <td className="px-4 py-2 text-center font-mono text-slate-400">
                                                                                    {b.created_at ? new Date(b.created_at).toLocaleDateString('pt-BR') : '-'}
                                                                                </td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Footer Actions */}
                        <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 shrink-0">
                            <button
                                type="button"
                                onClick={() => setIsReportModalOpen(false)}
                                className="px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 font-extrabold rounded-xl text-xs uppercase tracking-wider active:scale-95 transition-all"
                            >
                                Fechar
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsPrintingReport(true)}
                                className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-extrabold rounded-xl text-xs uppercase tracking-wider active:scale-95 transition-all flex items-center gap-1.5 shadow-md"
                            >
                                <FileDown className="w-4 h-4" />
                                Exportar PDF
                            </button>
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
        </div>
    );
};
