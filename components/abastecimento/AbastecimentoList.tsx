import React, { useState, useEffect } from 'react';
import { ArrowLeft, Search, Filter, Fuel, Trash2, Calendar, User, Truck, ShieldCheck, FileText, ChevronDown, Check, X } from 'lucide-react';
import { AbastecimentoService, AbastecimentoRecord } from '../../services/abastecimentoService';
import { supabase } from '../../services/supabaseClient';
import { GestureItem } from '../common/GestureItem';
import { formatLocalDateTime, getLocalISOData } from '../../utils/dateUtils';

interface AbastecimentoListProps {
    onBack: () => void;
    onEdit?: (record: AbastecimentoRecord) => void;
    refreshTrigger?: number;
}
import { useAuth } from '../../contexts/AuthContext';
import { Edit } from 'lucide-react';

const getFuelColor = (fuel: string) => {
    const type = fuel.toLowerCase();
    if (type.includes('diesel')) return 'text-amber-600 bg-amber-500/10 border-amber-500/20';
    if (type.includes('gasolina')) return 'text-blue-600 bg-blue-500/10 border-blue-500/20';
    if (type.includes('etanol')) return 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20';
    return 'text-purple-600 bg-purple-500/10 border-purple-500/20';
};

const DataItem = ({ label, value, icon: Icon, colorClass = "text-slate-700", flex = "flex-1", truncateValue = true, isBadge = false }: { label: string, value: string | number, icon?: any, colorClass?: string, flex?: string, truncateValue?: boolean, isBadge?: boolean }) => (
    <div className={`flex flex-col gap-1 ${flex} min-w-0`}>
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400/80 ml-0.5 whitespace-nowrap overflow-hidden text-ellipsis flex items-center gap-1.5">
            {Icon && !isBadge && <Icon className="w-3 h-3" />}
            {label}
        </span>
        <div className={`flex items-center text-sm font-bold transition-colors ${colorClass} ${isBadge ? 'px-2.5 py-1 rounded-lg border w-fit' : ''}`}>
            {Icon && isBadge && <Icon className="w-3.5 h-3.5 mr-1.5 shrink-0 opacity-70" />}
            <span className={truncateValue ? "truncate" : "whitespace-nowrap"} title={String(value)}>{value}</span>
        </div>
    </div>
);

