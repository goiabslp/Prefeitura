import React, { useState, useMemo } from 'react';
import { 
    Vehicle 
} from '../../types';
import { 
    FleetPart, 
    FleetSupplier 
} from '../../types/fleetTypes';
import { 
    Package, 
    Plus, 
    Search, 
    Filter, 
    Edit2, 
    Trash2, 
    AlertTriangle, 
    CheckCircle2, 
    Car, 
    Layers, 
    DollarSign, 
    Building2, 
    X,
    MapPin,
    Tag
} from 'lucide-react';

interface FleetPartsProps {
    parts: FleetPart[];
    vehicles: Vehicle[];
    suppliers: FleetSupplier[];
    onOpenNewPart: () => void;
    onEditPart: (part: FleetPart) => void;
    onDeletePart: (partId: string) => void;
}

const PART_CATEGORIES = [
    'Todas as Categorias',
    'Motor',
    'Freios',
    'Suspensão',
    'Filtros',
    'Óleos/Fluidos',
    'Elétrica',
    'Pneus',
    'Transmissão',
    'Arrefecimento',
    'Funilaria/Acessórios',
    'Outros'
];

export const FleetParts: React.FC<FleetPartsProps> = ({
    parts,
    vehicles,
    suppliers,
    onOpenNewPart,
    onEditPart,
    onDeletePart
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('Todas as Categorias');
    const [stockFilter, setStockFilter] = useState<'todos' | 'baixo' | 'zerado' | 'normal'>('todos');

    // Map O(1) de Veículos
    const vehicleMap = useMemo(() => {
        const map = new Map<string, Vehicle>();
        vehicles.forEach(v => map.set(v.id, v));
        return map;
    }, [vehicles]);

    // Filtragem de Peças
    const filteredParts = useMemo(() => {
        return parts.filter(p => {
            if (categoryFilter !== 'Todas as Categorias' && p.category !== categoryFilter) {
                return false;
            }

            if (stockFilter === 'baixo' && (p.current_stock <= 0 || p.current_stock > p.min_stock)) return false;
            if (stockFilter === 'zerado' && p.current_stock > 0) return false;
            if (stockFilter === 'normal' && p.current_stock <= p.min_stock) return false;

            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const name = (p.name || '').toLowerCase();
                const code = (p.code || '').toLowerCase();
                const ref = (p.reference || '').toLowerCase();
                const brand = (p.brand || '').toLowerCase();
                const cat = (p.category || '').toLowerCase();

                // Busca por veículo compatível
                const compatibleMatch = (p.compatible_vehicles || []).some(vId => {
                    const v = vehicleMap.get(vId);
                    return v && (v.plate.toLowerCase().includes(q) || v.model.toLowerCase().includes(q));
                });

                return name.includes(q) || code.includes(q) || ref.includes(q) || brand.includes(q) || cat.includes(q) || compatibleMatch;
            }

            return true;
        });
    }, [parts, categoryFilter, stockFilter, searchQuery, vehicleMap]);

    return (
        <div className="space-y-4 md:space-y-6 pb-12 animate-in fade-in duration-300">
            {/* Header & Ações */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 md:p-5 rounded-3xl border border-slate-200/90 shadow-sm">
                <div>
                    <div className="flex items-center gap-2">
                        <h2 className="text-base md:text-xl font-black bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 bg-clip-text text-transparent uppercase tracking-tight">
                            Catálogo de Peças & Componentes
                        </h2>
                        <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-extrabold text-xs">
                            {filteredParts.length} itens
                        </span>
                    </div>
                    <p className="text-xs font-semibold text-slate-500 mt-0.5">
                        Cadastro de peças, referências técnicas, compatibilidade veicular e custos
                    </p>
                </div>

                <button
                    type="button"
                    onClick={onOpenNewPart}
                    className="px-4 py-2.5 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-sky-500/25 active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                >
                    <Plus className="w-4 h-4" />
                    <span>Cadastrar Nova Peça</span>
                </button>
            </div>

            {/* Filtros e Busca */}
            <div className="bg-white p-3 md:p-4 rounded-3xl border border-slate-200/90 shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder="Buscar por nome, código, referência, marca ou veículo..."
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

                {/* Categoria */}
                <div>
                    <select
                        value={categoryFilter}
                        onChange={e => setCategoryFilter(e.target.value)}
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800"
                    >
                        {PART_CATEGORIES.map(c => (
                            <option key={c} value={c}>{c}</option>
                        ))}
                    </select>
                </div>

                {/* Saldo de Estoque */}
                <div>
                    <select
                        value={stockFilter}
                        onChange={e => setStockFilter(e.target.value as any)}
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800"
                    >
                        <option value="todos">Todos os Níveis de Estoque</option>
                        <option value="normal">Estoque Normal</option>
                        <option value="baixo">⚠️ Estoque Baixo (Alerta)</option>
                        <option value="zerado">🚫 Sem Estoque (Zerado)</option>
                    </select>
                </div>
            </div>

            {/* Grid de Cards de Peças */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
                {filteredParts.map(p => {
                    const isLowStock = p.current_stock > 0 && p.current_stock <= p.min_stock;
                    const isOutOfStock = p.current_stock <= 0;

                    return (
                        <div
                            key={p.id}
                            className={`p-4 rounded-3xl border transition-all flex flex-col justify-between shadow-xs hover:shadow-md bg-white ${
                                isOutOfStock ? 'border-rose-200' : isLowStock ? 'border-amber-200' : 'border-slate-200/90'
                            }`}
                        >
                            <div className="space-y-2.5">
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-black uppercase rounded-md">
                                            {p.category}
                                        </span>
                                        <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight mt-1 line-clamp-1">
                                            {p.name}
                                        </h3>
                                        <span className="text-[10px] font-mono font-bold text-slate-500">
                                            Cód: {p.code || 'S/ CÓD'} {p.reference ? `• Ref: ${p.reference}` : ''}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-1">
                                        <button
                                            type="button"
                                            onClick={() => onEditPart(p)}
                                            className="p-1.5 text-slate-400 hover:text-slate-800 rounded-lg hover:bg-slate-100"
                                            title="Editar Peça"
                                        >
                                            <Edit2 className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => onDeletePart(p.id)}
                                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                                            title="Excluir Peça"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>

                                {/* Estoque & Valores */}
                                <div className="grid grid-cols-2 gap-2 p-2.5 rounded-2xl bg-slate-50 border border-slate-200/60 text-xs">
                                    <div>
                                        <span className="text-[9px] font-black uppercase text-slate-400 block">Estoque Atual</span>
                                        <span className={`font-black text-sm ${
                                            isOutOfStock ? 'text-rose-600' : isLowStock ? 'text-amber-600' : 'text-emerald-700'
                                        }`}>
                                            {p.current_stock} {p.unit}
                                        </span>
                                    </div>

                                    <div>
                                        <span className="text-[9px] font-black uppercase text-slate-400 block">Custo Médio</span>
                                        <span className="font-mono font-black text-slate-900 text-sm">
                                            R$ {Number(p.average_cost || p.last_purchase_price || 0).toFixed(2)}
                                        </span>
                                    </div>
                                </div>

                                {/* Localização & Veículos Compatíveis */}
                                <div className="space-y-1 text-[10px] text-slate-500 font-semibold">
                                    {p.location && (
                                        <div className="flex items-center gap-1">
                                            <MapPin className="w-3 h-3 text-slate-400" />
                                            <span>Localização: {p.location}</span>
                                        </div>
                                    )}
                                    {p.compatible_vehicles && p.compatible_vehicles.length > 0 && (
                                        <div className="flex items-center gap-1 truncate">
                                            <Car className="w-3 h-3 text-slate-400 shrink-0" />
                                            <span className="truncate">Compatível com {p.compatible_vehicles.length} veículos</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}

                {filteredParts.length === 0 && (
                    <div className="col-span-full py-12 text-center text-slate-400 bg-white rounded-3xl border border-slate-200 p-8">
                        <Package className="w-12 h-12 mx-auto mb-2 opacity-30 text-slate-500" />
                        <h4 className="text-sm font-black text-slate-800 uppercase">Nenhuma peça encontrada</h4>
                        <p className="text-xs text-slate-500 mt-1">Clique no botão acima para cadastrar um novo item no catálogo.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
