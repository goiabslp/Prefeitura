import React, { useState, useMemo } from 'react';
import { 
    Vehicle, 
    Sector, 
    Person, 
    VehicleBrand as Brand 
} from '../../types';
import { 
    VehicleHealthInfo 
} from '../../types/fleetTypes';
import { 
    Car, 
    Search, 
    Filter, 
    Plus, 
    ChevronRight, 
    Eye, 
    Edit2, 
    Trash2, 
    Gauge, 
    Droplet, 
    Calendar, 
    Wrench, 
    Truck, 
    Bus, 
    Layers, 
    CheckCircle2, 
    AlertTriangle, 
    Clock, 
    X,
    UserCheck,
    SlidersHorizontal
} from 'lucide-react';

interface FleetVehiclesProps {
    vehicles: Vehicle[];
    sectors: Sector[];
    persons: Person[];
    brands?: Brand[];
    healthList: VehicleHealthInfo[];
    onOpenVehicleRecord: (vehicleId: string) => void;
    onOpenNewVehicle: () => void;
    onEditVehicle: (vehicle: Vehicle) => void;
    onDeleteVehicle: (vehicleId: string) => void;
    onOpenHealthModal: (health: VehicleHealthInfo, vehicle: Vehicle) => void;
}

const CATEGORIES = [
    { id: 'todos', label: 'Todos os Veículos', icon: Layers },
    { id: 'Carro', label: 'Carros', icon: Car },
    { id: 'Moto', label: 'Motos', icon: Car },
    { id: 'Van', label: 'Vans', icon: Truck },
    { id: 'Ônibus', label: 'Ônibus', icon: Bus },
    { id: 'Máquina Pesada', label: 'Máquinas Pesadas', icon: Truck },
    { id: 'Caminhão', label: 'Caminhões', icon: Truck },
    { id: 'Acessórios', label: 'Acessórios', icon: Layers },
];

