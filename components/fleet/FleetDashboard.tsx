import React, { useState, useMemo } from 'react';
import { 
    Vehicle, 
    Sector, 
    Person 
} from '../../types';
import { 
    FleetMaintenance, 
    FleetPart, 
    FleetSupplier, 
    VehicleHealthInfo,
    HealthStatus
} from '../../types/fleetTypes';
import { 
    Car, 
    Gauge, 
    Fuel, 
    Wrench, 
    AlertTriangle, 
    CheckCircle2, 
    Clock, 
    TrendingUp, 
    DollarSign, 
    Package, 
    ArrowUpRight, 
    Activity, 
    Calendar, 
    ShieldCheck, 
    Sparkles, 
    Search, 
    Filter, 
    ChevronRight, 
    Eye,
    Plus,
    X,
    Flame,
    Droplet,
    Layers,
    Truck,
    Bus
} from 'lucide-react';
import { AbastecimentoRecord } from '../../services/abastecimentoService';

interface FleetDashboardProps {
    vehicles: Vehicle[];
    maintenances: FleetMaintenance[];
    parts: FleetPart[];
    abastecimentos: AbastecimentoRecord[];
    suppliers: FleetSupplier[];
    healthList: VehicleHealthInfo[];
    onNavigate: (tab: string, subId?: string) => void;
    onOpenVehicleRecord: (vehicleId: string) => void;
    onOpenHealthModal: (health: VehicleHealthInfo, vehicle: Vehicle) => void;
    onOpenNewMaintenance: (vehicleId?: string) => void;
    onOpenNewPart: () => void;
    onOpenNewPurchase: () => void;
}

