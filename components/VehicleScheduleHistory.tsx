import React, { useState, useMemo } from 'react';
import { Search, History, Car, User, MapPin, Clock, Eye, Filter, Calendar, ArrowLeft, Building2, Target, FileText, Trash2, Edit3, ChevronDown, XCircle, Users } from 'lucide-react';
import { Vehicle, Person, VehicleSchedule, ScheduleStatus, Sector, AppState, CrewMember } from '../types';
import { checkAndAutoUpdateStatuses } from '../services/vehicleSchedulingService';
import { VehicleServiceOrderPreview } from './VehicleServiceOrderPreview';
import { VehicleCrewModal } from './VehicleCrewModal';

interface VehicleScheduleHistoryProps {
  schedules: VehicleSchedule[];
  vehicles: Vehicle[];
  persons: Person[];
  sectors: Sector[];
  state: AppState;
  onViewDetails: (s: VehicleSchedule) => void;
  onEdit: (s: VehicleSchedule) => void;
  onUpdateStatus: (id: string, status: ScheduleStatus, cancellationDetails?: { reason: string, cancelledBy: string }) => Promise<void>;
  onUpdateSchedule: (s: VehicleSchedule) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onBack?: () => void;
  currentUserId: string;
  userRole: string;
}

const CheckCircle2 = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" /><path d="m9 12 2 2 4-4" /></svg>
);

const X = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
);

const STATUS_MAP: Record<ScheduleStatus, { label: string, color: string, icon: any }> = {
  pendente: { label: 'Aguardando', color: 'amber', icon: Clock },
  confirmado: { label: 'Confirmado', color: 'emerald', icon: CheckCircle2 },
  em_curso: { label: 'Em Curso', color: 'blue', icon: MapPin },
  concluido: { label: 'Concluído', color: 'slate', icon: History },
  cancelado: { label: 'Rejeitado/Cancelado', color: 'rose', icon: X },
};

