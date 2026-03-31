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
  Users
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

export const VehicleScheduleDashboard: React.FC<DashboardProps> = ({
  schedules, vehicles, persons, sectors, onBack
}) => {
  const [period, setPeriod] = useState<string>('mes');
  const [selectedSector, setSelectedSector] = useState<string>('todos');

  // Extract available months from schedules
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

  // Filtros aplicados focados apenas no período de tempo escolhido
  const schedulesFilteredByPeriod = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return schedules.filter(s => {
      const depDate = new Date(s.departureDateTime);
      if (isNaN(depDate.getTime())) return false;

      if (period === 'hoje') return depDate >= today;
      if (period === 'semana') {
        const lastWeek = new Date(today);
        lastWeek.setDate(today.getDate() - 7);
        return depDate >= lastWeek;
      }
      if (period === 'mes') {
        const lastMonth = new Date(today);
        lastMonth.setMonth(today.getMonth() - 1);
        return depDate >= lastMonth;
      }
      if (period === 'ano') {
        const lastYear = new Date(today);
        lastYear.setFullYear(today.getFullYear() - 1);
        return depDate >= lastYear;
      }
      if (period === 'tudo') return true;

      // Handle specific month 'YYYY-MM'
      const sYyyy = String(depDate.getFullYear());
      const sMm = String(depDate.getMonth() + 1).padStart(2, '0');
      if (`${sYyyy}-${sMm}` === period) return true;

      return false;
    });
  }, [schedules, period]);

  // Setores que possuem pelo menos um registro *dentro do período atual*
  const activeSectors = useMemo(() => {
    const activeIds = new Set(schedulesFilteredByPeriod.map(s => s.serviceSectorId).filter(Boolean));
    return sectors.filter(sec => activeIds.has(sec.id));
  }, [schedulesFilteredByPeriod, sectors]);

  // Filtro final: Aplica a seleção de Setor em cima daquilo que já sofreu filtro por Data
  const filteredSchedules = useMemo(() => {
    return schedulesFilteredByPeriod.filter(s => {
      if (selectedSector !== 'todos' && s.serviceSectorId !== selectedSector) return false;
      return true;
    });
  }, [schedulesFilteredByPeriod, selectedSector]);

  // KPIs
  const totalTrips = filteredSchedules.length;
  const completedTrips = filteredSchedules.filter(s => s.status === 'concluido').length;
  const canceledTrips = filteredSchedules.filter(s => s.status === 'cancelado').length;
  
  // Passenger metrics
  const totalPassengers = filteredSchedules.reduce((acc, s) => {
    let pass = (s.passengers?.length || 0) + 1; // At least driver/requester
    return acc + pass;
  }, 0);

  // Trips over time (Line/Area Chart)
  const tripsOverTime = useMemo(() => {
    const grouped: Record<string, number> = {};
    filteredSchedules.forEach(s => {
      const date = new Date(s.departureDateTime).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      grouped[date] = (grouped[date] || 0) + 1;
    });
    return Object.entries(grouped)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => {
        const [d1, m1] = a.date.split('/');
        const [d2, m2] = b.date.split('/');
        return new Date(2020, parseInt(m1)-1, parseInt(d1)).getTime() - new Date(2020, parseInt(m2)-1, parseInt(d2)).getTime();
      });
  }, [filteredSchedules]);

  // Destinations Pie Chart
  const destinationsData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredSchedules.forEach(s => {
      if (!s.destination) return;
      const city = s.destination.split('-')[0].trim();
      counts[city] = (counts[city] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5); // top 5
  }, [filteredSchedules]);

  // Vehicles Usage Bar Chart
  const vehiclesUsage = useMemo(() => {
    const counts: Record<string, { viagens: number, setors: Set<string> }> = {};
    filteredSchedules.forEach(s => {
      const v = vehicles.find(veh => veh.id === s.vehicleId);
      const label = v ? `${v.plate.toUpperCase()} - ${v.model}` : 'Desconhecido';
      
      const secLabel = s.serviceSectorId ? sectors.find(sec => sec.id === s.serviceSectorId)?.name || 'Sem Setor' : 'Sem Setor';

      if (!counts[label]) counts[label] = { viagens: 0, setors: new Set() };
      counts[label].viagens += 1;
      counts[label].setors.add(secLabel);
    });
    return Object.entries(counts)
      .map(([name, data]) => ({ name, viagens: data.viagens, sectorNames: Array.from(data.setors).join(', ') }))
      .sort((a, b) => b.viagens - a.viagens)
      .slice(0, 5); // top 5
  }, [filteredSchedules, vehicles, sectors]);

  // Sectors Usage Bar Chart
  const sectorsUsage = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredSchedules.forEach(s => {
      const secLabel = s.serviceSectorId ? sectors.find(sec => sec.id === s.serviceSectorId)?.name || 'Desconhecido' : 'Desconhecido';
      counts[secLabel] = (counts[secLabel] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, viagens]) => ({ name, viagens }))
      .sort((a, b) => b.viagens - a.viagens)
      .slice(0, 5);
  }, [filteredSchedules, sectors]);

  // Drivers Ranking Bar Chart
  const driversUsage = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredSchedules.forEach(s => {
      const p = persons.find(per => per.id === s.driverId);
      let label = p ? p.name.trim() : 'Desconhecido';
      const parts = label.split(' ');
      if (parts.length > 2) {
        label = `${parts[0]} ${parts[parts.length - 1]}`; // Short name
      }
      counts[label] = (counts[label] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, viagens]) => ({ name, viagens }))
      .sort((a, b) => b.viagens - a.viagens)
      .slice(0, 5);
  }, [filteredSchedules, persons]);

  // Colors for charts
  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
  const COLORS_ALT = ['#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#14b8a6'];

  const InfoCard = ({ title, value, icon: Icon, color, subtitle }: any) => (
    <div className={`bg-white p-4 sm:p-5 rounded-3xl border border-slate-100 shadow-[0_5px_20px_rgb(0,0,0,0.03)] hover:shadow-lg transition-all flex flex-col items-start min-w-[160px] border-l-4 border-l-${color}-500`}>
      <div className={`w-10 h-10 rounded-2xl bg-${color}-50 text-${color}-600 flex items-center justify-center mb-3 shadow-inner`}>
        <Icon className="w-5 h-5" />
      </div>
      <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{title}</h4>
      <div className="text-2xl font-black text-slate-800 leading-none">{value}</div>
      {subtitle && <p className={`text-[10px] font-bold text-${color}-500/80 mt-2 uppercase tracking-wide`}>{subtitle}</p>}
    </div>
  );

  const CustomVehicleTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 rounded-2xl shadow-xl border border-slate-100 text-xs">
          <p className="font-bold text-slate-800 mb-1">{label}</p>
          <p className="text-blue-600 font-bold mb-1">{payload[0].value} Viagens</p>
          <p className="text-slate-500 max-w-[200px] leading-tight">
            <span className="font-bold text-slate-600">Setores:</span> {payload[0].payload.sectorNames}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex-1 flex flex-col font-sans h-full bg-slate-50 overflow-hidden relative z-0">
      
      {/* Dashboard Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-7xl mx-auto p-4 sm:p-6 md:p-10 space-y-6 md:space-y-8 animate-in slide-in-from-bottom-4 duration-500 pb-32">
          
          {/* Header & Filters */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 bg-white p-6 sm:p-8 rounded-[2.5rem] shadow-sm border border-slate-100/60">
            <div className="flex items-center gap-4">
              {onBack && (
                <button
                  onClick={onBack}
                  className="p-2 z-10 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all group shrink-0"
                  title="Voltar ao Menu"
                >
                  <ArrowLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
                </button>
              )}
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl"><Activity className="w-5 h-5" /></div>
                  <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-800 tracking-tight">Dashboard Analítico</h2>
                </div>
                <p className="text-slate-500 text-[10px] sm:text-xs font-bold uppercase tracking-widest sm:ml-14">Inteligência e Gestão de Uso da Frota</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedSector}
                onChange={(e) => setSelectedSector(e.target.value)}
                className={`px-4 py-2 sm:py-2.5 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest outline-none transition-all cursor-pointer appearance-none border border-slate-200 w-[90px] sm:w-[110px] truncate
                  ${selectedSector !== 'todos' ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20 border-transparent' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
              >
                <option value="todos" className="bg-white text-slate-800 font-bold">Setores</option>
                {activeSectors.map(sec => (
                  <option key={sec.id} value={sec.id} className="bg-white text-slate-800 font-bold">{sec.name}</option>
                ))}
              </select>

              <select
                value={period.includes('-') ? period : ''}
                onChange={(e) => {
                  if (e.target.value) setPeriod(e.target.value);
                }}
                className={`px-4 py-2 sm:py-2.5 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest outline-none transition-all cursor-pointer appearance-none border border-slate-200 w-[70px] sm:w-[90px] truncate
                  ${period.includes('-') ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 border-transparent' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
              >
                <option value="" disabled>Mês</option>
                {availableMonths.map(m => (
                  <option key={m} value={m} className="bg-white text-slate-800 font-bold">{getMonthName(m)}</option>
                ))}
              </select>

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
                  className={`px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${period === p.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 scale-105' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* KPIs Grid - COMPACTADO */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            <InfoCard title="Total no Período" value={totalTrips} icon={TrendingUp} color="indigo" subtitle="Viagens agendadas" />
            <InfoCard title="Viagens Concluídas" value={completedTrips} icon={MapPin} color="emerald" subtitle={`${((completedTrips/Math.max(1, totalTrips))*100).toFixed(1)}% do total`} />
            <InfoCard title="Passageiros Transport." value={totalPassengers} icon={Users} color="blue" subtitle="Estimativa de volume" />
            <InfoCard title="Cancel./Rejeitadas" value={canceledTrips} icon={Clock} color="rose" subtitle={`${((canceledTrips/Math.max(1, totalTrips))*100).toFixed(1)}% de falhas`} />
          </div>

          {/* Charts Row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white p-5 sm:p-6 md:p-8 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col h-[350px]">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-800 flex items-center gap-2"><Activity className="w-5 h-5 text-indigo-500" /> Evolução de Agendamentos</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Volume de saídas por dia</p>
                </div>
              </div>
              <div className="flex-1 min-h-0 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={tripsOverTime} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} dy={10} minTickGap={20} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)' }}
                      labelStyle={{ fontWeight: 900, color: '#1e293b', marginBottom: '0.25rem' }}
                    />
                    <Area type="monotone" dataKey="count" name="Viagens" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorCount)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-5 sm:p-6 md:p-8 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col h-[350px]">
              <div className="mb-4">
                <h3 className="text-base sm:text-lg font-black text-slate-800 flex items-center gap-2"><PieChartIcon className="w-5 h-5 text-emerald-500" /> Destinos Frequentes</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">As 5 cidades preferidas</p>
              </div>
              <div className="flex-1 min-h-0 flex items-center justify-center">
                {destinationsData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={destinationsData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={5}
                        dataKey="value"
                        stroke="none"
                      >
                        {destinationsData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                      <Legend 
                        verticalAlign="bottom" 
                        height={36} 
                        iconType="circle" 
                        iconSize={8}
                        wrapperStyle={{ fontSize: '10px', fontWeight: 700, color: '#475569' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center text-slate-400">
                    <MapPin className="w-8 h-8 mx-auto mb-2 opacity-20" />
                    <p className="text-[10px] font-bold uppercase tracking-widest">Sem viagens no período</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Charts Row 2 - Bar Charts for Rankings */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Top Vectors */}
            <div className="lg:col-span-1 bg-white p-5 sm:p-6 md:p-8 rounded-[2rem] shadow-sm border border-slate-100 h-[350px] flex flex-col">
              <div className="mb-6">
                <h3 className="text-base sm:text-lg font-black text-slate-800 flex items-center gap-2"><BarChart2 className="w-5 h-5 text-blue-500" /> Uso por Veículo</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Carros mais acionados e setores</p>
              </div>
              <div className="flex-1 min-h-0 w-full">
                {vehiclesUsage.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={vehiclesUsage} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                      <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                      <YAxis dataKey="name" type="category" width={80} axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} />
                      <Tooltip cursor={{ fill: '#f8fafc' }} content={<CustomVehicleTooltip />} />
                      <Bar dataKey="viagens" fill="#3b82f6" radius={[0, 8, 8, 0]} barSize={20} name="Viagens">
                        {vehiclesUsage.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS_ALT[index % COLORS_ALT.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-400">
                    <div className="text-center">
                      <Car className="w-8 h-8 mx-auto mb-2 opacity-20" />
                      <p className="text-[10px] font-bold uppercase tracking-widest">Sem veículos acionados</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Sectors Distribution */}
            <div className="lg:col-span-1 bg-white p-5 sm:p-6 md:p-8 rounded-[2rem] shadow-sm border border-slate-100 h-[350px] flex flex-col">
              <div className="mb-6">
                <h3 className="text-base sm:text-lg font-black text-slate-800 flex items-center gap-2"><Building2 className="w-5 h-5 text-amber-500" /> Demandas por Setor</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Volume de requisições listadas</p>
              </div>
              <div className="flex-1 min-h-0 w-full">
                 {sectorsUsage.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={sectorsUsage} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                      <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                      <YAxis dataKey="name" type="category" width={90} axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} />
                      <Tooltip 
                        cursor={{ fill: '#f8fafc' }}
                        contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)' }}
                        labelStyle={{ fontWeight: 900, color: '#1e293b', marginBottom: '0.25rem' }}
                      />
                      <Bar dataKey="viagens" fill="#f59e0b" radius={[0, 8, 8, 0]} barSize={20} name="Viagens" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                   <div className="h-full flex items-center justify-center text-slate-400">
                    <div className="text-center">
                      <Building2 className="w-8 h-8 mx-auto mb-2 opacity-20" />
                      <p className="text-[10px] font-bold uppercase tracking-widest">Sem setores demandados</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Drivers Ranking */}
            <div className="lg:col-span-1 bg-white p-5 sm:p-6 md:p-8 rounded-[2rem] shadow-sm border border-slate-100 h-[350px] flex flex-col">
              <div className="mb-6">
                <h3 className="text-base sm:text-lg font-black text-slate-800 flex items-center gap-2"><UserCheck className="w-5 h-5 text-emerald-500" /> Presença de Motoristas</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Histórico de viagens encabeçadas</p>
              </div>
              <div className="flex-1 min-h-0 w-full">
                {driversUsage.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={driversUsage} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                      <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                      <YAxis dataKey="name" type="category" width={80} axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} />
                      <Tooltip 
                        cursor={{ fill: '#f8fafc' }}
                        contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)' }}
                        labelStyle={{ fontWeight: 900, color: '#1e293b', marginBottom: '0.25rem' }}
                      />
                      <Bar dataKey="viagens" fill="#10b981" radius={[0, 8, 8, 0]} barSize={20} name="Viagens">
                        {driversUsage.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={['#10b981', '#059669', '#34d399', '#6ee7b7'][index % 4]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-400">
                    <div className="text-center">
                      <UserCheck className="w-8 h-8 mx-auto mb-2 opacity-20" />
                      <p className="text-[10px] font-bold uppercase tracking-widest">Nenhum motorista alocado</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
};
