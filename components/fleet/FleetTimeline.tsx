import React, { useState, useMemo } from 'react';
import { 
    Vehicle 
} from '../../types';
import { 
    FleetHistoryEvent 
} from '../../types/fleetTypes';
import { 
    Clock, 
    Search, 
    Filter, 
    Car, 
    Fuel, 
    Wrench, 
    Droplet, 
    Layers, 
    ShoppingBag, 
    Package, 
    FileText, 
    Calendar, 
    User, 
    X,
    Activity
} from 'lucide-react';

interface FleetTimelineProps {
    history: FleetHistoryEvent[];
    vehicles: Vehicle[];
    onOpenVehicleRecord: (vehicleId: string) => void;
}

const EVENT_TYPE_LABELS: Record<string, { label: string; icon: any; color: string }> = {
    abastecimento: { label: 'Abastecimento', icon: Fuel, color: 'text-sky-600 bg-sky-50 border-sky-200' },
    troca_oleo: { label: 'Troca de Óleo', icon: Droplet, color: 'text-amber-600 bg-amber-50 border-amber-200' },
    troca_correia: { label: 'Troca de Correia', icon: Layers, color: 'text-orange-600 bg-orange-50 border-orange-200' },
    manutencao: { label: 'Manutenção', icon: Wrench, color: 'text-rose-600 bg-rose-50 border-rose-200' },
    peca_instalada: { label: 'Peça Aplicada', icon: Package, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
    compra: { label: 'Compra de Peças', icon: ShoppingBag, color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
    movimentacao_estoque: { label: 'Estoque', icon: Package, color: 'text-teal-600 bg-teal-50 border-teal-200' },
    documento: { label: 'Documento Anexado', icon: FileText, color: 'text-purple-600 bg-purple-50 border-purple-200' },
    agendamento: { label: 'Viagem / Agendamento', icon: Calendar, color: 'text-blue-600 bg-blue-50 border-blue-200' },
    alteracao_cadastral: { label: 'Cadastro', icon: User, color: 'text-slate-600 bg-slate-50 border-slate-200' },
    alteracao_disponibilidade: { label: 'Disponibilidade', icon: Activity, color: 'text-amber-600 bg-amber-50 border-amber-200' }
};

export const FleetTimeline: React.FC<FleetTimelineProps> = ({
    history,
    vehicles,
    onOpenVehicleRecord
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState('todos');
    const [vehicleFilter, setVehicleFilter] = useState('todos');

    // Map O(1) de Veículos
    const vehicleMap = useMemo(() => {
        const map = new Map<string, Vehicle>();
        vehicles.forEach(v => map.set(v.id, v));
        return map;
    }, [vehicles]);

    const filteredHistory = useMemo(() => {
        return history.filter(h => {
            if (typeFilter !== 'todos' && h.event_type !== typeFilter) return false;
            if (vehicleFilter !== 'todos' && h.vehicle_id !== vehicleFilter) return false;

            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const title = (h.title || '').toLowerCase();
                const desc = (h.description || '').toLowerCase();
                const user = (h.user_name || '').toLowerCase();
                const v = h.vehicle_id ? vehicleMap.get(h.vehicle_id) : null;
                const plate = (v?.plate || '').toLowerCase();

                return title.includes(q) || desc.includes(q) || user.includes(q) || plate.includes(q);
            }

            return true;
        });
    }, [history, typeFilter, vehicleFilter, searchQuery, vehicleMap]);

    return (
        <div className="space-y-4 md:space-y-6 pb-12 animate-in fade-in duration-300">
            {/* Header */}
            <div className="bg-white p-4 md:p-5 rounded-3xl border border-slate-200/90 shadow-sm">
                <div className="flex items-center gap-2">
                    <h2 className="text-base md:text-xl font-black bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 bg-clip-text text-transparent uppercase tracking-tight">
                        Linha do Tempo & Auditoria Geral da Frota
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-extrabold text-xs">
                        {filteredHistory.length} eventos
                    </span>
                </div>
                <p className="text-xs font-semibold text-slate-500 mt-0.5">
                    Histórico cronológico e rastreável de todas as movimentações, manutenções, abastecimentos e cadastros
                </p>
            </div>

            {/* Filtros */}
            <div className="bg-white p-3 md:p-4 rounded-3xl border border-slate-200/90 shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder="Buscar por descrição, título, placa ou usuário..."
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

                {/* Tipo de Evento */}
                <div>
                    <select
                        value={typeFilter}
                        onChange={e => setTypeFilter(e.target.value)}
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800"
                    >
                        <option value="todos">Todos os Tipos de Eventos</option>
                        {Object.entries(EVENT_TYPE_LABELS).map(([k, v]) => (
                            <option key={k} value={k}>{v.label}</option>
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

            {/* Linha do Tempo Feed */}
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-4 md:p-6 space-y-4">
                <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                    {filteredHistory.map(item => {
                        const info = EVENT_TYPE_LABELS[item.event_type] || {
                            label: item.event_type,
                            icon: Activity,
                            color: 'text-slate-600 bg-slate-50 border-slate-200'
                        };
                        const Icon = info.icon;
                        const v = item.vehicle_id ? vehicleMap.get(item.vehicle_id) : null;

                        return (
                            <div key={item.id} className="relative group">
                                {/* Ponto na linha */}
                                <div className={`absolute -left-6 top-1.5 w-5 h-5 rounded-full border-2 bg-white flex items-center justify-center ${info.color.split(' ')[0]}`}>
                                    <span className="w-2 h-2 rounded-full bg-current"></span>
                                </div>

                                <div className="p-3.5 rounded-2xl bg-slate-50/80 hover:bg-slate-100/80 border border-slate-200/70 transition-all space-y-1">
                                    <div className="flex items-center justify-between gap-2 flex-wrap">
                                        <div className="flex items-center gap-2">
                                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase border ${info.color}`}>
                                                {info.label}
                                            </span>
                                            {v && (
                                                <button
                                                    type="button"
                                                    onClick={() => onOpenVehicleRecord(v.id)}
                                                    className="px-2 py-0.5 bg-slate-900 text-white font-mono font-black text-[10px] rounded-md hover:bg-slate-800 cursor-pointer"
                                                >
                                                    {v.plate}
                                                </button>
                                            )}
                                        </div>

                                        <span className="text-[10px] font-bold text-slate-400">
                                            {new Date(item.created_at).toLocaleString('pt-BR')}
                                        </span>
                                    </div>

                                    <h4 className="text-xs font-black text-slate-900 uppercase">
                                        {item.title}
                                    </h4>

                                    {item.description && (
                                        <p className="text-xs font-semibold text-slate-600">
                                            {item.description}
                                        </p>
                                    )}

                                    {item.user_name && (
                                        <span className="text-[10px] font-bold text-slate-400 block pt-1">
                                            Registrado por: {item.user_name}
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}

                    {filteredHistory.length === 0 && (
                        <div className="py-12 text-center text-slate-400 text-xs font-bold">
                            Nenhum evento histórico encontrado com os filtros selecionados
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
