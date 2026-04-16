import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Vehicle, Person, VehicleSchedule, ScheduleStatus, Sector, AppState, UserRole, AppPermission } from '../types';
import {
  ArrowLeft, Plus, Search, Calendar, Clock, MapPin,
  User as UserIcon, Car, Info, Trash2, Edit3, CheckCircle2,
  X, ChevronDown, Check, LayoutGrid, List, Filter, History,
  AlertCircle, Navigation, ClipboardList, Timer, Loader2, Save,
  ChevronLeft, ChevronRight, Gift, Flag, AlertTriangle, ArrowRight,
  ArrowDown, TrendingUp, CalendarDays, Lock, Eye, FileText, Network,
  UserCheck, ShieldCheck, XCircle, ChevronRight as ChevronRightIcon,
  PackageCheck, Sparkles, Truck, CheckCircle, Activity, Flame,
  Building2, ArrowRightLeft, UserCircle, Landmark, Users, Briefcase
} from 'lucide-react';
import { DateTimePickerModal } from './DateTimePickerModal';
import { VehicleScheduleHistory } from './VehicleScheduleHistory';
import { VehicleScheduleApprovals } from './VehicleScheduleApprovals';
import { SelectionModal } from './SelectionModal';
import { VehicleScheduleDashboard } from './VehicleScheduleDashboard';

interface VehicleSchedulingScreenProps {
  schedules: VehicleSchedule[];
  vehicles: Vehicle[];
  persons: Person[];
  sectors: Sector[];
  onAddSchedule: (s: Omit<VehicleSchedule, 'id' | 'createdAt'>) => Promise<void>;
  onUpdateSchedule: (s: VehicleSchedule) => Promise<void>;
  onDeleteSchedule: (id: string) => Promise<void>;
  onBack: () => void;
  currentUserId: string;
  currentUserName?: string;
  currentUserRole: UserRole;
  currentUserPermissions?: AppPermission[];
  currentUserSector?: string;
  requestedView?: 'menu' | 'calendar' | 'history' | 'approvals' | 'dashboard';
  onNavigate?: (path: string) => void;
  state: AppState;
}

const STATUS_MAP: Record<ScheduleStatus, { label: string, color: string, icon: any }> = {
  pendente: { label: 'Aguardando', color: 'amber', icon: Timer },
  confirmado: { label: 'Confirmado', color: 'emerald', icon: CheckCircle2 },
  em_curso: { label: 'Em Curso', color: 'blue', icon: Navigation },
  concluido: { label: 'Concluído', color: 'slate', icon: ClipboardList },
  cancelado: { label: 'Rejeitado/Cancelado', color: 'rose', icon: X },
};

const HOLIDAYS: Record<string, string> = {
  '01-01': 'Confraternização Universal',
  '21-04': 'Tiradentes',
  '01-05': 'Dia do Trabalho',
  '07-09': 'Independência do Brasil',
  '12-10': 'Nossa Sra. Aparecida',
  '02-11': 'Finados',
  '15-11': 'Proclamação da República',
  '20-11': 'Dia da Consciência Negra',
  '25-12': 'Natal',
};

// Initial common cities to show before fetching or while loading
const INITIAL_CITIES = [
  'SÃO JOSÉ DO GOIABAL - MG', 'JOÃO MONLEVADE - MG', 'BELO HORIZONTE - MG',
  'IPATINGA - MG', 'ITABIRA - MG', 'ALVINÓPOLIS - MG', 'RIO PIRACICABA - MG',
  'PONTE NOVA - MG', 'DOM SILVÉRIO - MG', 'DIONÍSIO - MG', 'SÃO DOMINGOS DO PRATA - MG'
];