export const FleetDashboard: React.FC<FleetDashboardProps> = ({
    vehicles,
    maintenances,
    parts,
    abastecimentos,
    suppliers,
    healthList,
    onNavigate,
    onOpenVehicleRecord,
    onOpenHealthModal,
    onOpenNewMaintenance,
    onOpenNewPart,
    onOpenNewPurchase
}) => {
    const [healthFilter, setHealthFilter] = useState<'todos' | 'vencido' | 'proximo' | 'em_dia'>('todos');
    const [healthSearch, setHealthSearch] = useState('');

    // Map O(1) de Veículos por ID
    const vehicleMap = useMemo(() => {
        const map = new Map<string, Vehicle>();
        vehicles.forEach(v => map.set(v.id, v));
        return map;
    }, [vehicles]);

    // Métricas Calculadas
    const metrics = useMemo(() => {
        const totalVehicles = vehicles.length;
        const disponiveis = vehicles.filter(v => v.status === 'operacional').length;
        const indisponiveis = vehicles.filter(v => v.status !== 'operacional').length;
        const emManutencao = vehicles.filter(v => v.status === 'manutencao').length;
        const paraAgendamento = vehicles.filter(v => v.availableForScheduling === 'Sim' || v.availableForScheduling === undefined).length;

        // KM Total e Média
        const totalKm = vehicles.reduce((acc, v) => acc + (Number(v.currentKm) || 0), 0);
        const avgKm = totalVehicles > 0 ? Math.round(totalKm / totalVehicles) : 0;

        // Abastecimentos e Combustível
        const totalAbast = abastecimentos.length;
        const totalFuelCost = abastecimentos.reduce((acc, a) => acc + (Number(a.cost) || 0), 0);
        const totalLiters = abastecimentos.reduce((acc, a) => acc + (Number(a.liters) || 0), 0);
        const avgPricePerLiter = totalLiters > 0 ? totalFuelCost / totalLiters : 0;

        // Manutenções e Custos
        const totalMaintenanceCost = maintenances.reduce((acc, m) => acc + (Number(m.total_cost) || 0), 0);
        const totalLaborCost = maintenances.reduce((acc, m) => acc + (Number(m.labor_cost) || 0), 0);
        const totalPartsMaintenanceCost = maintenances.reduce((acc, m) => acc + (Number(m.parts_cost) || 0), 0);

        // Manutenções neste mês
        const currentMonth = new Date().toISOString().substring(0, 7);
        const maintenancesThisMonth = maintenances.filter(m => m.maintenance_date.startsWith(currentMonth));
        const costThisMonth = maintenancesThisMonth.reduce((acc, m) => acc + (Number(m.total_cost) || 0), 0);

        // Saúde da Frota
        const emDiaCount = healthList.filter(h => h.generalStatus === 'em_dia').length;
        const proximoCount = healthList.filter(h => h.generalStatus === 'proximo').length;
        const vencidoCount = healthList.filter(h => h.generalStatus === 'vencido').length;

        // Peças e Estoque
        const totalPartsCount = parts.length;
        const totalStockUnits = parts.reduce((acc, p) => acc + (Number(p.current_stock) || 0), 0);
        const lowStockParts = parts.filter(p => p.current_stock > 0 && p.current_stock <= p.min_stock);
        const outOfStockParts = parts.filter(p => p.current_stock <= 0);
        const estimatedStockValue = parts.reduce((acc, p) => acc + (Number(p.current_stock) * Number(p.average_cost || p.last_purchase_price || 0)), 0);

        // Rankings: Veículos com maior utilização (KM Atual)
        const topKm = [...vehicles]
            .sort((a, b) => (Number(b.currentKm) || 0) - (Number(a.currentKm) || 0))
            .slice(0, 5);

        // Rankings: Veículos com maior custo de manutenção
        const maintenanceCostByVehicle = new Map<string, number>();
        maintenances.forEach(m => {
            const current = maintenanceCostByVehicle.get(m.vehicle_id) || 0;
            maintenanceCostByVehicle.set(m.vehicle_id, current + (Number(m.total_cost) || 0));
        });

        const topCost = [...vehicles]
            .map(v => ({
                vehicle: v,
                totalCost: maintenanceCostByVehicle.get(v.id) || 0
            }))
            .sort((a, b) => b.totalCost - a.totalCost)
            .filter(i => i.totalCost > 0)
            .slice(0, 5);

        return {
            totalVehicles,
            disponiveis,
            indisponiveis,
            emManutencao,
            paraAgendamento,
            totalKm,
            avgKm,
            totalAbast,
            totalFuelCost,
            totalLiters,
            avgPricePerLiter,
            totalMaintenanceCost,
            totalLaborCost,
            totalPartsMaintenanceCost,
            maintenancesThisMonth: maintenancesThisMonth.length,
            costThisMonth,
            emDiaCount,
            proximoCount,
            vencidoCount,
            totalPartsCount,
            totalStockUnits,
            lowStockCount: lowStockParts.length,
            outOfStockCount: outOfStockParts.length,
            estimatedStockValue,
            topKm,
            topCost
        };
    }, [vehicles, maintenances, parts, abastecimentos, healthList]);

    // Filtro da Lista de Saúde da Frota
    const filteredHealthList = useMemo(() => {
        return healthList.filter(h => {
            const v = vehicleMap.get(h.vehicleId);
            if (!v) return false;

            if (healthFilter !== 'todos' && h.generalStatus !== healthFilter) {
                return false;
            }

            if (healthSearch.trim()) {
                const q = healthSearch.toLowerCase();
                const matchPlate = v.plate.toLowerCase().includes(q);
                const matchModel = v.model.toLowerCase().includes(q);
                const matchBrand = (v.brand || '').toLowerCase().includes(q);
                return matchPlate || matchModel || matchBrand;
            }

            return true;
        });
    }, [healthList, vehicleMap, healthFilter, healthSearch]);

    return (
        <div className="space-y-4 md:space-y-6 pb-8 animate-in fade-in duration-300">
            {/* Top Bar: Botões de Ação Rápida */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-3.5 md:p-4 rounded-3xl shadow-xl border border-slate-700/60">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400 shadow-inner">
                        <Activity className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-sm md:text-base font-black uppercase tracking-wider text-white">
                            Central de Gestão da Frota Municipal
                        </h2>
                        <p className="text-[11px] font-semibold text-slate-400">
                            Monitoramento operacional, saúde mecânica e controle financeiro integrado
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        type="button"
                        onClick={() => onOpenNewMaintenance()}
                        className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-amber-500/25 active:scale-95 flex items-center gap-1.5 cursor-pointer"
                    >
                        <Wrench className="w-4 h-4" />
                        <span>Nova Manutenção</span>
                    </button>
                    <button
                        type="button"
                        onClick={onOpenNewPurchase}
                        className="px-3.5 py-2 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-sky-500/25 active:scale-95 flex items-center gap-1.5 cursor-pointer"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Comprar Peças</span>
                    </button>
                </div>
            </div>

            {/* SEÇÃO 1: CARDS DE KPIS PRINCIPAIS (ALTA DENSIDADE) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 md:gap-3.5">
                {/* Total de Veículos */}
                <div 
                    onClick={() => onNavigate('veiculos')}
                    className="bg-white p-3 md:p-3.5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md hover:border-sky-300 transition-all cursor-pointer group"
                >
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total da Frota</span>
                        <div className="w-6 h-6 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
                            <Car className="w-3.5 h-3.5" />
                        </div>
                    </div>
                    <div className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                        {metrics.totalVehicles}
                    </div>
                    <div className="text-[10px] font-bold text-slate-500 mt-0.5 flex items-center gap-1">
                        <span className="text-emerald-600 font-extrabold">{metrics.disponiveis} ativos</span>
                        <span>•</span>
                        <span>{metrics.emManutencao} oficina</span>
                    </div>
                </div>

                {/* Saúde: Em Dia */}
                <div 
                    onClick={() => { setHealthFilter('em_dia'); }}
                    className="bg-white p-3 md:p-3.5 rounded-2xl border border-emerald-200/80 shadow-xs hover:shadow-md hover:border-emerald-300 transition-all cursor-pointer group bg-gradient-to-br from-emerald-50/20 to-white"
                >
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700">Em Dia</span>
                        <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                        </div>
                    </div>
                    <div className="text-xl md:text-2xl font-black text-emerald-950 tracking-tight">
                        {metrics.emDiaCount}
                    </div>
                    <div className="text-[10px] font-bold text-emerald-600 mt-0.5">
                        {metrics.totalVehicles > 0 ? `${Math.round((metrics.emDiaCount / metrics.totalVehicles) * 100)}% da frota` : '100%'}
                    </div>
                </div>

                {/* Saúde: Próximas */}
                <div 
                    onClick={() => { setHealthFilter('proximo'); }}
                    className="bg-white p-3 md:p-3.5 rounded-2xl border border-amber-200/80 shadow-xs hover:shadow-md hover:border-amber-300 transition-all cursor-pointer group bg-gradient-to-br from-amber-50/20 to-white"
                >
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-black uppercase tracking-wider text-amber-700">Próximas</span>
                        <div className="w-6 h-6 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center">
                            <Clock className="w-3.5 h-3.5" />
                        </div>
                    </div>
                    <div className="text-xl md:text-2xl font-black text-amber-950 tracking-tight">
                        {metrics.proximoCount}
                    </div>
                    <div className="text-[10px] font-bold text-amber-700 mt-0.5">
                        Avisos de manutenção
                    </div>
                </div>

                {/* Saúde: Vencidas */}
                <div 
                    onClick={() => { setHealthFilter('vencido'); }}
                    className="bg-white p-3 md:p-3.5 rounded-2xl border border-rose-200/80 shadow-xs hover:shadow-md hover:border-rose-300 transition-all cursor-pointer group bg-gradient-to-br from-rose-50/20 to-white"
                >
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-black uppercase tracking-wider text-rose-700">Vencidas</span>
                        <div className="w-6 h-6 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center">
                            <AlertTriangle className="w-3.5 h-3.5" />
                        </div>
                    </div>
                    <div className="text-xl md:text-2xl font-black text-rose-950 tracking-tight">
                        {metrics.vencidoCount}
                    </div>
                    <div className="text-[10px] font-bold text-rose-600 mt-0.5">
                        Ação preventiva urgente
                    </div>
                </div>

                {/* Quilometragem Total */}
                <div className="bg-white p-3 md:p-3.5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">KM Total Frota</span>
                        <div className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                            <Gauge className="w-3.5 h-3.5" />
                        </div>
                    </div>
                    <div className="text-lg md:text-xl font-black text-slate-900 tracking-tight font-mono truncate">
                        {metrics.totalKm.toLocaleString('pt-BR')} km
                    </div>
                    <div className="text-[10px] font-bold text-slate-500 mt-0.5">
                        Média: {metrics.avgKm.toLocaleString('pt-BR')} km/veículo
                    </div>
                </div>

                {/* Gastos Totais Manutenção */}
                <div 
                    onClick={() => onNavigate('manutencoes')}
                    className="bg-white p-3 md:p-3.5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md hover:border-orange-300 transition-all cursor-pointer group"
                >
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Custo Manutenção</span>
                        <div className="w-6 h-6 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center">
                            <DollarSign className="w-3.5 h-3.5" />
                        </div>
                    </div>
                    <div className="text-lg md:text-xl font-black text-slate-900 tracking-tight truncate">
                        R$ {metrics.totalMaintenanceCost.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className="text-[10px] font-bold text-orange-600 mt-0.5">
                        {maintenances.length} serviços realizados
                    </div>
                </div>
            </div>

            {/* SEÇÃO 2: SAÚDE DA FROTA (DESTAQUE INTEGRAL COM STATUS 🟢 / 🟡 / 🔴) */}
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-lg p-4 md:p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-base md:text-lg font-black bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 bg-clip-text text-transparent uppercase tracking-tight">
                                Saúde da Frota
                            </h3>
                            <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-extrabold text-xs">
                                {filteredHealthList.length} veículos
                            </span>
                        </div>
                        <p className="text-xs font-semibold text-slate-500 mt-0.5">
                            Diagnóstico preventivo automático de óleo, correia, freios, pneus e revisões
                        </p>
                    </div>

                    {/* Filtros de Status Geral */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                            type="button"
                            onClick={() => setHealthFilter('todos')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                                healthFilter === 'todos'
                                ? 'bg-slate-900 text-white shadow-xs'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                        >
                            Todos ({healthList.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setHealthFilter('em_dia')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1 ${
                                healthFilter === 'em_dia'
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                            }`}
                        >
                            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                            <span>Em Dia ({metrics.emDiaCount})</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setHealthFilter('proximo')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1 ${
                                healthFilter === 'proximo'
                                ? 'bg-amber-600 text-white shadow-xs'
                                : 'bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100'
                            }`}
                        >
                            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                            <span>Próximo ({metrics.proximoCount})</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setHealthFilter('vencido')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1 ${
                                healthFilter === 'vencido'
                                ? 'bg-rose-600 text-white shadow-xs'
                                : 'bg-rose-50 text-rose-900 border border-rose-200 hover:bg-rose-100'
                            }`}
                        >
                            <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                            <span>Vencido ({metrics.vencidoCount})</span>
                        </button>
                    </div>
                </div>

                {/* Barra de Busca de Veículos na Saúde da Frota */}
                <div className="relative w-full">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder="Buscar veículo por placa, modelo ou marca na Saúde da Frota..."
                        value={healthSearch}
                        onChange={e => setHealthSearch(e.target.value)}
                        className="w-full pl-10 pr-9 py-2.5 bg-slate-50/90 focus:bg-white border border-slate-200 focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 rounded-2xl text-xs font-bold text-slate-900 placeholder:text-slate-400 transition-all shadow-2xs"
                    />
                    {healthSearch && (
                        <button
                            type="button"
                            onClick={() => setHealthSearch('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-600 p-0.5 rounded-full"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>

                {/* Grid de Cards de Saúde dos Veículos */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[480px] overflow-y-auto custom-scrollbar p-1">
                    {filteredHealthList.map(h => {
                        const v = vehicleMap.get(h.vehicleId);
                        if (!v) return null;

                        return (
                            <div
                                key={h.vehicleId}
                                onClick={() => onOpenHealthModal(h, v)}
                                className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group shadow-2xs hover:shadow-md hover:scale-[1.01] ${
                                    h.generalStatus === 'vencido'
                                    ? 'bg-gradient-to-br from-rose-50/50 via-white to-rose-50/20 border-rose-200/90 hover:border-rose-400'
                                    : h.generalStatus === 'proximo'
                                    ? 'bg-gradient-to-br from-amber-50/50 via-white to-amber-50/20 border-amber-200/90 hover:border-amber-400'
                                    : 'bg-gradient-to-br from-emerald-50/30 via-white to-teal-50/20 border-emerald-200/80 hover:border-emerald-400'
                                }`}
                            >
                                {/* Barra indicadora lateral */}
                                <div className={`absolute top-0 left-0 w-1.5 h-full ${
                                    h.generalStatus === 'vencido'
                                    ? 'bg-rose-500'
                                    : h.generalStatus === 'proximo'
                                    ? 'bg-amber-500'
                                    : 'bg-emerald-500'
                                }`} />

                                <div className="pl-1.5 space-y-2">
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <span className="text-[10px] font-mono font-extrabold uppercase bg-slate-900 text-white px-2 py-0.5 rounded-md tracking-wider">
                                                {v.plate}
                                            </span>
                                            <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight mt-1 line-clamp-1">
                                                {v.model}
                                            </h4>
                                            <span className="text-[10px] font-bold text-slate-500">
                                                {v.brand} {v.year ? `• ${v.year}` : ''}
                                            </span>
                                        </div>

                                        {/* Badge de Status Geral */}
                                        <div className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider shrink-0 flex items-center gap-1 ${
                                            h.generalStatus === 'vencido'
                                            ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                            : h.generalStatus === 'proximo'
                                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                            : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                        }`}>
                                            {h.generalStatus === 'vencido' ? '🔴 Vencido' : h.generalStatus === 'proximo' ? '🟡 Próximo' : '🟢 Em Dia'}
                                        </div>
                                    </div>

                                    {/* Indicadores Rápidos: Óleo e Correia */}
                                    <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-slate-100 text-[10px]">
                                        <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-200/60">
                                            <span className="text-slate-400 font-bold block text-[9px] uppercase">Óleo</span>
                                            <span className={`font-black uppercase ${
                                                h.oilStatus === 'vencido' ? 'text-rose-600' : h.oilStatus === 'proximo' ? 'text-amber-600' : 'text-emerald-700'
                                            }`}>
                                                {h.oilStatus === 'vencido' ? 'Vencido' : h.oilStatus === 'proximo' ? 'Próximo' : 'Em Dia'}
                                            </span>
                                        </div>

                                        <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-200/60">
                                            <span className="text-slate-400 font-bold block text-[9px] uppercase">Correia</span>
                                            <span className={`font-black uppercase ${
                                                h.timingBeltStatus === 'vencido' ? 'text-rose-600' : h.timingBeltStatus === 'proximo' ? 'text-amber-600' : 'text-emerald-700'
                                            }`}>
                                                {h.timingBeltStatus === 'vencido' ? 'Vencida' : h.timingBeltStatus === 'proximo' ? 'Próxima' : 'Em Dia'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 pt-0.5">
                                        <span className="font-mono">KM: {(Number(v.currentKm) || 0).toLocaleString('pt-BR')}</span>
                                        <span className="text-sky-600 group-hover:underline flex items-center gap-0.5">
                                            Ver Raio-X <ChevronRight className="w-3 h-3" />
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {filteredHealthList.length === 0 && (
                        <div className="col-span-full py-8 text-center text-slate-400">
                            <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                            <p className="text-xs font-bold text-slate-600 uppercase">Nenhum veículo corresponde ao filtro selecionado</p>
                        </div>
                    )}
                </div>
            </div>

            {/* SEÇÃO 3: COMPARATIVOS, RANKINGS E ESTOQUE */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Ranking: Maior Utilização (KM) */}
                <div className="bg-white rounded-3xl border border-slate-200/90 shadow-md p-4 space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                                <Gauge className="w-4 h-4" />
                            </div>
                            <h4 className="text-xs md:text-sm font-black text-slate-900 uppercase tracking-tight">
                                Mais Rodados
                            </h4>
                        </div>
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase">Top 5 KM</span>
                    </div>

                    <div className="space-y-2">
                        {metrics.topKm.map((v, i) => (
                            <div 
                                key={v.id}
                                onClick={() => onOpenVehicleRecord(v.id)}
                                className="flex items-center justify-between p-2.5 bg-slate-50/80 hover:bg-indigo-50/40 rounded-xl border border-slate-200/60 transition-all cursor-pointer group"
                            >
                                <div className="flex items-center gap-2 min-w-0">
                                    <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 font-mono text-[10px] font-black flex items-center justify-center shrink-0">
                                        {i + 1}
                                    </span>
                                    <div className="min-w-0">
                                        <span className="text-xs font-black text-slate-900 uppercase truncate block">
                                            {v.model}
                                        </span>
                                        <span className="text-[10px] font-mono font-bold text-slate-500">
                                            {v.plate}
                                        </span>
                                    </div>
                                </div>
                                <span className="text-xs font-mono font-black text-indigo-700 shrink-0">
                                    {(Number(v.currentKm) || 0).toLocaleString('pt-BR')} km
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Ranking: Maior Custo de Manutenção */}
                <div className="bg-white rounded-3xl border border-slate-200/90 shadow-md p-4 space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
                                <Wrench className="w-4 h-4" />
                            </div>
                            <h4 className="text-xs md:text-sm font-black text-slate-900 uppercase tracking-tight">
                                Maior Custo Mecânico
                            </h4>
                        </div>
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase">Top Gastos</span>
                    </div>

                    <div className="space-y-2">
                        {metrics.topCost.map((item, i) => (
                            <div 
                                key={item.vehicle.id}
                                onClick={() => onOpenVehicleRecord(item.vehicle.id)}
                                className="flex items-center justify-between p-2.5 bg-slate-50/80 hover:bg-orange-50/40 rounded-xl border border-slate-200/60 transition-all cursor-pointer group"
                            >
                                <div className="flex items-center gap-2 min-w-0">
                                    <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 font-mono text-[10px] font-black flex items-center justify-center shrink-0">
                                        {i + 1}
                                    </span>
                                    <div className="min-w-0">
                                        <span className="text-xs font-black text-slate-900 uppercase truncate block">
                                            {item.vehicle.model}
                                        </span>
                                        <span className="text-[10px] font-mono font-bold text-slate-500">
                                            {item.vehicle.plate}
                                        </span>
                                    </div>
                                </div>
                                <span className="text-xs font-black text-orange-700 shrink-0">
                                    R$ {item.totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </div>
                        ))}

                        {metrics.topCost.length === 0 && (
                            <div className="py-6 text-center text-slate-400 text-xs font-bold">
                                Nenhuma manutenção registrada com custos
                            </div>
                        )}
                    </div>
                </div>

                {/* Panorama do Almoxarifado / Estoque de Peças */}
                <div className="bg-white rounded-3xl border border-slate-200/90 shadow-md p-4 space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                <Package className="w-4 h-4" />
                            </div>
                            <h4 className="text-xs md:text-sm font-black text-slate-900 uppercase tracking-tight">
                                Almoxarifado de Peças
                            </h4>
                        </div>
                        <button
                            type="button"
                            onClick={() => onNavigate('estoque')}
                            className="text-[10px] font-black text-sky-600 hover:underline uppercase flex items-center gap-0.5 cursor-pointer"
                        >
                            Ver Estoque <ArrowUpRight className="w-3 h-3" />
                        </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/60">
                            <span className="text-[9px] font-black uppercase text-slate-400 block">Itens em Estoque</span>
                            <span className="text-base font-black text-slate-900">{metrics.totalStockUnits} un</span>
                        </div>

                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/60">
                            <span className="text-[9px] font-black uppercase text-slate-400 block">Valor Estimado</span>
                            <span className="text-xs md:text-sm font-black text-emerald-700">
                                R$ {metrics.estimatedStockValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                        </div>

                        <div 
                            onClick={() => onNavigate('estoque')}
                            className="bg-amber-50/60 p-2.5 rounded-xl border border-amber-200/80 cursor-pointer hover:bg-amber-100/60 transition-colors"
                        >
                            <span className="text-[9px] font-black uppercase text-amber-800 block">Estoque Baixo</span>
                            <span className="text-base font-black text-amber-900">{metrics.lowStockCount} itens</span>
                        </div>

                        <div 
                            onClick={() => onNavigate('estoque')}
                            className="bg-rose-50/60 p-2.5 rounded-xl border border-rose-200/80 cursor-pointer hover:bg-rose-100/60 transition-colors"
                        >
                            <span className="text-[9px] font-black uppercase text-rose-800 block">Sem Estoque</span>
                            <span className="text-base font-black text-rose-900">{metrics.outOfStockCount} itens</span>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onOpenNewPart}
                        className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1 cursor-pointer"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Cadastrar Nova Peça</span>
                    </button>
                </div>
            </div>
        </div>
    );
};
