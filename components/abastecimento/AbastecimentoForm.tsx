import React, { useState, useEffect, useMemo } from 'react';
import { Fuel, User, Truck, DollarSign, Save, X, MapPin, FileText, Clock } from 'lucide-react';
import { AbastecimentoService, AbastecimentoRecord } from '../../services/abastecimentoService';
import { useAuth } from '../../contexts/AuthContext';
import { Vehicle, Person } from '../../types';
import { CustomSelect, Option } from '../common/CustomSelect';
import { parseFormattedNumber, formatNumberInput } from '../../utils/numberUtils';

import { CustomDateTimeInput } from '../common/CustomDateTimeInput';
import { AbastecimentoConfirmationModal } from '../modals/AbastecimentoConfirmationModal';
import { getLocalISOData } from '../../utils/dateUtils';

interface AbastecimentoFormProps {
    onBack: () => void;
    onSave: (data: any) => void;
    vehicles: Vehicle[];
    persons: Person[];
    gasStations: { id: string, name: string, city: string, fuel_prices?: any }[]; // Updated type
    fuelTypes: { key: string; label: string; price: number }[];
    initialData?: AbastecimentoRecord;
}

import { useCachedVehicles } from '../../hooks/useCachedVehicles';
import { useCachedPersons } from '../../hooks/useCachedPersons';
import { useCachedFuelTypes } from '../../hooks/useCachedFuelTypes';

