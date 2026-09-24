import React, { useState, useEffect } from 'react';
import { 
    Vehicle, 
    Sector, 
    Person,
    VehicleBrand as Brand
} from '../../types';
import { 
    FleetMaintenance, 
    FleetPart, 
    FleetPurchase, 
    FleetSupplier, 
    VehicleHealthInfo,
    MaintenanceType
} from '../../types/fleetTypes';
import { 
    X, 
    Check, 
    Wrench, 
    Droplet, 
    Layers, 
    AlertTriangle, 
    CheckCircle2, 
    Clock, 
    Plus, 
    Trash2, 
    Loader2, 
    ShoppingBag, 
    Package, 
    Building2, 
    RotateCcw,
    Gauge,
    Car,
    FileText,
    Users,
    Shield,
    Activity,
    Tag,
    Sliders,
    Fuel,
    Truck
} from 'lucide-react';

// =========================================================================
// 1. MODAL DE SAÚDE DO VEÍCULO (RAIO-X PREVENTIVO)
// =========================================================================
interface VehicleHealthModalProps {
    isOpen: boolean;
    onClose: () => void;
    health: VehicleHealthInfo | null;
    vehicle: Vehicle | null;
    onOpenProntuario: (vehicleId: string) => void;
    onOpenNewMaintenance: (vehicleId: string) => void;
    onOpenOilChange: (vehicleId: string, currentKm: number) => void;
}

export const VehicleHealthModal: React.FC<VehicleHealthModalProps> = ({
    isOpen,
    onClose,
    health,
    vehicle,
    onOpenProntuario,
    onOpenNewMaintenance,
    onOpenOilChange
}) => {
    if (!isOpen || !health || !vehicle) return null;

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-5 md:p-6 w-full max-w-xl shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto custom-scrollbar space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between pb-3 border-b border-slate-100">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="px-2.5 py-1 bg-slate-900 text-white font-mono font-black text-xs rounded-lg">
                                {vehicle.plate}
                            </span>
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider ${
                                health.generalStatus === 'vencido' ? 'bg-rose-100 text-rose-800 border border-rose-300' :
                                health.generalStatus === 'proximo' ? 'bg-amber-100 text-amber-900 border border-amber-300' :
                                'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            }`}>
                                {health.generalStatus === 'vencido' ? '🔴 Status Geral: Vencido' :
                                 health.generalStatus === 'proximo' ? '🟡 Status Geral: Próximo' :
                                 '🟢 Status Geral: Em Dia'}
                            </span>
                        </div>
                        <h3 className="text-base font-black text-slate-900 uppercase mt-1">
                            {vehicle.brand} {vehicle.model}
                        </h3>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1 text-slate-400 hover:text-slate-800 rounded-lg"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* KM Atual */}
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between">
                    <span className="text-xs font-black uppercase text-slate-500">Quilometragem Atual</span>
                    <span className="text-sm md:text-base font-mono font-black text-indigo-900">
                        {(Number(vehicle.currentKm) || 0).toLocaleString('pt-BR')} km
                    </span>
                </div>

                {/* Itens de Saúde Essenciais */}
                <div className="space-y-2 text-xs">
                    <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                        Componentes & Manutenções Principais:
                    </h4>

                    {/* Óleo */}
                    <div className="p-3 rounded-2xl bg-slate-50/80 border border-slate-200/80 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Droplet className="w-4 h-4 text-amber-600" />
                            <div>
                                <span className="font-extrabold text-slate-900 block uppercase">Troca de Óleo</span>
                                <span className="text-[10px] text-slate-500">
                                    Próxima: {health.oilKmNext ? `${health.oilKmNext.toLocaleString('pt-BR')} km` : 'Não definido'}
                                    {health.oilKmRemaining !== undefined ? ` (Faltam ${health.oilKmRemaining.toLocaleString('pt-BR')} km)` : ''}
                                </span>
                            </div>
                        </div>
                        <span className={`px-2 py-0.5 rounded-md font-black text-[10px] uppercase ${
                            health.oilStatus === 'vencido' ? 'bg-rose-100 text-rose-800' :
                            health.oilStatus === 'proximo' ? 'bg-amber-100 text-amber-900' :
                            'bg-emerald-100 text-emerald-800'
                        }`}>
                            {health.oilStatus}
                        </span>
                    </div>

                    {/* Correia Dentada */}
                    <div className="p-3 rounded-2xl bg-slate-50/80 border border-slate-200/80 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Layers className="w-4 h-4 text-orange-600" />
                            <div>
                                <span className="font-extrabold text-slate-900 block uppercase">Correia Dentada</span>
                                <span className="text-[10px] text-slate-500">
                                    Próxima: {health.timingBeltKmNext ? `${health.timingBeltKmNext.toLocaleString('pt-BR')} km` : 'Não definido'}
                                    {health.timingBeltKmRemaining !== undefined ? ` (Faltam ${health.timingBeltKmRemaining.toLocaleString('pt-BR')} km)` : ''}
                                </span>
                            </div>
                        </div>
                        <span className={`px-2 py-0.5 rounded-md font-black text-[10px] uppercase ${
                            health.timingBeltStatus === 'vencido' ? 'bg-rose-100 text-rose-800' :
                            health.timingBeltStatus === 'proximo' ? 'bg-amber-100 text-amber-900' :
                            'bg-emerald-100 text-emerald-800'
                        }`}>
                            {health.timingBeltStatus}
                        </span>
                    </div>
                </div>

                {/* Manutenções Vencidas ou Próximas */}
                {health.overdueList.length > 0 && (
                    <div className="p-3 bg-rose-50 rounded-2xl border border-rose-200 text-xs space-y-1">
                        <span className="font-black uppercase text-rose-900 text-[10px] block">
                            ⚠️ Manutenções com Limite Vencido:
                        </span>
                        {health.overdueList.map(m => (
                            <div key={m.id} className="text-rose-800 font-bold">
                                • {m.type}: {m.description}
                            </div>
                        ))}
                    </div>
                )}

                {/* Ações do Modal */}
                <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                    <button
                        type="button"
                        onClick={() => { onClose(); onOpenNewMaintenance(vehicle.id); }}
                        className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black uppercase transition-all"
                    >
                        Lançar Manutenção
                    </button>
                    <button
                        type="button"
                        onClick={() => { onClose(); onOpenProntuario(vehicle.id); }}
                        className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black uppercase transition-all"
                    >
                        Abrir Prontuário Completo
                    </button>
                </div>
            </div>
        </div>
    );
};

