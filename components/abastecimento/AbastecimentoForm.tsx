import React, { useState, useEffect, useMemo } from 'react';
import { 
  Fuel, User, Truck, DollarSign, Save, X, MapPin, FileText, Clock,
  ChevronLeft, ChevronRight, CheckCircle2, Search, Check, Gauge, Receipt, AlertTriangle
} from 'lucide-react';
import { AbastecimentoService, AbastecimentoRecord } from '../../services/abastecimentoService';
import { useAuth } from '../../contexts/AuthContext';
import { Vehicle, Person } from '../../types';
import { CustomSelect, Option } from '../common/CustomSelect';
import { parseFormattedNumber, formatNumberInput } from '../../utils/numberUtils';
import { CustomDateTimeInput } from '../common/CustomDateTimeInput';
import { AbastecimentoConfirmationModal } from '../modals/AbastecimentoConfirmationModal';
import { getLocalISOData } from '../../utils/dateUtils';
import { getDisplayInvoiceNumber } from '../../utils/invoiceUtils';
import { motion, AnimatePresence } from 'framer-motion';
import { useCachedVehicles } from '../../hooks/useCachedVehicles';
import { useCachedPersons } from '../../hooks/useCachedPersons';
import { useCachedFuelTypes } from '../../hooks/useCachedFuelTypes';

interface AbastecimentoFormProps {
    onBack: () => void;
    onSave: (data: any) => void;
    vehicles: Vehicle[];
    persons: Person[];
    gasStations: { id: string, name: string, city: string, fuel_prices?: any }[];
    fuelTypes: { key: string; label: string; price: number }[];
    initialData?: AbastecimentoRecord;
}