export const AbastecimentoForm: React.FC<AbastecimentoFormProps> = ({ onBack, onSave, vehicles: initialVehicles, persons: initialPersons, gasStations, fuelTypes: initialFuelTypes, initialData }) => {
    const { user: authUser } = useAuth();
    // Use cached data for optimized loading
    // Use query objects for robust loading and sync
    const { data: vehiclesData, isLoading: isLoadingVehicles, refetch: refetchVehicles } = useCachedVehicles(initialVehicles);
    const { data: personsData, isLoading: isLoadingPersons, refetch: refetchPersons } = useCachedPersons(initialPersons);
    const { data: fuelTypesData, isLoading: isLoadingFuelTypes, refetch: refetchFuelTypes } = useCachedFuelTypes(initialFuelTypes);

    const vehicles = vehiclesData || [];
    const persons = personsData || [];
    const fuelTypes = fuelTypesData || [];

    // Derived prices from props (now from cached fuelTypes by default)
    const [fuelPrices, setFuelPrices] = useState<{ [key: string]: number }>({});
    // Store global prices for fallback
    const [globalPrices, setGlobalPrices] = useState<{ [key: string]: number }>({});

    const [date, setDate] = useState(() => getLocalISOData(new Date()).date);
    const [time, setTime] = useState(() => getLocalISOData(new Date()).time);
    const [vehicle, setVehicle] = useState('');
    const [driver, setDriver] = useState('');
    const [liters, setLiters] = useState('');
    const [odometer, setOdometer] = useState('');
    const [fuelType, setFuelType] = useState('');
    const [station, setStation] = useState('');
    const [invoiceNumber, setInvoiceNumber] = useState('');
    const [cost, setCost] = useState(0);
    const [formattedCost, setFormattedCost] = useState('R$ 0,00');
    const [lastOdometer, setLastOdometer] = useState<number | null>(null);
    const [unitPrice, setUnitPrice] = useState<number>(0);
    const [isInitialLoad, setIsInitialLoad] = useState(true);


    // Formatting Helpers
    // Formatting Helpers removed: now using numberUtils

    const handleOdometerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        // Odometer: 1 decimal place
        const formatted = formatNumberInput(e.target.value, 2);
        setOdometer(formatted);
    };

    const handleLitersChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        // Liters: 3 decimal places
        const formatted = formatNumberInput(e.target.value, 3);
        setLiters(formatted);
    };

    const handleCostChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        // Cost: 2 decimal places
        const formatted = formatNumberInput(e.target.value, 2);
        setFormattedCost(`R$ ${formatted}`);
        setCost(parseFormattedNumber(formatted));
    };


    // Confirmation Modal State
    const [confirmModalOpen, setConfirmModalOpen] = useState(false);
    const [adminOverrideModalOpen, setAdminOverrideModalOpen] = useState(false);
    const [isOdometerOverridden, setIsOdometerOverridden] = useState(false);
    const [pendingData, setPendingData] = useState<AbastecimentoRecord | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Initialize state from props
    useEffect(() => {
        const prices = fuelTypes.reduce((acc: any, type: any) => {
            acc[type.key] = type.price;
            return acc;
        }, {});
        setFuelPrices(prices);
        setGlobalPrices(prices);

        if (fuelTypes.length > 0 && !fuelType) {
            setFuelType(fuelTypes[0].key);
        }

        if (gasStations.length > 0 && !station) {
            // Prioritize "Posto Xavier & Xavier Ltda" or fallback to first station
            const defaultStation = gasStations.find(s => s.name === "Posto Xavier & Xavier Ltda") || gasStations[0];
            if (defaultStation) setStation(defaultStation.name);
        }
    }, [fuelTypes, gasStations]); // Run when props change/load

    // Update prices based on selected station
    useEffect(() => {
        if (!station) {
            setFuelPrices(globalPrices);
            return;
        }

        const selectedStation = gasStations.find(s => s.name === station);
        if (selectedStation && selectedStation.fuel_prices) {
            // Merge station prices with global prices (fallback for missing keys) or just override
            // Requirement implies station prices are specific.
            // Let's iterate keys of global to ensure structure, but take from station if > 0
            const newPrices = { ...globalPrices };

            // Assuming fuel_prices keys match fuelTypes keys
            Object.keys(selectedStation.fuel_prices).forEach(key => {
                // @ts-ignore
                const val = selectedStation.fuel_prices[key];
                if (val && val > 0) {
                    newPrices[key] = val;
                }
            });
            setFuelPrices(newPrices);
            
            // If it's a new record, update unitPrice when station/prices change
            if (!initialData && fuelType) {
                setUnitPrice(newPrices[fuelType] || 0);
            }
        } else {
            // Revert to global if station has no specific prices
            setFuelPrices(globalPrices);
            if (!initialData && fuelType) {
                setUnitPrice(globalPrices[fuelType] || 0);
            }
        }
    }, [station, gasStations, globalPrices, fuelType, initialData]);

    // Fetch latest odometer when vehicle changes
    useEffect(() => {
        const fetchLastOdometer = async () => {
            if (vehicle) {
                const latest = await AbastecimentoService.getLatestOdometerByVehicle(vehicle);
                setLastOdometer(latest);
            } else {
                setLastOdometer(null);
            }
        };
        fetchLastOdometer();
    }, [vehicle]);

    // Load initial data for editing
    useEffect(() => {
        if (initialData) {
            const isoData = getLocalISOData(initialData.date);
            setDate(isoData.date);
            setTime(isoData.time);
            // Handle legacy data (Model - Brand) vs new data (Plate)
            const savedVehicle = initialData.vehicle;
            const matchedVehicle = vehicles.find(v =>
                v.plate === savedVehicle ||
                `${v.model} - ${v.brand}` === savedVehicle
            );
            setVehicle(matchedVehicle ? matchedVehicle.plate : savedVehicle);
            setDriver(initialData.driver);
            setLiters(initialData.liters.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }));
            setOdometer(initialData.odometer.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
            // Extract fuel key from "type - price" string "gasolina - R$ 5.00" -> "gasolina" or just use full string if needed?
            // The record stores "gasolina - R$ 5.89". We need to find the key.
            // Actually record.fuelType stores "gasolina - R$ 5.89".
            // We need to set 'fuelType' state which is the KEY (e.g. 'gasolina').
            // Let's try to split by ' - ' or match with fuelTypes.
            const typePart = initialData.fuelType.split(' - ')[0];
            const foundType = fuelTypes.find(t => t.key === typePart || t.label === typePart || initialData.fuelType.includes(t.key));
            if (foundType) setFuelType(foundType.key);

            setStation(initialData.station || '');
            setInvoiceNumber(initialData.invoiceNumber || '');
            const initialCost = initialData.cost;
            setCost(initialCost);
            setUnitPrice(initialData.unit_price || 0);
            setFormattedCost(`R$ ${initialCost.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
            
            // Set initial load to false after a short delay to allow effects to settle
            setTimeout(() => setIsInitialLoad(false), 100);
        } else {
            setIsInitialLoad(false);
        }

    }, [initialData, fuelTypes, vehicles]);

    useEffect(() => {
        const calculateCost = () => {
            // DO NOT recalculate if it's the initial load of an edit
            if (isInitialLoad && initialData) return;

            if (!liters || !fuelType) {
                setCost(0);
                setFormattedCost('R$ 0,00');
                return;
            }
            
            const litersFloat = parseFormattedNumber(liters);
            const total = litersFloat * unitPrice;
            // Round to 2 decimals for precision requirement
            const roundedTotal = Number(total.toFixed(2));
            setCost(roundedTotal);
            setFormattedCost(`R$ ${roundedTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
        };
        calculateCost();
    }, [liters, fuelType, unitPrice, isInitialLoad, initialData]);

    // Split effect to update unitPrice when fuelType changes explicitly
    useEffect(() => {
        if (!isInitialLoad && fuelType) {
            const newPrice = fuelPrices[fuelType] || 0;
            setUnitPrice(newPrice);
        }
    }, [fuelType]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Parse local date components into a Date object correctly
        const [year, month, day] = date.split('-').map(Number);
        const [hours, minutes] = time.split(':').map(Number);
        const combinedDate = new Date(year, month - 1, day, hours, minutes);
        // If editing, use existing ID and Protocol. Else generate new.
        const recordId = initialData?.id || crypto.randomUUID();
        const protocolId = initialData?.protocol || `ABA-${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`;

        // Strict Validation
        if (!vehicle || !driver || !fuelType) {
            alert('Por favor, preencha todos os campos obrigatórios (Veículo, Motorista, Combustível).');
            return;
        }

        const litersVal = parseFormattedNumber(liters);
        const odometerVal = parseFormattedNumber(odometer);

        if (litersVal <= 0) {
            alert('A quantidade de litros deve ser maior que zero.');
            return;
        }

        // Only validate odometer for NEW records
        if (!initialData) {
            if (odometerVal <= 0) {
                alert('O odômetro deve ser maior que zero.');
                return;
            }
            if (lastOdometer !== null && odometerVal <= lastOdometer) {
                if (authUser?.role === 'admin' || authUser?.permissions?.includes('parent_admin')) {
                    const matchedVehicle = vehicles.find(v => v.plate === vehicle);
                    const newRecord: AbastecimentoRecord = {
                        id: recordId,
                        protocol: protocolId,
                        fiscal: authUser?.name || authUser?.username || 'Sistema',
                        date: combinedDate.toISOString(),
                        vehicle,
                        driver,
                        fuelType: `${fuelType} - R$ ${fuelPrices[fuelType]?.toFixed(2)}`,
                        liters: litersVal,
                        odometer: odometerVal,
                        cost: Number(cost.toFixed(2)),
                        station,
                        invoiceNumber,
                        userId: authUser?.id,
                        userName: authUser?.name,
                        sectorId: matchedVehicle?.sectorId,
                        unit_price: unitPrice
                    };
                    setPendingData(newRecord);
                    setAdminOverrideModalOpen(true);
                    return; // Pause submit here, wait for admin modal
                } else {
                    alert(`BLOQUEIO: O Horímetro/Odômetro informado (${odometerVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}) é menor ou igual ao último registro (${lastOdometer.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}). O cadastro não pode ser realizado.`);
                    return;
                }
            }
        }

        // Check for duplicate invoice number (Combination: Station + Invoice)
        if (invoiceNumber && station) {
            const isDuplicate = await AbastecimentoService.checkInvoiceExists(invoiceNumber, station, initialData?.id);
            if (isDuplicate) {
                alert(`ERRO: Já existe um registro com a Nota ${invoiceNumber} para o posto ${station}. Por favor, verifique.`);
                return;
            }
        }

        const matchedVehicle = vehicles.find(v => v.plate === vehicle);

        const newRecord: AbastecimentoRecord = {
            id: recordId,
            protocol: protocolId,
            fiscal: initialData?.fiscal || authUser?.name || authUser?.username || 'Sistema',
            date: combinedDate.toISOString(),
            vehicle,
            driver,
            fuelType: `${fuelType} - R$ ${fuelPrices[fuelType]?.toFixed(2)}`,
            liters: litersVal,
            odometer: odometerVal,
            cost: Number(cost.toFixed(2)),
            station,
            invoiceNumber,
            userId: initialData?.userId || authUser?.id,
            userName: initialData?.userName || authUser?.name,
            sectorId: matchedVehicle?.sectorId || initialData?.sectorId,
            unit_price: unitPrice,
            created_at: initialData?.created_at
        };

        // Open Confirmation Modal instead of saving directly
        setPendingData(newRecord);
        setConfirmModalOpen(true);
    };

    const handleFinalSave = async (overrideValidation: boolean | React.MouseEvent = false) => {
        if (!pendingData) return;

        try {
            setIsSaving(true);

            // Audit Log (Console for now, can be extended to DB)
            console.log(`[AUDIT] Saving Supply Record: 
                Protocol: ${pendingData.protocol}, 
                User: ${pendingData.userName} (${pendingData.userId}), 
                Vehicle: ${pendingData.vehicle}, 
                Timestamp: ${new Date().toISOString()}`
            );

            const shouldOverride = overrideValidation === true || isOdometerOverridden;
            await AbastecimentoService.saveAbastecimento(pendingData, !!initialData, shouldOverride);

            onSave(pendingData);
            setConfirmModalOpen(false);
            setAdminOverrideModalOpen(false);
            setIsOdometerOverridden(false);
        } catch (error) {
            console.error("[AUDIT] Error saving supply:", error);
            alert("Erro ao salvar abastecimento. Verifique sua conexão e tente novamente.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        onBack();
    };

    const inputClass = "w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-900 focus:bg-white focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 outline-none transition-all";
    const labelClass = "block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 ml-1";

    // Prepare Options - Memoized for performance
    const vehicleOptions: Option[] = useMemo(() => vehicles
        .map(v => ({
            value: v.plate, // Store PLATE as the unique identifier
            label: v.plate, // Display ONLY Plate
            subtext: undefined, // Remove any extra info
            key: v.id
        }))
        .sort((a, b) => a.label.localeCompare(b.label)), [vehicles]);

    const driverOptions: Option[] = useMemo(() => {
        return persons
            .map(p => ({
                value: p.name,
                label: p.name,
                subtext: (p as any).role || p.jobId,
                key: p.id,
                // Pre-calculating sort key to avoid expensive operations during comparison
                _sortKey: (p.name || '').trim().toLowerCase()
            }))
            .sort((a, b) => a._sortKey.localeCompare(b._sortKey));
    }, [persons]);

    const fuelOptions: Option[] = useMemo(() => fuelTypes
        .map(t => ({
            value: t.key,
            label: t.label,
            subtext: `R$ ${(fuelPrices[t.key] || t.price).toFixed(2)}/L`
        }))
        .sort((a, b) => a.label.localeCompare(b.label)), [fuelTypes, fuelPrices]);

    const stationOptions: Option[] = useMemo(() => gasStations
        .map(s => ({
            value: s.name,
            label: s.name,
            subtext: s.city,
            key: s.id
        }))
        .sort((a, b) => a.label.localeCompare(b.label)), [gasStations]);

    // Removed isLoading check as data is passed via props

    return (
        <div className="flex-1 h-full bg-slate-50 p-4 wide:p-6 overflow-auto custom-scrollbar">
            <div className="w-full max-w-6xl mx-auto bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden animate-fade-in">
                {/* Compact Header */}
                <div className="bg-slate-900 px-4 sm:px-6 py-3 sm:py-5 flex items-center justify-between relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-cyan-400 via-blue-500 to-slate-900"></div>
                    <div className="relative z-10 flex items-center gap-4">
                        <div className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/20 shadow-lg">
                            <Fuel className="w-5 h-5 text-cyan-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white tracking-tight leading-tight">{initialData ? 'Editar Abastecimento' : 'Novo Abastecimento'}</h2>
                            <p className="text-cyan-100/70 text-xs font-medium">{initialData ? 'Atualize os dados do registro' : 'Preencha os dados do registro'}</p>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-4 sm:p-6">
                    <div className="grid grid-cols-12 gap-x-4 gap-y-5">
                        {/* Row 1: Data, Hora, Nota (Compact) - Mobile: Date/Time hidden */}
                        <div className="hidden wide:block wide:col-span-3">
                            <CustomDateTimeInput
                                label="Data"
                                value={date}
                                onChange={setDate}
                                type="date"
                                required
                            />
                        </div>
                        <div className="hidden wide:block wide:col-span-3">
                            <CustomDateTimeInput
                                label="Hora"
                                value={time}
                                onChange={setTime}
                                type="time"
                                required
                            />
                        </div>
                        <div className="col-span-12 wide:col-span-6 space-y-1">
                            <label className={labelClass}>Número da Nota</label>
                            <div className="relative group">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-cyan-500 transition-colors">
                                    <FileText className="w-5 h-5" />
                                </div>
                                <input
                                    type="text"
                                    value={invoiceNumber}
                                    onChange={(e) => setInvoiceNumber(e.target.value)}
                                    placeholder="Ex: 000.123"
                                    className={`${inputClass} pl-12`}
                                />
                            </div>
                        </div>

                        {/* Row 2: Veículo e Motorista */}
                        <div className="col-span-12 sm:col-span-6 space-y-1">
                            <label className={labelClass}>Veículo</label>
                            <CustomSelect
                                options={vehicleOptions}
                                value={vehicle}
                                onChange={setVehicle}
                                placeholder="Selecione o veículo..."
                                icon={Truck}
                            />
                        </div>

                        <div className="col-span-12 sm:col-span-6 space-y-1">
                            <label className={labelClass}>Motorista</label>
                            <CustomSelect
                                options={driverOptions}
                                value={driver}
                                onChange={setDriver}
                                placeholder="Selecione o motorista..."
                                icon={User}
                            />
                        </div>

                        {/* Row 3: Posto e Combustível */}
                        <div className="col-span-12 sm:col-span-6 space-y-1">
                            <label className={labelClass}>Posto</label>
                            <CustomSelect
                                options={stationOptions}
                                value={station}
                                onChange={setStation}
                                placeholder="Selecione o posto..."
                                icon={MapPin}
                            />
                        </div>

                        <div className="col-span-12 sm:col-span-6 space-y-1">
                            <label className={labelClass}>Combustível</label>
                            <CustomSelect
                                options={fuelOptions}
                                value={fuelType}
                                onChange={setFuelType}
                                placeholder="Selecione o combustível..."
                                icon={Fuel}
                            />
                        </div>

                        {/* Row 4: Litros, Odômetro, Valor Total */}
                        <div className="col-span-12 sm:col-span-4 space-y-1">
                            <label className={labelClass}>Litros</label>
                            <div className="relative group">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-cyan-500 transition-colors">
                                    <Fuel className="w-5 h-5" />
                                </div>
                                <input
                                    type="text"
                                    value={liters}
                                    onChange={handleLitersChange}
                                    placeholder="0,000"
                                    className={`${inputClass} pl-12 font-mono`}
                                    required
                                />
                            </div>
                        </div>

                        <div className="col-span-12 sm:col-span-4 space-y-1">
                            <label className={labelClass}>Odômetro / Horímetro</label>
                            <div className="relative group">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-cyan-500 transition-colors">
                                    <Clock className="w-5 h-5" />
                                </div>
                                <input
                                    type="text"
                                    value={odometer}
                                    onChange={handleOdometerChange}
                                    placeholder="0,00"
                                    className={`${inputClass} pl-12 font-mono`}
                                    required
                                />
                                {lastOdometer !== null && (
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-0.5 bg-slate-100 rounded text-[10px] font-bold text-slate-500">
                                        Ult: {lastOdometer.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="col-span-12 sm:col-span-4 space-y-1">
                            <label className={labelClass}>Valor Total (Calculado)</label>
                            <div className="relative group">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors">
                                    <DollarSign className="w-5 h-5" />
                                </div>
                                <input
                                    type="text"
                                    value={formattedCost}
                                    onChange={handleCostChange}
                                    className={`${inputClass} pl-12 text-emerald-600 font-bold border-emerald-100 bg-emerald-50/30 focus:border-emerald-500 focus:ring-emerald-500/20`}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 mt-10 pt-6 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={handleCancel}
                            className="w-full sm:w-auto px-6 py-3 rounded-xl text-slate-600 font-bold hover:bg-slate-100 transition-all flex items-center justify-center gap-2"
                        >
                            <X className="w-5 h-5" />
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="w-full sm:w-auto px-8 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 shadow-lg shadow-slate-900/10 hover:shadow-slate-900/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 group disabled:opacity-70"
                        >
                            {isSaving ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                <Save className="w-5 h-5 text-cyan-400 group-hover:scale-110 transition-transform" />
                            )}
                            {initialData ? 'Salvar Alterações' : 'Concluir Registro'}
                        </button>
                    </div>
                </form>

                {/* Info Bar at Bottom */}
                <div className="bg-slate-50 px-6 py-3 flex items-center gap-6 border-t border-slate-100">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        <User className="w-3.5 h-3.5" />
                        Fiscal: <span className="text-slate-600 ml-1">{authUser?.name || authUser?.username || 'Sistema'}</span>
                    </div>
                    {initialData?.protocol && (
                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            <FileText className="w-3.5 h-3.5" />
                            Protocolo: <span className="text-slate-600 ml-1">{initialData.protocol}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Confirmation Modal */}
            <AbastecimentoConfirmationModal
                isOpen={confirmModalOpen}
                onClose={() => setConfirmModalOpen(false)}
                onConfirm={handleFinalSave}
                data={pendingData!}
            />

            {/* Admin Override Modal */}
            {adminOverrideModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-md overflow-hidden animate-scale-in">
                        <div className="p-6 text-center">
                            <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-amber-100">
                                <Clock className="w-8 h-8 text-amber-500" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-2">Bloqueio de Odômetro</h3>
                            <p className="text-slate-500 text-sm leading-relaxed mb-6">
                                O odômetro informado ({pendingData?.odometer.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}) é menor ou igual ao último registro ({lastOdometer?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}).
                                <br/><br/>
                                <span className="font-bold text-slate-700 underline decoration-amber-500/30">Como você possui privilégios de Admin, deseja sobrescrever esta validação?</span>
                            </p>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setAdminOverrideModalOpen(false)}
                                    className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-all"
                                >
                                    Não, Corrigir
                                </button>
                                <button
                                    onClick={() => handleFinalSave(true)}
                                    className="flex-1 px-4 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
                                >
                                    <Save className="w-4 h-4 text-cyan-400" />
                                    Sim, Sobrescrever
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