// =========================================================================
// 2. MODAL DE NOVA MANUTENÇÃO COM PEÇAS UTILIZADAS & BAIXA AUTOMÁTICA
// =========================================================================
interface NewMaintenanceModalProps {
    isOpen: boolean;
    onClose: () => void;
    vehicles: Vehicle[];
    suppliers: FleetSupplier[];
    parts: FleetPart[];
    defaultVehicleId?: string;
    onSubmit: (maintenanceData: any) => Promise<void>;
}

export const NewMaintenanceModal: React.FC<NewMaintenanceModalProps> = ({
    isOpen,
    onClose,
    vehicles,
    suppliers,
    parts,
    defaultVehicleId,
    onSubmit
}) => {
    const [vehicleId, setVehicleId] = useState(defaultVehicleId || (vehicles[0]?.id || ''));
    const [type, setType] = useState<MaintenanceType>('Preventiva');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [km, setKm] = useState<number>(0);
    const [description, setDescription] = useState('');
    const [supplierId, setSupplierId] = useState('');
    const [workshopName, setWorkshopName] = useState('');
    const [responsibleName, setResponsibleName] = useState('');
    const [laborCost, setLaborCost] = useState<number>(0);
    const [periodicityKm, setPeriodicityKm] = useState<number | undefined>(undefined);
    const [periodicityDays, setPeriodicityDays] = useState<number | undefined>(undefined);
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);

    // Peças Utilizadas
    const [partsUsed, setPartsUsed] = useState<Array<{
        part_id?: string;
        part_name: string;
        quantity: number;
        unit_price: number;
        origin: 'Estoque' | 'Compra específica';
        notes?: string;
    }>>([]);

    // Preenche o KM do veículo selecionado
    React.useEffect(() => {
        if (defaultVehicleId) setVehicleId(defaultVehicleId);
    }, [defaultVehicleId]);

    React.useEffect(() => {
        const v = vehicles.find(x => x.id === vehicleId);
        if (v) setKm(Number(v.currentKm) || 0);
    }, [vehicleId, vehicles]);

    if (!isOpen) return null;

    const handleAddPartItem = () => {
        setPartsUsed([...partsUsed, {
            part_id: '',
            part_name: '',
            quantity: 1,
            unit_price: 0,
            origin: 'Estoque'
        }]);
    };

    const handleRemovePartItem = (index: number) => {
        setPartsUsed(partsUsed.filter((_, i) => i !== index));
    };

    const handlePartSelect = (index: number, partId: string) => {
        const p = parts.find(x => x.id === partId);
        const updated = [...partsUsed];
        updated[index] = {
            ...updated[index],
            part_id: partId,
            part_name: p ? p.name : '',
            unit_price: p ? (p.average_cost || p.last_purchase_price || 0) : 0
        };
        setPartsUsed(updated);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            await onSubmit({
                vehicle_id: vehicleId,
                type,
                maintenance_date: date,
                current_km: km,
                description,
                supplier_id: supplierId || undefined,
                workshop_name: workshopName || undefined,
                responsible_name: responsibleName || undefined,
                labor_cost: laborCost,
                periodicity_km: periodicityKm,
                periodicity_days: periodicityDays,
                notes,
                parts_used: partsUsed.filter(p => p.part_name.trim().length > 0)
            });
            onClose();
        } catch (err: any) {
            alert('Erro ao salvar manutenção: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-5 md:p-6 w-full max-w-2xl shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] overflow-y-auto custom-scrollbar">
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
                    <h3 className="text-sm md:text-base font-black text-slate-900 uppercase">
                        Nova Ordem de Manutenção
                    </h3>
                    <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-slate-800 rounded-lg">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="font-black uppercase text-slate-500 block mb-1">Veículo</label>
                            <select
                                required
                                value={vehicleId}
                                onChange={e => setVehicleId(e.target.value)}
                                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900"
                            >
                                {vehicles.map(v => (
                                    <option key={v.id} value={v.id}>{v.plate} - {v.brand} {v.model}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="font-black uppercase text-slate-500 block mb-1">Tipo de Manutenção</label>
                            <select
                                required
                                value={type}
                                onChange={e => setType(e.target.value as any)}
                                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900"
                            >
                                <option value="Preventiva">Preventiva</option>
                                <option value="Corretiva">Corretiva</option>
                                <option value="Óleo">Óleo & Lubrificação</option>
                                <option value="Correia dentada">Correia Dentada</option>
                                <option value="Pneus">Pneus & Alinhamento</option>
                                <option value="Freios">Freios & Pastilhas</option>
                                <option value="Filtros">Filtros (Ar/Combustível/Óleo)</option>
                                <option value="Suspensão">Suspensão & Amortecedores</option>
                                <option value="Revisão">Revisão Periódica Geral</option>
                                <option value="Bateria">Bateria & Elétrica</option>
                                <option value="Outros">Outros</option>
                            </select>
                        </div>

                        <div>
                            <label className="font-black uppercase text-slate-500 block mb-1">Data da Manutenção</label>
                            <input
                                type="date"
                                required
                                value={date}
                                onChange={e => setDate(e.target.value)}
                                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900"
                            />
                        </div>

                        <div>
                            <label className="font-black uppercase text-slate-500 block mb-1">Quilometragem (KM)</label>
                            <input
                                type="number"
                                required
                                value={km}
                                onChange={e => setKm(Number(e.target.value))}
                                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-900"
                            />
                        </div>

                        <div className="sm:col-span-2">
                            <label className="font-black uppercase text-slate-500 block mb-1">Descrição dos Serviços</label>
                            <input
                                type="text"
                                required
                                placeholder="Ex: Substituição de pastilhas de freio dianteiras e sangria do fluido"
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900"
                            />
                        </div>

                        <div>
                            <label className="font-black uppercase text-slate-500 block mb-1">Oficina / Fornecedor</label>
                            <select
                                value={supplierId}
                                onChange={e => {
                                    setSupplierId(e.target.value);
                                    const s = suppliers.find(x => x.id === e.target.value);
                                    if (s) setWorkshopName(s.name);
                                }}
                                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900"
                            >
                                <option value="">Oficina Interna da Prefeitura</option>
                                {suppliers.map(s => (
                                    <option key={s.id} value={s.id}>{s.name} ({s.type})</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="font-black uppercase text-slate-500 block mb-1">Valor da Mão de Obra (R$)</label>
                            <input
                                type="number"
                                step="0.01"
                                value={laborCost}
                                onChange={e => setLaborCost(Number(e.target.value))}
                                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-900"
                            />
                        </div>
                    </div>

                    {/* SEÇÃO DE PEÇAS UTILIZADAS */}
                    <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                        <div className="flex items-center justify-between">
                            <div>
                                <span className="font-black uppercase text-slate-800 text-[11px] block">
                                    Peças Utilizadas & Aplicação
                                </span>
                                <span className="text-[10px] text-slate-500">
                                    Peças com origem 'Estoque' terão baixa automática imediata no saldo
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={handleAddPartItem}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase flex items-center gap-1 cursor-pointer"
                            >
                                <Plus className="w-3 h-3" />
                                <span>Adicionar Peça</span>
                            </button>
                        </div>

                        {partsUsed.map((item, idx) => (
                            <div key={idx} className="p-2.5 bg-white rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-5 gap-2 items-center">
                                <div className="sm:col-span-2">
                                    <select
                                        value={item.part_id}
                                        onChange={e => handlePartSelect(idx, e.target.value)}
                                        className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold"
                                    >
                                        <option value="">Selecionar do Catálogo / Estoque...</option>
                                        {parts.map(p => (
                                            <option key={p.id} value={p.id}>{p.name} (Saldo: {p.current_stock} {p.unit})</option>
                                        ))}
                                    </select>
                                    {!item.part_id && (
                                        <input
                                            type="text"
                                            placeholder="Ou digite o nome da peça..."
                                            value={item.part_name}
                                            onChange={e => {
                                                const updated = [...partsUsed];
                                                updated[idx].part_name = e.target.value;
                                                setPartsUsed(updated);
                                            }}
                                            className="w-full p-1.5 mt-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold"
                                        />
                                    )}
                                </div>

                                <div>
                                    <label className="text-[9px] font-bold text-slate-400 block">Qtd</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={item.quantity}
                                        onChange={e => {
                                            const updated = [...partsUsed];
                                            updated[idx].quantity = Number(e.target.value);
                                            setPartsUsed(updated);
                                        }}
                                        className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-center"
                                    />
                                </div>

                                <div>
                                    <label className="text-[9px] font-bold text-slate-400 block">Valor Unit. (R$)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={item.unit_price}
                                        onChange={e => {
                                            const updated = [...partsUsed];
                                            updated[idx].unit_price = Number(e.target.value);
                                            setPartsUsed(updated);
                                        }}
                                        className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-right font-mono"
                                    />
                                </div>

                                <div className="flex items-center justify-between gap-1">
                                    <select
                                        value={item.origin}
                                        onChange={e => {
                                            const updated = [...partsUsed];
                                            updated[idx].origin = e.target.value as any;
                                            setPartsUsed(updated);
                                        }}
                                        className="p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-black"
                                    >
                                        <option value="Estoque">Estoque</option>
                                        <option value="Compra específica">Compra</option>
                                    </select>

                                    <button
                                        type="button"
                                        onClick={() => handleRemovePartItem(idx)}
                                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-black uppercase"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-black uppercase shadow-md flex items-center gap-1.5 disabled:opacity-50"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            <span>{saving ? 'Gravando...' : 'Concluir Manutenção'}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// =========================================================================
// 3. MODAL DE CADASTRO DE PEÇA
// =========================================================================
interface NewPartModalProps {
    isOpen: boolean;
    onClose: () => void;
    suppliers: FleetSupplier[];
    vehicles: Vehicle[];
    onSubmit: (partData: any) => Promise<void>;
}

export const NewPartModal: React.FC<NewPartModalProps> = ({
    isOpen,
    onClose,
    suppliers,
    vehicles,
    onSubmit
}) => {
    const [name, setName] = useState('');
    const [code, setCode] = useState('');
    const [reference, setReference] = useState('');
    const [category, setCategory] = useState('Motor');
    const [brand, setBrand] = useState('');
    const [unit, setUnit] = useState('UN');
    const [currentStock, setCurrentStock] = useState<number>(0);
    const [minStock, setMinStock] = useState<number>(2);
    const [lastPrice, setLastPrice] = useState<number>(0);
    const [location, setLocation] = useState('');
    const [supplierId, setSupplierId] = useState('');
    const [saving, setSaving] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            await onSubmit({
                name,
                code,
                reference,
                category,
                brand,
                unit,
                current_stock: currentStock,
                min_stock: minStock,
                last_purchase_price: lastPrice,
                average_cost: lastPrice,
                location,
                preferred_supplier_id: supplierId || undefined,
                compatible_vehicles: []
            });
            onClose();
        } catch (err: any) {
            alert('Erro ao cadastrar peça: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-5 md:p-6 w-full max-w-lg shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto custom-scrollbar">
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
                    <h3 className="text-sm md:text-base font-black text-slate-900 uppercase">
                        Cadastrar Peça no Catálogo
                    </h3>
                    <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-slate-800 rounded-lg">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-3 text-xs">
                    <div>
                        <label className="font-black uppercase text-slate-500 block mb-1">Nome da Peça / Item</label>
                        <input
                            type="text"
                            required
                            placeholder="Ex: Filtro de Óleo Motor EA111"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                        <div>
                            <label className="font-black uppercase text-slate-500 block mb-1">Código</label>
                            <input
                                type="text"
                                placeholder="Ex: PSL545"
                                value={code}
                                onChange={e => setCode(e.target.value)}
                                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-900"
                            />
                        </div>
                        <div>
                            <label className="font-black uppercase text-slate-500 block mb-1">Referência Técnica</label>
                            <input
                                type="text"
                                placeholder="Ex: Original / OEM"
                                value={reference}
                                onChange={e => setReference(e.target.value)}
                                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900"
                            />
                        </div>

                        <div>
                            <label className="font-black uppercase text-slate-500 block mb-1">Categoria</label>
                            <select
                                value={category}
                                onChange={e => setCategory(e.target.value)}
                                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900"
                            >
                                <option value="Motor">Motor</option>
                                <option value="Freios">Freios</option>
                                <option value="Suspensão">Suspensão</option>
                                <option value="Filtros">Filtros</option>
                                <option value="Óleos/Fluidos">Óleos & Fluidos</option>
                                <option value="Elétrica">Elétrica & Baterias</option>
                                <option value="Pneus">Pneus</option>
                                <option value="Outros">Outros</option>
                            </select>
                        </div>

                        <div>
                            <label className="font-black uppercase text-slate-500 block mb-1">Unidade</label>
                            <select
                                value={unit}
                                onChange={e => setUnit(e.target.value)}
                                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900"
                            >
                                <option value="UN">Unidade (UN)</option>
                                <option value="LT">Litro (LT)</option>
                                <option value="KG">Quilo (KG)</option>
                                <option value="PAR">Par (PAR)</option>
                                <option value="KIT">Kit (KIT)</option>
                            </select>
                        </div>

                        <div>
                            <label className="font-black uppercase text-slate-500 block mb-1">Estoque Inicial</label>
                            <input
                                type="number"
                                min="0"
                                value={currentStock}
                                onChange={e => setCurrentStock(Number(e.target.value))}
                                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-900"
                            />
                        </div>

                        <div>
                            <label className="font-black uppercase text-slate-500 block mb-1">Estoque Mínimo (Alerta)</label>
                            <input
                                type="number"
                                min="0"
                                value={minStock}
                                onChange={e => setMinStock(Number(e.target.value))}
                                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-900"
                            />
                        </div>

                        <div>
                            <label className="font-black uppercase text-slate-500 block mb-1">Valor Unitário (R$)</label>
                            <input
                                type="number"
                                step="0.01"
                                value={lastPrice}
                                onChange={e => setLastPrice(Number(e.target.value))}
                                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-900"
                            />
                        </div>

                        <div>
                            <label className="font-black uppercase text-slate-500 block mb-1">Localização no Almoxarifado</label>
                            <input
                                type="text"
                                placeholder="Prateleira A-02"
                                value={location}
                                onChange={e => setLocation(e.target.value)}
                                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-black uppercase">
                            Cancelar
                        </button>
                        <button type="submit" disabled={saving} className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-black uppercase shadow-md disabled:opacity-50">
                            {saving ? 'Cadastrando...' : 'Salvar Peça'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// =========================================================================
// 4. MODAL DE CADASTRO E EDIÇÃO DE VEÍCULO
// =========================================================================
interface VehicleFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    editingVehicle?: Vehicle | null;
    sectors: Sector[];
    persons: Person[];
    brands?: Brand[];
    onSave: (vehicleData: Partial<Vehicle>) => Promise<void>;
}

export const VehicleFormModal: React.FC<VehicleFormModalProps> = ({
    isOpen,
    onClose,
    editingVehicle,
    sectors,
    persons,
    brands = [],
    onSave
}) => {
    const [activeTab, setActiveTab] = useState<'geral' | 'lotacao' | 'manutencao'>('geral');
    
    // Form fields
    const [model, setModel] = useState('');
    const [brand, setBrand] = useState('');
    const [plate, setPlate] = useState('');
    const [type, setType] = useState<Vehicle['type']>('leve');
    const [vehicleCategory, setVehicleCategory] = useState<NonNullable<Vehicle['vehicleCategory']>>('Carro');
    const [year, setYear] = useState('');
    const [color, setColor] = useState('');
    const [renavam, setRenavam] = useState('');
    const [chassis, setChassis] = useState('');
    const [sectorId, setSectorId] = useState('');
    const [responsiblePersonId, setResponsiblePersonId] = useState('');
    const [status, setStatus] = useState<Vehicle['status']>('operacional');
    const [maintenanceStatus, setMaintenanceStatus] = useState<Vehicle['maintenanceStatus']>('em_dia');
    const [availableForScheduling, setAvailableForScheduling] = useState<'Sim' | 'Não'>('Sim');
    const [passengerCapacity, setPassengerCapacity] = useState<number>(5);
    const [currentKm, setCurrentKm] = useState<number>(0);
    const [oilCalculationBase, setOilCalculationBase] = useState<number>(5000);
    const [timingBeltCalculationBase, setTimingBeltCalculationBase] = useState<number>(50000);
    const [vehicleImageUrl, setVehicleImageUrl] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (editingVehicle) {
            setModel(editingVehicle.model || '');
            setBrand(editingVehicle.brand || '');
            setPlate(editingVehicle.plate || '');
            setType(editingVehicle.type || 'leve');
            setVehicleCategory(editingVehicle.vehicleCategory || (editingVehicle.type === 'pesado' ? 'Caminhão' : 'Carro'));
            setYear(editingVehicle.year || '');
            setColor(editingVehicle.color || '');
            setRenavam(editingVehicle.renavam || '');
            setChassis(editingVehicle.chassis || '');
            setSectorId(editingVehicle.sectorId || '');
            setResponsiblePersonId(editingVehicle.responsiblePersonId || '');
            setStatus(editingVehicle.status || 'operacional');
            setMaintenanceStatus(editingVehicle.maintenanceStatus || 'em_dia');
            setAvailableForScheduling(editingVehicle.availableForScheduling || 'Sim');
            setPassengerCapacity(editingVehicle.passengerCapacity !== undefined ? editingVehicle.passengerCapacity : 5);
            setCurrentKm(editingVehicle.currentKm || 0);
            setOilCalculationBase(editingVehicle.oilCalculationBase || 5000);
            setTimingBeltCalculationBase(editingVehicle.timingBeltCalculationBase || 50000);
            setVehicleImageUrl(editingVehicle.vehicleImageUrl || '');
        } else {
            setModel('');
            setBrand('');
            setPlate('');
            setType('leve');
            setVehicleCategory('Carro');
            setYear('');
            setColor('');
            setRenavam('');
            setChassis('');
            setSectorId(sectors[0]?.id || '');
            setResponsiblePersonId('');
            setStatus('operacional');
            setMaintenanceStatus('em_dia');
            setAvailableForScheduling('Sim');
            setPassengerCapacity(5);
            setCurrentKm(0);
            setOilCalculationBase(5000);
            setTimingBeltCalculationBase(50000);
            setVehicleImageUrl('');
        }
        setActiveTab('geral');
    }, [editingVehicle, isOpen, sectors]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!model.trim() || !plate.trim()) {
            alert('Por favor, informe ao menos o Modelo e a Placa do veículo.');
            return;
        }

        setSaving(true);
        try {
            const formattedPlate = plate.trim().toUpperCase();
            await onSave({
                ...(editingVehicle ? { id: editingVehicle.id } : {}),
                model: model.trim(),
                brand: brand.trim(),
                plate: formattedPlate,
                type,
                vehicleCategory,
                year: year.trim(),
                color: color.trim(),
                renavam: renavam.trim(),
                chassis: chassis.trim(),
                sectorId: sectorId || undefined,
                responsiblePersonId: responsiblePersonId || undefined,
                status,
                maintenanceStatus,
                availableForScheduling,
                passengerCapacity: Number(passengerCapacity) || 5,
                currentKm: Number(currentKm) || 0,
                oilCalculationBase: oilCalculationBase as any,
                timingBeltCalculationBase: timingBeltCalculationBase as any,
                vehicleImageUrl: vehicleImageUrl.trim() || undefined
            });
            onClose();
        } catch (err: any) {
            alert('Erro ao salvar veículo: ' + (err.message || 'Erro desconhecido'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-5 md:p-6 w-full max-w-2xl shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] overflow-y-auto custom-scrollbar flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-white flex items-center justify-center shadow-md shadow-amber-500/25">
                            <Car className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-sm md:text-base font-black text-slate-900 uppercase">
                                {editingVehicle ? `Editar Veículo: ${editingVehicle.model}` : 'Cadastrar Novo Veículo'}
                            </h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                {editingVehicle ? `Placa: ${editingVehicle.plate}` : 'Catálogo da Frota Municipal'}
                            </p>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Abas */}
                <div className="flex items-center gap-1.5 border-b border-slate-100 my-4 pb-2">
                    <button
                        type="button"
                        onClick={() => setActiveTab('geral')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                            activeTab === 'geral' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-500 hover:bg-slate-100'
                        }`}
                    >
                        Dados Principais
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('lotacao')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                            activeTab === 'lotacao' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-500 hover:bg-slate-100'
                        }`}
                    >
                        Lotação & Vínculos
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('manutencao')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                            activeTab === 'manutencao' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-500 hover:bg-slate-100'
                        }`}
                    >
                        KM & Manutenção
                    </button>
                </div>

                {/* Formulário */}
                <form onSubmit={handleSubmit} className="space-y-4 text-xs flex-1">
                    {/* ABA 1: DADOS PRINCIPAIS */}
                    {activeTab === 'geral' && (
                        <div className="space-y-3 animate-in fade-in duration-150">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="font-black uppercase text-slate-600 block mb-1">Modelo do Veículo *</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Ex: SPIN 1.8, HB20, VAN MASTER..."
                                        value={model}
                                        onChange={e => setModel(e.target.value)}
                                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:bg-white focus:border-amber-500"
                                    />
                                </div>

                                <div>
                                    <label className="font-black uppercase text-slate-600 block mb-1">Marca / Fabricante</label>
                                    <input
                                        type="text"
                                        list="brands-list"
                                        placeholder="Ex: CHEVROLET, FIAT, RENAULT..."
                                        value={brand}
                                        onChange={e => setBrand(e.target.value.toUpperCase())}
                                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 uppercase focus:bg-white focus:border-amber-500"
                                    />
                                    <datalist id="brands-list">
                                        {brands.map(b => (
                                            <option key={b.id} value={b.name} />
                                        ))}
                                    </datalist>
                                </div>

                                <div>
                                    <label className="font-black uppercase text-slate-600 block mb-1">Placa do Veículo *</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Ex: ABC1D23"
                                        value={plate}
                                        onChange={e => setPlate(e.target.value.toUpperCase())}
                                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono font-black text-slate-900 uppercase tracking-widest focus:bg-white focus:border-amber-500"
                                    />
                                </div>

                                <div>
                                    <label className="font-black uppercase text-slate-600 block mb-1">Tipo de Veículo *</label>
                                    <select
                                        value={type}
                                        onChange={e => setType(e.target.value as any)}
                                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900"
                                    >
                                        <option value="leve">Leve (Carro, Moto, Van, Utilitário)</option>
                                        <option value="pesado">Pesado (Ônibus, Caminhão, Trator, Máquina)</option>
                                        <option value="acessorio">Acessório (Implemento, Roçadeira, etc.)</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="font-black uppercase text-slate-600 block mb-1">Categoria Visual</label>
                                    <select
                                        value={vehicleCategory}
                                        onChange={e => setVehicleCategory(e.target.value as any)}
                                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900"
                                    >
                                        <option value="Carro">Carro de Passeio</option>
                                        <option value="Van">Van</option>
                                        <option value="Ônibus">Ônibus / Micro-ônibus</option>
                                        <option value="Moto">Moto</option>
                                        <option value="Caminhão">Caminhão</option>
                                        <option value="Máquina Pesada">Máquina Pesada / Trator</option>
                                        <option value="Acessórios">Acessório / Equipamento</option>
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="font-black uppercase text-slate-600 block mb-1">Ano</label>
                                        <input
                                            type="text"
                                            placeholder="Ex: 2023/2024"
                                            value={year}
                                            onChange={e => setYear(e.target.value)}
                                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 text-center"
                                        />
                                    </div>
                                    <div>
                                        <label className="font-black uppercase text-slate-600 block mb-1">Cor</label>
                                        <input
                                            type="text"
                                            placeholder="Ex: BRANCO"
                                            value={color}
                                            onChange={e => setColor(e.target.value.toUpperCase())}
                                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 text-center uppercase"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ABA 2: LOTAÇÃO & VÍNCULOS */}
                    {activeTab === 'lotacao' && (
                        <div className="space-y-3 animate-in fade-in duration-150">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="font-black uppercase text-slate-600 block mb-1">
                                        Capacidade de Passageiros (Assentos)
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="100"
                                        value={passengerCapacity}
                                        onChange={e => setPassengerCapacity(Number(e.target.value))}
                                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono font-black text-indigo-900 text-center text-sm"
                                    />
                                    <span className="text-[10px] text-slate-400 font-medium block mt-1">
                                        Para vans/ônibus, defina o número total de assentos de passageiros.
                                    </span>
                                </div>

                                <div>
                                    <label className="font-black uppercase text-slate-600 block mb-1">
                                        Disponível para Agendamento de Viagem?
                                    </label>
                                    <select
                                        value={availableForScheduling}
                                        onChange={e => setAvailableForScheduling(e.target.value as any)}
                                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900"
                                    >
                                        <option value="Sim">Sim (Aparece no módulo de Agendamentos)</option>
                                        <option value="Não">Não (Uso interno exclusivo / Não agendável)</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="font-black uppercase text-slate-600 block mb-1">Setor / Secretaria Vinculada</label>
                                    <select
                                        value={sectorId}
                                        onChange={e => setSectorId(e.target.value)}
                                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900"
                                    >
                                        <option value="">Sem setor fixo / Geral</option>
                                        {sectors.map(s => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="font-black uppercase text-slate-600 block mb-1">Motorista / Responsável Operacional</label>
                                    <select
                                        value={responsiblePersonId}
                                        onChange={e => setResponsiblePersonId(e.target.value)}
                                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900"
                                    >
                                        <option value="">Nenhum responsável atribuído</option>
                                        {persons.map(p => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="font-black uppercase text-slate-600 block mb-1">Código RENAVAM</label>
                                    <input
                                        type="text"
                                        placeholder="Número do RENAVAM"
                                        value={renavam}
                                        onChange={e => setRenavam(e.target.value)}
                                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-900"
                                    />
                                </div>

                                <div>
                                    <label className="font-black uppercase text-slate-600 block mb-1">Número do Chassi</label>
                                    <input
                                        type="text"
                                        placeholder="Número do Chassi"
                                        value={chassis}
                                        onChange={e => setChassis(e.target.value.toUpperCase())}
                                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-900 uppercase"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ABA 3: KM & MANUTENÇÃO */}
                    {activeTab === 'manutencao' && (
                        <div className="space-y-3 animate-in fade-in duration-150">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="font-black uppercase text-slate-600 block mb-1">Odômetro Atual (KM)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={currentKm}
                                        onChange={e => setCurrentKm(Number(e.target.value))}
                                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-indigo-900"
                                    />
                                </div>

                                <div>
                                    <label className="font-black uppercase text-slate-600 block mb-1">Status Operacional</label>
                                    <select
                                        value={status}
                                        onChange={e => setStatus(e.target.value as any)}
                                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900"
                                    >
                                        <option value="operacional">Operacional (Em circulação)</option>
                                        <option value="manutencao">Em Manutenção / Oficina</option>
                                        <option value="inativo">Inativo / Baixado</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="font-black uppercase text-slate-600 block mb-1">Status de Manutenção</label>
                                    <select
                                        value={maintenanceStatus}
                                        onChange={e => setMaintenanceStatus(e.target.value as any)}
                                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900"
                                    >
                                        <option value="em_dia">Em Dia</option>
                                        <option value="andamento">Em Andamento</option>
                                        <option value="vencido">Vencido / Pendente</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="font-black uppercase text-slate-600 block mb-1">Intervalo Troca de Óleo</label>
                                    <select
                                        value={oilCalculationBase}
                                        onChange={e => setOilCalculationBase(Number(e.target.value))}
                                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900"
                                    >
                                        <option value={1000}>A cada 1.000 km (Motos)</option>
                                        <option value={3000}>A cada 3.000 km</option>
                                        <option value={5000}>A cada 5.000 km (Padrão)</option>
                                        <option value={7000}>A cada 7.000 km</option>
                                        <option value={10000}>A cada 10.000 km (Sintético)</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="font-black uppercase text-slate-600 block mb-1">Intervalo Correia Dentada</label>
                                    <select
                                        value={timingBeltCalculationBase}
                                        onChange={e => setTimingBeltCalculationBase(Number(e.target.value))}
                                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900"
                                    >
                                        <option value={40000}>A cada 40.000 km</option>
                                        <option value={50000}>A cada 50.000 km (Padrão)</option>
                                        <option value={60000}>A cada 60.000 km</option>
                                        <option value={80000}>A cada 80.000 km</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="font-black uppercase text-slate-600 block mb-1">URL da Imagem / Foto (Opcional)</label>
                                    <input
                                        type="url"
                                        placeholder="https://exemplo.com/foto.jpg"
                                        value={vehicleImageUrl}
                                        onChange={e => setVehicleImageUrl(e.target.value)}
                                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Rodapé com Ações */}
                    <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-black uppercase tracking-wider cursor-pointer"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl font-black uppercase tracking-wider shadow-md shadow-amber-500/25 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            <span>{saving ? 'Gravando...' : (editingVehicle ? 'Atualizar Veículo' : 'Cadastrar Veículo')}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
