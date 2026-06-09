import React, { useState, useEffect } from 'react';
import { User, ConsultaAgendamento, ConsultaProcedimento, AppState } from '../../types';
import { ArrowLeft, Search, Filter, Calendar, CheckCircle2, XCircle, Trash2, Loader2, Sparkles, Clock, FileDown } from 'lucide-react';
import * as db from '../../services/consultasService';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { ConsultaPdfGenerator } from './ConsultaPdfGenerator';

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

    // Permissions check
    const isAdmin = currentUser.role === 'admin';
    const canCancel = currentUser.permissions?.includes('parent_consultas_novo_agendamento') || isAdmin;
    const canComplete = currentUser.permissions?.includes('parent_consultas_novo_agendamento') || isAdmin;
    const canDelete = isAdmin; // Delete strictly admin

    // Load data
    const loadData = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const [bookingData, procData] = await Promise.all([
                db.getAgendamentos({
                    patientName: filterName,
                    patientCpf: filterCpf,
                    procedimentoId: filterProcId,
                    date: filterDate,
                    status: filterStatus
                }),
                db.getProcedimentos()
            ]);
            setBookings(bookingData);
            setProcedures(procData);
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

    // Handle Status Change (Cancelar / Concluir)
    const handleStatusUpdate = async (id: string, newStatus: ConsultaAgendamento['status']) => {
        setOperatingId(id);
        try {
            await db.updateAgendamentoStatus(id, newStatus);
            // Optimistic update of local list
            setBookings(prev => prev.map(b => b.id === id ? { ...b, status: newStatus } : b));
        } catch (error: any) {
            alert(error.message || 'Erro ao alterar o status do agendamento.');
        } finally {
            setOperatingId(null);
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
        } finally {
            setOperatingId(null);
            loadData(true);
        }
    };

    const sortedBookings = [...bookings].sort((a, b) => {
        if (filterStatus === 'Fila de Espera') {
            if (a.priority === 'Urgência' && b.priority !== 'Urgência') return -1;
            if (a.priority !== 'Urgência' && b.priority === 'Urgência') return 1;
            const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
            const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
            return dateA - dateB;
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
                        onClick={() => setFilterStatus(prev => prev === 'Fila de Espera' ? '' : 'Fila de Espera')}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all shadow-sm border ${
                            filterStatus === 'Fila de Espera'
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
                            <option key={p.id} value={p.id}>{p.name} ({p.type})</option>
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
                        <option value="Agendado">Agendado</option>
                        <option value="Aguardando Data">Aguardando Data</option>
                        <option value="Fila de Espera">Fila de Espera</option>
                        <option value="Realizado">Realizado</option>
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
                                                <td className="p-4">
                                                    <div className="font-extrabold text-slate-900">{booking.paciente?.name || 'Carregando...'}</div>
                                                    <div className="text-[10px] text-slate-400 mt-0.5 font-bold">
                                                        CPF: {booking.paciente?.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}
                                                    </div>
                                                </td>
                                                <td className="p-4">
                                                    <div className="font-bold text-slate-800">{booking.procedimento?.name || 'Carregando...'}</div>
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
                                                        : 'bg-slate-100 text-slate-600'
                                                    }`}>
                                                        {booking.priority || 'Normal'}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-center">
                                                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                                                        booking.status === 'Agendado' 
                                                        ? 'bg-sky-50 text-sky-700 border-sky-100' 
                                                        : booking.status === 'Realizado' 
                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                                                        : booking.status === 'Fila de Espera'
                                                        ? 'bg-amber-50 text-amber-700 border-amber-100'
                                                        : booking.status === 'Aguardando Data'
                                                        ? 'bg-violet-50 text-violet-700 border-violet-100'
                                                        : 'bg-rose-50 text-rose-700 border-rose-100'
                                                    }`}>
                                                        {booking.status}
                                                    </span>
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
                                                                {(booking.status === 'Agendado' || booking.status === 'Fila de Espera' || booking.status === 'Aguardando Data') && (
                                                                    <>
                                                                        {booking.status === 'Agendado' && canComplete && (
                                                                            <button
                                                                                onClick={() => handleStatusUpdate(booking.id, 'Realizado')}
                                                                                className="p-1.5 text-emerald-500 hover:text-white hover:bg-emerald-500 rounded-lg border border-emerald-100 hover:border-emerald-500 transition-all"
                                                                                title="Confirmar Realização"
                                                                            >
                                                                                <CheckCircle2 className="w-4 h-4" />
                                                                            </button>
                                                                        )}
                                                                        {canCancel && (
                                                                            <button
                                                                                onClick={() => handleStatusUpdate(booking.id, 'Cancelado')}
                                                                                className="p-1.5 text-rose-400 hover:text-white hover:bg-rose-500 rounded-lg border border-rose-100 hover:border-rose-500 transition-all"
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
                    currentUser={currentUser}
                    state={appState}
                />
            )}
        </div>
    );
};