export const AbastecimentoForm: React.FC<AbastecimentoFormProps> = ({
    onBack, onSave,
    vehicles: initialVehicles,
    persons: initialPersons,
    gasStations,
    fuelTypes: initialFuelTypes,
    initialData
}) => {
    const { user: authUser } = useAuth();
    const { data: vehiclesData } = useCachedVehicles(initialVehicles);
    const { data: personsData } = useCachedPersons(initialPersons);
    const { data: fuelTypesData } = useCachedFuelTypes(initialFuelTypes);

    const vehicles = vehiclesData || [];
    const persons = personsData || [];
    const fuelTypes = fuelTypesData || [];

    const [fuelPrices, setFuelPrices] = useState<{ [key: string]: number }>({});
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

    // Mobile wizard state
    const [isMobile, setIsMobile] = useState(false);
    const [mobileStep, setMobileStep] = useState(1);
    const [direction, setDirection] = useState(0);
    const [isDriverOpen, setIsDriverOpen] = useState(false);
    const [isVehicleOpen, setIsVehicleOpen] = useState(false);
    const [isStationOpen, setIsStationOpen] = useState(false);
    const [driverSearch, setDriverSearch] = useState('');
    const [vehicleSearch, setVehicleSearch] = useState('');
    const [stationSearch, setStationSearch] = useState('');

    const [confirmModalOpen, setConfirmModalOpen] = useState(false);
    const [adminOverrideModalOpen, setAdminOverrideModalOpen] = useState(false);
    const [isOdometerOverridden, setIsOdometerOverridden] = useState(false);
    const [isMobileVehicleConfirmed, setIsMobileVehicleConfirmed] = useState(false);
    const [pendingData, setPendingData] = useState<any | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [dupInvoiceModalOpen, setDupInvoiceModalOpen] = useState(false);
    const [dupInvoiceData, setDupInvoiceData] = useState<{ number: string, station: string } | null>(null);

    useEffect(() => {
        setIsMobileVehicleConfirmed(false);
    }, [vehicle, mobileStep]);

    const normalizeText = (t: string) =>
        t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

    const mobileStepsList = useMemo(() => [
        { key: 'veiculo',     title: 'Veículo' },
        { key: 'motorista',   title: 'Motorista' },
        { key: 'posto',       title: 'Posto' },
        { key: 'combustivel', title: 'Combustível' },
        { key: 'litros',      title: 'Litros' },
        { key: 'odometro',    title: 'Odômetro' },
        { key: 'nota',        title: 'Nota Fiscal' },
        { key: 'revisao',     title: 'Revisão' },
    ], []);

    const isMobileStepValid = (step: number): boolean => {
        const s = mobileStepsList[step - 1];
        if (!s) return false;
        switch (s.key) {
            case 'motorista':   return !!driver;
            case 'veiculo':     return !!vehicle;
            case 'posto':       return !!station;
            case 'combustivel': return !!fuelType;
            case 'litros':      return parseFormattedNumber(liters) > 0;
            case 'odometro':    return !initialData ? parseFormattedNumber(odometer) > 0 : true;
            case 'nota':        return true;
            case 'revisao':     return true;
            default:            return false;
        }
    };

    const slideVariants = {
        enter: (d: number) => ({ x: d > 0 ? '100%' : '-100%', opacity: 0 }),
        center: { x: 0, opacity: 1,
            transition: { x: { type: 'spring' as const, stiffness: 300, damping: 30 }, opacity: { duration: 0.2 } }
        },
        exit: (d: number) => ({ x: d < 0 ? '100%' : '-100%', opacity: 0,
            transition: { x: { type: 'spring' as const, stiffness: 300, damping: 30 }, opacity: { duration: 0.2 } }
        }),
    };

    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < 768);
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);

    const handleOdometerChange = (e: React.ChangeEvent<HTMLInputElement>) => setOdometer(formatNumberInput(e.target.value, 2));
    const handleLitersChange   = (e: React.ChangeEvent<HTMLInputElement>) => setLiters(formatNumberInput(e.target.value, 3));
    const handleCostChange     = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = formatNumberInput(e.target.value, 2);
        setFormattedCost(`R$ ${f}`);
        setCost(parseFormattedNumber(f));
    };

    useEffect(() => {
        const prices = fuelTypes.reduce((acc: any, t: any) => { acc[t.key] = t.price; return acc; }, {});
        setFuelPrices(prices);
        setGlobalPrices(prices);
        if (fuelTypes.length > 0 && !fuelType) setFuelType(fuelTypes[0].key);
        if (gasStations.length > 0 && !station) {
            const def = gasStations.find(s => s.name === "Posto Xavier & Xavier Ltda") || gasStations[0];
            if (def) setStation(def.name);
        }
    }, [fuelTypes, gasStations]);

    useEffect(() => {
        if (!station) { setFuelPrices(globalPrices); return; }
        const sel = gasStations.find(s => s.name === station);
        if (sel?.fuel_prices) {
            const np = { ...globalPrices };
            Object.keys(sel.fuel_prices).forEach(k => { const v = (sel.fuel_prices as any)[k]; if (v && v > 0) np[k] = v; });
            setFuelPrices(np);
            if (!initialData && fuelType) setUnitPrice(np[fuelType] || 0);
        } else {
            setFuelPrices(globalPrices);
            if (!initialData && fuelType) setUnitPrice(globalPrices[fuelType] || 0);
        }
    }, [station, gasStations, globalPrices, fuelType, initialData]);

    useEffect(() => {
        const fetch_ = async () => {
            if (vehicle) setLastOdometer(await AbastecimentoService.getLatestOdometerByVehicle(vehicle));
            else setLastOdometer(null);
        };
        fetch_();
    }, [vehicle]);

    useEffect(() => {
        if (initialData) {
            const d = getLocalISOData(initialData.date);
            setDate(d.date); setTime(d.time);
            const mv = vehicles.find(v => v.plate === initialData.vehicle || `${v.model} - ${v.brand}` === initialData.vehicle);
            setVehicle(mv ? mv.plate : initialData.vehicle);
            setDriver(initialData.driver);
            setLiters(initialData.liters.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }));
            setOdometer(initialData.odometer.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
            const tp = initialData.fuelType.split(' - ')[0];
            const ft = fuelTypes.find(t => t.key === tp || t.label === tp || initialData.fuelType.includes(t.key));
            if (ft) setFuelType(ft.key);
            setStation(initialData.station || '');
            setInvoiceNumber(getDisplayInvoiceNumber(initialData.invoiceNumber || ''));
            setCost(initialData.cost);
            setUnitPrice(initialData.unit_price || 0);
            setFormattedCost(`R$ ${initialData.cost.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
            setTimeout(() => setIsInitialLoad(false), 100);
        } else setIsInitialLoad(false);
    }, [initialData, fuelTypes, vehicles]);

    useEffect(() => {
        if (isInitialLoad && initialData) return;
        if (!liters || !fuelType) { setCost(0); setFormattedCost('R$ 0,00'); return; }
        const r = Number((parseFormattedNumber(liters) * unitPrice).toFixed(2));
        setCost(r);
        setFormattedCost(`R$ ${r.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    }, [liters, fuelType, unitPrice, isInitialLoad, initialData]);

    useEffect(() => { if (!isInitialLoad && fuelType) setUnitPrice(fuelPrices[fuelType] || 0); }, [fuelType]);

    const resolveInvoiceId = async (userNote: string) => {
        if (!userNote || !userNote.trim()) return '';
        const trimmed = userNote.trim();
        const baseNote = getDisplayInvoiceNumber(trimmed);
        if (initialData?.invoiceNumber && getDisplayInvoiceNumber(initialData.invoiceNumber) === baseNote) {
            if (/^.*-[A-Za-z0-9]{6}$/.test(initialData.invoiceNumber)) {
                return initialData.invoiceNumber;
            }
        }
        return await AbastecimentoService.generateUniqueInvoiceId(baseNote);
    };

    const buildRecord = (customInvoiceId?: string) => {
        const nowLocal = getLocalISOData(new Date());
        const currentDateStr = date || nowLocal.date;
        const currentTimeStr = time || nowLocal.time;

        const [yr, mo, dy] = currentDateStr.split('-').map(Number);
        const [hr, mi] = currentTimeStr.split(':').map(Number);
        const mv = selectedVehicleObj || vehicles.find((v: any) => v.plate === vehicle || v.id === vehicle);
        const vImg = mv?.vehicleImageUrl || (mv as any)?.vehicle_image_url || undefined;
        return {
            id: initialData?.id || crypto.randomUUID(),
            protocol: initialData?.protocol || `ABA-${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`,
            fiscal: initialData?.fiscal || authUser?.name || authUser?.username || 'Sistema',
            date: new Date(yr, mo - 1, dy, hr, mi).toISOString(),
            vehicle, driver,
            fuelType: `${fuelType} - R$ ${fuelPrices[fuelType]?.toFixed(2)}`,
            liters: parseFormattedNumber(liters),
            odometer: parseFormattedNumber(odometer),
            cost: Number(cost.toFixed(2)),
            station, invoiceNumber: customInvoiceId !== undefined ? customInvoiceId : invoiceNumber,
            userId: initialData?.userId || authUser?.id,
            userName: initialData?.userName || authUser?.name,
            sectorId: mv?.sectorId || initialData?.sectorId,
            unit_price: unitPrice,
            created_at: initialData?.created_at,
            lastOdometer,
            vehicleImageUrl: vImg,
            vehicleModel: mv?.model,
            vehicleBrand: mv?.brand,
        };
    };

    const handleFinalSaveDirect = async (dataToSave: any, override: boolean = false) => {
        if (!dataToSave) return;
        try {
            setIsSaving(true);
            await AbastecimentoService.saveAbastecimento(dataToSave, !!initialData, override || isOdometerOverridden);
            onSave(dataToSave);
            setConfirmModalOpen(false);
            setAdminOverrideModalOpen(false);
            setIsOdometerOverridden(false);
        } catch {
            alert("Erro ao salvar. Verifique sua conexão.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!vehicle || !driver || !fuelType) { alert('Por favor, preencha Veículo, Motorista e Combustível.'); return; }
        const lv = parseFormattedNumber(liters);
        const ov = parseFormattedNumber(odometer);
        if (lv <= 0) { alert('A quantidade de litros deve ser maior que zero.'); return; }

        const finalInvoiceId = await resolveInvoiceId(invoiceNumber);
        const record = buildRecord(finalInvoiceId);

        if (!initialData) {
            if (ov <= 0) { alert('O odômetro deve ser maior que zero.'); return; }
            if (lastOdometer !== null && ov <= lastOdometer) {
                if (authUser?.role === 'admin' || authUser?.permissions?.includes('parent_admin')) {
                    setPendingData(record); setAdminOverrideModalOpen(true); return;
                } else {
                    alert(`BLOQUEIO: Odômetro ${ov.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} <= último (${lastOdometer.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`); return;
                }
            }
        }
        if (finalInvoiceId && station) {
            const dup = await AbastecimentoService.checkInvoiceExists(finalInvoiceId, station, initialData?.id);
            if (dup) {
                setDupInvoiceData({ number: getDisplayInvoiceNumber(finalInvoiceId), station });
                setDupInvoiceModalOpen(true);
                return;
            }
        }
        setPendingData(record);

        // Se o veículo tiver foto no cadastro e a foto AINDA NÃO tiver sido confirmada no mobile, exibe o modal.
        // Se já foi confirmada no mobile ou o veículo não tiver foto, salva diretamente.
        if (record.vehicleImageUrl && record.vehicleImageUrl.trim().length > 0 && !isMobileVehicleConfirmed) {
            setConfirmModalOpen(true);
        } else {
            await handleFinalSaveDirect(record);
        }
    };

    const handleFinalSave = async (override: boolean | React.MouseEvent = false) => {
        if (!pendingData) return;
        await handleFinalSaveDirect(pendingData, override === true);
    };

    const vehicleOptions: Option[] = useMemo(() => vehicles.map(v => ({ value: v.plate, label: v.plate, key: v.id })).sort((a, b) => a.label.localeCompare(b.label)), [vehicles]);
    const driverOptions: Option[] = useMemo(() => persons.map(p => ({ value: p.name, label: p.name, subtext: (p as any).role || p.jobId, key: p.id, _sortKey: p.name.trim().toLowerCase() })).sort((a, b) => a._sortKey.localeCompare(b._sortKey)), [persons]);
    const fuelOptions: Option[] = useMemo(() => fuelTypes.map(t => ({ value: t.key, label: t.label, subtext: `R$ ${(fuelPrices[t.key] || t.price).toFixed(2)}/L` })).sort((a, b) => a.label.localeCompare(b.label)), [fuelTypes, fuelPrices]);
    const stationOptions: Option[] = useMemo(() => gasStations.map(s => ({ value: s.name, label: s.name, subtext: s.city, key: s.id })).sort((a, b) => a.label.localeCompare(b.label)), [gasStations]);

    const filteredDrivers = useMemo(() => { const t = normalizeText(driverSearch); return persons.filter(p => !t || normalizeText(p.name).includes(t)).sort((a, b) => a.name.localeCompare(b.name)); }, [persons, driverSearch]);
    const filteredVehiclesList = useMemo(() => { const t = normalizeText(vehicleSearch); return vehicles.filter(v => !t || normalizeText(`${v.plate} ${v.brand} ${v.model}`).includes(t)).sort((a, b) => a.plate.localeCompare(b.plate)); }, [vehicles, vehicleSearch]);
    const filteredStations = useMemo(() => { const t = normalizeText(stationSearch); return gasStations.filter(s => !t || normalizeText(s.name).includes(t)).sort((a, b) => a.name.localeCompare(b.name)); }, [gasStations, stationSearch]);

    const selectedFuelLabel = useMemo(() => fuelTypes.find(t => t.key === fuelType)?.label || fuelType, [fuelTypes, fuelType]);
    const selectedVehicleObj = useMemo(() => {
        if (!vehicle) return null;
        const v = vehicles.find((item: any) => 
            item.plate === vehicle || 
            item.id === vehicle ||
            (item.plate && item.plate.toLowerCase().trim() === vehicle.toLowerCase().trim())
        );
        if (!v) return null;
        const imgUrl = v.vehicleImageUrl || (v as any).vehicle_image_url || null;
        return {
            ...v,
            vehicleImageUrl: imgUrl
        };
    }, [vehicles, vehicle]);

    const inputClass = "w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-900 focus:bg-white focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 outline-none transition-all";
    const labelClass = "block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 ml-1";

    // Shared modals component
    const SharedModals = () => (
        <>
            <AbastecimentoConfirmationModal isOpen={confirmModalOpen} onClose={() => setConfirmModalOpen(false)} onConfirm={handleFinalSave} data={pendingData!} isEdit={!!initialData} isAdmin={authUser?.role === 'admin' || authUser?.permissions?.includes('parent_admin')} />
            {adminOverrideModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-md overflow-hidden animate-scale-in">
                        <div className="p-6 text-center">
                            <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-amber-100"><Clock className="w-8 h-8 text-amber-500" /></div>
                            <h3 className="text-xl font-bold text-slate-900 mb-2">Bloqueio de Odômetro</h3>
                            <p className="text-slate-500 text-sm leading-relaxed mb-6">
                                O odômetro informado ({pendingData?.odometer.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}) é menor ou igual ao último registro ({lastOdometer?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}).
                                <br /><br />
                                <span className="font-bold text-slate-700">Como você possui privilégios de Admin, deseja sobrescrever?</span>
                            </p>
                            <div className="flex gap-3">
                                <button onClick={() => setAdminOverrideModalOpen(false)} className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-all">Não, Corrigir</button>
                                <button onClick={() => {
                                    setIsOdometerOverridden(true);
                                    setAdminOverrideModalOpen(false);
                                    if (pendingData?.vehicleImageUrl && pendingData.vehicleImageUrl.trim().length > 0) {
                                        setConfirmModalOpen(true);
                                    } else {
                                        handleFinalSaveDirect(pendingData, true);
                                    }
                                }} className="flex-1 px-4 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-2"><Save className="w-4 h-4 text-cyan-400" />Sim, Sobrescrever</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {dupInvoiceModalOpen && dupInvoiceData && (
                <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in">
                    <div className="bg-white rounded-[2rem] shadow-2xl border border-slate-100 w-full max-w-md overflow-hidden animate-scale-in">
                        <div className="bg-gradient-to-br from-rose-500 to-amber-500 p-6 text-white text-center relative">
                            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-3 backdrop-blur-sm border border-white/30 animate-bounce">
                                <Receipt className="w-8 h-8 text-white" />
                            </div>
                            <h3 className="text-xl font-black tracking-tight leading-tight">Opa! Essa nota já rodou por aqui! 🚗💨</h3>
                            <p className="text-white/80 text-[10px] font-bold uppercase tracking-wider mt-2">Detecção de Duplicidade</p>
                        </div>
                        <div className="p-8 text-center space-y-6">
                            <p className="text-slate-600 text-sm leading-relaxed">
                                A nota fiscal de número <strong className="text-rose-600 font-extrabold text-base bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-100 font-mono">{dupInvoiceData.number}</strong> já está cadastrada para o posto <strong className="text-slate-800 font-black">{dupInvoiceData.station}</strong>.
                                <br /><br />
                                Por favor, revise o número digitado ou informe outra nota fiscal para prosseguir com o abastecimento.
                            </p>
                            <button
                                onClick={() => {
                                    setDupInvoiceModalOpen(false);
                                    setDupInvoiceData(null);
                                }}
                                className="w-full py-4 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white rounded-2xl font-black uppercase tracking-wider text-xs shadow-lg shadow-slate-900/20 transition-all flex items-center justify-center gap-2"
                            >
                                <X className="w-4 h-4 text-cyan-400" />
                                Entendido, vou corrigir! 👍
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );

    // ────────────────────────────────────────────────
    // MOBILE WIZARD
    // ────────────────────────────────────────────────
    if (isMobile) {
        const total = mobileStepsList.length;
        const cur = mobileStepsList[mobileStep - 1] || mobileStepsList[0];

        const next = async () => {
            if (!isMobileStepValid(mobileStep)) return;

            const curStep = mobileStepsList[mobileStep - 1];
            if ((curStep.key === 'nota' || curStep.key === 'posto') && invoiceNumber && station) {
                try {
                    const finalId = await resolveInvoiceId(invoiceNumber);
                    const dup = await AbastecimentoService.checkInvoiceExists(finalId, station, initialData?.id);
                    if (dup) {
                        setDupInvoiceData({ number: getDisplayInvoiceNumber(finalId), station });
                        setDupInvoiceModalOpen(true);
                        return;
                    }
                } catch (error) {
                    console.error("Erro ao validar nota fiscal:", error);
                }
            }

            if (mobileStep < total) { setDirection(1); setMobileStep(p => p + 1); }
            else handleSubmit();
        };
        const back = () => {
            if (mobileStep === total && isMobileVehicleConfirmed && selectedVehicleObj?.vehicleImageUrl) {
                setIsMobileVehicleConfirmed(false);
                return;
            }
            if (mobileStep > 1) { setDirection(-1); setMobileStep(p => p - 1); }
            else onBack();
        };



        return (
            <div className="flex flex-col h-full bg-slate-100 w-full relative overflow-hidden">
                {/* Header */}
                <div className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm shrink-0">
                    <div className="w-full h-1.5 bg-slate-100">
                        <div className="h-full bg-cyan-500 transition-all duration-300 ease-out" style={{ width: `${(mobileStep / total) * 100}%` }} />
                    </div>
                    <div className="px-4 py-3 flex items-center justify-between">
                        <button onClick={back} disabled={isSaving} className="p-2 -ml-2 text-slate-500 hover:text-slate-900 active:scale-95 transition-all"><ChevronLeft className="w-6 h-6" /></button>
                        <div className="text-center">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Passo {mobileStep} de {total}</span>
                            <h2 className="text-xs font-bold text-slate-800">{cur.title}</h2>
                        </div>
                        <div className="w-10" />
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center justify-start min-h-0">
                    <div className="w-full max-w-sm flex-1 flex flex-col justify-start items-center pt-2 pb-4 relative min-h-[350px]">
                        <AnimatePresence initial={false} custom={direction} mode="wait">
                            <motion.div key={mobileStep} custom={direction} variants={slideVariants} initial="enter" animate="center" exit="exit"
                                className={`w-full max-w-sm bg-white border border-slate-200/80 rounded-3xl shadow-xl flex flex-col items-center justify-start text-center absolute top-0 ${cur.key === 'revisao' ? 'p-4 space-y-3' : 'p-6 space-y-5'}`}>

                                {cur.key === 'motorista' && (
                                    <div className="w-full space-y-5">
                                        <CardBox icon={User} title="Quem é o motorista?" subtitle="Selecione o motorista responsável pelo abastecimento." />
                                        <SelectCard label="Motorista Selecionado" value={driver} onClick={() => setIsDriverOpen(true)} placeholder="Selecionar Motorista..." />
                                    </div>
                                )}

                                {cur.key === 'veiculo' && (
                                    <div className="w-full space-y-5">
                                        <CardBox icon={Truck} title="Qual o veículo?" subtitle="Selecione o veículo que foi abastecido." />
                                        <SelectCard label="Placa do Veículo" value={vehicle} onClick={() => setIsVehicleOpen(true)} placeholder="Selecionar Veículo..." sub={selectedVehicleObj ? `${selectedVehicleObj.brand} ${selectedVehicleObj.model}` : undefined} />
                                        {lastOdometer !== null && vehicle && (
                                            <div className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-left">
                                                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Último Odômetro</span>
                                                <p className="text-sm font-black text-slate-800 mt-0.5">{lastOdometer.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {cur.key === 'posto' && (
                                    <div className="w-full space-y-5">
                                        <CardBox icon={MapPin} title="Em qual posto?" subtitle="Selecione o posto de combustível utilizado." />
                                        <SelectCard label="Posto Selecionado" value={station} onClick={() => setIsStationOpen(true)} placeholder="Selecionar Posto..."
                                            sub={station ? gasStations.find(s => s.name === station)?.city : undefined} />
                                    </div>
                                )}

                                {cur.key === 'combustivel' && (
                                    <div className="w-full space-y-5">
                                        <CardBox icon={Fuel} title="Qual o combustível?" subtitle="Selecione o tipo de combustível abastecido." />
                                        <div className="w-full space-y-2">
                                            {fuelTypes.map(ft => {
                                                const sel = fuelType === ft.key;
                                                const price = fuelPrices[ft.key] || ft.price;
                                                return (
                                                    <button key={ft.key} type="button" onClick={() => { setFuelType(ft.key); setUnitPrice(price); }}
                                                        className={`w-full p-4 rounded-2xl border text-left flex items-center justify-between transition-all active:scale-[0.98] shadow-sm ${sel ? 'bg-cyan-600 text-white border-cyan-600 shadow-lg shadow-cyan-600/15' : 'bg-slate-50/90 text-slate-700 border-slate-200/80 hover:border-cyan-400'}`}>
                                                        <div>
                                                            <span className="block font-black text-sm">{ft.label}</span>
                                                            <span className={`block text-[11px] font-bold mt-0.5 ${sel ? 'text-cyan-100' : 'text-slate-400'}`}>R$ {price.toFixed(2)}/litro</span>
                                                        </div>
                                                        {sel && <Check className="w-5 h-5 text-white shrink-0" />}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {cur.key === 'litros' && (
                                    <div className="w-full space-y-5">
                                        <CardBox icon={Fuel} title="Quantos litros?" subtitle="Informe a quantidade de litros abastecida." />
                                        <div className="w-full relative flex items-center bg-slate-50/90 border-2 border-slate-200/80 rounded-2xl p-4 focus-within:border-cyan-500 focus-within:ring-4 focus-within:ring-cyan-500/5 transition-all shadow-sm">
                                            <Fuel className="w-5 h-5 text-slate-400 shrink-0 mr-3" />
                                            <input type="text" inputMode="numeric" value={liters} onChange={handleLitersChange} placeholder="0,000" autoFocus className="w-full bg-transparent text-2xl font-black text-slate-900 outline-none font-mono" />
                                            <span className="text-slate-400 font-bold text-sm shrink-0">L</span>
                                        </div>
                                        {parseFormattedNumber(liters) > 0 && unitPrice > 0 && (
                                            <div className="w-full p-4 rounded-2xl bg-emerald-50 border border-emerald-100 text-center">
                                                <span className="block text-[9px] font-black uppercase tracking-wider text-emerald-600">Valor Total Estimado</span>
                                                <span className="block text-2xl font-black text-emerald-700 mt-1">{formattedCost}</span>
                                                <span className="block text-[10px] text-emerald-500 font-bold mt-0.5">{parseFormattedNumber(liters).toFixed(3)}L × R$ {unitPrice.toFixed(2)}/L</span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {cur.key === 'odometro' && (
                                    <div className="w-full space-y-5">
                                        <CardBox icon={Gauge} title="Leitura do Odômetro?" subtitle="Informe o valor atual do odômetro / horímetro do veículo." />
                                        <div className="w-full relative flex items-center bg-slate-50/90 border-2 border-slate-200/80 rounded-2xl p-4 focus-within:border-cyan-500 focus-within:ring-4 focus-within:ring-cyan-500/5 transition-all shadow-sm">
                                            <Gauge className="w-5 h-5 text-slate-400 shrink-0 mr-3" />
                                            <input type="text" inputMode="numeric" value={odometer} onChange={handleOdometerChange} placeholder="0,00" autoFocus className="w-full bg-transparent text-2xl font-black text-slate-900 outline-none font-mono" />
                                            <span className="text-slate-400 font-bold text-sm shrink-0">km</span>
                                        </div>
                                        {lastOdometer !== null && (
                                            <div className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
                                                <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">Último Odômetro Registrado</span>
                                                <span className="block text-lg font-black text-slate-700 mt-0.5">{lastOdometer.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                            </div>
                                        )}
                                        {initialData && <p className="text-[11px] text-slate-400 font-medium text-center">✏️ Editando — odômetro pode ser mantido.</p>}
                                    </div>
                                )}

                                {cur.key === 'nota' && (
                                    <div className="w-full space-y-5">
                                        <CardBox icon={Receipt} title="Nota Fiscal" subtitle="Campo opcional. Informe o número da nota se disponível." />
                                        <div className="w-full relative flex items-center bg-slate-50/90 border-2 border-slate-200/80 rounded-2xl p-4 focus-within:border-cyan-500 focus-within:ring-4 focus-within:ring-cyan-500/5 transition-all shadow-sm">
                                            <FileText className="w-5 h-5 text-slate-400 shrink-0 mr-3" />
                                            <input type="text" inputMode="numeric" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="Ex: 000.123 (opcional)" autoFocus className="w-full bg-transparent text-xl font-black text-slate-900 outline-none font-mono" />
                                        </div>
                                        <p className="text-[11px] text-slate-400 font-medium">Deixe em branco caso não tenha. Toque em <strong>Avançar</strong> para pular.</p>
                                    </div>
                                )}

                                {cur.key === 'revisao' && (
                                    selectedVehicleObj?.vehicleImageUrl && !isMobileVehicleConfirmed ? (
                                        /* PRIMEIRO: FOTO DO VEÍCULO E BOTÃO DE CONFIRMAR VEÍCULO */
                                        <div className="w-full space-y-4 animate-fade-in">
                                            <div className="space-y-1 text-center">
                                                <div className="w-12 h-12 bg-cyan-50 rounded-2xl flex items-center justify-center mx-auto text-cyan-600 shadow-inner mb-1 border border-cyan-100">
                                                    <Truck className="w-6 h-6" />
                                                </div>
                                                <h3 className="text-xl font-black text-slate-900 tracking-tight">Confirmação do Veículo</h3>
                                                <p className="text-slate-500 text-[11px] font-medium max-w-xs mx-auto">
                                                    Confirme se o veículo a ser abastecido é o mesmo da fotografia abaixo antes de prosseguir.
                                                </p>
                                            </div>

                                            <div className="w-full bg-slate-950 rounded-3xl overflow-hidden border border-slate-200 shadow-xl relative group">
                                                <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-950">
                                                    <img 
                                                        src={selectedVehicleObj.vehicleImageUrl} 
                                                        alt={selectedVehicleObj.model} 
                                                        className="w-full h-full object-cover" 
                                                    />
                                                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent flex flex-col justify-end p-4">
                                                        <div className="flex items-center justify-between gap-2">
                                                            <div>
                                                                <span className="inline-block px-2.5 py-0.5 bg-indigo-600/90 backdrop-blur-md rounded-md text-[9px] font-black uppercase tracking-wider text-white mb-1 shadow-sm">
                                                                    {selectedVehicleObj.brand} • {selectedVehicleObj.model}
                                                                </span>
                                                                <h4 className="text-2xl font-black font-mono text-white flex items-center gap-2">
                                                                    {selectedVehicleObj.plate}
                                                                </h4>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="bg-amber-500/10 border-t border-amber-500/20 p-3 px-4 flex items-center gap-2.5 text-amber-800">
                                                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                                                    <p className="text-[11px] font-bold leading-snug">
                                                        Verifique o veículo físico e a placa antes de confirmar.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        /* APÓS: INFORMAÇÕES DO ABASTECIMENTO */
                                        <div className="w-full space-y-4 animate-fade-in">
                                            <div className="space-y-1 text-center">
                                                <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto text-emerald-600 shadow-inner mb-1"><CheckCircle2 className="w-6 h-6" /></div>
                                                <h3 className="text-xl font-black text-slate-900 tracking-tight">Revisar Registro</h3>
                                                <p className="text-slate-500 text-[11px] font-medium max-w-xs mx-auto">Confirme os dados antes de registrar o abastecimento.</p>
                                            </div>

                                            {selectedVehicleObj?.vehicleImageUrl && (
                                                <div className="w-full rounded-2xl bg-indigo-950 p-3 text-white flex items-center gap-3 border border-indigo-900 shadow-md">
                                                    <div className="w-16 h-12 rounded-xl overflow-hidden shrink-0 border border-white/20 bg-slate-900">
                                                        <img src={selectedVehicleObj.vehicleImageUrl} alt={vehicle} className="w-full h-full object-cover" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-1 text-[9px] font-black uppercase text-emerald-400 tracking-wider">
                                                            <CheckCircle2 className="w-3 h-3" /> Veículo Confirmado
                                                        </div>
                                                        <p className="text-sm font-black font-mono tracking-tight truncate">{vehicle}</p>
                                                        <p className="text-[10px] text-slate-300 font-medium truncate">{selectedVehicleObj.brand} {selectedVehicleObj.model}</p>
                                                    </div>
                                                    <button 
                                                        type="button" 
                                                        onClick={() => setIsMobileVehicleConfirmed(false)}
                                                        className="text-[10px] font-extrabold text-indigo-200 underline hover:text-white px-2 py-1"
                                                    >
                                                        Ver Foto
                                                    </button>
                                                </div>
                                            )}

                                            <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl shadow-sm text-left overflow-hidden divide-y divide-slate-100">
                                                <div className="py-2 px-3 grid grid-cols-2 gap-3 bg-white">
                                                    <div>
                                                        <CustomDateTimeInput label="Data" value={date} onChange={setDate} type="date" required />
                                                    </div>
                                                    <div>
                                                        <CustomDateTimeInput label="Hora" value={time} onChange={setTime} type="time" required />
                                                    </div>
                                                </div>
                                                <div className="py-2 px-3">
                                                    <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400 mb-0.5">Motorista</span>
                                                    <p className="text-sm font-bold text-slate-800">{driver || '—'}</p>
                                                </div>
                                                <div className="py-2 px-3 flex justify-between gap-4">
                                                    <div className="flex-1 min-w-0">
                                                        <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400 mb-0.5">Veículo</span>
                                                        <p className="text-sm font-bold text-slate-800 font-mono truncate">{vehicle || '—'}</p>
                                                        {selectedVehicleObj && <p className="text-[10px] text-slate-500">{selectedVehicleObj.brand} {selectedVehicleObj.model}</p>}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400 mb-0.5">Combustível</span>
                                                        <p className="text-sm font-bold text-slate-800">{selectedFuelLabel || '—'}</p>
                                                        {fuelType && <p className="text-[10px] text-slate-500">R$ {(fuelPrices[fuelType] || 0).toFixed(2)}/L</p>}
                                                    </div>
                                                </div>
                                                <div className="py-2 px-3">
                                                    <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400 mb-0.5">Posto</span>
                                                    <p className="text-sm font-bold text-slate-800">{station || '—'}</p>
                                                </div>
                                                <div className="py-2 px-3 flex justify-between gap-3">
                                                    <div>
                                                        <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400 mb-0.5">Litros</span>
                                                        <p className="text-sm font-bold text-slate-800 font-mono">{liters || '—'}L</p>
                                                    </div>
                                                    <div>
                                                        <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400 mb-0.5">Odômetro</span>
                                                        <p className="text-sm font-bold text-slate-800 font-mono">{odometer || '—'}</p>
                                                    </div>
                                                    <div>
                                                        <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400 mb-0.5">Nota</span>
                                                        <p className="text-sm font-bold text-slate-800 font-mono">{invoiceNumber || '—'}</p>
                                                    </div>
                                                </div>
                                                <div className="py-3 px-3 bg-emerald-50">
                                                    <span className="block text-[9px] font-black uppercase tracking-wider text-emerald-600 mb-0.5">Valor Total</span>
                                                    <p className="text-xl font-black text-emerald-700">{formattedCost}</p>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                )}

                            </motion.div>
                        </AnimatePresence>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="p-3.5 px-4 border-t border-slate-200/80 flex items-center gap-3 w-full bg-white shrink-0 shadow-lg z-30 pb-[max(1rem,env(safe-area-inset-bottom))]">
                    <button type="button" onClick={back} disabled={isSaving} className="flex items-center justify-center gap-1.5 py-3 px-5 bg-white border border-slate-200 text-slate-700 font-bold uppercase tracking-widest text-[10px] rounded-xl active:bg-slate-50 disabled:opacity-50 transition-all shadow-sm shrink-0">
                        <ChevronLeft className="w-4 h-4" /><span>Voltar</span>
                    </button>
                    {mobileStep < total ? (
                        <button type="button" onClick={next} disabled={!isMobileStepValid(mobileStep) || isSaving} className="flex-1 flex items-center justify-center gap-1.5 py-3 px-6 bg-slate-900 text-white font-bold uppercase tracking-widest text-[10px] rounded-xl active:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-md shadow-slate-950/15">
                            <span>Avançar</span><ChevronRight className="w-4 h-4" />
                        </button>
                    ) : selectedVehicleObj?.vehicleImageUrl && !isMobileVehicleConfirmed ? (
                        <button type="button" onClick={() => setIsMobileVehicleConfirmed(true)} disabled={isSaving} className="flex-1 flex items-center justify-center gap-1.5 py-3 px-6 bg-indigo-600 text-white font-bold uppercase tracking-widest text-[10px] rounded-xl active:bg-indigo-700 disabled:opacity-50 transition-all shadow-lg shadow-indigo-600/20">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Confirmar Veículo</span>
                        </button>
                    ) : (
                        <button type="button" onClick={() => handleSubmit()} disabled={isSaving} className="flex-1 flex items-center justify-center gap-1.5 py-3 px-6 bg-emerald-600 text-white font-bold uppercase tracking-widest text-[10px] rounded-xl active:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-600/20">
                            {isSaving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                            <span>{isSaving ? 'Salvando...' : 'Confirmar Registro'}</span>
                        </button>
                    )}
                </div>

                {/* Bottom sheets */}
                <BottomSheet title="Selecionar Motorista" open={isDriverOpen} onClose={() => setIsDriverOpen(false)} search={driverSearch} setSearch={setDriverSearch} placeholder="Buscar por nome...">
                    {filteredDrivers.map(p => {
                        const sel = driver === p.name;
                        return (
                            <button key={p.id} onClick={() => { setDriver(p.name); setIsDriverOpen(false); setDriverSearch(''); }}
                                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-left text-sm font-medium transition-all ${sel ? 'bg-cyan-50 text-cyan-700' : 'hover:bg-slate-50 text-slate-700'}`}>
                                <span className={sel ? 'font-bold' : ''}>{p.name}</span>
                                {sel && <Check className="w-5 h-5 text-cyan-600" />}
                            </button>
                        );
                    })}
                </BottomSheet>

                <BottomSheet title="Selecionar Veículo" open={isVehicleOpen} onClose={() => setIsVehicleOpen(false)} search={vehicleSearch} setSearch={setVehicleSearch} placeholder="Buscar por placa, marca ou modelo...">
                    {filteredVehiclesList.map(v => {
                        const sel = vehicle === v.plate;
                        return (
                            <button key={v.id} onClick={() => { setVehicle(v.plate); setIsVehicleOpen(false); setVehicleSearch(''); }}
                                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-left text-sm font-medium transition-all ${sel ? 'bg-cyan-50 text-cyan-700' : 'hover:bg-slate-50 text-slate-700'}`}>
                                <div className="flex flex-col">
                                    <span className={`font-mono text-base ${sel ? 'font-black' : 'font-bold'}`}>{v.plate}</span>
                                    <span className={`text-[11px] font-normal mt-0.5 ${sel ? 'text-cyan-500' : 'text-slate-400'}`}>{v.brand} {v.model}</span>
                                </div>
                                {sel && <Check className="w-5 h-5 text-cyan-600" />}
                            </button>
                        );
                    })}
                </BottomSheet>

                <BottomSheet title="Selecionar Posto" open={isStationOpen} onClose={() => setIsStationOpen(false)} search={stationSearch} setSearch={setStationSearch} placeholder="Buscar posto...">
                    {filteredStations.map(s => {
                        const sel = station === s.name;
                        return (
                            <button key={s.id} onClick={() => { setStation(s.name); setIsStationOpen(false); setStationSearch(''); }}
                                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-left text-sm font-medium transition-all ${sel ? 'bg-cyan-50 text-cyan-700' : 'hover:bg-slate-50 text-slate-700'}`}>
                                <div className="flex flex-col">
                                    <span className={sel ? 'font-bold' : ''}>{s.name}</span>
                                    {s.city && <span className={`text-[11px] font-normal mt-0.5 ${sel ? 'text-cyan-500' : 'text-slate-400'}`}>{s.city}</span>}
                                </div>
                                {sel && <Check className="w-5 h-5 text-cyan-600" />}
                            </button>
                        );
                    })}
                </BottomSheet>

                <SharedModals />
            </div>
        );
    }

    // ────────────────────────────────────────────────
    // DESKTOP FORM (original)
    // ────────────────────────────────────────────────
    return (
        <div className="flex-1 h-full bg-slate-50 p-4 wide:p-6 overflow-auto custom-scrollbar">
            <div className="w-full max-w-6xl mx-auto bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden animate-fade-in">
                <div className="bg-slate-900 px-4 sm:px-6 py-3 sm:py-5 flex items-center justify-between relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-cyan-400 via-blue-500 to-slate-900"></div>
                    <div className="relative z-10 flex items-center gap-4">
                        <div className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/20 shadow-lg"><Fuel className="w-5 h-5 text-cyan-400" /></div>
                        <div>
                            <h2 className="text-lg font-bold text-white tracking-tight leading-tight">{initialData ? 'Editar Abastecimento' : 'Novo Abastecimento'}</h2>
                            <p className="text-cyan-100/70 text-xs font-medium">{initialData ? 'Atualize os dados do registro' : 'Preencha os dados do registro'}</p>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-4 sm:p-6">
                    <div className="grid grid-cols-12 gap-x-4 gap-y-5">
                        <div className="col-span-12 sm:col-span-6 lg:col-span-3"><CustomDateTimeInput label="Data" value={date} onChange={setDate} type="date" required /></div>
                        <div className="col-span-12 sm:col-span-6 lg:col-span-3"><CustomDateTimeInput label="Hora" value={time} onChange={setTime} type="time" required /></div>
                        <div className="col-span-12 lg:col-span-6 space-y-1">
                            <label className={labelClass}>Número da Nota</label>
                            <div className="relative group">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-cyan-500 transition-colors"><FileText className="w-5 h-5" /></div>
                                <input type="text" inputMode="numeric" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="Ex: 000.123" className={`${inputClass} pl-12`} />
                            </div>
                        </div>
                        <div className="col-span-12 sm:col-span-6 space-y-1">
                            <label className={labelClass}>Veículo</label>
                            <CustomSelect options={vehicleOptions} value={vehicle} onChange={setVehicle} placeholder="Selecione o veículo..." icon={Truck} />
                        </div>
                        <div className="col-span-12 sm:col-span-6 space-y-1">
                            <label className={labelClass}>Motorista</label>
                            <CustomSelect options={driverOptions} value={driver} onChange={setDriver} placeholder="Selecione o motorista..." icon={User} />
                        </div>
                        <div className="col-span-12 sm:col-span-6 space-y-1">
                            <label className={labelClass}>Posto</label>
                            <CustomSelect options={stationOptions} value={station} onChange={setStation} placeholder="Selecione o posto..." icon={MapPin} />
                        </div>
                        <div className="col-span-12 sm:col-span-6 space-y-1">
                            <label className={labelClass}>Combustível</label>
                            <CustomSelect options={fuelOptions} value={fuelType} onChange={setFuelType} placeholder="Selecione o combustível..." icon={Fuel} showSearch={false} />
                        </div>
                        <div className="col-span-12 sm:col-span-4 space-y-1">
                            <label className={labelClass}>Litros</label>
                            <div className="relative group">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-cyan-500 transition-colors"><Fuel className="w-5 h-5" /></div>
                                <input type="text" inputMode="numeric" value={liters} onChange={handleLitersChange} placeholder="0,000" className={`${inputClass} pl-12 font-mono`} required />
                            </div>
                        </div>
                        <div className="col-span-12 sm:col-span-4 space-y-1">
                            <label className={labelClass}>Odômetro / Horímetro</label>
                            <div className="relative group">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-cyan-500 transition-colors"><Clock className="w-5 h-5" /></div>
                                <input type="text" inputMode="numeric" value={odometer} onChange={handleOdometerChange} placeholder="0,00" className={`${inputClass} pl-12 font-mono`} required />
                                {lastOdometer !== null && <div className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-0.5 bg-slate-100 rounded text-[10px] font-bold text-slate-500">Ult: {lastOdometer.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>}
                            </div>
                        </div>
                        <div className="col-span-12 sm:col-span-4 space-y-1">
                            <label className={labelClass}>Valor Total (Calculado)</label>
                            <div className="relative group">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors"><DollarSign className="w-5 h-5" /></div>
                                <input type="text" value={formattedCost} onChange={handleCostChange} className={`${inputClass} pl-12 text-emerald-600 font-bold border-emerald-100 bg-emerald-50/30 focus:border-emerald-500 focus:ring-emerald-500/20`} />
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 mt-10 pt-6 border-t border-slate-100">
                        <button type="button" onClick={onBack} className="w-full sm:w-auto px-6 py-3 rounded-xl text-slate-600 font-bold hover:bg-slate-100 transition-all flex items-center justify-center gap-2"><X className="w-5 h-5" />Cancelar</button>
                        <button type="submit" disabled={isSaving} className="w-full sm:w-auto px-8 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 shadow-lg shadow-slate-900/10 hover:shadow-slate-900/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 group disabled:opacity-70">
                            {isSaving ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <Save className="w-5 h-5 text-cyan-400 group-hover:scale-110 transition-transform" />}
                            {initialData ? 'Salvar Alterações' : 'Concluir Registro'}
                        </button>
                    </div>
                </form>
                <div className="bg-slate-50 px-6 py-3 flex items-center gap-6 border-t border-slate-100">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest"><User className="w-3.5 h-3.5" />Fiscal: <span className="text-slate-600 ml-1">{authUser?.name || authUser?.username || 'Sistema'}</span></div>
                    {initialData?.protocol && <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest"><FileText className="w-3.5 h-3.5" />Protocolo: <span className="text-slate-600 ml-1">{initialData.protocol}</span></div>}
                </div>
            </div>
            <SharedModals />
        </div>
    );
};

const CardBox = ({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle: string }) => (
    <div className="space-y-2">
        <div className="w-14 h-14 bg-cyan-50 rounded-2xl flex items-center justify-center mx-auto text-cyan-600 shadow-inner"><Icon className="w-7 h-7" /></div>
        <h3 className="text-xl font-black text-slate-900 tracking-tight">{title}</h3>
        <p className="text-slate-500 text-xs font-medium max-w-xs mx-auto">{subtitle}</p>
    </div>
);

const SelectCard = ({ label, value, onClick, placeholder, sub }: any) => (
    <div onClick={onClick} className="w-full p-5 rounded-2xl border text-left bg-slate-50/90 border-slate-200/80 hover:border-cyan-500 hover:ring-4 hover:ring-cyan-500/5 cursor-pointer shadow-sm active:scale-[0.98]">
        <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1">{label}</span>
        <span className="block text-base font-bold text-slate-800 break-words">{value || placeholder}</span>
        {sub && <span className="block text-[11px] text-slate-500 font-medium mt-1">{sub}</span>}
        <span className="block text-[10px] text-cyan-600 font-bold mt-3 text-right">Toque para selecionar →</span>
    </div>
);

const BottomSheet = ({ title, open, onClose, search, setSearch, placeholder, children }: any) => !open ? null : (
    <div className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 pt-12 sm:p-6 animate-fade-in" onClick={() => { onClose(); setSearch(''); }}>
        <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl flex flex-col h-[65vh] sm:h-auto sm:max-h-[80vh] overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <h3 className="font-black text-slate-900 text-sm uppercase tracking-wide">{title}</h3>
                <button onClick={() => { onClose(); setSearch(''); }} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 border-b border-slate-100 relative">
                <Search className="absolute left-7 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder={placeholder} className="w-full bg-slate-50 border border-slate-200 pl-10 pr-4 py-3 rounded-xl text-base font-medium text-slate-900 outline-none focus:bg-white focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 transition-all" />
            </div>
            <div className="flex-1 overflow-y-auto p-2" style={{ scrollbarWidth: 'none' }}>
                <div className="space-y-1">{children}</div>
            </div>
        </div>
    </div>
);
