import React, { useState, useEffect, useRef } from 'react';
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
    Truck,
    Image as ImageIcon,
    Upload,
    Camera
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
    existingVehicles?: Vehicle[];
    sectors: Sector[];
    persons: Person[];
    brands?: Brand[];
    onSave: (vehicleData: Partial<Vehicle>) => Promise<void>;
}

export const VehicleFormModal: React.FC<VehicleFormModalProps> = ({
    isOpen,
    onClose,
    editingVehicle,
    existingVehicles = [],
    sectors,
    persons,
    brands = [],
    onSave
}) => {
    const [activeTab, setActiveTab] = useState<'geral' | 'lotacao' | 'imagem'>('geral');
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    
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

    // Função utilitária para normalizar placas
    const normalizePlate = (p?: string): string => {
        return (p || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    };

    // Verificação de placa conflitante em tempo real
    const cleanCurrentPlate = normalizePlate(plate);
    const conflictingVehicle = cleanCurrentPlate.length >= 2 
        ? existingVehicles.find(v => {
            if (editingVehicle && v.id === editingVehicle.id) return false;
            return normalizePlate(v.plate) === cleanCurrentPlate;
        })
        : undefined;

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

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (!file.type.startsWith('image/')) {
                alert('Por favor, selecione um arquivo de imagem válido (PNG, JPG, JPEG, WEBP).');
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                setVehicleImageUrl(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleRemoveImage = () => {
        setVehicleImageUrl('');
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!model.trim() || !plate.trim()) {
            alert('Por favor, informe ao menos o Modelo e a Placa do veículo.');
            return;
        }

        // Validação obrigatória de placa única
        const normalizedSubmittedPlate = normalizePlate(plate);
        const duplicate = existingVehicles.find(v => {
            if (editingVehicle && v.id === editingVehicle.id) return false;
            return normalizePlate(v.plate) === normalizedSubmittedPlate;
        });

        if (duplicate) {
            alert(`A placa "${plate.trim().toUpperCase()}" já está cadastrada no veículo "${duplicate.model}" (${duplicate.brand || 'Frota'}) - Placa: ${duplicate.plate}.\n\nNão é permitido cadastrar a mesma placa em mais de um cadastro.`);
            setActiveTab('geral');
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
                chassis: chassis.trim().toUpperCase(),
                sectorId: sectorId || undefined,
                responsiblePersonId: responsiblePersonId || undefined,
                status,
                maintenanceStatus: editingVehicle?.maintenanceStatus || maintenanceStatus,
                availableForScheduling,
                passengerCapacity: Number(passengerCapacity) || 5,
                currentKm: Number(currentKm) || editingVehicle?.currentKm || 0,
                oilCalculationBase: (oilCalculationBase as any) || editingVehicle?.oilCalculationBase || 5000,
                timingBeltCalculationBase: (timingBeltCalculationBase as any) || editingVehicle?.timingBeltCalculationBase || 50000,
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
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 md:p-6 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl w-full max-w-4xl lg:max-w-5xl shadow-2xl border border-slate-200/90 max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header Premium */}
                <div className="px-6 py-4 md:px-8 md:py-5 border-b border-slate-100 bg-gradient-to-r from-slate-50/80 via-white to-orange-50/40 flex items-center justify-between gap-4 shrink-0">
                    <div className="flex items-center gap-3.5">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 via-orange-500 to-amber-600 text-white flex items-center justify-center shadow-lg shadow-orange-500/25 shrink-0">
                            <Car className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                                    {editingVehicle ? `Editar Veículo: ${editingVehicle.model}` : 'Cadastrar Novo Veículo'}
                                </h3>
                                {editingVehicle && (
                                    <span className="px-2.5 py-0.5 rounded-lg bg-orange-100 text-orange-700 font-mono font-black text-[11px] uppercase tracking-wider">
                                        {editingVehicle.plate}
                                    </span>
                                )}
                            </div>
                            <p className="text-xs font-semibold text-slate-400 mt-0.5">
                                {editingVehicle ? 'Atualize as informações cadastrais e vinculações do veículo' : 'Catálogo Oficial da Frota Municipal'}
                            </p>
                        </div>
                    </div>

                    <button 
                        type="button" 
                        onClick={onClose} 
                        className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-all cursor-pointer shrink-0"
                        title="Fechar"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Abas Modernas (Segmented Control) */}
                <div className="px-6 md:px-8 pt-4 pb-2 bg-white border-b border-slate-100 shrink-0">
                    <div className="inline-flex p-1 bg-slate-100/90 rounded-2xl gap-1 border border-slate-200/70 overflow-x-auto max-w-full">
                        <button
                            type="button"
                            onClick={() => setActiveTab('geral')}
                            className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                                activeTab === 'geral' 
                                    ? 'bg-slate-900 text-white shadow-sm' 
                                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                            }`}
                        >
                            <Car className="w-4 h-4" />
                            <span>Dados Principais</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('lotacao')}
                            className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                                activeTab === 'lotacao' 
                                    ? 'bg-slate-900 text-white shadow-sm' 
                                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                            }`}
                        >
                            <Building2 className="w-4 h-4" />
                            <span>Lotação & Vínculos</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('imagem')}
                            className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                                activeTab === 'imagem' 
                                    ? 'bg-slate-900 text-white shadow-sm' 
                                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                            }`}
                        >
                            <ImageIcon className="w-4 h-4" />
                            <span>Imagem do Veículo</span>
                            {vehicleImageUrl && (
                                <span className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white"></span>
                            )}
                        </button>
                    </div>
                </div>

                {/* Formulário com Scroll Interno */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto custom-scrollbar px-6 md:px-8 py-5 flex flex-col justify-between">
                    <div>
                        {/* ========================================================================= */}
                        {/* ABA 1: DADOS PRINCIPAIS */}
                        {/* ========================================================================= */}
                        {activeTab === 'geral' && (
                            <div className="space-y-5 animate-in fade-in duration-150">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
                                    {/* Modelo do Veículo */}
                                    <div className="space-y-1.5 md:col-span-2 lg:col-span-1">
                                        <label className="text-[11px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1">
                                            Modelo do Veículo <span className="text-orange-600">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="Ex: SPIN 1.8, HB20, VAN MASTER..."
                                            value={model}
                                            onChange={e => setModel(e.target.value)}
                                            className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-2xl font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all outline-none text-sm"
                                        />
                                    </div>

                                    {/* Marca / Fabricante */}
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-black uppercase tracking-wider text-slate-700">
                                            Marca / Fabricante
                                        </label>
                                        <input
                                            type="text"
                                            list="brands-list"
                                            placeholder="Ex: CHEVROLET, FIAT, RENAULT..."
                                            value={brand}
                                            onChange={e => setBrand(e.target.value.toUpperCase())}
                                            className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-2xl font-bold text-slate-900 uppercase placeholder:text-slate-400 placeholder:font-normal placeholder:normal-case focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all outline-none text-sm"
                                        />
                                        <datalist id="brands-list">
                                            {brands.map(b => (
                                                <option key={b.id} value={b.name} />
                                            ))}
                                            <option value="CHEVROLET" />
                                            <option value="FIAT" />
                                            <option value="VOLKSWAGEN" />
                                            <option value="RENAULT" />
                                            <option value="TOYOTA" />
                                            <option value="FORD" />
                                            <option value="HYUNDAI" />
                                            <option value="MERCEDES-BENZ" />
                                            <option value="IVECO" />
                                            <option value="HONDA" />
                                            <option value="YAMAHA" />
                                        </datalist>
                                    </div>

                                    {/* Placa do Veículo */}
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <label className="text-[11px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1">
                                                Placa do Veículo <span className="text-orange-600">*</span>
                                            </label>
                                            {conflictingVehicle && (
                                                <span className="text-[10px] font-extrabold text-rose-600 uppercase tracking-tight flex items-center gap-1">
                                                    <AlertTriangle className="w-3 h-3" />
                                                    Placa já em uso
                                                </span>
                                            )}
                                        </div>
                                        <input
                                            type="text"
                                            required
                                            maxLength={8}
                                            placeholder="Ex: ABC1D23"
                                            value={plate}
                                            onChange={e => setPlate(e.target.value.toUpperCase())}
                                            className={`w-full px-4 py-3 rounded-2xl font-mono font-black uppercase tracking-widest placeholder:tracking-normal placeholder:font-normal placeholder:text-slate-400 focus:bg-white transition-all outline-none text-sm ${
                                                conflictingVehicle 
                                                    ? 'bg-rose-50/60 border-2 border-rose-500 text-rose-900 focus:border-rose-600 focus:ring-4 focus:ring-rose-500/20' 
                                                    : 'bg-slate-50 hover:bg-slate-100/70 border border-slate-200 text-slate-900 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10'
                                            }`}
                                        />
                                        {conflictingVehicle && (
                                            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold flex items-start gap-2 animate-in fade-in">
                                                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                                                <div className="text-[11px] leading-tight">
                                                    Esta placa já está cadastrada para o veículo <strong>{conflictingVehicle.model}</strong> ({conflictingVehicle.brand || 'Frota'}) — <strong>{conflictingVehicle.plate}</strong>.
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Tipo de Veículo */}
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1">
                                            Tipo de Veículo <span className="text-orange-600">*</span>
                                        </label>
                                        <select
                                            value={type}
                                            onChange={e => setType(e.target.value as any)}
                                            className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-2xl font-bold text-slate-900 focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all outline-none text-sm cursor-pointer"
                                        >
                                            <option value="leve">Leve (Carro, Moto, Van, Utilitário)</option>
                                            <option value="pesado">Pesado (Ônibus, Caminhão, Trator, Máquina)</option>
                                            <option value="acessorio">Acessório (Implemento, Roçadeira, etc.)</option>
                                        </select>
                                    </div>

                                    {/* Categoria Visual */}
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-black uppercase tracking-wider text-slate-700">
                                            Categoria Visual
                                        </label>
                                        <select
                                            value={vehicleCategory}
                                            onChange={e => setVehicleCategory(e.target.value as any)}
                                            className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-2xl font-bold text-slate-900 focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all outline-none text-sm cursor-pointer"
                                        >
                                            <option value="Carro">Carro de Passeio</option>
                                            <option value="Van">Van</option>
                                            <option value="Ônibus">Ônibus / Micro-ônibus</option>
                                            <option value="Moto">Motocicleta</option>
                                            <option value="Caminhão">Caminhão</option>
                                            <option value="Máquina Pesada">Máquina Pesada / Trator</option>
                                            <option value="Acessórios">Acessório / Equipamento</option>
                                        </select>
                                    </div>

                                    {/* Ano e Cor */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-black uppercase tracking-wider text-slate-700">
                                                Ano
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="Ex: 2023/2024"
                                                value={year}
                                                onChange={e => setYear(e.target.value)}
                                                className="w-full px-3 py-3 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-2xl font-bold text-slate-900 text-center placeholder:text-slate-400 placeholder:font-normal focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all outline-none text-sm"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-black uppercase tracking-wider text-slate-700">
                                                Cor
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="Ex: BRANCO"
                                                value={color}
                                                onChange={e => setColor(e.target.value.toUpperCase())}
                                                className="w-full px-3 py-3 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-2xl font-bold text-slate-900 text-center uppercase placeholder:text-slate-400 placeholder:font-normal placeholder:normal-case focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all outline-none text-sm"
                                            />
                                        </div>
                                    </div>

                                    {/* Código RENAVAM */}
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-black uppercase tracking-wider text-slate-700 flex items-center justify-between">
                                            <span>Código RENAVAM</span>
                                            <span className="text-[10px] text-slate-400 font-medium">Documento</span>
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="Número do RENAVAM"
                                            value={renavam}
                                            onChange={e => setRenavam(e.target.value)}
                                            className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-2xl font-mono font-bold text-slate-900 tracking-wider placeholder:tracking-normal placeholder:text-slate-400 placeholder:font-normal focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all outline-none text-sm"
                                        />
                                    </div>

                                    {/* Número do Chassi */}
                                    <div className="space-y-1.5 md:col-span-2">
                                        <label className="text-[11px] font-black uppercase tracking-wider text-slate-700 flex items-center justify-between">
                                            <span>Número do Chassi</span>
                                            <span className="text-[10px] text-slate-400 font-medium">Identificação VIN</span>
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="Número do Chassi"
                                            value={chassis}
                                            onChange={e => setChassis(e.target.value.toUpperCase())}
                                            className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-2xl font-mono font-bold text-slate-900 uppercase tracking-widest placeholder:tracking-normal placeholder:text-slate-400 placeholder:font-normal focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all outline-none text-sm"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ========================================================================= */}
                        {/* ABA 2: LOTAÇÃO & VÍNCULOS */}
                        {/* ========================================================================= */}
                        {activeTab === 'lotacao' && (
                            <div className="space-y-5 animate-in fade-in duration-150">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
                                    {/* Capacidade de Passageiros */}
                                    <div className="space-y-1.5 p-4 rounded-2xl bg-amber-50/60 border border-amber-200/70">
                                        <label className="text-[11px] font-black uppercase tracking-wider text-amber-950 flex items-center justify-between">
                                            <span>Capacidade de Passageiros (Assentos) <span className="text-orange-600">*</span></span>
                                        </label>
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="number"
                                                min="1"
                                                max="100"
                                                required
                                                value={passengerCapacity}
                                                onChange={e => setPassengerCapacity(Number(e.target.value))}
                                                className="w-28 px-4 py-3 bg-white border border-amber-300 rounded-2xl font-mono font-black text-amber-950 text-center text-base focus:border-amber-600 focus:ring-4 focus:ring-amber-500/20 outline-none transition-all shadow-xs"
                                            />
                                            <span className="text-xs text-amber-900/80 font-medium leading-relaxed">
                                                Para vans e ônibus, define a quantidade de assentos disponíveis no agendamento de viagens.
                                            </span>
                                        </div>
                                    </div>

                                    {/* Disponibilidade para Agendamentos */}
                                    <div className="space-y-1.5 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                                        <label className="text-[11px] font-black uppercase tracking-wider text-slate-700 block">
                                            Disponível para Agendamento de Viagem?
                                        </label>
                                        <select
                                            value={availableForScheduling}
                                            onChange={e => setAvailableForScheduling(e.target.value as any)}
                                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl font-bold text-slate-900 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all outline-none text-sm cursor-pointer"
                                        >
                                            <option value="Sim">Sim (Aparece no módulo de Agendamentos)</option>
                                            <option value="Não">Não (Uso interno exclusivo / Não agendável)</option>
                                        </select>
                                    </div>

                                    {/* Setor / Secretaria Vinculada */}
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-black uppercase tracking-wider text-slate-700">
                                            Setor / Secretaria Vinculada
                                        </label>
                                        <select
                                            value={sectorId}
                                            onChange={e => setSectorId(e.target.value)}
                                            className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-2xl font-bold text-slate-900 focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all outline-none text-sm cursor-pointer"
                                        >
                                            <option value="">Sem setor fixo / Pool Geral</option>
                                            {sectors.map(s => (
                                                <option key={s.id} value={s.id}>{s.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Motorista / Responsável Operacional */}
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-black uppercase tracking-wider text-slate-700">
                                            Motorista / Responsável Operacional
                                        </label>
                                        <select
                                            value={responsiblePersonId}
                                            onChange={e => setResponsiblePersonId(e.target.value)}
                                            className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-2xl font-bold text-slate-900 focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all outline-none text-sm cursor-pointer"
                                        >
                                            <option value="">Nenhum motorista fixo / Atribuição livre</option>
                                            {persons.map(p => (
                                                <option key={p.id} value={p.id}>{p.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Status Operacional */}
                                    <div className="space-y-1.5 md:col-span-2">
                                        <label className="text-[11px] font-black uppercase tracking-wider text-slate-700">
                                            Status Operacional
                                        </label>
                                        <select
                                            value={status}
                                            onChange={e => setStatus(e.target.value as any)}
                                            className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-2xl font-bold text-slate-900 focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all outline-none text-sm cursor-pointer"
                                        >
                                            <option value="operacional">Operacional (Em circulação regular)</option>
                                            <option value="manutencao">Em Manutenção / Oficina</option>
                                            <option value="inativo">Inativo / Baixado</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ========================================================================= */}
                        {/* ABA 3: IMAGEM DO VEÍCULO */}
                        {/* ========================================================================= */}
                        {activeTab === 'imagem' && (
                            <div className="space-y-5 animate-in fade-in duration-150">
                                {/* Input oculto de arquivo */}
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    accept="image/*"
                                    onChange={handleFileUpload}
                                    className="hidden"
                                />

                                {vehicleImageUrl ? (
                                    /* Card de Preview da Foto Carregada */
                                    <div className="bg-slate-50/80 rounded-3xl border border-slate-200 p-5 md:p-6 space-y-4">
                                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center">
                                                    <CheckCircle2 className="w-4 h-4" />
                                                </div>
                                                <div>
                                                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                                                        Foto do Veículo Carregada
                                                    </h4>
                                                    <p className="text-[11px] text-slate-500 font-medium">
                                                        Esta foto será exibida nos cards da frota e no módulo de agendamento.
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 w-full sm:w-auto">
                                                <button
                                                    type="button"
                                                    onClick={() => fileInputRef.current?.click()}
                                                    className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
                                                >
                                                    <Upload className="w-3.5 h-3.5 text-amber-600" />
                                                    <span>Trocar Foto</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={handleRemoveImage}
                                                    className="px-3 py-2 rounded-xl bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-600 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                                                    title="Remover foto atual"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                    <span className="hidden sm:inline">Remover</span>
                                                </button>
                                            </div>
                                        </div>

                                        {/* Imagem Centralizada com Aspect Ratio Moderno */}
                                        <div className="relative rounded-2xl overflow-hidden border border-slate-200/80 bg-slate-900/5 max-h-[300px] flex items-center justify-center group shadow-inner">
                                            <img
                                                src={vehicleImageUrl}
                                                alt="Foto do veículo"
                                                className="w-full h-full object-contain max-h-[280px] rounded-2xl transition-transform duration-300 group-hover:scale-101"
                                                onError={(e) => {
                                                    (e.currentTarget as HTMLImageElement).src = 'https://placehold.co/600x400/f1f5f9/94a3b8?text=Erro+ao+Carregar+Imagem';
                                                }}
                                            />
                                        </div>

                                        {/* Campo Opcional de Link Externo */}
                                        <div className="pt-2">
                                            <label className="text-[11px] font-black uppercase tracking-wider text-slate-600 block mb-1">
                                                Ou edite a URL da foto diretamente:
                                            </label>
                                            <input
                                                type="url"
                                                placeholder="https://exemplo.com/foto.jpg ou data:image/..."
                                                value={vehicleImageUrl}
                                                onChange={e => setVehicleImageUrl(e.target.value)}
                                                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl font-mono text-xs text-slate-700 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none transition-all"
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    /* Banner Interativo de Upload quando NÃO há foto */
                                    <div className="space-y-4">
                                        <div 
                                            onClick={() => fileInputRef.current?.click()}
                                            className="border-2 border-dashed border-amber-300 hover:border-amber-500 bg-gradient-to-b from-amber-50/40 via-orange-50/20 to-white hover:bg-amber-50/60 rounded-3xl p-8 md:p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-all group"
                                        >
                                            <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/30 group-hover:scale-105 transition-transform mb-4">
                                                <Upload className="w-8 h-8" />
                                            </div>

                                            <h4 className="text-base font-black text-slate-900 tracking-tight mb-1">
                                                Enviar Foto do Veículo
                                            </h4>
                                            <p className="text-xs text-slate-500 font-medium max-w-md mb-5">
                                                Clique no botão abaixo ou nesta área para selecionar uma imagem do seu computador ou celular.
                                            </p>

                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    fileInputRef.current?.click();
                                                }}
                                                className="px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-black text-xs uppercase tracking-wider shadow-md shadow-orange-500/25 flex items-center gap-2 group-hover:shadow-lg transition-all cursor-pointer"
                                            >
                                                <Camera className="w-4 h-4" />
                                                <span>Fazer Upload da Imagem</span>
                                            </button>

                                            <div className="mt-4 flex items-center gap-3 text-[11px] text-slate-400 font-semibold">
                                                <span>PNG</span>
                                                <span>•</span>
                                                <span>JPG</span>
                                                <span>•</span>
                                                <span>JPEG</span>
                                                <span>•</span>
                                                <span>WEBP</span>
                                            </div>
                                        </div>

                                        {/* Opção Alternativa: Inserir Link Direto */}
                                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
                                            <label className="text-[11px] font-black uppercase tracking-wider text-slate-700 block mb-1.5">
                                                Ou cole o link direto de uma imagem na Web:
                                            </label>
                                            <input
                                                type="url"
                                                placeholder="https://exemplo.com/foto-do-veiculo.jpg"
                                                value={vehicleImageUrl}
                                                onChange={e => setVehicleImageUrl(e.target.value)}
                                                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none transition-all"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Rodapé com Ações */}
                    <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 pt-6 mt-6 border-t border-slate-100 shrink-0">
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-full sm:w-auto px-6 py-3 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 rounded-2xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer text-center"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg shadow-orange-500/25 hover:shadow-orange-500/35 active:scale-98 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
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
