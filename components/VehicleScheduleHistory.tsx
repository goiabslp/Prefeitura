import React, { useState, useMemo } from 'react';
import { Search, History, Car, User, MapPin, Clock, Eye, Filter, Calendar, ArrowLeft, Building2, Target, FileText, Trash2, Edit3, ChevronDown, ChevronRight, ChevronLeft, RotateCcw, XCircle, Users, LayoutList, LayoutGrid } from 'lucide-react';
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
  currentUserSector?: string;
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
  currentUserSector,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [viewingPurpose, setViewingPurpose] = useState<VehicleSchedule | null>(null);
  const [previewingOS, setPreviewingOS] = useState<VehicleSchedule | null>(null);
  const [changeStatusModalSchedule, setChangeStatusModalSchedule] = useState<VehicleSchedule | null>(null);
  const [managingCrew, setManagingCrew] = useState<VehicleSchedule | null>(null);
  const [isSavingCrew, setIsSavingCrew] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | ScheduleStatus>('all');
  const [selectedSectorId, setSelectedSectorId] = useState<string>('all');
  const [isFilterPopoverOpen, setIsFilterPopoverOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'cards'>('list');
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Pessoa e setor do usuario atual
  const currentUserPerson = useMemo(() => {
    const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    return persons.find(p => p.id === currentUserId || norm(p.name) === norm(currentUserId || ''));
  }, [persons, currentUserId]);

  const userSectorId = useMemo(() => {
    if (currentUserPerson?.sectorId) {
      return currentUserPerson.sectorId;
    }
    if (currentUserSector) {
      const sec = sectors.find(s => s.id === currentUserSector || s.name.toLowerCase() === currentUserSector.toLowerCase());
      if (sec) return sec.id;
    }
    return null;
  }, [currentUserPerson, currentUserSector, sectors]);

  const baseSchedules = useMemo(() => {
    if (userRole === 'admin') return schedules;
    if (!userSectorId) return schedules;
    return schedules.filter(s => s.serviceSectorId === userSectorId || s.requesterId === currentUserId || (currentUserPerson && s.requesterPersonId === currentUserPerson.id));
  }, [schedules, userRole, userSectorId, currentUserId, currentUserPerson]);

  const schedulesRef = React.useRef(schedules);
  schedulesRef.current = schedules;
  const isCheckingRef = React.useRef(false);

  // Auto-Update Status Effect (executado de forma segura sem loop infinito)
  React.useEffect(() => {
    const checkStatus = async () => {
      if (isCheckingRef.current) return;
      isCheckingRef.current = true;
      try {
        if (schedulesRef.current && schedulesRef.current.length > 0) {
          await checkAndAutoUpdateStatuses(schedulesRef.current);
        }
      } catch (err) {
        console.warn('Erro ao atualizar status automáticos:', err);
      } finally {
        isCheckingRef.current = false;
      }
    };

    // Checagem inicial
    checkStatus();

    // Checagem periódica a cada 30 segundos
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  // States for Cancellation Modal
  const [cancelModalSchedule, setCancelModalSchedule] = useState<VehicleSchedule | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');

  const filtered = useMemo(() => {
    return baseSchedules
      .filter(s => {
        const v = vehicles.find(veh => veh.id === s.vehicleId);
        const d = persons.find(p => p.id === s.driverId);
        const sec = sectors.find(sec => sec.id === s.serviceSectorId)
          || (persons.find(p => p.id === s.requesterPersonId)?.sectorId
              ? sectors.find(sec => sec.id === persons.find(p => p.id === s.requesterPersonId)?.sectorId)
              : undefined)
          || (vehicles.find(veh => veh.id === s.vehicleId)?.sectorId
              ? sectors.find(sec => sec.id === vehicles.find(veh => veh.id === s.vehicleId)?.sectorId)
              : undefined);
        const term = searchTerm.toLowerCase();
        const matchesTerm = (
          v?.model.toLowerCase().includes(term) ||
          v?.plate.toLowerCase().includes(term) ||
          d?.name.toLowerCase().includes(term) ||
          s.destination.toLowerCase().includes(term) ||
          sec?.name.toLowerCase().includes(term)
        );
        const matchesTab = activeTab === 'all' || s.status === activeTab;
        const matchesSector = selectedSectorId === 'all' || s.serviceSectorId === selectedSectorId || sec?.id === selectedSectorId;

        return matchesTerm && matchesTab && matchesSector;
      })
      .sort((a, b) => (b.departureDateTime || b.createdAt || '').localeCompare(a.departureDateTime || a.createdAt || ''));
  }, [baseSchedules, vehicles, persons, sectors, searchTerm, activeTab, selectedSectorId]);

  // Reseta a página para 1 quando alterar termo de busca, tab ativas ou setor
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, activeTab, selectedSectorId]);

  const ITEMS_PER_PAGE = 30;
  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);

  const paginatedSchedules = useMemo(() => {
    const start = (safePage - 1) * ITEMS_PER_PAGE;
    return filtered.slice(start, start + ITEMS_PER_PAGE);
  }, [filtered, safePage]);

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (safePage > 3) pages.push('...');

      const start = Math.max(2, safePage - 1);
      const end = Math.min(totalPages - 1, safePage + 1);
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (safePage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

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

  const canChangeStatus = (s: VehicleSchedule) => {
    if (s.status === 'concluido') return false;
    if (s.status === 'cancelado') return userRole === 'admin';
    return s.requesterId === currentUserId || userRole === 'admin';
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden animate-fade-in bg-slate-50">
      {/* Header Desktop (Web) */}
      <div className="hidden md:flex bg-white border-b border-slate-100 px-6 py-4 items-center justify-between gap-4 shrink-0 shadow-sm relative z-20">
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
            <div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight leading-none">
                Agendamentos
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100 uppercase tracking-widest">
                  {filtered.length} Registros
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Botão de Filtro de Status com Popover */}
            <div className="relative shrink-0">
              <button
                onClick={() => setIsFilterPopoverOpen(!isFilterPopoverOpen)}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border shadow-xs ${
                  activeTab !== 'all'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-indigo-600/20'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
                title="Filtrar por Status"
              >
                <Filter className="w-4 h-4 text-indigo-500" />
                <span>
                  {activeTab === 'all' ? 'Status: Todos' : STATUS_MAP[activeTab]?.label}
                </span>
                <ChevronDown className="w-3.5 h-3.5 opacity-60" />
              </button>

              {isFilterPopoverOpen && (
                <div className="absolute right-0 sm:left-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-slate-100 p-2 z-[100] animate-slide-up">
                  <div className="px-3 py-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 mb-1">
                    Filtrar Status
                  </div>
                  {[
                    { id: 'all', label: 'Todos os Status' },
                    { id: 'pendente', label: STATUS_MAP['pendente'].label },
                    { id: 'confirmado', label: STATUS_MAP['confirmado'].label },
                    { id: 'em_curso', label: STATUS_MAP['em_curso'].label },
                    { id: 'concluido', label: STATUS_MAP['concluido'].label },
                    { id: 'cancelado', label: STATUS_MAP['cancelado'].label },
                  ].map((tab) => {
                    const count = tab.id === 'all'
                      ? baseSchedules.filter(s => selectedSectorId === 'all' || s.serviceSectorId === selectedSectorId).length
                      : baseSchedules.filter(s => (selectedSectorId === 'all' || s.serviceSectorId === selectedSectorId) && s.status === tab.id).length;

                    const isActive = activeTab === tab.id;

                    return (
                      <button
                        key={tab.id}
                        onClick={() => {
                          setActiveTab(tab.id as any);
                          setIsFilterPopoverOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 text-xs font-extrabold rounded-xl transition-all ${
                          isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <span>{tab.label}</span>
                        <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-black ${
                          isActive ? 'bg-indigo-200/80 text-indigo-900' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
              {isFilterPopoverOpen && <div className="fixed inset-0 z-[90]" onClick={() => setIsFilterPopoverOpen(false)} />}
            </div>

            {/* Filtro por Setor (Admin: Select | Usuário comum: Badge fixo do Setor) */}
            {userRole === 'admin' ? (
              <div className="relative shrink-0">
                <select
                  value={selectedSectorId}
                  onChange={(e) => setSelectedSectorId(e.target.value)}
                  className="pl-8 pr-7 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 appearance-none focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all shadow-inner cursor-pointer max-w-[190px] truncate"
                  title="Filtrar por Setor (Admin)"
                >
                  <option value="all">Todos os Setores</option>
                  {sectors.map(sec => (
                    <option key={sec.id} value={sec.id}>{sec.name}</option>
                  ))}
                </select>
                <Building2 className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 border border-indigo-100/80 rounded-xl text-xs font-bold text-indigo-700 shrink-0 shadow-xs" title="Seu Setor">
                <Building2 className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                <span className="max-w-[160px] truncate">
                  {sectors.find(s => s.id === userSectorId)?.name || currentUserSector || 'Meu Setor'}
                </span>
              </div>
            )}

            {/* Campo de Busca */}
            <div className="relative max-w-xs w-full group">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar histórico..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all shadow-inner"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            </div>

            {/* Alternador de Visualização */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/60 shrink-0">
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${viewMode === 'list' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                title="Visualização Compacta em Lista"
              >
                <LayoutList className="w-4 h-4" />
                <span className="hidden md:inline text-[11px] font-extrabold uppercase">Lista</span>
              </button>
              <button
                onClick={() => setViewMode('cards')}
                className={`p-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${viewMode === 'cards' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                title="Visualização em Cards"
              >
                <LayoutGrid className="w-4 h-4" />
                <span className="hidden md:inline text-[11px] font-extrabold uppercase">Cards</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Header Mobile Otimizado */}
      <div className="md:hidden bg-white border-b border-slate-100 px-3.5 py-3 shrink-0 shadow-xs relative z-20 space-y-2.5">
        {/* Linha 1: Voltar + Título + Contador + Alternador Lista/Cards */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {onBack && (
              <button
                onClick={onBack}
                className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                title="Voltar ao Menu"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-indigo-600/20 shrink-0 text-white">
              <History className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-black text-slate-900 tracking-tight leading-none truncate">
                Histórico
              </h2>
              <span className="text-[9px] font-black text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-md border border-indigo-100 uppercase tracking-wider inline-block mt-0.5">
                {filtered.length} agendamentos
              </span>
            </div>
          </div>

          {/* Alternador Lista / Cards Mobile */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200/60 shrink-0">
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'list' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500'}`}
              title="Lista"
            >
              <LayoutList className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'cards' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500'}`}
              title="Cards"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Linha 2: Barra de Busca Mobile */}
        <div className="relative w-full">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar veículo, motorista, destino..."
            className="w-full pl-8 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-inner"
          />
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Linha 3: Filtros de Status e Setor Mobile */}
        <div className="grid grid-cols-2 gap-2 pt-0.5">
          {/* Botão de Filtro de Status Mobile */}
          <div className="relative">
            <button
              onClick={() => setIsFilterPopoverOpen(!isFilterPopoverOpen)}
              className={`w-full px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between border shadow-xs ${
                activeTab !== 'all'
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <Filter className={`w-3.5 h-3.5 shrink-0 ${activeTab !== 'all' ? 'text-white' : 'text-indigo-500'}`} />
                <span className="truncate text-[11px]">
                  {activeTab === 'all' ? 'Status: Todos' : STATUS_MAP[activeTab]?.label}
                </span>
              </div>
              <ChevronDown className="w-3 h-3 opacity-60 shrink-0" />
            </button>

            {isFilterPopoverOpen && (
              <div className="absolute left-0 top-full mt-1.5 w-60 bg-white rounded-2xl shadow-2xl border border-slate-100 p-2 z-[100] animate-slide-up">
                <div className="px-3 py-1 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 mb-1">
                  Filtrar Status
                </div>
                {[
                  { id: 'all', label: 'Todos os Status' },
                  { id: 'pendente', label: STATUS_MAP['pendente'].label },
                  { id: 'confirmado', label: STATUS_MAP['confirmado'].label },
                  { id: 'em_curso', label: STATUS_MAP['em_curso'].label },
                  { id: 'concluido', label: STATUS_MAP['concluido'].label },
                  { id: 'cancelado', label: STATUS_MAP['cancelado'].label },
                ].map((tab) => {
                  const count = tab.id === 'all'
                    ? baseSchedules.filter(s => selectedSectorId === 'all' || s.serviceSectorId === selectedSectorId).length
                    : baseSchedules.filter(s => (selectedSectorId === 'all' || s.serviceSectorId === selectedSectorId) && s.status === tab.id).length;
                  const isActive = activeTab === tab.id;

                  return (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setActiveTab(tab.id as any);
                        setIsFilterPopoverOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs font-bold rounded-xl transition-all ${
                        isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <span className="truncate">{tab.label}</span>
                      <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-black ${
                        isActive ? 'bg-indigo-200/80 text-indigo-900' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            {isFilterPopoverOpen && <div className="fixed inset-0 z-[90]" onClick={() => setIsFilterPopoverOpen(false)} />}
          </div>

          {/* Filtro por Setor Mobile */}
          {userRole === 'admin' ? (
            <div className="relative">
              <select
                value={selectedSectorId}
                onChange={(e) => setSelectedSectorId(e.target.value)}
                className="w-full pl-7 pr-6 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-bold text-slate-700 appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-inner truncate cursor-pointer"
                title="Filtrar por Setor"
              >
                <option value="all">Todos os Setores</option>
                {sectors.map(sec => (
                  <option key={sec.id} value={sec.id}>{sec.name}</option>
                ))}
              </select>
              <Building2 className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
            </div>
          ) : (
            <div className="flex items-center gap-1 px-2 py-1.5 bg-indigo-50 border border-indigo-100/80 rounded-xl text-[11px] font-bold text-indigo-700 truncate shadow-xs">
              <Building2 className="w-3 h-3 text-indigo-500 shrink-0" />
              <span className="truncate">
                {sectors.find(s => s.id === userSectorId)?.name || currentUserSector || 'Meu Setor'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Lista de Registros */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 md:p-5 w-full">
        <div className="w-full space-y-4 pb-8">
          {filtered.length > 0 ? (
            viewMode === 'list' ? (
              <>
                {/* Visualização Desktop (Tabela Completa Mantida) */}
                <div className="hidden md:block bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden w-full">
                  <div className="w-full overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse table-fixed">
                      <thead>
                        <tr className="bg-slate-50/90 border-b border-slate-200/80 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                          <th className="py-3 px-3 w-[18%]">Veículo / OS</th>
                          <th className="py-3 px-3 w-[14%]">Saída / Retorno</th>
                          <th className="py-3 px-3 w-[16%]">Solicitante & Setor</th>
                          <th className="py-3 px-3 w-[14%]">Motorista</th>
                          <th className="py-3 px-3 w-[12%]">Destino</th>
                          <th className="py-3 px-3 w-[6%] text-center">Ocup.</th>
                          <th className="py-3 px-3 w-[12%] text-center">Status</th>
                          <th className="py-3 px-3 w-[8%] text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs font-medium">
                        {paginatedSchedules.map(s => {
                          const v = vehicles.find(veh => veh.id === s.vehicleId);
                          const d = persons.find(p => p.id === s.driverId);
                          const requesterPerson = persons.find(p => p.id === s.requesterPersonId);
                          const sector = sectors.find(sec => sec.id === s.serviceSectorId)
                            || (requesterPerson?.sectorId ? sectors.find(sec => sec.id === requesterPerson.sectorId) : undefined)
                            || (v?.sectorId ? sectors.find(sec => sec.id === v.sectorId) : undefined);
                          const cfg = STATUS_MAP[s.status];

                          return (
                            <tr key={s.id} className="hover:bg-indigo-50/40 transition-colors group">
                              {/* Veículo / OS */}
                              <td className="py-3 px-3 overflow-hidden">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="w-8 h-8 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 shrink-0 font-bold border border-indigo-100">
                                    <Car className="w-4 h-4" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5 flex-wrap leading-tight">
                                      <span className="font-black text-slate-800 uppercase tracking-tight text-xs truncate">{v?.model || '---'}</span>
                                      <span className="px-1.5 py-0.5 bg-indigo-600 text-white text-[9px] font-black rounded-md uppercase tracking-wider shrink-0">
                                        {s.protocol}
                                      </span>
                                    </div>
                                    <div className="text-[10px] text-slate-400 font-mono font-bold truncate mt-0.5">
                                      {v?.plate || '---'}
                                    </div>
                                  </div>
                                </div>
                              </td>

                              {/* Saída / Retorno */}
                              <td className="py-3 px-3 whitespace-nowrap overflow-hidden">
                                <div className="flex flex-col gap-0.5 leading-tight">
                                  <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                                    {new Date(s.departureDateTime).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                  <span className="font-medium text-slate-400 text-[10px] flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0"></span>
                                    {s.returnDateTime ? new Date(s.returnDateTime).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '---'}
                                  </span>
                                </div>
                              </td>

                              {/* Solicitante & Setor */}
                              <td className="py-3 px-3 overflow-hidden">
                                <div className="flex flex-col min-w-0 leading-tight">
                                  <span className="font-bold text-slate-800 truncate text-xs" title={requesterPerson?.name}>{requesterPerson?.name || '---'}</span>
                                  <span className="text-[10px] text-slate-400 font-semibold truncate mt-0.5" title={sector?.name}>
                                    {sector?.name || '---'}
                                  </span>
                                </div>
                              </td>

                              {/* Motorista */}
                              <td className="py-3 px-3 overflow-hidden">
                                <span className="font-bold text-slate-700 truncate block text-xs" title={d?.name}>{d?.name || '---'}</span>
                              </td>

                              {/* Destino */}
                              <td className="py-3 px-3 overflow-hidden">
                                <span className="font-black text-indigo-600 uppercase text-[11px] truncate block" title={s.destination}>
                                  {s.destination}
                                </span>
                              </td>

                              {/* Ocupantes */}
                              <td className="py-3 px-3 text-center whitespace-nowrap overflow-hidden">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    onClick={() => setManagingCrew(s)}
                                    disabled={['cancelado', 'em_curso', 'concluido'].includes(s.status) || (s.requesterId !== currentUserId && userRole !== 'admin')}
                                    className={`px-2 py-1 border text-[10px] font-extrabold uppercase rounded-lg transition-all flex items-center gap-1 ${(['cancelado', 'em_curso', 'concluido'].includes(s.status) || (s.requesterId !== currentUserId && userRole !== 'admin')) ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed' : 'bg-indigo-50 border-indigo-100 text-indigo-600 hover:bg-indigo-600 hover:text-white'}`}
                                    title="Ocupantes"
                                  >
                                    <Users className="w-3 h-3" />
                                    <span>{(s.passengers?.length || 0) + 1}</span>
                                  </button>
                                  <button
                                    onClick={() => setViewingPurpose(s)}
                                    className="p-1 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-lg border border-slate-200/60"
                                    title="Motivo"
                                  >
                                    <Target className="w-3 h-3" />
                                  </button>
                                </div>
                              </td>

                              {/* Status */}
                              <td className="py-3 px-3 text-center whitespace-nowrap overflow-hidden">
                                <button
                                  onClick={() => canChangeStatus(s) && setChangeStatusModalSchedule(s)}
                                  disabled={!canChangeStatus(s)}
                                  className={`px-2.5 py-1 rounded-full border text-[9px] font-black uppercase tracking-wider bg-${cfg.color}-50 text-${cfg.color}-700 border-${cfg.color}-200 inline-flex items-center gap-1 transition-all ${
                                    canChangeStatus(s) ? 'hover:shadow-md hover:scale-105 cursor-pointer ring-2 ring-transparent hover:ring-indigo-500/20' : 'cursor-default'
                                  }`}
                                  title={canChangeStatus(s) ? "Clique para alterar o status" : "Status finalizado"}
                                >
                                  <cfg.icon className="w-3 h-3" />
                                  <span>{cfg.label}</span>
                                  {canChangeStatus(s) && <ChevronRight className="w-2.5 h-2.5 opacity-60" />}
                                </button>
                              </td>

                              {/* Ações */}
                              <td className="py-3 px-3 text-right whitespace-nowrap overflow-hidden">
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    onClick={() => setPreviewingOS(s)}
                                    className="px-2 py-1 bg-slate-900 hover:bg-indigo-600 text-white rounded-lg font-black text-[10px] uppercase transition-all shadow-xs"
                                    title="Ordem de Serviço"
                                  >
                                    OS
                                  </button>
                                  {(s.requesterId === currentUserId || userRole === 'admin') && (
                                    <>
                                      <button
                                        onClick={() => onEdit(s)}
                                        disabled={['cancelado', 'em_curso', 'concluido'].includes(s.status)}
                                        className={`p-1.5 border rounded-lg transition-all ${['cancelado', 'em_curso', 'concluido'].includes(s.status) ? 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-900 hover:text-white'}`}
                                        title="Editar"
                                      >
                                        <Edit3 className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={() => { if (window.confirm('Excluir agendamento?')) onDelete(s.id); }}
                                        className="p-1.5 bg-white border border-slate-200 text-rose-500 hover:bg-rose-600 hover:text-white rounded-lg transition-all"
                                        title="Excluir"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
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

                {/* Visualização Mobile (Cards Dedicados e Otimizados para Celular) */}
                <div className="md:hidden space-y-3.5">
                  {paginatedSchedules.map(s => {
                    const v = vehicles.find(veh => veh.id === s.vehicleId);
                    const d = persons.find(p => p.id === s.driverId);
                    const requesterPerson = persons.find(p => p.id === s.requesterPersonId);
                    const sector = sectors.find(sec => sec.id === s.serviceSectorId)
                      || (requesterPerson?.sectorId ? sectors.find(sec => sec.id === requesterPerson.sectorId) : undefined)
                      || (v?.sectorId ? sectors.find(sec => sec.id === v.sectorId) : undefined);
                    const cfg = STATUS_MAP[s.status];

                    return (
                      <div
                        key={s.id}
                        className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-xs space-y-3 relative overflow-hidden"
                      >
                        {/* Topo do Card Mobile: Veículo + Placa + OS + Status */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-9 h-9 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 shrink-0 font-bold border border-indigo-100">
                              <Car className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap leading-tight">
                                <h4 className="font-black text-slate-900 uppercase tracking-tight text-xs truncate">
                                  {v?.model || 'Desconhecido'}
                                </h4>
                                <span className="px-1.5 py-0.5 bg-indigo-600 text-white text-[9px] font-black rounded-md uppercase tracking-wider shrink-0">
                                  {s.protocol}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="font-mono text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 uppercase">
                                  {v?.plate || '---'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Badge de Status Interativo no Mobile */}
                          <div className="shrink-0">
                            <button
                              onClick={() => canChangeStatus(s) && setChangeStatusModalSchedule(s)}
                              disabled={!canChangeStatus(s)}
                              className={`px-2 py-1 rounded-full border text-[9px] font-black uppercase tracking-wider bg-${cfg.color}-50 text-${cfg.color}-700 border-${cfg.color}-200 inline-flex items-center gap-1 shadow-2xs ${
                                canChangeStatus(s) ? 'cursor-pointer active:scale-95' : 'cursor-default'
                              }`}
                              title={canChangeStatus(s) ? "Clique para alterar o status" : "Status finalizado"}
                            >
                              <cfg.icon className="w-2.5 h-2.5" />
                              <span>{cfg.label}</span>
                              {canChangeStatus(s) && <ChevronRight className="w-2.5 h-2.5 opacity-60" />}
                            </button>
                          </div>
                        </div>

                        {/* Bloco de Datas e Horários Mobile */}
                        <div className="grid grid-cols-2 gap-2 p-2.5 bg-slate-50/90 rounded-xl border border-slate-100 text-xs">
                          <div>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Saída
                            </span>
                            <p className="text-[11px] font-bold text-slate-800 mt-0.5">
                              {new Date(s.departureDateTime).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                          <div>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span> Retorno
                            </span>
                            <p className="text-[11px] font-bold text-slate-700 mt-0.5">
                              {s.returnDateTime ? new Date(s.returnDateTime).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '---'}
                            </p>
                          </div>
                        </div>

                        {/* Destino, Motorista, Solicitante & Setor */}
                        <div className="space-y-1.5 text-xs">
                          <div className="flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                            <span className="text-[10px] font-black text-slate-400 uppercase">Destino:</span>
                            <span className="text-xs font-black text-indigo-700 uppercase truncate">{s.destination}</span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100 text-[11px]">
                            <div className="min-w-0">
                              <span className="text-[9px] font-black text-slate-400 uppercase block">Motorista:</span>
                              <span className="font-bold text-slate-700 truncate block">{d?.name || '---'}</span>
                            </div>
                            <div className="min-w-0">
                              <span className="text-[9px] font-black text-slate-400 uppercase block">Solicitante:</span>
                              <span className="font-bold text-slate-700 truncate block">{requesterPerson?.name || '---'}</span>
                              <span className="text-[9px] text-slate-400 font-semibold truncate block">{sector?.name || '---'}</span>
                            </div>
                          </div>
                        </div>

                        {/* Barra de Ações Mobile */}
                        <div className="flex items-center justify-between gap-1.5 pt-2 border-t border-slate-100">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => setManagingCrew(s)}
                              disabled={['cancelado', 'em_curso', 'concluido'].includes(s.status) || (s.requesterId !== currentUserId && userRole !== 'admin')}
                              className={`px-2.5 py-1.5 border text-[10px] font-extrabold uppercase rounded-lg transition-all flex items-center gap-1 ${
                                (['cancelado', 'em_curso', 'concluido'].includes(s.status) || (s.requesterId !== currentUserId && userRole !== 'admin'))
                                  ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed'
                                  : 'bg-indigo-50 border-indigo-100 text-indigo-600 hover:bg-indigo-600 hover:text-white'
                              }`}
                              title="Ocupantes"
                            >
                              <Users className="w-3 h-3" />
                              <span>{(s.passengers?.length || 0) + 1} Ocup.</span>
                            </button>

                            <button
                              onClick={() => setViewingPurpose(s)}
                              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg border border-slate-200/60 text-[10px] font-bold uppercase flex items-center gap-1"
                              title="Motivo"
                            >
                              <Target className="w-3 h-3" />
                              <span>Motivo</span>
                            </button>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setPreviewingOS(s)}
                              className="px-2.5 py-1.5 bg-slate-900 hover:bg-indigo-600 text-white rounded-lg font-black text-[10px] uppercase transition-all shadow-2xs"
                              title="Ordem de Serviço"
                            >
                              OS
                            </button>
                            {(s.requesterId === currentUserId || userRole === 'admin') && (
                              <>
                                <button
                                  onClick={() => onEdit(s)}
                                  disabled={['cancelado', 'em_curso', 'concluido'].includes(s.status)}
                                  className={`p-1.5 border rounded-lg transition-all ${
                                    ['cancelado', 'em_curso', 'concluido'].includes(s.status)
                                      ? 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed'
                                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-900 hover:text-white'
                                  }`}
                                  title="Editar"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => { if (window.confirm('Excluir agendamento?')) onDelete(s.id); }}
                                  className="p-1.5 bg-white border border-slate-200 text-rose-500 hover:bg-rose-600 hover:text-white rounded-lg transition-all"
                                  title="Excluir"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              /* CARD VIEW */
              paginatedSchedules.map(s => {
                const v = vehicles.find(veh => veh.id === s.vehicleId);
                const d = persons.find(p => p.id === s.driverId);
                const requesterPerson = persons.find(p => p.id === s.requesterPersonId);
                const sector = sectors.find(sec => sec.id === s.serviceSectorId)
                  || (requesterPerson?.sectorId ? sectors.find(sec => sec.id === requesterPerson.sectorId) : undefined)
                  || (v?.sectorId ? sectors.find(sec => sec.id === v.sectorId) : undefined);
                const cfg = STATUS_MAP[s.status];

                return (
                  <div key={s.id} className="bg-white p-4 sm:p-5 rounded-2xl md:rounded-[2rem] border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(99,102,241,0.15)] transition-all duration-300 hover:-translate-y-1 flex flex-col gap-3 group relative">
                    {/* Decorative Elements */}
                    <div className="absolute inset-0 rounded-2xl md:rounded-[2rem] overflow-hidden pointer-events-none">
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
                              <h4 className="text-base sm:text-lg font-black text-slate-800 uppercase tracking-tight group-hover:text-indigo-700 transition-colors">{v?.model || 'Desconhecido'}</h4>
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
                        <div className="shrink-0">
                          <button
                            onClick={() => canChangeStatus(s) && setChangeStatusModalSchedule(s)}
                            disabled={!canChangeStatus(s)}
                            className={`px-3 py-1.5 rounded-full border text-[9px] font-black uppercase tracking-widest shadow-sm bg-${cfg.color}-50 text-${cfg.color}-700 border-${cfg.color}-200 inline-flex items-center gap-1.5 hover:shadow-md transition-all ${
                              canChangeStatus(s) ? 'cursor-pointer hover:scale-105' : 'cursor-default'
                            }`}
                            title={canChangeStatus(s) ? "Clique para alterar o status" : "Status finalizado"}
                          >
                            <cfg.icon className="w-3 h-3" /> {cfg.label}
                            {canChangeStatus(s) && <ChevronRight className="w-2.5 h-2.5 opacity-60" />}
                          </button>
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
            )
          ) : (
            <div className="py-20 text-center bg-white rounded-2xl md:rounded-[3rem] border border-dashed border-slate-200 flex flex-col items-center">
              <History className="w-16 h-16 text-slate-200 mb-4" />
              <p className="text-base sm:text-xl font-black text-slate-400 uppercase tracking-widest">Nenhum registro</p>
            </div>
          )}
        </div>
      </div>

      {/* Footer Info Responsivo & Controles de Paginação (30 em 30) */}
      <div className="shrink-0 flex flex-col sm:flex-row justify-between items-center gap-3 px-4 md:px-8 py-3 md:py-4 bg-white border-t border-slate-100 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-[10px] md:text-xs font-bold text-slate-500">
            Mostrando <strong className="text-slate-900">{filtered.length > 0 ? (safePage - 1) * ITEMS_PER_PAGE + 1 : 0}</strong> a <strong className="text-slate-900">{Math.min(safePage * ITEMS_PER_PAGE, filtered.length)}</strong> de <strong className="text-indigo-600">{filtered.length}</strong> agendamentos
          </span>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center gap-1.5 flex-wrap justify-center">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={safePage === 1}
              className="p-1.5 md:px-3 md:py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-700 disabled:hover:border-slate-200 disabled:cursor-not-allowed transition-all flex items-center gap-1"
              title="Página Anterior"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Anterior</span>
            </button>

            <div className="flex items-center gap-1 px-1">
              {getPageNumbers().map((page, idx) => (
                typeof page === 'number' ? (
                  <button
                    key={idx}
                    onClick={() => setCurrentPage(page)}
                    className={`w-8 h-8 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center ${
                      safePage === page
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 scale-105'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {page}
                  </button>
                ) : (
                  <span key={idx} className="px-1 text-slate-400 text-xs font-bold">...</span>
                )
              ))}
            </div>

            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={safePage === totalPages}
              className="p-1.5 md:px-3 md:py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-700 disabled:hover:border-slate-200 disabled:cursor-not-allowed transition-all flex items-center gap-1"
              title="Próxima Página"
            >
              <span className="hidden sm:inline">Próxima</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
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
          sector={
            sectors.find(s => s.id === previewingOS.serviceSectorId)
            || (persons.find(p => p.id === previewingOS.requesterPersonId)?.sectorId
                ? sectors.find(s => s.id === persons.find(p => p.id === previewingOS.requesterPersonId)?.sectorId)
                : undefined)
            || (vehicles.find(v => v.id === previewingOS.vehicleId)?.sectorId
                ? sectors.find(s => s.id === vehicles.find(v => v.id === previewingOS.vehicleId)?.sectorId)
                : undefined)
          }
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

      {/* Modal de Alteração de Status */}
      {changeStatusModalSchedule && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-white sm:rounded-[2.5rem] rounded-t-[2.5rem] shadow-2xl border border-white/20 overflow-hidden flex flex-col animate-slide-up max-h-[90vh]">
            {/* Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-600/20">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 tracking-tight uppercase">Alterar Status</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">OS: {changeStatusModalSchedule.protocol}</p>
                </div>
              </div>
              <button
                onClick={() => setChangeStatusModalSchedule(null)}
                className="p-2 hover:bg-slate-200/60 rounded-xl text-slate-400 hover:text-slate-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-3 flex-1 overflow-y-auto custom-scrollbar">
              {/* Status Atual */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between text-xs">
                <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Status Atual</span>
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-${STATUS_MAP[changeStatusModalSchedule.status].color}-50 text-${STATUS_MAP[changeStatusModalSchedule.status].color}-700 border border-${STATUS_MAP[changeStatusModalSchedule.status].color}-200 flex items-center gap-1`}>
                  {STATUS_MAP[changeStatusModalSchedule.status].label}
                </span>
              </div>

              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest pt-2">Selecione o novo status:</p>

              {/* Opção 1: Aguardando / Pendente */}
              {changeStatusModalSchedule.status !== 'pendente' && (
                <button
                  onClick={() => {
                    onUpdateStatus(changeStatusModalSchedule.id, 'pendente');
                    setChangeStatusModalSchedule(null);
                  }}
                  className="w-full text-left p-3.5 rounded-2xl border border-amber-100 bg-amber-50/40 hover:bg-amber-50 hover:border-amber-300 transition-all flex items-center justify-between group cursor-pointer shadow-xs hover:scale-[1.01]"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold shadow-sm">
                      <Clock className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-amber-950 uppercase tracking-tight group-hover:text-amber-700">Aguardando / Pendente</h4>
                      <p className="text-[10px] text-amber-700/80 font-medium">Retornar solicitação para a fila de espera</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-amber-400 group-hover:translate-x-1 transition-transform" />
                </button>
              )}

              {/* Opção 2: Confirmado */}
              {changeStatusModalSchedule.status !== 'confirmado' && (
                <button
                  onClick={() => {
                    onUpdateStatus(changeStatusModalSchedule.id, 'confirmado');
                    setChangeStatusModalSchedule(null);
                  }}
                  className="w-full text-left p-3.5 rounded-2xl border border-emerald-100 bg-emerald-50/40 hover:bg-emerald-50 hover:border-emerald-300 transition-all flex items-center justify-between group cursor-pointer shadow-xs hover:scale-[1.01]"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-sm">
                      <CheckCircle2 className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-emerald-950 uppercase tracking-tight group-hover:text-emerald-700">Confirmado</h4>
                      <p className="text-[10px] text-emerald-700/80 font-medium">Aprovar e confirmar a saída do veículo</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-emerald-400 group-hover:translate-x-1 transition-transform" />
                </button>
              )}

              {/* Opção 3: Em Curso */}
              {changeStatusModalSchedule.status !== 'em_curso' && (
                <button
                  onClick={() => {
                    onUpdateStatus(changeStatusModalSchedule.id, 'em_curso');
                    setChangeStatusModalSchedule(null);
                  }}
                  className="w-full text-left p-3.5 rounded-2xl border border-blue-100 bg-blue-50/40 hover:bg-blue-50 hover:border-blue-300 transition-all flex items-center justify-between group cursor-pointer shadow-xs hover:scale-[1.01]"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-sm">
                      <MapPin className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-blue-950 uppercase tracking-tight group-hover:text-blue-700">Em Curso</h4>
                      <p className="text-[10px] text-blue-700/80 font-medium">Marcar veículo em trânsito / deslocamento</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-blue-400 group-hover:translate-x-1 transition-transform" />
                </button>
              )}

              {/* Opção 4: Concluído */}
              {changeStatusModalSchedule.status !== 'concluido' && (
                <button
                  onClick={() => {
                    onUpdateStatus(changeStatusModalSchedule.id, 'concluido');
                    setChangeStatusModalSchedule(null);
                  }}
                  className="w-full text-left p-3.5 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300 transition-all flex items-center justify-between group cursor-pointer shadow-xs hover:scale-[1.01]"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-700 text-white flex items-center justify-center font-bold shadow-sm">
                      <History className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight group-hover:text-slate-700">Concluído</h4>
                      <p className="text-[10px] text-slate-500 font-medium">Finalizar o serviço e liberar o veículo</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
                </button>
              )}

              {/* Opção 5: Rejeitado / Cancelado */}
              {changeStatusModalSchedule.status !== 'cancelado' && (
                <button
                  onClick={() => {
                    const target = changeStatusModalSchedule;
                    setChangeStatusModalSchedule(null);
                    handleOpenCancelModal(target);
                  }}
                  className="w-full text-left p-3.5 rounded-2xl border border-rose-100 bg-rose-50/40 hover:bg-rose-50 hover:border-rose-300 transition-all flex items-center justify-between group cursor-pointer shadow-xs hover:scale-[1.01]"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center font-bold shadow-sm">
                      <XCircle className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-rose-950 uppercase tracking-tight group-hover:text-rose-700">Rejeitado / Cancelado</h4>
                      <p className="text-[10px] text-rose-700/80 font-medium">Cancelar o agendamento com justificativa</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-rose-400 group-hover:translate-x-1 transition-transform" />
                </button>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setChangeStatusModalSchedule(null)}
                className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 font-black text-xs uppercase tracking-wider rounded-xl hover:bg-slate-100 transition-all cursor-pointer shadow-xs"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};