const AbastecimentoCard = ({ item, isAdmin, onEdit, onDelete, vehicleModelMap, vehiclePlateMap, vehicleSectorMap }: any) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const fuelColor = getFuelColor(item.fuelType);

    return (
        <GestureItem
            onSwipeLeft={isAdmin ? () => onDelete(item.id) : undefined}
            className="rounded-2xl shadow-sm mb-3"
        >
            <div
                onClick={() => setIsExpanded(!isExpanded)}
                className={`group bg-white rounded-2xl border transition-all duration-300 relative overflow-hidden cursor-pointer ${isExpanded ? 'border-cyan-200 ring-1 ring-cyan-100 shadow-lg shadow-cyan-500/5' : 'border-slate-200/60 hover:shadow-md hover:border-cyan-200/50'}`}
            >
                <div className={`absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-transparent via-slate-200 to-transparent group-hover:via-cyan-400 transition-all ${isExpanded ? 'bg-cyan-400' : ''}`} />

                <div className="p-4 pl-5">
                    {/* Minimized / Header Content */}
                    <div className="flex flex-col wide:flex-row wide:items-center gap-4">
                        <div className="flex-1 grid grid-cols-2 wide:grid-cols-12 gap-4 items-center">
                            {/* Always Visible Fields */}
                            <DataItem label="Nº Nota" value={item.invoiceNumber || '-'} icon={FileText} flex="col-span-1 wide:col-span-1" />
                            <DataItem label="Data" value={formatLocalDateTime(item.date)} icon={Calendar} flex="col-span-1 wide:col-span-2" />
                            <DataItem label="Veículo" value={vehicleModelMap[item.vehicle] ? `${vehicleModelMap[item.vehicle]}` : item.vehicle} icon={Truck} colorClass="text-slate-900 uppercase tracking-tight" flex="col-span-2 wide:col-span-3" />
                            <DataItem label="Motorista" value={item.driver} icon={User} colorClass="text-slate-600 uppercase tracking-tight" flex="col-span-1 wide:col-span-2" />
                            <DataItem label="Setor" value={vehicleSectorMap[item.vehicle] || '-'} colorClass="text-slate-500 uppercase text-[10px]" flex="col-span-1 wide:col-span-2" />
                            <DataItem
                                label="Combustível"
                                value={item.fuelType.split(' - ')[0].toUpperCase()}
                                colorClass={fuelColor}
                                flex="col-span-1 wide:col-span-1"
                                isBadge={true}
                            />
                            <DataItem
                                label="Custo"
                                value={`R$ ${item.cost.toFixed(2)}`}
                                colorClass="text-emerald-700 font-black"
                                flex="col-span-1 wide:col-span-1"
                            />
                            {item.unit_price && (
                                <DataItem
                                    label="Preço/L"
                                    value={`R$ ${item.unit_price.toFixed(2)}`}
                                    colorClass="text-slate-500 font-medium"
                                    flex="col-span-1 wide:col-span-1"
                                />
                            )}
                        </div>

                        {/* Chevron Toggle */}
                        <div className={`text-slate-300 group-hover:text-cyan-500 transition-transform duration-300 ${isExpanded ? 'rotate-180 text-cyan-500' : ''}`}>
                            <ChevronDown className="w-5 h-5" />
                        </div>
                    </div>

                    {/* Expanded Content */}
                    <div className={`grid grid-cols-2 wide:flex wide:flex-wrap gap-4 pt-4 mt-4 border-t border-slate-100 transition-all duration-300 origin-top ${isExpanded ? 'opacity-100 max-h-96 scale-100' : 'opacity-0 max-h-0 scale-95 hidden'}`}>
                        <DataItem
                            label="Protocolo"
                            value={item.protocol || item.id.substring(0, 8)}
                            colorClass="text-slate-400 font-mono text-[9px] bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200"
                            flex="col-span-1 wide:w-auto"
                        />
                        <DataItem label="Placa" value={vehiclePlateMap[item.vehicle] || '-'} colorClass="text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded border border-cyan-100 font-mono text-xs" flex="col-span-1 wide:w-auto" />
                        <DataItem label="Fiscal" value={item.fiscal || 'Sistema'} icon={ShieldCheck} colorClass="text-slate-600 font-medium" flex="col-span-1 wide:w-auto" />
                        <DataItem label="Quantidade" value={`${item.liters.toFixed(3)} L`} flex="col-span-1 wide:w-auto" colorClass="text-slate-600" />
                        <DataItem label="Odômetro" value={`${item.odometer.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Km`} flex="col-span-1 wide:w-auto" colorClass="text-slate-600" />

                        {/* Action Buttons in Expanded View */}
                        {isAdmin && (
                            <div className="flex gap-2 ml-auto mt-2 wide:mt-0 col-span-2 wide:col-span-auto justify-end">
                                {onEdit && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onEdit(item); }}
                                        className="flex items-center gap-2 px-3 py-1.5 text-slate-500 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg transition-colors text-xs font-bold border border-transparent hover:border-cyan-100"
                                    >
                                        <Edit className="w-3.5 h-3.5" />
                                        Editar
                                    </button>
                                )}
                                <button
                                    onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
                                    className="flex items-center gap-2 px-3 py-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors text-xs font-bold border border-transparent hover:border-rose-100"
                                    title="Excluir Registro"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    Excluir
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </GestureItem>
    );
};

