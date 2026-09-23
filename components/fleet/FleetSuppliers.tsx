import React, { useState, useMemo } from 'react';
import { 
    FleetMaintenance, 
    FleetPurchase, 
    FleetSupplier 
} from '../../types/fleetTypes';
import { 
    Building2, 
    Plus, 
    Search, 
    Edit2, 
    Trash2, 
    Phone, 
    Mail, 
    MapPin, 
    User, 
    Wrench, 
    ShoppingBag, 
    X,
    ExternalLink
} from 'lucide-react';

interface FleetSuppliersProps {
    suppliers: FleetSupplier[];
    maintenances: FleetMaintenance[];
    purchases: FleetPurchase[];
    onOpenNewSupplier: () => void;
    onEditSupplier: (supplier: FleetSupplier) => void;
    onDeleteSupplier: (supplierId: string) => void;
}

export const FleetSuppliers: React.FC<FleetSuppliersProps> = ({
    suppliers,
    maintenances,
    purchases,
    onOpenNewSupplier,
    onEditSupplier,
    onDeleteSupplier
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState('todos');

    const filteredSuppliers = useMemo(() => {
        return suppliers.filter(s => {
            if (typeFilter !== 'todos' && s.type !== typeFilter) return false;

            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const name = (s.name || '').toLowerCase();
                const trade = (s.trade_name || '').toLowerCase();
                const cnpj = (s.cnpj_cpf || '').toLowerCase();
                const city = (s.city || '').toLowerCase();

                return name.includes(q) || trade.includes(q) || cnpj.includes(q) || city.includes(q);
            }

            return true;
        });
    }, [suppliers, typeFilter, searchQuery]);

    return (
        <div className="space-y-4 md:space-y-6 pb-12 animate-in fade-in duration-300">
            {/* Header & Ações */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 md:p-5 rounded-3xl border border-slate-200/90 shadow-sm">
                <div>
                    <div className="flex items-center gap-2">
                        <h2 className="text-base md:text-xl font-black bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 bg-clip-text text-transparent uppercase tracking-tight">
                            Central de Fornecedores & Oficinas
                        </h2>
                        <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-extrabold text-xs">
                            {filteredSuppliers.length} cadastrados
                        </span>
                    </div>
                    <p className="text-xs font-semibold text-slate-500 mt-0.5">
                        Oficinas mecânicas credenciadas, autopeças, concessionárias e prestadores
                    </p>
                </div>

                <button
                    type="button"
                    onClick={onOpenNewSupplier}
                    className="px-4 py-2.5 bg-gradient-to-r from-slate-900 to-slate-800 hover:from-slate-800 hover:to-slate-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                >
                    <Plus className="w-4 h-4" />
                    <span>Cadastrar Fornecedor</span>
                </button>
            </div>

            {/* Filtros */}
            <div className="bg-white p-3 md:p-4 rounded-3xl border border-slate-200/90 shadow-sm grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder="Buscar por nome, razão social, CNPJ ou cidade..."
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
                        value={typeFilter}
                        onChange={e => setTypeFilter(e.target.value)}
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800"
                    >
                        <option value="todos">Todos os Tipos</option>
                        <option value="Oficina">Oficinas Mecânicas</option>
                        <option value="Autopeças">Autopeças</option>
                        <option value="Concessionária">Concessionárias</option>
                        <option value="Prestador">Prestadores de Serviço</option>
                        <option value="Outro">Outros Fornecedores</option>
                    </select>
                </div>
            </div>

            {/* Grid de Fornecedores */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {filteredSuppliers.map(s => {
                    const supplierMaintenances = maintenances.filter(m => m.supplier_id === s.id);
                    const supplierPurchases = purchases.filter(p => p.supplier_id === s.id);
                    const totalServicesCost = supplierMaintenances.reduce((acc, m) => acc + (Number(m.total_cost) || 0), 0);
                    const totalPurchasesCost = supplierPurchases.reduce((acc, p) => acc + (Number(p.total_amount) || 0), 0);

                    return (
                        <div
                            key={s.id}
                            className="bg-white rounded-3xl border border-slate-200/90 shadow-sm hover:shadow-md transition-all p-4 space-y-3 flex flex-col justify-between"
                        >
                            <div className="space-y-2">
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-black uppercase rounded-md">
                                            {s.type}
                                        </span>
                                        <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight mt-1">
                                            {s.name}
                                        </h3>
                                        {s.trade_name && (
                                            <span className="text-[10px] font-bold text-slate-500 block">
                                                Nome Fantasia: {s.trade_name}
                                            </span>
                                        )}
                                        {s.cnpj_cpf && (
                                            <span className="text-[10px] font-mono text-slate-400 block">
                                                CNPJ/CPF: {s.cnpj_cpf}
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-1">
                                        <button
                                            type="button"
                                            onClick={() => onEditSupplier(s)}
                                            className="p-1.5 text-slate-400 hover:text-slate-800 rounded-lg hover:bg-slate-100"
                                            title="Editar Fornecedor"
                                        >
                                            <Edit2 className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => onDeleteSupplier(s.id)}
                                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                                            title="Excluir Fornecedor"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>

                                {/* Contatos & Endereço */}
                                <div className="space-y-1 text-xs text-slate-600 pt-1 border-t border-slate-100">
                                    {s.phone && (
                                        <div className="flex items-center gap-1.5">
                                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                                            <span>{s.phone}</span>
                                        </div>
                                    )}
                                    {s.email && (
                                        <div className="flex items-center gap-1.5 truncate">
                                            <Mail className="w-3.5 h-3.5 text-slate-400" />
                                            <span className="truncate">{s.email}</span>
                                        </div>
                                    )}
                                    {s.city && (
                                        <div className="flex items-center gap-1.5">
                                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                                            <span>{s.city} {s.address ? `• ${s.address}` : ''}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Resumo de Serviços e Compras */}
                            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-[10px]">
                                <div className="bg-slate-50 p-2 rounded-xl border border-slate-200/60">
                                    <span className="text-slate-400 font-bold block uppercase">Manutenções</span>
                                    <span className="font-black text-slate-900 font-mono">
                                        {supplierMaintenances.length} (R$ {totalServicesCost.toFixed(0)})
                                    </span>
                                </div>
                                <div className="bg-slate-50 p-2 rounded-xl border border-slate-200/60">
                                    <span className="text-slate-400 font-bold block uppercase">Compras</span>
                                    <span className="font-black text-slate-900 font-mono">
                                        {supplierPurchases.length} (R$ {totalPurchasesCost.toFixed(0)})
                                    </span>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {filteredSuppliers.length === 0 && (
                    <div className="col-span-full py-12 text-center text-slate-400 bg-white rounded-3xl border border-slate-200 p-8">
                        <Building2 className="w-12 h-12 mx-auto mb-2 opacity-30 text-slate-500" />
                        <h4 className="text-sm font-black text-slate-800 uppercase">Nenhum fornecedor encontrado</h4>
                        <p className="text-xs text-slate-500 mt-1">Clique no botão acima para cadastrar um novo fornecedor ou oficina.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
