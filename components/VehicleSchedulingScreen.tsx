import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Vehicle, Person, VehicleSchedule, ScheduleStatus, Sector, AppState, UserRole, AppPermission, CrewMember } from '../types';
import {
  ArrowLeft, Plus, Search, Calendar, Clock, MapPin,
  User as UserIcon, Car, Info, Trash2, Edit3, CheckCircle2,
  X, ChevronDown, Check, LayoutGrid, List, Filter, History,
  AlertCircle, Navigation, ClipboardList, Timer, Loader2, Save,
  ChevronLeft, ChevronRight, Gift, Flag, AlertTriangle, ArrowRight,
  ArrowDown, TrendingUp, CalendarDays, Lock, Eye, FileText, Network,
  UserCheck, ShieldCheck, XCircle, ChevronRight as ChevronRightIcon,
  PackageCheck, Sparkles, Truck, CheckCircle, Activity, Flame,
  Building2, ArrowRightLeft, UserCircle, Landmark, Users, Briefcase,
  HeartPulse, ShieldAlert, UserPlus, Unlock, HelpCircle, RotateCcw
} from 'lucide-react';
import { DateTimePickerModal } from './DateTimePickerModal';
import { VehicleScheduleHistory } from './VehicleScheduleHistory';
import { VehicleScheduleApprovals } from './VehicleScheduleApprovals';
import { SelectionModal } from './SelectionModal';
import { VehicleScheduleDashboard } from './VehicleScheduleDashboard';
import { ConsultarVeiculoScreen } from './vehicle/ConsultarVeiculoScreen';
import { DriverRestRestrictionModal } from './modals/DriverRestRestrictionModal';
import { VehicleSchedulingLoadingModal } from './modals/VehicleSchedulingLoadingModal';
import { useSystemSettings } from '../contexts/SystemSettingsContext';
import { userCanAccessSubmodule } from '../services/permissionService';
import { validateDriverScheduleRules, fetchSystemHolidaysFromDatabase, getUnifiedHolidaysMap, toDateStr, DriverValidationResult, SystemHoliday } from '../services/driverRestRulesService';
import { getSectors } from '../services/entityService';
import { DEFAULT_SECTORS } from '../constants';
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
  const [isLoadingModalOpen, setIsLoadingModalOpen] = useState(true);

  const [dynamicSectors, setDynamicSectors] = useState<Sector[]>(() => {
    if (sectors && sectors.length > 0) return sectors;
    try {
      const cached = sessionStorage.getItem('cachedSectors');
      return cached ? JSON.parse(cached) : DEFAULT_SECTORS;
    } catch {
      return DEFAULT_SECTORS;
    }
  });

  useEffect(() => {
    if (sectors && sectors.length > 0) {
      setDynamicSectors(sectors);
    } else {
      getSectors().then(loaded => {
        if (loaded && loaded.length > 0) {
          setDynamicSectors(loaded);
          try {
            sessionStorage.setItem('cachedSectors', JSON.stringify(loaded));
          } catch (e) { }
        }
      }).catch(console.error);
    }
  }, [sectors]);

  const normalizeString = (str: string) =>
    str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

  const effectiveSectors = useMemo(() => {
    const list = dynamicSectors.length > 0 ? dynamicSectors : (sectors.length > 0 ? sectors : DEFAULT_SECTORS);
    const map = new Map<string, Sector>();
    DEFAULT_SECTORS.forEach(s => map.set(s.id, s));
    list.forEach(s => map.set(s.id, s));
    return Array.from(map.values());
  }, [dynamicSectors, sectors]);

  const resolveSectorName = (sectorIdOrName?: string): string => {
    if (!sectorIdOrName) return '';
    const clean = String(sectorIdOrName).trim();
    if (!clean) return '';

    // 1. Busca por id exato
    const byId = effectiveSectors.find(s => s.id === clean || s.id.toLowerCase() === clean.toLowerCase());
    if (byId) return byId.name;

    // 2. Busca por id no DEFAULT_SECTORS
    const byDefaultId = DEFAULT_SECTORS.find(s => s.id === clean || s.id.toLowerCase() === clean.toLowerCase());
    if (byDefaultId) {
      const inEffective = effectiveSectors.find(s => normalizeString(s.name) === normalizeString(byDefaultId.name));
      return inEffective ? inEffective.name : byDefaultId.name;
    }

    // 3. Se for nome do setor
    const norm = normalizeString(clean);
    const byName = effectiveSectors.find(s =>
      normalizeString(s.name) === norm ||
      normalizeString(s.name).includes(norm) ||
      norm.includes(normalizeString(s.name))
    );
    if (byName) return byName.name;

    return clean;
  };

  const getVehicleSectorName = (v: Vehicle): string => {
    if (!v) return 'Sem Setor';
    const rawId = v.sectorId || (v as any).sector_id;
    if (rawId) {
      const resolved = resolveSectorName(rawId);
      if (resolved && resolved !== rawId) return resolved;
      if (resolved) return resolved;
    }
    if ((v as any).sector_name) return (v as any).sector_name;
    if ((v as any).sector && typeof (v as any).sector === 'string') return resolveSectorName((v as any).sector);
    return 'Sem Setor';
  };

  const getPersonSectorName = (p: Person): string => {
    if (!p) return 'Sem setor vinculado';
    const rawId = p.sectorId || (p as any).sector_id;
    if (rawId) {
      const resolved = resolveSectorName(rawId);
      if (resolved && resolved !== rawId) return resolved;
      if (resolved) return resolved;
    }
    if ((p as any).sector && typeof (p as any).sector === 'string') return resolveSectorName((p as any).sector);
    return 'Sem setor vinculado';
  };

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

  const [systemHolidays, setSystemHolidays] = useState<SystemHoliday[]>([]);
  const [driverRestModal, setDriverRestModal] = useState<{
    isOpen: boolean;
    result: DriverValidationResult | null;
    driver?: Person | null;
    vehicle?: Vehicle | null;
  }>({
    isOpen: false,
    result: null,
    driver: null,
    vehicle: null
  });

  useEffect(() => {
    fetchSystemHolidaysFromDatabase().then(holidays => {
      if (holidays && holidays.length > 0) {
        setSystemHolidays(holidays);
      }
    });
  }, []);

  // Estados de controle da Aba Tripulação
  const [isTripulacaoUnlocked, setIsTripulacaoUnlocked] = useState(false);
  const [isSpecialTreatmentTrip, setIsSpecialTreatmentTrip] = useState<boolean | null>(null);
  const [isTripulacaoModalOpen, setIsTripulacaoModalOpen] = useState(false);
  const [tripulacaoModalStep, setTripulacaoModalStep] = useState<1 | 2>(1);
  const [selectedSpecialOption, setSelectedSpecialOption] = useState<'sim' | 'nao' | ''>('');
  const [newPassengerType, setNewPassengerType] = useState<'paciente' | 'acompanhante' | 'passageiro'>('paciente');

  // Identificação do veículo selecionado e verificação de Van de Hemodiálise (Placa UEA1J55 / UAE1J55)
  const selectedVehicle = useMemo(() => {
    return vehicles.find(v => v.id === formData.vehicleId);
  }, [vehicles, formData.vehicleId]);

  const isHemodialysisVan = useMemo(() => {
    if (!selectedVehicle) return false;
    const cleanPlate = (selectedVehicle.plate || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    return cleanPlate === 'UEA1J55' || 
           cleanPlate === 'UAE1J55' || 
           cleanPlate.includes('UEA1J55') || 
           cleanPlate.includes('UAE1J55') ||
           cleanPlate.endsWith('1J55') ||
           selectedVehicle.id === '7e1a30d6-bc38-4302-8399-19f052f5697d';
  }, [selectedVehicle]);

  const maxVanCrewCapacity = useMemo(() => {
    if (!selectedVehicle) return 15;
    if (selectedVehicle.passengerCapacity !== undefined && selectedVehicle.passengerCapacity > 5) {
      return selectedVehicle.passengerCapacity;
    }
    if (selectedVehicle.passengerCapacity !== undefined && selectedVehicle.passengerCapacity > 1) {
      return selectedVehicle.passengerCapacity;
    }
    return 15;
  }, [selectedVehicle]);

  // Cálculos de limites da tripulação
  const patientCount = useMemo(() => {
    return (formData.passengers || []).filter(p => p.type === 'paciente').length;
  }, [formData.passengers]);

  const companionCount = useMemo(() => {
    return (formData.passengers || []).filter(p => p.type === 'acompanhante').length;
  }, [formData.passengers]);

  const totalCrewCount = useMemo(() => {
    return (formData.passengers || []).length;
  }, [formData.passengers]);

  const isSpecialLimitReached = useMemo(() => {
    if (!isSpecialTreatmentTrip) return false;
    if (isHemodialysisVan) {
      return totalCrewCount >= maxVanCrewCapacity;
    }
    return totalCrewCount >= 3 || (patientCount >= 1 && companionCount >= 2);
  }, [isSpecialTreatmentTrip, isHemodialysisVan, totalCrewCount, maxVanCrewCapacity, patientCount, companionCount]);

  const handleOpenTripulacaoModal = () => {
    if (!formData.vehicleId) {
      showToast("Selecione o Veículo Operacional na aba 'Dados Gerais' antes de configurar a Tripulação.", "warning");
      setModalActiveTab('dados_gerais');
      setActiveSelectionField('vehicle');
      return;
    }
    setSelectedSpecialOption(isSpecialTreatmentTrip === true ? 'sim' : isSpecialTreatmentTrip === false ? 'nao' : '');
    setTripulacaoModalStep(1);
    setIsTripulacaoModalOpen(true);
  };

  const handleConfirmSpecialQuestion = () => {
    if (!selectedSpecialOption) {
      showToast("Por favor, selecione 'Sim' ou 'Não' para continuar.", "warning");
      return;
    }
    if (selectedSpecialOption === 'sim') {
      setTripulacaoModalStep(2);
    } else {
      setIsTripulacaoUnlocked(true);
      setIsSpecialTreatmentTrip(false);
      setNewPassengerType('passageiro');
      setIsTripulacaoModalOpen(false);
      showToast("Tripulação desbloqueada para viagem convencional.", "success");
    }
  };

  const handleConfirmSpecialWarning = () => {
    setIsTripulacaoUnlocked(true);
    setIsSpecialTreatmentTrip(true);
    if (isHemodialysisVan) {
      setNewPassengerType('paciente');
      setIsTripulacaoModalOpen(false);
      showToast("Tripulação liberada para a Van Exclusiva de Hemodiálise (múltiplos pacientes permitidos).", "success");
    } else {
      if (patientCount === 0) {
        setNewPassengerType('paciente');
      } else if (companionCount < 2) {
        setNewPassengerType('acompanhante');
      }
      setIsTripulacaoModalOpen(false);
      showToast("Tripulação liberada para paciente oncológico/hemodiálise com veículo de uso exclusivo.", "success");
    }
  };

  const handleAddPassenger = () => {
    if (!formData.vehicleId) {
      showToast("Selecione o Veículo Operacional antes de adicionar integrantes à tripulação.", "warning");
      setModalActiveTab('dados_gerais');
      setActiveSelectionField('vehicle');
      return;
    }

    if (!isTripulacaoUnlocked) {
      showToast("Clique no botão ADICIONAR TRIPULAÇÃO para liberar os campos.", "warning");
      return;
    }

    if (!newPassenger.name?.trim() || !newPassenger.departureLocation?.trim() || !newPassenger.appointmentTime?.trim() || !newPassenger.appointmentLocation?.trim()) {
      showToast("Preencha todos os campos do integrante da tripulação.", "warning");
      return;
    }

    if (isSpecialTreatmentTrip) {
      const targetType = newPassengerType || (patientCount === 0 ? 'paciente' : 'acompanhante');

      if (isHemodialysisVan) {
        if (totalCrewCount >= maxVanCrewCapacity) {
          showToast(`Limite máximo da Van (${maxVanCrewCapacity} passageiros) atingido.`, "warning");
          return;
        }
      } else {
        if (totalCrewCount >= 3) {
          showToast("Limite máximo de 03 pessoas atingido nesta viagem exclusiva.", "warning");
          return;
        }

        if (targetType === 'paciente' && patientCount >= 1) {
          showToast("Não é permitido adicionar um segundo paciente em viagem convencional (máximo 01 paciente).", "error");
          return;
        }

        if (targetType === 'acompanhante' && companionCount >= 2) {
          showToast("Não é permitido adicionar mais de 02 acompanhantes (máximo 02).", "error");
          return;
        }
      }

      const memberToAdd: CrewMember = {
        name: newPassenger.name.trim(),
        departureLocation: newPassenger.departureLocation.trim(),
        appointmentTime: newPassenger.appointmentTime.trim(),
        appointmentLocation: newPassenger.appointmentLocation.trim(),
        type: targetType
      };

      const nextPassengers = [...(formData.passengers || []), memberToAdd];
      const nextPCount = nextPassengers.filter(p => p.type === 'paciente').length;
      const nextCCount = nextPassengers.filter(p => p.type === 'acompanhante').length;

      setFormData(prev => ({
        ...prev,
        passengers: nextPassengers,
        patientCount: nextPCount,
        companionCount: nextCCount
      }));

      setNewPassenger({ name: '', departureLocation: '', appointmentTime: '', appointmentLocation: '' });
      if (!isHemodialysisVan && targetType === 'paciente' && nextCCount < 2) {
        setNewPassengerType('acompanhante');
      }
      showToast(`${targetType === 'paciente' ? 'Paciente' : 'Acompanhante'} adicionado à tripulação!`, "success");
    } else {
      const memberToAdd: CrewMember = {
        name: newPassenger.name.trim(),
        departureLocation: newPassenger.departureLocation.trim(),
        appointmentTime: newPassenger.appointmentTime.trim(),
        appointmentLocation: newPassenger.appointmentLocation.trim(),
        type: 'passageiro'
      };

      const nextPassengers = [...(formData.passengers || []), memberToAdd];
      setFormData(prev => ({
        ...prev,
        passengers: nextPassengers,
        patientCount: 0,
        companionCount: 0
      }));

      setNewPassenger({ name: '', departureLocation: '', appointmentTime: '', appointmentLocation: '' });
      showToast("Passageiro adicionado à tripulação.", "success");
    }
  };

  const handleRemovePassenger = (index: number) => {
    const nextPassengers = (formData.passengers || []).filter((_, i) => i !== index);
    const nextPCount = nextPassengers.filter(p => p.type === 'paciente').length;
    const nextCCount = nextPassengers.filter(p => p.type === 'acompanhante').length;

    setFormData(prev => ({
      ...prev,
      passengers: nextPassengers,
      patientCount: nextPCount,
      companionCount: nextCCount
    }));

    if (isSpecialTreatmentTrip && !isHemodialysisVan && nextPCount === 0) {
      setNewPassengerType('paciente');
    }
  };

  const showToast = (message: string, type: 'error' | 'success' | 'warning' = 'error') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 4000);
  };


  const onUpdateStatusSchedule = async (id: string, status: ScheduleStatus, cancellationDetails?: { reason: string, cancelledBy: string }) => {
    const schedule = (schedules || []).find(s => s.id === id);
    if (schedule) {
      try {
        if (status === 'confirmado') {
          const selectedDriverObj = persons.find(p => p.id === schedule.driverId);
          const val = validateDriverScheduleRules({
            driverId: schedule.driverId,
            driverName: selectedDriverObj?.name,
            departureDateTime: schedule.departureDateTime,
            returnDateTime: schedule.returnDateTime,
            allSchedules: schedules,
            customHolidays: systemHolidays,
            excludeScheduleId: id
          });

          if (!val.isValid) {
            setDriverRestModal({
              isOpen: true,
              result: val,
              driver: selectedDriverObj,
              vehicle: vehicles.find(v => v.id === schedule.vehicleId)
            });
            showToast(val.message || "Aprovação impedida: Motorista com restrição de descanso.", "error");
            return;
          }
        }

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
      } catch (error: any) {
        console.error("Erro ao atualizar status:", error);
        showToast(error?.message || "Erro ao atualizar status.", "error");
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

  const holidaysMap = useMemo(() => {
    const years = [currentDate.getFullYear() - 1, currentDate.getFullYear(), currentDate.getFullYear() + 1];
    return getUnifiedHolidaysMap(years, systemHolidays);
  }, [currentDate, systemHolidays]);

  const getDriverValidation = (driverId: string, driverName?: string, dep?: string, ret?: string): DriverValidationResult => {
    const departure = dep || formData.departureDateTime;
    const returnDate = ret || formData.returnDateTime;
    if (!departure || !returnDate || !driverId) {
      return { isValid: true };
    }
    return validateDriverScheduleRules({
      driverId,
      driverName,
      departureDateTime: departure,
      returnDateTime: returnDate,
      allSchedules: schedules,
      customHolidays: systemHolidays,
      excludeScheduleId: editingSchedule?.id
    });
  };

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
    for (let i = 1; i <= daysInMonth; i++) {
      const dateObj = new Date(year, month, i);
      const dIso = toDateStr(dateObj);
      const holidayName = holidaysMap.get(dIso);
      days.push({ day: i, month, year, isCurrent: true, holidayName, dateObj });
    }
    while (days.length < 42) days.push({ day: days.length - (daysInMonth + firstDay) + 1, month: month + 1, year, isCurrent: false });
    return days;
  }, [currentDate, holidaysMap]);

  const monthDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const list = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(year, month, d);
      const dIso = toDateStr(dateObj);
      const holidayName = holidaysMap.get(dIso);
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
  }, [currentDate, selectedCalendarDate, schedules, holidaysMap]);

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
      if (validSectorId && !effectiveSectors.some(sec => sec.id === validSectorId)) {
        const p = persons.find(per => per.id === s.requesterPersonId);
        const pSec = p?.sectorId || (p as any)?.sector_id;
        if (pSec && effectiveSectors.some(sec => sec.id === pSec)) {
          validSectorId = pSec;
        } else {
          const v = vehicles.find(veh => veh.id === s.vehicleId);
          const vSec = v?.sectorId || (v as any)?.sector_id;
          if (vSec && effectiveSectors.some(sec => sec.id === vSec)) {
            validSectorId = vSec;
          } else {
            validSectorId = '';
          }
        }
      }
      setFormData({ ...s, serviceSectorId: validSectorId });
      const hasCrew = !!(s.passengers && s.passengers.length > 0);
      setIsTripulacaoUnlocked(hasCrew);
      const isSpec = hasCrew && (s.passengers!.some(p => p.type === 'paciente' || p.type === 'acompanhante') || (s.patientCount || 0) > 0);
      setIsSpecialTreatmentTrip(hasCrew ? isSpec : null);
      if (isSpec) {
        const pCount = s.passengers!.filter(p => p.type === 'paciente').length;
        setNewPassengerType(pCount >= 1 ? 'acompanhante' : 'paciente');
      } else {
        setNewPassengerType('passageiro');
      }
    } else {
      setEditingSchedule(null);
      setIsTripulacaoUnlocked(false);
      setIsSpecialTreatmentTrip(null);
      setIsTripulacaoModalOpen(false);
      setTripulacaoModalStep(1);
      setSelectedSpecialOption('');
      setNewPassengerType('paciente');

      const now = new Date();
      let departure = initialDate ? new Date(initialDate) : now;
      if (departure < now) departure = now;
      if (!initialDate) departure.setMinutes(0, 0, 0);
      const returnDate = initialReturnDate ? new Date(initialReturnDate) : new Date(departure.getTime() + (4 * 60 * 60 * 1000));
      
      // Resolve setor inicial com validação
      let defaultSectorId = '';
      
      // 1. Tenta pelo sectorId da pessoa logada
      const userPersonSec = currentUserPerson?.sectorId || (currentUserPerson as any)?.sector_id;
      if (userPersonSec && effectiveSectors.some(s => s.id === userPersonSec)) {
        defaultSectorId = userPersonSec;
      }
      
      // 2. Tenta pelo currentUserSectorId explicitamente recebido
      if (!defaultSectorId && currentUserSectorId && effectiveSectors.some(s => s.id === currentUserSectorId)) {
        defaultSectorId = currentUserSectorId;
      }

      // 3. Tenta pelo currentUserSector (que pode ser ID ou nome do setor)
      if (!defaultSectorId && currentUserSector) {
        const byId = effectiveSectors.find(s => s.id === currentUserSector);
        if (byId) {
          defaultSectorId = byId.id;
        } else {
          const searchSector = normalizeString(currentUserSector);
          const matchedSector = effectiveSectors.find(s =>
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
        const vSec = v?.sectorId || (v as any)?.sector_id;
        if (vSec && effectiveSectors.some(s => s.id === vSec)) {
          defaultSectorId = vSec;
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
    const validSector = effectiveSectors.find(s => s.id === formData.serviceSectorId);
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

    if (isSpecialTreatmentTrip) {
      const pCount = (formData.passengers || []).filter(p => p.type === 'paciente').length;
      const cCount = (formData.passengers || []).filter(p => p.type === 'acompanhante').length;
      if (!isHemodialysisVan) {
        if (pCount > 1) {
          showToast("Viagem exclusiva convencional permite no máximo 01 paciente.", "error");
          return;
        }
        if (cCount > 2) {
          showToast("Viagem exclusiva convencional permite no máximo 02 acompanhantes.", "error");
          return;
        }
        if (pCount + cCount > 3) {
          showToast("Viagem exclusiva convencional permite no máximo 03 pessoas na tripulação.", "error");
          return;
        }
      }
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

    // Validação Obrigatória das Regras de Descanso e Disponibilidade do Motorista
    const selectedDriverObj = persons.find(p => p.id === formData.driverId);
    const driverValidation = validateDriverScheduleRules({
      driverId: formData.driverId!,
      driverName: selectedDriverObj?.name,
      departureDateTime: formData.departureDateTime!,
      returnDateTime: formData.returnDateTime!,
      allSchedules: schedules,
      customHolidays: systemHolidays,
      excludeScheduleId: editingSchedule?.id
    });

    if (!driverValidation.isValid) {
      setDriverRestModal({
        isOpen: true,
        result: driverValidation,
        driver: selectedDriverObj,
        vehicle: selectedVehicle
      });
      showToast(driverValidation.message || "Motorista indisponível pelas regras de descanso.", "error");
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

      const finalPatientCount = isSpecialTreatmentTrip
        ? (formData.passengers || []).filter(p => p.type === 'paciente').length
        : (formData.passengers?.length || 0);
      const finalCompanionCount = isSpecialTreatmentTrip
        ? (formData.passengers || []).filter(p => p.type === 'acompanhante').length
        : 0;

      if (editingSchedule) {
        // Update
        const data = {
          ...formData,
          status: finalStatus,
          authorizedByName: authorizedBy,
          departureDateTime: utcDeparture,
          returnDateTime: utcReturn,
          patientCount: finalPatientCount,
          companionCount: finalCompanionCount,
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
          patientCount: finalPatientCount,
          companionCount: finalCompanionCount,
          requesterId: currentUserId,
          // id and createdAt will be generated by backend
        } as any; // Cast to any or strict omit type 
        await onAddSchedule(data);
        showToast(hasAuthority ? "Agendamento aprovado e realizado!" : "Agendamento realizado com sucesso!", "success");
      }
      setIsModalOpen(false);
    } catch (error: any) {
      console.error("Erro ao salvar:", error);
      const errorMsg = error?.message || "Erro ao processar agendamento. Tente novamente.";
      showToast(errorMsg, "error");
      if (errorMsg.includes('descanso') || errorMsg.includes('consecutivos') || errorMsg.includes('sábado') || errorMsg.includes('domingo') || errorMsg.includes('feriado')) {
        setDriverRestModal({
          isOpen: true,
          result: {
            isValid: false,
            title: 'Motorista Indisponível',
            message: errorMsg
          },
          driver: selectedDriverObj,
          vehicle: selectedVehicle
        });
      }
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

          {/* Ações da Barra Superior: Sincronizar & Novo Agendamento */}
          <div className="flex items-center gap-2 order-2 md:order-3 shrink-0">
            <button
              type="button"
              onClick={() => setIsLoadingModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 hover:text-indigo-600 border border-slate-200 shadow-xs hover:shadow-sm text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
              title="Recarregar e sincronizar dados da frota e viagens em tempo real"
            >
              <RotateCcw className="w-3.5 h-3.5 text-indigo-600" />
              <span className="hidden sm:inline">Sincronizar</span>
            </button>

            {canAccessAgendar && (
              <button
                type="button"
                onClick={() => handleStartNovoAgendamento()}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-95 shadow-md shadow-indigo-600/25 cursor-pointer"
                title="Cadastrar nova solicitação de viagem"
              >
                <Plus className="w-4 h-4" />
                <span>Novo Agendamento</span>
              </button>
            )}
          </div>
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
    const selectedSector = effectiveSectors.find(s => s.id === formData.serviceSectorId);

    const tabs: { id: 'dados_gerais' | 'destino' | 'data' | 'objetivo' | 'tripulacao'; label: string; icon: any }[] = [
      { id: 'dados_gerais', label: 'Dados Gerais', icon: ClipboardList },
      { id: 'destino', label: 'Destino', icon: MapPin },
      { id: 'data', label: 'Horários', icon: Clock },
      { id: 'objetivo', label: 'Objetivo', icon: FileText },
      { id: 'tripulacao', label: 'Tripulação', icon: Users },
    ];

    const handleTabChange = (tabId: 'dados_gerais' | 'destino' | 'data' | 'objetivo' | 'tripulacao') => {
      if (tabId === 'tripulacao' && !formData.vehicleId) {
        showToast("Por favor, selecione o Veículo Operacional na aba 'Dados Gerais' antes de acessar a Tripulação.", "warning");
        setActiveSelectionField('vehicle');
        return;
      }
      setModalActiveTab(tabId);
    };

    const currentTabIndex = tabs.findIndex(t => t.id === modalActiveTab);

    return (
      <div className="flex-1 flex flex-col overflow-hidden animate-fade-in h-full bg-slate-100/60">
        {/* Header Compacto com Ações Integradas */}
        <div className="bg-white border-b border-slate-200/80 px-4 md:px-6 py-2 flex flex-row items-center justify-between gap-3 shrink-0 z-20 shadow-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <button 
              type="button"
              onClick={() => handleSubViewChange('calendar')} 
              className="w-8 h-8 md:w-9 md:h-9 bg-white rounded-xl flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200/80 shadow-xs transition-all active:scale-95 group shrink-0 cursor-pointer"
              title="Voltar para o Calendário"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <div className="p-1 rounded-lg bg-indigo-50 text-indigo-600 shrink-0">
                  <Car className="w-4 h-4" />
                </div>
                <h2 className="text-base md:text-lg font-black text-slate-900 uppercase tracking-tight leading-none truncate">
                  {editingSchedule ? 'Editar Agendamento' : 'Novo Agendamento'}
                </h2>
              </div>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 ml-0.5 truncate hidden sm:block">
                Preenchimento dos dados da nova viagem
              </p>
            </div>
          </div>

          {/* Botões Cancelar e Salvar no Topo Compactos */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => handleSubViewChange('calendar')}
              className="px-3 py-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 font-bold rounded-xl text-xs uppercase tracking-wider transition-colors cursor-pointer border border-transparent hover:border-rose-100"
              disabled={isSaving}
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-black rounded-xl shadow-md shadow-indigo-600/25 transition-all hover:-translate-y-0.5 active:scale-95 flex items-center justify-center gap-1.5 uppercase text-xs tracking-wider disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>{isSaving ? 'Salvando...' : (editingSchedule ? 'Atualizar Dados' : 'Salvar Agendamento')}</span>
            </button>
          </div>
        </div>

        {/* Form Container Expandido em Tela Cheia */}
        <div className="flex-1 flex flex-col p-2 md:p-4 overflow-hidden">
          {/* Form Tabs Card */}
          <div className="flex-1 flex flex-col bg-white rounded-2xl md:rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden h-full">
            
            {/* Tab Navigation */}
            <div className="px-4 md:px-6 pt-2 bg-slate-50/70 border-b border-slate-200/80 flex overflow-x-auto custom-scrollbar gap-2 shrink-0">
              {tabs.map((tab) => {
                const TabIcon = tab.icon;
                const isActive = modalActiveTab === tab.id;
                const isTripulacaoLocked = tab.id === 'tripulacao' && !formData.vehicleId;

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => handleTabChange(tab.id)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-black uppercase tracking-wider transition-all border-b-2 shrink-0 cursor-pointer ${
                      isActive
                        ? 'border-indigo-600 text-indigo-600 bg-white shadow-xs'
                        : isTripulacaoLocked
                          ? 'border-transparent text-slate-400 hover:text-amber-600 bg-transparent'
                          : 'border-transparent text-slate-400 hover:text-slate-700 bg-transparent'
                    }`}
                    title={isTripulacaoLocked ? "Selecione o veículo operacional na aba 'Dados Gerais' antes de acessar a tripulação" : undefined}
                  >
                    {isTripulacaoLocked ? (
                      <Lock className="w-4 h-4 text-amber-500 shrink-0" />
                    ) : (
                      <TabIcon className="w-4 h-4 shrink-0" />
                    )}
                    <span>{tab.label}</span>
                    {isTripulacaoLocked && (
                      <span className="px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700 text-[9px] font-bold uppercase tracking-wider">
                        Requer Veículo
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Tab Bodies com Rolagem Suave */}
            <div className={`p-4 md:p-6 lg:p-8 flex-1 ${modalActiveTab === 'tripulacao' && (!isTripulacaoUnlocked || !formData.vehicleId) ? 'overflow-hidden flex flex-col' : 'overflow-y-auto custom-scrollbar'}`}>
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
                  !formData.vehicleId ? (
                    /* ESTADO BLOQUEADO: VEÍCULO NÃO INFORMADO */
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8 my-auto space-y-4 max-w-md mx-auto animate-fade-in select-none">
                      <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/20 text-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/10">
                        <Lock className="w-8 h-8" />
                      </div>
                      <div className="space-y-1.5">
                        <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">Veículo Não Informado</h3>
                        <p className="text-xs text-slate-500 leading-relaxed font-medium">
                          Para configurar a tripulação e aplicar as regras corretas de capacidade e triagem oncológica/hemodiálise, informe primeiro o <strong className="text-slate-700">Veículo Operacional</strong> na aba Dados Gerais.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setModalActiveTab('dados_gerais');
                          setActiveSelectionField('vehicle');
                        }}
                        className="px-6 py-3 bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-black rounded-2xl text-xs uppercase tracking-wider transition-all shadow-md shadow-indigo-600/25 flex items-center gap-2 cursor-pointer hover:scale-[1.02] active:scale-95"
                      >
                        <Car className="w-4 h-4" />
                        <span>Selecionar Veículo Agora</span>
                      </button>
                    </div>
                  ) : !isTripulacaoUnlocked ? (
                    /* ESTADO INICIAL: APENAS 1 BOTÃO CENTRALIZADO SEM NENHUMA ROLAGEM */
                    <div className="flex-1 flex flex-col items-center justify-center text-center w-full h-full my-auto animate-fade-in p-4 select-none">
                      <button
                        type="button"
                        onClick={handleOpenTripulacaoModal}
                        className="px-8 md:px-12 py-4 md:py-5 bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-black rounded-2xl shadow-xl shadow-indigo-600/25 text-xs md:text-sm uppercase tracking-wider flex items-center justify-center gap-2.5 transition-all hover:scale-[1.03] active:scale-95 cursor-pointer border border-indigo-400/30"
                      >
                        <Plus className="w-5 h-5" />
                        <span>ADICIONAR TRIPULAÇÃO</span>
                      </button>
                    </div>
                  ) : (
                    /* ESTADO LIBERADO DA TRIPULAÇÃO */
                    <div className="space-y-5 animate-fade-in">
                      {/* Banner Informativo do Tipo de Viagem */}
                      {isSpecialTreatmentTrip ? (
                        isHemodialysisVan ? (
                          /* BANNER ESPECÍFICO DA VAN DE HEMODIÁLISE (UEA1J55) */
                          <div className="p-4 md:p-5 rounded-2xl bg-gradient-to-r from-teal-500/10 via-indigo-500/10 to-purple-500/10 border border-teal-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-teal-500/20 text-teal-700 flex items-center justify-center shrink-0 border border-teal-500/30">
                                <HeartPulse className="w-5 h-5 text-teal-600" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="text-xs md:text-sm font-black text-slate-900 uppercase tracking-tight">Van Exclusiva de Hemodiálise</h4>
                                  <span className="px-2 py-0.5 rounded-md bg-teal-100 text-teal-800 font-black text-[9px] uppercase tracking-wider border border-teal-200">
                                    Placa: {selectedVehicle?.plate || 'UEA1J55'}
                                  </span>
                                  <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 font-black text-[9px] uppercase tracking-wider border border-indigo-200">
                                    Múltiplos Pacientes Liberados
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                                  Van destinada exclusivamente ao transporte conjunto de pacientes de hemodiálise e acompanhantes autorizados.
                                </p>
                              </div>
                            </div>

                            {/* Contadores da Van de Hemodiálise */}
                            <div className="flex items-center gap-2 flex-wrap self-stretch md:self-auto justify-end">
                              <div className="px-2.5 py-1 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5">
                                <HeartPulse className="w-3 h-3" /> Pacientes: {patientCount}
                              </div>
                              <div className="px-2.5 py-1 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5">
                                <Users className="w-3 h-3" /> Acompanhantes: {companionCount}
                              </div>
                              <div className={`px-2.5 py-1 rounded-xl border text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 ${
                                isSpecialLimitReached ? 'bg-purple-100 text-purple-800 border-purple-300' : 'bg-slate-100 text-slate-700 border-slate-300'
                              }`}>
                                Total: {totalCrewCount}/{maxVanCrewCapacity} máx.
                              </div>
                              <button
                                type="button"
                                onClick={handleOpenTripulacaoModal}
                                className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 underline uppercase tracking-wider ml-1 cursor-pointer"
                                title="Reabrir triagem de tripulação"
                              >
                                Alterar Modo
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* BANNER DE VEÍCULO CONVENCIONAL EXCLUSIVO */
                          <div className="p-4 md:p-5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-indigo-500/10 to-purple-500/10 border border-amber-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-700 flex items-center justify-center shrink-0 border border-amber-500/30">
                                <HeartPulse className="w-5 h-5 text-amber-600" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="text-xs md:text-sm font-black text-slate-900 uppercase tracking-tight">Viagem Exclusiva: Oncológico / Hemodiálise</h4>
                                  <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-black text-[9px] uppercase tracking-wider border border-amber-200">Uso Exclusivo</span>
                                </div>
                                <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                                  Veículo restrito ao paciente e acompanhantes autorizados.
                                </p>
                              </div>
                            </div>

                            {/* Contadores da Viagem Especial Convencional */}
                            <div className="flex items-center gap-2 flex-wrap self-stretch md:self-auto justify-end">
                              <div className={`px-2.5 py-1 rounded-xl border text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 ${
                                patientCount >= 1 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-600 border-slate-200'
                              }`}>
                                <UserIcon className="w-3 h-3" /> Paciente: {patientCount}/1
                              </div>
                              <div className={`px-2.5 py-1 rounded-xl border text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 ${
                                companionCount >= 2 ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-slate-50 text-slate-600 border-slate-200'
                              }`}>
                                <Users className="w-3 h-3" /> Acompanhantes: {companionCount}/2
                              </div>
                              <div className={`px-2.5 py-1 rounded-xl border text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 ${
                                isSpecialLimitReached ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-slate-100 text-slate-700 border-slate-300'
                              }`}>
                                Total: {totalCrewCount}/3
                              </div>
                              <button
                                type="button"
                                onClick={handleOpenTripulacaoModal}
                                className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 underline uppercase tracking-wider ml-1 cursor-pointer"
                                title="Reabrir triagem de tripulação"
                              >
                                Alterar Modo
                              </button>
                            </div>
                          </div>
                        )
                      ) : (
                        <div className="p-3.5 px-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                              <Users className="w-4 h-4" />
                            </div>
                            <div>
                              <span className="text-xs font-black text-slate-800 uppercase tracking-tight">Viagem Convencional</span>
                              <p className="text-[10px] text-slate-400 font-medium">Sem restrição oncológica/hemodiálise aplicada.</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={handleOpenTripulacaoModal}
                            className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 underline uppercase tracking-wider cursor-pointer"
                          >
                            Alterar Modo
                          </button>
                        </div>
                      )}

                      {/* Formulário de Inclusão de Integrante */}
                      <div>
                        <label className={labelClass}><Users className="w-3.5 h-3.5 inline mr-1.5 text-indigo-500" /> Adicionar Passageiro / Tripulante</label>
                        
                        {/* Seletor de Categoria se for Viagem Especial */}
                        {isSpecialTreatmentTrip && (
                          <div className="mb-3 flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 mr-1">Tipo de Integrante:</span>
                            
                            <button
                              type="button"
                              disabled={isSpecialLimitReached || (!isHemodialysisVan && patientCount >= 1)}
                              onClick={() => setNewPassengerType('paciente')}
                              className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer border ${
                                newPassengerType === 'paciente'
                                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                                  : (!isHemodialysisVan && patientCount >= 1) || isSpecialLimitReached
                                    ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              <HeartPulse className="w-3.5 h-3.5" />
                              <span>
                                {isHemodialysisVan
                                  ? `Paciente (${patientCount})`
                                  : `Paciente ${patientCount >= 1 ? '(Limite 1/1 atingido)' : '(Máx. 1)'}`}
                              </span>
                            </button>

                            <button
                              type="button"
                              disabled={isSpecialLimitReached || (!isHemodialysisVan && companionCount >= 2)}
                              onClick={() => setNewPassengerType('acompanhante')}
                              className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer border ${
                                newPassengerType === 'acompanhante'
                                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                                  : (!isHemodialysisVan && companionCount >= 2) || isSpecialLimitReached
                                    ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              <Users className="w-3.5 h-3.5" />
                              <span>
                                {isHemodialysisVan
                                  ? `Acompanhante (${companionCount})`
                                  : `Acompanhante ${companionCount >= 2 ? '(Limite 2/2 atingido)' : `(${companionCount}/2)`}`}
                              </span>
                            </button>
                          </div>
                        )}

                        {isSpecialLimitReached ? (
                          <div className={`p-4 rounded-2xl text-center space-y-1 ${
                            isHemodialysisVan
                              ? 'bg-teal-50/80 border border-teal-200 text-teal-900'
                              : 'bg-amber-50/80 border border-amber-200 text-amber-900'
                          }`}>
                            <p className="text-xs font-black uppercase tracking-tight flex items-center justify-center gap-1.5">
                              <ShieldCheck className={`w-4 h-4 ${isHemodialysisVan ? 'text-teal-600' : 'text-amber-600'}`} />
                              {isHemodialysisVan
                                ? `Limite Máximo da Van Atingido (${maxVanCrewCapacity} Passageiros)`
                                : 'Limite Máximo da Tripulação Atingido (03 Pessoas)'}
                            </p>
                            <p className="text-[11px] opacity-80 font-medium">
                              {isHemodialysisVan
                                ? `Esta Van de Hemodiálise atingiu a lotação máxima de passageiros permitida (${maxVanCrewCapacity} pessoas). Para adicionar um novo integrante, remova um da lista abaixo.`
                                : 'Esta viagem oncológica/hemodiálise já atingiu a lotação permitida (01 paciente e até 02 acompanhantes). Para adicionar um novo integrante, remova um da lista abaixo.'}
                            </p>
                          </div>
                        ) : (
                          <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80 space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <input
                                type="text"
                                value={newPassenger.name}
                                onChange={e => setNewPassenger({ ...newPassenger, name: e.target.value })}
                                placeholder={isSpecialTreatmentTrip ? (newPassengerType === 'paciente' ? "Nome completo do paciente..." : "Nome do acompanhante...") : "Nome completo..."}
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
                                placeholder={isSpecialTreatmentTrip ? "Hospital / Clínica / Destino do compromisso..." : "Local do compromisso / consulta..."}
                                className={inputClass}
                              />
                            </div>

                            <button
                              type="button"
                              onClick={handleAddPassenger}
                              className="w-full py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-black rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 border border-indigo-200 cursor-pointer shadow-2xs hover:shadow-xs"
                            >
                              <Plus className="w-4 h-4" /> Adicionar à Tripulação {isSpecialTreatmentTrip && `(${newPassengerType === 'paciente' ? 'Paciente' : 'Acompanhante'})`}
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Passengers List */}
                      {formData.passengers && formData.passengers.length > 0 ? (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                              Passageiros Confirmados ({formData.passengers.length}):
                            </span>
                            {isSpecialTreatmentTrip && (
                              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600">
                                {isHemodialysisVan
                                  ? `Lotação: ${formData.passengers.length} de ${maxVanCrewCapacity} máx.`
                                  : `Lotação: ${formData.passengers.length} de 3 máx.`}
                              </span>
                            )}
                          </div>
                          <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-xs">
                            {formData.passengers.map((p, idx) => (
                              <div key={idx} className="p-3.5 flex items-center justify-between gap-3 text-xs hover:bg-slate-50/50 transition-colors">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <p className="font-black text-slate-900 truncate">{p.name}</p>
                                    {p.type === 'paciente' && (
                                      <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-black text-[9px] uppercase tracking-wider border border-emerald-200 inline-flex items-center gap-1">
                                        <HeartPulse className="w-2.5 h-2.5" /> Paciente
                                      </span>
                                    )}
                                    {p.type === 'acompanhante' && (
                                      <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 font-black text-[9px] uppercase tracking-wider border border-indigo-200 inline-flex items-center gap-1">
                                        <Users className="w-2.5 h-2.5" /> Acompanhante
                                      </span>
                                    )}
                                    {(p.type === 'passageiro' || !p.type) && (
                                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-black text-[9px] uppercase tracking-wider border border-slate-200">
                                        Passageiro
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5 truncate">
                                    Partida: {p.departureLocation} | Horário: {p.appointmentTime} | Local: {p.appointmentLocation}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleRemovePassenger(idx)}
                                  className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer shrink-0"
                                  title="Remover passageiro"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                          <Users className="w-6 h-6 text-slate-300 mx-auto mb-1.5" />
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nenhum passageiro adicionado ainda</p>
                        </div>
                      )}
                    </div>
                  )
                )}
              </div>

              {/* Form Navigation Discreta */}
              <div className="px-4 md:px-6 py-2.5 bg-slate-50/80 border-t border-slate-100 flex justify-between items-center gap-3 shrink-0">
                <div>
                  {currentTabIndex > 0 && (
                    <button
                      type="button"
                      onClick={() => setModalActiveTab(tabs[currentTabIndex - 1].id)}
                      className="px-3.5 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 font-bold rounded-xl text-xs uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" /> Anterior
                    </button>
                  )}
                </div>

                <div>
                  {currentTabIndex < tabs.length - 1 && (
                    <button
                      type="button"
                      onClick={() => setModalActiveTab(tabs[currentTabIndex + 1].id)}
                      className="px-3.5 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 font-bold rounded-xl text-xs uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                    >
                      Próximo <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

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
          sectors={effectiveSectors}
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
          sectors={effectiveSectors}
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
          sectors={effectiveSectors}
          onBack={() => handleSubViewChange('menu')}
        />
      ) : renderAccessDenied())}
      {activeSubView === 'consultar' && (canAccessConsultar ? (
        <ConsultarVeiculoScreen
          sectors={effectiveSectors}
          persons={persons}
          vehicles={vehicles}
          onBack={() => handleSubViewChange('menu')}
          onNavigate={onNavigate}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          onSelectVehicleToSchedule={(vehicleId, dateStr, startTime, endTime, destination, passengerCount) => {
            try {
              const [d, m, y] = dateStr.split('/');
              const departureDate = new Date(`${y}-${m}-${d}T${startTime}:00`);
              const returnDate = new Date(`${y}-${m}-${d}T${endTime}:00`);
              handleOpenModal(undefined, departureDate, vehicleId, returnDate);
              if (destination) {
                setFormData(prev => ({
                  ...prev,
                  destination: destination || prev.destination
                }));
              }
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
                  <p className="text-base font-bold text-slate-900 uppercase">{resolveSectorName(viewingSchedule.serviceSectorId) || '---'}</p>
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
            const vSecId = v.sectorId || (v as any).sector_id;
            const currentSectorValid = prev.serviceSectorId && effectiveSectors.some(s => s.id === prev.serviceSectorId);
            if (!currentSectorValid && vSecId && effectiveSectors.some(s => s.id === vSecId)) {
              updates.serviceSectorId = vSecId;
            }
            return updates;
          });
        }}
        selectedItem={vehicles.find(v => v.id === formData.vehicleId)}
        renderItem={(v, isSelected) => {
          const vehicleSector = getVehicleSectorName(v);
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
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5 bg-slate-100 px-2 py-0.5 rounded border border-slate-200"><Landmark className="w-3 h-3 text-indigo-500" /> {vehicleSector}</span>
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
        onSelect={(p) => {
          const restVal = getDriverValidation(p.id, p.name);
          if (!restVal.isValid) {
            setDriverRestModal({
              isOpen: true,
              result: restVal,
              driver: p,
              vehicle: selectedVehicle
            });
            return;
          }
          setFormData({ ...formData, driverId: p.id });
        }}
        selectedItem={persons.find(p => p.id === formData.driverId)}
        renderItem={(p, isSelected) => {
          const restVal = getDriverValidation(p.id, p.name);
          const isAvail = restVal.isValid;
          let badgeText = '';
          let badgeColor = '';

          if (!isAvail) {
            if (restVal.code === 'WEEKEND_REST_VIOLATION') {
              badgeText = 'Descanso FDS';
              badgeColor = 'bg-amber-100 text-amber-800 border-amber-200';
            } else if (restVal.code === 'HOLIDAY_BLOCK_REST_VIOLATION') {
              badgeText = 'Descanso Feriado';
              badgeColor = 'bg-rose-100 text-rose-800 border-rose-200';
            } else if (restVal.code === 'CONSECUTIVE_DAYS_VIOLATION') {
              badgeText = 'Limite 5 Dias';
              badgeColor = 'bg-amber-100 text-amber-800 border-amber-200';
            } else if (restVal.code === 'TIME_OVERLAP_VIOLATION') {
              badgeText = 'Horário Ocupado';
              badgeColor = 'bg-rose-100 text-rose-800 border-rose-200';
            } else {
              badgeText = 'Indisponível';
              badgeColor = 'bg-rose-100 text-rose-800 border-rose-200';
            }
          }

          return (
            <div className={`p-4 flex items-center gap-4 ${!isAvail ? 'bg-rose-50/20' : ''}`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                !isAvail
                  ? 'bg-rose-100 text-rose-600'
                  : isSelected
                  ? 'bg-indigo-100 text-indigo-600'
                  : 'bg-slate-100 text-slate-400'
              }`}>
                {!isAvail ? <ShieldAlert className="w-5 h-5" /> : <UserIcon className="w-5 h-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-bold truncate ${!isAvail ? 'text-slate-700' : isSelected ? 'text-indigo-900' : 'text-slate-700'}`}>
                    {p.name}
                  </span>
                  {!isAvail && (
                    <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border shrink-0 ${badgeColor}`}>
                      {badgeText}
                    </span>
                  )}
                </div>
                {!isAvail && (
                  <p className="text-[10px] text-rose-600 font-semibold truncate mt-0.5">
                    {restVal.message ? (restVal.message.length > 60 ? restVal.message.slice(0, 60) + '...' : restVal.message) : 'Restrição de escala - clique para ver'}
                  </p>
                )}
              </div>
              {isSelected && <Check className="w-5 h-5 text-indigo-600 shrink-0" />}
            </div>
          );
        }}
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
          const pSecId = p.sectorId || (p as any).sector_id;
          const personSector = pSecId && effectiveSectors.find(s => s.id === pSecId);
          setFormData(prev => ({
            ...prev,
            requesterPersonId: p.id,
            // Preenche automaticamente o setor do solicitante quando selecionado
            serviceSectorId: personSector ? personSector.id : prev.serviceSectorId
          }));
        }}
        selectedItem={persons.find(p => p.id === formData.requesterPersonId)}
        renderItem={(p, isSelected) => {
          const pSectorName = getPersonSectorName(p);
          return (
            <div className="p-4 flex items-center gap-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isSelected ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                <UserCircle className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-bold truncate ${isSelected ? 'text-indigo-900' : 'text-slate-700'}`}>{p.name}</p>
                <p className="text-[11px] text-slate-400 truncate uppercase font-semibold">{pSectorName}</p>
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
        options={effectiveSectors}
        getInternalId={(s) => s.id}
        searchPlaceholder="Buscar setor..."
        filterFunction={(s, query) => s.name.toLowerCase().includes(query.toLowerCase())}
        onSelect={(s) => setFormData({ ...formData, serviceSectorId: s.id })}
        selectedItem={effectiveSectors.find(s => s.id === formData.serviceSectorId)}
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
        onSelect={(date) => {
          const newDep = getLocalISOString(date);
          setFormData(prev => {
            const updates: Partial<VehicleSchedule> = { ...prev, departureDateTime: newDep };
            if (prev.returnDateTime && new Date(prev.returnDateTime).getTime() <= date.getTime()) {
              const newRet = new Date(date.getTime() + 2 * 60 * 60 * 1000);
              updates.returnDateTime = getLocalISOString(newRet);
            }
            if (prev.driverId) {
              const selectedDriverObj = persons.find(p => p.id === prev.driverId);
              const val = validateDriverScheduleRules({
                driverId: prev.driverId,
                driverName: selectedDriverObj?.name,
                departureDateTime: newDep,
                returnDateTime: updates.returnDateTime || prev.returnDateTime || newDep,
                allSchedules: schedules,
                customHolidays: systemHolidays,
                excludeScheduleId: editingSchedule?.id
              });
              if (!val.isValid) {
                setDriverRestModal({
                  isOpen: true,
                  result: val,
                  driver: selectedDriverObj,
                  vehicle: selectedVehicle
                });
                updates.driverId = '';
                showToast("O motorista selecionado anteriormente possui restrição de descanso nesta data e foi desmarcado.", "warning");
              }
            }
            return updates;
          });
        }}
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
        onSelect={(date) => {
          const newRet = getLocalISOString(date);
          setFormData(prev => {
            const updates: Partial<VehicleSchedule> = { ...prev, returnDateTime: newRet };
            if (prev.driverId && prev.departureDateTime) {
              const selectedDriverObj = persons.find(p => p.id === prev.driverId);
              const val = validateDriverScheduleRules({
                driverId: prev.driverId,
                driverName: selectedDriverObj?.name,
                departureDateTime: prev.departureDateTime,
                returnDateTime: newRet,
                allSchedules: schedules,
                customHolidays: systemHolidays,
                excludeScheduleId: editingSchedule?.id
              });
              if (!val.isValid) {
                setDriverRestModal({
                  isOpen: true,
                  result: val,
                  driver: selectedDriverObj,
                  vehicle: selectedVehicle
                });
                updates.driverId = '';
                showToast("O motorista selecionado anteriormente possui restrição de descanso neste período e foi desmarcado.", "warning");
              }
            }
            return updates;
          });
        }}
        shouldDisableDate={isDateBlocked}
      />

      {/* MODAL DE TRIAGEM / INFORMAÇÃO DA TRIPULAÇÃO */}
      {isTripulacaoModalOpen && createPortal(
        <div className="fixed inset-0 z-[310] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 w-full max-w-lg overflow-hidden animate-scale-in transition-all">
            
            {/* CASO 1: MODAL EXCLUSIVO E DEDICADO PARA A VAN DE HEMODIÁLISE (UEA1J55) */}
            {isHemodialysisVan ? (
              <div className="flex flex-col animate-fade-in">
                {/* Header Exclusivo da Van de Hemodiálise */}
                <div className="px-6 py-5 border-b border-teal-500/20 bg-gradient-to-r from-teal-600 via-teal-700 to-indigo-700 text-white flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur-md text-white border border-white/20 flex items-center justify-center shadow-lg shadow-teal-950/20">
                      <HeartPulse className="w-6 h-6 text-teal-200 animate-pulse" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-black uppercase tracking-tight text-white">Van de Hemodiálise</h3>
                        <span className="px-2 py-0.5 rounded-md bg-teal-400/20 text-teal-100 border border-teal-300/30 text-[9px] font-black uppercase tracking-wider">
                          Uso Exclusivo
                        </span>
                      </div>
                      <p className="text-[11px] font-semibold text-teal-100/90 tracking-wide mt-0.5">
                        Transporte Coletivo de Tratamento Contínuo
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsTripulacaoModalOpen(false)}
                    className="p-2 text-white/70 hover:text-white hover:bg-white/15 rounded-xl transition-colors cursor-pointer"
                    title="Fechar"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Conteúdo Exclusivo da Van UEA1J55 */}
                <div className="p-6 space-y-5">
                  {/* Card de Identificação do Veículo com estilo Placa Mercosul */}
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-teal-50 via-indigo-50/40 to-slate-50 border border-teal-200/80 shadow-xs flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-teal-600/25">
                        <Car className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-black text-teal-700 uppercase tracking-widest">Veículo Selecionado</p>
                        <h4 className="text-sm font-black text-slate-900 uppercase truncate">
                          {selectedVehicle ? `${selectedVehicle.brand} ${selectedVehicle.model}` : 'Van Municipal'}
                        </h4>
                        <p className="text-xs text-slate-500 font-medium">
                          Capacidade: <strong className="text-teal-900 font-bold">{maxVanCrewCapacity} assentos de passageiros</strong>
                        </p>
                      </div>
                    </div>

                    {/* Placa em Destaque */}
                    <div className="px-3 py-1.5 rounded-xl bg-white border-2 border-teal-600/40 shadow-xs text-center shrink-0">
                      <span className="text-[8px] font-black text-blue-700 block tracking-widest leading-none border-b border-slate-200 pb-0.5 mb-0.5">BRASIL</span>
                      <span className="text-sm font-black text-slate-900 tracking-wider font-mono">
                        {selectedVehicle?.plate || 'UEA1J55'}
                      </span>
                    </div>
                  </div>

                  {/* Mensagem Oficial de Condição Exclusiva */}
                  <div className="p-4 rounded-2xl bg-teal-500/10 border border-teal-500/25 text-teal-950 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-teal-800 text-[11px] font-black uppercase tracking-wider">
                      <Info className="w-3.5 h-3.5" /> Condição Operacional Reconhecida
                    </div>
                    <p className="text-xs md:text-sm font-bold leading-relaxed text-slate-800">
                      Por se tratar da van oficial de Hemodiálise, o sistema reconhece a condição exclusiva e autoriza o <strong className="text-teal-700 font-black">transporte conjunto de múltiplos pacientes</strong> e seus respectivos acompanhantes até a capacidade total do veículo.
                    </p>
                  </div>

                  {/* 3 Cards de Regras e Lotação */}
                  <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Regras e Lotação Deste Veículo:</p>
                    <div className="grid grid-cols-3 gap-2.5">
                      <div className="p-3 rounded-2xl bg-teal-50/80 border border-teal-200/90 text-center space-y-1 shadow-2xs">
                        <div className="w-7 h-7 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center mx-auto text-xs font-black">
                          <HeartPulse className="w-3.5 h-3.5" />
                        </div>
                        <p className="text-xs font-black text-teal-950 leading-tight">Múltiplos</p>
                        <p className="text-[9px] text-teal-700 font-bold uppercase tracking-tight">Pacientes</p>
                      </div>

                      <div className="p-3 rounded-2xl bg-indigo-50/80 border border-indigo-200/90 text-center space-y-1 shadow-2xs">
                        <div className="w-7 h-7 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center mx-auto text-xs font-black">
                          <Users className="w-3.5 h-3.5" />
                        </div>
                        <p className="text-xs font-black text-indigo-950 leading-tight">Liberados</p>
                        <p className="text-[9px] text-indigo-700 font-bold uppercase tracking-tight">Acompanhantes</p>
                      </div>

                      <div className="p-3 rounded-2xl bg-purple-50/80 border border-purple-200/90 text-center space-y-1 shadow-2xs">
                        <div className="w-7 h-7 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center mx-auto text-xs font-black">
                          <ShieldCheck className="w-3.5 h-3.5" />
                        </div>
                        <p className="text-xs font-black text-purple-950 leading-tight">{maxVanCrewCapacity} Vagas</p>
                        <p className="text-[9px] text-purple-700 font-bold uppercase tracking-tight">Capacidade Total</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-2.5 text-xs text-slate-600 font-medium">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>
                      O seletor de integrantes permanecerá com os botões <strong>Paciente</strong> e <strong>Acompanhante</strong> liberados para inclusões sucessivas até o limite de <strong>{maxVanCrewCapacity} passageiros</strong>.
                    </span>
                  </div>
                </div>

                {/* Footer com Ações */}
                <div className="p-4 px-6 bg-slate-50/90 border-t border-slate-100 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setIsTripulacaoModalOpen(false)}
                    className="px-4 py-2.5 text-slate-500 hover:text-slate-700 hover:bg-white font-bold rounded-xl text-xs uppercase tracking-wider transition-colors cursor-pointer border border-transparent"
                  >
                    Cancelar
                  </button>

                  <button
                    type="button"
                    onClick={handleConfirmSpecialWarning}
                    className="px-6 py-2.5 bg-gradient-to-r from-teal-600 via-teal-700 to-indigo-600 hover:from-teal-700 hover:to-indigo-700 text-white font-black rounded-xl text-xs uppercase tracking-wider transition-all shadow-md shadow-teal-600/25 flex items-center gap-2 cursor-pointer hover:scale-[1.02] active:scale-95"
                  >
                    <Check className="w-4 h-4" />
                    <span>Confirmar e Liberar Tripulação</span>
                  </button>
                </div>
              </div>
            ) : (
              /* CASO 2: MODAL DE TRIAGEM PADRÃO PARA OS DEMAIS VEÍCULOS (PASSOS 1 E 2) */
              <>
                {/* ETAPA 1: PERGUNTA DE TRIAGEM COM SELECT MODERNO */}
                {tripulacaoModalStep === 1 && (
                  <div className="flex flex-col animate-fade-in">
                    {/* Header */}
                    <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/30">
                          <HeartPulse className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">Triagem da Tripulação</h3>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Identificação do perfil da viagem</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsTripulacaoModalOpen(false)}
                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-white rounded-xl transition-colors cursor-pointer"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Conteúdo */}
                    <div className="p-6 space-y-6">
                      <div className="text-center space-y-2">
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase tracking-widest border border-indigo-200">
                          <ShieldCheck className="w-3 h-3" /> Pergunta Obrigatória
                        </span>
                        <h4 className="text-base md:text-lg font-black text-slate-900 leading-snug">
                          Existe paciente <span className="text-indigo-600 bg-indigo-50/90 px-2 py-0.5 rounded-lg border border-indigo-200/80 font-black shadow-2xs">ONCOLÓGICO</span> ou de <span className="text-indigo-600 bg-indigo-50/90 px-2 py-0.5 rounded-lg border border-indigo-200/80 font-black shadow-2xs">HEMODIÁLISE</span> nesta viagem?
                        </h4>
                        <p className="text-xs text-slate-500 font-medium max-w-md mx-auto">
                          Selecione abaixo para aplicarmos as normas e limites corretos de capacidade do veículo.
                        </p>
                      </div>

                      {/* Cards de Escolha Interativa (Sim / Não) */}
                      <div className="grid grid-cols-2 gap-3 pt-2">
                        <button
                          type="button"
                          onClick={() => setSelectedSpecialOption('sim')}
                          className={`p-4 rounded-2xl border-2 text-left transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between ${
                            selectedSpecialOption === 'sim'
                              ? 'border-indigo-600 bg-indigo-50/60 shadow-md shadow-indigo-600/10 ring-2 ring-indigo-600/20'
                              : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/50'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-black text-xs">
                              <HeartPulse className="w-4 h-4" />
                            </span>
                            {selectedSpecialOption === 'sim' && (
                              <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                                <Check className="w-3 h-3" />
                              </span>
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-black text-slate-900 uppercase">Sim</p>
                            <p className="text-[10px] text-slate-500 font-medium leading-tight mt-0.5">Paciente oncológico ou hemodiálise</p>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => setSelectedSpecialOption('nao')}
                          className={`p-4 rounded-2xl border-2 text-left transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between ${
                            selectedSpecialOption === 'nao'
                              ? 'border-indigo-600 bg-indigo-50/60 shadow-md shadow-indigo-600/10 ring-2 ring-indigo-600/20'
                              : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/50'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-black text-xs">
                              <Users className="w-4 h-4" />
                            </span>
                            {selectedSpecialOption === 'nao' && (
                              <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                                <Check className="w-3 h-3" />
                              </span>
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-black text-slate-900 uppercase">Não</p>
                            <p className="text-[10px] text-slate-500 font-medium leading-tight mt-0.5">Viagem convencional comum</p>
                          </div>
                        </button>
                      </div>
                    </div>

                    {/* Footer com Ações */}
                    <div className="p-4 px-6 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => setIsTripulacaoModalOpen(false)}
                        className="px-4 py-2.5 text-slate-500 hover:text-slate-700 hover:bg-white font-bold rounded-xl text-xs uppercase tracking-wider transition-colors cursor-pointer border border-transparent"
                      >
                        Cancelar
                      </button>

                      <button
                        type="button"
                        onClick={handleConfirmSpecialQuestion}
                        disabled={!selectedSpecialOption}
                        className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl text-xs uppercase tracking-wider transition-all shadow-md shadow-indigo-600/25 disabled:opacity-40 disabled:pointer-events-none flex items-center gap-1.5 cursor-pointer"
                      >
                        <span>Continuar</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                {/* ETAPA 2: AVISO DE USO EXCLUSIVO E LIMITAÇÕES (VEÍCULOS DE PASSEIO) */}
                {tripulacaoModalStep === 2 && (
                  <div className="flex flex-col animate-fade-in">
                    {/* Header */}
                    <div className="px-6 py-5 border-b border-amber-100 bg-amber-50/60 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-amber-500 shadow-amber-500/30 text-white flex items-center justify-center shadow-md">
                          <ShieldAlert className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">
                            Aviso de Uso Exclusivo
                          </h3>
                          <p className="text-[10px] font-bold uppercase tracking-widest mt-0.5 text-amber-700">
                            Regras de Lotação Especial
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsTripulacaoModalOpen(false)}
                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-white rounded-xl transition-colors cursor-pointer"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Conteúdo */}
                    <div className="p-6 space-y-5">
                      {/* Mensagem Oficial em Destaque */}
                      <div className="p-4 rounded-2xl border text-slate-900 space-y-1.5 bg-amber-500/10 border-amber-500/25 text-amber-950">
                        <p className="text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 text-amber-700">
                          <Info className="w-3.5 h-3.5" /> Diretriz de Transporte da Saúde
                        </p>
                        <p className="text-xs md:text-sm font-bold leading-relaxed">
                          "Para viagens destinadas a pacientes oncológicos ou em tratamento de hemodiálise em veículo convencional, o veículo será de uso exclusivo do paciente e seus acompanhantes."
                        </p>
                      </div>

                      {/* Cards Informativos de Limitações Obrigatórias */}
                      <div className="space-y-2">
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Regras e Lotação Permitida:</p>
                        <div className="grid grid-cols-3 gap-2.5">
                          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-1">
                            <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto text-xs font-black">
                              <UserIcon className="w-3 h-3" />
                            </div>
                            <p className="text-xs font-black text-slate-900">01 Paciente</p>
                            <p className="text-[9px] text-slate-400 font-bold uppercase">Máximo</p>
                          </div>

                          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-1">
                            <div className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center mx-auto text-xs font-black">
                              <Users className="w-3 h-3" />
                            </div>
                            <p className="text-xs font-black text-slate-900">02 Acomp.</p>
                            <p className="text-[9px] text-slate-400 font-bold uppercase">Máximo</p>
                          </div>

                          <div className="p-3 rounded-xl bg-purple-50/60 border border-purple-200 text-center space-y-1">
                            <div className="w-6 h-6 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center mx-auto text-xs font-black">
                              <Car className="w-3 h-3" />
                            </div>
                            <p className="text-xs font-black text-purple-900">03 Pessoas</p>
                            <p className="text-[9px] text-purple-600 font-bold uppercase">Total Máx.</p>
                          </div>
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-2.5 text-xs text-slate-600 font-medium">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <span>
                          Para veículos convencionais exclusivos, não é permitido cadastrar um segundo paciente ou mais de dois acompanhantes (máx. 3 pessoas).
                        </span>
                      </div>
                    </div>

                    {/* Footer com Botões */}
                    <div className="p-4 px-6 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => setTripulacaoModalStep(1)}
                        className="px-4 py-2.5 text-slate-600 hover:text-slate-800 hover:bg-white font-bold rounded-xl text-xs uppercase tracking-wider transition-colors cursor-pointer border border-slate-200 flex items-center gap-1.5"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        <span>Voltar</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleConfirmSpecialWarning}
                        className="px-5 py-2.5 text-white font-black rounded-xl text-xs uppercase tracking-wider transition-all shadow-md flex items-center gap-2 cursor-pointer bg-gradient-to-r from-amber-600 via-indigo-600 to-purple-600 hover:from-amber-700 hover:to-purple-700 shadow-indigo-600/25"
                      >
                        <Check className="w-4 h-4" />
                        <span>Confirmar e Liberar Tripulação</span>
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

          </div>
        </div>,
        document.body
      )}

      {/* MODAL DE RESTRIÇÃO DE DESCANSO E DISPONIBILIDADE DO MOTORISTA */}
      <DriverRestRestrictionModal
        isOpen={driverRestModal.isOpen}
        onClose={() => setDriverRestModal(prev => ({ ...prev, isOpen: false }))}
        validationResult={driverRestModal.result}
        driver={driverRestModal.driver}
        vehicle={driverRestModal.vehicle}
      />

      {/* MODAL ANIMADO DE CARREGAMENTO E SINCRONIZAÇÃO DE DADOS */}
      <VehicleSchedulingLoadingModal
        isOpen={isLoadingModalOpen}
        onClose={() => setIsLoadingModalOpen(false)}
        vehiclesCount={vehicles.length}
        driversCount={persons.length}
        schedulesCount={schedules.length}
      />
    </div>
  );
};