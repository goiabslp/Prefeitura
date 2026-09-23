import React, { useState, useMemo } from 'react';
import { 
    Vehicle 
} from '../../types';
import { 
    FleetPart, 
    FleetStockMovement 
} from '../../types/fleetTypes';
import { 
    Package, 
    ArrowDownLeft, 
    ArrowUpRight, 
    RotateCcw, 
    Plus, 
    Search, 
    Filter, 
    DollarSign, 
    AlertTriangle, 
    CheckCircle2, 
    Calendar, 
    Clock, 
    User, 
    Wrench, 
    ShoppingBag, 
    X,
    SlidersHorizontal
} from 'lucide-react';

interface FleetStockProps {
    parts: FleetPart[];
    movements: FleetStockMovement[];
    vehicles: Vehicle[];
    onOpenNewMovement: () => void;
    onOpenNewPart: () => void;
}

export const FleetStock: React.FC<FleetStockProps> = ({
    parts,
    movements,
    vehicles,
    onOpenNewMovement,
    onOpenNewPart
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState<'todos' | 'entrada' | 'saida' | 'ajuste'>('todos');
    const [partFilter, setPartFilter] = useState('todos');

    // Métricas de Estoque
    const metrics = useMemo(() => {
        const totalParts = parts.length;
        const totalUnits = parts.reduce((acc, p) => acc + (Number(p.current_stock) || 0), 0);
        const lowStock = parts.filter(p => p.current_stock > 0 && p.current_stock <= p.min_stock).length;
        const outOfStock = parts.filter(p => p.current_stock <= 0).length;
        const totalEstimatedValue = parts.reduce((acc, p) => acc + (Number(p.current_stock) * Number(p.average_cost || p.last_purchase_price || 0)), 0);

        return {
            totalParts,
            totalUnits,
            lowStock,
            outOfStock,
            totalEstimatedValue
        };
    }, [parts]);

    // Movimentações Filtradas
    const filteredMovements = useMemo(() => {
        return movements.filter(m => {
            if (typeFilter !== 'todos' && m.type !== typeFilter) return false;
            if (partFilter !== 'todos' && m.part_id !== partFilter) return false;

            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const partName = (m.part?.name || '').toLowerCase();
                const reason = (m.reason || '').toLowerCase();
                const user = (m.user_name || '').toLowerCase();

                return partName.includes(q) || reason.includes(q) || user.includes(q);
            }

            return true;
        });
    }, [movements, typeFilter, partFilter, searchQuery]);

    return (
        <div className="space-y-4 md:space-y-6 pb-12 animate-in fade-in duration-300">
            {/* Header & Ações */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 md:p-5 rounded-3xl border border-slate-200/90 shadow-sm">
                <div>
                    <div className="flex items-center gap-2">
                        <h2 className="text-base md:text-xl font-black bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 bg-clip-text text-transparent uppercase tracking-tight">
                            Central de Estoque & Movimentações
                        </h2>
                        <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-extrabold text-xs">
                            {parts.length} itens cadastrados
                        </span>
                    </div>
                    <p className="text-xs font-semibold text-slate-500 mt-0.5">
                        Rastreabilidade de entradas, saídas em ordens mecânicas e inventário
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={onOpenNewMovement}
                        className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Nova Movimentação / Ajuste</span>
                    </button>
                </div>
            </div>

            {/* Cards de KPIs do Estoque */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                        Peças Cadastradas
                    </span>
                    <span className="text-xl md:text-2xl font-black text-slate-900">
                        {metrics.totalParts}
                    </span>
                </div>

                <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                        Total em Estoque
                    </span>
                    <span className="text-xl md:text-2xl font-black text-slate-900">
                        {metrics.totalUnits} <span className="text-xs text-slate-400">unidades</span>
                    </span>
                </div>

                <div className="bg-white p-3.5 rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50/30 to-white shadow-xs">
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 block mb-1">
                        Estoque Baixo
                    </span>
                    <span className="text-xl md:text-2xl font-black text-amber-900">
                        {metrics.lowStock}
                    </span>
                </div>

                <div className="bg-white p-3.5 rounded-2xl border border-rose-200/80 bg-gradient-to-br from-rose-50/30 to-white shadow-xs">
                    <span className="text-[10px] font-black uppercase tracking-wider text-rose-800 block mb-1">
                        Sem Estoque
                    </span>
                    <span className="text-xl md:text-2xl font-black text-rose-900">
                        {metrics.outOfStock}
                    </span>
                </div>

                <div className="bg-white p-3.5 rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/30 to-white shadow-xs col-span-2 sm:col-span-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 block mb-1">
                        Valor Estimado
                    </span>
                    <span className="text-lg md:text-xl font-black text-emerald-950 font-mono">
                        R$ {metrics.totalEstimatedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                </div>
            </div>

            {/* Filtros de Histórico de Movimentações */}
            <div className="bg-white p-3 md:p-4 rounded-3xl border border-slate-200/90 shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder="Buscar no histórico por peça, motivo ou responsável..."
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

                {/* Tipo de Movimentação */}
                <div>
                    <select
                        value={typeFilter}
                        onChange={e => setTypeFilter(e.target.value as any)}
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800"
                    >
                        <option value="todos">Todos os Tipos de Movimentação</option>
                        <option value="entrada">Entradas (Compras / Devoluções)</option>
                        <option value="saida">Saídas (Manutenções / Aplicações)</option>
                        <option value="ajuste">Ajustes de Inventário</option>
                    </select>
                </div>

                {/* Filtro por Peça */}
                <div>
                    <select
                        value={partFilter}
                        onChange={e => setPartFilter(e.target.value)}
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800"
                    >
                        <option value="todos">Todas as Peças</option>
                        {parts.map(p => (
                            <option key={p.id} value={p.id}>{p.name} ({p.current_stock} {p.unit})</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Tabela de Histórico de Movimentações */}
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="text-xs md:text-sm font-black text-slate-900 uppercase tracking-tight">
                        Histórico de Movimentações ({filteredMovements.length})
                    </h3>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 text-slate-400 uppercase font-black text-[10px]">
                            <tr>
                                <th className="p-3">Data / Hora</th>
                                <th className="p-3">Tipo</th>
                                <th className="p-3">Peça</th>
                                <th className="p-3">Quantidade</th>
                                <th className="p-3">Saldo Anterior</th>
                                <th className="p-3">Novo Saldo</th>
                                <th className="p-3">Motivo / Vínculo</th>
                                <th className="p-3">Responsável</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                            {filteredMovements.map(m => (
                                <tr key={m.id} className="hover:bg-slate-50/80">
                                    <td className="p-3 font-bold text-slate-600">
                                        {new Date(m.created_at).toLocaleString('pt-BR')}
                                    </td>
                                    <td className="p-3">
                                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1 ${
                                            m.type === 'entrada' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                                            m.type === 'saida' ? 'bg-rose-100 text-rose-800 border border-rose-300' :
                                            'bg-sky-100 text-sky-800 border border-sky-300'
                                        }`}>
                                            {m.type === 'entrada' ? <ArrowDownLeft className="w-3 h-3" /> :
                                             m.type === 'saida' ? <ArrowUpRight className="w-3 h-3" /> :
                                             <RotateCcw className="w-3 h-3" />}
                                            <span>{m.type}</span>
                                        </span>
                                    </td>
                                    <td className="p-3 font-extrabold text-slate-900">
                                        {m.part?.name || 'Peça não identificada'}
                                    </td>
                                    <td className="p-3 font-black text-slate-900 font-mono">
                                        {m.type === 'entrada' ? `+${m.quantity}` : m.type === 'saida' ? `-${m.quantity}` : m.quantity} {m.part?.unit || 'UN'}
                                    </td>
                                    <td className="p-3 font-mono text-slate-500">
                                        {m.previous_stock}
                                    </td>
                                    <td className="p-3 font-mono font-black text-slate-900">
                                        {m.new_stock}
                                    </td>
                                    <td className="p-3 text-slate-600 max-w-xs truncate">
                                        {m.reason}
                                    </td>
                                    <td className="p-3 text-slate-600 font-semibold">
                                        {m.user_name || 'Sistema'}
                                    </td>
                                </tr>
                            ))}

                            {filteredMovements.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="p-8 text-center text-slate-400 font-bold">
                                        Nenhuma movimentação de estoque registrada com os filtros selecionados
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
