import React, { useState, useMemo } from 'react';
import { 
    Vehicle 
} from '../../types';
import { 
    FleetMaintenance, 
    FleetPart, 
    FleetSupplier, 
    MaintenanceType 
} from '../../types/fleetTypes';
import { 
    Wrench, 
    Plus, 
    Search, 
    Filter, 
    Calendar, 
    DollarSign, 
    Clock, 
    CheckCircle2, 
    AlertTriangle, 
    ChevronDown, 
    ChevronUp, 
    FileText, 
    Eye, 
    Layers, 
    X,
    Car,
    User,
    Building2,
    Package
} from 'lucide-react';

interface FleetMaintenancesProps {
    maintenances: FleetMaintenance[];
    vehicles: Vehicle[];
    parts: FleetPart[];
    suppliers: FleetSupplier[];
    onOpenNewMaintenance: (vehicleId?: string) => void;
    onOpenVehicleRecord: (vehicleId: string) => void;
}

const MAINTENANCE_TYPES: MaintenanceType[] = [
    'Preventiva',
    'Corretiva',
    'Óleo',
    'Correia dentada',
    'Pneus',
    'Freios',
    'Filtros',
    'Suspensão',
    'Revisão',
    'Bateria',
    'Outros'
];

export const FleetMaintenances: React.FC<FleetMaintenancesProps> = ({
    maintenances,
    vehicles,
    parts,
    suppliers,
    onOpenNewMaintenance,
    onOpenVehicleRecord
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState<string>('todos');
    const [vehicleFilter, setVehicleFilter] = useState<string>('todos');
    const [expandedId, setExpandedId] = useState<string | null>(null);

    // Map O(1) de Veículos
    const vehicleMap = useMemo(() => {
        const map = new Map<string, Vehicle>();
        vehicles.forEach(v => map.set(v.id, v));
        return map;
    }, [vehicles]);

    const filteredMaintenances = useMemo(() => {
        return maintenances.filter(m => {
            if (typeFilter !== 'todos' && m.type !== typeFilter) return false;
            if (vehicleFilter !== 'todos' && m.vehicle_id !== vehicleFilter) return false;

            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const v = vehicleMap.get(m.vehicle_id);
                const desc = (m.description || '').toLowerCase();
                const plate = (v?.plate || '').toLowerCase();
                const model = (v?.model || '').toLowerCase();
                const workshop = (m.workshop_name || m.supplier_name || '').toLowerCase();
                const resp = (m.responsible_name || '').toLowerCase();

                return desc.includes(q) || plate.includes(q) || model.includes(q) || workshop.includes(q) || resp.includes(q);
            }

            return true;
        });
    }, [maintenances, typeFilter, vehicleFilter, searchQuery, vehicleMap]);

    const totalCost = useMemo(() => {
        return filteredMaintenances.reduce((acc, m) => acc + (Number(m.total_cost) || 0), 0);
    }, [filteredMaintenances]);

    return (
        <div className="space-y-4 md:space-y-6 pb-12 animate-in fade-in duration-300">
            {/* Header & Ações */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 md:p-5 rounded-3xl border border-slate-200/90 shadow-sm">
                <div>
                    <div className="flex items-center gap-2">
                        <h2 className="text-base md:text-xl font-black bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 bg-clip-text text-transparent uppercase tracking-tight">
                            Central de Manutenções da Frota
                        </h2>
                        <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-extrabold text-xs">
                            {filteredMaintenances.length} serviços
                        </span>
                    </div>
                    <p className="text-xs font-semibold text-slate-500 mt-0.5">
                        Ordens de serviço preventivas, corretivas e aplicação de peças do estoque
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="text-right hidden md:block">
                        <span className="text-[10px] font-black uppercase text-slate-400 block">Total Filtrado</span>
                        <span className="text-base font-black text-slate-900 font-mono">
                            R$ {totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                    </div>

                    <button
                        type="button"
                        onClick={() => onOpenNewMaintenance()}
                        className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-amber-500/25 active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Nova Ordem de Manutenção</span>
                    </button>
                </div>
            </div>

            {/* Barra de Filtros */}
            <div className="bg-white p-3 md:p-4 rounded-3xl border border-slate-200/90 shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder="Buscar por descrição, placa, oficina ou responsável..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-9 py-2 bg-slate-50 focus:bg-white border border-slate-200 focus:border-sky-500 rounded-2xl text-xs font-bold text-slate-900 placeholder:text-slate-400 shadow-2xs"
                    />
                    {searchQuery && (
                        <button
                            type="button"
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-600 p-0.5 rounded-full"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>

                {/* Tipo de Manutenção */}
                <div>
                    <select
                        value={typeFilter}
                        onChange={e => setTypeFilter(e.target.value)}
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800"
                    >
                        <option value="todos">Todos os Tipos de Manutenção</option>
                        {MAINTENANCE_TYPES.map(t => (
                            <option key={t} value={t}>{t}</option>
                        ))}
                    </select>
                </div>

                {/* Veículo */}
                <div>
                    <select
                        value={vehicleFilter}
                        onChange={e => setVehicleFilter(e.target.value)}
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800"
                    >
                        <option value="todos">Todos os Veículos</option>
                        {vehicles.map(v => (
                            <option key={v.id} value={v.id}>{v.plate} - {v.brand} {v.model}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Listagem de Manutenções */}
            <div className="space-y-3">
                {filteredMaintenances.map(m => {
                    const v = vehicleMap.get(m.vehicle_id);
                    const isExpanded = expandedId === m.id;

                    return (
                        <div 
                            key={m.id}
                            className="bg-white rounded-3xl border border-slate-200/90 shadow-sm hover:shadow-md transition-all overflow-hidden"
                        >
                            <div 
                                onClick={() => setExpandedId(isExpanded ? null : m.id)}
                                className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer hover:bg-slate-50/50"
                            >
                                <div className="flex items-start md:items-center gap-3">
                                    <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-600 shrink-0">
                                        <Wrench className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            {v && (
                                                <span 
                                                    onClick={(e) => { e.stopPropagation(); onOpenVehicleRecord(v.id); }}
                                                    className="px-2 py-0.5 bg-slate-900 text-white font-mono font-black text-xs rounded-md hover:bg-slate-800"
                                                >
                                                    {v.plate}
                                                </span>
                                            )}
                                            <span className="px-2 py-0.5 bg-amber-100 text-amber-900 text-[10px] font-black uppercase rounded-md border border-amber-300">
                                                {m.type}
                                            </span>
                                            <span className="text-xs font-bold text-slate-500">
                                                {new Date(m.maintenance_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                                            </span>
                                            <span className="text-xs font-mono font-black text-slate-800">
                                                {m.current_km.toLocaleString('pt-BR')} km
                                            </span>
                                        </div>

                                        <h4 className="text-sm font-black text-slate-900 mt-1 uppercase">
                                            {m.description}
                                        </h4>
                                        <span className="text-[11px] font-semibold text-slate-500">
                                            Oficina / Prestador: {m.workshop_name || m.supplier_name || 'Oficina Interna'}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between md:justify-end gap-4 border-t md:border-t-0 pt-2 md:pt-0">
                                    <div className="text-right">
                                        <span className="text-sm md:text-base font-black text-slate-900 block font-mono">
                                            R$ {m.total_cost.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                        <span className="text-[10px] font-bold text-slate-400">
                                            {m.parts_used?.length || 0} peças aplicadas
                                        </span>
                                    </div>

                                    <div className="p-1 text-slate-400">
                                        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                    </div>
                                </div>
                            </div>

                            {/* Detalhes Expansíveis da Manutenção */}
                            {isExpanded && (
                                <div className="p-4 md:p-5 bg-slate-50/80 border-t border-slate-100 space-y-3 animate-in fade-in duration-200 text-xs">
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                        <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                                            <span className="text-[9px] font-black uppercase text-slate-400 block">Mão de Obra</span>
                                            <span className="font-black text-slate-900">R$ {m.labor_cost.toFixed(2)}</span>
                                        </div>
                                        <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                                            <span className="text-[9px] font-black uppercase text-slate-400 block">Total Peças</span>
                                            <span className="font-black text-slate-900">R$ {m.parts_cost.toFixed(2)}</span>
                                        </div>
                                        <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                                            <span className="text-[9px] font-black uppercase text-slate-400 block">Próximo Vencimento KM</span>
                                            <span className="font-black text-slate-900 font-mono">
                                                {m.next_due_km ? `${m.next_due_km.toLocaleString('pt-BR')} km` : 'Não definido'}
                                            </span>
                                        </div>
                                        <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                                            <span className="text-[9px] font-black uppercase text-slate-400 block">Próxima Data</span>
                                            <span className="font-black text-slate-900">
                                                {m.next_due_date ? new Date(m.next_due_date + 'T12:00:00').toLocaleDateString('pt-BR') : 'Não definido'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Peças Utilizadas */}
                                    {m.parts_used && m.parts_used.length > 0 && (
                                        <div className="bg-white p-3 rounded-2xl border border-slate-200 space-y-2">
                                            <span className="text-[10px] font-black uppercase text-slate-500 block">
                                                Peças Utilizadas nesta Manutenção (com baixa no estoque):
                                            </span>
                                            <div className="divide-y divide-slate-100">
                                                {m.parts_used.map(pu => (
                                                    <div key={pu.id} className="py-1.5 flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <Package className="w-3.5 h-3.5 text-emerald-600" />
                                                            <span className="font-bold text-slate-900">{pu.part_name}</span>
                                                            <span className="px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded text-[9px] font-black uppercase">
                                                                {pu.origin}
                                                            </span>
                                                        </div>
                                                        <div className="text-right font-mono">
                                                            <span className="font-bold text-slate-600 mr-2">{pu.quantity}x R$ {pu.unit_price.toFixed(2)}</span>
                                                            <span className="font-black text-slate-900">R$ {pu.total_price.toFixed(2)}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {m.notes && (
                                        <div className="p-2.5 bg-amber-50/60 rounded-xl border border-amber-200 text-slate-700">
                                            <strong className="font-bold uppercase text-[9px] block text-amber-900">Observações:</strong>
                                            {m.notes}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}

                {filteredMaintenances.length === 0 && (
                    <div className="py-12 text-center text-slate-400 bg-white rounded-3xl border border-slate-200 p-8">
                        <Wrench className="w-12 h-12 mx-auto mb-2 opacity-30 text-slate-500" />
                        <h4 className="text-sm font-black text-slate-800 uppercase">Nenhuma ordem de manutenção encontrada</h4>
                        <p className="text-xs text-slate-500 mt-1">Clique no botão acima para registrar uma nova manutenção.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