export const VehicleSchedulingScreen: React.FC<VehicleSchedulingScreenProps> = ({
  schedules = [],
  vehicles = [],
  persons = [],
  sectors = [],
  onAddSchedule,
  onUpdateSchedule,
  onDeleteSchedule,
  onBack,
  currentUserId,
  currentUserName,
  currentUserRole,
  currentUserPermissions = [],
  currentUserSector,
  requestedView,
  onNavigate,
  state
}) => {
  const [activeSubView, setActiveSubView] = useState<'menu' | 'calendar' | 'history' | 'approvals' | 'dashboard'>('menu');

  const normalizeString = (str: string) =>
    str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

  const currentUserPerson = useMemo(() => {
    if (!currentUserName) return undefined;
    const search = normalizeString(currentUserName);
    if (!search) return undefined;

    // Try multiple matching levels
    let person = persons.find(p => normalizeString(p.name) === search);

    if (!person) {
      person = persons.find(p => normalizeString(p.name).startsWith(search));
    }

    if (!person) {
      person = persons.find(p => search.startsWith(normalizeString(p.name)));
    }

    if (!person) {
      person = persons.find(p => normalizeString(p.name).includes(search) || search.includes(normalizeString(p.name)));
    }

    return person;
  }, [persons, currentUserName]);

  const currentUserPersonId = currentUserPerson?.id;

  const canViewApprovals = useMemo(() => {
    if (currentUserRole === 'admin') return true;
    const isVehicleManager = currentUserPermissions?.includes('parent_frotas');
    const isVehicleResponsible = vehicles.some(v =>
      v.requestManagerIds?.includes(currentUserPersonId || '') ||
      v.responsiblePersonId === currentUserPersonId
    );
    return isVehicleManager || isVehicleResponsible;
  }, [currentUserRole, currentUserPermissions, vehicles, currentUserPersonId]);


  useEffect(() => {
    if (requestedView && requestedView !== activeSubView) {
      setActiveSubView(requestedView);
    }
  }, [requestedView]);

  const handleSubViewChange = (view: 'menu' | 'calendar' | 'history' | 'approvals' | 'dashboard') => {
    setActiveSubView(view);
    if (onNavigate) {
      const paths = {
        'menu': '/AgendamentoVeiculos',
        'calendar': '/AgendamentoVeiculos/Agendar',
        'history': '/AgendamentoVeiculos/Historico',
        'approvals': '/AgendamentoVeiculos/Aprovacoes',
        'dashboard': '/AgendamentoVeiculos/Dashboard'
      };
      onNavigate(paths[view]);
    }
  };
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPassengerModalOpen, setIsPassengerModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<VehicleSchedule | null>(null);
  const [viewingSchedule, setViewingSchedule] = useState<VehicleSchedule | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [cities, setCities] = useState<string[]>(INITIAL_CITIES);

  useEffect(() => {
    // Fetch all cities from IBGE
    const fetchCities = async () => {
      try {
        const response = await fetch('https://servicodados.ibge.gov.br/api/v1/localidades/municipios');
        if (!response.ok) throw new Error('Failed to fetch cities');
        const data = await response.json();
        // Format: "CITY NAME - UF"
        const formattedCities = data.map((c: any) => {
          const name = c.nome?.toUpperCase() || 'DESCONHECIDO';
          const uf = c.microrregiao?.mesorregiao?.UF?.sigla || 'BR';
          return `${name} - ${uf}`;
        }).sort((a: string, b: string) => a.localeCompare(b, 'pt-BR'));

        setCities(formattedCities);
        // Optional: showToast("Lista de cidades atualizada.", "success");
      } catch (error: any) {
        console.error("Error fetching cities:", error);
        showToast("Erro ao carregar cidades. Usando lista básica.", "error");
        // Fallback to initial list if fails
      }
    };
    fetchCities();
  }, []);

  type SelectionField = 'vehicle' | 'driver' | 'sector' | 'requester' | 'city' | null;
  const [activeSelectionField, setActiveSelectionField] = useState<SelectionField>(null);

  const [activeDateField, setActiveDateField] = useState<'departure' | 'return' | null>(null);

  const [toast, setToast] = useState<{ show: boolean, message: string, type: 'error' | 'success' | 'warning' }>({
    show: false, message: '', type: 'error'
  });

  const [formData, setFormData] = useState<Partial<VehicleSchedule>>({
    vehicleId: '', driverId: '', serviceSectorId: '', requesterPersonId: '',
    departureDateTime: '', returnDateTime: '', destination: '', purpose: '', status: 'pendente',
    vehicleLocation: '',
    passengers: [],
    patientCount: 0,
    companionCount: 0
  });
  const [newPassenger, setNewPassenger] = useState<{ name: string, departureLocation: string, appointmentTime: string, appointmentLocation: string }>({
    name: '', departureLocation: '', appointmentTime: '', appointmentLocation: ''
  });

  const handleAddPassenger = () => {
    if (!newPassenger.name || !newPassenger.departureLocation || !newPassenger.appointmentTime || !newPassenger.appointmentLocation) {
      showToast("Preencha todos os campos da tripulação.", "warning");
      return;
    }
    setFormData(prev => ({
      ...prev,
      passengers: [...(prev.passengers || []), newPassenger]
    }));
    setNewPassenger({ name: '', departureLocation: '', appointmentTime: '', appointmentLocation: '' });
  };

  const handleRemovePassenger = (index: number) => {
    setFormData(prev => ({
      ...prev,
      passengers: (prev.passengers || []).filter((_, i) => i !== index)
    }));
  };

  const showToast = (message: string, type: 'error' | 'success' | 'warning' = 'error') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 4000);
  };


  const onUpdateStatusSchedule = async (id: string, status: ScheduleStatus, cancellationDetails?: { reason: string, cancelledBy: string }) => {
    const schedule = (schedules || []).find(s => s.id === id);
    if (schedule) {
      try {
        let updatedSchedule = { ...schedule, status };

        if (status === 'confirmado') {
          updatedSchedule.authorizedByName = currentUserName;
        }

        if (status === 'cancelado' && cancellationDetails) {
          updatedSchedule = {
            ...updatedSchedule,
            cancellationReason: cancellationDetails.reason,
            cancelledBy: cancellationDetails.cancelledBy,
            cancelledAt: new Date().toISOString()
          };
        }

        // Optimistic UI handled by parent's onUpdateSchedule
        await onUpdateSchedule(updatedSchedule);
        if (status === 'confirmado') showToast("Agendamento aprovado!", "success");
        else if (status === 'cancelado') showToast("Agendamento rejeitado/cancelado.", "success");
        else showToast("Status atualizado com sucesso!", "success");
      } catch (error) {
        showToast("Erro ao atualizar status.", "error");
      }
    }
  };

  const isDateBeforeToday = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d < today;
  };

  const getLocalISOString = (date: Date = new Date()) => {
    const tzOffset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
  };

  const formatDateDisplay = (isoString?: string) => {
    if (!isoString) return 'Selecione a data/hora...';
    return new Date(isoString).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  };

  useEffect(() => {
    // Clean up or initial logic if needed
  }, []);

  const isVehicleAvailable = (vehicleId: string, start: string, end: string, excludeScheduleId?: string) => {
    if (!start || !end) return true;
    const startTime = new Date(start).getTime();
    const endTime = new Date(end).getTime();

    return !schedules.some(s => {
      if (s.id === excludeScheduleId) return false;
      if (s.vehicleId !== vehicleId) return false;
      if (s.status !== 'confirmado' && s.status !== 'em_curso') return false;

      const sStart = new Date(s.departureDateTime).getTime();
      const sEnd = new Date(s.returnDateTime).getTime();

      return (startTime < sEnd) && (endTime > sStart);
    });
  };

  const isDateBlocked = (date: Date) => {
    if (!formData.vehicleId) return false;

    // Check if there are ANY confirmed schedules for this vehicle on this day.
    const dayStart = new Date(date); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date); dayEnd.setHours(23, 59, 59, 999);

    return schedules.some(s => {
      // Don't block based on the schedule currently being edited
      if (s.id === editingSchedule?.id) return false;

      if (s.vehicleId !== formData.vehicleId) return false;
      if (s.status !== 'confirmado' && s.status !== 'em_curso') return false;

      const sStart = new Date(s.departureDateTime).getTime();
      const sEnd = new Date(s.returnDateTime).getTime();

      // Check if the schedule overlaps with this day at all
      return (sStart < dayEnd.getTime()) && (sEnd > dayStart.getTime());
    });
  };

  const calendarData = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];
    const prevMonthLast = new Date(year, month, 0).getDate();
    for (let i = firstDay - 1; i >= 0; i--) days.push({ day: prevMonthLast - i, month: month - 1, year, isCurrent: false });
    for (let i = 1; i <= daysInMonth; i++) days.push({ day: i, month, year, isCurrent: true });
    while (days.length < 42) days.push({ day: days.length - (daysInMonth + firstDay) + 1, month: month + 1, year, isCurrent: false });
    return days;
  }, [currentDate]);

  const handleOpenModal = (s?: VehicleSchedule, initialDate?: Date, initialVehicleId?: string) => {
    if (s) {
      setEditingSchedule(s);
      setFormData({ ...s });
    } else {
      setEditingSchedule(null);
      const now = new Date();
      let departure = initialDate ? new Date(initialDate) : now;
      if (departure < now) departure = now;
      if (!initialDate) departure.setMinutes(0, 0, 0);
      const returnDate = new Date(departure.getTime() + (4 * 60 * 60 * 1000));
      // Resolve pre-filled sector ID
      let defaultSectorId = currentUserPerson?.sectorId || '';
      if (!defaultSectorId && currentUserSector) {
        const searchSector = normalizeString(currentUserSector);
        const matchedSector = sectors.find(s =>
          normalizeString(s.name) === searchSector ||
          normalizeString(s.name).includes(searchSector) ||
          searchSector.includes(normalizeString(s.name))
        );
        if (matchedSector) defaultSectorId = matchedSector.id;
      }

      setFormData({
        vehicleId: initialVehicleId || '',
        driverId: '',
        serviceSectorId: defaultSectorId,
        requesterPersonId: currentUserPersonId || '',
        departureDateTime: getLocalISOString(departure),
        returnDateTime: getLocalISOString(returnDate),
        destination: '',
        purpose: '',
        status: 'pendente',
        vehicleLocation: '',
        passengers: [],
        patientCount: 0,
        companionCount: 0
      });
      setNewPassenger({ name: '', departureLocation: '', appointmentTime: '', appointmentLocation: '' });
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.vehicleId || !formData.driverId || !formData.departureDateTime || !formData.returnDateTime || !formData.destination || !formData.requesterPersonId || !formData.serviceSectorId) {
      showToast("Preencha todos os campos obrigatórios.", "warning");
      return;
    }
    const patientCount = formData.patientCount || 0;
    const companionCount = formData.companionCount || 0;
    const totalPassengers = patientCount + companionCount + 1; // 1 for Driver
    const selectedVehicle = vehicles.find(v => v.id === formData.vehicleId);

    if (patientCount === 0 && companionCount === 0) {
      showToast("A seção de Quantidade de Passageiros é obrigatória. Por favor, preencha os valores.", "warning");
      return;
    }

    if (selectedVehicle && selectedVehicle.passengerCapacity !== undefined && totalPassengers > selectedVehicle.passengerCapacity) {
      showToast(`O total de passageiros (${totalPassengers}) excede a capacidade do veículo (${selectedVehicle.model} - ${selectedVehicle.passengerCapacity} lugares).`, "error");
      return;
    }

    if (!formData.passengers || formData.passengers.length === 0) {
      // Optional now or can be required depending on old rules, but user emphasizes passenger count. Keeping old check.
      showToast("A lista detalhada de Passageiros / Tripulação também é obrigatória.", "warning");
      return;
    }
    const now = Date.now();
    const depTime = new Date(formData.departureDateTime!).getTime();
    const retTime = new Date(formData.returnDateTime!).getTime();
    if (!editingSchedule && depTime < now - 60000) {
      showToast("Não é possível realizar novos agendamentos para datas ou horários que já passaram.", "error");
      return;
    }
    if (retTime <= depTime) {
      showToast("A data/hora de retorno deve ser posterior à de saída.", "warning");
      return;
    }
    // Lógica de aprovação automática
    const isAdmin = currentUserRole === 'admin';
    const isFleetManager = currentUserPermissions?.includes('parent_frotas');
    const isResponsible = selectedVehicle?.responsiblePersonId === currentUserPersonId;
    const isManager = selectedVehicle?.requestManagerIds?.includes(currentUserPersonId || '');
    const hasAuthority = isAdmin || isFleetManager || isResponsible || isManager;

    let finalStatus = formData.status || 'pendente';
    let authorizedBy = formData.authorizedByName;

    if (!editingSchedule && hasAuthority) {
      finalStatus = 'confirmado';
      authorizedBy = currentUserName || 'Gestor';
    }

    if (finalStatus === 'confirmado' && !isVehicleAvailable(formData.vehicleId, formData.departureDateTime!, formData.returnDateTime!, editingSchedule?.id)) {
      showToast("Este veículo já possui um agendamento CONFIRMADO neste período.", "error");
      return;
    }

    setIsSaving(true);
    try {
      // Convert to proper ISO UTC strings for backend
      const utcDeparture = new Date(formData.departureDateTime!).toISOString();
      const utcReturn = new Date(formData.returnDateTime!).toISOString();

      if (editingSchedule) {
        // Update
        const data = {
          ...formData,
          status: finalStatus,
          authorizedByName: authorizedBy,
          departureDateTime: utcDeparture,
          returnDateTime: utcReturn,
          id: editingSchedule.id,
          createdAt: editingSchedule.createdAt,
          requesterId: editingSchedule.requesterId
        } as VehicleSchedule;
        await onUpdateSchedule(data);
        showToast("Agendamento atualizado!", "success");
      } else {
        // Create
        const data = {
          ...formData,
          status: finalStatus,
          authorizedByName: authorizedBy || undefined,
          departureDateTime: utcDeparture,
          returnDateTime: utcReturn,
          requesterId: currentUserId,
          // id and createdAt will be generated by backend
        } as any; // Cast to any or strict omit type 
        await onAddSchedule(data);
        showToast(hasAuthority ? "Agendamento aprovado e realizado!" : "Agendamento realizado com sucesso!", "success");
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error("Erro ao salvar:", error);
      showToast("Erro ao processar agendamento. Tente novamente.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const pendingApprovals = schedules.filter(s => s.status === 'pendente').length;
  const labelClass = "block text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600 mb-2 ml-1";
  const inputClass = "w-full rounded-2xl border border-slate-200 bg-slate-50/50 p-3.5 text-sm font-bold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all placeholder:text-slate-400";

  const renderDashboard = () => (
    <>
      {/* Fixed Back Button - Standardized Position */}
      <button
        onClick={onBack}
        className="fixed top-24 left-4 md:top-28 md:left-8 z-[999] group flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-bold transition-all p-2 pr-4 rounded-full bg-white/90 backdrop-blur-md border border-slate-200/60 shadow-lg hover:shadow-xl hover:bg-white hover:-translate-y-0.5 hover:border-indigo-100"
        title="Voltar ao Menu"
      >
        <div className="w-8 h-8 rounded-full bg-white border border-slate-100 flex items-center justify-center group-hover:bg-indigo-50 group-hover:border-indigo-100 transition-colors">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform text-slate-400 group-hover:text-indigo-600" />
        </div>
        <span className="text-[10px] uppercase tracking-widest font-extrabold group-hover:text-indigo-700">Voltar</span>
      </button>

      <div className="flex-1 bg-slate-50 font-sans flex flex-col overflow-hidden relative z-0">
        <div className="flex-1 flex flex-col items-center justify-center w-full h-full p-4 md:p-8 pt-24 md:pt-28 min-h-0 container mx-auto">
          <div className="w-full flex-1 flex flex-col items-center justify-center max-h-full">

            {/* Header */}
            <div className="flex flex-col items-center mb-6 md:mb-10 shrink-0 animation-delay-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="p-5 rounded-[2rem] bg-gradient-to-br from-indigo-50 to-indigo-100/50 mb-5 shadow-sm ring-8 ring-white/50">
                <Car className="w-12 h-12 text-indigo-600 drop-shadow-sm" />
              </div>
              <h2 className="text-3xl md:text-5xl font-black text-slate-800 tracking-tight text-center drop-shadow-sm">Gestão de Veículos</h2>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-2">Sistema Unificado de Agendamentos</p>
            </div>

            {/* Actions Grid - Responsive & Auto-adjusting */}
            <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 max-w-7xl animate-in zoom-in duration-500 fill-mode-backwards p-2">

              {/* Card: Agendar Veículo */}
              <button
                onClick={() => handleSubViewChange('calendar')}
                className="group relative w-full min-h-[140px] md:min-h-[180px] rounded-[2.5rem] bg-gradient-to-br from-white to-slate-50/50 border border-slate-100 shadow-[0_10px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_25px_60px_rgb(0,0,0,0.12)] hover:shadow-indigo-500/30 hover:border-indigo-200 hover:from-white hover:to-indigo-50/30 transition-all duration-300 ease-spring hover:-translate-y-2 active:scale-95 flex flex-col items-center justify-center overflow-hidden"
                style={{ animationDelay: '0ms' }}
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-bl-[100%] -mr-10 -mt-10 transition-transform duration-700 ease-out group-hover:scale-150"></div>
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-indigo-500/5 rounded-tr-[100%] -ml-10 -mb-10 transition-transform duration-700 ease-out group-hover:scale-125 opacity-0 group-hover:opacity-100"></div>

                <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center mb-3 text-white group-hover:scale-110 group-hover:rotate-6 transition-transform duration-300 shadow-lg shadow-indigo-500/30 ring-4 ring-white">
                  <Calendar className="w-6 h-6 md:w-7 md:h-7 drop-shadow-md" />
                </div>

                <h3 className="text-lg md:text-2xl font-bold text-slate-800 mb-1 group-hover:text-slate-900 tracking-tight">Agendar Veículo</h3>
                <p className="text-[10px] md:text-xs font-bold text-slate-400 group-hover:text-indigo-600 transition-colors uppercase tracking-widest">Solicitar nova viagem</p>
              </button>

              {/* Card: Meus Agendamentos */}
              <button
                onClick={() => handleSubViewChange('history')}
                className="group relative w-full min-h-[140px] md:min-h-[180px] rounded-[2.5rem] bg-gradient-to-br from-white to-slate-50/50 border border-slate-100 shadow-[0_10px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_25px_60px_rgb(0,0,0,0.12)] hover:shadow-emerald-500/30 hover:border-emerald-200 hover:from-white hover:to-emerald-50/30 transition-all duration-300 ease-spring hover:-translate-y-2 active:scale-95 flex flex-col items-center justify-center overflow-hidden"
                style={{ animationDelay: '100ms' }}
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-bl-[100%] -mr-10 -mt-10 transition-transform duration-700 ease-out group-hover:scale-150"></div>
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-emerald-500/5 rounded-tr-[100%] -ml-10 -mb-10 transition-transform duration-700 ease-out group-hover:scale-125 opacity-0 group-hover:opacity-100"></div>

                <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center mb-3 text-white group-hover:scale-110 group-hover:rotate-6 transition-transform duration-300 shadow-lg shadow-emerald-500/30 ring-4 ring-white">
                  <History className="w-6 h-6 md:w-7 md:h-7 drop-shadow-md" />
                </div>

                <h3 className="text-lg md:text-2xl font-bold text-slate-800 mb-1 group-hover:text-slate-900 tracking-tight">Meus Agendamentos</h3>
                <p className="text-[10px] md:text-xs font-bold text-slate-400 group-hover:text-emerald-600 transition-colors uppercase tracking-widest">Histórico e Status</p>
              </button>

              {/* Card: Aprovações (Conditional) */}
              {canViewApprovals && (
                <button
                  onClick={() => handleSubViewChange('approvals')}
                  className="group relative w-full min-h-[140px] md:min-h-[180px] rounded-[2.5rem] bg-gradient-to-br from-white to-slate-50/50 border border-slate-100 shadow-[0_10px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_25px_60px_rgb(0,0,0,0.12)] hover:shadow-amber-500/30 hover:border-amber-200 hover:from-white hover:to-amber-50/30 transition-all duration-300 ease-spring hover:-translate-y-2 active:scale-95 flex flex-col items-center justify-center overflow-hidden"
                  style={{ animationDelay: '200ms' }}
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-bl-[100%] -mr-10 -mt-10 transition-transform duration-700 ease-out group-hover:scale-150"></div>
                  <div className="absolute bottom-0 left-0 w-24 h-24 bg-amber-500/5 rounded-tr-[100%] -ml-10 -mb-10 transition-transform duration-700 ease-out group-hover:scale-125 opacity-0 group-hover:opacity-100"></div>

                  <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center mb-3 text-white group-hover:scale-110 group-hover:rotate-6 transition-transform duration-300 shadow-lg shadow-amber-500/30 ring-4 ring-white">
                    <ShieldCheck className="w-6 h-6 md:w-7 md:h-7 drop-shadow-md" />
                  </div>

                  <h3 className="text-lg md:text-2xl font-bold text-slate-800 mb-1 group-hover:text-slate-900 tracking-tight">Aprovações</h3>
                  <p className="text-[10px] md:text-xs font-bold text-slate-400 group-hover:text-amber-600 transition-colors uppercase tracking-widest">Gestão de Solicitações</p>
                </button>
              )}

              {/* Card: Dashboard Analítico */}
              <button
                onClick={() => handleSubViewChange('dashboard')}
                className="group relative w-full min-h-[140px] md:min-h-[180px] rounded-[2.5rem] bg-gradient-to-br from-white to-slate-50/50 border border-slate-100 shadow-[0_10px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_25px_60px_rgb(0,0,0,0.12)] hover:shadow-cyan-500/30 hover:border-cyan-200 hover:from-white hover:to-cyan-50/30 transition-all duration-300 ease-spring hover:-translate-y-2 active:scale-95 flex flex-col items-center justify-center overflow-hidden"
                style={{ animationDelay: '300ms' }}
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-bl-[100%] -mr-10 -mt-10 transition-transform duration-700 ease-out group-hover:scale-150"></div>
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-cyan-500/5 rounded-tr-[100%] -ml-10 -mb-10 transition-transform duration-700 ease-out group-hover:scale-125 opacity-0 group-hover:opacity-100"></div>

                <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center mb-3 text-white group-hover:scale-110 group-hover:rotate-6 transition-transform duration-300 shadow-lg shadow-cyan-500/30 ring-4 ring-white">
                  <Activity className="w-6 h-6 md:w-7 md:h-7 drop-shadow-md" />
                </div>

                <h3 className="text-lg md:text-2xl font-bold text-slate-800 mb-1 group-hover:text-slate-900 tracking-tight">Dashboard Analítico</h3>
                <p className="text-[10px] md:text-xs font-bold text-slate-400 group-hover:text-cyan-600 transition-colors uppercase tracking-widest">Indicadores de Frota</p>
              </button>

            </div>
          </div>
        </div>
      </div>
    </>
  );

  const renderCalendar = () => (
    <div className="flex-1 flex flex-col overflow-hidden animate-fade-in h-full">
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 z-20">
        <div className="flex items-center gap-4">
          <button onClick={() => handleSubViewChange('menu')} className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 shadow-sm transition-all active:scale-95">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tight leading-none">Agendar Veículo</h2>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Nova Solicitação</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-inner">
          <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))} className="p-2 hover:bg-white hover:shadow-sm rounded-xl text-slate-600 transition-all"><ChevronLeft className="w-5 h-5" /></button>
          <div className="px-6 text-sm font-black text-slate-900 uppercase tracking-widest min-w-[220px] text-center">{currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</div>
          <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))} className="p-2 hover:bg-white hover:shadow-sm rounded-xl text-slate-600 transition-all"><ChevronRight className="w-5 h-5" /></button>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setCurrentDate(new Date())} className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-200 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm">Hoje</button>
          <button onClick={() => handleOpenModal()} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl shadow-lg shadow-indigo-600/20 transition-all hover:-translate-y-0.5 active:scale-95 flex items-center gap-2 uppercase text-[10px] tracking-[0.2em]"><Plus className="w-4 h-4" />Novo Agendamento</button>
        </div>
      </div>
      <div className="grid grid-cols-7 bg-slate-900 shrink-0 shadow-lg z-10">
        {['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'].map((d, i) => (
          <div key={d} className={`py-4 text-center text-[10px] font-black uppercase tracking-[0.3em] border-r border-slate-800/50 last:border-0 ${i === 0 || i === 6 ? 'text-amber-400' : 'text-slate-400'}`}>{d}</div>
        ))}
      </div>
      <div className="flex-1 overflow-hidden">
        <div className="grid grid-cols-7 h-full w-full bg-slate-200 gap-px">
          {calendarData.map((cell, idx) => {
            if (!cell.isCurrent) return <div key={idx} className="bg-slate-50/30 min-h-0" />;
            const dayStart = new Date(cell.year, cell.month, cell.day, 0, 0, 0).getTime();
            const dayEnd = new Date(cell.year, cell.month, cell.day, 23, 59, 59).getTime();
            const dateObj = new Date(cell.year, cell.month, cell.day);
            const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
            const dayKey = `${String(cell.day).padStart(2, '0')}-${String(cell.month + 1).padStart(2, '0')}`;
            const holidayName = HOLIDAYS[dayKey];
            const isHoliday = !!holidayName;
            const daySchedules = schedules.filter(s => {
              if (s.status === 'cancelado') return false;
              const dep = new Date(s.departureDateTime).getTime();
              const ret = new Date(s.returnDateTime).getTime();
              return (dep <= dayEnd) && (ret >= dayStart);
            });
            const isToday = new Date().getDate() === cell.day && new Date().getMonth() === cell.month && new Date().getFullYear() === cell.year;

            // Dynamic classes for better aesthetics
            let cellBgClass = 'bg-white hover:bg-slate-50';
            if (isHoliday) cellBgClass = 'bg-rose-50/70 hover:bg-rose-100/60';
            else if (isWeekend) cellBgClass = 'bg-indigo-50/30 hover:bg-indigo-50/60';

            return (
              <div key={idx} className={`group relative min-h-0 flex flex-col p-3 transition-all duration-300 cursor-pointer ${cellBgClass} hover:scale-[1.03] hover:shadow-xl hover:z-20 hover:rounded-xl border border-transparent hover:border-indigo-200/50`} onClick={() => setSelectedDay(new Date(cell.year, cell.month, cell.day))}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-black w-8 h-8 flex items-center justify-center rounded-full transition-all ${isToday ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 scale-110' : isHoliday ? 'text-rose-600 bg-rose-100' : isWeekend ? 'text-indigo-900 bg-indigo-100/50' : 'text-slate-700 bg-slate-100'}`}>{cell.day}</span>
                  {isHoliday && <span title={holidayName} className="text-rose-500 bg-white rounded-full p-1 shadow-sm"><Gift className="w-3.5 h-3.5" /></span>}
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-1.5 pr-1 pb-2">
                  {daySchedules.slice(0, 3).map(s => {
                    const v = vehicles.find(veh => veh.id === s.vehicleId);
                    const cfg = STATUS_MAP[s.status];
                    return (
                      <div key={s.id} className={`w-full text-left p-1.5 rounded-lg border flex flex-col gap-0.5 shadow-sm transition-all bg-${cfg.color}-50 border-${cfg.color}-200 text-${cfg.color}-900`}>
                        <span className="text-[9px] font-black uppercase truncate leading-none">{v?.model || 'Veículo'}</span>
                        <span className="text-[7px] font-mono font-bold opacity-60 leading-none truncate">{new Date(s.departureDateTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    );
                  })}
                  {daySchedules.length > 3 && <div className="text-[8px] font-black text-slate-400 text-center uppercase tracking-widest">+ {daySchedules.length - 3} itens</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden font-sans h-full bg-slate-50">
      {activeSubView === 'menu' && renderDashboard()}
      {activeSubView === 'calendar' && renderCalendar()}
      {activeSubView === 'history' && (
        <VehicleScheduleHistory
          schedules={schedules}
          vehicles={vehicles}
          persons={persons}
          sectors={sectors}
          state={state}
          onViewDetails={(s) => { setViewingSchedule(s); setIsViewModalOpen(true); }}
          onEdit={(s) => handleOpenModal(s)}
          onUpdateStatus={onUpdateStatusSchedule}
          onUpdateSchedule={onUpdateSchedule}
          onDelete={onDeleteSchedule}
          onBack={() => handleSubViewChange('menu')}
          currentUserId={currentUserId}
          userRole={currentUserRole}
        />
      )}
      {activeSubView === 'approvals' && canViewApprovals && (
        <VehicleScheduleApprovals
          schedules={schedules}
          vehicles={vehicles}
          persons={persons}
          sectors={sectors}
          onApprove={(s) => onUpdateStatusSchedule(s.id, 'confirmado')}
          onReject={(s) => onUpdateStatusSchedule(s.id, 'cancelado', { reason: 'Rejeitado por Gestor', cancelledBy: currentUserName || 'Gestor' })}
          onBack={() => handleSubViewChange('menu')}
          currentUserId={currentUserId}
          currentUserPersonId={currentUserPersonId}
          currentUserRole={currentUserRole}
          state={state}
        />
      )}
      {activeSubView === 'dashboard' && (
        <VehicleScheduleDashboard
          schedules={schedules}
          vehicles={vehicles}
          persons={persons}
          sectors={sectors}
          onBack={() => handleSubViewChange('menu')}
        />
      )}
      {selectedDay && createPortal(
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/60 backdrop-blur-xl animate-fade-in overflow-hidden">
          <div className="bg-white sm:rounded-[3.5rem] rounded-t-[3.5rem] shadow-2xl w-full max-w-6xl overflow-hidden flex flex-col animate-slide-up h-full sm:h-[90vh] max-h-[96vh] border border-white/20">
            <div className="px-10 py-8 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 bg-slate-900 text-white rounded-[1.5rem] flex flex-col items-center justify-center shadow-2xl"><span className="text-[10px] font-black uppercase leading-none mb-1 opacity-60">{selectedDay.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</span><span className="text-2xl font-black leading-none">{selectedDay.getDate()}</span></div>
                <div><h3 className="text-3xl font-black text-slate-900 uppercase tracking-tight leading-none">{selectedDay.toLocaleDateString('pt-BR', { weekday: 'long' })}</h3><p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-2 flex items-center gap-2">Monitoramento de Frota <ChevronRightIcon className="w-3 h-3" /> {selectedDay.toLocaleDateString('pt-BR')}</p></div>
              </div>
              <div className="flex items-center gap-3">
                {!isDateBeforeToday(selectedDay) && (<button onClick={() => handleOpenModal(undefined, new Date(new Date(selectedDay).setHours(new Date().getHours() + 1, 0, 0, 0)))} className="px-6 py-3 bg-indigo-600 text-white font-black rounded-2xl shadow-lg shadow-indigo-600/20 flex items-center gap-3 uppercase text-[10px] tracking-[0.2em] hover:bg-indigo-700 transition-all active:scale-95"><Plus className="w-4 h-4" /> Novo Agendamento</button>)}
                <button onClick={() => setSelectedDay(null)} className="p-4 bg-slate-50 hover:bg-rose-50 rounded-2xl text-slate-400 hover:text-rose-600 transition-all active:scale-90 border border-slate-100"><X className="w-8 h-8" /></button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden bg-slate-50/30 flex flex-col md:flex-row">
              <div className="flex-1 flex flex-col border-r border-slate-100 overflow-hidden">
                <div className="px-10 py-5 bg-white border-b border-slate-50 flex items-center gap-3 shrink-0"><Navigation className="w-4 h-4 text-indigo-600" /><span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Atividades no Período</span></div>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-10">
                  <div className="space-y-4">
                    {(() => {
                      const dayStart = new Date(selectedDay).setHours(0, 0, 0, 0);
                      const dayEnd = new Date(selectedDay).setHours(23, 59, 59, 999);
                      const daySchedules = schedules.filter(s => {
                        const dep = new Date(s.departureDateTime).getTime();
                        const ret = new Date(s.returnDateTime).getTime();
                        return (dep <= dayEnd) && (ret >= dayStart) && s.status !== 'cancelado';
                      }).sort((a, b) => a.departureDateTime.localeCompare(b.departureDateTime));
                      const dayKey = `${String(selectedDay.getDate()).padStart(2, '0')}-${String(selectedDay.getMonth() + 1).padStart(2, '0')}`;
                      const holiday = HOLIDAYS[dayKey];
                      if (daySchedules.length === 0 && !holiday) return (<div className="py-20 flex flex-col items-center justify-center text-center space-y-4 bg-white rounded-[2.5rem] border-2 border-dashed border-slate-200"><div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-200"><Calendar className="w-8 h-8" /></div><p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Nenhuma saída registrada para este dia.</p></div>);
                      return (<>{holiday && (<div className="bg-rose-50 border border-rose-100 p-6 rounded-[2.5rem] flex items-center gap-5 mb-4 animate-fade-in shadow-sm"><div className="w-12 h-12 bg-rose-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-rose-600/20 rotate-3"><Gift className="w-6 h-6" /></div><div><span className="text-[9px] font-black text-rose-400 uppercase tracking-widest leading-none">Feriado Nacional</span><h4 className="text-lg font-black text-rose-900 leading-tight uppercase mt-0.5">{holiday}</h4></div></div>)}{daySchedules.map(s => { const v = vehicles.find(veh => veh.id === s.vehicleId); const d = persons.find(p => p.id === s.driverId); const sec = sectors.find(sec => sec.id === s.serviceSectorId); const cfg = STATUS_MAP[s.status]; const vehicleSector = sectors.find(sec => sec.id === v?.sectorId)?.name || 'Sem Setor'; const depDate = new Date(s.departureDateTime); const retDate = new Date(s.returnDateTime); const formatDT = (dt: Date) => dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' + dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); return (<div key={s.id} className="bg-white p-5 rounded-[2.5rem] border border-slate-200 flex flex-col gap-4 hover:shadow-xl transition-all group shadow-sm border-l-[6px]" style={{ borderLeftColor: `var(--tw-color-${cfg.color}-500)` }}><div className="flex justify-between items-center"><div className="flex items-center gap-4 min-w-0"><div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform bg-${cfg.color}-50 text-${cfg.color}-600`}><Car className="w-6 h-6" /></div><div className="min-w-0 flex flex-col gap-1 items-start"><div className="flex items-center gap-2"><h4 className="text-lg font-black text-slate-900 uppercase tracking-tight truncate leading-none">{v?.model || 'Desconhecido'} <span className="text-slate-400 text-[10px] font-bold ml-1">{v?.brand}</span></h4><div className="px-2 py-0.5 rounded-lg bg-indigo-600 text-white text-[9px] font-black uppercase tracking-widest shadow-sm">ID: {s.protocol}</div>{v?.sectorId && (<span className="text-[9px] font-black text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded align-middle">{vehicleSector}</span>)}</div><div className="flex items-center gap-2"><span className="font-mono text-[9px] font-bold text-white bg-slate-900 px-2 py-0.5 rounded-md tracking-wider">{v?.plate || '---'}</span><span className="text-[8px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><Clock className="w-2.5 h-2.5" /> Criado em: {new Date(s.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</span></div></div></div><div className="flex items-center gap-1"><button onClick={() => { setViewingSchedule(s); setIsViewModalOpen(true); }} className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"><Eye className="w-4.5 h-4.5" /></button>{s.requesterId === currentUserId && (<button onClick={() => handleOpenModal(s)} className="p-2.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"><Edit3 className="w-4.5 h-4.5" /></button>)}</div></div><div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center"><div className="md:col-span-3"><div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-[9px] font-black uppercase tracking-widest bg-${cfg.color}-50 text-${cfg.color}-700 border-${cfg.color}-200/50`}><cfg.icon className="w-3.5 h-3.5" /> {cfg.label}</div></div><div className="md:col-span-4 flex items-center gap-2 min-w-0"><UserIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" /><div className="flex flex-col min-w-0"><span className="text-[7px] font-black text-slate-400 uppercase leading-none mb-0.5">Condutor Responsável</span><span className="text-xs font-bold text-slate-600 truncate">{d?.name || '---'}</span></div></div><div className="md:col-span-5 flex items-center gap-2 min-w-0"><MapPin className="w-3.5 h-3.5 text-indigo-500 shrink-0" /><div className="flex flex-col min-w-0"><span className="text-[7px] font-black text-slate-400 uppercase leading-none mb-0.5">Destino da Viagem</span><span className="text-xs font-black text-indigo-600 uppercase truncate" title={s.destination}>{s.destination}</span></div></div></div><div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-3 border-t border-slate-50 items-center"><div className="md:col-span-8 flex items-center gap-2"><Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" /><div className="flex items-center gap-4"><div className="flex flex-col"><span className="text-[7px] font-black text-slate-400 uppercase leading-none mb-1">Saída</span><span className="bg-slate-50 px-2 py-1 rounded border border-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-tighter">{formatDT(depDate)}</span></div><ArrowRight className="w-3 h-3 text-slate-300 mt-2" /><div className="flex flex-col"><span className="text-[7px] font-black text-slate-400 uppercase leading-none mb-1">Retorno</span><span className="bg-slate-50 px-2 py-1 rounded border border-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-tighter">{formatDT(retDate)}</span></div></div></div><div className="md:col-span-4 flex items-center justify-end min-w-0"><div className="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100 w-full md:w-auto"><div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0"><Building2 className="w-4 h-4 text-indigo-600" /></div><div className="flex flex-col min-w-0"><span className="text-[7px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5">Setor Atendido</span><span className="text-[10px] font-bold text-slate-800 uppercase leading-tight truncate">{sec?.name || 'Não informado'}</span></div></div></div></div></div>); })} </>);
                    })()}
                  </div>
                </div>
              </div>
              <div className="w-full md:w-96 flex flex-col overflow-hidden bg-slate-50/50">
                <div className="px-8 py-5 bg-white border-b border-slate-100 flex items-center gap-3 shrink-0"><Activity className="w-4 h-4 text-emerald-600" /><span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Veículos Livres no Dia</span></div>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                  {!isDateBeforeToday(selectedDay) ? (
                    <div className="space-y-6">
                      {(() => {
                        const dStart = new Date(selectedDay).setHours(0, 0, 0, 0);
                        const dEnd = new Date(selectedDay).setHours(23, 59, 59, 999);
                        const schedulableVehicles = vehicles.filter(v => v.status === 'operacional' && v.availableForScheduling === 'Sim');
                        const available: Vehicle[] = [];
                        const occupied: { vehicle: Vehicle, schedule: VehicleSchedule }[] = [];
                        schedulableVehicles.forEach(v => {
                          const occupyingSchedule = schedules.find(s => {
                            if (s.vehicleId !== v.id || (s.status !== 'confirmado' && s.status !== 'em_curso')) return false;
                            const sStart = new Date(s.departureDateTime).getTime();
                            const sEnd = new Date(s.returnDateTime).getTime();
                            return (sStart <= dEnd) && (sEnd >= dStart);
                          });
                          if (occupyingSchedule) occupied.push({ vehicle: v, schedule: occupyingSchedule });
                          else available.push(v);
                        });
                        if (available.length === 0 && occupied.length === 0) return (<div className="text-center py-10"><Info className="w-8 h-8 text-slate-300 mx-auto mb-2" /><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nenhum veículo operacional disponível</p></div>);
                        return (<>{available.length > 0 && (<div className="space-y-3"><div className="flex items-center gap-2 mb-2 ml-1"><div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div><span className="text-[9px] font-black text-blue-600 uppercase tracking-widest">Disponíveis</span></div>{available.map(v => { const vSector = sectors.find(s => s.id === v.sectorId)?.name || 'Sem Setor'; return (<button key={v.id} onClick={() => handleOpenModal(undefined, new Date(new Date(selectedDay!).setHours(new Date().getHours() + 1, 0, 0, 0)), v.id)} className="w-full bg-blue-50/50 p-4 rounded-2xl border border-blue-100 hover:border-blue-400 hover:shadow-md transition-all flex items-center justify-between group text-left shadow-sm"><div className="flex items-center gap-4 min-w-0"><div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition-all shrink-0 shadow-sm"><Car className="w-5 h-5" /></div><div className="min-w-0"><span className="text-xs font-black text-blue-900 uppercase block truncate leading-tight">{v.brand} {v.model}</span><div className="flex items-center gap-2 mt-0.5"><span className="text-[8px] font-mono font-bold text-blue-600 bg-white px-1.5 py-0.5 rounded border border-blue-100 tracking-wider uppercase">{v.plate}</span><span className="text-[9px] text-blue-400 font-bold uppercase">{vSector}</span></div></div></div><div className="p-2 text-blue-200 group-hover:text-blue-600 transition-colors"><Plus className="w-4 h-4" /></div></button>); })} </div>)}{occupied.length > 0 && (<div className="space-y-3 pt-4"><div className="flex items-center gap-2 mb-2 ml-1"><div className="w-2 h-2 rounded-full bg-orange-500"></div><span className="text-[9px] font-black text-orange-600 uppercase tracking-widest">Ocupados no Período</span></div>{occupied.map(({ vehicle, schedule }) => { const vSector = sectors.find(s => s.id === vehicle.sectorId)?.name || 'Sem Setor'; return (<div key={vehicle.id} className="w-full bg-orange-50/50 p-4 rounded-2xl border border-orange-200 flex items-center justify-between group shadow-sm"><div className="flex items-center gap-4 min-w-0"><div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-orange-400 shrink-0 shadow-sm"><Navigation className="w-5 h-5" /></div><div className="min-w-0"><div className="flex items-center gap-2"><span className="text-xs font-black text-orange-900 uppercase truncate leading-tight">{vehicle.brand} {vehicle.model}</span></div><div className="flex items-center gap-2 mt-0.5"><span className="text-[8px] font-mono font-bold text-orange-600 bg-white px-1.5 py-0.5 rounded border border-orange-100 tracking-wider uppercase">{vehicle.plate}</span><span className="text-[9px] text-orange-400 font-bold uppercase truncate flex items-center gap-1 max-w-[100px]"><MapPin className="w-2 h-2 shrink-0" /> {schedule.destination}</span></div><div className="text-[8px] font-black text-orange-300 uppercase mt-1">Lotação: {vSector}</div></div></div><div className="shrink-0 ml-2"><div className="w-6 h-6 bg-white border border-orange-100 rounded-lg flex items-center justify-center text-orange-200 shadow-sm"><Lock className="w-3 h-3" /></div></div></div>); })} </div>)}</>);
                      })()}
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-6 bg-rose-50/50 m-4 rounded-[2.5rem] border border-rose-100/50">
                      <div className="w-20 h-20 bg-rose-100 rounded-2xl flex items-center justify-center text-rose-500 shadow-xl shadow-rose-500/10 rotate-3">
                        <AlertCircle className="w-10 h-10" />
                      </div>
                      <div className="max-w-xs mx-auto">
                        <h3 className="text-lg font-black text-rose-900 uppercase tracking-tight mb-2">Data Passada</h3>
                        <p className="text-xs font-bold text-rose-600/80 leading-relaxed uppercase tracking-wide">
                          Não é permitido realizar agendamentos em períodos retroativos.
                        </p>
                        <div className="mt-4 px-4 py-2 bg-rose-100/50 rounded-xl border border-rose-200/50 inline-block">
                          <p className="text-[10px] font-black text-rose-700 uppercase tracking-widest">
                            Tente a partir de {new Date().toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {isModalOpen && createPortal(
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/80 backdrop-blur-xl animate-fade-in">
          <div className="bg-white sm:rounded-[3.5rem] rounded-t-[3.5rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] w-full max-w-5xl overflow-hidden flex flex-col animate-slide-up border border-white/20 h-full sm:h-auto max-h-[96vh]">
            <div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg rotate-[-4deg] shrink-0"><Calendar className="w-5 h-5" /></div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight leading-tight">{editingSchedule ? 'Editar Agendamento' : 'Novo Agendamento'}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none">O veículo ficará indisponível durante o intervalo se confirmado</p>
                    {editingSchedule?.status === 'confirmado' && (
                      <span className="flex items-center gap-1 text-[8px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 uppercase tracking-widest"><Lock className="w-2 h-2" /> Agendamento Confirmado: Edição Restrita</span>
                    )}
                  </div>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 bg-slate-50 hover:bg-rose-50 rounded-xl text-slate-400 hover:text-rose-600 transition-all"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-10 flex-1 overflow-y-auto custom-scrollbar bg-slate-50/30">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <label className={labelClass}><Car className="w-3 h-3 inline mr-2" /> Veículo Operacional</label>
                  <button
                    onClick={() => {
                      if (editingSchedule?.status === 'confirmado') {
                        showToast("Não é possível alterar o veículo de um agendamento já confirmado.", "warning");
                        return;
                      }
                      setActiveSelectionField('vehicle');
                    }}
                    className={`${inputClass} flex items-center justify-between transition-all text-left ${editingSchedule?.status === 'confirmado' ? 'bg-slate-50 cursor-not-allowed border-slate-200' : 'hover:bg-white'}`}
                  >
                    <span className={formData.vehicleId ? 'text-slate-900 font-bold' : 'text-slate-400'}>
                      {vehicles.find(v => v.id === formData.vehicleId)
                        ? `${vehicles.find(v => v.id === formData.vehicleId)?.brand} ${vehicles.find(v => v.id === formData.vehicleId)?.model} (${vehicles.find(v => v.id === formData.vehicleId)?.plate})`
                        : 'Selecione o veículo...'}
                    </span>
                    {editingSchedule?.status === 'confirmado' ? <Lock className="w-4 h-4 text-slate-300" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </button>
                </div>

                <div>
                  <label className={labelClass}><UserIcon className="w-3 h-3 inline mr-2" /> Motorista Responsável</label>
                  <button onClick={() => setActiveSelectionField('driver')} className={`${inputClass} flex items-center justify-between hover:bg-white transition-all text-left`}>
                    <span className={formData.driverId ? 'text-slate-900 font-bold' : 'text-slate-400'}>
                      {persons.find(p => p.id === formData.driverId)?.name || 'Selecione o motorista...'}
                    </span>
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  </button>
                </div>

                <div>
                  <label className={labelClass}><UserCircle className="w-3 h-3 inline mr-2 text-indigo-500" /> Solicitante (Requerente)</label>
                  <button
                    onClick={() => {
                      if (editingSchedule?.status === 'confirmado') {
                        showToast("Não é possível alterar o solicitante de um agendamento já confirmado.", "warning");
                        return;
                      }
                      setActiveSelectionField('requester');
                    }}
                    className={`${inputClass} flex items-center justify-between transition-all text-left ${editingSchedule?.status === 'confirmado' ? 'bg-slate-50 cursor-not-allowed border-slate-200' : 'hover:bg-white'}`}
                  >
                    <span className={formData.requesterPersonId ? 'text-slate-900 font-bold' : 'text-slate-400'}>
                      {persons.find(p => p.id === formData.requesterPersonId)?.name || 'Quem está solicitando?'}
                    </span>
                    {editingSchedule?.status === 'confirmado' ? <Lock className="w-4 h-4 text-slate-300" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </button>
                </div>

                <div>
                  <label className={labelClass}><Landmark className="w-3 h-3 inline mr-2 text-indigo-500" /> Setor de Atendimento</label>
                  <button
                    onClick={() => {
                      if (editingSchedule?.status === 'confirmado') {
                        showToast("Não é possível alterar o setor de um agendamento já confirmado.", "warning");
                        return;
                      }
                      setActiveSelectionField('sector');
                    }}
                    className={`${inputClass} flex items-center justify-between transition-all text-left ${editingSchedule?.status === 'confirmado' ? 'bg-slate-50 cursor-not-allowed border-slate-200' : 'hover:bg-white'}`}
                  >
                    <span className={formData.serviceSectorId ? 'text-slate-900 font-bold' : 'text-slate-400'}>
                      {sectors.find(s => s.id === formData.serviceSectorId)?.name || 'Qual setor será atendido?'}
                    </span>
                    {editingSchedule?.status === 'confirmado' ? <Lock className="w-4 h-4 text-slate-300" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </button>
                </div>

                <div className="md:col-span-2">
                  <label className={labelClass}><MapPin className="w-3 h-3 inline mr-2" /> Itinerário / Destino</label>
                  <button
                    onClick={() => {
                      if (editingSchedule?.status === 'confirmado') {
                        showToast("Não é possível alterar o destino de um agendamento já confirmado.", "warning");
                        return;
                      }
                      setActiveSelectionField('city');
                    }}
                    className={`${inputClass} flex items-center justify-between transition-all text-left ${editingSchedule?.status === 'confirmado' ? 'bg-slate-50 cursor-not-allowed border-slate-200' : 'hover:bg-white'}`}
                  >
                    <span className={formData.destination ? 'text-slate-900 font-bold' : 'text-slate-400'}>
                      {formData.destination || 'Selecione ou busque a cidade...'}
                    </span>
                    {editingSchedule?.status === 'confirmado' ? <Lock className="w-4 h-4 text-slate-300" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:col-span-2">

                  <div>
                    <label className={labelClass}><Clock className="w-3 h-3 inline mr-2" /> Início Agendamento</label>
                    <button
                      onClick={() => {
                        if (editingSchedule?.status === 'confirmado') {
                          showToast("Não é possível alterar a data/hora de um agendamento já confirmado.", "warning");
                          return;
                        }
                        setActiveDateField('departure');
                      }}
                      disabled={editingSchedule?.status === 'confirmado'}
                      className={`${inputClass} h-[52px] flex items-center justify-between transition-all text-left ${editingSchedule?.status === 'confirmado' ? 'bg-slate-50 cursor-not-allowed border-slate-200' : 'hover:bg-white'}`}
                    >
                      <span className={formData.departureDateTime ? 'text-slate-900 font-bold' : 'text-slate-400'}>
                        {formatDateDisplay(formData.departureDateTime)}
                      </span>
                      {editingSchedule?.status === 'confirmado' ? <Lock className="w-4 h-4 text-slate-300" /> : <Calendar className="w-4 h-4 text-slate-400" />}
                    </button>
                    {/* Input Hidden for compatibility if needed, but we rely on state */}
                  </div>
                  <div>
                    <label className={labelClass}><Clock className="w-3 h-3 inline mr-2" /> Fim Agendamento</label>
                    <button
                      onClick={() => {
                        if (editingSchedule?.status === 'confirmado') {
                          showToast("Não é possível alterar a data/hora de um agendamento já confirmado.", "warning");
                          return;
                        }
                        setActiveDateField('return');
                      }}
                      disabled={editingSchedule?.status === 'confirmado'}
                      className={`${inputClass} h-[52px] flex items-center justify-between transition-all text-left ${editingSchedule?.status === 'confirmado' ? 'bg-slate-50 cursor-not-allowed border-slate-200' : 'hover:bg-white'}`}
                    >
                      <span className={formData.returnDateTime ? 'text-slate-900 font-bold' : 'text-slate-400'}>
                        {formatDateDisplay(formData.returnDateTime)}
                      </span>
                      {editingSchedule?.status === 'confirmado' ? <Lock className="w-4 h-4 text-slate-300" /> : <Calendar className="w-4 h-4 text-slate-400" />}
                    </button>
                  </div>
                </div>
                <div className="md:col-span-2"><label className={labelClass}><Info className="w-3 h-3 inline mr-2" /> Objetivo da Viagem</label><textarea value={formData.purpose} onChange={e => setFormData({ ...formData, purpose: e.target.value })} readOnly={editingSchedule?.status === 'confirmado'} className={`${inputClass} min-h-[100px] resize-none pt-4 ${editingSchedule?.status === 'confirmado' ? 'bg-slate-50 cursor-not-allowed border-slate-200' : ''}`} placeholder="Descreva brevemente o motivo da saída..." /></div>

                <div className="md:col-span-2">
                  <label className={labelClass}><Users className="w-3 h-3 inline mr-2" /> Quantidade de Passageiros</label>
                  <button
                    onClick={() => {
                        if (editingSchedule?.status === 'confirmado') {
                          showToast("Não é possível alterar os passageiros de um agendamento já confirmado.", "warning");
                          return;
                        }
                        setIsPassengerModalOpen(true);
                      }}
                    className={`${inputClass} flex items-center justify-between transition-all text-left ${editingSchedule?.status === 'confirmado' ? 'bg-slate-50 cursor-not-allowed border-slate-200' : 'hover:bg-white'}`}
                  >
                    <span className={(formData.patientCount || formData.companionCount) ? 'text-slate-900 font-bold' : 'text-slate-400'}>
                      {((formData.patientCount || 0) + (formData.companionCount || 0) + 1)} Passageiros (Total c/ Motorista)
                    </span>
                    {editingSchedule?.status === 'confirmado' ? <Lock className="w-4 h-4 text-slate-300" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </button>
                </div>

                <div className="md:col-span-2 pt-4 border-t border-slate-100">
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600 mb-4 flex items-center gap-2">
                    <Users className="w-4 h-4" /> 
                    Informações da Tripulação / Passageiros
                    <span className="ml-2 text-[8px] bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded-full border border-rose-200">Obrigatório</span>
                  </label>

                  {editingSchedule?.status !== 'confirmado' && (
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mb-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <div className="md:col-span-3">
                        <input value={newPassenger.name} onChange={e => setNewPassenger({ ...newPassenger, name: e.target.value })} placeholder="Nome" className="w-full bg-white px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 focus:border-indigo-500 outline-none" />
                      </div>
                      <div className="md:col-span-3">
                        <input value={newPassenger.departureLocation} onChange={e => setNewPassenger({ ...newPassenger, departureLocation: e.target.value })} placeholder="Local de Partida" className="w-full bg-white px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 focus:border-indigo-500 outline-none" />
                      </div>
                      <div className="md:col-span-2">
                        <input value={newPassenger.appointmentTime} onChange={e => setNewPassenger({ ...newPassenger, appointmentTime: e.target.value })} type="time" className="w-full bg-white px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 focus:border-indigo-500 outline-none" />
                      </div>
                      <div className="md:col-span-3">
                        <input value={newPassenger.appointmentLocation} onChange={e => setNewPassenger({ ...newPassenger, appointmentLocation: e.target.value })} placeholder="Local do Compromisso" className="w-full bg-white px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 focus:border-indigo-500 outline-none" />
                      </div>
                      <div className="md:col-span-1 flex justify-end">
                        <button onClick={handleAddPassenger} className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-600/20"><Plus className="w-4 h-4" /></button>
                      </div>
                    </div>
                  )}

                  {formData.passengers && formData.passengers.length > 0 ? (
                    <div className="overflow-hidden rounded-2xl border border-slate-200">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100 text-[9px] font-black uppercase tracking-widest text-slate-400">
                            <th className="p-3 pl-4">Nome</th>
                            <th className="p-3">Local de Partida</th>
                            <th className="p-3">Horário do Compromisso</th>
                            <th className="p-3">Local do Compromisso</th>
                            {editingSchedule?.status !== 'confirmado' && <th className="p-3 w-10"></th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {formData.passengers.map((p, idx) => (
                            <tr key={idx} className="text-xs font-bold text-slate-600 bg-white hover:bg-slate-50/50">
                              <td className="p-3 pl-4">{p.name}</td>
                              <td className="p-3">{p.departureLocation}</td>
                              <td className="p-3 font-mono">{p.appointmentTime}</td>
                              <td className="p-3">{p.appointmentLocation}</td>
                              {editingSchedule?.status !== 'confirmado' && (
                                <td className="p-3 text-right pr-4">
                                  <button onClick={() => handleRemovePassenger(idx)} className="text-rose-400 hover:text-rose-600 transition-colors"><Trash2 className="w-4 h-4" /></button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-2xl">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nenhum passageiro adicionado</p>
                    </div>
                  )}
                </div>
                {editingSchedule && (
                  <div className="md:col-span-2 flex justify-end">
                    <button onClick={() => { if (confirm("Remover agendamento?")) { onDeleteSchedule(editingSchedule.id); setIsModalOpen(false); } }} className="py-3.5 px-6 bg-rose-50 text-rose-600 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-rose-600 hover:text-white transition-all active:scale-95 border border-rose-100 h-[52px] shrink-0"><Trash2 className="w-4 h-4" /> Excluir Registro</button>
                  </div>
                )}
              </div>
            </div>
            <div className="px-8 py-5 border-t border-slate-100 bg-white flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0">
              <button onClick={() => setIsModalOpen(false)} className="px-6 py-3 font-black text-slate-400 hover:text-rose-600 transition-all uppercase text-[10px] tracking-[0.2em]" disabled={isSaving}>Descartar</button>
              <button onClick={handleSave} disabled={isSaving} className="px-8 py-3 bg-slate-900 text-white font-black rounded-2xl hover:bg-indigo-600 shadow-xl flex items-center justify-center gap-3 transition-all uppercase text-[10px] tracking-[0.2em] active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed">
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {isSaving ? 'Processando...' : (editingSchedule ? 'Atualizar Dados' : 'Confirmar Agendamento')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {isPassengerModalOpen && createPortal(
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-sm overflow-hidden animate-slide-up border border-slate-100">
            <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Quantidade de Passageiros</h3>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1">Calcule a ocupação do veículo</p>
              </div>
              <button onClick={() => setIsPassengerModalOpen(false)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600 mb-2">
                  <Users className="w-3 h-3 inline mr-2" />
                  Pacientes
                </label>
                <input 
                  type="number" 
                  min="0"
                  value={formData.patientCount || 0}
                  onChange={(e) => setFormData({ ...formData, patientCount: parseInt(e.target.value) || 0 })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-black text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all text-center"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600 mb-2">
                  <UserCircle className="w-3 h-3 inline mr-2" />
                  Acompanhantes
                </label>
                <input 
                  type="number" 
                  min="0"
                  value={formData.companionCount || 0}
                  onChange={(e) => setFormData({ ...formData, companionCount: parseInt(e.target.value) || 0 })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-black text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all text-center"
                />
              </div>

              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex flex-col items-center justify-center">
                <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-1">Total Calculado</span>
                <div className="text-2xl font-black text-indigo-900">
                  {((formData.patientCount || 0) + (formData.companionCount || 0) + 1)} <span className="text-xs text-indigo-600 ml-1 opacity-70 uppercase tracking-widest">Pessoas</span>
                </div>
                <span className="text-[9px] font-bold text-indigo-400 mt-2 text-center">(Incluindo +1 Motorista Obrigatório)</span>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button 
                onClick={() => setIsPassengerModalOpen(false)}
                className="px-6 py-2.5 bg-indigo-600 text-white font-black rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-600/20 transition-all active:scale-95 text-[10px] uppercase tracking-widest"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* TOAST DE NOTIFICAÇÃO MODERNO (CENTRALIZADO NO TOPO - CORREÇÃO DE TAMANHO E TEXTO) */}
      {toast.show && createPortal(
        <div className="fixed top-10 left-0 right-0 z-[300] flex justify-center pointer-events-none px-6">
          <div className={`animate-slide-down pointer-events-auto p-5 rounded-[2.5rem] shadow-2xl border flex items-center gap-5 backdrop-blur-2xl transition-all duration-500 max-w-2xl w-fit
             ${toast.type === 'error' ? 'bg-rose-600/95 border-rose-500 text-white shadow-rose-500/30' :
              toast.type === 'success' ? 'bg-emerald-600/95 border-emerald-500 text-white shadow-emerald-500/30' :
                'bg-amber-500/95 border-amber-400 text-white shadow-amber-500/30'}
           `}>
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center shrink-0">
              {toast.type === 'error' ? <ShieldAlert className="w-7 h-7" /> :
                toast.type === 'success' ? <CheckCircle2 className="w-7 h-7" /> :
                  <AlertTriangle className="w-7 h-7" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] leading-none mb-1.5 opacity-80">{toast.type === 'error' ? 'Atenção Crítica' : toast.type === 'success' ? 'Operação Concluída' : 'Aviso do Sistema'}</p>
              <p className="text-sm sm:text-base font-bold leading-snug break-words">{toast.message}</p>
            </div>
            <button onClick={() => setToast(prev => ({ ...prev, show: false }))} className="ml-2 p-2.5 hover:bg-white/10 rounded-2xl transition-colors shrink-0 active:scale-90">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>,
        document.body
      )}

      {isViewModalOpen && viewingSchedule && createPortal(
        <div className="fixed inset-0 z-[210] flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/80 backdrop-blur-xl animate-fade-in h-full">
          <div className="bg-white sm:rounded-[2.5rem] rounded-t-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col animate-slide-up border border-white/20 h-full sm:h-auto max-h-[96vh]">
            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-4"><div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg"><FileText className="w-6 h-6" /></div><div><h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Detalhes da Viagem</h3><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Informações completas do agendamento</p></div></div>
              <button onClick={() => setIsViewModalOpen(false)} className="p-3 hover:bg-white rounded-xl text-slate-400"><X className="w-6 h-6" /></button>
            </div>
            <div className="p-8 space-y-8 flex-1 overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Veículo</p><p className="text-base font-bold text-slate-900 uppercase">{(vehicles.find(v => v.id === viewingSchedule.vehicleId))?.brand} {(vehicles.find(v => v.id === viewingSchedule.vehicleId))?.model} ({(vehicles.find(v => v.id === viewingSchedule.vehicleId))?.plate})</p></div>
                <div className="space-y-1"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Motorista</p><p className="text-base font-bold text-slate-900">{(persons.find(p => p.id === viewingSchedule.driverId))?.name}</p></div>
                <div className="space-y-1"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Setor</p><p className="text-base font-bold text-slate-900 uppercase">{(sectors.find(s => s.id === viewingSchedule.serviceSectorId))?.name || '---'}</p></div>
                <div className="space-y-1"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Solicitante</p><p className="text-base font-bold text-slate-900">{(persons.find(p => p.id === viewingSchedule.requesterPersonId))?.name || '---'}</p></div>
                <div className="col-span-2 space-y-1"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Localização de Retirada/Encontro</p><p className="text-base font-bold text-indigo-700 uppercase flex items-center gap-2"><MapPin className="w-4 h-4" />{viewingSchedule.vehicleLocation || 'Não especificada'}</p></div>
                <div className="col-span-2 space-y-1"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Destino</p><p className="text-base font-bold text-indigo-600 uppercase">{viewingSchedule.destination}</p></div>
                <div className="space-y-1"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Saída</p><p className="text-sm font-bold text-slate-700">{new Date(viewingSchedule.departureDateTime).toLocaleString('pt-BR')}</p></div>
                <div className="space-y-1"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Retorno</p><p className="text-sm font-bold text-slate-700">{new Date(viewingSchedule.returnDateTime).toLocaleString('pt-BR')}</p></div>
                <div className="col-span-2 space-y-1"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Objetivo</p><p className="text-sm font-medium text-slate-600 bg-slate-50 p-4 rounded-xl border border-slate-100 italic">"{viewingSchedule.purpose}"</p></div>

                {viewingSchedule.passengers && viewingSchedule.passengers.length > 0 && (
                  <div className="col-span-2 space-y-2 mt-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Users className="w-3 h-3" /> Tripulação / Passageiros</p>
                    <div className="overflow-hidden rounded-xl border border-slate-200">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100 text-[8px] font-black uppercase tracking-widest text-slate-400">
                            <th className="p-3 pl-4">Nome</th>
                            <th className="p-3">Local de Partida</th>
                            <th className="p-3">Horário do Compromisso</th>
                            <th className="p-3">Local do Compromisso</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {viewingSchedule.passengers.map((p, idx) => (
                            <tr key={idx} className="text-xs font-bold text-slate-600 bg-white">
                              <td className="p-3 pl-4">{p.name}</td>
                              <td className="p-3">{p.departureLocation}</td>
                              <td className="p-3 font-mono">{p.appointmentTime}</td>
                              <td className="p-3">{p.appointmentLocation}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="space-y-1"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</p><div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border mt-1 font-black text-[10px] uppercase tracking-widest bg-${STATUS_MAP[viewingSchedule.status].color}-50 text-${STATUS_MAP[viewingSchedule.status].color}-700 border-${STATUS_MAP[viewingSchedule.status].color}-200`}>{React.createElement(STATUS_MAP[viewingSchedule.status].icon, { className: "w-3 h-3" })}{STATUS_MAP[viewingSchedule.status].label}</div></div>
              </div>
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-center"><button onClick={() => setIsViewModalOpen(false)} className="px-12 py-3 bg-slate-900 text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-xl shadow-lg hover:bg-indigo-600 transition-all">Fechar Detalhes</button></div>
          </div>
        </div>,
        document.body
      )}

      {/* SELECTION MODALS */}
      <SelectionModal
        isOpen={activeSelectionField === 'vehicle'}
        onClose={() => setActiveSelectionField(null)}
        title="Selecionar Veículo"
        subtitle="Escolha um veículo disponível para a viagem"
        options={vehicles.filter(v =>
          v.status === 'operacional' &&
          v.availableForScheduling === 'Sim' &&
          isVehicleAvailable(v.id, formData.departureDateTime!, formData.returnDateTime!, editingSchedule?.id)
        )}
        getInternalId={(v) => v.id}
        searchPlaceholder="Buscar por modelo, placa ou marca..."
        filterFunction={(v, query) => {
          const lowerQuery = query.toLowerCase();
          return v.model.toLowerCase().includes(lowerQuery) || v.plate.toLowerCase().includes(lowerQuery) || v.brand.toLowerCase().includes(lowerQuery);
        }}
        onSelect={(v) => setFormData({ ...formData, vehicleId: v.id })}
        selectedItem={vehicles.find(v => v.id === formData.vehicleId)}
        renderItem={(v, isSelected) => {
          const vehicleSector = sectors.find(s => s.id === v.sectorId)?.name || 'Sem Setor';
          const isAvail = isVehicleAvailable(v.id, formData.departureDateTime!, formData.returnDateTime!, editingSchedule?.id);

          return (
            <div className={`p-4 flex items-center gap-4 ${!isAvail ? 'opacity-50 grayscale' : ''}`}>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${isSelected ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                <Car className="w-6 h-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-sm font-black uppercase ${isSelected ? 'text-indigo-900' : 'text-slate-900'}`}>{v.brand} {v.model}</span>
                  <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">{v.plate}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1"><Landmark className="w-3 h-3" /> {vehicleSector}</span>
                  {!isAvail && <span className="text-[9px] font-black text-rose-500 uppercase tracking-widest ml-auto">Ocupado</span>}
                </div>
              </div>
              {isSelected && <CheckCircle2 className="w-6 h-6 text-indigo-600 shrink-0" />}
            </div>
          );
        }}
      />

      <SelectionModal
        isOpen={activeSelectionField === 'driver'}
        onClose={() => setActiveSelectionField(null)}
        title="Selecionar Motorista"
        subtitle="Quem será o condutor responsável?"
        options={persons}
        getInternalId={(p) => p.id}
        searchPlaceholder="Buscar por nome..."
        filterFunction={(p, query) => p.name.toLowerCase().includes(query.toLowerCase())}
        onSelect={(p) => setFormData({ ...formData, driverId: p.id })}
        selectedItem={persons.find(p => p.id === formData.driverId)}
        renderItem={(p, isSelected) => (
          <div className="p-4 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isSelected ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
              <UserIcon className="w-5 h-5" />
            </div>
            <span className={`text-sm font-bold flex-1 ${isSelected ? 'text-indigo-900' : 'text-slate-700'}`}>{p.name}</span>
            {isSelected && <Check className="w-5 h-5 text-indigo-600 shrink-0" />}
          </div>
        )}
      />

      <SelectionModal
        isOpen={activeSelectionField === 'requester'}
        onClose={() => setActiveSelectionField(null)}
        title="Selecionar Solicitante"
        subtitle="Quem está requisitando o veículo?"
        options={persons}
        getInternalId={(p) => p.id}
        searchPlaceholder="Buscar por nome..."
        filterFunction={(p, query) => p.name.toLowerCase().includes(query.toLowerCase())}
        onSelect={(p) => setFormData({ ...formData, requesterPersonId: p.id })}
        selectedItem={persons.find(p => p.id === formData.requesterPersonId)}
        renderItem={(p, isSelected) => (
          <div className="p-4 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isSelected ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
              <UserCircle className="w-5 h-5" />
            </div>
            <span className={`text-sm font-bold flex-1 ${isSelected ? 'text-indigo-900' : 'text-slate-700'}`}>{p.name}</span>
            {isSelected && <Check className="w-5 h-5 text-indigo-600 shrink-0" />}
          </div>
        )}
      />

      <SelectionModal
        isOpen={activeSelectionField === 'sector'}
        onClose={() => setActiveSelectionField(null)}
        title="Setor de Atendimento"
        subtitle="Para qual setor é esta viagem?"
        options={sectors}
        getInternalId={(s) => s.id}
        searchPlaceholder="Buscar setor..."
        filterFunction={(s, query) => s.name.toLowerCase().includes(query.toLowerCase())}
        onSelect={(s) => setFormData({ ...formData, serviceSectorId: s.id })}
        selectedItem={sectors.find(s => s.id === formData.serviceSectorId)}
        renderItem={(s, isSelected) => (
          <div className="p-4 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isSelected ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
              <Landmark className="w-5 h-5" />
            </div>
            <span className={`text-sm font-bold flex-1 uppercase ${isSelected ? 'text-indigo-900' : 'text-slate-700'}`}>{s.name}</span>
            {isSelected && <Check className="w-5 h-5 text-indigo-600 shrink-0" />}
          </div>
        )}
      />


      <SelectionModal
        isOpen={activeSelectionField === 'city'}
        onClose={() => setActiveSelectionField(null)}
        title="Selecionar Destino"
        subtitle="Qual a cidade de destino?"
        options={cities}
        getInternalId={(c) => c}
        searchPlaceholder="Buscar cidade..."
        filterFunction={(c, query) => {
          const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
          return normalize(c).includes(normalize(query));
        }}
        initialFilter={(c) => c.endsWith(' - MG')} // Show only MG cities initially
        onSelect={(c) => setFormData({ ...formData, destination: c })}
        selectedItem={formData.destination}
        renderItem={(c, isSelected) => (
          <div className="p-4 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isSelected ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
              <MapPin className="w-5 h-5" />
            </div>
            <span className={`text-sm font-bold flex-1 ${isSelected ? 'text-indigo-900' : 'text-slate-700'}`}>{c}</span>
            {isSelected && <Check className="w-5 h-5 text-indigo-600 shrink-0" />}
          </div>
        )}
      />

      {/* DATE TIME PICKERS */}
      <DateTimePickerModal
        isOpen={activeDateField === 'departure'}
        onClose={() => setActiveDateField(null)}
        title="Início do Agendamento"
        initialDate={formData.departureDateTime ? new Date(formData.departureDateTime) : undefined}
        minDate={new Date()}
        onSelect={(date) => setFormData({ ...formData, departureDateTime: getLocalISOString(date) })}
        shouldDisableDate={isDateBlocked}
      />

      <DateTimePickerModal
        isOpen={activeDateField === 'return'}
        onClose={() => setActiveDateField(null)}
        title="Fim do Agendamento"
        initialDate={formData.returnDateTime ? new Date(formData.returnDateTime) : (formData.departureDateTime ? new Date(formData.departureDateTime) : undefined)}
        minDate={formData.departureDateTime ? new Date(formData.departureDateTime) : new Date()}
        maxDate={(() => {
          if (!formData.vehicleId || !formData.departureDateTime) return undefined;
          const start = new Date(formData.departureDateTime).getTime();

          // Find the next confirmed schedule that starts AFTER our start time
          const nextSchedule = schedules
            .filter(s => {
              if (s.vehicleId !== formData.vehicleId) return false;
              if (s.status !== 'confirmado' && s.status !== 'em_curso') return false;
              if (s.id === editingSchedule?.id) return false;
              return new Date(s.departureDateTime).getTime() > start;
            })
            .sort((a, b) => new Date(a.departureDateTime).getTime() - new Date(b.departureDateTime).getTime())[0];

          return nextSchedule ? new Date(nextSchedule.departureDateTime) : undefined;
        })()}
        onSelect={(date) => setFormData({ ...formData, returnDateTime: getLocalISOString(date) })}
        shouldDisableDate={isDateBlocked}
      />
    </div>
  );
};

const ShieldAlert = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" /><path d="M12 8v4" /><path d="M12 16h.01" /></svg>
);