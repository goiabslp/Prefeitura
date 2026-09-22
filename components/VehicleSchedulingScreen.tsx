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
import { ConsultarVeiculoScreen } from './vehicle/ConsultarVeiculoScreen';
import { useSystemSettings } from '../contexts/SystemSettingsContext';
import { userCanAccessSubmodule } from '../services/permissionService';
import { User } from '../types';

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
  currentUserSectorId?: string;
  requestedView?: 'menu' | 'calendar' | 'novo' | 'history' | 'approvals' | 'dashboard' | 'day' | 'consultar';
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

const getScheduleStyles = (status: ScheduleStatus) => {
  switch (status) {
    case 'confirmado':
      return {
        cardBg: 'bg-emerald-50/90 border-emerald-200 text-emerald-950 hover:bg-emerald-100 hover:border-emerald-400 shadow-emerald-500/5',
        badgeBg: 'bg-emerald-600 text-white',
        iconBg: 'bg-emerald-500 text-white shadow-emerald-500/30',
        labelColor: 'text-emerald-700',
        timeColor: 'text-emerald-900',
        dot: 'bg-emerald-500'
      };
    case 'em_curso':
      return {
        cardBg: 'bg-blue-50/90 border-blue-200 text-blue-950 hover:bg-blue-100 hover:border-blue-400 shadow-blue-500/5',
        badgeBg: 'bg-blue-600 text-white',
        iconBg: 'bg-blue-600 text-white shadow-blue-500/30 animate-pulse',
        labelColor: 'text-blue-700',
        timeColor: 'text-blue-900',
        dot: 'bg-blue-500 animate-ping'
      };
    case 'pendente':
      return {
        cardBg: 'bg-amber-50/90 border-amber-200 text-amber-950 hover:bg-amber-100 hover:border-amber-400 shadow-amber-500/5',
        badgeBg: 'bg-amber-500 text-white',
        iconBg: 'bg-amber-500 text-white shadow-amber-500/30',
        labelColor: 'text-amber-700',
        timeColor: 'text-amber-900',
        dot: 'bg-amber-500 animate-pulse'
      };
    case 'concluido':
      return {
        cardBg: 'bg-slate-100/90 border-slate-200 text-slate-900 hover:bg-slate-200 hover:border-slate-300',
        badgeBg: 'bg-slate-600 text-white',
        iconBg: 'bg-slate-600 text-white',
        labelColor: 'text-slate-600',
        timeColor: 'text-slate-800',
        dot: 'bg-slate-400'
      };
    case 'cancelado':
      return {
        cardBg: 'bg-rose-50/90 border-rose-200 text-rose-950 hover:bg-rose-100 hover:border-rose-300',
        badgeBg: 'bg-rose-500 text-white',
        iconBg: 'bg-rose-500 text-white',
        labelColor: 'text-rose-700',
        timeColor: 'text-rose-900',
        dot: 'bg-rose-500'
      };
    default:
      return {
        cardBg: 'bg-indigo-50/90 border-indigo-200 text-indigo-950 hover:bg-indigo-100',
        badgeBg: 'bg-indigo-600 text-white',
        iconBg: 'bg-indigo-600 text-white',
        labelColor: 'text-indigo-700',
        timeColor: 'text-indigo-900',
        dot: 'bg-indigo-500'
      };
  }
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
  currentUserSectorId,
  requestedView,
  onNavigate,
  state
}) => {
  const [activeSubView, setActiveSubView] = useState<'menu' | 'calendar' | 'novo' | 'history' | 'approvals' | 'dashboard' | 'day' | 'consultar'>('menu');

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

  const { moduleStatus, mobileModuleStatus } = useSystemSettings();
  const [isMobileViewport, setIsMobileViewport] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);

  useEffect(() => {
    const handleResize = () => setIsMobileViewport(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isModuleActive = (key: string) => {
    if (isMobileViewport) {
      return mobileModuleStatus[key] !== false;
    }
    return moduleStatus[key] !== false;
  };

  const isAgendarActive = isModuleActive('sub_agendamento_agendar') || isModuleActive('parent_agendamento_veiculo_agendar');
  const isMeusActive = isModuleActive('sub_agendamento_historico') || isModuleActive('parent_agendamento_veiculo_meus');
  const isAprovacoesActive = isModuleActive('sub_agendamento_aprovacoes') || isModuleActive('parent_agendamento_veiculo_aprovacoes');
  const isDashboardActive = isModuleActive('sub_agendamento_dashboard') || isModuleActive('parent_agendamento_veiculo_dashboard');

  const userObj = useMemo(() => ({
    id: currentUserId,
    name: currentUserName || '',
    username: currentUserName || '',
    role: currentUserRole,
    permissions: currentUserPermissions
  } as User), [currentUserId, currentUserName, currentUserRole, currentUserPermissions]);

  const activeGlobalStatus = isMobileViewport ? mobileModuleStatus : moduleStatus;

  const canAccessAgendar = userCanAccessSubmodule(userObj, 'parent_agendamento_veiculo', 'sub_agendamento_agendar', activeGlobalStatus);
  const canAccessMeus = userCanAccessSubmodule(userObj, 'parent_agendamento_veiculo', 'sub_agendamento_historico', activeGlobalStatus);
  const canAccessAprovacoes = userCanAccessSubmodule(userObj, 'parent_agendamento_veiculo', 'sub_agendamento_aprovacoes', activeGlobalStatus);
  const canAccessDashboard = userCanAccessSubmodule(userObj, 'parent_agendamento_veiculo', 'sub_agendamento_dashboard', activeGlobalStatus);
  const canAccessConsultar = userCanAccessSubmodule(userObj, 'parent_agendamento_veiculo', 'sub_agendamento_consultar', activeGlobalStatus);


  useEffect(() => {
    if (requestedView && requestedView !== activeSubView) {
      setActiveSubView(requestedView);
    }
  }, [requestedView]);

  useEffect(() => {
    if (activeSubView === 'day') {
      const params = new URLSearchParams(window.location.search);
      const dateStr = params.get('date');
      if (dateStr) {
        const [year, month, day] = dateStr.split('-').map(Number);
        setSelectedDay(new Date(year, month - 1, day));
      } else if (!selectedDay) {
        setSelectedDay(new Date());
      }
    } else {
      setSelectedDay(null);
    }
  }, [activeSubView]);

  const handleSubViewChange = (view: 'menu' | 'calendar' | 'novo' | 'history' | 'approvals' | 'dashboard' | 'day' | 'consultar') => {
    setActiveSubView(view);
    if (onNavigate) {
      const paths = {
        'menu': '/AgendamentoVeiculos',
        'calendar': '/AgendamentoVeiculos/Agendar',
        'novo': '/AgendamentoVeiculos/Agendar/Novo',
        'day': '/AgendamentoVeiculos/Agendar',
        'history': '/AgendamentoVeiculos/Historico',
        'approvals': '/AgendamentoVeiculos/Aprovacoes',
        'dashboard': '/AgendamentoVeiculos/Dashboard',
        'consultar': '/AgendamentoVeiculos/Consultar'
      };
      onNavigate(paths[view]);
    }
  };
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date>(new Date());
  const [calendarViewMode, setCalendarViewMode] = useState<'day' | 'month'>(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      return 'day';
    }
    return 'day';
  });
  const daysBarRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (daysBarRef.current) {
      const activeEl = daysBarRef.current.querySelector('[data-selected="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }
  }, [selectedCalendarDate, currentDate, calendarViewMode]);

  const handleGoToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedCalendarDate(today);
  };

  const handlePrevMonth = () => {
    const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    setCurrentDate(newDate);
    const today = new Date();
    if (newDate.getFullYear() === today.getFullYear() && newDate.getMonth() === today.getMonth()) {
      setSelectedCalendarDate(today);
    } else {
      setSelectedCalendarDate(newDate);
    }
  };

  const handleNextMonth = () => {
    const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
    setCurrentDate(newDate);
    const today = new Date();
    if (newDate.getFullYear() === today.getFullYear() && newDate.getMonth() === today.getMonth()) {
      setSelectedCalendarDate(today);
    } else {
      setSelectedCalendarDate(newDate);
    }
  };

  const handlePrevDay = () => {
    const prev = new Date(selectedCalendarDate);
    prev.setDate(prev.getDate() - 1);
    setSelectedCalendarDate(prev);
    if (prev.getMonth() !== currentDate.getMonth() || prev.getFullYear() !== currentDate.getFullYear()) {
      setCurrentDate(new Date(prev.getFullYear(), prev.getMonth(), 1));
    }
  };

  const handleNextDay = () => {
    const next = new Date(selectedCalendarDate);
    next.setDate(next.getDate() + 1);
    setSelectedCalendarDate(next);
    if (next.getMonth() !== currentDate.getMonth() || next.getFullYear() !== currentDate.getFullYear()) {
      setCurrentDate(new Date(next.getFullYear(), next.getMonth(), 1));
    }
  };

  const handleSelectDay = (dayDate: Date) => {
    setSelectedCalendarDate(dayDate);
    if (dayDate.getMonth() !== currentDate.getMonth() || dayDate.getFullYear() !== currentDate.getFullYear()) {
      setCurrentDate(new Date(dayDate.getFullYear(), dayDate.getMonth(), 1));
    }
  };

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPassengerModalOpen, setIsPassengerModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<VehicleSchedule | null>(null);
  const [viewingSchedule, setViewingSchedule] = useState<VehicleSchedule | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [modalActiveTab, setModalActiveTab] = useState<'dados_gerais' | 'destino' | 'data' | 'objetivo' | 'tripulacao'>('dados_gerais');

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
    const oneHour = 60 * 60 * 1000;

    return !schedules.some(s => {
      if (s.id === excludeScheduleId) return false;
      if (s.vehicleId !== vehicleId) return false;
      if (s.status !== 'confirmado' && s.status !== 'em_curso') return false;

      const sStart = new Date(s.departureDateTime).getTime();
      const sEnd = new Date(s.returnDateTime).getTime();

      // Há conflito se o intervalo da nova viagem colidir com a existente considerando 1 hora de margem
      return (startTime < sEnd + oneHour) && (endTime > sStart - oneHour);
    });
  };

  const isDateBlocked = (date: Date) => {
    return false; // Permite múltiplos agendamentos no mesmo dia. A validação de colisão específica é feita por horário.
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

  const monthDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const list = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(year, month, d);
      const dayKey = `${String(d).padStart(2, '0')}-${String(month + 1).padStart(2, '0')}`;
      const holidayName = HOLIDAYS[dayKey];
      const isToday = new Date().getDate() === d && new Date().getMonth() === month && new Date().getFullYear() === year;
      const isSelected = selectedCalendarDate.getDate() === d && selectedCalendarDate.getMonth() === month && selectedCalendarDate.getFullYear() === year;
      
      const dayStart = new Date(year, month, d, 0, 0, 0).getTime();
      const dayEnd = new Date(year, month, d, 23, 59, 59).getTime();
      const daySchedules = schedules.filter(s => {
        if (s.status === 'cancelado') return false;
        const dep = new Date(s.departureDateTime).getTime();
        const ret = new Date(s.returnDateTime).getTime();
        return (dep <= dayEnd) && (ret >= dayStart);
      });

      const weekdayShort = dateObj.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '').slice(0, 3).toUpperCase();

      list.push({
        day: d,
        dateObj,
        weekdayShort,
        holidayName,
        isToday,
        isSelected,
        schedulesCount: daySchedules.length,
        isPast: isDateBeforeToday(dateObj)
      });
    }
    return list;
  }, [currentDate, selectedCalendarDate, schedules]);

  const selectedDaySchedules = useMemo(() => {
    const start = new Date(selectedCalendarDate.getFullYear(), selectedCalendarDate.getMonth(), selectedCalendarDate.getDate(), 0, 0, 0).getTime();
    const end = new Date(selectedCalendarDate.getFullYear(), selectedCalendarDate.getMonth(), selectedCalendarDate.getDate(), 23, 59, 59).getTime();
    return schedules
      .filter(s => {
        if (s.status === 'cancelado') return false;
        const dep = new Date(s.departureDateTime).getTime();
        const ret = new Date(s.returnDateTime).getTime();
        return (dep <= end) && (ret >= start);
      })
      .sort((a, b) => a.departureDateTime.localeCompare(b.departureDateTime));
  }, [selectedCalendarDate, schedules]);

  const handleOpenModal = (s?: VehicleSchedule, initialDate?: Date, initialVehicleId?: string, initialReturnDate?: Date) => {
    setModalActiveTab('dados_gerais');
    if (s) {
      setEditingSchedule(s);
      let validSectorId = s.serviceSectorId;
      if (validSectorId && !sectors.some(sec => sec.id === validSectorId)) {
        const p = persons.find(per => per.id === s.requesterPersonId);
        if (p?.sectorId && sectors.some(sec => sec.id === p.sectorId)) {
          validSectorId = p.sectorId;
        } else {
          const v = vehicles.find(veh => veh.id === s.vehicleId);
          if (v?.sectorId && sectors.some(sec => sec.id === v.sectorId)) {
            validSectorId = v.sectorId;
          } else {
            validSectorId = '';
          }
        }
      }
      setFormData({ ...s, serviceSectorId: validSectorId });
    } else {
      setEditingSchedule(null);
      const now = new Date();
      let departure = initialDate ? new Date(initialDate) : now;
      if (departure < now) departure = now;
      if (!initialDate) departure.setMinutes(0, 0, 0);
      const returnDate = initialReturnDate ? new Date(initialReturnDate) : new Date(departure.getTime() + (4 * 60 * 60 * 1000));
      
      // Resolve setor inicial com validação
      let defaultSectorId = '';
      
      // 1. Tenta pelo sectorId da pessoa logada
      if (currentUserPerson?.sectorId && sectors.some(s => s.id === currentUserPerson.sectorId)) {
        defaultSectorId = currentUserPerson.sectorId;
      }
      
      // 2. Tenta pelo currentUserSectorId explicitamente recebido
      if (!defaultSectorId && currentUserSectorId && sectors.some(s => s.id === currentUserSectorId)) {
        defaultSectorId = currentUserSectorId;
      }

      // 3. Tenta pelo currentUserSector (que pode ser ID ou nome do setor)
      if (!defaultSectorId && currentUserSector) {
        const byId = sectors.find(s => s.id === currentUserSector);
        if (byId) {
          defaultSectorId = byId.id;
        } else {
          const searchSector = normalizeString(currentUserSector);
          const matchedSector = sectors.find(s =>
            normalizeString(s.name) === searchSector ||
            normalizeString(s.name).includes(searchSector) ||
            searchSector.includes(normalizeString(s.name))
          );
          if (matchedSector) defaultSectorId = matchedSector.id;
        }
      }

      // 4. Se ainda sem setor e um veículo inicial foi selecionado, usa o setor do veículo
      if (!defaultSectorId && initialVehicleId) {
        const v = vehicles.find(veh => veh.id === initialVehicleId);
        if (v?.sectorId && sectors.some(s => s.id === v.sectorId)) {
          defaultSectorId = v.sectorId;
        }
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
    const validSector = sectors.find(s => s.id === formData.serviceSectorId);
    if (!formData.vehicleId || !formData.driverId || !formData.departureDateTime || !formData.returnDateTime || !formData.destination || !formData.requesterPersonId || !formData.serviceSectorId || !validSector) {
      showToast("Preencha todos os campos obrigatórios, incluindo um Setor Solicitante válido.", "warning");
      return;
    }
    const totalPassengers = (formData.passengers?.length || 0) + 1; // 1 Motorista + passageiros inseridos
    const selectedVehicle = vehicles.find(v => v.id === formData.vehicleId);

    if (selectedVehicle && selectedVehicle.passengerCapacity !== undefined && totalPassengers > selectedVehicle.passengerCapacity) {
      showToast(`O total de passageiros (${totalPassengers}) excede a capacidade do veículo (${selectedVehicle.model} - ${selectedVehicle.passengerCapacity} lugares).`, "error");
      return;
    }

    if (!formData.passengers || formData.passengers.length === 0) {
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
          patientCount: formData.passengers?.length || 0,
          companionCount: 0,
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
          patientCount: formData.passengers?.length || 0,
          companionCount: 0,
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
        <div className="flex-1 w-full p-4 md:p-6 overflow-y-auto lg:overflow-hidden flex flex-col justify-center items-center">
          <div className="w-full max-h-full flex flex-col items-center justify-center container mx-auto">

            {/* Header */}
            <div className="flex flex-col items-center mb-5 md:mb-7 shrink-0 animation-delay-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="p-3 md:p-3.5 rounded-2xl bg-gradient-to-br from-indigo-50 to-indigo-100/50 mb-2.5 shadow-xs ring-4 ring-white/60">
                <Car className="w-8 h-8 md:w-9 md:h-9 text-indigo-600 drop-shadow-sm" />
              </div>
              <h2 className="text-2xl md:text-3xl lg:text-4xl font-black text-slate-800 tracking-tight text-center drop-shadow-sm">Gestão de Veículos</h2>
              <p className="text-slate-500 text-[10px] md:text-[11px] font-bold uppercase tracking-widest mt-1 text-center">Sistema Unificado de Agendamentos e Escalas</p>
            </div>

            {/* Actions Grid - Responsive & Auto-adjusting */}
            {(() => {
              const visibleCount = [
                canAccessConsultar,
                canAccessAgendar,
                canAccessMeus,
                canAccessAprovacoes,
                canAccessDashboard
              ].filter(Boolean).length;

              const gridClass = visibleCount >= 5
                ? "w-full grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 desktop:gap-4 max-w-6xl"
                : "w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 desktop:gap-4 max-w-5xl";

              return (
                <div className={`${gridClass} animate-in zoom-in duration-500 fill-mode-backwards p-1`}>

                  {/* Card: Consultar Veículo (Submódulo de Consulta Rápida) */}
                  {canAccessConsultar && (
                    <button
                      onClick={() => handleSubViewChange('consultar')}
                      className="group relative w-full min-h-[110px] md:min-h-[135px] py-4 md:py-5 px-3 md:px-4 rounded-[2rem] bg-gradient-to-br from-white to-slate-50/50 border border-slate-100 shadow-[0_10px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_25px_60px_rgb(0,0,0,0.12)] hover:shadow-violet-500/30 hover:border-violet-200 hover:from-white hover:to-violet-50/30 transition-all duration-300 ease-spring hover:-translate-y-1.5 active:scale-95 flex flex-col items-center justify-center overflow-hidden shrink-0"
                      style={{ animationDelay: '0ms' }}
                    >
                      <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/5 rounded-bl-[100%] -mr-10 -mt-10 transition-transform duration-700 ease-out group-hover:scale-150"></div>
                      <div className="absolute bottom-0 left-0 w-24 h-24 bg-violet-500/5 rounded-tr-[100%] -ml-10 -mb-10 transition-transform duration-700 ease-out group-hover:scale-125 opacity-0 group-hover:opacity-100"></div>

                      <div className="relative w-11 h-11 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center mb-2.5 text-white group-hover:scale-110 group-hover:rotate-6 transition-transform duration-300 shadow-md shadow-violet-500/30 ring-4 ring-white">
                        <Search className="w-5 h-5 md:w-6 md:h-6 drop-shadow-md" />
                      </div>

                      <h3 className="text-sm md:text-base lg:text-lg font-bold text-slate-800 mb-0.5 group-hover:text-slate-900 tracking-tight text-center">Consultar Veículo</h3>
                      <p className="text-[9px] md:text-[10px] font-bold text-slate-400 group-hover:text-violet-600 transition-colors uppercase tracking-wider text-center">Disponibilidade</p>
                    </button>
                  )}

                  {/* Card: Agendar Veículo */}
                  {canAccessAgendar && (
                    <button
                      onClick={() => handleSubViewChange('calendar')}
                      className="group relative w-full min-h-[110px] md:min-h-[135px] py-4 md:py-5 px-3 md:px-4 rounded-[2rem] bg-gradient-to-br from-white to-slate-50/50 border border-slate-100 shadow-[0_10px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_25px_60px_rgb(0,0,0,0.12)] hover:shadow-indigo-500/30 hover:border-indigo-200 hover:from-white hover:to-indigo-50/30 transition-all duration-300 ease-spring hover:-translate-y-1.5 active:scale-95 flex flex-col items-center justify-center overflow-hidden shrink-0"
                      style={{ animationDelay: '100ms' }}
                    >
                      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-bl-[100%] -mr-10 -mt-10 transition-transform duration-700 ease-out group-hover:scale-150"></div>
                      <div className="absolute bottom-0 left-0 w-24 h-24 bg-indigo-500/5 rounded-tr-[100%] -ml-10 -mb-10 transition-transform duration-700 ease-out group-hover:scale-125 opacity-0 group-hover:opacity-100"></div>

                      <div className="relative w-11 h-11 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center mb-2.5 text-white group-hover:scale-110 group-hover:rotate-6 transition-transform duration-300 shadow-md shadow-indigo-500/30 ring-4 ring-white">
                        <Calendar className="w-5 h-5 md:w-6 md:h-6 drop-shadow-md" />
                      </div>

                      <h3 className="text-sm md:text-base lg:text-lg font-bold text-slate-800 mb-0.5 group-hover:text-slate-900 tracking-tight text-center">Agendar Veículo</h3>
                      <p className="text-[9px] md:text-[10px] font-bold text-slate-400 group-hover:text-indigo-600 transition-colors uppercase tracking-wider text-center">Nova Viagem</p>
                    </button>
                  )}

                  {/* Card: Meus Agendamentos */}
                  {canAccessMeus && (
                    <button
                      onClick={() => handleSubViewChange('history')}
                      className="group relative w-full min-h-[110px] md:min-h-[135px] py-4 md:py-5 px-3 md:px-4 rounded-[2rem] bg-gradient-to-br from-white to-slate-50/50 border border-slate-100 shadow-[0_10px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_25px_60px_rgb(0,0,0,0.12)] hover:shadow-emerald-500/30 hover:border-emerald-200 hover:from-white hover:to-emerald-50/30 transition-all duration-300 ease-spring hover:-translate-y-1.5 active:scale-95 flex flex-col items-center justify-center overflow-hidden shrink-0"
                      style={{ animationDelay: '150ms' }}
                    >
                      <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-bl-[100%] -mr-10 -mt-10 transition-transform duration-700 ease-out group-hover:scale-150"></div>
                      <div className="absolute bottom-0 left-0 w-24 h-24 bg-emerald-500/5 rounded-tr-[100%] -ml-10 -mb-10 transition-transform duration-700 ease-out group-hover:scale-125 opacity-0 group-hover:opacity-100"></div>

                      <div className="relative w-11 h-11 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center mb-2.5 text-white group-hover:scale-110 group-hover:rotate-6 transition-transform duration-300 shadow-md shadow-emerald-500/30 ring-4 ring-white">
                        <History className="w-5 h-5 md:w-6 md:h-6 drop-shadow-md" />
                      </div>

                      <h3 className="text-sm md:text-base lg:text-lg font-bold text-slate-800 mb-0.5 group-hover:text-slate-900 tracking-tight text-center">Meus Agendamentos</h3>
                      <p className="text-[9px] md:text-[10px] font-bold text-slate-400 group-hover:text-emerald-600 transition-colors uppercase tracking-wider text-center">Histórico e Status</p>
                    </button>
                  )}

                  {/* Card: Aprovações (Conditional) */}
                  {canAccessAprovacoes && (
                    <button
                      onClick={() => handleSubViewChange('approvals')}
                      className="group relative w-full min-h-[110px] md:min-h-[135px] py-4 md:py-5 px-3 md:px-4 rounded-[2rem] bg-gradient-to-br from-white to-slate-50/50 border border-slate-100 shadow-[0_10px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_25px_60px_rgb(0,0,0,0.12)] hover:shadow-amber-500/30 hover:border-amber-200 hover:from-white hover:to-amber-50/30 transition-all duration-300 ease-spring hover:-translate-y-1.5 active:scale-95 flex flex-col items-center justify-center overflow-hidden shrink-0"
                      style={{ animationDelay: '200ms' }}
                    >
                      <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-bl-[100%] -mr-10 -mt-10 transition-transform duration-700 ease-out group-hover:scale-150"></div>
                      <div className="absolute bottom-0 left-0 w-24 h-24 bg-amber-500/5 rounded-tr-[100%] -ml-10 -mb-10 transition-transform duration-700 ease-out group-hover:scale-125 opacity-0 group-hover:opacity-100"></div>

                      <div className="relative w-11 h-11 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center mb-2.5 text-white group-hover:scale-110 group-hover:rotate-6 transition-transform duration-300 shadow-md shadow-amber-500/30 ring-4 ring-white">
                        <ShieldCheck className="w-5 h-5 md:w-6 md:h-6 drop-shadow-md" />
                      </div>

                      <h3 className="text-sm md:text-base lg:text-lg font-bold text-slate-800 mb-0.5 group-hover:text-slate-900 tracking-tight text-center">Aprovações</h3>
                      <p className="text-[9px] md:text-[10px] font-bold text-slate-400 group-hover:text-amber-600 transition-colors uppercase tracking-wider text-center">Gestão de Pedidos</p>
                    </button>
                  )}

                  {/* Card: Dashboard Analítico */}
                  {canAccessDashboard && (
                    <button
                      onClick={() => handleSubViewChange('dashboard')}
                      className="group relative w-full min-h-[110px] md:min-h-[135px] py-4 md:py-5 px-3 md:px-4 rounded-[2rem] bg-gradient-to-br from-white to-slate-50/50 border border-slate-100 shadow-[0_10px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_25px_60px_rgb(0,0,0,0.12)] hover:shadow-cyan-500/30 hover:border-cyan-200 hover:from-white hover:to-cyan-50/30 transition-all duration-300 ease-spring hover:-translate-y-1.5 active:scale-95 flex flex-col items-center justify-center overflow-hidden shrink-0"
                      style={{ animationDelay: '250ms' }}
                    >
                      <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-bl-[100%] -mr-10 -mt-10 transition-transform duration-700 ease-out group-hover:scale-150"></div>
                      <div className="absolute bottom-0 left-0 w-24 h-24 bg-cyan-500/5 rounded-tr-[100%] -ml-10 -mb-10 transition-transform duration-700 ease-out group-hover:scale-125 opacity-0 group-hover:opacity-100"></div>

                      <div className="relative w-11 h-11 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center mb-2.5 text-white group-hover:scale-110 group-hover:rotate-6 transition-transform duration-300 shadow-md shadow-cyan-500/30 ring-4 ring-white">
                        <Activity className="w-5 h-5 md:w-6 md:h-6 drop-shadow-md" />
                      </div>

                      <h3 className="text-sm md:text-base lg:text-lg font-bold text-slate-800 mb-0.5 group-hover:text-slate-900 tracking-tight text-center">Dashboard Analítico</h3>
                      <p className="text-[9px] md:text-[10px] font-bold text-slate-400 group-hover:text-cyan-600 transition-colors uppercase tracking-wider text-center">Indicadores de Frota</p>
                    </button>
                  )}

                  {!canAccessAgendar && !canAccessMeus && !canAccessAprovacoes && !canAccessDashboard && !canAccessConsultar && (
                    <div className="col-span-full text-center p-8 bg-white border border-slate-200 rounded-[2rem] shadow-sm max-w-md mx-auto">
                      <Car className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                      <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Gestão de Veículos</h3>
                      <p className="text-xs text-slate-500 mt-2">Nenhuma funcionalidade deste módulo está disponível para o seu perfil ou dispositivo.</p>
                    </div>
                  )}

                </div>
              );
            })()}
          </div>
        </div>
      </div>
    </>
  );

  const handleStartNovoAgendamento = (initialDate?: Date) => {
    handleOpenModal(undefined, initialDate || selectedCalendarDate);
    handleSubViewChange('novo');
  };

  const renderAccessDenied = () => (
    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50 text-center animate-fade-in">
      <div className="w-16 h-16 rounded-3xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4 shadow-sm border border-rose-100">
        <Lock className="w-8 h-8" />
      </div>
      <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Acesso Não Permitido</h3>
      <p className="text-sm text-slate-500 mt-2 max-w-md">
        Seu usuário não possui permissão para acessar esta seção de agendamento de veículos ou o recurso está inativo.
      </p>
      <button
        onClick={() => handleSubViewChange('menu')}
        className="mt-6 px-6 py-2.5 bg-slate-900 text-white font-bold text-xs uppercase tracking-wider rounded-xl hover:bg-indigo-600 transition-all shadow-md"
      >
        Voltar ao Menu
      </button>
    </div>
  );

  const renderCalendar = () => {
    const selectedDayKey = `${String(selectedCalendarDate.getDate()).padStart(2, '0')}-${String(selectedCalendarDate.getMonth() + 1).padStart(2, '0')}`;
    const selectedDayHoliday = HOLIDAYS[selectedDayKey];
    const isSelectedDayToday = new Date().getDate() === selectedCalendarDate.getDate() && 
      new Date().getMonth() === selectedCalendarDate.getMonth() && 
      new Date().getFullYear() === selectedCalendarDate.getFullYear();
    const isSelectedDayPast = isDateBeforeToday(selectedCalendarDate);

    return (
      <div className="flex-1 flex flex-col overflow-hidden animate-fade-in h-full bg-slate-100/60">
        {/* Top Header Bar */}
        <div className="bg-white border-b border-slate-200/80 px-4 md:px-6 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0 z-20 shadow-xs">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => handleSubViewChange('menu')} 
              className="w-10 h-10 md:w-11 md:h-11 bg-white rounded-2xl flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200/80 shadow-xs transition-all active:scale-95 group shrink-0 cursor-pointer"
              title="Voltar ao Menu Principal"
            >
              <ArrowLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-xl bg-indigo-50 text-indigo-600">
                  <CalendarDays className="w-5 h-5" />
                </div>
                <h2 className="text-xl md:text-2xl lg:text-3xl font-black text-slate-900 uppercase tracking-tight leading-none">Agendamento de Veículos</h2>
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 ml-0.5">Calendário de Viagens e Agendamentos</p>
            </div>
          </div>

          {/* Center: Month Selector with Hoje in front */}
          <div className="flex items-center gap-1.5 bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200/80 shadow-inner order-3 md:order-2 w-full md:w-auto justify-between md:justify-center">
            <button 
              onClick={handlePrevMonth} 
              className="p-2 hover:bg-white hover:shadow-xs rounded-xl text-slate-600 transition-all active:scale-90 shrink-0 cursor-pointer"
              title="Mês Anterior"
            >
              <ChevronLeft className="w-4 h-4 md:w-5 md:h-5" />
            </button>
            <div className="px-2 md:px-5 text-xs md:text-sm font-black text-slate-900 uppercase tracking-wider text-center select-none truncate">
              {currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
            </div>
            <button 
              onClick={handleNextMonth} 
              className="p-2 hover:bg-white hover:shadow-xs rounded-xl text-slate-600 transition-all active:scale-90 shrink-0 cursor-pointer"
              title="Próximo Mês"
            >
              <ChevronRight className="w-4 h-4 md:w-5 md:h-5" />
            </button>

            {/* Botão Hoje em frente ao Mês e Ano */}
            <button 
              onClick={handleGoToToday} 
              className={`ml-1 px-3 py-1.5 border rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-xs active:scale-95 flex items-center gap-1 shrink-0 cursor-pointer ${
                isSelectedDayToday
                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                  : 'bg-white border-slate-200 text-slate-700 hover:text-indigo-600 hover:border-indigo-300'
              }`}
              title="Ir para a data de hoje"
            >
              <Sparkles className={`w-3 h-3 ${isSelectedDayToday ? 'text-white' : 'text-indigo-600'}`} />
              Hoje
            </button>
          </div>

          {/* Spacer / Right */}
          <div className="hidden md:block w-10"></div>
        </div>

        {/* ===================== WEB / DESKTOP VIEW (CALENDÁRIO COMPLETO COM AGENDAMENTOS) ===================== */}
        <div className="hidden md:flex flex-col flex-1 overflow-hidden">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 bg-slate-900 shrink-0 shadow-md z-10">
            {['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'].map((d, i) => (
              <div key={d} className={`py-3 text-center text-[10px] font-black uppercase tracking-[0.25em] border-r border-slate-800/60 last:border-0 ${i === 0 || i === 6 ? 'text-amber-400' : 'text-slate-300'}`}>
                {d}
              </div>
            ))}
          </div>

          {/* Grid container */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 md:p-3 bg-slate-200/50">
            <div className="grid grid-cols-7 gap-2 w-full">
              {calendarData.map((cell, idx) => {
                if (!cell.isCurrent) {
                  return (
                    <div key={idx} className="bg-slate-100/40 rounded-2xl min-h-[130px] lg:min-h-[150px] p-2 border border-slate-200/30 opacity-40 select-none">
                      <span className="text-xs font-bold text-slate-400">{cell.day}</span>
                    </div>
                  );
                }

                const dayStart = new Date(cell.year, cell.month, cell.day, 0, 0, 0).getTime();
                const dayEnd = new Date(cell.year, cell.month, cell.day, 23, 59, 59).getTime();
                const dateObj = new Date(cell.year, cell.month, cell.day);
                const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
                const dayKey = `${String(cell.day).padStart(2, '0')}-${String(cell.month + 1).padStart(2, '0')}`;
                const holidayName = HOLIDAYS[dayKey];
                const isHoliday = !!holidayName;
                const isPast = isDateBeforeToday(dateObj);
                
                const daySchedules = schedules.filter(s => {
                  if (s.status === 'cancelado') return false;
                  const dep = new Date(s.departureDateTime).getTime();
                  const ret = new Date(s.returnDateTime).getTime();
                  return (dep <= dayEnd) && (ret >= dayStart);
                }).sort((a, b) => a.departureDateTime.localeCompare(b.departureDateTime));

                const isToday = new Date().getDate() === cell.day && new Date().getMonth() === cell.month && new Date().getFullYear() === cell.year;

                // Visual background styling
                let cellBgClass = 'bg-white hover:bg-slate-50/90 border-slate-200/80';
                if (isToday) cellBgClass = 'bg-indigo-50/30 border-indigo-300 ring-2 ring-indigo-500/20';
                else if (isHoliday) cellBgClass = 'bg-rose-50/60 border-rose-200/80';
                else if (isWeekend) cellBgClass = 'bg-slate-50/90 border-slate-200/60';

                return (
                  <div 
                    key={idx} 
                    className={`group relative min-h-[130px] lg:min-h-[155px] flex flex-col p-2 rounded-2xl border transition-all duration-200 shadow-xs hover:shadow-lg hover:z-20 ${cellBgClass}`}
                  >
                    {/* Cell Header */}
                    <div className="flex items-center justify-between mb-1.5 shrink-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs font-black w-6 h-6 lg:w-7 lg:h-7 flex items-center justify-center rounded-xl transition-transform group-hover:scale-110 ${
                          isToday 
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' 
                            : isHoliday 
                            ? 'text-rose-700 bg-rose-100 font-extrabold' 
                            : isWeekend 
                            ? 'text-indigo-900 bg-indigo-100/60' 
                            : 'text-slate-800 bg-slate-100'
                        }`}>
                          {cell.day}
                        </span>
                        {isToday && (
                          <span className="text-[8px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-100/80 px-1.5 py-0.5 rounded-md">Hoje</span>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        {isHoliday && (
                          <span title={holidayName} className="text-rose-500 bg-white rounded-full p-1 shadow-xs">
                            <Gift className="w-3.5 h-3.5" />
                          </span>
                        )}
                        
                        {/* Quick Add Plus button on hover */}
                        {!isPast && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartNovoAgendamento(new Date(cell.year, cell.month, cell.day, new Date().getHours() + 1, 0));
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-indigo-600 hover:text-white text-indigo-600 rounded-lg transition-all shadow-xs cursor-pointer"
                            title="Novo agendamento neste dia"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Day Schedules List */}
                    <div className="flex-1 flex flex-col gap-1 overflow-y-auto custom-scrollbar max-h-[140px]">
                      {daySchedules.slice(0, 3).map(s => {
                        const v = vehicles.find(veh => veh.id === s.vehicleId);
                        const driver = persons.find(p => p.id === s.driverId);
                        const cfg = STATUS_MAP[s.status];
                        const styles = getScheduleStyles(s.status);
                        const StatusIcon = cfg?.icon || Car;

                        const depTimeStr = new Date(s.departureDateTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setViewingSchedule(s);
                              setIsViewModalOpen(true);
                            }}
                            title={`Visualizar: ${v?.model || 'Veículo'} (${s.destination}) - Motorista: ${driver?.name || 'Não inf.'}`}
                            className={`group/item w-full text-left p-1.5 rounded-xl border flex items-center justify-between gap-1.5 transition-all duration-200 shadow-2xs hover:shadow-md hover:scale-[1.01] cursor-pointer ${styles.cardBg}`}
                          >
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                              <div className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 transition-transform group-hover/item:scale-110 ${styles.iconBg}`}>
                                <StatusIcon className="w-3 h-3" />
                              </div>
                              <div className="flex flex-col min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-1">
                                  <span className="text-[9.5px] font-black uppercase truncate leading-tight tracking-tight">
                                    {v?.model || 'Veículo'}
                                  </span>
                                  <span className={`text-[8.5px] font-bold shrink-0 ${styles.timeColor}`}>
                                    {depTimeStr}
                                  </span>
                                </div>
                                <span className="text-[8px] opacity-70 truncate font-semibold">
                                  {s.destination || 'Sem destino'}
                                </span>
                              </div>
                            </div>
                          </button>
                        );
                      })}

                      {daySchedules.length > 3 && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCalendarDate(new Date(cell.year, cell.month, cell.day));
                          }}
                          className="text-[8.5px] font-bold text-slate-500 hover:text-indigo-600 text-center py-0.5 rounded bg-slate-100/80 hover:bg-indigo-50 transition-colors"
                        >
                          +{daySchedules.length - 3} mais
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ===================== MOBILE VIEW (PERMANECE COMO ESTÁ) ===================== */}
        <div className="flex md:hidden flex-col flex-1 overflow-hidden">
          {/* Horizontal Days Bar (Selector) */}
          <div className="bg-white border-b border-slate-200/90 px-2 py-2.5 shrink-0 shadow-xs z-10">
            <div className="flex items-center gap-1.5 max-w-5xl mx-auto">
              <button
                onClick={handlePrevDay}
                className="w-8 h-10 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 hover:text-indigo-600 transition-all shrink-0 active:scale-90"
                title="Dia Anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {/* Days Scroll Container */}
              <div 
                ref={daysBarRef}
                className="flex-1 overflow-x-auto custom-scrollbar flex items-center gap-1.5 py-1 px-1 scroll-smooth"
              >
                {monthDays.map((item) => {
                  const isSelected = item.isSelected;
                  const isToday = item.isToday;
                  const isHoliday = !!item.holidayName;

                  let btnStyle = "bg-white text-slate-700 border-slate-200 hover:border-indigo-300 hover:bg-slate-50";
                  if (isSelected) {
                    btnStyle = "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/30 scale-[1.03] ring-2 ring-indigo-300";
                  } else if (isToday) {
                    btnStyle = "bg-indigo-50/90 text-indigo-900 border-indigo-300 ring-1 ring-indigo-400/30";
                  } else if (isHoliday) {
                    btnStyle = "bg-rose-50/70 text-rose-800 border-rose-200 hover:border-rose-300";
                  }

                  return (
                    <button
                      key={item.day}
                      data-selected={isSelected ? "true" : "false"}
                      onClick={() => handleSelectDay(item.dateObj)}
                      className={`min-w-[56px] py-2 px-1.5 rounded-2xl border flex flex-col items-center justify-center gap-0.5 transition-all duration-200 active:scale-95 shrink-0 cursor-pointer ${btnStyle}`}
                      title={isHoliday ? `Feriado: ${item.holidayName}` : undefined}
                    >
                      <span className={`text-[9px] font-black uppercase tracking-wider leading-none ${
                        isSelected ? 'text-indigo-100' : isToday ? 'text-indigo-600' : isHoliday ? 'text-rose-600' : 'text-slate-400'
                      }`}>
                        {item.weekdayShort}
                      </span>

                      <span className={`text-base font-black leading-tight ${
                        isSelected ? 'text-white' : 'text-slate-900'
                      }`}>
                        {item.day}
                      </span>

                      <div className="flex items-center gap-1 min-h-[14px]">
                        {isToday && (
                          <span className={`text-[7.5px] font-black uppercase px-1 rounded ${
                            isSelected ? 'bg-white text-indigo-700' : 'bg-indigo-600 text-white'
                          }`}>
                            Hoje
                          </span>
                        )}

                        {isHoliday && !isToday && (
                          <Gift className={`w-3 h-3 ${isSelected ? 'text-white' : 'text-rose-500'}`} />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              <button
                onClick={handleNextDay}
                className="w-8 h-10 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 hover:text-indigo-600 transition-all shrink-0 active:scale-90"
                title="Próximo Dia"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Mobile Main Content Area */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 flex flex-col justify-center items-center">
            <div className="w-full max-w-lg space-y-4 my-auto">
              
              {/* Selected Date Header Card */}
              <div className="bg-white p-4 rounded-3xl border border-slate-200/90 shadow-sm flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-2xl flex flex-col items-center justify-center shadow-md shrink-0">
                    <span className="text-[9px] font-black uppercase leading-none opacity-60">
                      {selectedCalendarDate.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}
                    </span>
                    <span className="text-xl font-black leading-none mt-1">
                      {selectedCalendarDate.getDate()}
                    </span>
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-black text-slate-900 uppercase tracking-tight leading-none">
                        {selectedCalendarDate.toLocaleDateString('pt-BR', { weekday: 'long' })}
                      </h3>
                      {isSelectedDayToday && (
                        <span className="text-[8px] font-black uppercase tracking-widest bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-md">
                          Hoje
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">
                      {selectedCalendarDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                </div>

                {selectedDayHoliday && (
                  <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-xl text-rose-800 text-[10px] font-bold shrink-0">
                    <Gift className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    <span className="truncate max-w-[120px]">{selectedDayHoliday}</span>
                  </div>
                )}
              </div>

              {/* Warning if past date */}
              {isSelectedDayPast && (
                <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-2xl flex items-center justify-between gap-2 text-amber-900 text-[11px] font-bold">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Data passada. Selecione hoje ou uma data futura.</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleGoToToday}
                    className="px-2.5 py-1 bg-amber-600 text-white rounded-lg text-[9px] uppercase tracking-wider font-black shrink-0"
                  >
                    Hoje
                  </button>
                </div>
              )}

              {/* Action Card: Novo Agendamento */}
              <div className="bg-gradient-to-br from-white via-slate-50 to-indigo-50/40 p-5 rounded-3xl border border-slate-200/90 shadow-md relative overflow-hidden flex flex-col items-center text-center">
                <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-600 flex items-center justify-center mb-3 text-white shadow-lg shadow-indigo-600/30 ring-4 ring-white/80">
                  <Car className="w-8 h-8 drop-shadow-md" />
                </div>

                <h3 className="text-lg font-black text-slate-900 tracking-tight uppercase mb-1">
                  Realizar Novo Agendamento
                </h3>

                <p className="text-xs text-slate-500 font-medium mb-4 leading-relaxed">
                  Clique abaixo para abrir o formulário e solicitar uma viagem para o dia <strong className="text-indigo-900 font-bold">{selectedCalendarDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</strong>.
                </p>

                <button
                  type="button"
                  onClick={() => handleStartNovoAgendamento(selectedCalendarDate)}
                  disabled={isSelectedDayPast}
                  className="w-full py-3.5 bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600 text-white font-black rounded-xl shadow-md shadow-indigo-600/30 active:scale-95 transition-all flex items-center justify-center gap-2 uppercase text-xs tracking-wider disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  <span>Novo Agendamento</span>
                </button>
              </div>

            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderNovoAgendamento = () => {
    const selectedVehicle = vehicles.find(v => v.id === formData.vehicleId);
    const selectedDriver = persons.find(p => p.id === formData.driverId);
    const selectedRequester = persons.find(p => p.id === formData.requesterPersonId);
    const selectedSector = sectors.find(s => s.id === formData.serviceSectorId);

    const tabs: { id: 'dados_gerais' | 'destino' | 'data' | 'objetivo' | 'tripulacao'; label: string; icon: any }[] = [
      { id: 'dados_gerais', label: 'Dados Gerais', icon: ClipboardList },
      { id: 'destino', label: 'Destino', icon: MapPin },
      { id: 'data', label: 'Horários', icon: Clock },
      { id: 'objetivo', label: 'Objetivo', icon: FileText },
      { id: 'tripulacao', label: 'Tripulação', icon: Users },
    ];

    const currentTabIndex = tabs.findIndex(t => t.id === modalActiveTab);

    return (
      <div className="flex-1 flex flex-col overflow-hidden animate-fade-in h-full bg-slate-100/60">
        {/* Header da Nova Página */}
        <div className="bg-white border-b border-slate-200/80 px-4 md:px-6 py-3.5 flex items-center justify-between shrink-0 z-20 shadow-xs">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => handleSubViewChange('calendar')} 
              className="w-10 h-10 md:w-11 md:h-11 bg-white rounded-2xl flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200/80 shadow-xs transition-all active:scale-95 group shrink-0 cursor-pointer"
              title="Voltar para o Calendário"
            >
              <ArrowLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-xl bg-indigo-50 text-indigo-600">
                  <Car className="w-5 h-5" />
                </div>
                <h2 className="text-xl md:text-2xl font-black text-slate-900 uppercase tracking-tight leading-none">
                  {editingSchedule ? 'Editar Agendamento' : 'Novo Agendamento'}
                </h2>
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 ml-0.5">
                Preenchimento dos dados da nova viagem
              </p>
            </div>
          </div>
        </div>

        {/* Form Container */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 md:p-6">
          <div className="max-w-4xl mx-auto space-y-4">
            
            {/* Form Tabs Card */}
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col">
              
              {/* Tab Navigation */}
              <div className="px-4 md:px-6 pt-3 bg-slate-50/50 border-b border-slate-200/80 flex overflow-x-auto custom-scrollbar gap-2 shrink-0">
                {tabs.map((tab) => {
                  const TabIcon = tab.icon;
                  const isActive = modalActiveTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setModalActiveTab(tab.id)}
                      className={`flex items-center gap-2 px-4 py-3 rounded-t-2xl text-xs font-black uppercase tracking-wider transition-all border-b-2 shrink-0 cursor-pointer ${
                        isActive
                          ? 'border-indigo-600 text-indigo-600 bg-white shadow-xs'
                          : 'border-transparent text-slate-400 hover:text-slate-700 bg-transparent'
                      }`}
                    >
                      <TabIcon className="w-4 h-4" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Tab Bodies */}
              <div className="p-4 md:p-8 flex-1">
                {modalActiveTab === 'dados_gerais' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 animate-fade-in">
                    <div>
                      <label className={labelClass}><Car className="w-3.5 h-3.5 inline mr-1.5 text-indigo-500" /> Veículo Operacional</label>
                      <button
                        type="button"
                        onClick={() => setActiveSelectionField('vehicle')}
                        className={`${inputClass} flex items-center justify-between text-left hover:bg-white cursor-pointer`}
                      >
                        <span className={formData.vehicleId ? 'text-slate-900 font-bold' : 'text-slate-400'}>
                          {selectedVehicle
                            ? `${selectedVehicle.brand} ${selectedVehicle.model} (${selectedVehicle.plate})`
                            : 'Selecione o veículo...'}
                        </span>
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      </button>
                    </div>

                    <div>
                      <label className={labelClass}><UserIcon className="w-3.5 h-3.5 inline mr-1.5 text-indigo-500" /> Motorista Responsável</label>
                      <button
                        type="button"
                        onClick={() => setActiveSelectionField('driver')}
                        className={`${inputClass} flex items-center justify-between hover:bg-white text-left cursor-pointer`}
                      >
                        <span className={formData.driverId ? 'text-slate-900 font-bold' : 'text-slate-400'}>
                          {selectedDriver?.name || 'Selecione o motorista...'}
                        </span>
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      </button>
                    </div>

                    <div>
                      <label className={labelClass}><UserCircle className="w-3.5 h-3.5 inline mr-1.5 text-indigo-500" /> Solicitante (Requerente)</label>
                      <button
                        type="button"
                        onClick={() => setActiveSelectionField('requester')}
                        className={`${inputClass} flex items-center justify-between text-left hover:bg-white cursor-pointer`}
                      >
                        <span className={formData.requesterPersonId ? 'text-slate-900 font-bold' : 'text-slate-400'}>
                          {selectedRequester?.name || 'Quem está solicitando?'}
                        </span>
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      </button>
                    </div>

                    <div>
                      <label className={labelClass}><Landmark className="w-3.5 h-3.5 inline mr-1.5 text-indigo-500" /> Setor de Atendimento</label>
                      <button
                        type="button"
                        onClick={() => setActiveSelectionField('sector')}
                        className={`${inputClass} flex items-center justify-between text-left hover:bg-white cursor-pointer`}
                      >
                        <span className={selectedSector ? 'text-slate-900 font-bold' : 'text-slate-400'}>
                          {selectedSector?.name || 'Qual setor será atendido?'}
                        </span>
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      </button>
                    </div>
                  </div>
                )}

                {modalActiveTab === 'destino' && (
                  <div className="space-y-5 animate-fade-in">
                    <div>
                      <label className={labelClass}><MapPin className="w-3.5 h-3.5 inline mr-1.5 text-indigo-500" /> Cidade de Destino (IBGE)</label>
                      <button
                        type="button"
                        onClick={() => setActiveSelectionField('city')}
                        className={`${inputClass} flex items-center justify-between text-left hover:bg-white cursor-pointer`}
                      >
                        <span className={formData.destination ? 'text-slate-900 font-bold' : 'text-slate-400'}>
                          {formData.destination || 'Selecione ou busque a cidade de destino...'}
                        </span>
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      </button>
                    </div>

                    <div>
                      <label className={labelClass}><Navigation className="w-3.5 h-3.5 inline mr-1.5 text-indigo-500" /> Local de Saída / Embarque (Opcional)</label>
                      <input
                        type="text"
                        value={formData.vehicleLocation || ''}
                        onChange={e => setFormData({ ...formData, vehicleLocation: e.target.value })}
                        placeholder="Ex: Garagem Municipal, Secretaria de Obras, Prefeitura..."
                        className={inputClass}
                      />
                    </div>
                  </div>
                )}

                {modalActiveTab === 'data' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 animate-fade-in">
                    <div>
                      <label className={labelClass}><Clock className="w-3.5 h-3.5 inline mr-1.5 text-indigo-500" /> Início do Agendamento (Saída)</label>
                      <button
                        type="button"
                        onClick={() => setActiveDateField('departure')}
                        className={`${inputClass} h-[52px] flex items-center justify-between text-left hover:bg-white cursor-pointer`}
                      >
                        <span className={formData.departureDateTime ? 'text-slate-900 font-bold' : 'text-slate-400'}>
                          {formatDateDisplay(formData.departureDateTime)}
                        </span>
                        <Calendar className="w-4 h-4 text-slate-400" />
                      </button>
                    </div>

                    <div>
                      <label className={labelClass}><Clock className="w-3.5 h-3.5 inline mr-1.5 text-indigo-500" /> Fim do Agendamento (Retorno)</label>
                      <button
                        type="button"
                        onClick={() => setActiveDateField('return')}
                        className={`${inputClass} h-[52px] flex items-center justify-between text-left hover:bg-white cursor-pointer`}
                      >
                        <span className={formData.returnDateTime ? 'text-slate-900 font-bold' : 'text-slate-400'}>
                          {formatDateDisplay(formData.returnDateTime)}
                        </span>
                        <Calendar className="w-4 h-4 text-slate-400" />
                      </button>
                    </div>
                  </div>
                )}

                {modalActiveTab === 'objetivo' && (
                  <div className="space-y-4 animate-fade-in">
                    <div>
                      <label className={labelClass}><FileText className="w-3.5 h-3.5 inline mr-1.5 text-indigo-500" /> Finalidade / Motivo da Viagem</label>
                      <textarea
                        value={formData.purpose || ''}
                        onChange={e => setFormData({ ...formData, purpose: e.target.value })}
                        className={`${inputClass} min-h-[140px] resize-none pt-3.5`}
                        placeholder="Descreva detalhadamente o objetivo da saída, compromissos ou serviços a serem realizados..."
                      />
                    </div>
                  </div>
                )}

                {modalActiveTab === 'tripulacao' && (
                  <div className="space-y-5 animate-fade-in">
                    <div>
                      <label className={labelClass}><Users className="w-3.5 h-3.5 inline mr-1.5 text-indigo-500" /> Adicionar Passageiro / Tripulante</label>
                      <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80 space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <input
                            type="text"
                            value={newPassenger.name}
                            onChange={e => setNewPassenger({ ...newPassenger, name: e.target.value })}
                            placeholder="Nome completo..."
                            className={inputClass}
                          />
                          <input
                            type="text"
                            value={newPassenger.departureLocation}
                            onChange={e => setNewPassenger({ ...newPassenger, departureLocation: e.target.value })}
                            placeholder="Local de embarque / partida..."
                            className={inputClass}
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <input
                            type="time"
                            value={newPassenger.appointmentTime}
                            onChange={e => setNewPassenger({ ...newPassenger, appointmentTime: e.target.value })}
                            className={inputClass}
                          />
                          <input
                            type="text"
                            value={newPassenger.appointmentLocation}
                            onChange={e => setNewPassenger({ ...newPassenger, appointmentLocation: e.target.value })}
                            placeholder="Local do compromisso / consulta..."
                            className={inputClass}
                          />
                        </div>

                        <button
                          type="button"
                          onClick={handleAddPassenger}
                          className="w-full py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-black rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 border border-indigo-200 cursor-pointer"
                        >
                          <Plus className="w-4 h-4" /> Adicionar à Tripulação
                        </button>
                      </div>
                    </div>

                    {/* Passengers List */}
                    {formData.passengers && formData.passengers.length > 0 ? (
                      <div className="space-y-2">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                          Passageiros Confirmados ({formData.passengers.length}):
                        </span>
                        <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 overflow-hidden bg-white">
                          {formData.passengers.map((p, idx) => (
                            <div key={idx} className="p-3.5 flex items-center justify-between gap-3 text-xs">
                              <div className="min-w-0 flex-1">
                                <p className="font-black text-slate-900 truncate">{p.name}</p>
                                <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">
                                  Partida: {p.departureLocation} | Horário: {p.appointmentTime} | Local: {p.appointmentLocation}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemovePassenger(idx)}
                                className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                                title="Remover passageiro"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-2xl">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nenhum passageiro adicionado ainda</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Form Navigation */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center gap-3">
                <div>
                  {currentTabIndex > 0 && (
                    <button
                      type="button"
                      onClick={() => setModalActiveTab(tabs[currentTabIndex - 1].id)}
                      className="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 font-bold rounded-xl text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" /> Anterior
                    </button>
                  )}
                </div>

                <div>
                  {currentTabIndex < tabs.length - 1 && (
                    <button
                      type="button"
                      onClick={() => setModalActiveTab(tabs[currentTabIndex + 1].id)}
                      className="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 font-bold rounded-xl text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      Próximo <ChevronRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

            </div>

          </div>
        </div>

        {/* Fixed Responsive Bottom Action Bar */}
        <div className="bg-white/95 backdrop-blur-md border-t border-slate-200/90 px-4 md:px-8 py-3.5 shrink-0 shadow-lg z-30">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => handleSubViewChange('calendar')}
              className="px-4 md:px-6 py-2.5 text-slate-500 hover:text-rose-600 font-bold rounded-xl text-xs uppercase tracking-wider transition-colors cursor-pointer"
              disabled={isSaving}
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-6 md:px-8 py-3 bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-black rounded-2xl shadow-md shadow-indigo-600/25 transition-all hover:-translate-y-0.5 active:scale-95 flex items-center justify-center gap-2 uppercase text-xs tracking-wider disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{isSaving ? 'Salvando...' : (editingSchedule ? 'Atualizar Dados' : 'Salvar Agendamento')}</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50 relative">
      {activeSubView === 'menu' && renderDashboard()}
      {activeSubView === 'calendar' && (canAccessAgendar ? renderCalendar() : renderAccessDenied())}
      {activeSubView === 'novo' && (canAccessAgendar ? renderNovoAgendamento() : renderAccessDenied())}
      {activeSubView === 'history' && (canAccessMeus ? (
        <VehicleScheduleHistory
          schedules={schedules}
          vehicles={vehicles}
          persons={persons}
          sectors={sectors}
          state={state}
          onViewDetails={(s) => {
            setViewingSchedule(s);
            setIsViewModalOpen(true);
          }}
          onEdit={(s) => {
            handleOpenModal(s);
            handleSubViewChange('novo');
          }}
          onUpdateStatus={onUpdateStatusSchedule}
          onUpdateSchedule={onUpdateSchedule}
          onDelete={onDeleteSchedule}
          onBack={() => handleSubViewChange('menu')}
          currentUserId={currentUserId}
          userRole={currentUserRole}
          currentUserSector={currentUserSector}
        />
      ) : renderAccessDenied())}
      {activeSubView === 'approvals' && (canAccessAprovacoes ? (
        <VehicleScheduleApprovals
          schedules={schedules}
          vehicles={vehicles}
          persons={persons}
          sectors={sectors}
          onApprove={(s) => onUpdateStatusSchedule(s.id, 'confirmado')}
          onReject={(s) => onUpdateStatusSchedule(s.id, 'cancelado', { reason: 'Rejeitado por Gestor', cancelledBy: currentUserName || 'Gestor' })}
          onBack={() => handleSubViewChange('menu')}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
          currentUserPersonId={currentUserPersonId}
          state={state}
        />
      ) : renderAccessDenied())}
      {activeSubView === 'dashboard' && (canAccessDashboard ? (
        <VehicleScheduleDashboard
          schedules={schedules}
          vehicles={vehicles}
          persons={persons}
          sectors={sectors}
          onBack={() => handleSubViewChange('menu')}
        />
      ) : renderAccessDenied())}
      {activeSubView === 'consultar' && (canAccessConsultar ? (
        <ConsultarVeiculoScreen
          onBack={() => handleSubViewChange('menu')}
          onSelectVehicleToSchedule={(vehicleId, dateStr, startTime, endTime) => {
            try {
              const [d, m, y] = dateStr.split('/');
              const departureDate = new Date(`${y}-${m}-${d}T${startTime}:00`);
              const returnDate = new Date(`${y}-${m}-${d}T${endTime}:00`);
              handleOpenModal(undefined, departureDate, vehicleId, returnDate);
              handleSubViewChange('novo');
            } catch (e) {
              handleOpenModal(undefined, new Date(), vehicleId);
              handleSubViewChange('novo');
            }
          }}
        />
      ) : renderAccessDenied())}

      {/* VIEW DETAILS MODAL */}
      {isViewModalOpen && viewingSchedule && createPortal(
        <div className="fixed inset-0 z-[210] flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/80 backdrop-blur-xl animate-fade-in h-full">
          <div className="bg-white sm:rounded-[2.5rem] rounded-t-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col animate-slide-up border border-white/20 h-full sm:h-auto max-h-[96vh]">
            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Detalhes da Viagem</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Informações completas do agendamento</p>
                </div>
              </div>
              <button onClick={() => setIsViewModalOpen(false)} className="p-3 hover:bg-white rounded-xl text-slate-400 cursor-pointer">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-8 space-y-8 flex-1 overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Veículo</p>
                  <p className="text-base font-bold text-slate-900 uppercase">{(vehicles.find(v => v.id === viewingSchedule.vehicleId))?.brand} {(vehicles.find(v => v.id === viewingSchedule.vehicleId))?.model} ({(vehicles.find(v => v.id === viewingSchedule.vehicleId))?.plate})</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Motorista</p>
                  <p className="text-base font-bold text-slate-900">{(persons.find(p => p.id === viewingSchedule.driverId))?.name}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Setor</p>
                  <p className="text-base font-bold text-slate-900 uppercase">{(sectors.find(s => s.id === viewingSchedule.serviceSectorId))?.name || '---'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Solicitante</p>
                  <p className="text-base font-bold text-slate-900">{(persons.find(p => p.id === viewingSchedule.requesterPersonId))?.name || '---'}</p>
                </div>
                <div className="col-span-2 space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Localização de Retirada/Encontro</p>
                  <p className="text-base font-bold text-indigo-700 uppercase flex items-center gap-2">
                    <MapPin className="w-4 h-4" />{viewingSchedule.vehicleLocation || 'Não especificada'
                  }</p>
                </div>
                <div className="col-span-2 space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Destino</p>
                  <p className="text-base font-bold text-indigo-600 uppercase">{viewingSchedule.destination}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Saída</p>
                  <p className="text-sm font-bold text-slate-700">{new Date(viewingSchedule.departureDateTime).toLocaleString('pt-BR')}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Retorno</p>
                  <p className="text-sm font-bold text-slate-700">{new Date(viewingSchedule.returnDateTime).toLocaleString('pt-BR')}</p>
                </div>
                <div className="col-span-2 space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Objetivo</p>
                  <p className="text-sm font-medium text-slate-600 bg-slate-50 p-4 rounded-xl border border-slate-100 italic">"{viewingSchedule.purpose}"</p>
                </div>

                {viewingSchedule.passengers && viewingSchedule.passengers.length > 0 && (
                  <div className="col-span-2 space-y-2 mt-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <Users className="w-3 h-3" /> Tripulação / Passageiros
                    </p>
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

                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</p>
                  <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border mt-1 font-black text-[10px] uppercase tracking-widest bg-${STATUS_MAP[viewingSchedule.status].color}-50 text-${STATUS_MAP[viewingSchedule.status].color}-700 border-${STATUS_MAP[viewingSchedule.status].color}-200`}>
                    {React.createElement(STATUS_MAP[viewingSchedule.status].icon, { className: "w-3 h-3" })}
                    {STATUS_MAP[viewingSchedule.status].label}
                  </div>
                </div>
              </div>
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-center">
              <button onClick={() => setIsViewModalOpen(false)} className="px-12 py-3 bg-slate-900 text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-xl shadow-lg hover:bg-indigo-600 transition-all cursor-pointer">
                Fechar Detalhes
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* TOAST DE NOTIFICAÇÃO MODERNO (CENTRALIZADO NO TOPO) */}
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
            <button onClick={() => setToast(prev => ({ ...prev, show: false }))} className="ml-2 p-2.5 hover:bg-white/10 rounded-2xl transition-colors shrink-0 active:scale-90 cursor-pointer">
              <X className="w-6 h-6" />
            </button>
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
          v.availableForScheduling === 'Sim'
        )}
        getInternalId={(v) => v.id}
        searchPlaceholder="Buscar por modelo, placa ou marca..."
        filterFunction={(v, query) => {
          const lowerQuery = query.toLowerCase();
          return v.model.toLowerCase().includes(lowerQuery) || v.plate.toLowerCase().includes(lowerQuery) || v.brand.toLowerCase().includes(lowerQuery);
        }}
        onSelect={(v) => {
          setFormData(prev => {
            const updates: Partial<VehicleSchedule> = { ...prev, vehicleId: v.id };
            const currentSectorValid = prev.serviceSectorId && sectors.some(s => s.id === prev.serviceSectorId);
            if (!currentSectorValid && v.sectorId && sectors.some(s => s.id === v.sectorId)) {
              updates.serviceSectorId = v.sectorId;
            }
            return updates;
          });
        }}
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
        onSelect={(p) => {
          const personSector = p.sectorId && sectors.find(s => s.id === p.sectorId);
          setFormData(prev => ({
            ...prev,
            requesterPersonId: p.id,
            // Preenche automaticamente o setor do solicitante quando selecionado
            serviceSectorId: personSector ? personSector.id : prev.serviceSectorId
          }));
        }}
        selectedItem={persons.find(p => p.id === formData.requesterPersonId)}
        renderItem={(p, isSelected) => {
          const pSector = sectors.find(s => s.id === p.sectorId);
          return (
            <div className="p-4 flex items-center gap-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isSelected ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                <UserCircle className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-bold truncate ${isSelected ? 'text-indigo-900' : 'text-slate-700'}`}>{p.name}</p>
                <p className="text-[11px] text-slate-400 truncate uppercase font-semibold">{pSector?.name || 'Sem setor vinculado'}</p>
              </div>
              {isSelected && <Check className="w-5 h-5 text-indigo-600 shrink-0" />}
            </div>
          );
        }}
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

          // A data/hora de retorno máxima deve ser no máximo 1 hora antes do início do próximo agendamento
          return nextSchedule ? new Date(new Date(nextSchedule.departureDateTime).getTime() - 60 * 60 * 1000) : undefined;
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