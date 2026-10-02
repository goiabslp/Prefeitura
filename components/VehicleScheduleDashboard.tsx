import React, { useState, useMemo } from 'react';
import { 
  Vehicle, 
  VehicleSchedule, 
  Person,
  Sector
} from '../types';
import { 
  ArrowLeft,
  Activity,
  BarChart2, 
  Building2,
  Car, 
  Clock, 
  MapPin, 
  PieChart as PieChartIcon,
  TrendingUp, 
  UserCheck,
  Users,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  Search,
  Download,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Sparkles,
  ChevronRight,
  Info,
  CalendarRange,
  Gauge,
  UserX,
  Share2,
  Fuel,
  RefreshCw,
  X,
  FileSpreadsheet
} from 'lucide-react';
import { 
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';

interface DashboardProps {
  schedules: VehicleSchedule[];
  vehicles: Vehicle[];
  persons: Person[];
  sectors: Sector[];
  onBack?: () => void;
}

// Mapeamento de distâncias estimadas (ida e volta) de São José do Goiabal para destinos comuns
const DESTINATION_KM_MAP: Record<string, number> = {
  'belo horizonte': 360,
  'bh': 360,
  'ipatinga': 130,
  'joao monlevade': 90,
  'monlevade': 90,
  'ponte nova': 140,
  'rio casca': 70,
  'caratinga': 200,
  'coronel fabriciano': 120,
  'fabriciano': 120,
  'timoteo': 110,
  'manhuacu': 220,
  'raul soares': 80,
  'alvinopolis': 150,
  'vicosa': 200,
  'sao domingos do prata': 50,
  'prata': 50,
  'dionisio': 30,
  'marlieria': 60,
  'cava grande': 60,
  'itabira': 130,
  'governador valadares': 280,
  'valadares': 280,
  'nova era': 80,
  'sem-peixe': 40,
  'sao jose do goiabal': 20,
  'local': 20,
  'zona rural': 30
};

const getEstimatedKm = (destination: string): number => {
  if (!destination) return 60;
  const normalized = destination.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  for (const [city, km] of Object.entries(DESTINATION_KM_MAP)) {
    if (normalized.includes(city)) return km;
  }
  return 80; // Padrão caso não mapeado
};

const countSchedulePassengers = (s: VehicleSchedule): number => {
  const pCount = s.patientCount || 0;
  const cCount = s.companionCount || 0;
  const arrCount = s.passengers?.length || 0;
  if (pCount > 0 || cCount > 0) return pCount + cCount;
  if (arrCount > 0) return arrCount;
  return 1;
};

export const VehicleScheduleDashboard: React.FC<DashboardProps> = ({
  schedules, vehicles, persons, sectors, onBack
}) => {
  // Filtros Globais
  const [period, setPeriod] = useState<string>('mes');
  const [selectedSector, setSelectedSector] = useState<string>('todos');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'geral' | 'operacao' | 'frota' | 'motoristas' | 'passageiros' | 'destinos' | 'eficiencia' | 'alertas'>('geral');

  // Modal de Detalhamento Interativo (Drill-Down)
  const [drillDownModal, setDrillDownModal] = useState<{
    isOpen: boolean;
    title: string;
    subtitle?: string;
    filterCondition: (s: VehicleSchedule) => boolean;
  } | null>(null);

  const [drillSearch, setDrillSearch] = useState('');
  const [drillStatusFilter, setDrillStatusFilter] = useState('todos');

  // Mapeamento de nomes de meses disponíveis
  const availableMonths = useMemo(() => {
    const monthsSet = new Set<string>();
    schedules.forEach(s => {
      const d = new Date(s.departureDateTime);
      if (!isNaN(d.getTime())) {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        monthsSet.add(`${yyyy}-${mm}`);
      }
    });
    return Array.from(monthsSet).sort().reverse();
  }, [schedules]);

  const getMonthName = (yyyy_mm: string) => {
    const [yyyy, mm] = yyyy_mm.split('-');
    const date = new Date(parseInt(yyyy), parseInt(mm) - 1, 1);
    return date.toLocaleString('pt-BR', { month: 'long', year: 'numeric' }).replace(/^./, str => str.toUpperCase());
  };

  // 1. Filtragem por Período Atual e Período Anterior (Para Comparações Gerenciais)
  const { currentSchedules, previousSchedules } = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    let startDate: Date | null = null;
    let endDate: Date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    let prevStartDate: Date | null = null;
    let prevEndDate: Date | null = null;

    if (period === 'hoje') {
      startDate = today;
      prevStartDate = new Date(today);
      prevStartDate.setDate(today.getDate() - 1);
      prevEndDate = new Date(prevStartDate.getFullYear(), prevStartDate.getMonth(), prevStartDate.getDate(), 23, 59, 59, 999);
    } else if (period === 'semana') {
      startDate = new Date(today);
      startDate.setDate(today.getDate() - 7);
      prevEndDate = new Date(startDate.getTime() - 1);
      prevStartDate = new Date(startDate);
      prevStartDate.setDate(startDate.getDate() - 7);
    } else if (period === 'mes') {
      startDate = new Date(today);
      startDate.setDate(today.getDate() - 30);
      prevEndDate = new Date(startDate.getTime() - 1);
      prevStartDate = new Date(startDate);
      prevStartDate.setDate(startDate.getDate() - 30);
    } else if (period === 'ano') {
      startDate = new Date(today);
      startDate.setFullYear(today.getFullYear() - 1);
      prevEndDate = new Date(startDate.getTime() - 1);
      prevStartDate = new Date(startDate);
      prevStartDate.setFullYear(startDate.getFullYear() - 1);
    } else if (period === 'custom' && customStartDate && customEndDate) {
      const [sy, sm, sd] = customStartDate.split('-').map(Number);
      const [ey, em, ed] = customEndDate.split('-').map(Number);
      startDate = new Date(sy, sm - 1, sd, 0, 0, 0);
      endDate = new Date(ey, em - 1, ed, 23, 59, 59, 999);
      const diffMs = endDate.getTime() - startDate.getTime();
      prevEndDate = new Date(startDate.getTime() - 1);
      prevStartDate = new Date(prevEndDate.getTime() - diffMs);
    } else if (period.includes('-')) {
      const [y, m] = period.split('-').map(Number);
      startDate = new Date(y, m - 1, 1, 0, 0, 0);
      endDate = new Date(y, m, 0, 23, 59, 59, 999);
      prevStartDate = new Date(y, m - 2, 1, 0, 0, 0);
      prevEndDate = new Date(y, m - 1, 0, 23, 59, 59, 999);
    }

    const current = schedules.filter(s => {
      const depDate = new Date(s.departureDateTime);
      if (isNaN(depDate.getTime())) return false;
      if (startDate && depDate < startDate) return false;
      if (endDate && depDate > endDate) return false;
      return true;
    });

    const previous = prevStartDate && prevEndDate ? schedules.filter(s => {
      const depDate = new Date(s.departureDateTime);
      if (isNaN(depDate.getTime())) return false;
      return depDate >= prevStartDate! && depDate <= prevEndDate!;
    }) : [];

    return { currentSchedules: current, previousSchedules: previous };
  }, [schedules, period, customStartDate, customEndDate]);

  // Setores ativos no período
  const activeSectors = useMemo(() => {
    const activeIds = new Set(currentSchedules.map(s => s.serviceSectorId).filter(Boolean));
    return sectors.filter(sec => activeIds.has(sec.id));
  }, [currentSchedules, sectors]);

  // Filtro por Setor
  const filteredSchedules = useMemo(() => {
    return currentSchedules.filter(s => {
      if (selectedSector !== 'todos' && s.serviceSectorId !== selectedSector) return false;
      return true;
    });
  }, [currentSchedules, selectedSector]);

  const filteredPreviousSchedules = useMemo(() => {
    return previousSchedules.filter(s => {
      if (selectedSector !== 'todos' && s.serviceSectorId !== selectedSector) return false;
      return true;
    });
  }, [previousSchedules, selectedSector]);

  // ==========================================
  // 2. MÉTRICAS E INDICADORES PRINCIPAIS
  // ==========================================
  const now = new Date();

  // Operação em Tempo Real (Agora)
  const currentRunningTrips = useMemo(() => {
    return schedules.filter(s => {
      if (s.status === 'cancelado') return false;
      const dep = new Date(s.departureDateTime);
      const ret = new Date(s.returnDateTime);
      if (isNaN(dep.getTime()) || isNaN(ret.getTime())) return false;
      return s.status === 'em_curso' || (s.status === 'confirmado' && now >= dep && now <= ret);
    });
  }, [schedules, now]);

  const delayedTrips = useMemo(() => {
    return schedules.filter(s => {
      if (s.status === 'concluido' || s.status === 'cancelado') return false;
      const ret = new Date(s.returnDateTime);
      if (isNaN(ret.getTime())) return false;
      return now > ret;
    });
  }, [schedules, now]);

  const upcomingTrips = useMemo(() => {
    return schedules.filter(s => {
      if (s.status === 'cancelado' || s.status === 'concluido') return false;
      const dep = new Date(s.departureDateTime);
      if (isNaN(dep.getTime())) return false;
      return dep > now;
    }).sort((a, b) => new Date(a.departureDateTime).getTime() - new Date(b.departureDateTime).getTime());
  }, [schedules, now]);

  // Totais do Período Atual
  const totalTrips = filteredSchedules.length;
  const completedTrips = filteredSchedules.filter(s => s.status === 'concluido').length;
  const confirmedTrips = filteredSchedules.filter(s => s.status === 'confirmado').length;
  const inProgressTrips = filteredSchedules.filter(s => s.status === 'em_curso' || (s.status === 'confirmado' && new Date(s.departureDateTime) <= now && new Date(s.returnDateTime) >= now)).length;
  const pendingTrips = filteredSchedules.filter(s => s.status === 'pendente').length;
  const canceledTrips = filteredSchedules.filter(s => s.status === 'cancelado').length;
  const rejectedTrips = filteredSchedules.filter(s => s.status === 'cancelado' && (s.cancellationReason?.toLowerCase().includes('rejeit') || s.cancellationReason?.toLowerCase().includes('gestor'))).length;

  const totalPassengers = filteredSchedules.reduce((acc, s) => acc + countSchedulePassengers(s), 0);
  const totalEstimatedKm = filteredSchedules.reduce((acc, s) => acc + getEstimatedKm(s.destination), 0);
  const completionRate = totalTrips > 0 ? (completedTrips / totalTrips) * 100 : 0;
  const cancellationRate = totalTrips > 0 ? (canceledTrips / totalTrips) * 100 : 0;
  const approvalRate = totalTrips > 0 ? ((completedTrips + confirmedTrips) / totalTrips) * 100 : 0;

  // Totais do Período Anterior (Para Comparação)
  const prevTotalTrips = filteredPreviousSchedules.length;
  const prevCompletedTrips = filteredPreviousSchedules.filter(s => s.status === 'concluido').length;
  const prevTotalPassengers = filteredPreviousSchedules.reduce((acc, s) => acc + countSchedulePassengers(s), 0);
  const prevTotalKm = filteredPreviousSchedules.reduce((acc, s) => acc + getEstimatedKm(s.destination), 0);

  // Helper de Comparação (%)
  const calcVariation = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? { val: '+100%', type: 'up' } : { val: '0.0%', type: 'neutral' };
    const diff = ((current - previous) / previous) * 100;
    if (Math.abs(diff) < 0.1) return { val: '0.0%', type: 'neutral' };
    if (diff > 0) return { val: `+${diff.toFixed(1)}%`, type: 'up' };
    return { val: `${diff.toFixed(1)}%`, type: 'down' };
  };

  // ==========================================
  // 3. FROTAS E VEÍCULOS
  // ==========================================
  const totalVehiclesCount = vehicles.length;
  const usedVehicleIds = new Set(filteredSchedules.filter(s => s.status !== 'cancelado').map(s => s.vehicleId).filter(Boolean));
  const activeVehiclesInPeriod = usedVehicleIds.size;
  const vehiclesInTripNow = new Set(currentRunningTrips.map(s => s.vehicleId).filter(Boolean)).size;
  const unavailableVehicles = vehicles.filter(v => v.status !== 'operacional' || v.maintenanceStatus === 'andamento' || v.maintenanceStatus === 'vencido').length;
  const availableVehiclesCount = Math.max(0, totalVehiclesCount - vehiclesInTripNow - unavailableVehicles);
  const fleetUtilizationRate = totalVehiclesCount > 0 ? (activeVehiclesInPeriod / totalVehiclesCount) * 100 : 0;

  // Veículos mais acionados
  const vehiclesUsage = useMemo(() => {
    const counts: Record<string, { name: string; viagens: number; passageiros: number; km: number }> = {};
    filteredSchedules.filter(s => s.status !== 'cancelado').forEach(s => {
      const v = vehicles.find(veh => veh.id === s.vehicleId);
      const label = v ? `${v.plate.toUpperCase()} - ${v.model}` : 'Não Informado';
      if (!counts[label]) counts[label] = { name: label, viagens: 0, passageiros: 0, km: 0 };
      counts[label].viagens += 1;
      counts[label].passageiros += countSchedulePassengers(s);
      counts[label].km += getEstimatedKm(s.destination);
    });
    return Object.values(counts).sort((a, b) => b.viagens - a.viagens).slice(0, 5);
  }, [filteredSchedules, vehicles]);

  // Capacidade e Ocupação
  const totalCapacityOffered = filteredSchedules.reduce((acc, s) => {
    const v = vehicles.find(veh => veh.id === s.vehicleId);
    return acc + (v?.passengerCapacity || 4);
  }, 0);
  const averageCapacityOccupancy = totalCapacityOffered > 0 ? (totalPassengers / totalCapacityOffered) * 100 : 0;
  const idleCapacity = Math.max(0, totalCapacityOffered - totalPassengers);

  // Viagens Compartilhadas (Múltiplos passageiros ou caronas)
  const sharedTrips = filteredSchedules.filter(s => countSchedulePassengers(s) > 1);
  const sharedTripsCount = sharedTrips.length;
  const extraPassengersAccommodated = sharedTrips.reduce((acc, s) => acc + (countSchedulePassengers(s) - 1), 0);
  const estimatedAvoidedTrips = Math.round(extraPassengersAccommodated * 0.75);

  // ==========================================
  // 4. MOTORISTAS E ESCALAS
  // ==========================================
  const activeDriversIds = new Set(filteredSchedules.filter(s => s.status !== 'cancelado').map(s => s.driverId).filter(Boolean));
  const totalActiveDrivers = activeDriversIds.size;
  const driversInTripNow = new Set(currentRunningTrips.map(s => s.driverId).filter(Boolean)).size;

  // Estatísticas por Motorista
  const driverStats = useMemo(() => {
    const stats: Record<string, { name: string; trips: number; days: Set<string>; weekendDays: Set<string>; schedules: VehicleSchedule[] }> = {};

    filteredSchedules.filter(s => s.status !== 'cancelado' && s.driverId).forEach(s => {
      const p = persons.find(per => per.id === s.driverId);
      const name = p?.name || 'Desconhecido';
      if (!stats[s.driverId]) {
        stats[s.driverId] = { name, trips: 0, days: new Set(), weekendDays: new Set(), schedules: [] };
      }
      stats[s.driverId].trips += 1;
      stats[s.driverId].schedules.push(s);

      const dep = new Date(s.departureDateTime);
      if (!isNaN(dep.getTime())) {
        const dayStr = dep.toISOString().split('T')[0];
        stats[s.driverId].days.add(dayStr);
        const dayOfWeek = dep.getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          stats[s.driverId].weekendDays.add(dayStr);
        }
      }
    });

    return Object.entries(stats).map(([id, d]) => ({
      id,
      name: d.name,
      trips: d.trips,
      daysWorked: d.days.size,
      weekendDays: d.weekendDays.size,
      schedules: d.schedules
    })).sort((a, b) => b.trips - a.trips);
  }, [filteredSchedules, persons]);

  // ==========================================
  // 5. ALERTAS GERENCIAIS AUTOMÁTICOS
  // ==========================================
  const alertsList = useMemo(() => {
    const alerts: Array<{
      id: string;
      type: 'warning' | 'danger' | 'info';
      title: string;
      description: string;
      badge: string;
      filter: (s: VehicleSchedule) => boolean;
    }> = [];

    // 1. Viagens atrasadas no retorno
    if (delayedTrips.length > 0) {
      alerts.push({
        id: 'delayed',
        type: 'danger',
        title: `${delayedTrips.length} Viagens com Retorno Atrasado`,
        description: 'Veículos em circulação que ultrapassaram a previsão de retorno cadastrada.',
        badge: 'Urgente',
        filter: (s) => (s.status === 'em_curso' || s.status === 'confirmado') && new Date(s.returnDateTime) < now
      });
    }

    // 2. Viagens confirmadas sem motorista
    const tripsNoDriver = filteredSchedules.filter(s => (s.status === 'confirmado' || s.status === 'pendente') && !s.driverId);
    if (tripsNoDriver.length > 0) {
      alerts.push({
        id: 'no-driver',
        type: 'warning',
        title: `${tripsNoDriver.length} Agendamentos sem Motorista`,
        description: 'Viagens aprovadas ou pendentes sem motorista titular definido.',
        badge: 'Atenção',
        filter: (s) => (s.status === 'confirmado' || s.status === 'pendente') && !s.driverId
      });
    }

    // 3. Viagens confirmadas sem veículo
    const tripsNoVehicle = filteredSchedules.filter(s => (s.status === 'confirmado' || s.status === 'pendente') && !s.vehicleId);
    if (tripsNoVehicle.length > 0) {
      alerts.push({
        id: 'no-vehicle',
        type: 'warning',
        title: `${tripsNoVehicle.length} Agendamentos sem Veículo`,
        description: 'Solicitações que necessitam de alocação de frota.',
        badge: 'Alocação',
        filter: (s) => (s.status === 'confirmado' || s.status === 'pendente') && !s.vehicleId
      });
    }

    // 4. Solicitações pendentes há mais de 48h
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const oldPending = filteredSchedules.filter(s => s.status === 'pendente' && new Date(s.createdAt) < twoDaysAgo);
    if (oldPending.length > 0) {
      alerts.push({
        id: 'old-pending',
        type: 'info',
        title: `${oldPending.length} Solicitações Pendentes (+48h)`,
        description: 'Pedidos aguardando triagem ou aprovação pelo gestor.',
        badge: 'Triagem',
        filter: (s) => s.status === 'pendente' && new Date(s.createdAt) < twoDaysAgo
      });
    }

    // 5. Veículo com sobrecarga (+30% de todas as viagens)
    if (vehiclesUsage.length > 0 && vehiclesUsage[0].viagens > Math.max(5, totalTrips * 0.3)) {
      const topV = vehiclesUsage[0];
      alerts.push({
        id: 'heavy-vehicle',
        type: 'warning',
        title: `Uso Intenso: ${topV.name}`,
        description: `Este veículo concentrou ${topV.viagens} viagens no período (${((topV.viagens/Math.max(1, totalTrips))*100).toFixed(0)}% do volume total).`,
        badge: 'Manutenção Preventiva',
        filter: (s) => {
          const v = vehicles.find(veh => veh.id === s.vehicleId);
          return v ? `${v.plate.toUpperCase()} - ${v.model}` === topV.name : false;
        }
      });
    }

    return alerts;
  }, [delayedTrips, filteredSchedules, vehiclesUsage, totalTrips, vehicles, now]);

  // ==========================================
  // 6. DADOS PARA GRÁFICOS E RANKINGS
  // ==========================================

  // Evolução temporal de agendamentos
  const tripsOverTime = useMemo(() => {
    const grouped: Record<string, { date: string; concluidas: number; canceladas: number; total: number }> = {};
    filteredSchedules.forEach(s => {
      const d = new Date(s.departureDateTime);
      if (isNaN(d.getTime())) return;
      const dateKey = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      if (!grouped[dateKey]) grouped[dateKey] = { date: dateKey, concluidas: 0, canceladas: 0, total: 0 };
      grouped[dateKey].total += 1;
      if (s.status === 'concluido') grouped[dateKey].concluidas += 1;
      if (s.status === 'cancelado') grouped[dateKey].canceladas += 1;
    });
    return Object.values(grouped).slice(-15);
  }, [filteredSchedules]);

  // Destinos frequentes (Top 6)
  const destinationsData = useMemo(() => {
    const counts: Record<string, { name: string; viagens: number; passageiros: number; km: number }> = {};
    filteredSchedules.filter(s => s.status !== 'cancelado').forEach(s => {
      if (!s.destination) return;
      const city = s.destination.split('-')[0].trim().toUpperCase();
      if (!counts[city]) counts[city] = { name: city, viagens: 0, passageiros: 0, km: 0 };
      counts[city].viagens += 1;
      counts[city].passageiros += countSchedulePassengers(s);
      counts[city].km += getEstimatedKm(s.destination);
    });
    return Object.values(counts).sort((a, b) => b.viagens - a.viagens).slice(0, 6);
  }, [filteredSchedules]);


  // Demandas por Setor
  const sectorsUsage = useMemo(() => {
    const counts: Record<string, { name: string; viagens: number; passageiros: number; canceladas: number }> = {};
    filteredSchedules.forEach(s => {
      const sec = sectors.find(sect => sect.id === s.serviceSectorId);
      const name = sec?.name || 'Setor Geral / Não Informado';
      if (!counts[name]) counts[name] = { name, viagens: 0, passageiros: 0, canceladas: 0 };
      counts[name].viagens += 1;
      counts[name].passageiros += countSchedulePassengers(s);
      if (s.status === 'cancelado') counts[name].canceladas += 1;
    });
    return Object.values(counts).sort((a, b) => b.viagens - a.viagens).slice(0, 6);
  }, [filteredSchedules, sectors]);

  // Motivos de Cancelamento
  const cancellationReasonsData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredSchedules.filter(s => s.status === 'cancelado').forEach(s => {
      const reason = (s.cancellationReason || 'Não informado / Cancelamento Direto').trim();
      counts[reason] = (counts[reason] || 0) + 1;
    });
    return Object.entries(counts).map(([motivo, total]) => ({ motivo, total })).sort((a, b) => b.total - a.total).slice(0, 5);
  }, [filteredSchedules]);

  // Cores personalizadas e sofisticadas
  const COLORS = ['#6366f1', '#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6'];

  // Abertura do Modal de Drill-Down
  const handleOpenDrillDown = (title: string, subtitle: string, filterCondition: (s: VehicleSchedule) => boolean) => {
    setDrillSearch('');
    setDrillStatusFilter('todos');
    setDrillDownModal({
      isOpen: true,
      title,
      subtitle,
      filterCondition
    });
  };

  // Filtragem dos itens no modal aberto
  const drillDownFilteredItems = useMemo(() => {
    if (!drillDownModal) return [];
    return schedules.filter(s => {
      if (!drillDownModal.filterCondition(s)) return false;
      if (drillStatusFilter !== 'todos' && s.status !== drillStatusFilter) return false;
      if (drillSearch.trim()) {
        const q = drillSearch.toLowerCase();
        const v = vehicles.find(veh => veh.id === s.vehicleId);
        const p = persons.find(per => per.id === s.driverId);
        const sec = sectors.find(sect => sect.id === s.serviceSectorId);
        const matchProt = s.protocol?.toLowerCase().includes(q);
        const matchDest = s.destination?.toLowerCase().includes(q);
        const matchDriver = p?.name?.toLowerCase().includes(q);
        const matchVeh = v?.plate?.toLowerCase().includes(q) || v?.model?.toLowerCase().includes(q);
        const matchSec = sec?.name?.toLowerCase().includes(q);
        return matchProt || matchDest || matchDriver || matchVeh || matchSec;
      }
      return true;
    });
  }, [drillDownModal, schedules, drillStatusFilter, drillSearch, vehicles, persons, sectors]);

  // Exportação rápida para CSV
  const handleExportDrillCsv = () => {
    if (drillDownFilteredItems.length === 0) return;
    const headers = ['Protocolo', 'Data Saida', 'Data Retorno', 'Destino', 'Setor', 'Veiculo', 'Motorista', 'Passageiros', 'Status', 'Motivo Cancelamento'];
    const rows = drillDownFilteredItems.map(s => {
      const v = vehicles.find(veh => veh.id === s.vehicleId);
      const p = persons.find(per => per.id === s.driverId);
      const sec = sectors.find(sect => sect.id === s.serviceSectorId);
      return [
        s.protocol,
        s.departureDateTime,
        s.returnDateTime,
        `"${s.destination || ''}"`,
        `"${sec?.name || ''}"`,
        `"${v ? `${v.plate} - ${v.model}` : ''}"`,
        `"${p?.name || ''}"`,
        countSchedulePassengers(s),
        s.status,
        `"${s.cancellationReason || ''}"`
      ].join(',');
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `relatorio_viagens_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex-1 flex flex-col font-sans h-full bg-slate-50/50 overflow-hidden relative z-0">
      
      {/* Conteúdo com scroll suave */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-7xl mx-auto p-3.5 sm:p-6 md:p-8 space-y-6 animate-in slide-in-from-bottom-3 duration-300 pb-36">
          
          {/* ==================================================== */}
          {/* CABEÇALHO & FILTROS GLOBAIS                          */}
          {/* ==================================================== */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-5 sm:p-7 rounded-3xl shadow-sm border border-slate-100">
            <div className="flex items-center gap-3.5">
              {onBack && (
                <button
                  onClick={onBack}
                  className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-2xl transition-all group shrink-0 border border-slate-100"
                  title="Voltar ao Menu de Agendamento"
                >
                  <ArrowLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
                </button>
              )}
              <div>
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl shadow-inner">
                    <Activity className="w-6 h-6" />
                  </div>
                  <div>
                    <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                      Dashboard Analítico
                    </h1>
                    <p className="text-slate-400 text-[10px] sm:text-xs font-bold uppercase tracking-widest mt-0.5">
                      Inteligência Operacional e Gestão da Frota Municipal
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Controles de Filtro */}
            <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
              {/* Filtro por Setor */}
              <div className="relative">
                <select
                  value={selectedSector}
                  onChange={(e) => setSelectedSector(e.target.value)}
                  className={`px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer outline-none border ${
                    selectedSector !== 'todos'
                      ? 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/20'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <option value="todos">Todos os Setores</option>
                  {sectors.map(sec => (
                    <option key={sec.id} value={sec.id}>{sec.name}</option>
                  ))}
                </select>
              </div>

              {/* Seletor de Mês Específico */}
              <div className="relative">
                <select
                  value={period.includes('-') ? period : ''}
                  onChange={(e) => {
                    if (e.target.value) setPeriod(e.target.value);
                  }}
                  className={`px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer outline-none border ${
                    period.includes('-')
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <option value="" disabled>Mês Específico</option>
                  {availableMonths.map(m => (
                    <option key={m} value={m}>{getMonthName(m)}</option>
                  ))}
                </select>
              </div>

              {/* Botões Rápidos de Período */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200/60 overflow-x-auto max-w-full">
                {[
                  { id: 'hoje', label: 'Hoje' },
                  { id: 'semana', label: '7 Dias' },
                  { id: 'mes', label: '30 Dias' },
                  { id: 'ano', label: '1 Ano' },
                  { id: 'tudo', label: 'Tudo' }
                ].map(p => (
                  <button
                    key={p.id}
                    onClick={() => setPeriod(p.id)}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
                      period === p.id 
                        ? 'bg-white text-indigo-700 shadow-xs font-black' 
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ==================================================== */}
          {/* BLOCO 1: CARDS DE INDICADORES PRINCIPAIS (KPIs)       */}
          {/* ==================================================== */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
            
            {/* Total de Viagens */}
            <div 
              onClick={() => handleOpenDrillDown('Todas as Viagens do Período', `${totalTrips} solicitações registradas`, () => true)}
              className="bg-white p-4.5 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer group relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-indigo-500 rounded-l-full"></div>
              <div className="flex items-center justify-between mb-2">
                <div className="w-9 h-9 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg uppercase tracking-wider">
                  Total
                </span>
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Viagens Solicitadas</p>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">{totalTrips}</div>
              <div className="flex items-center gap-1 mt-2 text-[10px] font-bold text-slate-400">
                <span>{confirmedTrips} ativas / programadas</span>
              </div>
            </div>

            {/* Concluídas */}
            <div 
              onClick={() => handleOpenDrillDown('Viagens Concluídas', `${completedTrips} viagens finalizadas com sucesso`, (s) => s.status === 'concluido')}
              className="bg-white p-4.5 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer group relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-emerald-500 rounded-l-full"></div>
              <div className="flex items-center justify-between mb-2">
                <div className="w-9 h-9 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg uppercase tracking-wider">
                  {completionRate.toFixed(0)}%
                </span>
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Viagens Concluídas</p>
              <div className="text-2xl sm:text-3xl font-black text-emerald-600 mt-1">{completedTrips}</div>
              <div className="flex items-center gap-1 mt-2 text-[10px] font-bold text-emerald-600">
                <span>Taxa de sucesso operacional</span>
              </div>
            </div>

            {/* Em Andamento / Agora */}
            <div 
              onClick={() => handleOpenDrillDown('Viagens em Andamento', `${inProgressTrips} veículos em circulação`, (s) => s.status === 'em_curso' || (s.status === 'confirmado' && new Date(s.departureDateTime) <= now && new Date(s.returnDateTime) >= now))}
              className="bg-white p-4.5 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer group relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-blue-500 rounded-l-full"></div>
              <div className="flex items-center justify-between mb-2">
                <div className="w-9 h-9 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <Car className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-black text-blue-700 bg-blue-50 px-2 py-0.5 rounded-lg uppercase tracking-wider animate-pulse">
                  Agora
                </span>
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Em Andamento</p>
              <div className="text-2xl sm:text-3xl font-black text-blue-600 mt-1">{inProgressTrips}</div>
              <div className="flex items-center gap-1 mt-2 text-[10px] font-bold text-blue-600">
                <span>{vehiclesInTripNow} veículos na rua</span>
              </div>
            </div>

            {/* Passageiros */}
            <div 
              onClick={() => handleOpenDrillDown('Passageiros Transportados', `${totalPassengers} pessoas atendidas no período`, (s) => s.status !== 'cancelado')}
              className="bg-white p-4.5 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer group relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-purple-500 rounded-l-full"></div>
              <div className="flex items-center justify-between mb-2">
                <div className="w-9 h-9 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                  <Users className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-black text-purple-700 bg-purple-50 px-2 py-0.5 rounded-lg uppercase tracking-wider">
                  {(totalPassengers / Math.max(1, totalTrips)).toFixed(1)} / viagem
                </span>
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Passageiros Transport.</p>
              <div className="text-2xl sm:text-3xl font-black text-purple-600 mt-1">{totalPassengers}</div>
              <div className="flex items-center gap-1 mt-2 text-[10px] font-bold text-slate-400">
                <span>{averageCapacityOccupancy.toFixed(0)}% ocupação média</span>
              </div>
            </div>

            {/* Canceladas / Rejeitadas */}
            <div 
              onClick={() => handleOpenDrillDown('Viagens Canceladas e Rejeitadas', `${canceledTrips} solicitações canceladas ou negadas`, (s) => s.status === 'cancelado')}
              className="bg-white p-4.5 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer group relative overflow-hidden col-span-2 sm:col-span-1"
            >
              <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-rose-500 rounded-l-full"></div>
              <div className="flex items-center justify-between mb-2">
                <div className="w-9 h-9 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                  <XCircle className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-black text-rose-700 bg-rose-50 px-2 py-0.5 rounded-lg uppercase tracking-wider">
                  {cancellationRate.toFixed(1)}%
                </span>
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Canceladas / Rejeitadas</p>
              <div className="text-2xl sm:text-3xl font-black text-rose-600 mt-1">{canceledTrips}</div>
              <div className="flex items-center gap-1 mt-2 text-[10px] font-bold text-rose-500">
                <span>{rejectedTrips} rejeitadas por gestor</span>
              </div>
            </div>

          </div>

          {/* ==================================================== */}
          {/* BLOCO 2: OPERAÇÃO ATUAL (EM TEMPO REAL)              */}
          {/* ==================================================== */}
          <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-indigo-950 rounded-3xl p-5 sm:p-7 text-white shadow-xl relative overflow-hidden">
            <div className="relative z-10 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-cyan-500/20 rounded-2xl border border-cyan-400/30 text-cyan-300">
                    <Gauge className="w-5 h-5 animate-spin-slow" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg sm:text-xl font-black tracking-tight">Operação em Tempo Real</h2>
                      <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                        Ao Vivo
                      </span>
                    </div>
                    <p className="text-slate-300 text-xs mt-0.5">Visão instantânea de circulação da frota e saídas iminentes</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-300 bg-white/5 px-3 py-1.5 rounded-2xl border border-white/10">
                  <Clock className="w-4 h-4 text-cyan-400" />
                  <span>Atualizado às {now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>

              {/* Grid da Operação Instantânea */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white/5 backdrop-blur-sm p-3.5 rounded-2xl border border-white/10">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Viagens Acontecendo</span>
                  <div className="text-2xl font-black text-cyan-300 mt-1">{currentRunningTrips.length}</div>
                  <span className="text-[10px] text-slate-400">{vehiclesInTripNow} veículos em rota</span>
                </div>

                <div className="bg-white/5 backdrop-blur-sm p-3.5 rounded-2xl border border-white/10">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Passageiros na Rua</span>
                  <div className="text-2xl font-black text-indigo-300 mt-1">
                    {currentRunningTrips.reduce((acc, s) => acc + countSchedulePassengers(s), 0)}
                  </div>
                  <span className="text-[10px] text-slate-400">Em trânsito agora</span>
                </div>

                <div className="bg-white/5 backdrop-blur-sm p-3.5 rounded-2xl border border-white/10">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Próximas Saídas</span>
                  <div className="text-2xl font-black text-amber-300 mt-1">{upcomingTrips.length}</div>
                  <span className="text-[10px] text-slate-400">Programadas adiante</span>
                </div>

                <div className="bg-white/5 backdrop-blur-sm p-3.5 rounded-2xl border border-white/10">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Retornos Atrasados</span>
                  <div className={`text-2xl font-black mt-1 ${delayedTrips.length > 0 ? 'text-rose-400 animate-pulse' : 'text-emerald-400'}`}>
                    {delayedTrips.length}
                  </div>
                  <span className="text-[10px] text-slate-400">{delayedTrips.length > 0 ? 'Exigem verificação' : 'Horários regulares'}</span>
                </div>
              </div>

              {/* Lista Compacta de Próximas Saídas */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                  <span>Próximas Viagens Agendadas</span>
                  <span className="text-[10px] text-slate-400">Ordem cronológica</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {upcomingTrips.slice(0, 3).map((trip) => {
                    const v = vehicles.find(veh => veh.id === trip.vehicleId);
                    const p = persons.find(per => per.id === trip.driverId);
                    const sec = sectors.find(sect => sect.id === trip.serviceSectorId);
                    const depDate = new Date(trip.departureDateTime);

                    return (
                      <div 
                        key={trip.id}
                        onClick={() => handleOpenDrillDown(`Viagem ${trip.protocol}`, `Detalhes de ${trip.destination}`, (s) => s.id === trip.id)}
                        className="bg-white/10 hover:bg-white/15 p-3 rounded-2xl border border-white/10 transition-all cursor-pointer flex flex-col justify-between gap-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <span className="text-xs font-black text-cyan-300 truncate block">{trip.destination}</span>
                            <span className="text-[10px] text-slate-300 font-medium truncate block">{sec?.name || 'Setor Geral'}</span>
                          </div>
                          <span className="px-2 py-0.5 rounded-lg bg-indigo-500/30 text-indigo-200 text-[10px] font-bold shrink-0">
                            {depDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-slate-300 pt-1 border-t border-white/10">
                          <span className="truncate">{v ? `${v.plate} (${v.model})` : 'Sem Veículo'}</span>
                          <span className="truncate">{p?.name ? p.name.split(' ')[0] : 'Sem Motorista'}</span>
                        </div>
                      </div>
                    );
                  })}
                  {upcomingTrips.length === 0 && (
                    <div className="col-span-3 text-center py-4 text-xs text-slate-400 italic">
                      Nenhuma saída agendada para as próximas horas.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ==================================================== */}
          {/* BLOCO 3 & 4: FROTA, OCUPAÇÃO E MOTORISTAS             */}
          {/* ==================================================== */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Painel da Frota */}
            <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                      <Car className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-black text-slate-800">Status da Frota</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Disponibilidade e Uso</p>
                    </div>
                  </div>
                  <span className="text-xs font-black text-blue-600 bg-blue-50 px-2.5 py-1 rounded-xl">
                    {fleetUtilizationRate.toFixed(0)}% Uso
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Veículos Ativos</span>
                    <div className="text-xl font-black text-slate-800 mt-0.5">{activeVehiclesInPeriod}</div>
                    <span className="text-[10px] text-slate-500">De {totalVehiclesCount} cadastrados</span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Disponíveis Agora</span>
                    <div className="text-xl font-black text-emerald-600 mt-0.5">{availableVehiclesCount}</div>
                    <span className="text-[10px] text-slate-500">Prontos p/ saída</span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Em Manutenção</span>
                    <div className="text-xl font-black text-amber-600 mt-0.5">{unavailableVehicles}</div>
                    <span className="text-[10px] text-slate-500">Oficina / Inativos</span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">KM Total Estimado</span>
                    <div className="text-xl font-black text-indigo-600 mt-0.5">{totalEstimatedKm.toLocaleString()}</div>
                    <span className="text-[10px] text-slate-500">{(totalEstimatedKm / Math.max(1, completedTrips)).toFixed(0)} km / viagem</span>
                  </div>
                </div>
              </div>

              {/* Veículo Mais Utilizado */}
              {vehiclesUsage.length > 0 && (
                <div className="mt-4 p-3 bg-blue-50/60 rounded-2xl border border-blue-100 flex items-center justify-between">
                  <div className="min-w-0">
                    <span className="text-[9px] font-black text-blue-700 uppercase tracking-widest block">Veículo Mais Acionado</span>
                    <span className="text-xs font-black text-slate-800 truncate block">{vehiclesUsage[0].name}</span>
                  </div>
                  <span className="px-2.5 py-1 bg-blue-600 text-white font-black text-xs rounded-xl shrink-0 shadow-sm">
                    {vehiclesUsage[0].viagens} viagens
                  </span>
                </div>
              )}
            </div>

            {/* Ocupação e Compartilhamento */}
            <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
                      <Share2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-black text-slate-800">Ocupação & Caronas</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Eficiência de Vagas</p>
                    </div>
                  </div>
                  <span className="text-xs font-black text-purple-600 bg-purple-50 px-2.5 py-1 rounded-xl">
                    {averageCapacityOccupancy.toFixed(0)}% Ocupado
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Capacidade Oferecida</span>
                      <div className="text-lg font-black text-slate-800">{totalCapacityOffered} assentos</div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Vagas Ociosas</span>
                      <div className="text-lg font-black text-slate-500">{idleCapacity} vagas</div>
                    </div>
                  </div>

                  <div className="p-3 bg-purple-50/50 rounded-2xl border border-purple-100 space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-bold text-purple-900">
                      <span>Viagens Compartilhadas</span>
                      <span>{sharedTripsCount} viagens ({((sharedTripsCount / Math.max(1, totalTrips)) * 100).toFixed(0)}%)</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-600">
                      <span>Vagas Extras Aproveitadas</span>
                      <span className="font-bold text-purple-700">+{extraPassengersAccommodated} passageiros</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-600">
                      <span>Viagens Evitadas (Economia)</span>
                      <span className="font-bold text-emerald-600">~{estimatedAvoidedTrips} saídas a menos</span>
                    </div>
                  </div>
                </div>
              </div>

              <p className="text-[10px] text-slate-400 mt-3 italic">
                * O compartilhamento otimiza custos com combustível, motoristas e manutenção da frota.
              </p>
            </div>

            {/* Presença de Motoristas */}
            <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                      <UserCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-black text-slate-800">Motoristas em Escala</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Atuação e Descanso</p>
                    </div>
                  </div>
                  <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-xl">
                    {totalActiveDrivers} em campo
                  </span>
                </div>

                <div className="space-y-2.5 max-h-[190px] overflow-y-auto custom-scrollbar pr-1">
                  {driverStats.slice(0, 4).map((d) => (
                    <div 
                      key={d.id}
                      onClick={() => handleOpenDrillDown(`Viagens de ${d.name}`, `${d.trips} viagens realizadas`, (s) => s.driverId === d.id)}
                      className="p-2.5 bg-slate-50 hover:bg-slate-100/80 rounded-2xl border border-slate-100 transition-all cursor-pointer flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-slate-800 truncate block">{d.name}</span>
                        <span className="text-[10px] text-slate-400 font-medium block">
                          {d.daysWorked} dias rodados • {d.weekendDays} fins de semana
                        </span>
                      </div>
                      <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 font-black text-xs rounded-xl shrink-0">
                        {d.trips} viagens
                      </span>
                    </div>
                  ))}
                  {driverStats.length === 0 && (
                    <div className="text-center py-6 text-xs text-slate-400">
                      Nenhum motorista com viagens no período.
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 pt-2 border-t border-slate-100">
                <span>Média por Motorista: {(totalTrips / Math.max(1, totalActiveDrivers)).toFixed(1)} viagens</span>
                <span className="text-emerald-600">{driversInTripNow} em rota agora</span>
              </div>
            </div>

          </div>

          {/* ==================================================== */}
          {/* BLOCO 5: GRÁFICOS ANALÍTICOS (EVOLUÇÃO E DESTINOS)   */}
          {/* ==================================================== */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Gráfico de Evolução Temporal */}
            <div className="lg:col-span-2 bg-white p-5 sm:p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col h-[340px]">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-800 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-indigo-600" />
                    Evolução Diária de Saídas
                  </h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Histórico de viagens no período</p>
                </div>
              </div>

              <div className="flex-1 min-h-0 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={tripsOverTime} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorConcluidas" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} dy={10} minTickGap={20} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)' }}
                      labelStyle={{ fontWeight: 900, color: '#1e293b', marginBottom: '0.25rem' }}
                    />
                    <Legend verticalAlign="top" height={30} iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 700 }} />
                    <Area type="monotone" dataKey="total" name="Total Solicitado" stroke="#6366f1" strokeWidth={2.5} fillOpacity={1} fill="url(#colorCount)" />
                    <Area type="monotone" dataKey="concluidas" name="Concluídas" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorConcluidas)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Gráfico de Destinos Principais */}
            <div className="bg-white p-5 sm:p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col h-[340px]">
              <div className="mb-3">
                <h3 className="text-sm sm:text-base font-black text-slate-800 flex items-center gap-2">
                  <PieChartIcon className="w-4 h-4 text-emerald-600" />
                  Destinos Mais Frequentes
                </h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Principais cidades atendidas</p>
              </div>

              <div className="flex-1 min-h-0 flex items-center justify-center">
                {destinationsData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={destinationsData}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={70}
                        paddingAngle={4}
                        dataKey="viagens"
                        stroke="none"
                      >
                        {destinationsData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                      <Legend 
                        verticalAlign="bottom" 
                        height={40} 
                        iconType="circle" 
                        iconSize={8}
                        wrapperStyle={{ fontSize: '10px', fontWeight: 700, color: '#475569' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center text-slate-400">
                    <MapPin className="w-8 h-8 mx-auto mb-2 opacity-20" />
                    <p className="text-xs font-bold">Sem destinos no período</p>
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* ==================================================== */}
          {/* BLOCO 6: DEMANDAS POR SETOR E CANCELAMENTOS          */}
          {/* ==================================================== */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Setores Demandantes */}
            <div className="bg-white p-5 sm:p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col h-[320px]">
              <div className="mb-3">
                <h3 className="text-sm sm:text-base font-black text-slate-800 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-amber-500" />
                  Demanda por Setor Solicitante
                </h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Volume de agendamentos por secretaria</p>
              </div>

              <div className="flex-1 min-h-0 w-full">
                {sectorsUsage.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={sectorsUsage} layout="vertical" margin={{ top: 0, right: 25, left: 15, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                      <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                      <YAxis dataKey="name" type="category" width={110} axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} />
                      <Tooltip 
                        cursor={{ fill: '#f8fafc' }}
                        contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)' }}
                      />
                      <Bar dataKey="viagens" fill="#f59e0b" radius={[0, 8, 8, 0]} barSize={18} name="Viagens Solicitadas" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                    Sem registros para o setor selecionado.
                  </div>
                )}
              </div>
            </div>

            {/* Motivos de Cancelamento & Rejeição */}
            <div className="bg-white p-5 sm:p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-sm sm:text-base font-black text-slate-800 flex items-center gap-2">
                      <XCircle className="w-4 h-4 text-rose-500" />
                      Cancelamentos & Rejeições
                    </h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Principais motivos apontados</p>
                  </div>
                  <span className="text-xs font-black text-rose-600 bg-rose-50 px-2.5 py-1 rounded-xl">
                    {canceledTrips} ocorrências
                  </span>
                </div>

                <div className="space-y-2 max-h-[200px] overflow-y-auto custom-scrollbar pr-1">
                  {cancellationReasonsData.map((item, idx) => (
                    <div 
                      key={idx}
                      onClick={() => handleOpenDrillDown(`Cancelamentos: ${item.motivo}`, `${item.total} ocorrências com este motivo`, (s) => s.status === 'cancelado' && (s.cancellationReason || 'Não informado / Cancelamento Direto').includes(item.motivo))}
                      className="p-3 bg-slate-50 hover:bg-rose-50/50 rounded-2xl border border-slate-100 transition-all cursor-pointer flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-slate-800 truncate block">{item.motivo}</span>
                        <span className="text-[10px] text-slate-400">
                          {((item.total / Math.max(1, canceledTrips)) * 100).toFixed(1)}% dos cancelamentos
                        </span>
                      </div>
                      <span className="px-2.5 py-1 bg-rose-100 text-rose-700 font-black text-xs rounded-xl shrink-0">
                        {item.total}
                      </span>
                    </div>
                  ))}
                  {cancellationReasonsData.length === 0 && (
                    <div className="text-center py-10 text-xs text-slate-400 italic">
                      Nenhum cancelamento ou rejeição no período.
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-500">
                <span>Taxa de Rejeição Geral:</span>
                <span className="text-rose-600">{cancellationRate.toFixed(1)}%</span>
              </div>
            </div>

          </div>

          {/* ==================================================== */}
          {/* BLOCO 7: ALERTAS GERENCIAIS                          */}
          {/* ==================================================== */}
          {alertsList.length > 0 && (
            <div className="bg-white p-5 sm:p-7 rounded-3xl border border-amber-200/80 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-slate-900">Alertas Gerenciais da Frota</h3>
                    <p className="text-xs text-slate-500">Situações prioritárias que exigem atenção do gestor</p>
                  </div>
                </div>
                <span className="px-3 py-1 bg-amber-100 text-amber-800 font-black text-xs rounded-full">
                  {alertsList.length} Alerta(s)
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {alertsList.map((alert) => (
                  <div
                    key={alert.id}
                    onClick={() => handleOpenDrillDown(alert.title, alert.description, alert.filter)}
                    className="p-4 rounded-2xl bg-amber-50/40 border border-amber-200 hover:border-amber-300 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between gap-3 group"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="text-xs font-black text-amber-950 group-hover:text-amber-700 transition-colors">
                          {alert.title}
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-amber-200 text-amber-900 shrink-0">
                          {alert.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                        {alert.description}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 text-[10px] font-black text-amber-700 group-hover:translate-x-1 transition-transform">
                      <span>Ver agendamentos</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ==================================================== */}
          {/* BLOCO 8: RESUMO COMPARATIVO GERENCIAL                */}
          {/* ==================================================== */}
          <div className="bg-white p-5 sm:p-7 rounded-3xl border border-slate-100 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <BarChart2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900">Resumo Gerencial Comparativo</h3>
                  <p className="text-xs text-slate-500">Desempenho em relação ao período anterior equivalente</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* Viagens Concluídas */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Viagens Concluídas</span>
                  <div className="text-2xl font-black text-slate-900 mt-1">{completedTrips}</div>
                </div>
                <div className="flex items-center gap-1.5 mt-3 text-xs font-bold">
                  {(() => {
                    const varInfo = calcVariation(completedTrips, prevCompletedTrips);
                    return (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg ${
                        varInfo.type === 'up' ? 'bg-emerald-100 text-emerald-800' :
                        varInfo.type === 'down' ? 'bg-rose-100 text-rose-800' : 'bg-slate-200 text-slate-700'
                      }`}>
                        {varInfo.type === 'up' ? <ArrowUpRight className="w-3.5 h-3.5" /> :
                         varInfo.type === 'down' ? <ArrowDownRight className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
                        {varInfo.val} vs anterior ({prevCompletedTrips})
                      </span>
                    );
                  })()}
                </div>
              </div>

              {/* Total Solicitado */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Demanda de Viagens</span>
                  <div className="text-2xl font-black text-slate-900 mt-1">{totalTrips}</div>
                </div>
                <div className="flex items-center gap-1.5 mt-3 text-xs font-bold">
                  {(() => {
                    const varInfo = calcVariation(totalTrips, prevTotalTrips);
                    return (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg ${
                        varInfo.type === 'up' ? 'bg-indigo-100 text-indigo-800' :
                        varInfo.type === 'down' ? 'bg-slate-200 text-slate-700' : 'bg-slate-200 text-slate-700'
                      }`}>
                        {varInfo.type === 'up' ? <ArrowUpRight className="w-3.5 h-3.5" /> :
                         varInfo.type === 'down' ? <ArrowDownRight className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
                        {varInfo.val} vs anterior ({prevTotalTrips})
                      </span>
                    );
                  })()}
                </div>
              </div>

              {/* Volume de Passageiros */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Passageiros Transportados</span>
                  <div className="text-2xl font-black text-slate-900 mt-1">{totalPassengers}</div>
                </div>
                <div className="flex items-center gap-1.5 mt-3 text-xs font-bold">
                  {(() => {
                    const varInfo = calcVariation(totalPassengers, prevTotalPassengers);
                    return (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg ${
                        varInfo.type === 'up' ? 'bg-purple-100 text-purple-800' :
                        varInfo.type === 'down' ? 'bg-slate-200 text-slate-700' : 'bg-slate-200 text-slate-700'
                      }`}>
                        {varInfo.type === 'up' ? <ArrowUpRight className="w-3.5 h-3.5" /> :
                         varInfo.type === 'down' ? <ArrowDownRight className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
                        {varInfo.val} vs anterior ({prevTotalPassengers})
                      </span>
                    );
                  })()}
                </div>
              </div>

              {/* Quilometragem Total */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Distância Rodada (KM)</span>
                  <div className="text-2xl font-black text-slate-900 mt-1">{totalEstimatedKm.toLocaleString()} km</div>
                </div>
                <div className="flex items-center gap-1.5 mt-3 text-xs font-bold">
                  {(() => {
                    const varInfo = calcVariation(totalEstimatedKm, prevTotalKm);
                    return (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg ${
                        varInfo.type === 'up' ? 'bg-blue-100 text-blue-800' :
                        varInfo.type === 'down' ? 'bg-slate-200 text-slate-700' : 'bg-slate-200 text-slate-700'
                      }`}>
                        {varInfo.type === 'up' ? <ArrowUpRight className="w-3.5 h-3.5" /> :
                         varInfo.type === 'down' ? <ArrowDownRight className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
                        {varInfo.val} vs anterior ({prevTotalKm.toLocaleString()} km)
                      </span>
                    );
                  })()}
                </div>
              </div>

            </div>
          </div>

        </div>
      </div>

      {/* ==================================================== */}
      {/* MODAL DE DRILL-DOWN INTERATIVO COM EXPORTAÇÃO        */}
      {/* ==================================================== */}
      {drillDownModal?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh] animate-slide-up">
            
            {/* Header do Modal */}
            <div className="p-5 sm:p-6 bg-slate-900 text-white flex items-center justify-between gap-4 shrink-0">
              <div>
                <h3 className="text-lg sm:text-xl font-black">{drillDownModal.title}</h3>
                {drillDownModal.subtitle && (
                  <p className="text-xs text-slate-400 mt-0.5">{drillDownModal.subtitle}</p>
                )}
              </div>
              <button
                onClick={() => setDrillDownModal(null)}
                className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Controles e Filtros Internos do Modal */}
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
              <div className="relative w-full sm:w-80">
                <input
                  type="text"
                  value={drillSearch}
                  onChange={(e) => setDrillSearch(e.target.value)}
                  placeholder="Buscar por protocolo, destino, motorista, placa..."
                  className="w-full pl-9 pr-4 py-2 bg-white rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <select
                  value={drillStatusFilter}
                  onChange={(e) => setDrillStatusFilter(e.target.value)}
                  className="px-3 py-2 bg-white rounded-xl border border-slate-200 text-xs font-bold text-slate-700 outline-none cursor-pointer"
                >
                  <option value="todos">Todos os Status</option>
                  <option value="confirmado">Confirmadas</option>
                  <option value="concluido">Concluídas</option>
                  <option value="em_curso">Em Curso</option>
                  <option value="pendente">Pendentes</option>
                  <option value="cancelado">Canceladas</option>
                </select>

                <button
                  onClick={handleExportDrillCsv}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer shrink-0"
                >
                  <Download className="w-4 h-4" />
                  <span>Exportar CSV</span>
                </button>
              </div>
            </div>

            {/* Tabela de Registros */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
              {drillDownFilteredItems.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-400">
                        <th className="py-2.5 px-3">Protocolo</th>
                        <th className="py-2.5 px-3">Data / Horário</th>
                        <th className="py-2.5 px-3">Destino</th>
                        <th className="py-2.5 px-3">Setor</th>
                        <th className="py-2.5 px-3">Veículo / Motorista</th>
                        <th className="py-2.5 px-3 text-center">Passag.</th>
                        <th className="py-2.5 px-3 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                      {drillDownFilteredItems.map((s) => {
                        const v = vehicles.find(veh => veh.id === s.vehicleId);
                        const p = persons.find(per => per.id === s.driverId);
                        const sec = sectors.find(sect => sect.id === s.serviceSectorId);
                        const dep = new Date(s.departureDateTime);

                        return (
                          <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                            <td className="py-3 px-3 font-bold text-indigo-700 whitespace-nowrap">
                              {s.protocol}
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap">
                              <div>{dep.toLocaleDateString('pt-BR')}</div>
                              <span className="text-[10px] text-slate-400">
                                {dep.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              <div className="font-bold text-slate-900">{s.destination}</div>
                              <span className="text-[10px] text-slate-400 truncate max-w-[180px] block">
                                {s.purpose}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-slate-600">
                              {sec?.name || 'Geral'}
                            </td>
                            <td className="py-3 px-3">
                              <div className="font-bold text-slate-800">{v ? `${v.plate} (${v.model})` : 'Não alocado'}</div>
                              <span className="text-[10px] text-slate-500">{p?.name || 'Sem motorista'}</span>
                            </td>
                            <td className="py-3 px-3 text-center font-bold text-slate-800">
                              {countSchedulePassengers(s)}
                            </td>
                            <td className="py-3 px-3 text-right">
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider inline-block ${
                                s.status === 'concluido' ? 'bg-emerald-100 text-emerald-800' :
                                s.status === 'confirmado' ? 'bg-indigo-100 text-indigo-800' :
                                s.status === 'em_curso' ? 'bg-blue-100 text-blue-800' :
                                s.status === 'pendente' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                              }`}>
                                {s.status}
                              </span>
                              {s.cancellationReason && (
                                <span className="text-[9px] text-rose-500 block mt-0.5 truncate max-w-[140px]" title={s.cancellationReason}>
                                  {s.cancellationReason}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12 text-slate-400">
                  <FileSpreadsheet className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-xs font-bold">Nenhum registro encontrado para este critério.</p>
                </div>
              )}
            </div>

            {/* Rodapé do Modal */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-500 shrink-0">
              <span>{drillDownFilteredItems.length} registros listados</span>
              <button
                onClick={() => setDrillDownModal(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl transition-all cursor-pointer"
              >
                Fechar
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