export const FleetVehicles: React.FC<FleetVehiclesProps> = ({
    vehicles,
    sectors,
    persons,
    brands,
    healthList,
    onOpenVehicleRecord,
    onOpenNewVehicle,
    onEditVehicle,
    onDeleteVehicle,
    onOpenHealthModal
}) => {
    const [selectedCategory, setSelectedCategory] = useState<string>('todos');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [statusFilter, setStatusFilter] = useState<string>('todos');
    const [schedulingFilter, setSchedulingFilter] = useState<string>('todos');
    const [healthFilter, setHealthFilter] = useState<string>('todos');
    const [sectorFilter, setSectorFilter] = useState<string>('todos');
    const [isFilterOpenMobile, setIsFilterOpenMobile] = useState(false);

    // Map O(1) de Saúde por Veículo
    const healthMap = useMemo(() => {
        const map = new Map<string, VehicleHealthInfo>();
        healthList.forEach(h => map.set(h.vehicleId, h));
        return map;
    }, [healthList]);

    // Map O(1) de Setores e Responsáveis
    const sectorMap = useMemo(() => {
        const map = new Map<string, string>();
        sectors.forEach(s => map.set(s.id, s.name));
        return map;
    }, [sectors]);

    const personMap = useMemo(() => {
        const map = new Map<string, string>();
        persons.forEach(p => map.set(p.id, p.name));
        return map;
    }, [persons]);

    // Filtragem de Veículos
    const filteredVehicles = useMemo(() => {
        return vehicles.filter(v => {
            // Categoria
            if (selectedCategory !== 'todos') {
                const cat = v.vehicleCategory || v.type;
                if (cat !== selectedCategory) return false;
            }

            // Status Operacional
            if (statusFilter !== 'todos' && v.status !== statusFilter) {
                return false;
            }

            // Disponível para Agendamento
            if (schedulingFilter !== 'todos') {
                const isSchedulable = v.availableForScheduling === 'Sim' || v.availableForScheduling === undefined;
                if (schedulingFilter === 'Sim' && !isSchedulable) return false;
                if (schedulingFilter === 'Não' && isSchedulable) return false;
            }

            // Setor
            if (sectorFilter !== 'todos' && v.sectorId !== sectorFilter) {
                return false;
            }

            // Saúde
            if (healthFilter !== 'todos') {
                const h = healthMap.get(v.id);
                if (!h || h.generalStatus !== healthFilter) return false;
            }

            // Busca Textual
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const plate = (v.plate || '').toLowerCase();
                const model = (v.model || '').toLowerCase();
                const brand = (v.brand || '').toLowerCase();
                const renavam = (v.renavam || '').toLowerCase();
                const chassi = (v.chassis || '').toLowerCase();
                const sector = (sectorMap.get(v.sectorId) || '').toLowerCase();
                const resp = (personMap.get(v.responsiblePersonId || '') || '').toLowerCase();

                return plate.includes(q) || model.includes(q) || brand.includes(q) || 
                       renavam.includes(q) || chassi.includes(q) || sector.includes(q) || resp.includes(q);
            }

            return true;
        });
    }, [vehicles, selectedCategory, statusFilter, schedulingFilter, sectorFilter, healthFilter, searchQuery, healthMap, sectorMap, personMap]);

    return (
        <div className="space-y-4 md:space-y-6 pb-12 animate-in fade-in duration-300">
            {/* Header & Ações */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 md:p-5 rounded-3xl border border-slate-200/90 shadow-sm">
                <div>
                    <div className="flex items-center gap-2">
                        <h2 className="text-base md:text-xl font-black bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 bg-clip-text text-transparent uppercase tracking-tight">
                            Central de Veículos da Frota
                        </h2>
                        <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-extrabold text-xs">
                            {filteredVehicles.length} de {vehicles.length}
                        </span>
                    </div>
                    <p className="text-xs font-semibold text-slate-500 mt-0.5">
                        Catálogo patrimonial, alocação de setores e prontuários individuais
                    </p>
                </div>

                <button
                    type="button"
                    onClick={onOpenNewVehicle}
                    className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-amber-500/25 active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                >
                    <Plus className="w-4 h-4" />
                    <span>Cadastrar Novo Veículo</span>
                </button>
            </div>

            {/* Carrossel de Categorias */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
                {CATEGORIES.map(cat => {
                    const Icon = cat.icon;
                    const isSelected = selectedCategory === cat.id;
                    const count = cat.id === 'todos' 
                        ? vehicles.length 
                        : vehicles.filter(v => (v.vehicleCategory || v.type) === cat.id).length;

                    return (
                        <button
                            key={cat.id}
                            type="button"
                            onClick={() => setSelectedCategory(cat.id)}
                            className={`px-3.5 py-2 rounded-2xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer shrink-0 ${
                                isSelected
                                ? 'bg-slate-900 text-white shadow-md'
                                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200/80 shadow-2xs'
                            }`}
                        >
                            <Icon className="w-3.5 h-3.5" />
                            <span>{cat.label}</span>
                            <span className={`px-1.5 py-0.2 text-[10px] rounded-md ${
                                isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                            }`}>
                                {count}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Barra de Busca & Filtros Rápidos */}
            <div className="bg-white p-3 md:p-4 rounded-3xl border border-slate-200/90 shadow-sm space-y-3">
                <div className="flex flex-col sm:flex-row items-center gap-2.5">
                    <div className="relative flex-1 w-full">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Buscar por placa, modelo, marca, renavam, chassi, motorista ou setor..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-9 py-2.5 bg-slate-50 focus:bg-white border border-slate-200 focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 rounded-2xl text-xs font-bold text-slate-900 placeholder:text-slate-400 transition-all shadow-2xs"
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

                    <button
                        type="button"
                        onClick={() => setIsFilterOpenMobile(!isFilterOpenMobile)}
                        className="sm:hidden w-full py-2 bg-slate-100 rounded-xl text-xs font-black uppercase text-slate-700 flex items-center justify-center gap-1.5"
                    >
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                        <span>Filtros Avançados</span>
                    </button>
                </div>

                {/* Filtros em Linha (Desktop / Expansível no Mobile) */}
                <div className={`grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100 ${isFilterOpenMobile ? 'block' : 'hidden sm:grid'}`}>
                    {/* Status Operacional */}
                    <div>
                        <label className="text-[9px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                            Situação
                        </label>
                        <select
                            value={statusFilter}
                            onChange={e => setStatusFilter(e.target.value)}
                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                        >
                            <option value="todos">Todas as Situações</option>
                            <option value="operacional">Operacional</option>
                            <option value="em_manutencao">Em Manutenção</option>
                            <option value="baixado">Baixado / Desativado</option>
                            <option value="fora_de_servico">Fora de Serviço</option>
                        </select>
                    </div>

                    {/* Saúde Mecânica */}
                    <div>
                        <label className="text-[9px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                            Saúde da Frota
                        </label>
                        <select
                            value={healthFilter}
                            onChange={e => setHealthFilter(e.target.value)}
                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                        >
                            <option value="todos">Todos os Status de Saúde</option>
                            <option value="em_dia">🟢 Em Dia</option>
                            <option value="proximo">🟡 Próximo do Vencimento</option>
                            <option value="vencido">🔴 Manutenção Vencida</option>
                        </select>
                    </div>

                    {/* Disponibilidade para Agendamento */}
                    <div>
                        <label className="text-[9px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                            Para Agendamento
                        </label>
                        <select
                            value={schedulingFilter}
                            onChange={e => setSchedulingFilter(e.target.value)}
                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                        >
                            <option value="todos">Todos</option>
                            <option value="Sim">Disponíveis (Sim)</option>
                            <option value="Não">Indisponíveis (Não)</option>
                        </select>
                    </div>

                    {/* Setor */}
                    <div>
                        <label className="text-[9px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                            Setor
                        </label>
                        <select
                            value={sectorFilter}
                            onChange={e => setSectorFilter(e.target.value)}
                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                        >
                            <option value="todos">Todos os Setores</option>
                            {sectors.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Grid de Cards de Veículos */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
                {filteredVehicles.map(v => {
                    const health = healthMap.get(v.id);
                    const sectorName = sectorMap.get(v.sectorId) || 'Setor não informado';
                    const respName = personMap.get(v.responsiblePersonId || '') || 'Não definido';

                    return (
                        <div
                            key={v.id}
                            className="bg-white rounded-3xl border border-slate-200/90 shadow-sm hover:shadow-lg transition-all flex flex-col justify-between overflow-hidden group hover:border-slate-300"
                        >
                            <div className="p-4 space-y-3">
                                {/* Topo do Card: Placa + Status */}
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <span className="px-2.5 py-1 bg-slate-900 text-white font-mono font-black text-xs rounded-lg tracking-wider shadow-xs">
                                            {v.plate}
                                        </span>
                                        <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight mt-1.5 line-clamp-1">
                                            {v.brand} {v.model}
                                        </h3>
                                        <span className="text-[10px] font-semibold text-slate-500">
                                            {v.vehicleCategory || v.type || 'Carro'} {v.year ? `• ${v.year}` : ''}
                                        </span>
                                    </div>

                                    {/* Badge de Saúde */}
                                    {health && (
                                        <button
                                            type="button"
                                            onClick={() => onOpenHealthModal(health, v)}
                                            className={`px-2 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider shrink-0 transition-transform active:scale-95 cursor-pointer ${
                                                health.generalStatus === 'vencido' ? 'bg-rose-100 text-rose-900 border border-rose-300' :
                                                health.generalStatus === 'proximo' ? 'bg-amber-100 text-amber-900 border border-amber-300' :
                                                'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                            }`}
                                            title="Clique para ver Raio-X de Saúde"
                                        >
                                            {health.generalStatus === 'vencido' ? '🔴 Vencido' :
                                             health.generalStatus === 'proximo' ? '🟡 Próximo' :
                                             '🟢 Em Dia'}
                                        </button>
                                    )}
                                </div>

                                {/* Odômetro & Detalhes */}
                                <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200/60 space-y-1.5 text-xs">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-black uppercase text-slate-400">Odômetro Atual</span>
                                        <span className="font-mono font-black text-indigo-900">
                                            {(Number(v.currentKm) || 0).toLocaleString('pt-BR')} km
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between text-[10px]">
                                        <span className="font-bold text-slate-400">Setor:</span>
                                        <span className="font-extrabold text-slate-800 truncate max-w-[140px]">{sectorName}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-[10px]">
                                        <span className="font-bold text-slate-400">Responsável:</span>
                                        <span className="font-bold text-slate-700 truncate max-w-[140px]">{respName}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Rodapé do Card com Ações */}
                            <div className="p-3 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between gap-2">
                                <button
                                    type="button"
                                    onClick={() => onOpenVehicleRecord(v.id)}
                                    className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                                >
                                    <Eye className="w-3.5 h-3.5" />
                                    <span>Prontuário</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => onEditVehicle(v)}
                                    className="p-2 bg-white hover:bg-slate-100 text-slate-600 rounded-xl border border-slate-200 transition-colors cursor-pointer"
                                    title="Editar Dados do Veículo"
                                >
                                    <Edit2 className="w-3.5 h-3.5" />
                                </button>

                                <button
                                    type="button"
                                    onClick={() => onDeleteVehicle(v.id)}
                                    className="p-2 bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-xl border border-slate-200 transition-colors cursor-pointer"
                                    title="Excluir Veículo"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    );
                })}

                {filteredVehicles.length === 0 && (
                    <div className="col-span-full py-12 text-center text-slate-400 bg-white rounded-3xl border border-slate-200 p-8">
                        <Car className="w-12 h-12 mx-auto mb-2 opacity-30 text-slate-500" />
                        <h4 className="text-sm font-black text-slate-800 uppercase">Nenhum veículo encontrado</h4>
                        <p className="text-xs text-slate-500 mt-1">Tente ajustar seus termos de busca ou filtros acima.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
