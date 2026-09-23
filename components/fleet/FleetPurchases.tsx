import React, { useState, useMemo } from 'react';
import { 
    FleetPart, 
    FleetPurchase, 
    FleetSupplier 
} from '../../types/fleetTypes';
import { 
    ShoppingBag, 
    Plus, 
    Search, 
    Filter, 
    DollarSign, 
    Calendar, 
    CheckCircle2, 
    Clock, 
    AlertTriangle, 
    FileText, 
    Package, 
    ChevronDown, 
    ChevronUp, 
    Building2, 
    X,
    ExternalLink
} from 'lucide-react';

interface FleetPurchasesProps {
    purchases: FleetPurchase[];
    suppliers: FleetSupplier[];
    parts: FleetPart[];
    onOpenNewPurchase: () => void;
    onUpdateStatus: (purchaseId: string, status: 'Pendente' | 'Pedido' | 'Recebido' | 'Cancelado') => void;
}

export const FleetPurchases: React.FC<FleetPurchasesProps> = ({
    purchases,
    suppliers,
    parts,
    onOpenNewPurchase,
    onUpdateStatus
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('todos');
    const [expandedId, setExpandedId] = useState<string | null>(null);

    // Map O(1) de Fornecedores
    const supplierMap = useMemo(() => {
        const map = new Map<string, FleetSupplier>();
        suppliers.forEach(s => map.set(s.id, s));
        return map;
    }, [suppliers]);

    const filteredPurchases = useMemo(() => {
        return purchases.filter(p => {
            if (statusFilter !== 'todos' && p.status !== statusFilter) return false;

            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const sup = supplierMap.get(p.supplier_id || '');
                const nf = (p.invoice_number || '').toLowerCase();
                const supName = (sup?.name || '').toLowerCase();
                const notes = (p.notes || '').toLowerCase();

                return nf.includes(q) || supName.includes(q) || notes.includes(q);
            }

            return true;
        });
    }, [purchases, statusFilter, searchQuery, supplierMap]);

    const totalCost = useMemo(() => {
        return filteredPurchases.reduce((acc, p) => acc + (Number(p.total_amount) || 0), 0);
    }, [filteredPurchases]);

    return (
        <div className="space-y-4 md:space-y-6 pb-12 animate-in fade-in duration-300">
            {/* Header & Ações */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 md:p-5 rounded-3xl border border-slate-200/90 shadow-sm">
                <div>
                    <div className="flex items-center gap-2">
                        <h2 className="text-base md:text-xl font-black bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 bg-clip-text text-transparent uppercase tracking-tight">
                            Compras de Peças & Recebimento
                        </h2>
                        <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-extrabold text-xs">
                            {filteredPurchases.length} compras
                        </span>
                    </div>
                    <p className="text-xs font-semibold text-slate-500 mt-0.5">
                        Ordens de compra com entrada automática no estoque ao marcar como recebido
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="text-right hidden md:block">
                        <span className="text-[10px] font-black uppercase text-slate-400 block">Total em Compras</span>
                        <span className="text-base font-black text-slate-900 font-mono">
                            R$ {totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                    </div>

                    <button
                        type="button"
                        onClick={onOpenNewPurchase}
                        className="px-4 py-2.5 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-sky-500/25 active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Nova Ordem de Compra</span>
                    </button>
                </div>
            </div>

            {/* Filtros */}
            <div className="bg-white p-3 md:p-4 rounded-3xl border border-slate-200/90 shadow-sm grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder="Buscar por número de NF, fornecedor ou observações..."
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

                <div>
                    <select
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value)}
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800"
                    >
                        <option value="todos">Todos os Status de Compra</option>
                        <option value="Pendente">Pendente</option>
                        <option value="Pedido">Pedido Realizado</option>
                        <option value="Recebido">Recebido (Integrado ao Estoque)</option>
                        <option value="Cancelado">Cancelado</option>
                    </select>
                </div>
            </div>

            {/* Listagem de Compras */}
            <div className="space-y-3">
                {filteredPurchases.map(p => {
                    const sup = supplierMap.get(p.supplier_id || '');
                    const isExpanded = expandedId === p.id;

                    return (
                        <div 
                            key={p.id}
                            className="bg-white rounded-3xl border border-slate-200/90 shadow-sm hover:shadow-md transition-all overflow-hidden"
                        >
                            <div 
                                onClick={() => setExpandedId(isExpanded ? null : p.id)}
                                className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer hover:bg-slate-50/50"
                            >
                                <div className="flex items-start md:items-center gap-3">
                                    <div className="w-10 h-10 rounded-2xl bg-sky-50 border border-sky-200/80 flex items-center justify-center text-sky-600 shrink-0">
                                        <ShoppingBag className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="px-2.5 py-0.5 bg-slate-900 text-white font-mono font-black text-xs rounded-md">
                                                NF {p.invoice_number || p.id.substring(0, 8).toUpperCase()}
                                            </span>
                                            <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase ${
                                                p.status === 'Recebido' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                                                p.status === 'Pedido' ? 'bg-sky-100 text-sky-800 border border-sky-300' :
                                                p.status === 'Pendente' ? 'bg-amber-100 text-amber-900 border border-amber-300' :
                                                'bg-rose-100 text-rose-800 border border-rose-300'
                                            }`}>
                                                {p.status}
                                            </span>
                                            <span className="text-xs font-bold text-slate-500">
                                                {new Date(p.purchase_date).toLocaleDateString('pt-BR')}
                                            </span>
                                        </div>

                                        <h4 className="text-sm font-black text-slate-900 mt-1 uppercase">
                                            Fornecedor: {sup?.name || 'Fornecedor Geral'}
                                        </h4>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between md:justify-end gap-4 border-t md:border-t-0 pt-2 md:pt-0">
                                    <div className="text-right">
                                        <span className="text-sm md:text-base font-black text-slate-900 block font-mono">
                                            R$ {p.total_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                        <span className="text-[10px] font-bold text-slate-400">
                                            {p.items?.length || 0} itens comprados
                                        </span>
                                    </div>

                                    <div className="p-1 text-slate-400">
                                        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                    </div>
                                </div>
                            </div>

                            {/* Detalhes Expansíveis da Compra */}
                            {isExpanded && (
                                <div className="p-4 md:p-5 bg-slate-50/80 border-t border-slate-100 space-y-3 animate-in fade-in duration-200 text-xs">
                                    {/* Ações de Transição de Status */}
                                    <div className="flex items-center justify-between gap-2 p-3 bg-white rounded-2xl border border-slate-200">
                                        <span className="text-[10px] font-black uppercase text-slate-400">Alterar Situação do Pedido:</span>
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            {p.status !== 'Recebido' && (
                                                <button
                                                    type="button"
                                                    onClick={() => onUpdateStatus(p.id, 'Recebido')}
                                                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                                                >
                                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                                    <span>Marcar como Recebido (Entrar Estoque)</span>
                                                </button>
                                            )}
                                            {p.status !== 'Pedido' && (
                                                <button
                                                    type="button"
                                                    onClick={() => onUpdateStatus(p.id, 'Pedido')}
                                                    className="px-3 py-1.5 bg-sky-50 text-sky-700 hover:bg-sky-100 rounded-xl text-[10px] font-black uppercase border border-sky-200 cursor-pointer"
                                                >
                                                    Marcar Pedido
                                                </button>
                                            )}
                                            {p.status !== 'Cancelado' && (
                                                <button
                                                    type="button"
                                                    onClick={() => onUpdateStatus(p.id, 'Cancelado')}
                                                    className="px-3 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-xl text-[10px] font-black uppercase border border-rose-200 cursor-pointer"
                                                >
                                                    Cancelar
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Itens Comprados */}
                                    {p.items && p.items.length > 0 && (
                                        <div className="bg-white p-3 rounded-2xl border border-slate-200 space-y-2">
                                            <span className="text-[10px] font-black uppercase text-slate-500 block">
                                                Peças da Ordem de Compra:
                                            </span>
                                            <div className="divide-y divide-slate-100">
                                                {p.items.map(it => (
                                                    <div key={it.id} className="py-1.5 flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <Package className="w-3.5 h-3.5 text-sky-600" />
                                                            <span className="font-bold text-slate-900">{it.part?.name || it.part_name || 'Peça'}</span>
                                                        </div>
                                                        <div className="text-right font-mono">
                                                            <span className="font-bold text-slate-600 mr-2">{it.quantity}x R$ {it.unit_price.toFixed(2)}</span>
                                                            <span className="font-black text-slate-900">R$ {it.total_price.toFixed(2)}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {p.notes && (
                                        <div className="p-2.5 bg-sky-50/60 rounded-xl border border-sky-200 text-slate-700">
                                            <strong className="font-bold uppercase text-[9px] block text-sky-900">Observações:</strong>
                                            {p.notes}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}

                {filteredPurchases.length === 0 && (
                    <div className="py-12 text-center text-slate-400 bg-white rounded-3xl border border-slate-200 p-8">
                        <ShoppingBag className="w-12 h-12 mx-auto mb-2 opacity-30 text-slate-500" />
                        <h4 className="text-sm font-black text-slate-800 uppercase">Nenhuma compra registrada</h4>
                        <p className="text-xs text-slate-500 mt-1">Clique no botão acima para registrar uma nova compra de peças.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
