import React, { useState, useEffect, useMemo } from 'react';
import { Search, X, Check, PackagePlus, Loader2, PackageSearch, Filter, Plus } from 'lucide-react';
import { InventoryItem, PurchaseItem } from '../../types';
import { getInventoryItems } from '../../services/comprasService';
import { normalizeText } from '../../utils/stringUtils';

interface ItemSelectionModalProps {
    onClose: () => void;
    onConfirm: (items: PurchaseItem[]) => void;
    onAddManual: () => void;
}

export const ItemSelectionModal: React.FC<ItemSelectionModalProps> = ({ onClose, onConfirm, onAddManual }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    // Stores the selected inventory items quantities -> mapping ID to number (quantity)
    const [selectedQuantities, setSelectedQuantities] = useState<Record<string, number>>({});
    const [showSelectedList, setShowSelectedList] = useState(false);

    useEffect(() => {
        const fetchItems = async () => {
            setLoading(true);
            try {
                // Puxa todos os itens (estoque livre, não licitados, etc)
                // ou apenas is_tendered (Licitados). O cliente solicitou que seja "lista de todos os itens importados (estoque)"
                const data = await getInventoryItems(); 
                setItems(data);
            } catch (err) {
                console.error("Erro ao buscar estoque:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchItems();
    }, []);

    const filteredItems = useMemo(() => {
        if (!searchTerm.trim()) return []; // Não exibe a lista se não houver pesquisa
        const normalizedSearch = normalizeText(searchTerm);
        return items.filter(item => 
            normalizeText(item.name).includes(normalizedSearch) ||
            (item.code && normalizeText(item.code).includes(normalizedSearch))
        );
    }, [items, searchTerm]);

    const handleQuantityChange = (id: string, qty: number) => {
        setSelectedQuantities(prev => {
            const next = { ...prev };
            if (qty <= 0) {
                delete next[id];
            } else {
                next[id] = qty;
            }
            return next;
        });
    };

    const toggleSelection = (id: string) => {
        if (selectedQuantities[id]) {
            handleQuantityChange(id, 0);
        } else {
            handleQuantityChange(id, 1);
        }
    };

    const handleConfirm = () => {
        const purchaseItems: PurchaseItem[] = Object.keys(selectedQuantities).map(id => {
            const inv = items.find(i => i.id === id)!;
            return {
                id: Date.now().toString() + Math.random().toString(36).substring(7), // Fresh unique ID config
                name: inv.name,
                quantity: selectedQuantities[id], // Uso da quantidade selecionada
                unit: inv.unit as any,
                code: inv.code,
                unit_value: inv.unit_value,
                category: inv.category,
                inventory_item_id: inv.id // Traced back to source for reservation logic
            };
        });
        onConfirm(purchaseItems);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-fade-in p-4">
            <div className="bg-white rounded-[24px] w-full max-w-4xl h-[85vh] shadow-2xl flex flex-col overflow-hidden animate-scale-up border border-slate-200">
                
                {/* Cabeçalho */}
                <div className="bg-slate-50 border-b border-slate-100 p-6 flex items-center justify-between shrink-0">
                    <div>
                        <h2 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                            <PackageSearch className="w-6 h-6 text-emerald-500 hidden sm:block" />
                            Adicionar Itens ao Pedido
                        </h2>
                        <p className="text-sm font-medium text-slate-500 mt-1">Busque itens em estoque ou adicione manualmente.</p>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-800 hover:bg-slate-200 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Barra de Pesquisa e Ações */}
                <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-4 shrink-0 bg-white items-center justify-between">
                    <div className="relative flex-1 w-full">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input 
                            type="text" 
                            placeholder="Buscar por descrição ou código..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 outline-none focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 transition-all"
                        />
                    </div>
                    <div className="shrink-0 w-full sm:w-auto">
                        <button 
                            onClick={onAddManual}
                            className="w-full sm:w-auto px-6 py-3 border-2 border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 font-bold rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95"
                        >
                            <Plus className="w-4 h-4" />
                            <span className="text-sm">Novo Manual</span>
                        </button>
                    </div>
                </div>

                {/* Lista de Itens */}
                <div className="flex-1 overflow-y-auto bg-slate-50/50 p-4 custom-scrollbar">
                    {loading ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-4">
                            <Loader2 className="w-10 h-10 animate-spin text-emerald-500" />
                            <span className="text-sm font-bold uppercase tracking-widest">Carregando catálogo...</span>
                        </div>
                    ) : (showSelectedList ? items.filter(i => !!selectedQuantities[i.id]) : filteredItems).length > 0 ? (
                        <div className="flex flex-col gap-2">
                            {showSelectedList && (
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="font-bold text-slate-700">Revisando {Object.keys(selectedQuantities).length} itens selecionados</h3>
                                    <button 
                                        onClick={() => setShowSelectedList(false)}
                                        className="text-xs font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors"
                                    >
                                        Voltar ao catálogo
                                    </button>
                                </div>
                            )}
                            {(showSelectedList ? items.filter(i => !!selectedQuantities[i.id]) : filteredItems).map(item => {
                                const isSelected = !!selectedQuantities[item.id];
                                return (
                                    <div 
                                        key={item.id}
                                        className={`group relative p-3 rounded-xl border flex items-center gap-4 transition-all ${
                                            isSelected 
                                            ? 'border-emerald-500 bg-emerald-50/40 shadow-sm' 
                                            : 'border-slate-200 bg-white hover:border-emerald-300 hover:shadow-sm'
                                        }`}
                                    >
                                        {/* Custom Checkbox */}
                                        <div 
                                            onClick={() => toggleSelection(item.id)}
                                            className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border-2 cursor-pointer transition-colors ${
                                            isSelected 
                                            ? 'bg-emerald-500 border-emerald-500 text-white' 
                                            : 'bg-white border-slate-300 text-transparent group-hover:border-emerald-400'
                                        }`}>
                                            <Check className="w-4 h-4" />
                                        </div>

                                        {/* Item Info */}
                                        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => !isSelected && toggleSelection(item.id)}>
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <span className="text-[10px] font-black px-2 py-0.5 rounded bg-slate-100 text-slate-500 uppercase tracking-widest border border-slate-200">
                                                    Cód: {item.code || 'N/A'}
                                                </span>
                                                {item.unit_value !== undefined && item.unit_value > 0 && (
                                                    <span className="text-[10px] font-bold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded">
                                                        R$ {item.unit_value.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                                                    </span>
                                                )}
                                            </div>
                                            <h3 className={`font-bold text-sm leading-tight truncate ${isSelected ? 'text-emerald-900' : 'text-slate-800'}`} title={item.name}>
                                                {item.name}
                                            </h3>
                                            <p className="text-xs font-medium text-slate-400 mt-0.5">Disponível: {item.quantity - (item.reserved_quantity || 0)} {item.unit}</p>
                                        </div>

                                        {/* Quantity Input */}
                                        {isSelected && (
                                            <div className="flex items-center gap-2 shrink-0 animate-fade-in">
                                                <span className="text-[10px] font-black uppercase text-slate-400">Qtd:</span>
                                                <input 
                                                    type="number"
                                                    min="1"
                                                    autoFocus
                                                    value={selectedQuantities[item.id] || ''}
                                                    onChange={(e) => {
                                                        const val = parseInt(e.target.value, 10);
                                                        if (!isNaN(val)) handleQuantityChange(item.id, val);
                                                        else handleQuantityChange(item.id, 0); // Remove se zerar
                                                    }}
                                                    className="w-16 sm:w-20 px-2 py-1.5 border-2 border-emerald-200 rounded-lg text-sm font-bold text-slate-800 focus:outline-none focus:border-emerald-500 bg-white"
                                                />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center opacity-60">
                            {showSelectedList ? (
                                <>
                                    <PackagePlus className="w-16 h-16 text-slate-300 mb-4" />
                                    <h3 className="text-lg font-bold text-slate-400 text-center">Nenhum item selecionado</h3>
                                    <button 
                                        onClick={() => setShowSelectedList(false)}
                                        className="mt-4 px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg transition-colors text-sm"
                                    >
                                        Voltar para a busca
                                    </button>
                                </>
                            ) : (
                                <>
                                    {searchTerm.trim() ? <PackagePlus className="w-16 h-16 text-slate-300 mb-4" /> : <Search className="w-16 h-16 text-slate-300 mb-4" />}
                                    <h3 className="text-lg font-bold text-slate-400 text-center">
                                        {searchTerm.trim() ? 'Nenhum item encontrado' : 'Busque para adicionar itens'}
                                    </h3>
                                    <p className="text-sm text-slate-400 mt-2 text-center">
                                        {searchTerm.trim() ? 'Tente buscar de outra forma ou adicione manualmente.' : 'Digite o código ou nome do produto para visualizar o estoque.'}
                                    </p>
                                </>
                            )}
                        </div>
                    )}
                </div>

                <div className={`shrink-0 bg-white border-t border-slate-200 p-4 md:p-6 transition-all duration-300 transform ${Object.keys(selectedQuantities).length > 0 ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 hidden'}`}>
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4 max-w-4xl mx-auto w-full">
                        <div 
                            className="flex items-center gap-3 cursor-pointer hover:bg-slate-50 p-2 -m-2 rounded-xl transition-colors group"
                            onClick={() => setShowSelectedList(!showSelectedList)}
                        >
                            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center relative">
                                <span className="text-emerald-700 font-black text-lg">{Object.keys(selectedQuantities).length}</span>
                                {showSelectedList && <X className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white rounded-full p-0.5" />}
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-800 leading-tight group-hover:text-emerald-700 transition-colors">Itens Selecionados</h4>
                                <p className="text-xs text-emerald-600 font-semibold">{showSelectedList ? 'Clique para ocultar lista' : 'Clique para revisar lista'}</p>
                            </div>
                        </div>

                        <button 
                            onClick={handleConfirm}
                            className="w-full md:w-auto px-8 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest rounded-xl shadow-lg shadow-emerald-500/30 transition-all active:scale-95 flex items-center justify-center gap-2"
                        >
                            <Check className="w-5 h-5" />
                            Adicionar ao Pedido
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};