export const VehicleScheduleHistory: React.FC<VehicleScheduleHistoryProps> = ({
  schedules,
  vehicles,
  persons,
  sectors,
  state,
  onViewDetails,
  onEdit,
  onUpdateStatus,
  onUpdateSchedule,
  onDelete,
  onBack,
  currentUserId,
  userRole,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [viewingPurpose, setViewingPurpose] = useState<VehicleSchedule | null>(null);
  const [previewingOS, setPreviewingOS] = useState<VehicleSchedule | null>(null);
  const [statusMenuOpen, setStatusMenuOpen] = useState<string | null>(null);
  const [managingCrew, setManagingCrew] = useState<VehicleSchedule | null>(null);
  const [isSavingCrew, setIsSavingCrew] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | ScheduleStatus>('all');

  // Auto-Update Status Effect
  React.useEffect(() => {
    const checkStatus = () => {
      checkAndAutoUpdateStatuses(schedules);
    };

    // Check immediately on mount/data change
    checkStatus();

    // Check periodically
    const interval = setInterval(checkStatus, 60000); // 1 minute
    return () => clearInterval(interval);
  }, [schedules]);

  // States for Cancellation Modal
  const [cancelModalSchedule, setCancelModalSchedule] = useState<VehicleSchedule | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');

  const filtered = useMemo(() => {
    return schedules
      .filter(s => {
        const v = vehicles.find(veh => veh.id === s.vehicleId);
        const d = persons.find(p => p.id === s.driverId);
        const term = searchTerm.toLowerCase();
        const matchesTerm = (
          v?.model.toLowerCase().includes(term) ||
          v?.plate.toLowerCase().includes(term) ||
          d?.name.toLowerCase().includes(term) ||
          s.destination.toLowerCase().includes(term)
        );
        const matchesTab = activeTab === 'all' || s.status === activeTab;
        return matchesTerm && matchesTab;
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [schedules, vehicles, persons, searchTerm, activeTab]);

  const handleUpdateCrew = async (scheduleId: string, driverId: string, passengers: CrewMember[]) => {
    setIsSavingCrew(true);
    try {
      const schedule = schedules.find(s => s.id === scheduleId);
      if (!schedule) return;

      const updated: VehicleSchedule = {
        ...schedule,
        driverId,
        passengers
      };

      await onUpdateSchedule(updated);
      setManagingCrew(null);
    } catch (error) {
      console.error("Failed to update crew", error);
      alert("Erro ao atualizar tripulação.");
    } finally {
      setIsSavingCrew(false);
    }
  };

  const handleOpenCancelModal = (s: VehicleSchedule) => {
    setCancelModalSchedule(s);
    setCancellationReason('');
    setStatusMenuOpen(null);
  };

  const handleConfirmCancellation = async () => {
    if (!cancelModalSchedule) return;
    if (!cancellationReason.trim()) {
      alert('Por favor, informe uma justificativa para o cancelamento.');
      return;
    }

    try {
      // Find current user name
      const currentUser = persons.find(p => p.id === currentUserId)?.name || persons.find(p => p.name === currentUserId)?.name || 'Usuário Atual';

      await onUpdateStatus(cancelModalSchedule.id, 'cancelado', {
        reason: cancellationReason,
        cancelledBy: currentUser
      });
      setCancelModalSchedule(null);
    } catch (error) {
      console.error("Failed to cancel", error);
      alert("Erro ao cancelar agendamento.");
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden animate-fade-in bg-slate-50">
      {/* Header Compacto */}
      <div className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between gap-4 shrink-0 shadow-sm relative z-20">
        <div className="flex items-center gap-4 flex-1">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all group"
              title="Voltar ao Menu"
            >
              <ArrowLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
            </button>
          )}

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/20 shrink-0">
              <History className="w-5 h-5 text-white" />
            </div>
            <div className="hidden sm:block">
              <h2 className="text-lg font-bold text-slate-900 tracking-tight leading-none">
                /AgendamentoVeiculos/Historico
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100 uppercase tracking-widest">
                  {filtered.length} Registros
                </span>
              </div>
            </div>
          </div>

          <div className="relative max-w-xs w-full group ml-2">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar histórico..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all shadow-inner"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          </div>
        </div>
      </div>

      {/* Tabs Filter */}
      <div className="bg-white border-b border-slate-100 flex items-center gap-1 px-6 overflow-x-auto no-scrollbar shadow-sm relative z-10">
        {[
          { id: 'all', label: 'Todos' },
          { id: 'pendente', label: STATUS_MAP['pendente'].label },
          { id: 'confirmado', label: STATUS_MAP['confirmado'].label },
          { id: 'em_curso', label: STATUS_MAP['em_curso'].label },
          { id: 'concluido', label: STATUS_MAP['concluido'].label },
          { id: 'cancelado', label: STATUS_MAP['cancelado'].label },
        ].map((tab) => {
          const count = tab.id === 'all'
            ? schedules.length
            : schedules.filter(s => s.status === tab.id).length;

          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`relative px-6 py-4 text-xs font-black uppercase tracking-[0.15em] transition-all whitespace-nowrap flex items-center gap-2.5 border-b-2 ${isActive ? 'text-indigo-600 border-indigo-600 bg-indigo-50/50' : 'text-slate-400 border-transparent hover:text-slate-600 hover:bg-slate-50'}`}
            >
              {tab.label}
              <span className={`px-1.5 py-0.5 rounded-md text-[8px] font-bold ${isActive ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Lista de Cards */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8">
        <div className="max-w-6xl mx-auto w-full space-y-4 pb-8">
          {filtered.length > 0 ? (
            filtered.map(s => {
              const v = vehicles.find(veh => veh.id === s.vehicleId);
              const d = persons.find(p => p.id === s.driverId);
              const requesterPerson = persons.find(p => p.id === s.requesterPersonId);
              const sector = sectors.find(sec => sec.id === s.serviceSectorId);
              const cfg = STATUS_MAP[s.status];

              return (
                <div key={s.id} className="bg-white p-4 rounded-[2rem] border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(99,102,241,0.15)] transition-all duration-300 hover:-translate-y-1 flex flex-col gap-3 group relative">

                  {/* Decorative Elements */}
                  <div className="absolute inset-0 rounded-[2rem] overflow-hidden pointer-events-none">
                    <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-10 transition-opacity duration-500">
                      <Car className="w-24 h-24 text-indigo-900 transform rotate-12 translate-x-8 -translate-y-8" />
                    </div>
                  </div>

                  {/* Card Content Row 1 */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
                    <div className="flex flex-col lg:flex-row gap-4 lg:items-center flex-1">
                      <div className="flex items-center gap-4 shrink-0">
                        <div className="w-12 h-12 bg-gradient-to-br from-indigo-50 to-slate-50 rounded-2xl flex items-center justify-center text-indigo-400 group-hover:text-indigo-600 group-hover:scale-110 transition-all duration-300 shadow-inner border border-white">
                          <Car className="w-5 h-5" />
                        </div>
                        <div className="flex flex-col gap-1 items-start">
                          <div className="flex items-center gap-2">
                            <h4 className="text-lg font-black text-slate-800 uppercase tracking-tight group-hover:text-indigo-700 transition-colors">{v?.model || 'Desconhecido'}</h4>
                            <div className="px-2 py-0.5 rounded-lg bg-indigo-600 text-white text-[9px] font-black uppercase tracking-wider shadow-sm">
                              ID: {s.protocol}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="inline-block font-mono text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200 uppercase tracking-wider">{v?.plate || '---'}</span>
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5" /> {new Date(s.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="hidden lg:block w-px h-10 bg-slate-100 mx-1"></div>

                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 flex-1">
                        <div className="flex flex-col gap-1">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Calendar className="w-3 h-3" /> Saída</p>
                          <span className="text-xs font-bold text-slate-700">{new Date(s.departureDateTime).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Calendar className="w-3 h-3" /> Retorno</p>
                          <span className="text-xs font-bold text-slate-700">{s.returnDateTime ? new Date(s.returnDateTime).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '---'}</span>
                        </div>
                        <div className="flex items-center justify-center">
                          <button
                            onClick={() => setManagingCrew(s)}
                            disabled={['cancelado', 'em_curso', 'concluido'].includes(s.status) || (s.requesterId !== currentUserId && userRole !== 'admin')}
                            className={`w-full px-3 py-2 border text-[9px] font-bold uppercase tracking-wide rounded-xl transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2 ${(['cancelado', 'em_curso', 'concluido'].includes(s.status) || (s.requesterId !== currentUserId && userRole !== 'admin')) ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed opacity-60' : 'bg-indigo-50 border-indigo-100 text-indigo-600 hover:bg-indigo-600 hover:text-white hover:border-indigo-600'}`}
                          >
                            <Users className="w-3.5 h-3.5" /> {(s.passengers?.length || 0) + 1} Ocup.
                          </button>
                        </div>
                        <div className="flex items-center justify-center">
                          <button
                            onClick={() => setViewingPurpose(s)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-slate-500 text-[9px] font-bold uppercase tracking-wide rounded-xl hover:bg-slate-200 hover:text-slate-800 hover:border-slate-300 transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2"
                          >
                            <Target className="w-3.5 h-3.5" /> Motivo
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="relative">
                        <button
                          onClick={() => setStatusMenuOpen(statusMenuOpen === s.id ? null : s.id)}
                          className={`px-3 py-1.5 rounded-full border text-[9px] font-black uppercase tracking-widest shadow-sm bg-${cfg.color}-50 text-${cfg.color}-700 border-${cfg.color}-200 flex items-center gap-1.5 hover:shadow-md transition-all`}
                        >
                          <cfg.icon className="w-3 h-3" /> {cfg.label}
                          {!['cancelado', 'concluido'].includes(s.status) && <ChevronDown className="w-2.5 h-2.5 opacity-50" />}
                        </button>

                        {statusMenuOpen === s.id && !['cancelado', 'concluido'].includes(s.status) && (s.requesterId === currentUserId || userRole === 'admin') && (
                          <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-2xl shadow-2xl border border-slate-100 p-2 z-[100] animate-slide-up">
                            {s.status === 'em_curso' && (
                              <button
                                onClick={() => {
                                  onUpdateStatus(s.id, 'concluido');
                                  setStatusMenuOpen(null);
                                }}
                                className="w-full flex items-center gap-3 px-4 py-3 text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all text-left mb-1"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                                <div className="flex flex-col">
                                  <span className="text-[10px] font-black uppercase tracking-tight">Concluir</span>
                                  <span className="text-[8px] font-bold text-emerald-400 uppercase tracking-widest leading-none">Finalizar Serviço</span>
                                </div>
                              </button>
                            )}
                            <button
                              onClick={() => handleOpenCancelModal(s)}
                              className="w-full flex items-center gap-3 px-4 py-3 text-rose-600 hover:bg-rose-50 rounded-xl transition-all text-left"
                            >
                              <XCircle className="w-4 h-4" />
                              <div className="flex flex-col">
                                <span className="text-[10px] font-black uppercase tracking-tight">Cancelar</span>
                                <span className="text-[8px] font-bold text-rose-400 uppercase tracking-widest leading-none">Irreversível</span>
                              </div>
                            </button>
                          </div>
                        )}
                        {statusMenuOpen === s.id && <div className="fixed inset-0 z-[90]" onClick={() => setStatusMenuOpen(null)} />}
                      </div>

                      <button onClick={() => setPreviewingOS(s)} className="px-3 py-2 bg-white border border-slate-200 text-slate-500 hover:bg-slate-900 hover:text-white rounded-xl transition-all text-[10px] font-black uppercase tracking-widest">
                        OS
                      </button>

                      {(s.requesterId === currentUserId || userRole === 'admin') && (
                        <>
                          <button
                            onClick={() => onEdit(s)}
                            disabled={['cancelado', 'em_curso', 'concluido'].includes(s.status)}
                            className={`p-2 border rounded-lg transition-all ${['cancelado', 'em_curso', 'concluido'].includes(s.status) ? 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed' : 'bg-white border-slate-100 text-slate-400 hover:bg-slate-900 hover:text-white'}`}
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => { if (window.confirm('Excluir agendamento?')) onDelete(s.id); }}
                            className="p-2 bg-white border border-slate-100 text-rose-400 hover:bg-rose-600 hover:text-white rounded-lg transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Card Content Row 2 */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-3 bg-slate-50/80 rounded-2xl border border-slate-100 relative z-0 transition-colors group-hover:bg-indigo-50/30">
                    <div className="space-y-0.5">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><User className="w-3 h-3" /> Solicitante</p>
                      <p className="text-[10px] font-bold text-slate-600 truncate">{requesterPerson?.name || '---'}</p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><User className="w-3 h-3" /> Motorista</p>
                      <p className="text-[10px] font-bold text-slate-600 truncate">{d?.name || '---'}</p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><Building2 className="w-3 h-3" /> Setor</p>
                      <p className="text-[10px] font-bold text-slate-600 truncate">{sector?.name || '---'}</p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><MapPin className="w-3 h-3 text-indigo-500" /> Destino</p>
                      <p className="text-[10px] font-black text-indigo-600 uppercase truncate">{s.destination}</p>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-20 text-center bg-white rounded-[3rem] border border-dashed border-slate-200 flex flex-col items-center">
              <History className="w-16 h-16 text-slate-200 mb-4" />
              <p className="text-xl font-black text-slate-400 uppercase tracking-widest">Nenhum registro</p>
            </div>
          )}
        </div>
      </div>

      {/* Footer Info */}
      <div className="shrink-0 flex justify-between items-center px-8 py-4 bg-white border-t border-slate-100 shadow-sm">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Total de {filtered.length} agendamentos</span>
        <div className="flex items-center gap-2">
          <Filter className="w-3 h-3 text-indigo-500" />
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Histórico Geral</span>
        </div>
      </div>

      {/* Modals */}
      {viewingPurpose && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white sm:rounded-[2.5rem] rounded-t-[2.5rem] shadow-2xl border border-white/20 overflow-hidden flex flex-col animate-slide-up max-h-[90vh]">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <Target className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase">Objetivo</h3>
                </div>
              </div>
              <button onClick={() => setViewingPurpose(null)} className="p-3 hover:bg-white rounded-2xl text-slate-400"><X className="w-6 h-6" /></button>
            </div>
            <div className="p-8 flex-1 overflow-y-auto custom-scrollbar">
              <div className="bg-slate-50 border border-slate-200 rounded-[2rem] p-6">
                <p className="text-base text-slate-700 font-medium">"{viewingPurpose.purpose}"</p>
              </div>
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100">
              <button onClick={() => setViewingPurpose(null)} className="w-full py-4 bg-slate-900 text-white font-black text-xs uppercase tracking-widest rounded-2xl">Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* Cancellation Modal */}
      {cancelModalSchedule && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-white sm:rounded-[2.5rem] rounded-t-[2.5rem] shadow-2xl border border-white/20 overflow-hidden flex flex-col animate-slide-up max-h-[90vh]">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-rose-50/50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-rose-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <XCircle className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase">Cancelar Agendamento</h3>
                  <p className="text-xs font-bold text-rose-500 uppercase tracking-widest">Ação Irreversível</p>
                </div>
              </div>
              <button onClick={() => setCancelModalSchedule(null)} className="p-3 hover:bg-white rounded-2xl text-slate-400 transition-colors"><X className="w-6 h-6" /></button>
            </div>

            <div className="p-8 flex-1 overflow-y-auto custom-scrollbar">
              <div className="mb-4">
                <p className="text-sm text-slate-600 mb-4 font-medium">Você está prestes a cancelar o agendamento <strong>{cancelModalSchedule.protocol}</strong>. Esta ação não poderá ser desfeita e o veículo será liberado para outros agendamentos.</p>

                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Justificativa do Cancelamento (Obrigatório)</label>
                <textarea
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                  placeholder="Descreva o motivo do cancelamento..."
                  className="w-full h-32 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 transition-all resize-none"
                />
              </div>
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button
                onClick={() => setCancelModalSchedule(null)}
                className="px-6 py-3 rounded-xl border border-slate-200 text-slate-500 font-black uppercase tracking-widest text-xs hover:bg-white transition-colors"
              >
                Voltar
              </button>
              <button
                onClick={handleConfirmCancellation}
                className="px-6 py-3 rounded-xl bg-rose-600 text-white font-black uppercase tracking-widest text-xs hover:bg-rose-700 transition-colors shadow-lg shadow-rose-600/20"
              >
                Confirmar Cancelamento
              </button>
            </div>
          </div>
        </div>
      )}

      {previewingOS && (
        <VehicleServiceOrderPreview
          schedule={previewingOS}
          vehicle={vehicles.find(v => v.id === previewingOS.vehicleId)!}
          driver={persons.find(p => p.id === previewingOS.driverId)!}
          requester={persons.find(p => p.id === previewingOS.requesterPersonId)}
          sector={sectors.find(s => s.id === previewingOS.serviceSectorId)}
          state={state}
          onClose={() => setPreviewingOS(null)}
        />
      )}

      {managingCrew && (
        <VehicleCrewModal
          schedule={managingCrew}
          persons={persons}
          onClose={() => setManagingCrew(null)}
          onSave={handleUpdateCrew}
          isSaving={isSavingCrew}
        />
      )}
    </div>
  );
};