export const AbastecimentoList: React.FC<AbastecimentoListProps> = ({ onBack, onEdit, refreshTrigger }) => {
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';
    const [supplies, setSupplies] = useState<AbastecimentoRecord[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [vehicleSectorMap, setVehicleSectorMap] = useState<Record<string, string>>({});
    const [vehiclePlateMap, setVehiclePlateMap] = useState<Record<string, string>>({});
    const [vehicleModelMap, setVehicleModelMap] = useState<Record<string, string>>({});

    // Pagination State
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [totalCount, setTotalCount] = useState(0);

    // Filter States
    const [filterMode, setFilterMode] = useState<'today' | 'all' | 'date'>('today');
    const [selectedDate, setSelectedDate] = useState<string>(() => {
        const date = new Date();
        const offset = date.getTimezoneOffset();
        const localDate = new Date(date.getTime() - (offset * 60 * 1000));
        return getLocalISOData(localDate).date;
    });
    const [filterSector, setFilterSector] = useState('all');
    const [filterFuel, setFilterFuel] = useState('all');

    // Dropdown Data
    const [sectorsList, setSectorsList] = useState<{ id: string, name: string }[]>([]);

    const [isFilterOpen, setIsFilterOpen] = useState(false);

    // Debounce Search
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm);
            setPage(1); // Reset to page 1 on search change
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Reset pagination when filters change
    useEffect(() => {
        setPage(1);
    }, [filterMode, selectedDate, filterSector, filterFuel, refreshTrigger]);

    const loadSupplies = React.useCallback(async (currentPage: number, resetList: boolean = false) => {
        setIsLoading(true);
        try {
            // Helper to get filter object
            const filters: any = {};
            if (debouncedSearch) filters.search = debouncedSearch;
            if (filterSector && filterSector !== 'all') filters.sector = filterSector;
            if (filterFuel && filterFuel !== 'all') filters.fuelType = filterFuel;

            if (filterMode === 'today' || filterMode === 'date') {
                const baseDateStr = filterMode === 'today'
                    ? getLocalISOData(new Date()).date
                    : selectedDate;

                filters.date = baseDateStr;
            }

            const [dataRes, vehiclesRes, sectorsRes] = await Promise.all([
                AbastecimentoService.getAbastecimentos(currentPage, 50, filters),
                // Optimization: Load metadata only if maps are empty or forced refresh
                // But for now keeping simple to ensure consistency
                Object.keys(vehicleSectorMap).length === 0 ? supabase.from('vehicles').select('*') : Promise.resolve({ data: null }),
                Object.keys(vehicleSectorMap).length === 0 ? supabase.from('sectors').select('*') : Promise.resolve({ data: null })
            ]);

            if (resetList || currentPage === 1) {
                setSupplies(dataRes.data);
            } else {
                setSupplies(prev => [...prev, ...dataRes.data]);
            }

            setTotalCount(dataRes.count);
            setHasMore(dataRes.data.length === 50);

            if (vehiclesRes.data && sectorsRes.data) {
                const sectorLookup = sectorsRes.data.reduce((acc: any, s: any) => {
                    acc[s.id] = s.name;
                    return acc;
                }, {});

                // Update sectors list for dropdown
                if (sectorsRes.data) {
                    setSectorsList(sectorsRes.data.sort((a: any, b: any) => a.name.localeCompare(b.name)));
                }

                const vMap: Record<string, string> = {};
                const pMap: Record<string, string> = {};
                const modelMap: Record<string, string> = {};

                vehiclesRes.data.forEach((v: any) => {
                    const sectorName = sectorLookup[v.sector_id] || 'N/A';
                    if (v.plate) {
                        vMap[v.plate] = sectorName;
                        pMap[v.plate] = v.plate;
                        modelMap[v.plate] = `${v.model} - ${v.brand}`;
                    }
                    const legacyKey = `${v.model} - ${v.brand}`;
                    if (!vMap[legacyKey]) vMap[legacyKey] = sectorName;
                    if (!pMap[legacyKey]) pMap[legacyKey] = v.plate || 'S/PLACA';
                });
                setVehicleSectorMap(vMap);
                setVehiclePlateMap(pMap);
                setVehicleModelMap(modelMap);
            }

        } catch (error) {
            console.error("Error loading supplies", error);
        } finally {
            setIsLoading(false);
        }
    }, [debouncedSearch, filterSector, filterFuel, filterMode, selectedDate]); // Dependencies ensuring fresh state

    useEffect(() => {
        loadSupplies(page, page === 1);
    }, [loadSupplies, page, refreshTrigger]);

    // Cleanup subscription to avoid duplicates/complexity with pagination.
    useEffect(() => {
        const channel = supabase
            .channel('abastecimentos-list-changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'abastecimentos' },
                () => {
                    // On valid change, refresh if on page 1 to show latest data
                    if (page === 1) loadSupplies(1, true);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [page, loadSupplies]); // Including loadSupplies ensures we use the version with fresh state closure

    const handleDelete = async (id: string) => {
        if (window.confirm('Tem certeza que deseja excluir este registro?')) {
            await AbastecimentoService.deleteAbastecimento(id);
            if (page === 1) loadSupplies(1, true);
        }
    };

    // We no longer filter client-side. 'supplies' contains the VIEW data.
    const filteredSupplies = supplies;

    return (
        <div className="flex-1 h-full bg-slate-50/50 p-4 wide:p-6 overflow-auto custom-scrollbar">
            <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
                {/* Header Section */}
                <div className="flex flex-col wide:flex-row wide:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <button onClick={onBack} className="group p-2 text-slate-400 hover:text-cyan-600 hover:bg-white rounded-xl transition-all shadow-sm ring-1 ring-slate-200 hover:ring-cyan-200">
                            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
                        </button>
                        <div>
                            <h1 className="text-xl font-black text-slate-900 tracking-tight">Gestão de Abastecimento</h1>
                            <p className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
                                Histórico e controle
                                <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[10px] font-bold border border-slate-200">
                                    {totalCount} Registros
                                </span>
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2">
                        <div className="relative group flex-1">
                            <input
                                type="text"
                                placeholder="Buscar veículo, motorista, nota ou protocolo..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-11 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 w-full sm:w-72 shadow-sm transition-all placeholder:font-medium"
                            />
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-cyan-500 transition-colors" />
                        </div>
                        <div className="relative">
                            <button
                                onClick={() => setIsFilterOpen(!isFilterOpen)}
                                className={`flex items-center justify-center gap-2 px-4 py-2.5 border rounded-xl font-bold text-xs shadow-sm transition-all active:scale-95 ${filterMode !== 'all'
                                    ? 'bg-cyan-50 border-cyan-200 text-cyan-700'
                                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                    }`}
                            >
                                <Filter className="w-4 h-4" />
                                {filterMode === 'today' ? `Hoje` : filterMode === 'date' ? (() => {
                                    const [y, m, d] = selectedDate.split('-');
                                    return `${d}/${m}/${y}`;
                                })() : `Todos`}
                                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isFilterOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {/* Dropdown Menu */}
                            {isFilterOpen && (
                                <>
                                    <div className="fixed inset-0 z-10" onClick={() => setIsFilterOpen(false)}></div>
                                    <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-100 p-4 z-20 animate-in fade-in zoom-in-95 duration-200 flex flex-col gap-4">

                                        <div className="space-y-2">
                                            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Período</span>
                                            <div className="flex flex-col gap-1">
                                                <button
                                                    onClick={() => setFilterMode('today')}
                                                    className={`flex items-center justify-between w-full px-3 py-2 rounded-xl text-xs font-bold transition-colors ${filterMode === 'today' ? 'bg-cyan-50 text-cyan-700' : 'text-slate-600 hover:bg-slate-50'}`}
                                                >
                                                    <span>Hoje</span>
                                                    {filterMode === 'today' && <Check className="w-4 h-4" />}
                                                </button>

                                                <button
                                                    onClick={() => setFilterMode('all')}
                                                    className={`flex items-center justify-between w-full px-3 py-2 rounded-xl text-xs font-bold transition-colors ${filterMode === 'all' ? 'bg-cyan-50 text-cyan-700' : 'text-slate-600 hover:bg-slate-50'}`}
                                                >
                                                    <span>Todos</span>
                                                    {filterMode === 'all' && <Check className="w-4 h-4" />}
                                                </button>

                                                <div className="relative mt-1">
                                                    <input
                                                        type="date"
                                                        value={selectedDate}
                                                        onChange={(e) => {
                                                            setSelectedDate(e.target.value);
                                                            setFilterMode('date');
                                                        }}
                                                        className={`w-full bg-slate-50 border rounded-lg px-2 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all ${filterMode === 'date' ? 'border-cyan-200 bg-cyan-50/30' : 'border-slate-200'}`}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="h-px bg-slate-100" />

                                        <div className="space-y-2">
                                            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Combustível</span>
                                            <select
                                                value={filterFuel}
                                                onChange={(e) => setFilterFuel(e.target.value)}
                                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-xs font-bold text-slate-700 outline-none focus:border-cyan-500"
                                            >
                                                <option value="all">Todos</option>
                                                <option value="diesel">Diesel</option>
                                                <option value="gasolina">Gasolina</option>
                                                <option value="etanol">Etanol</option>
                                                <option value="arla">Arla</option>
                                            </select>
                                        </div>

                                        <div className="space-y-2">
                                            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Setor</span>
                                            <select
                                                value={filterSector}
                                                onChange={(e) => setFilterSector(e.target.value)}
                                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-xs font-bold text-slate-700 outline-none focus:border-cyan-500"
                                            >
                                                <option value="all">Todos</option>
                                                {sectorsList.map(s => (
                                                    <option key={s.id} value={s.id}>{s.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* List Container */}
                {filteredSupplies.length === 0 && !isLoading ? (
                    <div className="bg-white rounded-[2rem] p-16 text-center border-2 border-dashed border-slate-200/60 flex flex-col items-center justify-center gap-4">
                        <div className="p-4 bg-slate-50 rounded-full">
                            <Fuel className="w-8 h-8 text-slate-300" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-900">Nenhum registro encontrado</h3>
                            <p className="text-slate-500 text-sm">Tente ajustar seus filtros de busca</p>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3 pb-8">
                        {filteredSupplies.map((item) => (
                            <AbastecimentoCard
                                key={item.id}
                                item={item}
                                isAdmin={isAdmin}
                                onEdit={onEdit}
                                onDelete={handleDelete}
                                vehicleModelMap={vehicleModelMap}
                                vehiclePlateMap={vehiclePlateMap}
                                vehicleSectorMap={vehicleSectorMap}
                            />
                        ))}

                        {/* Load More Button or Loading Indicator */}
                        {hasMore && (
                            <div className="flex justify-center mt-4">
                                <button
                                    onClick={() => setPage(prev => prev + 1)}
                                    disabled={isLoading}
                                    className="px-6 py-2 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl shadow-sm hover:bg-slate-50 hover:text-cyan-600 transition-colors disabled:opacity-50"
                                >
                                    {isLoading ? 'Carregando...' : 'Carregar Mais'}
                                </button>
                            </div>
                        )}

                        {!hasMore && filteredSupplies.length > 0 && (
                            <p className="text-center text-xs text-slate-400 font-medium py-4">
                                Todos os registros foram carregados.
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
