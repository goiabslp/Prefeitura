import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { 
    ArrowLeft, TrendingUp, TrendingDown, Droplet, DollarSign, Truck, Settings, LayoutDashboard, 
    Building2, MapPin, CreditCard, Fuel, Save, Plus, Calendar, ChevronDown, History, BarChart3, 
    Search, ChevronRight, FileText, Filter, FileSpreadsheet, Download, CalendarDays, Factory, 
    Car, AlertTriangle, Trash2, CheckSquare, Check, X, ShieldAlert, Users, UserCheck, User,
    Gauge, Zap, Clock, RefreshCw, Layers, ShieldCheck, Wrench, AlertCircle, Award, 
    ArrowUpRight, ArrowDownRight, Eye, SlidersHorizontal, Sparkles, Activity, Info
} from 'lucide-react';
import { ModernSelect } from '../common/ModernSelect';
import { ModernDateInput } from '../common/ModernDateInput';
import { MonthYearPicker } from '../common/MonthYearPicker';
import { AbastecimentoService, AbastecimentoRecord, AbastecimentoReportHistory, ScheduledPriceUpdate, GasStation, FuelConfig } from '../../services/abastecimentoService';
import { getVehicles, getSectors } from '../../services/entityService';
import { AbastecimentoReportPDF } from './AbastecimentoReportPDF';
import { AppState, Vehicle, Sector } from '../../types';
import { supabase } from '../../services/supabaseClient';
import { uploadFile } from '../../services/storageService';
import { generateEmpenhoReportPDF } from '../../utils/empenhoReportGenerator';
import { formatLocalDate } from '../../utils/dateUtils';
import { getDisplayInvoiceNumber } from '../../utils/invoiceUtils';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';

interface AbastecimentoDashboardProps {
    onBack: () => void;
    state: AppState;
    onAbastecimento: (view: 'new' | 'management') => void;
    vehicles: Vehicle[];
    persons: any[];
    gasStations: { id: string, name: string, city: string, supplier_code?: number, fuel_prices?: any }[];
    fuelTypes: { key: string; label: string; price: number }[];
    sectors: Sector[];
    refreshTrigger?: number;
}

type TabType = 'overview' | 'vehicle' | 'sector' | 'driver' | 'reports' | 'lancamentos' | 'config';

interface VehicleStat {
    id: string; // The key used in records (r.vehicle)
    name: string; // The display name
    totalCost: number;
    totalLiters: number;
    count: number;
    lastRef: string;
    avgKmL: number;
    sectorName: string;
}

interface ConfigPanelProps {
    fuelTypes: { key: string; label: string; price: number }[];
    gasStations: GasStation[];
}

const ConfigPanel: React.FC<ConfigPanelProps> = ({ fuelTypes, gasStations: initialGasStations }) => {
    const [fuelConfig, setFuelConfig] = useState({ diesel: 0, gasolina: 0, etanol: 0, arla: 0 });
    const [gasStations, setGasStations] = useState(initialGasStations);
    const [newStation, setNewStation] = useState({ name: '', cnpj: '', city: '', supplierCode: '' });
    const [editingStation, setEditingStation] = useState<GasStation | null>(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [selectedStationId, setSelectedStationId] = useState<string>('');
    const [scheduledUpdates, setScheduledUpdates] = useState<ScheduledPriceUpdate[]>([]);
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [scheduleForm, setScheduleForm] = useState<{
        stationId: string,
        prices: FuelConfig,
        date: string
    }>({
        stationId: '',
        prices: { diesel: 0, gasolina: 0, etanol: 0, arla: 0 },
        date: ''
    });

    const [showToast, setShowToast] = useState(false);
    const [toastMessage, setToastMessage] = useState('');

    useEffect(() => {
        setGasStations(initialGasStations);
    }, [initialGasStations]);

    useEffect(() => {
        if (selectedStationId) {
            const station = gasStations.find(s => s.id === selectedStationId);
            if (station && station.fuel_prices) {
                setFuelConfig(station.fuel_prices);
            } else {
                setFuelConfig({ diesel: 0, gasolina: 0, etanol: 0, arla: 0 });
            }
        } else {
            setFuelConfig({ diesel: 0, gasolina: 0, etanol: 0, arla: 0 });
        }
    }, [selectedStationId, gasStations]);

    const handleAddStation = async () => {
        if (!newStation.name) return;

        const station: GasStation = {
            id: crypto.randomUUID(),
            name: newStation.name,
            cnpj: newStation.cnpj,
            city: newStation.city,
            supplier_code: newStation.supplierCode ? parseInt(newStation.supplierCode) : undefined,
            fuel_prices: { diesel: 0, gasolina: 0, etanol: 0, arla: 0 }
        };

        await AbastecimentoService.saveGasStation(station);
        const updatedStations = await AbastecimentoService.getGasStations();
        setGasStations(updatedStations);
        setNewStation({ name: '', cnpj: '', city: '', supplierCode: '' });
        showSuccessToast('Posto adicionado com sucesso!');
    };

    const handleUpdateStation = async () => {
        if (!editingStation) return;

        try {
            await AbastecimentoService.saveGasStation(editingStation);
            const updatedStations = await AbastecimentoService.getGasStations();
            setGasStations(updatedStations);
            setShowEditModal(false);
            setEditingStation(null);
            showSuccessToast('Cadastro do posto atualizado!');
        } catch (error) {
            console.error(error);
            showSuccessToast('Erro ao atualizar posto.');
        }
    };

    const handleDeleteStation = async (id: string) => {
        if (window.confirm('Excluir este posto?')) {
            await AbastecimentoService.deleteGasStation(id);
            const updatedStations = await AbastecimentoService.getGasStations();
            setGasStations(updatedStations);
            if (selectedStationId === id) setSelectedStationId('');
        }
    };


    useEffect(() => {
        const init = async () => {
            await AbastecimentoService.applyPendingPriceUpdates();
            const updates = await AbastecimentoService.getScheduledPrices();
            setScheduledUpdates(updates.filter(u => !u.applied));
        };
        init();
    }, []);

    const handleSaveConfig = async () => {
        if (!selectedStationId) {
            showSuccessToast('Selecione um posto para salvar os valores.');
            return;
        }

        try {
            await AbastecimentoService.updateStationFuelPrices(selectedStationId, fuelConfig);

            // Update local state
            setGasStations(prev => prev.map(s =>
                s.id === selectedStationId
                    ? { ...s, fuel_prices: fuelConfig }
                    : s
            ));

            showSuccessToast('Valores vinculados ao posto com sucesso!');
        } catch (error) {
            console.error(error);
            showSuccessToast('Erro ao salvar valores.');
        }
    };

    const handleScheduleUpdate = async () => {
        if (!scheduleForm.stationId || !scheduleForm.date) {
            showSuccessToast('Preencha todos os campos obrigatórios.');
            return;
        }

        try {
            const update: ScheduledPriceUpdate = {
                station_id: scheduleForm.stationId,
                prices: scheduleForm.prices,
                scheduled_date: scheduleForm.date
            };

            await AbastecimentoService.saveScheduledPrice(update);
            const updates = await AbastecimentoService.getScheduledPrices();
            setScheduledUpdates(updates.filter(u => !u.applied));
            setShowScheduleModal(false);
            setScheduleForm({
                stationId: '',
                prices: { diesel: 0, gasolina: 0, etanol: 0, arla: 0 },
                date: ''
            });
            showSuccessToast('Aditivo de preço programado com sucesso!');
        } catch (error) {
            console.error(error);
            showSuccessToast('Erro ao programar aditivo.');
        }
    };

    const handleDeleteSchedule = async (id: string) => {
        if (window.confirm('Excluir esta alteração programada?')) {
            try {
                await AbastecimentoService.deleteScheduledPrice(id);
                setScheduledUpdates(prev => prev.filter(u => u.id !== id));
                showSuccessToast('Programação excluída.');
            } catch (error) {
                console.error(error);
            }
        }
    };

    const showSuccessToast = (msg: string) => {
        setToastMessage(msg);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
    };

    const inputClass = "w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-900 focus:bg-white focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 outline-none transition-all";
    const labelClass = "block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 ml-1";

    return (
        <div className="space-y-8 animate-fade-in pb-12 relative">
            {showToast && (
                <div className="fixed bottom-8 right-8 bg-emerald-600 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 animate-fade-in z-50">
                    <Save className="w-5 h-5" />
                    <span className="font-bold">{toastMessage}</span>
                </div>
            )}

            <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 p-6 wide:p-8">
                <div className="flex items-center gap-4 mb-6 pb-6 border-b border-slate-100">
                    <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600">
                        <Building2 className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-900">Posto de Abastecimento</h2>
                        <p className="text-slate-500 text-sm font-medium">Cadastrar novo fornecedor</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 wide:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                    <div className="wide:col-span-1">
                        <label className={labelClass}>Nome do Posto</label>
                        <div className="relative">
                            <input
                                type="text"
                                className={inputClass}
                                placeholder="Ex: Posto Ipiranga Centro"
                                value={newStation.name}
                                onChange={e => setNewStation({ ...newStation, name: e.target.value })}
                            />
                            <Building2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        </div>
                    </div>
                    <div>
                        <label className={labelClass}>CNPJ</label>
                        <div className="relative">
                            <input
                                type="text"
                                className={inputClass}
                                placeholder="00.000.000/0000-00"
                                value={newStation.cnpj}
                                onChange={e => setNewStation({ ...newStation, cnpj: e.target.value })}
                            />
                            <CreditCard className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        </div>
                    </div>
                    <div>
                        <label className={labelClass}>Cidade</label>
                        <div className="relative">
                            <input
                                type="text"
                                className={inputClass}
                                placeholder="Nome da Cidade"
                                value={newStation.city}
                                onChange={e => setNewStation({ ...newStation, city: e.target.value })}
                            />
                            <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        </div>
                    </div>
                    <div>
                        <label className={labelClass}>Código do Fornecedor</label>
                        <div className="relative">
                            <input
                                type="number"
                                className={inputClass}
                                placeholder="Ex: 550..."
                                value={newStation.supplierCode}
                                onChange={e => setNewStation({ ...newStation, supplierCode: e.target.value })}
                            />
                            <Factory className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        </div>
                    </div>
                    <div className="wide:col-span-3 flex justify-end">
                        <button
                            onClick={handleAddStation}
                            disabled={!newStation.name}
                            className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 transition-all active:scale-95"
                        >
                            <Plus className="w-4 h-4" />
                            Adicionar Posto
                        </button>
                    </div>
                </div>

                {gasStations.length > 0 && (
                    <div className="border-t border-slate-100 pt-6">
                        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Postos Cadastrados</h3>
                        <div className="grid grid-cols-1 wide:grid-cols-2 lg:grid-cols-3 gap-4">
                            {gasStations.map((station) => (
                                <div key={station.id} className="group bg-slate-50 p-4 rounded-2xl border border-slate-200 hover:border-blue-200 hover:bg-blue-50/30 transition-all relative">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <h4 className="font-bold text-slate-900">{station.name}</h4>
                                            <div className="text-xs text-slate-500 space-y-1 mt-1">
                                                {station.cnpj && <p>CNPJ: {station.cnpj}</p>}
                                                {station.city && <p className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {station.city}</p>}
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => {
                                                    setEditingStation({ ...station });
                                                    setShowEditModal(true);
                                                }}
                                                className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                title="Editar cadastro"
                                            >
                                                <FileText className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteStation(station.id)}
                                                className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                title="Remover posto"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 p-6 wide:p-8">
                <div className="flex items-center gap-4 mb-6 pb-6 border-b border-slate-100">
                    <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600">
                        <Fuel className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-900">Valores Licitados</h2>
                        <p className="text-slate-500 text-sm font-medium">Definir preço por tipo de combustível para cada posto</p>
                    </div>
                </div>

                {/* Station Selection for Pricing */}
                <div className="mb-8">
                    <ModernSelect
                        label="Selecione o Posto para Vincular os Valores"
                        value={selectedStationId}
                        onChange={setSelectedStationId}
                        options={[
                            { value: "", label: "Selecione um posto..." },
                            ...gasStations.map(s => ({
                                value: s.id,
                                label: `${s.name} - ${s.city}`
                            }))
                        ]}
                        placeholder="Selecione um posto..."
                        icon={Building2}
                    />
                </div>

                <div className={`grid grid-cols-1 sm:grid-cols-2 wide:grid-cols-4 gap-6 transition-all ${!selectedStationId ? 'opacity-50 pointer-events-none blur-[1px]' : ''}`}>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 hover:border-amber-300 transition-colors group">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Diesel</label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">R$</span>
                            <input
                                type="number"
                                step="0.01"
                                value={fuelConfig.diesel || ''}
                                onChange={(e) => setFuelConfig({ ...fuelConfig, diesel: parseFloat(e.target.value) || 0 })}
                                className="w-full pl-9 pr-3 py-2 bg-white rounded-lg border border-slate-200 text-slate-900 font-bold focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
                                placeholder="0,00"
                            />
                        </div>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 hover:border-amber-300 transition-colors group">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Gasolina</label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">R$</span>
                            <input
                                type="number"
                                step="0.01"
                                value={fuelConfig.gasolina || ''}
                                onChange={(e) => setFuelConfig({ ...fuelConfig, gasolina: parseFloat(e.target.value) || 0 })}
                                className="w-full pl-9 pr-3 py-2 bg-white rounded-lg border border-slate-200 text-slate-900 font-bold focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
                                placeholder="0,00"
                            />
                        </div>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 hover:border-amber-300 transition-colors group">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Etanol</label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">R$</span>
                            <input
                                type="number"
                                step="0.01"
                                value={fuelConfig.etanol || ''}
                                onChange={(e) => setFuelConfig({ ...fuelConfig, etanol: parseFloat(e.target.value) || 0 })}
                                className="w-full pl-9 pr-3 py-2 bg-white rounded-lg border border-slate-200 text-slate-900 font-bold focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
                                placeholder="0,00"
                            />
                        </div>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 hover:border-amber-300 transition-colors group">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Arla</label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">R$</span>
                            <input
                                type="number"
                                step="0.01"
                                value={fuelConfig.arla || ''}
                                onChange={(e) => setFuelConfig({ ...fuelConfig, arla: parseFloat(e.target.value) || 0 })}
                                className="w-full pl-9 pr-3 py-2 bg-white rounded-lg border border-slate-200 text-slate-900 font-bold focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
                                placeholder="0,00"
                            />
                        </div>
                    </div>
                </div>

                <div className="flex justify-end mt-6 pt-6 border-t border-slate-100 gap-4">
                    <button
                        onClick={() => {
                            if (selectedStationId) {
                                const st = gasStations.find(s => s.id === selectedStationId);
                                setScheduleForm({
                                    stationId: selectedStationId,
                                    prices: st?.fuel_prices || { diesel: 0, gasolina: 0, etanol: 0, arla: 0 },
                                    date: ''
                                });
                            }
                            setShowScheduleModal(true);
                        }}
                        className="flex items-center gap-2 px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-lg shadow-amber-600/20 transition-all active:scale-95"
                    >
                        <CalendarDays className="w-4 h-4" />
                        Programar Aditivo de Preço
                    </button>
                    <button
                        onClick={handleSaveConfig}
                        disabled={!selectedStationId}
                        className="flex items-center gap-2 px-6 py-3 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-lg shadow-cyan-600/20 transition-all active:scale-95"
                    >
                        <Save className="w-4 h-4" />
                        Salvar Valores do Posto agora
                    </button>
                </div>

                {/* Scheduled Updates List */}
                {scheduledUpdates.length > 0 && (
                    <div className="mt-12 border-t border-slate-200 pt-8">
                        <div className="flex items-center gap-3 mb-6">
                            <History className="w-5 h-5 text-slate-400" />
                            <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest">Alterações Programadas</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {scheduledUpdates.map(update => {
                                const st = gasStations.find(s => s.id === update.station_id);
                                return (
                                    <div key={update.id} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center justify-between group hover:border-amber-200 transition-all">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600">
                                                <Calendar className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-900">{st?.name || 'Posto Desconhecido'}</p>
                                                <p className="text-xs text-slate-500 font-medium">Aplicação: <span className="text-amber-600 font-bold">{new Date(update.scheduled_date + 'T12:00:00').toLocaleDateString('pt-BR')}</span></p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => update.id && handleDeleteSchedule(update.id)}
                                            className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Scheduled Price Modal */}
            {showScheduleModal && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md transition-all overflow-y-auto">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-5xl overflow-hidden animate-in zoom-in-95 duration-300 my-auto">
                        <div className="bg-amber-600 px-6 py-4 text-white">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                                        <CalendarDays className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-black leading-none">Programar Aditivo</h2>
                                        <p className="text-white/80 text-[10px] font-bold uppercase tracking-widest mt-1">Atualização automática de preços</p>
                                    </div>
                                </div>
                                <button onClick={() => setShowScheduleModal(false)} className="w-8 h-8 bg-white/10 hover:bg-white/20 rounded-lg flex items-center justify-center transition-all">
                                    <Plus className="w-5 h-5 rotate-45" />
                                </button>
                            </div>
                        </div>

                        <div className="p-6">
                            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                                {/* Left Section: Posto & Prices (Wider) */}
                                <div className="lg:col-span-3 space-y-6">
                                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                                        <ModernSelect
                                            label="Posto Selecionado"
                                            value={scheduleForm.stationId}
                                            onChange={val => {
                                                const st = gasStations.find(s => s.id === val);
                                                setScheduleForm({
                                                    ...scheduleForm,
                                                    stationId: val,
                                                    prices: st?.fuel_prices || { diesel: 0, gasolina: 0, etanol: 0, arla: 0 }
                                                });
                                            }}
                                            options={[
                                                { value: "", label: "Selecione o posto..." },
                                                ...gasStations.map(s => ({
                                                    value: s.id,
                                                    label: `${s.name} - ${s.city}`
                                                }))
                                            ]}
                                            icon={Building2}
                                        />
                                    </div>

                                    <div className={`grid grid-cols-2 gap-3 transition-all ${!scheduleForm.stationId ? 'opacity-30 grayscale pointer-events-none' : ''}`}>
                                        {[
                                            { label: 'Diesel', key: 'diesel' },
                                            { label: 'Gasolina', key: 'gasolina' },
                                            { label: 'Etanol', key: 'etanol' },
                                            { label: 'Arla', key: 'arla' }
                                        ].map((fuel) => (
                                            <div key={fuel.key} className="bg-slate-50 border border-slate-200 rounded-xl p-3 hover:border-amber-400 transition-colors">
                                                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Novo Preço {fuel.label}</label>
                                                <div className="relative">
                                                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">R$</span>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none font-black text-slate-900 transition-all text-sm"
                                                        value={scheduleForm.prices[fuel.key as keyof FuelConfig] || ''}
                                                        onChange={e => setScheduleForm({
                                                            ...scheduleForm,
                                                            prices: { ...scheduleForm.prices, [fuel.key]: parseFloat(e.target.value) || 0 }
                                                        })}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Right Section: Date & Confirm (Narrower) */}
                                <div className="lg:col-span-2 flex flex-col justify-between space-y-6 lg:border-l lg:border-slate-100 lg:pl-6">
                                    <div className={`space-y-4 transition-all ${!scheduleForm.stationId ? 'opacity-30' : ''}`}>
                                        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
                                            <ModernDateInput
                                                label="Data da Alteração"
                                                value={scheduleForm.date}
                                                onChange={val => setScheduleForm({ ...scheduleForm, date: val })}
                                            />
                                            <div className="mt-3 flex items-start gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1 shrink-0" />
                                                <p className="text-[10px] text-amber-700 font-bold leading-relaxed uppercase tracking-tight">Os valores serão atualizados à meia-noite da data selecionada.</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-3 pt-6 lg:pt-0">
                                        <button
                                            onClick={handleScheduleUpdate}
                                            disabled={!scheduleForm.stationId || !scheduleForm.date}
                                            className="w-full px-6 py-4 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black rounded-2xl shadow-xl shadow-amber-600/20 transition-all active:scale-[0.98] flex items-center justify-center gap-3 text-sm uppercase tracking-wider"
                                        >
                                            <CalendarDays className="w-5 h-5" />
                                            Confirmar Programação
                                        </button>
                                        <button
                                            onClick={() => setShowScheduleModal(false)}
                                            className="w-full px-6 py-3 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold rounded-2xl transition-all text-sm uppercase tracking-wider"
                                        >
                                            Cancelar
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Station Modal */}
            {showEditModal && editingStation && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md transition-all">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="bg-blue-600 px-6 py-6 text-white relative">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                                    <Building2 className="w-6 h-6" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black leading-none">Editar Cadastro</h2>
                                    <p className="text-white/80 text-[10px] font-bold uppercase tracking-widest mt-2">{editingStation.name}</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => {
                                    setShowEditModal(false);
                                    setEditingStation(null);
                                }} 
                                className="absolute right-6 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center transition-all group"
                            >
                                <X className="w-6 h-6 group-hover:scale-110 transition-transform" />
                            </button>
                        </div>

                        <div className="p-8 space-y-6">
                            <div className="space-y-4">
                                <div>
                                    <label className={labelClass}>Nome do Posto</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            className={inputClass}
                                            value={editingStation.name}
                                            onChange={e => setEditingStation({ ...editingStation, name: e.target.value })}
                                        />
                                        <Building2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    </div>
                                </div>

                                <div>
                                    <label className={labelClass}>CNPJ</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            className={inputClass}
                                            value={editingStation.cnpj}
                                            onChange={e => setEditingStation({ ...editingStation, cnpj: e.target.value })}
                                        />
                                        <CreditCard className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className={labelClass}>Cidade</label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                className={inputClass}
                                                value={editingStation.city}
                                                onChange={e => setEditingStation({ ...editingStation, city: e.target.value })}
                                            />
                                            <MapPin className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className={labelClass}>Cód. Fornecedor</label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                className={inputClass}
                                                value={editingStation.supplier_code || ''}
                                                onChange={e => setEditingStation({ ...editingStation, supplier_code: parseInt(e.target.value) || undefined })}
                                            />
                                            <Factory className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button
                                    onClick={() => {
                                        setShowEditModal(false);
                                        setEditingStation(null);
                                    }}
                                    className="flex-1 px-6 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-2xl transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleUpdateStation}
                                    className="flex-[2] px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl shadow-xl shadow-blue-600/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                                >
                                    <Save className="w-5 h-5" />
                                    Salvar Alterações
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export const AbastecimentoDashboard: React.FC<AbastecimentoDashboardProps> = ({ onBack, state, onAbastecimento, vehicles, persons, gasStations, fuelTypes, sectors, refreshTrigger }) => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<TabType>('overview');
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [periodMode, setPeriodMode] = useState<'monthly' | 'daily'>('monthly');
    const [customStartDate, setCustomStartDate] = useState<string>(() => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        return `${year}-${month}-01`;
    });
    const [customEndDate, setCustomEndDate] = useState<string>(() => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    });
    const [vehicleSearchTerm, setVehicleSearchTerm] = useState('');
    const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);
    const [driverSearchTerm, setDriverSearchTerm] = useState('');
    const [selectedDriver, setSelectedDriver] = useState<string | null>(null);
    const [allRecords, setAllRecords] = useState<AbastecimentoRecord[]>([]);

    // --- Filtros Globais em Tempo Real do Dashboard da Frota ---
    const [filterVehicle, setFilterVehicle] = useState<string>('all');
    const [filterSector, setFilterSector] = useState<string>('all');
    const [filterFuel, setFilterFuel] = useState<string>('all');
    const [filterStation, setFilterStation] = useState<string>('all');
    const [filterCategory, setFilterCategory] = useState<string>('all');
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [filterAnomalyOnly, setFilterAnomalyOnly] = useState<boolean>(false);
    const [overviewChartMetric, setOverviewChartMetric] = useState<'cost' | 'liters' | 'kml' | 'price'>('cost');
    const [overviewEvolutionType, setOverviewEvolutionType] = useState<'daily' | 'monthly'>('daily');
    const [overviewTopTab, setOverviewTopTab] = useState<'cost' | 'liters' | 'km' | 'costPerKm' | 'efficiency' | 'inefficient' | 'count'>('cost');

    // --- Modal de Detalhamento Interativo (Drill-Down) ---
    const [drillDownModal, setDrillDownModal] = useState<{
        isOpen: boolean;
        title: string;
        subtitle?: string;
        records: AbastecimentoRecord[];
        metricType?: string;
    } | null>(null);
    const [drillDownSearch, setDrillDownSearch] = useState('');

    const vehicleSectorLookup = useMemo(() => {
        const sectorMap = new Map<string, string>();
        sectors.forEach(s => sectorMap.set(s.id, s.name));

        const map = new Map<string, string>();
        vehicles.forEach(v => {
            const sectorName = (v.sectorId ? sectorMap.get(v.sectorId) : undefined) || (v as any).sector || '-';
            if (v.plate) map.set(v.plate.toUpperCase(), sectorName);
            if (v.id) map.set(v.id, sectorName);
            if (v.plate && v.model) map.set(`${v.plate} - ${v.model}`.toUpperCase(), sectorName);
            if (v.model && v.brand) map.set(`${v.model} - ${v.brand}`.toUpperCase(), sectorName);
        });
        return map;
    }, [vehicles, sectors]);

    const [showPrintPreview, setShowPrintPreview] = useState(false);
    const [reportMode, setReportMode] = useState<'simplified' | 'complete' | 'listagem' | 'empenhado'>('complete');
    const [appliedFilters, setAppliedFilters] = useState({
        startDate: (() => {
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            return `${year}-${month}-01`;
        })(),
        endDate: (() => {
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        })(),
        station: 'all',
        sector: user?.role === 'admin' ? 'all' : (sectors.find(s => s.id === user?.sectorId)?.name || 'all'),
        vehicle: 'all',
        fuelType: ['all'],
        paymentStatus: 'all'
    });
    const [pendingFilters, setPendingFilters] = useState({ ...appliedFilters });
    const [reportHistory, setReportHistory] = useState<AbastecimentoReportHistory[]>([]);
    const [selectedHistoryReport, setSelectedHistoryReport] = useState<AbastecimentoReportHistory | null>(null);
    const [showHistoryPrintPreview, setShowHistoryPrintPreview] = useState(false);
    const [selectedSector, setSelectedSector] = useState<string>(() => {
        if (user?.role === 'admin') return 'all';
        const userSector = sectors.find(s => s.id === user?.sectorId);
        return userSector?.name || 'all';
    });

    // --- Empenho States ---
    const [showEmpenhoOverlay, setShowEmpenhoOverlay] = useState(false);
    const [selectedEmpenhoRecords, setSelectedEmpenhoRecords] = useState<string[]>([]);
    const [showEmpenhoModal, setShowEmpenhoModal] = useState(false);
    const [empenhoForm, setEmpenhoForm] = useState({ projetoAtividade: '', numeroEmpenho: '' });
    const [isEmpenhando, setIsEmpenhando] = useState(false);
    const [sessionEmpenhados, setSessionEmpenhados] = useState<(AbastecimentoRecord & { projeto_atividade?: string; numero_empenho?: string; derivedSector?: string; derivedPlate?: string })[]>([]);
    
    // --- Toast State ---
    const [showToast, setShowToast] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    const [toastType, setToastType] = useState<'success' | 'error'>('success');

    const showSuccessToast = (msg: string) => {
        setToastMessage(msg);
        setToastType('success');
        setShowToast(true);
        setTimeout(() => setShowToast(false), 4000);
    };

    const showErrorToast = (msg: string) => {
        setToastMessage(msg);
        setToastType('error');
        setShowToast(true);
        setTimeout(() => setShowToast(false), 5000);
    };

    // --- Delete Report Modal State ---
    const [reportToDelete, setReportToDelete] = useState<any | null>(null);

    const isAdmin = user?.role === 'admin';
    const userSectorName = sectors.find(s => s.id === user?.sectorId)?.name;

    // Filter available sectors for non-admins
    const availableSectors = useMemo(() => {
        if (isAdmin) return sectors;
        return sectors.filter(s => s.id === user?.sectorId);
    }, [sectors, isAdmin, user?.sectorId]);

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(value);
    };

    const formatNumber = (value: number, decimals: number = 2) => {
        return new Intl.NumberFormat('pt-BR', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        }).format(value);
    };

    const loadRecords = async (
        limit: number = 10000,
        customFilters?: { startDate?: string; endDate?: string }
    ) => {
        let startDateStr = '';
        let endDateStr = '';

        if (customFilters?.startDate && customFilters?.endDate) {
            startDateStr = customFilters.startDate;
            endDateStr = customFilters.endDate;
        } else if (activeTab === 'reports' || activeTab === 'lancamentos') {
            startDateStr = appliedFilters.startDate;
            endDateStr = appliedFilters.endDate;
        } else if (periodMode === 'daily') {
            startDateStr = customStartDate;
            endDateStr = customEndDate;
        } else {
            // Dashboard: período de 6 meses relativo a selectedMonth e selectedYear
            // Data inicial: 5 meses antes de selectedMonth
            const startD = new Date(selectedYear, selectedMonth - 5, 1);
            startDateStr = `${startD.getFullYear()}-${String(startD.getMonth() + 1).padStart(2, '0')}-01`;

            // Data final: último dia de selectedMonth
            const endD = new Date(selectedYear, selectedMonth + 1, 0);
            endDateStr = `${endD.getFullYear()}-${String(endD.getMonth() + 1).padStart(2, '0')}-${String(endD.getDate()).padStart(2, '0')}`;
        }

        const { data } = await AbastecimentoService.getAbastecimentos(1, limit, {
            startDate: startDateStr,
            endDate: endDateStr
        });
        setAllRecords(data);
    };

    const loadReportHistory = async () => {
        const history = await AbastecimentoService.getReportHistory();
        setReportHistory(history);
    };

    // Carregar histórico de relatórios apenas uma vez no carregamento do componente
    useEffect(() => {
        loadReportHistory();
    }, []);

    // Recarregar registros de abastecimento quando mudar de mês, ano, período diário, aba ou quando filtros forem aplicados
    useEffect(() => {
        loadRecords();
    }, [selectedMonth, selectedYear, periodMode, customStartDate, customEndDate, activeTab, appliedFilters]);

    // Registrar o canal do Supabase para atualizar em tempo real
    useEffect(() => {
        const channel = supabase
            .channel('dashboard-records-changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'abastecimentos' },
                () => {
                    loadRecords();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [selectedMonth, selectedYear, periodMode, customStartDate, customEndDate, activeTab, appliedFilters]);

    // Efeito para tratar o gatilho de atualização manual
    useEffect(() => {
        if (refreshTrigger && refreshTrigger > 0) {
            loadRecords();
            loadReportHistory();
        }
    }, [refreshTrigger]);

    const [isPreparingReport, setIsPreparingReport] = useState(false);

    const handleOpenReport = async () => {
        setIsPreparingReport(true);
        try {
            // Fetch a much larger limit to ensure all records matching the filter are available for the complete report
            await loadRecords(10000, { startDate: appliedFilters.startDate, endDate: appliedFilters.endDate });

            // We must wait for React to process the state update of allRecords before saving the report history?
            // Actually, the current reportData is already based on appliedFilters. 
            // We will just save the current view of reportData.
            if (reportData.records.length > 0) {
                const newReport: Partial<AbastecimentoReportHistory> = {
                    report_type: reportMode,
                    start_date: appliedFilters.startDate || undefined,
                    end_date: appliedFilters.endDate || undefined,
                    station: appliedFilters.station === 'all' ? undefined : appliedFilters.station,
                    sector: appliedFilters.sector === 'all' ? undefined : appliedFilters.sector,
                    vehicle: appliedFilters.vehicle === 'all' ? undefined : appliedFilters.vehicle,
                    fuel_type: appliedFilters.fuelType.includes('all') ? undefined : appliedFilters.fuelType.join(','),
                    payment_status: appliedFilters.paymentStatus || 'all',
                    user_id: user?.id,
                    user_name: user?.name,
                    record_ids: reportData.records.map(r => r.id)
                };

                await AbastecimentoService.saveReportHistory(newReport);
                await loadReportHistory();
            }

            setShowPrintPreview(true);
        } catch (error) {
            console.error("Error loading records for report:", error);
        } finally {
            setIsPreparingReport(false);
        }
    };

    const months = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];

    const stats = useMemo(() => {
        // Mapas auxiliares para consulta instantânea O(1)
        const vehicleMap = new Map<string, Vehicle>();
        vehicles.forEach(v => {
            if (v.plate) vehicleMap.set(v.plate.toUpperCase(), v);
            if (v.model && v.brand) vehicleMap.set(`${v.model} - ${v.brand}`.toUpperCase(), v);
            if (v.id) vehicleMap.set(v.id, v);
        });

        const sectorMap = new Map<string, Sector>();
        sectors.forEach(s => sectorMap.set(s.id, s));

        const getVehicleForRecord = (r: AbastecimentoRecord): Vehicle | undefined => {
            if (!r.vehicle) return undefined;
            const norm = r.vehicle.toUpperCase().trim();
            return vehicleMap.get(norm) || vehicles.find(v => 
                (v.plate && norm.includes(v.plate.toUpperCase())) ||
                (v.model && norm.includes(v.model.toUpperCase()))
            );
        };

        // Identificação prévia de anomalias em todos os registros para permitir filtro rápido
        const anomalyRecordIdSet = new Set<string>();

        // Registros filtrados pelo período e filtros ativos
        const filtered = allRecords.filter(r => {
            // 1. Filtro de Data
            if (periodMode === 'daily' && customStartDate && customEndDate) {
                const rDateStr = r.date.substring(0, 10);
                if (rDateStr < customStartDate || rDateStr > customEndDate) return false;
            } else {
                const date = new Date(r.date);
                if (date.getMonth() !== selectedMonth || date.getFullYear() !== selectedYear) return false;
            }

            const matchedVeh = getVehicleForRecord(r);

            // 2. Filtro de Veículo
            if (filterVehicle !== 'all') {
                const normV = filterVehicle.toUpperCase();
                const rVehNorm = (r.vehicle || '').toUpperCase();
                const matchPlate = matchedVeh?.plate?.toUpperCase() === normV;
                const matchName = rVehNorm === normV || rVehNorm.includes(normV);
                if (!matchPlate && !matchName) return false;
            }

            // 3. Filtro de Setor
            if (filterSector !== 'all') {
                const vehSectorId = matchedVeh?.sectorId || r.sectorId;
                const vehSector = vehSectorId ? sectorMap.get(vehSectorId) : undefined;
                if (vehSectorId !== filterSector && vehSector?.name !== filterSector) return false;
            }

            // 4. Filtro de Combustível
            if (filterFuel !== 'all') {
                const rFuelNorm = (r.fuelType || '').toLowerCase();
                const filterFuelNorm = filterFuel.toLowerCase();
                if (!rFuelNorm.includes(filterFuelNorm)) return false;
            }

            // 5. Filtro de Posto
            if (filterStation !== 'all') {
                if ((r.station || '').toLowerCase() !== filterStation.toLowerCase()) return false;
            }

            // 6. Filtro de Categoria da Frota
            if (filterCategory !== 'all') {
                const cat = matchedVeh?.vehicleCategory || matchedVeh?.type;
                if (cat !== filterCategory) return false;
            }

            // 7. Filtro de Status do Veículo
            if (filterStatus !== 'all') {
                if (matchedVeh && matchedVeh.status !== filterStatus) return false;
            }

            return true;
        });

        // Período anterior correspondente com os mesmos filtros
        const prevMonth = selectedMonth === 0 ? 11 : selectedMonth - 1;
        const prevYear = selectedMonth === 0 ? selectedYear - 1 : selectedYear;
        
        let prevStartDate = '';
        let prevEndDate = '';
        if (periodMode === 'daily' && customStartDate && customEndDate) {
            const startD = new Date(customStartDate);
            const endD = new Date(customEndDate);
            const diffTime = Math.abs(endD.getTime() - startD.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
            
            const pEnd = new Date(startD);
            pEnd.setDate(pEnd.getDate() - 1);
            const pStart = new Date(pEnd);
            pStart.setDate(pStart.getDate() - diffDays + 1);

            prevStartDate = pStart.toISOString().substring(0, 10);
            prevEndDate = pEnd.toISOString().substring(0, 10);
        }

        const previous = allRecords.filter(r => {
            if (periodMode === 'daily' && prevStartDate && prevEndDate) {
                const rDateStr = r.date.substring(0, 10);
                if (rDateStr < prevStartDate || rDateStr > prevEndDate) return false;
            } else {
                const date = new Date(r.date);
                if (date.getMonth() !== prevMonth || date.getFullYear() !== prevYear) return false;
            }

            const matchedVeh = getVehicleForRecord(r);

            if (filterVehicle !== 'all') {
                const normV = filterVehicle.toUpperCase();
                const rVehNorm = (r.vehicle || '').toUpperCase();
                const matchPlate = matchedVeh?.plate?.toUpperCase() === normV;
                const matchName = rVehNorm === normV || rVehNorm.includes(normV);
                if (!matchPlate && !matchName) return false;
            }

            if (filterSector !== 'all') {
                const vehSectorId = matchedVeh?.sectorId || r.sectorId;
                const vehSector = vehSectorId ? sectorMap.get(vehSectorId) : undefined;
                if (vehSectorId !== filterSector && vehSector?.name !== filterSector) return false;
            }

            if (filterFuel !== 'all') {
                const rFuelNorm = (r.fuelType || '').toLowerCase();
                const filterFuelNorm = filterFuel.toLowerCase();
                if (!rFuelNorm.includes(filterFuelNorm)) return false;
            }

            if (filterStation !== 'all') {
                if ((r.station || '').toLowerCase() !== filterStation.toLowerCase()) return false;
            }

            if (filterCategory !== 'all') {
                const cat = matchedVeh?.vehicleCategory || matchedVeh?.type;
                if (cat !== filterCategory) return false;
            }

            if (filterStatus !== 'all') {
                if (matchedVeh && matchedVeh.status !== filterStatus) return false;
            }

            return true;
        });

        // Totais Básicos
        const totalCost = filtered.reduce((acc, r) => acc + (Number(r.cost) || 0), 0);
        const prevCost = previous.reduce((acc, r) => acc + (Number(r.cost) || 0), 0);
        const costDiff = prevCost === 0 ? 0 : ((totalCost - prevCost) / prevCost) * 100;
        const costSavings = prevCost - totalCost;

        const totalLiters = filtered.reduce((acc, r) => acc + (Number(r.liters) || 0), 0);
        const prevLiters = previous.reduce((acc, r) => acc + (Number(r.liters) || 0), 0);
        const litersDiff = prevLiters === 0 ? 0 : ((totalLiters - prevLiters) / prevLiters) * 100;

        const avgPricePerLiter = totalLiters > 0 ? totalCost / totalLiters : 0;
        const prevAvgPricePerLiter = prevLiters > 0 ? prevCost / prevLiters : 0;
        const avgPriceDiff = prevAvgPricePerLiter === 0 ? 0 : ((avgPricePerLiter - prevAvgPricePerLiter) / prevAvgPricePerLiter) * 100;

        // Agrupamento por veículo para detalhamento individual
        const vehicleGroups = filtered.reduce((acc, r) => {
            const vehKey = r.vehicle;
            if (!acc[vehKey]) {
                const matchedVehicle = getVehicleForRecord(r);
                const displayName = matchedVehicle
                    ? `${matchedVehicle.model} (${matchedVehicle.plate})`
                    : r.vehicle;

                let sectorName = 'Não Identificado';
                if (matchedVehicle) {
                    const s = sectors.find(sec => sec.id === matchedVehicle.sectorId);
                    if (s) sectorName = s.name;
                }

                acc[vehKey] = {
                    id: vehKey,
                    name: displayName,
                    totalCost: 0,
                    totalLiters: 0,
                    count: 0,
                    lastRef: r.date,
                    avgKmL: 0,
                    sectorName: sectorName
                };
            }
            acc[vehKey].totalCost += (Number(r.cost) || 0);
            acc[vehKey].totalLiters += (Number(r.liters) || 0);
            acc[vehKey].count += 1;
            if (new Date(r.date) > new Date(acc[vehKey].lastRef)) {
                acc[vehKey].lastRef = r.date;
            }
            return acc;
        }, {} as Record<string, VehicleStat>);

        // Cálculo global e individual de Quilometragem e Eficiência (Km/L)
        let totalEfficiencySum = 0;
        let efficiencyCount = 0;
        let prevEfficiencySum = 0;
        let prevEfficiencyCount = 0;
        const vehicleEfficiencySums: Record<string, { sum: number, count: number }> = {};
        const vehicleDistanceSums: Record<string, number> = {};

        let totalDistanceSum = 0;
        let prevDistanceSum = 0;

        // Agrupar registros históricos completos por veículo para calcular intervalos de hodômetro
        const allByVehicle: Record<string, AbastecimentoRecord[]> = {};
        allRecords.forEach(r => {
            if (!allByVehicle[r.vehicle]) allByVehicle[r.vehicle] = [];
            allByVehicle[r.vehicle].push(r);
        });

        // Detecção de Inconsistências de Hodômetro e cálculo de KM percorrido
        const odometerAnomalies: {
            record: AbastecimentoRecord;
            vehicleName: string;
            previousOdometer: number;
            currentOdometer: number;
            type: 'regression' | 'jump';
            diff: number;
        }[] = [];

        Object.values(allByVehicle).forEach(vehicleRecords => {
            const sorted = vehicleRecords.map(r => ({ ...r, dateObj: new Date(r.date) }))
                .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());

            sorted.forEach((record, index) => {
                const rDate = record.dateObj;
                let isCurrentPeriod = false;
                let isPrevPeriod = false;

                if (periodMode === 'daily' && customStartDate && customEndDate) {
                    const dStr = record.date.substring(0, 10);
                    isCurrentPeriod = dStr >= customStartDate && dStr <= customEndDate;
                    if (prevStartDate && prevEndDate) {
                        isPrevPeriod = dStr >= prevStartDate && dStr <= prevEndDate;
                    }
                } else {
                    isCurrentPeriod = rDate.getMonth() === selectedMonth && rDate.getFullYear() === selectedYear;
                    isPrevPeriod = rDate.getMonth() === prevMonth && rDate.getFullYear() === prevYear;
                }

                // Checagem de anomalia de hodômetro em relação ao registro imediatamente anterior
                if (index > 0 && isCurrentPeriod) {
                    const prevRec = sorted[index - 1];
                    const prevOdo = Number(prevRec.odometer) || 0;
                    const curOdo = Number(record.odometer) || 0;

                    if (prevOdo > 0 && curOdo > 0) {
                        if (curOdo < prevOdo) {
                            // Hodômetro menor que o anterior (regressão)
                            odometerAnomalies.push({
                                record,
                                vehicleName: record.vehicle,
                                previousOdometer: prevOdo,
                                currentOdometer: curOdo,
                                type: 'regression',
                                diff: prevOdo - curOdo
                            });
                            anomalyRecordIdSet.add(record.id);
                        } else if (curOdo - prevOdo > 2000) {
                            // Salto suspeito de mais de 2.000 km num único intervalo
                            odometerAnomalies.push({
                                record,
                                vehicleName: record.vehicle,
                                previousOdometer: prevOdo,
                                currentOdometer: curOdo,
                                type: 'jump',
                                diff: curOdo - prevOdo
                            });
                            anomalyRecordIdSet.add(record.id);
                        }
                    }
                }

                if (isCurrentPeriod || isPrevPeriod) {
                    const isArla = (record.fuelType || '').toLowerCase().includes('arla');

                    if (!isArla) {
                        let nextRecord = null;
                        for (let i = index + 1; i < sorted.length; i++) {
                            if (!sorted[i].fuelType?.toLowerCase().includes('arla')) {
                                nextRecord = sorted[i];
                                break;
                            }
                        }

                        if (nextRecord) {
                            const distanceToNext = Number(nextRecord.odometer) - Number(record.odometer);
                            const nextLiters = Number(nextRecord.liters);

                            if (distanceToNext > 0 && distanceToNext < 5000) {
                                if (isCurrentPeriod) {
                                    totalDistanceSum += distanceToNext;
                                    vehicleDistanceSums[record.vehicle] = (vehicleDistanceSums[record.vehicle] || 0) + distanceToNext;
                                }
                                if (isPrevPeriod) {
                                    prevDistanceSum += distanceToNext;
                                }

                                if (nextLiters > 0) {
                                    const efficiency = distanceToNext / nextLiters;
                                    // Filtra eficiências razoáveis (evita distorções de odômetros digitados errados)
                                    if (efficiency >= 0.5 && efficiency <= 45) {
                                        if (isCurrentPeriod) {
                                            totalEfficiencySum += efficiency;
                                            efficiencyCount++;

                                            if (!vehicleEfficiencySums[record.vehicle]) {
                                                vehicleEfficiencySums[record.vehicle] = { sum: 0, count: 0 };
                                            }
                                            vehicleEfficiencySums[record.vehicle].sum += efficiency;
                                            vehicleEfficiencySums[record.vehicle].count++;
                                        }
                                        if (isPrevPeriod) {
                                            prevEfficiencySum += efficiency;
                                            prevEfficiencyCount++;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            });
        });

        const avgKmL = efficiencyCount > 0 ? (totalEfficiencySum / efficiencyCount) : 0;
        const prevAvgKmL = prevEfficiencyCount > 0 ? (prevEfficiencySum / prevEfficiencyCount) : 0;
        const avgKmLDiff = prevAvgKmL === 0 ? 0 : ((avgKmL - prevAvgKmL) / prevAvgKmL) * 100;
        const kmDiffPeriod = prevDistanceSum === 0 ? 0 : ((totalDistanceSum - prevDistanceSum) / prevDistanceSum) * 100;

        const litersPer100Km = avgKmL > 0 ? (100 / avgKmL) : 0;
        const costPerKm = totalDistanceSum > 0 ? (totalCost / totalDistanceSum) : 0;
        const prevCostPerKm = prevDistanceSum > 0 ? (prevCost / prevDistanceSum) : 0;
        const costPerKmDiff = prevCostPerKm === 0 ? 0 : ((costPerKm - prevCostPerKm) / prevCostPerKm) * 100;

        // Finaliza estatísticas dos veículos
        const vehicleStats = Object.values(vehicleGroups)
            .map((v: VehicleStat) => {
                const eff = vehicleEfficiencySums[v.id];
                const km = vehicleDistanceSums[v.id] || 0;
                const calculatedKmL = eff && eff.count > 0 ? (eff.sum / eff.count) : 0;
                const calculatedCostPerKm = km > 0 ? (v.totalCost / km) : 0;
                return {
                    ...v,
                    avgKmL: calculatedKmL,
                    totalKm: km,
                    costPerKm: calculatedCostPerKm
                };
            })
            .sort((a, b) => b.totalCost - a.totalCost);

        const activeVehicles = vehicleStats.length;
        const avgCostPerVehicle = activeVehicles > 0 ? totalCost / activeVehicles : 0;
        const avgLitersPerVehicle = activeVehicles > 0 ? totalLiters / activeVehicles : 0;
        const avgKmPerVehicle = activeVehicles > 0 ? totalDistanceSum / activeVehicles : 0;

        // Frota: Status dos veículos
        const operationalVehiclesCount = vehicles.filter(v => v.status === 'operacional').length;
        const maintenanceVehiclesCount = vehicles.filter(v => v.status === 'manutencao' || v.status === 'vistoria').length;
        const inactiveVehiclesCount = vehicles.filter(v => v.status !== 'operacional' && v.status !== 'manutencao' && v.status !== 'vistoria').length;

        // --- PROJEÇÕES INTELIGENTES (RUN-RATE) ---
        const now = new Date();
        const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
        const isCurrentMonth = selectedYear === now.getFullYear() && selectedMonth === now.getMonth();
        const daysPassed = isCurrentMonth ? Math.max(1, now.getDate()) : daysInMonth;
        const daysRemaining = isCurrentMonth ? Math.max(0, daysInMonth - daysPassed) : 0;

        const dailyAvgCost = daysPassed > 0 ? totalCost / daysPassed : 0;
        const projectedMonthlyCost = isCurrentMonth ? (totalCost + (dailyAvgCost * daysRemaining)) : totalCost;
        
        const dailyAvgLiters = daysPassed > 0 ? totalLiters / daysPassed : 0;
        const projectedMonthlyLiters = isCurrentMonth ? (totalLiters + (dailyAvgLiters * daysRemaining)) : totalLiters;
        
        const projectedCostDiff = prevCost > 0 ? ((projectedMonthlyCost - prevCost) / prevCost) * 100 : 0;

        // --- DISTRIBUIÇÃO POR COMBUSTÍVEL ---
        const fuelMap: Record<string, { name: string; liters: number; cost: number; count: number }> = {};
        filtered.forEach(r => {
            const rawType = r.fuelType || 'Outro';
            const cleanType = rawType.includes(' - ') ? rawType.split(' - ')[0].trim() : rawType.trim();
            const upperKey = cleanType.toUpperCase();

            if (!fuelMap[upperKey]) {
                fuelMap[upperKey] = { name: cleanType, liters: 0, cost: 0, count: 0 };
            }
            fuelMap[upperKey].liters += (Number(r.liters) || 0);
            fuelMap[upperKey].cost += (Number(r.cost) || 0);
            fuelMap[upperKey].count += 1;
        });

        const fuelBreakdown = Object.values(fuelMap).map(f => ({
            ...f,
            avgPrice: f.liters > 0 ? f.cost / f.liters : 0,
            percentLiters: totalLiters > 0 ? (f.liters / totalLiters) * 100 : 0,
            percentCost: totalCost > 0 ? (f.cost / totalCost) * 100 : 0
        })).sort((a, b) => b.cost - a.cost);

        const fuelChartData = fuelBreakdown.map(f => ({ name: f.name, value: f.liters, cost: f.cost }));
        const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#64748b'];

        // --- DISTRIBUIÇÃO POR POSTO / FORNECEDOR ---
        const stationMap: Record<string, { name: string; count: number; liters: number; cost: number }> = {};
        filtered.forEach(r => {
            const stName = (r.station || 'Posto Desconhecido').trim();
            if (!stationMap[stName]) {
                stationMap[stName] = { name: stName, count: 0, liters: 0, cost: 0 };
            }
            stationMap[stName].count += 1;
            stationMap[stName].liters += (Number(r.liters) || 0);
            stationMap[stName].cost += (Number(r.cost) || 0);
        });

        const stationBreakdown = Object.values(stationMap).map(s => ({
            ...s,
            avgPrice: s.liters > 0 ? s.cost / s.liters : 0,
            percentCost: totalCost > 0 ? (s.cost / totalCost) * 100 : 0,
            percentLiters: totalLiters > 0 ? (s.liters / totalLiters) * 100 : 0
        })).sort((a, b) => b.cost - a.cost);

        // --- DISTRIBUIÇÃO POR SECRETARIA / SETOR ---
        const sectorMapStats: Record<string, { id: string; name: string; cost: number; liters: number; count: number; vehicles: Set<string>; km: number }> = {};
        filtered.forEach(r => {
            const v = getVehicleForRecord(r);
            const secId = v?.sectorId || r.sectorId;
            const secObj = secId ? sectorMap.get(secId) : undefined;
            const secName = secObj?.name || 'Não Identificado';
            const secKey = secObj?.id || secName;

            if (!sectorMapStats[secKey]) {
                sectorMapStats[secKey] = {
                    id: secKey,
                    name: secName,
                    cost: 0,
                    liters: 0,
                    count: 0,
                    vehicles: new Set<string>(),
                    km: 0
                };
            }
            sectorMapStats[secKey].cost += (Number(r.cost) || 0);
            sectorMapStats[secKey].liters += (Number(r.liters) || 0);
            sectorMapStats[secKey].count += 1;
            sectorMapStats[secKey].vehicles.add(r.vehicle);
            sectorMapStats[secKey].km += (vehicleDistanceSums[r.vehicle] ? (vehicleDistanceSums[r.vehicle] / Math.max(1, vehicleGroups[r.vehicle]?.count || 1)) : 0);
        });

        const sectorBreakdown = Object.values(sectorMapStats).map(s => ({
            id: s.id,
            name: s.name,
            cost: s.cost,
            liters: s.liters,
            count: s.count,
            vehicleCount: s.vehicles.size,
            km: s.km,
            costPerKm: s.km > 0 ? s.cost / s.km : 0
        })).sort((a, b) => b.cost - a.cost);

        const sectorChartData = sectorBreakdown.slice(0, 8).map(s => ({ name: s.name, value: s.cost, liters: s.liters }));

        // --- DISTRIBUIÇÃO POR CATEGORIA DA FROTA ---
        const categoryMapStats: Record<string, { category: string; cost: number; liters: number; vehicleCount: Set<string>; km: number }> = {};
        filtered.forEach(r => {
            const v = getVehicleForRecord(r);
            const cat = v?.vehicleCategory || v?.type || 'Outro';
            if (!categoryMapStats[cat]) {
                categoryMapStats[cat] = { category: cat, cost: 0, liters: 0, vehicleCount: new Set(), km: 0 };
            }
            categoryMapStats[cat].cost += (Number(r.cost) || 0);
            categoryMapStats[cat].liters += (Number(r.liters) || 0);
            categoryMapStats[cat].vehicleCount.add(r.vehicle);
        });

        const categoryBreakdown = Object.values(categoryMapStats).map(c => ({
            category: c.category,
            cost: c.cost,
            liters: c.liters,
            vehicleCount: c.vehicleCount.size,
            percentCost: totalCost > 0 ? (c.cost / totalCost) * 100 : 0
        })).sort((a, b) => b.cost - a.cost);

        // --- EVOLUÇÃO TEMPORAL (DIÁRIA E MENSAL) ---
        // 1. Diária no Período
        const dailyMap: Record<string, { date: string; displayDate: string; cost: number; liters: number; count: number }> = {};
        filtered.forEach(r => {
            const dStr = r.date.substring(0, 10);
            const [y, m, d] = dStr.split('-');
            const displayDate = `${d}/${m}`;

            if (!dailyMap[dStr]) {
                dailyMap[dStr] = { date: dStr, displayDate, cost: 0, liters: 0, count: 0 };
            }
            dailyMap[dStr].cost += (Number(r.cost) || 0);
            dailyMap[dStr].liters += (Number(r.liters) || 0);
            dailyMap[dStr].count += 1;
        });

        const dailyEvolutionData = Object.keys(dailyMap).sort().map(k => {
            const item = dailyMap[k];
            return {
                ...item,
                avgPrice: item.liters > 0 ? item.cost / item.liters : 0
            };
        });

        // 2. Mensal (Últimos 6 meses)
        const last6MonthsMatches = allRecords.filter(r => {
            const d = new Date(r.date);
            const sixMonthsAgo = new Date(selectedYear, selectedMonth - 5, 1);
            const endOfReferenceMonth = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59, 999);
            return d >= sixMonthsAgo && d <= endOfReferenceMonth;
        });

        const monthlyMap: Record<string, { monthKey: string; month: string; cost: number; liters: number; count: number }> = {};
        last6MonthsMatches.forEach(r => {
            const d = new Date(r.date);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const label = months[d.getMonth()].substring(0, 3);

            if (!monthlyMap[key]) {
                monthlyMap[key] = { monthKey: key, month: label, cost: 0, liters: 0, count: 0 };
            }
            monthlyMap[key].cost += (Number(r.cost) || 0);
            monthlyMap[key].liters += (Number(r.liters) || 0);
            monthlyMap[key].count += 1;
        });

        const monthlyEvolutionData = Object.keys(monthlyMap).sort().map(k => {
            const item = monthlyMap[k];
            return {
                ...item,
                avgPrice: item.liters > 0 ? item.cost / item.liters : 0
            };
        });

        // --- ALERTAS INTELIGENTES & INDICADORES DE ANOMALIA REAIS ---
        // 1. Consumo Fora do Padrão (Km/L < min ou > max)
        const costAlerts = vehicleStats.reduce((acc, v) => {
            const fullVehicle = getVehicleForRecord({ vehicle: v.id } as any);
            if (fullVehicle && v.avgKmL > 0) {
                const min = fullVehicle.minKml;
                const max = fullVehicle.maxKml;

                if (min && v.avgKmL < min) {
                    acc.push({ ...v, alertType: 'low', target: min });
                } else if (max && v.avgKmL > max) {
                    acc.push({ ...v, alertType: 'high', target: max });
                }
            }
            return acc;
        }, [] as (VehicleStat & { alertType: 'low' | 'high', target: number })[]);

        // 2. Abastecimentos Frequentes no Mesmo Dia (Suspeitas)
        const dailyVehicleRefuels: Record<string, AbastecimentoRecord[]> = {};
        filtered.forEach(r => {
            const dKey = `${r.date.substring(0, 10)}_${r.vehicle}`;
            if (!dailyVehicleRefuels[dKey]) dailyVehicleRefuels[dKey] = [];
            dailyVehicleRefuels[dKey].push(r);
        });

        const frequentRefuels = Object.entries(dailyVehicleRefuels)
            .filter(([_, recs]) => recs.length > 1)
            .map(([key, recs]) => {
                const [dateStr, veh] = key.split('_');
                recs.forEach(r => anomalyRecordIdSet.add(r.id));
                return {
                    date: dateStr,
                    vehicle: veh,
                    count: recs.length,
                    totalLiters: recs.reduce((sum, r) => sum + (Number(r.liters) || 0), 0),
                    totalCost: recs.reduce((sum, r) => sum + (Number(r.cost) || 0), 0),
                    records: recs
                };
            });

        // 3. Preços Unitários Atípicos (> 15% de variação em relação à média do combustível no período)
        const fuelAvgPrices: Record<string, number> = {};
        fuelBreakdown.forEach(f => {
            fuelAvgPrices[f.name.toUpperCase()] = f.avgPrice;
        });

        const unusualPriceRecords = filtered.filter(r => {
            const rawType = r.fuelType || '';
            const cleanType = rawType.includes(' - ') ? rawType.split(' - ')[0].trim().toUpperCase() : rawType.trim().toUpperCase();
            const avgP = fuelAvgPrices[cleanType];
            const unitP = Number(r.unit_price) || (r.liters > 0 ? r.cost / r.liters : 0);

            if (avgP > 0 && unitP > 0) {
                const diffPct = Math.abs((unitP - avgP) / avgP);
                if (diffPct > 0.15) {
                    anomalyRecordIdSet.add(r.id);
                    return true;
                }
            }
            return false;
        });

        // 4. Possíveis Duplicidades (Mesmo veículo, data e valor)
        const duplicateMap: Record<string, AbastecimentoRecord[]> = {};
        filtered.forEach(r => {
            const dupKey = `${r.date.substring(0, 10)}_${r.vehicle}_${r.cost.toFixed(2)}`;
            if (!duplicateMap[dupKey]) duplicateMap[dupKey] = [];
            duplicateMap[dupKey].push(r);
        });

        const duplicateRecordsGroups = Object.values(duplicateMap)
            .filter(recs => recs.length > 1);
        duplicateRecordsGroups.forEach(group => group.forEach(r => anomalyRecordIdSet.add(r.id)));

        // 5. Alertas de Manutenção Preventiva (Troca de Óleo / Correia Dentada)
        const maintenanceAlerts = vehicles.filter(v => {
            const currentKm = v.currentKm || 0;
            const oilNext = v.oilNextChange || 0;
            const beltNext = v.timingBeltNextChange || 0;

            const isOilDue = oilNext > 0 && currentKm >= (oilNext - 500);
            const isBeltDue = beltNext > 0 && currentKm >= (beltNext - 1000);

            return isOilDue || isBeltDue;
        }).map(v => {
            const currentKm = v.currentKm || 0;
            const oilNext = v.oilNextChange || 0;
            const isOilOverdue = oilNext > 0 && currentKm >= oilNext;
            const isOilNear = oilNext > 0 && currentKm >= (oilNext - 500) && !isOilOverdue;

            return {
                vehicle: v,
                name: `${v.model} (${v.plate})`,
                currentKm,
                oilNext,
                isOilOverdue,
                isOilNear,
                status: isOilOverdue ? 'vencido' : 'proximo'
            };
        });

        // 6. Veículos Inativos da Frota Operacional (+30 dias sem abastecer)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().substring(0, 10);

        const idleVehicles = vehicles.filter(v => {
            if (v.status !== 'operacional') return false;
            const vRecords = allByVehicle[v.plate] || allByVehicle[`${v.model} - ${v.brand}`] || [];
            if (vRecords.length === 0) return true;
            const lastDate = vRecords.reduce((max, r) => r.date > max ? r.date : max, '');
            return lastDate < thirtyDaysAgoStr;
        });

        // --- RANKINGS TOP 10 INTERATIVOS ---
        const topByCost = [...vehicleStats].sort((a, b) => b.totalCost - a.totalCost).slice(0, 10);
        const topByLiters = [...vehicleStats].sort((a, b) => b.totalLiters - a.totalLiters).slice(0, 10);
        const topByKm = [...vehicleStats].sort((a, b) => b.totalKm - a.totalKm).slice(0, 10);
        const topByCostPerKm = [...vehicleStats].filter(v => v.totalKm > 20 && v.costPerKm > 0).sort((a, b) => b.costPerKm - a.costPerKm).slice(0, 10);
        const topEfficient = [...vehicleStats].filter(v => v.avgKmL > 0).sort((a, b) => b.avgKmL - a.avgKmL).slice(0, 10);
        const topInefficient = [...vehicleStats].filter(v => v.avgKmL > 0).sort((a, b) => a.avgKmL - b.avgKmL).slice(0, 10);
        const topByCount = [...vehicleStats].sort((a, b) => b.count - a.count).slice(0, 10);

        return {
            totalCost,
            prevCost,
            costDiff,
            costSavings,
            totalLiters,
            prevLiters,
            litersDiff,
            avgPricePerLiter,
            prevAvgPricePerLiter,
            avgPriceDiff,
            totalTransactions: filtered.length,
            totalKmPeriod: totalDistanceSum,
            prevDistanceSum,
            kmDiffPeriod,
            avgKmL,
            prevAvgKmL,
            avgKmLDiff,
            litersPer100Km,
            costPerKm,
            prevCostPerKm,
            costPerKmDiff,
            avgCostPerVehicle,
            avgLitersPerVehicle,
            avgKmPerVehicle,
            activeVehicles,
            allVehiclesCount: vehicles.length,
            operationalVehiclesCount,
            maintenanceVehiclesCount,
            inactiveVehiclesCount,
            filteredCount: filtered.length,
            records: filtered,
            vehicleStats,
            // Projeções
            projectedMonthlyCost,
            projectedMonthlyLiters,
            projectedCostDiff,
            dailyAvgCost,
            dailyAvgLiters,
            daysPassed,
            daysRemaining,
            isCurrentMonth,
            // Distribuições
            fuelBreakdown,
            fuelChartData,
            stationBreakdown,
            sectorBreakdown,
            sectorChartData,
            categoryBreakdown,
            // Evolução Temporal
            dailyEvolutionData,
            monthlyEvolutionData,
            evolutionChartData: monthlyEvolutionData,
            // Alertas e Anomalias
            costAlerts,
            odometerAnomalies,
            frequentRefuels,
            unusualPriceRecords,
            duplicateRecordsGroups,
            maintenanceAlerts,
            idleVehicles,
            anomalyRecordIdSet,
            // Rankings
            topByCost,
            topByLiters,
            topByKm,
            topByCostPerKm,
            topEfficient,
            topInefficient,
            topByCount,
            topConsumptionVehicles: topByCost.slice(0, 5),
            COLORS
        };
    }, [
        selectedMonth, selectedYear, periodMode, customStartDate, customEndDate, 
        allRecords, vehicles, sectors, 
        filterVehicle, filterSector, filterFuel, filterStation, filterCategory, filterStatus
    ]);

    const sectorStats = useMemo(() => {
        // Find vehicles belonging to the selected sector
        const sectorVehicles = vehicles.filter(v => {
            if (selectedSector === 'all') return true;
            const sectorName = sectors.find(s => s.id === v.sectorId)?.name;
            return sectorName === selectedSector;
        });

        const sectorVehiclePlateSet = new Set<string>();
        sectorVehicles.forEach(v => {
            if (v.plate) sectorVehiclePlateSet.add(v.plate);
            sectorVehiclePlateSet.add(`${v.model} - ${v.brand}`);
        });

        // Records for current month filtered by sector
        const currentMonthRecords = allRecords.filter(r => {
            if (periodMode === 'daily' && customStartDate && customEndDate) {
                const rDateStr = r.date.substring(0, 10);
                return rDateStr >= customStartDate && rDateStr <= customEndDate && sectorVehiclePlateSet.has(r.vehicle);
            }
            const date = new Date(r.date);
            return date.getMonth() === selectedMonth &&
                date.getFullYear() === selectedYear &&
                sectorVehiclePlateSet.has(r.vehicle);
        });

        // Records for previous month for comparison
        const prevMonth = selectedMonth === 0 ? 11 : selectedMonth - 1;
        const prevYear = selectedMonth === 0 ? selectedYear - 1 : selectedYear;
        const prevMonthRecords = allRecords.filter(r => {
            const date = new Date(r.date);
            return date.getMonth() === prevMonth &&
                date.getFullYear() === prevYear &&
                sectorVehiclePlateSet.has(r.vehicle);
        });

        // Helper to calculate totals
        const calcTotals = (recs: AbastecimentoRecord[]) => {
            const totalCost = recs.reduce((sum, r) => sum + r.cost, 0);
            const totalLiters = recs.reduce((sum, r) => sum + r.liters, 0);
            return { totalCost, totalLiters };
        };

        const current = calcTotals(currentMonthRecords);
        const previous = calcTotals(prevMonthRecords);

        // Variations
        const costDiff = previous.totalCost === 0 ? 0 : ((current.totalCost - previous.totalCost) / previous.totalCost) * 100;
        const litersDiff = previous.totalLiters === 0 ? 0 : ((current.totalLiters - previous.totalLiters) / previous.totalLiters) * 100;

        // Active Vehicles count in this period for sector
        const uniqueVehiclesThisMonth = new Set(currentMonthRecords.map(r => r.vehicle)).size;

        // Averages per vehicle
        const avgCostPerVehicle = uniqueVehiclesThisMonth > 0 ? current.totalCost / uniqueVehiclesThisMonth : 0;
        const prevAvgCost = previous.totalCost / (new Set(prevMonthRecords.map(r => r.vehicle)).size || 1);
        const avgCostDiff = prevAvgCost === 0 ? 0 : ((avgCostPerVehicle - prevAvgCost) / prevAvgCost) * 100;

        const avgLitersPerVehicle = uniqueVehiclesThisMonth > 0 ? current.totalLiters / uniqueVehiclesThisMonth : 0;

        // KM driven (Sector specific)
        let totalKmSector = 0;
        let prevTotalKmSector = 0;

        // We reuse the global logic structure but filtered for sector vehicles
        // To be accurate, we need to iterate ALL records for these vehicles to find diffs
        const calcSectorKm = (targetMonth: number, targetYear: number) => {
            let kmSum = 0;
            const sectorRecordsByVehicle: Record<string, AbastecimentoRecord[]> = {};

            // Group relevant sector records
            allRecords.forEach(r => {
                if (sectorVehiclePlateSet.has(r.vehicle)) {
                    if (!sectorRecordsByVehicle[r.vehicle]) sectorRecordsByVehicle[r.vehicle] = [];
                    sectorRecordsByVehicle[r.vehicle].push(r);
                }
            });

            Object.values(sectorRecordsByVehicle).forEach(vRecs => {
                const sorted = vRecs.map(r => ({ ...r, dateObj: new Date(r.date) })).sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
                sorted.forEach((record, index) => {
                    const rDate = record.dateObj;
                    if (rDate.getMonth() === targetMonth && rDate.getFullYear() === targetYear) {
                        const isArla = record.fuelType.toLowerCase().includes('arla');
                        if (!isArla) {
                            let nextRecord = null;
                            for (let i = index + 1; i < sorted.length; i++) {
                                if (!sorted[i].fuelType.toLowerCase().includes('arla')) {
                                    nextRecord = sorted[i];
                                    break;
                                }
                            }
                            if (nextRecord) {
                                const dist = Number(nextRecord.odometer) - Number(record.odometer);
                                if (dist > 0) kmSum += dist;
                            }
                        }
                    }
                });
            });
            return kmSum;
        };

        totalKmSector = calcSectorKm(selectedMonth, selectedYear);
        prevTotalKmSector = calcSectorKm(prevMonth, prevYear);
        const kmDiff = prevTotalKmSector === 0 ? 0 : ((totalKmSector - prevTotalKmSector) / prevTotalKmSector) * 100;

        // Ranking: Spending by Vehicle
        const spendingByVehicle: Record<string, { cost: number, liters: number }> = {};
        currentMonthRecords.forEach(r => {
            if (!spendingByVehicle[r.vehicle]) spendingByVehicle[r.vehicle] = { cost: 0, liters: 0 };
            spendingByVehicle[r.vehicle].cost += r.cost;
            spendingByVehicle[r.vehicle].liters += r.liters;
        });
        const vehicleRankingData = Object.entries(spendingByVehicle)
            .map(([name, data]) => ({ name, value: data.cost, liters: data.liters }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10);

        // Ranking: Driver Supplies
        const statsByDriver: Record<string, { cost: number, liters: number, count: number }> = {};
        currentMonthRecords.forEach(r => {
            const driverName = r.driver || 'Não Identificado';
            if (!statsByDriver[driverName]) statsByDriver[driverName] = { cost: 0, liters: 0, count: 0 };
            statsByDriver[driverName].cost += r.cost;
            statsByDriver[driverName].liters += r.liters;
            statsByDriver[driverName].count += 1;
        });
        const driverRankingData = Object.entries(statsByDriver)
            .map(([name, data]) => ({ name, value: data.cost, liters: data.liters, count: data.count }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10);

        return {
            current,
            costDiff,
            litersDiff,
            avgCostPerVehicle,
            avgCostDiff,
            avgLitersPerVehicle,
            totalKmSector,
            kmDiff,
            vehicleRankingData,
            driverRankingData,
            activeVehiclesCount: uniqueVehiclesThisMonth
        };
    }, [selectedMonth, selectedYear, periodMode, customStartDate, customEndDate, selectedSector, allRecords, vehicles, sectors]);

    const driverStats = useMemo(() => {
        const currentPeriodRecords = allRecords.filter(r => {
            if (periodMode === 'daily' && customStartDate && customEndDate) {
                const rDateStr = r.date.substring(0, 10);
                return rDateStr >= customStartDate && rDateStr <= customEndDate;
            }
            const date = new Date(r.date);
            return date.getMonth() === selectedMonth && date.getFullYear() === selectedYear;
        });

        const groups: Record<string, AbastecimentoRecord[]> = {};
        currentPeriodRecords.forEach(r => {
            const driverName = (r.driver && r.driver.trim()) ? r.driver.trim().toUpperCase() : 'NÃO IDENTIFICADO';
            if (!groups[driverName]) groups[driverName] = [];
            groups[driverName].push(r);
        });

        const list = Object.entries(groups).map(([driverName, recs]) => {
            const totalCost = recs.reduce((sum, r) => sum + r.cost, 0);
            const totalLiters = recs.reduce((sum, r) => sum + r.liters, 0);
            const count = recs.length;

            const sortedByDate = [...recs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            const lastRefuel = sortedByDate[0]?.date || '';

            const vehiclesUsed = Array.from(new Set(recs.map(r => r.vehicle)));

            const matchedPerson = persons.find(p => p.name?.toUpperCase() === driverName);
            let sectorName = 'Geral';
            if (matchedPerson?.sectorId) {
                const s = sectors.find(sec => sec.id === matchedPerson.sectorId);
                if (s) sectorName = s.name;
            } else if (vehiclesUsed.length > 0) {
                const matchedV = vehicles.find(v => v.plate === vehiclesUsed[0] || `${v.model} - ${v.brand}` === vehiclesUsed[0]);
                if (matchedV?.sectorId) {
                    const s = sectors.find(sec => sec.id === matchedV.sectorId);
                    if (s) sectorName = s.name;
                }
            }

            let efficiencySum = 0;
            let efficiencyCount = 0;
            recs.forEach(r => {
                const eff = (r as any).efficiency;
                if (eff && eff > 0) {
                    efficiencySum += eff;
                    efficiencyCount++;
                }
            });
            const avgKmL = efficiencyCount > 0 ? efficiencySum / efficiencyCount : 0;

            return {
                name: driverName,
                personId: matchedPerson?.id,
                cpf: matchedPerson?.cpf,
                sectorName,
                totalCost,
                totalLiters,
                count,
                lastRefuel,
                vehiclesUsed,
                avgKmL,
                records: sortedByDate
            };
        });

        list.sort((a, b) => b.totalCost - a.totalCost);
        return list;
    }, [allRecords, selectedMonth, selectedYear, periodMode, customStartDate, customEndDate, persons, sectors, vehicles]);

    const reportData = useMemo(() => {
        // Pre-process all records to include derived sector/plate once
        const processedRecords = allRecords.map(r => {
            // Find vehicle check: prioritize Plate (new format) OR "Model - Brand" (legacy format)
            // Some records might have just the plate or just the model-brand string.
            const veh = vehicles.find(v =>
                (v.plate && v.plate === r.vehicle) ||
                (`${v.model} - ${v.brand}` === r.vehicle) ||
                (v.plate && r.vehicle.includes(v.plate))
            );

            const s = sectors.find(sec => sec.id === veh?.sectorId);

            return {
                ...r,
                derivedSector: s?.name || 'Não Identificado',
                derivedPlate: veh?.plate || 'S/P'
            };
        });

        const filtered = processedRecords.filter(r => {
            const rDate = new Date(r.date);

            // Helper to parse "YYYY-MM-DD" as local date
            const parseLocalDate = (dateStr: string) => {
                const [y, m, d] = dateStr.split('-').map(Number);
                return new Date(y, m - 1, d);
            };

            const start = appliedFilters.startDate ? parseLocalDate(appliedFilters.startDate) : null;
            const end = appliedFilters.endDate ? parseLocalDate(appliedFilters.endDate) : null;

            if (start) {
                start.setHours(0, 0, 0, 0);
                if (rDate < start) return false;
            }
            if (end) {
                end.setHours(23, 59, 59, 999);
                if (rDate > end) return false;
            }

            // Exclude ARLA from Reports UNLESS specifically filtered by it (as per user request to keep general reports clean)
            const fuel = r.fuelType?.toLowerCase() || '';
            const isArla = fuel.includes('arla');
            const arlaSelected = appliedFilters.fuelType.some(f => f.toLowerCase() === 'arla');
            if (isArla && !arlaSelected) return false;

            if (appliedFilters.station !== 'all' && r.station !== appliedFilters.station) return false;
            if (appliedFilters.sector !== 'all' && !r.derivedSector.toLowerCase().includes(appliedFilters.sector.toLowerCase())) return false;
            if (appliedFilters.vehicle !== 'all' && r.vehicle !== appliedFilters.vehicle) return false;
            if (!appliedFilters.fuelType.includes('all')) {
                const hasMatch = appliedFilters.fuelType.some((f: string) => fuel.includes(f));
                if (!hasMatch) return false;
            }
            if (appliedFilters.paymentStatus && appliedFilters.paymentStatus !== 'all') {
                const pStatus = r.payment_status || 'Em Aberto';
                if (pStatus !== appliedFilters.paymentStatus) return false;
            }

            return true;
        });

        const totalLitersByFuel: Record<string, number> = {};
        const totalValueBySector: Record<string, number> = {};
        const totalValueByFuel: Record<string, number> = {};
        const sectorFuelBreakdown: Record<string, {
            dieselLiters: number;
            dieselValue: number;
            gasolinaLiters: number;
            gasolinaValue: number;
            otherLiters: number;
            otherValue: number;
            totalValue: number;
        }> = {};
        const plateFuelSummary: Record<string, {
            plate: string;
            sector: string;
            fuelType: string;
            totalLiters: number;
            totalValue: number;
        }> = {};
        let grandTotalLiters = 0;
        let grandTotalValue = 0;

        filtered.forEach(r => {
            // Fuel aggregation
            const fuel = r.fuelType.split(' - ')[0];
            const fuelLower = fuel.toLowerCase();
            totalLitersByFuel[fuel] = (totalLitersByFuel[fuel] || 0) + r.liters;
            totalValueByFuel[fuel] = (totalValueByFuel[fuel] || 0) + r.cost;
            grandTotalLiters += r.liters;
            grandTotalValue += r.cost;

            // Plate summary logic
            const plate = r.derivedPlate;
            const sectorName = r.derivedSector;
            const plateFuelKey = `${plate}-${fuel}`;
            if (!plateFuelSummary[plateFuelKey]) {
                plateFuelSummary[plateFuelKey] = {
                    plate,
                    sector: sectorName,
                    fuelType: fuel,
                    totalLiters: 0,
                    totalValue: 0
                };
            }
            plateFuelSummary[plateFuelKey].totalLiters += r.liters;
            plateFuelSummary[plateFuelKey].totalValue += r.cost;

            // Sector aggregation
            totalValueBySector[sectorName] = (totalValueBySector[sectorName] || 0) + r.cost;

            // Sector + Fuel detailed breakdown
            if (!sectorFuelBreakdown[sectorName]) {
                sectorFuelBreakdown[sectorName] = {
                    dieselLiters: 0, dieselValue: 0,
                    gasolinaLiters: 0, gasolinaValue: 0,
                    otherLiters: 0, otherValue: 0,
                    totalValue: 0
                };
            }
            if (fuelLower.includes('diesel')) {
                sectorFuelBreakdown[sectorName].dieselLiters += r.liters;
                sectorFuelBreakdown[sectorName].dieselValue += r.cost;
            } else if (fuelLower.includes('gasolina')) {
                sectorFuelBreakdown[sectorName].gasolinaLiters += r.liters;
                sectorFuelBreakdown[sectorName].gasolinaValue += r.cost;
            } else {
                sectorFuelBreakdown[sectorName].otherLiters += r.liters;
                sectorFuelBreakdown[sectorName].otherValue += r.cost;
            }
            sectorFuelBreakdown[sectorName].totalValue += r.cost;
        });

        // Calcular Km Rodado Total e Eficiência Média para os registros filtrados
        let totalKmFiltered = 0;
        let totalEfficiencySumFiltered = 0;
        let efficiencyCountFiltered = 0;
        const filteredIds = new Set(filtered.map(r => r.id));
        
        // Agrupar todos os registros de abastecimento por veículo
        const allByVehicle: Record<string, AbastecimentoRecord[]> = {};
        allRecords.forEach(r => {
            if (!allByVehicle[r.vehicle]) allByVehicle[r.vehicle] = [];
            allByVehicle[r.vehicle].push(r);
        });

        Object.values(allByVehicle).forEach(vehicleRecords => {
            const sorted = vehicleRecords
                .map(r => ({ ...r, dateObj: new Date(r.date) }))
                .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());

            for (let i = 1; i < sorted.length; i++) {
                const record = sorted[i];
                if (filteredIds.has(record.id)) {
                    const prevRecord = sorted[i - 1];
                    const isArla = record.fuelType.toLowerCase().includes('arla') || prevRecord.fuelType.toLowerCase().includes('arla');
                    if (!isArla) {
                        const dist = Number(record.odometer) - Number(prevRecord.odometer);
                        const liters = Number(record.liters);
                        if (dist > 0) {
                            totalKmFiltered += dist;
                            if (liters > 0) {
                                totalEfficiencySumFiltered += (dist / liters);
                                efficiencyCountFiltered++;
                            }
                        }
                    }
                }
            }
        });

        const avgKmLFiltered = efficiencyCountFiltered > 0 ? (totalEfficiencySumFiltered / efficiencyCountFiltered) : 0;

        return {
            records: filtered,
            totalLitersByFuel,
            totalValueBySector,
            totalValueByFuel,
            sectorFuelBreakdown,
            plateFuelSummary,
            grandTotalLiters,
            grandTotalValue,
            grandTotalKm: totalKmFiltered,
            avgKmLFiltered: avgKmLFiltered
        };
    }, [allRecords, appliedFilters, vehicles, sectors]);

    const historyReportData = useMemo(() => {
        if (!selectedHistoryReport) return null;

        // Process all records to include derived sector/plate
        const processedRecords = allRecords.map(r => {
            const veh = vehicles.find(v =>
                (v.plate && v.plate === r.vehicle) ||
                (`${v.model} - ${v.brand}` === r.vehicle) ||
                (v.plate && r.vehicle.includes(v.plate))
            );
            const s = sectors.find(sec => sec.id === veh?.sectorId);
            return {
                ...r,
                derivedSector: s?.name || 'Não Identificado',
                derivedPlate: veh?.plate || 'S/P'
            };
        });

        // Filter by record_ids if available, otherwise fallback to filters
        let filtered = [];
        if (selectedHistoryReport.record_ids && selectedHistoryReport.record_ids.length > 0) {
            filtered = processedRecords.filter(r => selectedHistoryReport.record_ids?.includes(r.id));
        } else {
            // Fallback filtering logic
            filtered = processedRecords.filter(r => {
                const rDate = new Date(r.date);
                const parseLocalDate = (dateStr: string) => {
                    const [y, m, d] = dateStr.split('-').map(Number);
                    return new Date(y, m - 1, d);
                };

                const start = selectedHistoryReport.start_date ? parseLocalDate(selectedHistoryReport.start_date) : null;
                const end = selectedHistoryReport.end_date ? parseLocalDate(selectedHistoryReport.end_date) : null;

                if (start) {
                    start.setHours(0, 0, 0, 0);
                    if (rDate < start) return false;
                }
                if (end) {
                    end.setHours(23, 59, 59, 999);
                    if (rDate > end) return false;
                }

                const fuel = r.fuelType?.toLowerCase() || '';
                const isArla = fuel.includes('arla');
                const arlaSelected = selectedHistoryReport.fuel_type?.toLowerCase().includes('arla');
                if (isArla && !arlaSelected) return false;

                if (selectedHistoryReport.station && r.station !== selectedHistoryReport.station) return false;
                if (selectedHistoryReport.sector && !r.derivedSector.toLowerCase().includes(selectedHistoryReport.sector.toLowerCase())) return false;
                if (selectedHistoryReport.vehicle && r.vehicle !== selectedHistoryReport.vehicle) return false;
                if (selectedHistoryReport.fuel_type) {
                    const allowedTypes = selectedHistoryReport.fuel_type.split(',');
                    const hasMatch = allowedTypes.some((f: string) => fuel.includes(f.trim().toLowerCase()));
                    if (!hasMatch) return false;
                }
                if (selectedHistoryReport.payment_status && selectedHistoryReport.payment_status !== 'all') {
                    const pStatus = r.payment_status || 'Em Aberto';
                    if (pStatus !== selectedHistoryReport.payment_status) return false;
                }
                return true;
            });
        }

        // Compute aggregations
        const totalLitersByFuel: Record<string, number> = {};
        const totalValueBySector: Record<string, number> = {};
        const totalValueByFuel: Record<string, number> = {};
        const sectorFuelBreakdown: Record<string, {
            dieselLiters: number;
            dieselValue: number;
            gasolinaLiters: number;
            gasolinaValue: number;
            otherLiters: number;
            otherValue: number;
            totalValue: number;
        }> = {};
        const plateFuelSummary: Record<string, {
            plate: string;
            sector: string;
            fuelType: string;
            totalLiters: number;
            totalValue: number;
        }> = {};
        let grandTotalLiters = 0;
        let grandTotalValue = 0;

        filtered.forEach(r => {
            const fuel = r.fuelType.split(' - ')[0];
            const fuelLower = fuel.toLowerCase();
            totalLitersByFuel[fuel] = (totalLitersByFuel[fuel] || 0) + r.liters;
            totalValueByFuel[fuel] = (totalValueByFuel[fuel] || 0) + r.cost;
            grandTotalLiters += r.liters;
            grandTotalValue += r.cost;

            const plate = r.derivedPlate;
            const sectorName = r.derivedSector;
            const plateFuelKey = `${plate}-${fuel}`;
            if (!plateFuelSummary[plateFuelKey]) {
                plateFuelSummary[plateFuelKey] = {
                    plate,
                    sector: sectorName,
                    fuelType: fuel,
                    totalLiters: 0,
                    totalValue: 0
                };
            }
            plateFuelSummary[plateFuelKey].totalLiters += r.liters;
            plateFuelSummary[plateFuelKey].totalValue += r.cost;

            totalValueBySector[sectorName] = (totalValueBySector[sectorName] || 0) + r.cost;

            if (!sectorFuelBreakdown[sectorName]) {
                sectorFuelBreakdown[sectorName] = {
                    dieselLiters: 0, dieselValue: 0,
                    gasolinaLiters: 0, gasolinaValue: 0,
                    otherLiters: 0, otherValue: 0,
                    totalValue: 0
                };
            }
            if (fuelLower.includes('diesel')) {
                sectorFuelBreakdown[sectorName].dieselLiters += r.liters;
                sectorFuelBreakdown[sectorName].dieselValue += r.cost;
            } else if (fuelLower.includes('gasolina')) {
                sectorFuelBreakdown[sectorName].gasolinaLiters += r.liters;
                sectorFuelBreakdown[sectorName].gasolinaValue += r.cost;
            } else {
                sectorFuelBreakdown[sectorName].otherLiters += r.liters;
                sectorFuelBreakdown[sectorName].otherValue += r.cost;
            }
            sectorFuelBreakdown[sectorName].totalValue += r.cost;
        });

        return {
            records: filtered,
            totalLitersByFuel,
            totalValueBySector,
            totalValueByFuel,
            sectorFuelBreakdown,
            plateFuelSummary,
            grandTotalLiters,
            grandTotalValue
        };
    }, [allRecords, selectedHistoryReport, vehicles, sectors]);

    const handleDownloadHistoryReport = (history: AbastecimentoReportHistory) => {
        setSelectedHistoryReport(history);
        setShowHistoryPrintPreview(true);
    };

    const renderSectorView = () => (
        <div className="space-y-6 animate-fade-in pb-20">
            {/* Sector Filters */}
            <div className="bg-white rounded-[1.5rem] sm:rounded-[2rem] shadow-sm border border-slate-200 p-4 sm:p-6 wide:p-8">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600">
                            <Factory className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-900 uppercase">Visão por Setor</h2>
                            <p className="text-slate-500 text-sm font-medium">Análise detalhada de consumo por departamento</p>
                        </div>
                    </div>

                    <div className="w-full lg:w-72">
                        <ModernSelect
                            label="Selecione o Setor"
                            value={selectedSector}
                            onChange={setSelectedSector}
                            options={[
                                ...(isAdmin ? [{ value: 'all', label: 'Todos os Setores (Global)' }] : []),
                                ...availableSectors.map(s => ({ value: s.name, label: s.name }))
                            ]}
                            icon={Factory}
                            placeholder="Todos os Setores"
                            searchable
                        />
                    </div>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                {/* Total Cost */}
                <div className="bg-white p-4 sm:p-6 rounded-[1.5rem] sm:rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden group hover:border-indigo-200 transition-all">
                    <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <DollarSign className="w-24 h-24" />
                    </div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Gasto Total</p>
                    <p className="text-xl sm:text-2xl font-black text-slate-900">{formatCurrency(sectorStats.current.totalCost)}</p>
                    <div className={`text-xs font-bold mt-2 flex items-center gap-1 ${sectorStats.costDiff > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                        {sectorStats.costDiff > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingUp className="w-3 h-3 rotate-180" />}
                        {sectorStats.costDiff === 0 
                            ? 'Sem variação vs mês anterior' 
                            : `${Math.abs(sectorStats.costDiff).toFixed(1)}% ${sectorStats.costDiff > 0 ? 'maior' : 'menor'} que o mês anterior`}
                    </div>
                </div>

                {/* Avg Cost per Vehicle */}
                <div className="bg-white p-4 sm:p-6 rounded-[1.5rem] sm:rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden group hover:border-indigo-200 transition-all">
                    <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <Car className="w-24 h-24" />
                    </div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Custo Médio / Veículo</p>
                    <p className="text-xl sm:text-2xl font-black text-slate-900">{formatCurrency(sectorStats.avgCostPerVehicle)}</p>
                    <div className={`text-xs font-bold mt-2 flex items-center gap-1 ${sectorStats.avgCostDiff > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                        {sectorStats.avgCostDiff > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingUp className="w-3 h-3 rotate-180" />}
                        {sectorStats.avgCostDiff === 0 
                            ? 'Sem variação vs mês anterior' 
                            : `${Math.abs(sectorStats.avgCostDiff).toFixed(1)}% ${sectorStats.avgCostDiff > 0 ? 'maior' : 'menor'} que o mês anterior`}
                    </div>
                </div>

                {/* Total KM */}
                <div className="bg-white p-4 sm:p-6 rounded-[1.5rem] sm:rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden group hover:border-indigo-200 transition-all">
                    <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <MapPin className="w-24 h-24" />
                    </div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Total Percorrido</p>
                    <p className="text-xl sm:text-2xl font-black text-slate-900">{sectorStats.totalKmSector.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km</p>
                    <div className={`text-xs font-bold mt-2 flex items-center gap-1 ${sectorStats.kmDiff > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {sectorStats.kmDiff > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingUp className="w-3 h-3 rotate-180" />}
                        {sectorStats.kmDiff === 0 
                            ? 'Sem variação vs mês anterior' 
                            : `${Math.abs(sectorStats.kmDiff).toFixed(1)}% ${sectorStats.kmDiff > 0 ? 'maior' : 'menor'} que o mês anterior`}
                    </div>
                </div>

                {/* Active Vehicles */}
                <div className="bg-white p-4 sm:p-6 rounded-[1.5rem] sm:rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden group hover:border-indigo-200 transition-all">
                    <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <Truck className="w-24 h-24" />
                    </div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Veículos Ativos</p>
                    <p className="text-xl sm:text-2xl font-black text-slate-900">{sectorStats.activeVehiclesCount}</p>
                    <p className="text-[10px] text-slate-400 font-medium mt-2">
                        De {sectorStats.activeVehiclesCount} veículos vinculados
                    </p>
                </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Ranking Vehicle Cost */}
                <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-6 flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-indigo-500" />
                        Ranking de Gastos por Veículo
                    </h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={sectorStats.vehicleRankingData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }} />
                                <Tooltip
                                    cursor={{ fill: '#f8fafc' }}
                                    content={({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                            const data = payload[0].payload;
                                            return (
                                                <div className="bg-white p-3 rounded-2xl shadow-xl border border-slate-100 min-w-[150px]">
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">{data.name}</p>
                                                    <p className="text-lg font-black text-indigo-600">{formatCurrency(data.value)}</p>
                                                    <p className="text-xs font-bold text-slate-500">{data.liters.toFixed(1)} Litros</p>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={24}>
                                    {
                                        sectorStats.vehicleRankingData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={index < 3 ? '#4f46e5' : '#818cf8'} />
                                        ))
                                    }
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Ranking Driver Supplies Count */}
                <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-6 flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-emerald-500" />
                        Ranking de Abastecimentos (Motorista)
                    </h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={sectorStats.driverRankingData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }} />
                                <Tooltip
                                    cursor={{ fill: '#f8fafc' }}
                                    content={({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                            const data = payload[0].payload;
                                            return (
                                                <div className="bg-white p-3 rounded-2xl shadow-xl border border-slate-100 min-w-[150px]">
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">{data.name}</p>
                                                    <p className="text-lg font-black text-emerald-600">{formatCurrency(data.value)}</p>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-xs font-bold text-slate-500">{data.liters.toFixed(1)} L</span>
                                                        <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                                        <span className="text-[10px] font-bold text-slate-400">{data.count} abastecimentos</span>
                                                    </div>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <Bar dataKey="value" fill="#10b981" radius={[0, 4, 4, 0]} barSize={24}>
                                    {
                                        sectorStats.driverRankingData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={index < 3 ? '#059669' : '#34d399'} />
                                        ))
                                    }
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );

    const [savedEmpenhoReports, setSavedEmpenhoReports] = useState<any[]>([]);

    const loadSavedEmpenhoReports = async () => {
        const { data } = await supabase.storage.from('attachments').list('empenho_reports', { limit: 100 });
        if (data && data.length > 0) {
            // Sort by created_at descending
            setSavedEmpenhoReports(data.filter(f => f.name.endsWith('.pdf')).sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()));
        } else {
            setSavedEmpenhoReports([]);
        }
    };

    const renderOverview = () => {
        const activeFiltersCount = (filterVehicle !== 'all' ? 1 : 0) +
            (filterSector !== 'all' ? 1 : 0) +
            (filterFuel !== 'all' ? 1 : 0) +
            (filterStation !== 'all' ? 1 : 0) +
            (filterCategory !== 'all' ? 1 : 0) +
            (filterStatus !== 'all' ? 1 : 0) +
            (filterAnomalyOnly ? 1 : 0);

        const resetOverviewFilters = () => {
            setFilterVehicle('all');
            setFilterSector('all');
            setFilterFuel('all');
            setFilterStation('all');
            setFilterCategory('all');
            setFilterStatus('all');
            setFilterAnomalyOnly(false);
        };

        return (
            <div className="space-y-6 animate-fade-in pb-12">
                {/* 1. Barra de Filtros Rápidos da Frota */}
                <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-xs">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-100">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl">
                                <SlidersHorizontal className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-sm font-black text-slate-800 tracking-tight flex items-center gap-2">
                                    Filtros Dinâmicos da Frota
                                    {activeFiltersCount > 0 && (
                                        <span className="px-2 py-0.5 bg-indigo-600 text-white rounded-full text-[10px] font-black">
                                            {activeFiltersCount} ativo{activeFiltersCount > 1 ? 's' : ''}
                                        </span>
                                    )}
                                </h3>
                                <p className="text-xs text-slate-400 font-medium">Refine os indicadores, gráficos e relatórios em tempo real</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            {/* Toggle de Anomalias */}
                            <button
                                onClick={() => setFilterAnomalyOnly(!filterAnomalyOnly)}
                                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                                    filterAnomalyOnly
                                        ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20 ring-2 ring-rose-300'
                                        : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-100'
                                }`}
                            >
                                <AlertTriangle className="w-4 h-4" />
                                <span>Apenas Anomalias</span>
                                {stats.odometerAnomalies.length + stats.costAlerts.length + stats.frequentRefuels.length + stats.unusualPriceRecords.length > 0 && (
                                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${filterAnomalyOnly ? 'bg-white text-rose-600' : 'bg-rose-200 text-rose-800'}`}>
                                        {stats.odometerAnomalies.length + stats.costAlerts.length + stats.frequentRefuels.length + stats.unusualPriceRecords.length}
                                    </span>
                                )}
                            </button>

                            {activeFiltersCount > 0 && (
                                <button
                                    onClick={resetOverviewFilters}
                                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
                                >
                                    <X className="w-3.5 h-3.5" />
                                    Limpar Filtros
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Grid de Controles de Filtros */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                        {/* Veículo */}
                        <div>
                            <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">Veículo</label>
                            <select
                                value={filterVehicle}
                                onChange={(e) => setFilterVehicle(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
                            >
                                <option value="all">Todos os Veículos ({vehicles.length})</option>
                                {vehicles.map(v => (
                                    <option key={v.id} value={v.plate || v.model}>
                                        {v.plate ? `${v.plate} - ${v.model}` : v.model}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Secretaria / Setor */}
                        <div>
                            <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">Secretaria / Setor</label>
                            <select
                                value={filterSector}
                                onChange={(e) => setFilterSector(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
                            >
                                <option value="all">Todas as Secretarias</option>
                                {availableSectors.map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Combustível */}
                        <div>
                            <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">Combustível</label>
                            <select
                                value={filterFuel}
                                onChange={(e) => setFilterFuel(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
                            >
                                <option value="all">Todos os Tipos</option>
                                <option value="diesel">Diesel (S10 / Comum)</option>
                                <option value="gasolina">Gasolina</option>
                                <option value="etanol">Etanol</option>
                                <option value="arla">Arla 32</option>
                            </select>
                        </div>

                        {/* Posto / Fornecedor */}
                        <div>
                            <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">Posto / Fornecedor</label>
                            <select
                                value={filterStation}
                                onChange={(e) => setFilterStation(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
                            >
                                <option value="all">Todos os Postos</option>
                                {gasStations.map(st => (
                                    <option key={st.id} value={st.name}>{st.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Categoria do Veículo */}
                        <div>
                            <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">Categoria da Frota</label>
                            <select
                                value={filterCategory}
                                onChange={(e) => setFilterCategory(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
                            >
                                <option value="all">Todas as Categorias</option>
                                <option value="Carro">Carros / Leves</option>
                                <option value="Moto">Motos</option>
                                <option value="Van">Vans / Utilitários</option>
                                <option value="Ônibus">Ônibus / Micro-ônibus</option>
                                <option value="Caminhão">Caminhões / Pesados</option>
                                <option value="Máquina Pesada">Máquinas Pesadas</option>
                                <option value="Acessórios">Acessórios / Implementos</option>
                            </select>
                        </div>

                        {/* Status */}
                        <div>
                            <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">Status Operacional</label>
                            <select
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
                            >
                                <option value="all">Todos os Status</option>
                                <option value="operacional">Operacional</option>
                                <option value="manutencao">Em Manutenção</option>
                                <option value="vistoria">Em Vistoria</option>
                                <option value="nao_liberado">Não Liberado / Inativo</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* 2. Top KPI Grid (8 Cards Principais da Frota) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Custo Total */}
                    <div 
                        onClick={() => setDrillDownModal({
                            isOpen: true,
                            title: 'Detalhamento: Custo Total de Abastecimento',
                            subtitle: 'Todos os registros que compõem o gasto do período',
                            records: stats.records,
                            metricType: 'cost'
                        })}
                        className="bg-white p-5 sm:p-6 rounded-[1.75rem] border border-slate-200/90 shadow-xs relative overflow-hidden group hover:shadow-md hover:border-emerald-300 transition-all cursor-pointer"
                    >
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            <DollarSign className="w-24 h-24 text-emerald-600" />
                        </div>
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600 group-hover:scale-110 transition-transform">
                                    <DollarSign className="w-5 h-5" />
                                </div>
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Custo Total</span>
                            </div>
                            <span className="text-[10px] font-bold text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                                Ver detalhes <ChevronRight className="w-3 h-3" />
                            </span>
                        </div>
                        <div className="relative z-10">
                            <h3 className="text-2xl sm:text-3xl font-black text-emerald-950 tracking-tight">
                                {formatCurrency(stats.totalCost)}
                            </h3>
                            <div className={`flex items-center gap-1 mt-1 text-xs font-bold ${stats.costDiff > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                {stats.costDiff > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                                <span>
                                    {stats.costDiff === 0 
                                        ? 'Sem variação vs anterior' 
                                        : `${Math.abs(stats.costDiff).toFixed(1)}% ${stats.costDiff > 0 ? 'maior' : 'menor'} vs anterior`}
                                </span>
                            </div>
                            <p className="text-[10px] text-slate-400 font-semibold mt-1">
                                {stats.costSavings > 0 
                                    ? `Economia de ${formatCurrency(stats.costSavings)}` 
                                    : stats.costSavings < 0 
                                    ? `Aumento de ${formatCurrency(Math.abs(stats.costSavings))}` 
                                    : 'Estável em relação ao período anterior'}
                            </p>
                        </div>
                    </div>

                    {/* Volume Total */}
                    <div 
                        onClick={() => setDrillDownModal({
                            isOpen: true,
                            title: 'Detalhamento: Volume Total Abastecido',
                            subtitle: `${formatNumber(stats.totalLiters)} Litros em ${stats.filteredCount} abastecimentos`,
                            records: stats.records,
                            metricType: 'liters'
                        })}
                        className="bg-white p-5 sm:p-6 rounded-[1.75rem] border border-slate-200/90 shadow-xs relative overflow-hidden group hover:shadow-md hover:border-cyan-300 transition-all cursor-pointer"
                    >
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            <Droplet className="w-24 h-24 text-cyan-600" />
                        </div>
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-cyan-50 rounded-xl text-cyan-600 group-hover:scale-110 transition-transform">
                                    <Droplet className="w-5 h-5" />
                                </div>
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Volume Total</span>
                            </div>
                            <span className="text-[10px] font-bold text-cyan-600 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                                Ver detalhes <ChevronRight className="w-3 h-3" />
                            </span>
                        </div>
                        <div className="relative z-10">
                            <h3 className="text-2xl sm:text-3xl font-black text-cyan-950 tracking-tight">
                                {formatNumber(stats.totalLiters)} <span className="text-lg text-slate-400 font-bold">L</span>
                            </h3>
                            <div className={`flex items-center gap-1 mt-1 text-xs font-bold ${stats.litersDiff > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                {stats.litersDiff > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                                <span>
                                    {stats.litersDiff === 0 
                                        ? 'Sem variação vs anterior' 
                                        : `${Math.abs(stats.litersDiff).toFixed(1)}% ${stats.litersDiff > 0 ? 'maior' : 'menor'} vs anterior`}
                                </span>
                            </div>
                            <p className="text-[10px] text-slate-400 font-semibold mt-1">
                                {stats.filteredCount} abastecimentos realizados
                            </p>
                        </div>
                    </div>

                    {/* Preço Médio / Litro */}
                    <div 
                        onClick={() => setDrillDownModal({
                            isOpen: true,
                            title: 'Detalhamento: Preço Médio por Litro',
                            subtitle: `Preço médio calculado de ${formatCurrency(stats.avgPricePerLiter)} por litro`,
                            records: stats.records,
                            metricType: 'price'
                        })}
                        className="bg-white p-5 sm:p-6 rounded-[1.75rem] border border-slate-200/90 shadow-xs relative overflow-hidden group hover:shadow-md hover:border-amber-300 transition-all cursor-pointer"
                    >
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            <CreditCard className="w-24 h-24 text-amber-600" />
                        </div>
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-amber-50 rounded-xl text-amber-600 group-hover:scale-110 transition-transform">
                                    <CreditCard className="w-5 h-5" />
                                </div>
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Preço Médio / L</span>
                            </div>
                            <span className="text-[10px] font-bold text-amber-600 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                                Ver detalhes <ChevronRight className="w-3 h-3" />
                            </span>
                        </div>
                        <div className="relative z-10">
                            <h3 className="text-2xl sm:text-3xl font-black text-amber-950 tracking-tight">
                                {formatCurrency(stats.avgPricePerLiter)}
                            </h3>
                            <div className={`flex items-center gap-1 mt-1 text-xs font-bold ${stats.avgPriceDiff > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                {stats.avgPriceDiff > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                                <span>
                                    {stats.avgPriceDiff === 0 
                                        ? 'Sem variação vs anterior' 
                                        : `${Math.abs(stats.avgPriceDiff).toFixed(1)}% ${stats.avgPriceDiff > 0 ? 'mais caro' : 'mais barato'} vs anterior`}
                                </span>
                            </div>
                            <p className="text-[10px] text-slate-400 font-semibold mt-1">
                                Anterior: {formatCurrency(stats.prevAvgPricePerLiter || 0)} / L
                            </p>
                        </div>
                    </div>

                    {/* Média Geral KM/L e L/100km */}
                    <div 
                        onClick={() => setDrillDownModal({
                            isOpen: true,
                            title: 'Detalhamento: Consumo Médio da Frota',
                            subtitle: `Eficiência média ponderada de ${formatNumber(stats.avgKmL, 2)} Km/L`,
                            records: stats.records,
                            metricType: 'efficiency'
                        })}
                        className="bg-white p-5 sm:p-6 rounded-[1.75rem] border border-slate-200/90 shadow-xs relative overflow-hidden group hover:shadow-md hover:border-violet-300 transition-all cursor-pointer"
                    >
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            <Gauge className="w-24 h-24 text-violet-600" />
                        </div>
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-violet-50 rounded-xl text-violet-600 group-hover:scale-110 transition-transform">
                                    <Gauge className="w-5 h-5" />
                                </div>
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Consumo Médio</span>
                            </div>
                            <span className="text-[10px] font-bold text-violet-600 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                                Ver detalhes <ChevronRight className="w-3 h-3" />
                            </span>
                        </div>
                        <div className="relative z-10">
                            <h3 className="text-2xl sm:text-3xl font-black text-violet-950 tracking-tight">
                                {stats.avgKmL > 0 ? (
                                    <>
                                        {formatNumber(stats.avgKmL, 1)} <span className="text-sm sm:text-lg text-slate-400 font-bold">Km/L</span>
                                    </>
                                ) : (
                                    <span className="text-base text-slate-400 font-semibold">Dados insuficientes</span>
                                )}
                            </h3>
                            <div className={`flex items-center gap-1 mt-1 text-xs font-bold ${stats.avgKmLDiff > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                {stats.avgKmLDiff > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                                <span>
                                    {stats.avgKmLDiff === 0 
                                        ? 'Sem variação vs anterior' 
                                        : `${Math.abs(stats.avgKmLDiff).toFixed(1)}% ${stats.avgKmLDiff > 0 ? 'mais eficiente' : 'menos eficiente'} vs anterior`}
                                </span>
                            </div>
                            <p className="text-[10px] text-slate-400 font-semibold mt-1">
                                {stats.litersPer100Km > 0 ? `${formatNumber(stats.litersPer100Km, 1)} L / 100 km` : 'Consumo por 100km'}
                            </p>
                        </div>
                    </div>

                    {/* Quilometragem Total Rodada */}
                    <div 
                        onClick={() => setDrillDownModal({
                            isOpen: true,
                            title: 'Detalhamento: Quilometragem Rodada no Período',
                            subtitle: `${formatNumber(stats.totalKmPeriod)} KM percorridos pelos veículos ativos`,
                            records: stats.records,
                            metricType: 'km'
                        })}
                        className="bg-white p-5 sm:p-6 rounded-[1.75rem] border border-slate-200/90 shadow-xs relative overflow-hidden group hover:shadow-md hover:border-blue-300 transition-all cursor-pointer"
                    >
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            <MapPin className="w-24 h-24 text-blue-600" />
                        </div>
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-blue-50 rounded-xl text-blue-600 group-hover:scale-110 transition-transform">
                                    <MapPin className="w-5 h-5" />
                                </div>
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Rodagem Total</span>
                            </div>
                            <span className="text-[10px] font-bold text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                                Ver detalhes <ChevronRight className="w-3 h-3" />
                            </span>
                        </div>
                        <div className="relative z-10">
                            <h3 className="text-2xl sm:text-3xl font-black text-blue-950 tracking-tight">
                                {stats.totalKmPeriod > 0 ? (
                                    <>
                                        {formatNumber(stats.totalKmPeriod)} <span className="text-sm sm:text-lg text-slate-400 font-bold">Km</span>
                                    </>
                                ) : (
                                    <span className="text-base text-slate-400 font-semibold">0 Km</span>
                                )}
                            </h3>
                            <div className={`flex items-center gap-1 mt-1 text-xs font-bold ${stats.kmDiffPeriod > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                {stats.kmDiffPeriod > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                                <span>
                                    {stats.kmDiffPeriod === 0 
                                        ? 'Sem variação vs anterior' 
                                        : `${Math.abs(stats.kmDiffPeriod).toFixed(1)}% ${stats.kmDiffPeriod > 0 ? 'maior' : 'menor'} vs anterior`}
                                </span>
                            </div>
                            <p className="text-[10px] text-slate-400 font-semibold mt-1">
                                Média de {formatNumber(stats.avgKmPerVehicle, 0)} Km / veículo ativo
                            </p>
                        </div>
                    </div>

                    {/* Custo por KM */}
                    <div 
                        onClick={() => setDrillDownModal({
                            isOpen: true,
                            title: 'Detalhamento: Custo Operacional por KM',
                            subtitle: `Custo médio de ${formatCurrency(stats.costPerKm)} para cada quilômetro rodado`,
                            records: stats.records,
                            metricType: 'costPerKm'
                        })}
                        className="bg-white p-5 sm:p-6 rounded-[1.75rem] border border-slate-200/90 shadow-xs relative overflow-hidden group hover:shadow-md hover:border-teal-300 transition-all cursor-pointer"
                    >
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            <Activity className="w-24 h-24 text-teal-600" />
                        </div>
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-teal-50 rounded-xl text-teal-600 group-hover:scale-110 transition-transform">
                                    <Activity className="w-5 h-5" />
                                </div>
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Custo / KM</span>
                            </div>
                            <span className="text-[10px] font-bold text-teal-600 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                                Ver detalhes <ChevronRight className="w-3 h-3" />
                            </span>
                        </div>
                        <div className="relative z-10">
                            <h3 className="text-2xl sm:text-3xl font-black text-teal-950 tracking-tight">
                                {stats.costPerKm > 0 ? (
                                    <>
                                        {formatCurrency(stats.costPerKm)} <span className="text-xs sm:text-sm text-slate-400 font-bold">/ km</span>
                                    </>
                                ) : (
                                    <span className="text-base text-slate-400 font-semibold">Dados insuficientes</span>
                                )}
                            </h3>
                            <div className={`flex items-center gap-1 mt-1 text-xs font-bold ${stats.costPerKmDiff > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                {stats.costPerKmDiff > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                                <span>
                                    {stats.costPerKmDiff === 0 
                                        ? 'Sem variação vs anterior' 
                                        : `${Math.abs(stats.costPerKmDiff).toFixed(1)}% ${stats.costPerKmDiff > 0 ? 'maior' : 'menor'} vs anterior`}
                                </span>
                            </div>
                            <p className="text-[10px] text-slate-400 font-semibold mt-1">
                                Eficiência financeira do deslocamento
                            </p>
                        </div>
                    </div>

                    {/* Status da Frota */}
                    <div 
                        onClick={() => setActiveTab('vehicle')}
                        className="bg-white p-5 sm:p-6 rounded-[1.75rem] border border-slate-200/90 shadow-xs relative overflow-hidden group hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer"
                    >
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            <Truck className="w-24 h-24 text-indigo-600" />
                        </div>
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600 group-hover:scale-110 transition-transform">
                                    <Truck className="w-5 h-5" />
                                </div>
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Status da Frota</span>
                            </div>
                            <span className="text-[10px] font-bold text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                                Ver frota <ChevronRight className="w-3 h-3" />
                            </span>
                        </div>
                        <div className="relative z-10">
                            <h3 className="text-2xl sm:text-3xl font-black text-indigo-950 tracking-tight">
                                {stats.activeVehicles} <span className="text-sm sm:text-lg text-slate-400 font-bold">/ {stats.allVehiclesCount}</span>
                            </h3>
                            <p className="text-xs font-bold text-slate-500 mt-1">
                                {stats.activeVehicles} veículos ativos no período
                            </p>
                            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-100 text-[10px] font-bold">
                                <span className="text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md">
                                    {stats.operationalVehiclesCount} Operacionais
                                </span>
                                <span className="text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-md">
                                    {stats.maintenanceVehiclesCount} Manutenção
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Média por Veículo */}
                    <div 
                        onClick={() => setDrillDownModal({
                            isOpen: true,
                            title: 'Detalhamento: Médias Gerais por Veículo',
                            subtitle: `Gasto médio de ${formatCurrency(stats.avgCostPerVehicle)} por veículo ativo`,
                            records: stats.records,
                            metricType: 'vehicleAvg'
                        })}
                        className="bg-white p-5 sm:p-6 rounded-[1.75rem] border border-slate-200/90 shadow-xs relative overflow-hidden group hover:shadow-md hover:border-purple-300 transition-all cursor-pointer"
                    >
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            <Fuel className="w-24 h-24 text-purple-600" />
                        </div>
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-purple-50 rounded-xl text-purple-600 group-hover:scale-110 transition-transform">
                                    <Fuel className="w-5 h-5" />
                                </div>
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Média / Veículo</span>
                            </div>
                            <span className="text-[10px] font-bold text-purple-600 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                                Ver detalhes <ChevronRight className="w-3 h-3" />
                            </span>
                        </div>
                        <div className="relative z-10">
                            <h3 className="text-2xl sm:text-3xl font-black text-purple-950 tracking-tight">
                                {formatCurrency(stats.avgCostPerVehicle)}
                            </h3>
                            <p className="text-xs font-bold text-slate-500 mt-1">
                                {formatNumber(stats.avgLitersPerVehicle, 1)} Litros / veículo
                            </p>
                            <p className="text-[10px] text-slate-400 font-semibold mt-1">
                                Média de {stats.activeVehicles > 0 ? (stats.filteredCount / stats.activeVehicles).toFixed(1) : 0} abastecimentos / veículo
                            </p>
                        </div>
                    </div>
                </div>

                {/* 3. Bloco de Projeções Inteligentes & Comparativos */}
                <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-indigo-950 p-6 sm:p-7 rounded-[2rem] text-white shadow-xl relative overflow-hidden border border-indigo-500/20">
                    <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
                        <Sparkles className="w-48 h-48 text-indigo-400" />
                    </div>

                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 relative z-10">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-indigo-500/20 rounded-2xl border border-indigo-400/30 text-indigo-300">
                                <Sparkles className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-lg font-black tracking-tight flex items-center gap-2">
                                    Projeções e Estimativas Inteligentes
                                    <span className="px-2.5 py-0.5 bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 rounded-full text-[10px] font-bold uppercase tracking-wider">
                                        Run-Rate Real
                                    </span>
                                </h3>
                                <p className="text-xs text-indigo-200/80 font-medium">
                                    {stats.isCurrentMonth
                                        ? `Com base nos ${stats.daysPassed} dias decorridos do mês atual (${stats.daysRemaining} dias restantes)`
                                        : 'Consolidado histórico do período selecionado'}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 bg-white/5 border border-white/10 px-4 py-2 rounded-2xl backdrop-blur-md">
                            <Clock className="w-4 h-4 text-indigo-300" />
                            <span className="text-xs font-bold text-indigo-100">
                                Média Diária: <strong className="text-white">{formatCurrency(stats.dailyAvgCost)}</strong> ({formatNumber(stats.dailyAvgLiters, 1)} L/dia)
                            </span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 relative z-10">
                        {/* Projeção de Gasto */}
                        <div className="bg-white/10 border border-white/10 p-4 rounded-2xl backdrop-blur-sm">
                            <span className="text-[10px] font-black uppercase text-indigo-200 tracking-wider">Gasto Projetado no Mês</span>
                            <h4 className="text-2xl font-black text-white mt-1">
                                {formatCurrency(stats.projectedMonthlyCost)}
                            </h4>
                            <div className="flex items-center gap-1 text-[11px] font-bold mt-1 text-indigo-200">
                                <span>Estimativa de fechamento</span>
                            </div>
                        </div>

                        {/* Projeção de Volume */}
                        <div className="bg-white/10 border border-white/10 p-4 rounded-2xl backdrop-blur-sm">
                            <span className="text-[10px] font-black uppercase text-indigo-200 tracking-wider">Volume Projetado no Mês</span>
                            <h4 className="text-2xl font-black text-white mt-1">
                                {formatNumber(stats.projectedMonthlyLiters, 0)} <span className="text-sm text-indigo-200 font-bold">L</span>
                            </h4>
                            <div className="flex items-center gap-1 text-[11px] font-bold mt-1 text-indigo-200">
                                <span>Previsão de consumo</span>
                            </div>
                        </div>

                        {/* Comparativo vs Mês Anterior */}
                        <div className="bg-white/10 border border-white/10 p-4 rounded-2xl backdrop-blur-sm">
                            <span className="text-[10px] font-black uppercase text-indigo-200 tracking-wider">Variação vs Mês Anterior</span>
                            <h4 className="text-2xl font-black text-white mt-1">
                                {stats.costDiff > 0 ? `+${stats.costDiff.toFixed(1)}%` : `${stats.costDiff.toFixed(1)}%`}
                            </h4>
                            <div className={`flex items-center gap-1 text-[11px] font-bold mt-1 ${stats.costDiff <= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                                <span>{stats.costDiff <= 0 ? 'Redução de custos' : 'Aumento de custos'}</span>
                            </div>
                        </div>

                        {/* Preço Médio Praticado */}
                        <div className="bg-white/10 border border-white/10 p-4 rounded-2xl backdrop-blur-sm">
                            <span className="text-[10px] font-black uppercase text-indigo-200 tracking-wider">Preço Médio da Frota</span>
                            <h4 className="text-2xl font-black text-white mt-1">
                                {formatCurrency(stats.avgPricePerLiter)} <span className="text-xs text-indigo-200 font-bold">/ L</span>
                            </h4>
                            <div className={`flex items-center gap-1 text-[11px] font-bold mt-1 ${stats.avgPriceDiff <= 0 ? 'text-emerald-300' : 'text-amber-300'}`}>
                                <span>{stats.avgPriceDiff <= 0 ? 'Preço em queda ou estável' : `+${stats.avgPriceDiff.toFixed(1)}% vs anterior`}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 4. Central de Alertas Inteligentes & Indicadores de Anomalia */}
                <div className="bg-white p-6 sm:p-7 rounded-[2rem] border border-slate-200/90 shadow-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-rose-50 text-rose-600 rounded-2xl">
                                <AlertTriangle className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-2">
                                    Central de Alertas & Indicadores de Anomalia
                                    <span className="px-2.5 py-0.5 bg-rose-100 text-rose-700 rounded-full text-[10px] font-black">
                                        Auditoria Automática
                                    </span>
                                </h3>
                                <p className="text-xs text-slate-400 font-medium">Inconsistências identificadas automaticamente com base nos registros reais</p>
                            </div>
                        </div>

                        <span className="text-xs font-bold text-slate-400">
                            Clique em qualquer alerta para inspecionar os registros
                        </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {/* 1. Consumo Fora da Meta */}
                        {stats.costAlerts.length > 0 ? (
                            <div 
                                onClick={() => setDrillDownModal({
                                    isOpen: true,
                                    title: 'Alerta: Veículos com Consumo Fora da Meta',
                                    subtitle: `${stats.costAlerts.length} veículos com Km/L abaixo do mínimo ou acima do máximo`,
                                    records: stats.records.filter(r => stats.costAlerts.some(a => a.id === r.vehicle)),
                                    metricType: 'alert_consumption'
                                })}
                                className="p-4 bg-rose-50/70 border border-rose-200/80 rounded-2xl hover:bg-rose-100/70 transition-all cursor-pointer group"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-2.5">
                                        <div className="p-2 bg-rose-500 text-white rounded-xl shadow-xs">
                                            <Gauge className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-black text-rose-950 uppercase tracking-tight">Consumo Fora da Meta</h4>
                                            <p className="text-[11px] font-bold text-rose-600">{stats.costAlerts.length} veículo{stats.costAlerts.length > 1 ? 's' : ''} em desacordo</p>
                                        </div>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-rose-400 group-hover:translate-x-0.5 transition-transform" />
                                </div>
                                <div className="mt-3 space-y-1.5">
                                    {stats.costAlerts.slice(0, 2).map((a, i) => (
                                        <div key={i} className="text-[11px] font-semibold text-rose-900 bg-white/80 px-2.5 py-1.5 rounded-lg flex items-center justify-between">
                                            <span className="truncate max-w-[140px]">{a.name}</span>
                                            <span className="font-black text-rose-600">{formatNumber(a.avgKmL, 1)} Km/L</span>
                                        </div>
                                    ))}
                                    {stats.costAlerts.length > 2 && (
                                        <p className="text-[10px] font-bold text-rose-500 text-center pt-1">+ {stats.costAlerts.length - 2} outros veículos</p>
                                    )}
                                </div>
                            </div>
                        ) : null}

                        {/* 2. Inconsistência de Hodômetro */}
                        {stats.odometerAnomalies.length > 0 ? (
                            <div 
                                onClick={() => setDrillDownModal({
                                    isOpen: true,
                                    title: 'Alerta: Inconsistências no Hodômetro',
                                    subtitle: `${stats.odometerAnomalies.length} registros com regressão de KM ou saltos suspeitos`,
                                    records: stats.odometerAnomalies.map(a => a.record),
                                    metricType: 'alert_odometer'
                                })}
                                className="p-4 bg-amber-50/70 border border-amber-200/80 rounded-2xl hover:bg-amber-100/70 transition-all cursor-pointer group"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-2.5">
                                        <div className="p-2 bg-amber-500 text-white rounded-xl shadow-xs">
                                            <AlertCircle className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-black text-amber-950 uppercase tracking-tight">Inconsistência de Hodômetro</h4>
                                            <p className="text-[11px] font-bold text-amber-600">{stats.odometerAnomalies.length} ocorrência{stats.odometerAnomalies.length > 1 ? 's' : ''}</p>
                                        </div>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-amber-400 group-hover:translate-x-0.5 transition-transform" />
                                </div>
                                <div className="mt-3 space-y-1.5">
                                    {stats.odometerAnomalies.slice(0, 2).map((a, i) => (
                                        <div key={i} className="text-[11px] font-semibold text-amber-900 bg-white/80 px-2.5 py-1.5 rounded-lg flex items-center justify-between">
                                            <span className="truncate max-w-[130px]">{a.vehicleName}</span>
                                            <span className="font-bold text-amber-700">
                                                {a.type === 'regression' ? `Regressão (${a.diff} km)` : `Salto (+${a.diff} km)`}
                                            </span>
                                        </div>
                                    ))}
                                    {stats.odometerAnomalies.length > 2 && (
                                        <p className="text-[10px] font-bold text-amber-500 text-center pt-1">+ {stats.odometerAnomalies.length - 2} outras inconsistências</p>
                                    )}
                                </div>
                            </div>
                        ) : null}

                        {/* 3. Abastecimentos Múltiplos no Mesmo Dia */}
                        {stats.frequentRefuels.length > 0 ? (
                            <div 
                                onClick={() => setDrillDownModal({
                                    isOpen: true,
                                    title: 'Alerta: Múltiplos Abastecimentos no Mesmo Dia',
                                    subtitle: `${stats.frequentRefuels.length} veículos abastecidos 2 ou mais vezes na mesma data`,
                                    records: stats.frequentRefuels.flatMap(f => f.records),
                                    metricType: 'alert_frequent'
                                })}
                                className="p-4 bg-orange-50/70 border border-orange-200/80 rounded-2xl hover:bg-orange-100/70 transition-all cursor-pointer group"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-2.5">
                                        <div className="p-2 bg-orange-500 text-white rounded-xl shadow-xs">
                                            <Fuel className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-black text-orange-950 uppercase tracking-tight">Abastecimentos Múltiplos</h4>
                                            <p className="text-[11px] font-bold text-orange-600">{stats.frequentRefuels.length} caso{stats.frequentRefuels.length > 1 ? 's' : ''} no mesmo dia</p>
                                        </div>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-orange-400 group-hover:translate-x-0.5 transition-transform" />
                                </div>
                                <div className="mt-3 space-y-1.5">
                                    {stats.frequentRefuels.slice(0, 2).map((f, i) => (
                                        <div key={i} className="text-[11px] font-semibold text-orange-900 bg-white/80 px-2.5 py-1.5 rounded-lg flex items-center justify-between">
                                            <span className="truncate max-w-[130px]">{f.vehicle}</span>
                                            <span className="font-bold text-orange-700">{f.count}x em {f.date}</span>
                                        </div>
                                    ))}
                                    {stats.frequentRefuels.length > 2 && (
                                        <p className="text-[10px] font-bold text-orange-500 text-center pt-1">+ {stats.frequentRefuels.length - 2} outros casos</p>
                                    )}
                                </div>
                            </div>
                        ) : null}

                        {/* 4. Preço Fora da Média */}
                        {stats.unusualPriceRecords.length > 0 ? (
                            <div 
                                onClick={() => setDrillDownModal({
                                    isOpen: true,
                                    title: 'Alerta: Preço por Litro com Desvio > 15%',
                                    subtitle: `${stats.unusualPriceRecords.length} registros com valor unitário divergente da média`,
                                    records: stats.unusualPriceRecords,
                                    metricType: 'alert_price'
                                })}
                                className="p-4 bg-purple-50/70 border border-purple-200/80 rounded-2xl hover:bg-purple-100/70 transition-all cursor-pointer group"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-2.5">
                                        <div className="p-2 bg-purple-500 text-white rounded-xl shadow-xs">
                                            <CreditCard className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-black text-purple-950 uppercase tracking-tight">Preço Unitário Atípico</h4>
                                            <p className="text-[11px] font-bold text-purple-600">{stats.unusualPriceRecords.length} registro{stats.unusualPriceRecords.length > 1 ? 's' : ''} com desvio</p>
                                        </div>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-purple-400 group-hover:translate-x-0.5 transition-transform" />
                                </div>
                                <div className="mt-3 space-y-1.5">
                                    {stats.unusualPriceRecords.slice(0, 2).map((r, i) => (
                                        <div key={i} className="text-[11px] font-semibold text-purple-900 bg-white/80 px-2.5 py-1.5 rounded-lg flex items-center justify-between">
                                            <span className="truncate max-w-[130px]">{r.vehicle}</span>
                                            <span className="font-bold text-purple-700">{formatCurrency(r.unit_price || (r.liters > 0 ? r.cost / r.liters : 0))} / L</span>
                                        </div>
                                    ))}
                                    {stats.unusualPriceRecords.length > 2 && (
                                        <p className="text-[10px] font-bold text-purple-500 text-center pt-1">+ {stats.unusualPriceRecords.length - 2} outros registros</p>
                                    )}
                                </div>
                            </div>
                        ) : null}

                        {/* 5. Alerta de Manutenção Preventiva (Troca de Óleo) */}
                        {stats.maintenanceAlerts.length > 0 ? (
                            <div 
                                onClick={() => setActiveTab('vehicle')}
                                className="p-4 bg-blue-50/70 border border-blue-200/80 rounded-2xl hover:bg-blue-100/70 transition-all cursor-pointer group"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-2.5">
                                        <div className="p-2 bg-blue-500 text-white rounded-xl shadow-xs">
                                            <Wrench className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-black text-blue-950 uppercase tracking-tight">Manutenção Preventiva</h4>
                                            <p className="text-[11px] font-bold text-blue-600">{stats.maintenanceAlerts.length} veículo{stats.maintenanceAlerts.length > 1 ? 's' : ''} próximo{stats.maintenanceAlerts.length > 1 ? 's' : ''}/vencido{stats.maintenanceAlerts.length > 1 ? 's' : ''}</p>
                                        </div>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-blue-400 group-hover:translate-x-0.5 transition-transform" />
                                </div>
                                <div className="mt-3 space-y-1.5">
                                    {stats.maintenanceAlerts.slice(0, 2).map((m, i) => (
                                        <div key={i} className="text-[11px] font-semibold text-blue-900 bg-white/80 px-2.5 py-1.5 rounded-lg flex items-center justify-between">
                                            <span className="truncate max-w-[130px]">{m.name}</span>
                                            <span className={`font-black ${m.isOilOverdue ? 'text-rose-600' : 'text-blue-600'}`}>
                                                {m.isOilOverdue ? 'Óleo Vencido' : 'Óleo Próximo'}
                                            </span>
                                        </div>
                                    ))}
                                    {stats.maintenanceAlerts.length > 2 && (
                                        <p className="text-[10px] font-bold text-blue-500 text-center pt-1">+ {stats.maintenanceAlerts.length - 2} outros veículos</p>
                                    )}
                                </div>
                            </div>
                        ) : null}

                        {/* 6. Veículos Inativos da Frota Operacional */}
                        {stats.idleVehicles.length > 0 ? (
                            <div 
                                onClick={() => setActiveTab('vehicle')}
                                className="p-4 bg-slate-50 border border-slate-200 rounded-2xl hover:bg-slate-100 transition-all cursor-pointer group"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-2.5">
                                        <div className="p-2 bg-slate-600 text-white rounded-xl shadow-xs">
                                            <Clock className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight">Veículos sem Abastecer</h4>
                                            <p className="text-[11px] font-bold text-slate-500">{stats.idleVehicles.length} veículo{stats.idleVehicles.length > 1 ? 's' : ''} +30 dias sem registro</p>
                                        </div>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                                </div>
                                <div className="mt-3 space-y-1.5">
                                    {stats.idleVehicles.slice(0, 2).map((v, i) => (
                                        <div key={i} className="text-[11px] font-semibold text-slate-700 bg-white px-2.5 py-1.5 rounded-lg flex items-center justify-between border border-slate-100">
                                            <span className="truncate max-w-[150px]">{v.model} ({v.plate})</span>
                                            <span className="font-bold text-slate-400">Inativo</span>
                                        </div>
                                    ))}
                                    {stats.idleVehicles.length > 2 && (
                                        <p className="text-[10px] font-bold text-slate-400 text-center pt-1">+ {stats.idleVehicles.length - 2} outros veículos</p>
                                    )}
                                </div>
                            </div>
                        ) : null}
                    </div>

                    {/* Caso não haja nenhuma anomalia */}
                    {stats.costAlerts.length === 0 && 
                     stats.odometerAnomalies.length === 0 && 
                     stats.frequentRefuels.length === 0 && 
                     stats.unusualPriceRecords.length === 0 && 
                     stats.maintenanceAlerts.length === 0 && (
                        <div className="p-4 bg-emerald-50 border border-emerald-200/80 rounded-2xl flex items-center gap-3 text-emerald-800">
                            <ShieldCheck className="w-6 h-6 text-emerald-600 shrink-0" />
                            <div>
                                <h4 className="text-xs font-black uppercase">Frota em Plena Conformidade</h4>
                                <p className="text-xs font-medium text-emerald-700">Nenhuma anomalia de consumo, hodômetro, preço ou duplicidade foi detectada para os filtros selecionados.</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* 5. Evolução Temporal e Gráficos de Distribuição */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Evolução Temporal Dinâmica (2 Colunas) */}
                    <div className="lg:col-span-2 bg-white p-5 sm:p-6 rounded-[2rem] border border-slate-200/90 shadow-xs">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                            <div>
                                <h3 className="text-lg font-black text-slate-900 tracking-tight">Evolução Temporal</h3>
                                <p className="text-xs text-slate-400 font-medium">Histórico dinâmico de consumo e valores da frota</p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                {/* Seletor Diário vs Mensal */}
                                <div className="flex p-1 bg-slate-100 rounded-xl">
                                    <button
                                        onClick={() => setOverviewEvolutionType('daily')}
                                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${overviewEvolutionType === 'daily' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                                    >
                                        Diário
                                    </button>
                                    <button
                                        onClick={() => setOverviewEvolutionType('monthly')}
                                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${overviewEvolutionType === 'monthly' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                                    >
                                        Mensal
                                    </button>
                                </div>

                                {/* Métrica Ativa */}
                                <div className="flex p-1 bg-slate-100 rounded-xl">
                                    <button
                                        onClick={() => setOverviewChartMetric('cost')}
                                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${overviewChartMetric === 'cost' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                                    >
                                        Custo (R$)
                                    </button>
                                    <button
                                        onClick={() => setOverviewChartMetric('liters')}
                                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${overviewChartMetric === 'liters' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                                    >
                                        Litros (L)
                                    </button>
                                    <button
                                        onClick={() => setOverviewChartMetric('price')}
                                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${overviewChartMetric === 'price' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                                    >
                                        Preço / L
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="h-[280px] sm:h-[320px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart
                                    data={overviewEvolutionType === 'daily' ? stats.dailyEvolutionData : stats.monthlyEvolutionData}
                                    margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                                >
                                    <defs>
                                        <linearGradient id="colorOverview" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/>
                                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis
                                        dataKey={overviewEvolutionType === 'daily' ? 'displayDate' : 'month'}
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 700 }}
                                    />
                                    <YAxis
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 700 }}
                                        tickFormatter={(val) => {
                                            if (overviewChartMetric === 'cost') return `R$ ${val >= 1000 ? (val/1000).toFixed(0) + 'k' : val}`;
                                            if (overviewChartMetric === 'liters') return `${val >= 1000 ? (val/1000).toFixed(0) + 'k' : val} L`;
                                            return `R$ ${val.toFixed(1)}`;
                                        }}
                                    />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '14px', color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                                        formatter={(val: any) => {
                                            if (overviewChartMetric === 'cost') return [formatCurrency(Number(val)), 'Custo Total'];
                                            if (overviewChartMetric === 'liters') return [`${formatNumber(Number(val))} L`, 'Volume'];
                                            return [`${formatCurrency(Number(val))} / L`, 'Preço Médio'];
                                        }}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey={overviewChartMetric === 'cost' ? 'cost' : overviewChartMetric === 'liters' ? 'liters' : 'avgPrice'}
                                        stroke="#6366f1"
                                        strokeWidth={3}
                                        fillOpacity={1}
                                        fill="url(#colorOverview)"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Distribuição por Combustível (1 Coluna) */}
                    <div className="bg-white p-5 sm:p-6 rounded-[2rem] border border-slate-200/90 shadow-xs flex flex-col justify-between">
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h3 className="text-lg font-black text-slate-900 tracking-tight">Combustíveis</h3>
                                    <p className="text-xs text-slate-400 font-medium">Participação por tipo de combustível</p>
                                </div>
                                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                                    <Droplet className="w-5 h-5" />
                                </div>
                            </div>

                            <div className="h-[180px] w-full relative">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={stats.fuelBreakdown}
                                            dataKey="liters"
                                            nameKey="name"
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={50}
                                            outerRadius={75}
                                            paddingAngle={3}
                                        >
                                            {stats.fuelBreakdown.map((_, index) => (
                                                <Cell key={`cell-${index}`} fill={stats.COLORS[index % stats.COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '11px', fontWeight: 'bold' }}
                                            formatter={(val: any, name: any) => [`${formatNumber(Number(val))} L`, name]}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Tabela Resumida de Combustíveis */}
                        <div className="space-y-2 mt-4 pt-4 border-t border-slate-100">
                            {stats.fuelBreakdown.map((f, i) => (
                                <div 
                                    key={i} 
                                    onClick={() => setDrillDownModal({
                                        isOpen: true,
                                        title: `Detalhamento: ${f.name}`,
                                        subtitle: `${formatNumber(f.liters)} L abastecidos (${formatCurrency(f.cost)})`,
                                        records: stats.records.filter(r => (r.fuelType || '').toLowerCase().includes(f.name.toLowerCase())),
                                        metricType: 'fuel'
                                    })}
                                    className="flex items-center justify-between text-xs p-2 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer group"
                                >
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: stats.COLORS[i % stats.COLORS.length] }}></div>
                                        <span className="font-bold text-slate-700 group-hover:text-indigo-600 transition-colors">{f.name}</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="font-black text-slate-900">{formatNumber(f.liters, 0)} L</span>
                                        <span className="text-[10px] text-slate-400 font-semibold ml-1.5">({f.percentLiters.toFixed(1)}%)</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* 6. Postos / Fornecedores e Gastos por Secretaria */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Postos e Fornecedores */}
                    <div className="bg-white p-5 sm:p-6 rounded-[2rem] border border-slate-200/90 shadow-xs">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-lg font-black text-slate-900 tracking-tight">Postos & Fornecedores</h3>
                                <p className="text-xs text-slate-400 font-medium">Distribuição de abastecimentos por credenciado</p>
                            </div>
                            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                                <Building2 className="w-5 h-5" />
                            </div>
                        </div>

                        <div className="space-y-3">
                            {stats.stationBreakdown.map((st, i) => (
                                <div 
                                    key={i}
                                    onClick={() => setDrillDownModal({
                                        isOpen: true,
                                        title: `Detalhamento: ${st.name}`,
                                        subtitle: `${st.count} abastecimentos realizados neste posto`,
                                        records: stats.records.filter(r => (r.station || '').toLowerCase() === st.name.toLowerCase()),
                                        metricType: 'station'
                                    })}
                                    className="p-3.5 bg-slate-50 hover:bg-indigo-50/50 border border-slate-100 hover:border-indigo-200 rounded-2xl transition-all cursor-pointer group"
                                >
                                    <div className="flex items-center justify-between mb-1.5">
                                        <div className="flex items-center gap-2">
                                            <div className="w-7 h-7 bg-white rounded-lg flex items-center justify-center font-black text-xs text-slate-700 shadow-xs border border-slate-100">
                                                {i + 1}
                                            </div>
                                            <div>
                                                <h4 className="text-xs font-black text-slate-800 group-hover:text-indigo-600 transition-colors truncate max-w-[200px] sm:max-w-xs">{st.name}</h4>
                                                <p className="text-[10px] text-slate-400 font-bold">{st.count} abastecimento{st.count > 1 ? 's' : ''}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-black text-slate-900">{formatCurrency(st.cost)}</p>
                                            <p className="text-[10px] text-slate-400 font-bold">{formatNumber(st.liters)} L ({st.percentCost.toFixed(1)}%)</p>
                                        </div>
                                    </div>
                                    {/* Barra de progresso */}
                                    <div className="w-full bg-slate-200/70 h-1.5 rounded-full overflow-hidden">
                                        <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${Math.min(100, st.percentCost)}%` }}></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Gastos por Secretaria / Setor */}
                    <div className="bg-white p-5 sm:p-6 rounded-[2rem] border border-slate-200/90 shadow-xs">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-lg font-black text-slate-900 tracking-tight">Gastos por Secretaria</h3>
                                <p className="text-xs text-slate-400 font-medium">Consumo e custo operacional por departamento</p>
                            </div>
                            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                                <Factory className="w-5 h-5" />
                            </div>
                        </div>

                        <div className="space-y-3">
                            {stats.sectorBreakdown.slice(0, 5).map((sec, i) => (
                                <div 
                                    key={i}
                                    onClick={() => setDrillDownModal({
                                        isOpen: true,
                                        title: `Detalhamento: ${sec.name}`,
                                        subtitle: `${sec.vehicleCount} veículos ativos nesta secretaria`,
                                        records: stats.records.filter(r => {
                                            const v = vehicles.find(veh => veh.plate === r.vehicle || `${veh.model} - ${veh.brand}` === r.vehicle);
                                            return (v?.sectorId === sec.id) || (r.sectorId === sec.id);
                                        }),
                                        metricType: 'sector'
                                    })}
                                    className="p-3.5 bg-slate-50 hover:bg-indigo-50/50 border border-slate-100 hover:border-indigo-200 rounded-2xl transition-all cursor-pointer group"
                                >
                                    <div className="flex items-center justify-between mb-1.5">
                                        <div className="flex items-center gap-2">
                                            <div className="w-7 h-7 bg-white rounded-lg flex items-center justify-center font-black text-xs text-slate-700 shadow-xs border border-slate-100">
                                                {i + 1}
                                            </div>
                                            <div>
                                                <h4 className="text-xs font-black text-slate-800 group-hover:text-indigo-600 transition-colors truncate max-w-[180px] sm:max-w-xs">{sec.name}</h4>
                                                <p className="text-[10px] text-slate-400 font-bold">{sec.vehicleCount} veículo{sec.vehicleCount > 1 ? 's' : ''} ativo{sec.vehicleCount > 1 ? 's' : ''}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-black text-slate-900">{formatCurrency(sec.cost)}</p>
                                            <p className="text-[10px] text-slate-400 font-bold">{formatNumber(sec.liters)} L</p>
                                        </div>
                                    </div>
                                    <div className="w-full bg-slate-200/70 h-1.5 rounded-full overflow-hidden">
                                        <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${Math.min(100, stats.totalCost > 0 ? (sec.cost / stats.totalCost) * 100 : 0)}%` }}></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* 7. Top 10 & Rankings Interativos da Frota */}
                <div className="bg-white p-6 sm:p-7 rounded-[2rem] border border-slate-200/90 shadow-xs">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-2xl">
                                <Award className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-slate-900 tracking-tight">Rankings Top 10 da Frota</h3>
                                <p className="text-xs text-slate-400 font-medium">Métricas de consumo, custos e eficiência por veículo</p>
                            </div>
                        </div>

                        {/* Abas de Navegação do Ranking */}
                        <div className="flex p-1 bg-slate-100 rounded-2xl overflow-x-auto custom-scrollbar">
                            <button
                                onClick={() => setOverviewTopTab('cost')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${overviewTopTab === 'cost' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                            >
                                Maior Gasto (R$)
                            </button>
                            <button
                                onClick={() => setOverviewTopTab('liters')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${overviewTopTab === 'liters' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                            >
                                Maior Volume (L)
                            </button>
                            <button
                                onClick={() => setOverviewTopTab('km')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${overviewTopTab === 'km' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                            >
                                Maior KM
                            </button>
                            <button
                                onClick={() => setOverviewTopTab('costPerKm')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${overviewTopTab === 'costPerKm' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                            >
                                Custo / KM
                            </button>
                            <button
                                onClick={() => setOverviewTopTab('efficiency')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${overviewTopTab === 'efficiency' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                            >
                                Mais Eficientes
                            </button>
                            <button
                                onClick={() => setOverviewTopTab('inefficient')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${overviewTopTab === 'inefficient' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                            >
                                Menos Eficientes
                            </button>
                            <button
                                onClick={() => setOverviewTopTab('count')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${overviewTopTab === 'count' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                            >
                                Mais Abastecidos
                            </button>
                        </div>
                    </div>

                    {/* Lista do Ranking */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {(overviewTopTab === 'cost' ? stats.topByCost :
                          overviewTopTab === 'liters' ? stats.topByLiters :
                          overviewTopTab === 'km' ? stats.topByKm :
                          overviewTopTab === 'costPerKm' ? stats.topByCostPerKm :
                          overviewTopTab === 'efficiency' ? stats.topEfficient :
                          overviewTopTab === 'inefficient' ? stats.topInefficient :
                          stats.topByCount).map((v, i) => (
                            <div 
                                key={i}
                                onClick={() => {
                                    setSelectedVehicle(v.id);
                                    setActiveTab('vehicle');
                                }}
                                className="flex items-center justify-between p-3.5 bg-slate-50 hover:bg-indigo-50/60 border border-slate-100 hover:border-indigo-200 rounded-2xl transition-all cursor-pointer group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs shadow-xs ${
                                        i === 0 ? 'bg-amber-400 text-amber-950 font-black' :
                                        i === 1 ? 'bg-slate-300 text-slate-800 font-black' :
                                        i === 2 ? 'bg-amber-600 text-white font-black' :
                                        'bg-white text-slate-700 border border-slate-200'
                                    }`}>
                                        {i + 1}º
                                    </div>
                                    <div>
                                        <h4 className="text-xs font-black text-slate-900 group-hover:text-indigo-600 transition-colors uppercase truncate max-w-[180px] sm:max-w-xs">{v.name}</h4>
                                        <p className="text-[10px] text-slate-400 font-bold">{v.sectorName} • {v.count} abastecimento{v.count > 1 ? 's' : ''}</p>
                                    </div>
                                </div>

                                <div className="text-right">
                                    {overviewTopTab === 'cost' && (
                                        <>
                                            <p className="text-sm font-black text-slate-900">{formatCurrency(v.totalCost)}</p>
                                            <p className="text-[10px] text-slate-400 font-bold">{formatNumber(v.totalLiters)} L</p>
                                        </>
                                    )}
                                    {overviewTopTab === 'liters' && (
                                        <>
                                            <p className="text-sm font-black text-slate-900">{formatNumber(v.totalLiters)} L</p>
                                            <p className="text-[10px] text-slate-400 font-bold">{formatCurrency(v.totalCost)}</p>
                                        </>
                                    )}
                                    {overviewTopTab === 'km' && (
                                        <>
                                            <p className="text-sm font-black text-slate-900">{formatNumber(v.totalKm)} KM</p>
                                            <p className="text-[10px] text-slate-400 font-bold">{formatCurrency(v.totalCost)}</p>
                                        </>
                                    )}
                                    {overviewTopTab === 'costPerKm' && (
                                        <>
                                            <p className="text-sm font-black text-slate-900">{formatCurrency(v.costPerKm)} / km</p>
                                            <p className="text-[10px] text-slate-400 font-bold">{formatNumber(v.totalKm)} KM rodados</p>
                                        </>
                                    )}
                                    {(overviewTopTab === 'efficiency' || overviewTopTab === 'inefficient') && (
                                        <>
                                            <p className="text-sm font-black text-slate-900">{formatNumber(v.avgKmL, 1)} Km/L</p>
                                            <p className="text-[10px] text-slate-400 font-bold">{formatNumber(v.totalLiters)} L consumidos</p>
                                        </>
                                    )}
                                    {overviewTopTab === 'count' && (
                                        <>
                                            <p className="text-sm font-black text-slate-900">{v.count} abastecimentos</p>
                                            <p className="text-[10px] text-slate-400 font-bold">{formatCurrency(v.totalCost)}</p>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    const renderVehicleDetail = () => {
        if (!selectedVehicle) return null;

        // 1. Get ALL records for this vehicle and standardise data types
        const fullHistory = allRecords
            .filter(r => r.vehicle === selectedVehicle)
            .map(r => ({
                ...r,
                // Ensure numeric types for calculation
                liters: Number(r.liters),
                odometer: Number(r.odometer),
                cost: Number(r.cost),
                // Helper for sorting
                dateObj: new Date(r.date)
            }))
            .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());

        // 2. enrich history with efficiency data (sequential calculation)
        const enrichedHistory = fullHistory.map((record, index) => {
            let efficiency = 0;
            let costPerKm = 0;
            let distance = 0;

            // 1. Calculate distance traveled TO GET HERE (for the (+km) display)
            if (index > 0) {
                const prevRecord = fullHistory[index - 1];
                distance = record.odometer - prevRecord.odometer;
            }

            // check if fuel is Arla
            const isArla = record.fuelType.toLowerCase().includes('arla');

            // 2. Calculate efficiency of THIS TANK (looking forward to next fill-up)
            // "Consumption must be shown on the previous fueling" -> The fueling that filled the tank.
            // SKIP if Arla
            if (!isArla) {
                // Find next non-Arla record
                let nextRecord = null;
                for (let i = index + 1; i < fullHistory.length; i++) {
                    if (!fullHistory[i].fuelType.toLowerCase().includes('arla')) {
                        nextRecord = fullHistory[i];
                        break;
                    }
                }

                if (nextRecord) {
                    const distanceToNext = nextRecord.odometer - record.odometer;

                    if (distanceToNext > 0 && nextRecord.liters > 0) {
                        efficiency = distanceToNext / nextRecord.liters;
                        costPerKm = nextRecord.cost / distanceToNext;
                    }
                }
            }

            return {
                ...record,
                efficiency,
                costPerKm,
                distance
            };
        });

        // 3. Filter for current selected month/year
        const currentMonthRecords = enrichedHistory.filter(r => {
            return r.dateObj.getMonth() === selectedMonth && r.dateObj.getFullYear() === selectedYear;
        });

        // 4. Calculate Averages for the VIEW period
        // We only start counting for average if we have a valid interval (efficiency > 0)
        // Use a variable name that doesn't conflict
        const recordsWithEfficiency = currentMonthRecords.filter(r => r.efficiency > 0);

        const avgEfficiency = recordsWithEfficiency.length > 0
            ? recordsWithEfficiency.reduce((acc, r) => acc + r.efficiency, 0) / recordsWithEfficiency.length
            : 0;

        const avgCostPerKm = recordsWithEfficiency.length > 0
            ? recordsWithEfficiency.reduce((acc, r) => acc + r.costPerKm, 0) / recordsWithEfficiency.length
            : 0;

        // Totals for the month
        const totalVehicleCost = currentMonthRecords.reduce((acc, r) => acc + r.cost, 0);
        const totalVehicleLiters = currentMonthRecords.reduce((acc, r) => acc + r.liters, 0);
        const vehicleFuelTypes = [...new Set(currentMonthRecords.map(r => r.fuelType.split(' - ')[0]))].join(', ');

        return (
            <div className="space-y-6 animate-fade-in">
                {/* Header with Back Button */}
                <div className="flex items-center gap-4 mb-2">
                    <button
                        onClick={() => setSelectedVehicle(null)}
                        className="group flex items-center gap-2 px-4 py-2 bg-white text-slate-500 font-bold rounded-xl border border-slate-200 hover:border-cyan-200 hover:text-cyan-600 transition-all shadow-sm"
                    >
                        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                        Voltar
                    </button>
                    <div className="h-8 w-px bg-slate-200"></div>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-cyan-100 rounded-xl flex items-center justify-center text-cyan-600">
                            <Truck className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-900 uppercase">{selectedVehicle}</h2>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                {(() => {
                                    const veh = vehicles.find(v => v.plate === selectedVehicle || `${v.model} - ${v.brand}` === selectedVehicle);
                                    if (!veh) return 'Placa não encontrada';
                                    const sec = sectors.find(s => s.id === veh.sectorId);
                                    return `${veh.plate} • ${sec?.name || 'Setor não informado'}`;
                                })()} • {months[selectedMonth]}/{selectedYear}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Detail KPIs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white p-4 sm:p-5 rounded-[1.5rem] sm:rounded-[2rem] border border-slate-200 shadow-sm">
                        <div className="flex items-center gap-2 mb-2">
                            <DollarSign className="w-4 h-4 text-emerald-500" />
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Custo Total</span>
                        </div>
                        <p className="text-2xl font-black text-slate-900">{formatCurrency(totalVehicleCost)}</p>
                    </div>
                    <div className="bg-white p-4 sm:p-5 rounded-[1.5rem] sm:rounded-[2rem] border border-slate-200 shadow-sm">
                        <div className="flex items-center gap-2 mb-2">
                            <Droplet className="w-4 h-4 text-blue-500" />
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Consumo Total</span>
                        </div>
                        <p className="text-2xl font-black text-slate-900">{formatNumber(totalVehicleLiters, 1)} L</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">{vehicleFuelTypes}</p>
                    </div>
                    {/* New Metric: Avg Consumption */}
                    <div className="bg-white p-4 sm:p-5 rounded-[1.5rem] sm:rounded-[2rem] border border-slate-200 shadow-sm">
                        <div className="flex items-center gap-2 mb-2">
                            <TrendingUp className="w-4 h-4 text-amber-500" />
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Consumo Médio</span>
                        </div>
                        <p className="text-2xl font-black text-slate-900">
                            {avgEfficiency > 0 ? formatNumber(avgEfficiency, 1) : '--'} <span className="text-sm text-slate-400 font-bold">km/L</span>
                        </p>
                        <p className="text-[10px] font-bold text-emerald-600 uppercase mt-1">
                            {recordsWithEfficiency.length} medições (Mês)
                        </p>
                    </div>
                    {/* New Metric: Avg Cost/Km */}
                    <div className="bg-white p-4 sm:p-5 rounded-[1.5rem] sm:rounded-[2rem] border border-slate-200 shadow-sm">
                        <div className="flex items-center gap-2 mb-2">
                            <CreditCard className="w-4 h-4 text-purple-500" />
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Custo Médio</span>
                        </div>
                        <p className="text-2xl font-black text-slate-900">
                            {avgCostPerKm > 0 ? `${formatCurrency(avgCostPerKm)} ` : '--'} <span className="text-sm text-slate-400 font-bold">/km</span>
                        </p>
                    </div>
                </div>

                {/* Charts Area */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm min-h-[300px] flex flex-col">
                        <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-6 flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-cyan-500" /> Histórico de Consumo (Litros)
                        </h4>
                        {/* CSS-only Bar Chart Visualization */}
                        <div className="flex-1 flex items-end justify-between gap-2 px-2 pb-2 border-b border-slate-100">
                            {currentMonthRecords.slice(0, 7).map((rec, i) => (
                                <div key={i} className="flex flex-col items-center gap-2 group w-full">
                                    <div className="relative w-full bg-slate-100 rounded-t-lg overflow-hidden flex items-end h-40">
                                        <div
                                            className="w-full bg-cyan-400 group-hover:bg-cyan-500 transition-all duration-500 ease-out"
                                            style={{ height: Math.min((rec.liters / 100) * 100, 100) + '%' }}
                                        ></div>
                                        <div className="absolute inset-0 flex items-end justify-center pb-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <span className="text-[10px] font-bold text-white drop-shadow-md">{formatNumber(rec.liters, 0)}L</span>
                                        </div>
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-400">{new Date(rec.date).getDate()}/{new Date(rec.date).getMonth() + 1}</span>
                                </div>
                            ))}
                            {currentMonthRecords.length === 0 && <div className="w-full text-center text-xs text-slate-400 italic py-10">Sem dados para gráfico</div>}
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm min-h-[300px] flex flex-col">
                        <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-6 flex items-center gap-2">
                            <DollarSign className="w-4 h-4 text-emerald-500" /> Variação de Custo
                        </h4>
                        {/* Simple Line Viz Placeholder */}
                        <div className="flex-1 flex items-end justify-between gap-4 px-2 relative">
                            {/* Just listing the costs as boxes for now to show data */}
                            {currentMonthRecords.slice(0, 5).map((rec, i) => (
                                <div key={i} className="flex-1 bg-slate-50 rounded-xl p-3 border border-slate-100 flex flex-col items-center justify-center gap-1">
                                    <span className="text-xs font-bold text-emerald-600">{formatCurrency(rec.cost)}</span>
                                    <span className="text-[10px] font-bold text-slate-400">{new Date(rec.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
                                </div>
                            ))}
                            {currentMonthRecords.length === 0 && <div className="w-full text-center text-xs text-slate-400 italic py-10">Sem dados de custo</div>}
                        </div>
                    </div>
                </div>

                {/* History List */}
                <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-100 bg-slate-50/50">

                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs tracking-wider">
                                    <tr>
                                        <th className="px-6 py-4">Data</th>
                                        <th className="px-6 py-4">Nº Nota</th>
                                        <th className="px-6 py-4">Motorista</th>
                                        <th className="px-6 py-4">KM</th>
                                        <th className="px-6 py-4">Combustível</th>
                                        <th className="px-6 py-4">Litros</th>
                                        <th className="px-6 py-4">Consumo</th>
                                        <th className="px-6 py-4 text-right">Valor</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {[...currentMonthRecords].reverse().map((r) => (
                                        <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-6 py-4 font-bold text-slate-700">
                                                {new Date(r.date).toLocaleDateString('pt-BR')}
                                                <span className="block text-[10px] text-slate-400 font-normal">
                                                    {new Date(r.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 font-bold text-slate-600">
                                                {getDisplayInvoiceNumber(r.invoiceNumber) || '-'}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="font-bold text-slate-600 uppercase">{r.driver}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-slate-700">{formatNumber(r.odometer, 2)} km</span>
                                                    {r.distance > 0 && <span className="text-[10px] text-cyan-600 font-bold mt-1">(+{formatNumber(r.distance, 2)} km)</span>}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 font-bold text-cyan-600">{r.fuelType.split(' - ')[0]}</td>
                                            <td className="px-6 py-4 font-bold text-blue-600">{formatNumber(r.liters, 1)} L</td>
                                            <td className="px-6 py-4">
                                                {r.efficiency > 0 ? (
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-slate-700">{formatNumber(r.efficiency, 1)} km/L</span>
                                                        <span className="text-xs text-slate-400">{formatCurrency(r.costPerKm)}/km</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-slate-300 italic">--</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 font-bold text-emerald-600 text-right">{formatCurrency(r.cost)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // Generate unique colors for each sector
    const sectorColorMap = useMemo(() => {
        const uniqueSectors = Array.from(new Set(stats.vehicleStats.map((v: any) => v.sectorName))).sort() as string[];
        const palette = [
            'emerald', 'blue', 'rose', 'amber', 'violet',
            'cyan', 'fuchsia', 'lime', 'orange', 'indigo',
            'teal', 'sky', 'pink', 'purple', 'red',
            'yellow', 'green'
        ];

        const map: Record<string, string> = {};
        uniqueSectors.forEach((sector, index) => {
            map[sector] = palette[index % palette.length];
        });

        return map;
    }, [stats.vehicleStats]);

    const getSectorColor = (sectorName: string) => {
        return sectorColorMap[sectorName] || 'slate';
    };

    const renderVehicleView = () => {
        if (selectedVehicle) {
            return renderVehicleDetail();
        }

        const filteredVehicles = stats.vehicleStats.filter(v =>
            v.name.toLowerCase().includes(vehicleSearchTerm.toLowerCase()) ||
            v.sectorName.toLowerCase().includes(vehicleSearchTerm.toLowerCase())
        );

        return (
            <div className="space-y-6 animate-fade-in">
                {/* Search Bar - Specific for Vehicles Tab */}
                <div className="flex justify-end mb-4">
                    <div className="relative group w-full wide:w-80">
                        <input
                            type="text"
                            placeholder="Buscar veículo, placa ou setor..."
                            value={vehicleSearchTerm}
                            onChange={(e) => setVehicleSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-sm font-medium focus:outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 shadow-sm transition-all"
                        />
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-cyan-500 transition-colors" />
                    </div>
                </div>

                {stats.vehicleStats.length === 0 ? (
                    <div className="bg-white p-12 rounded-[2rem] border-2 border-dashed border-slate-200 text-center">
                        <Truck className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-slate-400 uppercase tracking-widest">Nenhuma atividade registrada</h3>
                        <p className="text-slate-500 mt-2">Não há abastecimentos para o período de {months[selectedMonth]}/{selectedYear}.</p>
                    </div>
                ) : filteredVehicles.length === 0 ? (
                    <div className="bg-white p-12 rounded-[2rem] border border-slate-200 text-center">
                        <Search className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                        <h3 className="text-lg font-bold text-slate-400">Nenhum veículo corresponde à busca</h3>
                        <button
                            onClick={() => setVehicleSearchTerm('')}
                            className="mt-4 text-cyan-600 font-bold hover:underline"
                        >
                            Limpar busca
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 wide:grid-cols-2 xl:grid-cols-3 gap-6">
                        {filteredVehicles.map((v) => {
                            const color = getSectorColor(v.sectorName);
                            // White background, colored left border
                            const borderClass = `border-l-4 border-${color}-400 border-y border-r border-slate-200 hover:border-r-${color}-200 hover:border-y-${color}-200`;
                            const bgIconClass = `bg-${color}-50 text-${color}-600`;
                            const textSectorClass = `text-${color}-600`;

                            return (
                                <div
                                    key={v.id}
                                    onClick={() => setSelectedVehicle(v.id)}
                                    className={`group bg-white rounded-2xl ${borderClass} p-6 shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer relative overflow-hidden`}
                                >
                                    <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <ChevronRight className={`w-5 h-5 text-${color}-400`} />
                                    </div>

                                    <div className="flex items-start justify-between mb-6">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-14 h-14 ${bgIconClass} rounded-2xl flex items-center justify-center transition-colors`}>
                                                <Truck className="w-7 h-7" />
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-black text-slate-900 leading-tight uppercase mb-1" title={v.name}>{v.name}</h3>
                                                <div className="flex flex-col">
                                                    <p className={`text-xs font-bold ${textSectorClass} uppercase tracking-wider`}>
                                                        {v.sectorName}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="px-3 py-1.5 bg-slate-100 rounded-lg text-[10px] font-bold text-slate-500 uppercase flex flex-col items-end">
                                            <span className="text-[10px] text-slate-400">Abastecimentos</span>
                                            <span className="text-sm text-slate-700">{v.count}</span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                        <div className="bg-slate-50 rounded-2xl p-3.5 transition-colors group-hover:bg-slate-50/80 border border-transparent">
                                            <div className="flex items-center gap-2 mb-1">
                                                <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
                                                <span className="text-[10px] font-bold text-slate-400 uppercase">Gasto Mensal</span>
                                            </div>
                                            <p className="text-lg font-black text-slate-900">{formatCurrency(v.totalCost)}</p>
                                        </div>
                                        <div className="bg-slate-50 rounded-2xl p-3.5 transition-colors group-hover:bg-slate-50/80 border border-transparent">
                                            <div className="flex items-center gap-2 mb-1">
                                                <TrendingUp className="w-3.5 h-3.5 text-blue-500" />
                                                <span className="text-[10px] font-bold text-slate-400 uppercase">Consumo Médio</span>
                                            </div>
                                            <p className="text-lg font-black text-slate-900">
                                                {v.avgKmL > 0 ? formatNumber(v.avgKmL, 1) : '--'} <span className="text-xs text-slate-400 font-bold">km/L</span>
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                                        <div className="flex items-center gap-2">
                                            <History className="w-3.5 h-3.5 text-slate-300" />
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">Último: {new Date(v.lastRef).toLocaleDateString('pt-BR')}</span>
                                        </div>
                                        <span className={`text-xs font-bold text-${color}-600 group-hover:underline`}>
                                            Ver Detalhes
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    };

    const renderDriverDetail = () => {
        const driverData = driverStats.find(d => d.name === selectedDriver);

        if (!driverData) {
            return (
                <div className="bg-white p-8 rounded-2xl text-center">
                    <p className="text-slate-500 font-bold">Motorista não encontrado.</p>
                    <button onClick={() => setSelectedDriver(null)} className="mt-4 text-emerald-600 font-bold hover:underline">Voltar para lista</button>
                </div>
            );
        }

        const evolutionData = driverData.records.map(r => ({
            date: new Date(r.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
            cost: r.cost,
            liters: r.liters,
            vehicle: r.vehicle
        })).reverse();

        const fuelBreakdown: Record<string, number> = {};
        driverData.records.forEach(r => {
            const fuel = r.fuelType.split(' - ')[0];
            fuelBreakdown[fuel] = (fuelBreakdown[fuel] || 0) + r.cost;
        });

        const fuelPieData = Object.entries(fuelBreakdown).map(([name, value]) => ({ name, value }));
        const PIE_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899'];

        return (
            <div className="space-y-6 animate-fade-in pb-16">
                {/* Header & Back Button */}
                <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setSelectedDriver(null)}
                            className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl transition-all flex items-center justify-center font-bold text-xs gap-2 cursor-pointer active:scale-95"
                        >
                            <ArrowLeft className="w-5 h-5 text-slate-600" />
                            <span>Voltar para Lista</span>
                        </button>
                        <div className="w-14 h-14 bg-emerald-100 border border-emerald-200 rounded-2xl flex items-center justify-center text-emerald-700 font-black text-xl shrink-0">
                            {driverData.name.substring(0, 2)}
                        </div>
                        <div>
                            <div className="flex items-center gap-3">
                                <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">{driverData.name}</h1>
                                <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-3 py-1 rounded-full uppercase">
                                    🏢 {driverData.sectorName}
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 font-medium mt-1">
                                Relatório individual de consumo, veículos operados e histórico de abastecimentos
                            </p>
                        </div>
                    </div>
                </div>

                {/* KPI Cards Grid for Individual Driver */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white p-5 rounded-[1.5rem] border border-slate-200 shadow-sm">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Total Gasto</span>
                        <h3 className="text-2xl font-black text-emerald-900 mt-1">{formatCurrency(driverData.totalCost)}</h3>
                        <p className="text-xs text-slate-400 font-medium mt-1">{driverData.count} abastecimentos</p>
                    </div>

                    <div className="bg-white p-5 rounded-[1.5rem] border border-slate-200 shadow-sm">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Volume Total</span>
                        <h3 className="text-2xl font-black text-blue-900 mt-1">{formatNumber(driverData.totalLiters, 1)} L</h3>
                        <p className="text-xs text-slate-400 font-medium mt-1">Total de litros</p>
                    </div>

                    <div className="bg-white p-5 rounded-[1.5rem] border border-slate-200 shadow-sm">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Eficiência Média</span>
                        <h3 className="text-2xl font-black text-cyan-900 mt-1">
                            {driverData.avgKmL > 0 ? `${formatNumber(driverData.avgKmL, 1)} km/L` : '--'}
                        </h3>
                        <p className="text-xs text-slate-400 font-medium mt-1">Rendimento médio do condutor</p>
                    </div>

                    <div className="bg-white p-5 rounded-[1.5rem] border border-slate-200 shadow-sm">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Veículos Utilizados</span>
                        <h3 className="text-2xl font-black text-indigo-900 mt-1">{driverData.vehiclesUsed.length} veículos</h3>
                        <p className="text-xs text-slate-400 font-medium mt-1">Frota operada pelo motorista</p>
                    </div>
                </div>

                {/* Charts Section for Driver */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Evolution Chart */}
                    <div className="lg:col-span-2 bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-6 flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-emerald-600" />
                            Histórico de Gastos por Abastecimento
                        </h3>
                        <div className="h-[280px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={evolutionData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} />
                                    <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
                                    <Tooltip
                                        content={({ active, payload }) => {
                                            if (active && payload && payload.length) {
                                                const data = payload[0].payload;
                                                return (
                                                    <div className="bg-white p-3 rounded-xl shadow-xl border border-slate-100 text-xs">
                                                        <p className="font-bold text-slate-500 mb-1">{data.date} - {data.vehicle}</p>
                                                        <p className="font-black text-emerald-600">{formatCurrency(data.cost)}</p>
                                                        <p className="font-bold text-blue-600">{data.liters} Litros</p>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }}
                                    />
                                    <Area type="monotone" dataKey="cost" stroke="#10b981" fill="#d1fae5" strokeWidth={3} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Fuel Breakdown Pie Chart */}
                    <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-6 flex items-center gap-2">
                            <Fuel className="w-4 h-4 text-blue-600" />
                            Gasto por Combustível
                        </h3>
                        <div className="h-[220px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={fuelPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}>
                                        {fuelPieData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* Complete Refuels Table for Driver */}
                <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-100">
                        <h3 className="text-base font-black text-slate-900 uppercase">Histórico de Abastecimentos</h3>
                        <p className="text-xs text-slate-500 font-medium">Registros detalhados realizados por este condutor</p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                            <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider">
                                <tr>
                                    <th className="px-6 py-4">Data / Hora</th>
                                    <th className="px-6 py-4">Nota Fiscal</th>
                                    <th className="px-6 py-4">Veículo</th>
                                    <th className="px-6 py-4">Posto</th>
                                    <th className="px-6 py-4">Combustível</th>
                                    <th className="px-6 py-4">Litros</th>
                                    <th className="px-6 py-4">KM / Odômetro</th>
                                    <th className="px-6 py-4">Consumo</th>
                                    <th className="px-6 py-4 text-right">Valor Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-medium">
                                {driverData.records.map((r) => (
                                    <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                                        <td className="px-6 py-4 font-bold text-slate-800">
                                            {new Date(r.date).toLocaleDateString('pt-BR')}
                                            <span className="block text-[10px] text-slate-400 font-normal">
                                                {new Date(r.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 font-bold text-slate-600">
                                            {getDisplayInvoiceNumber(r.invoiceNumber) || '-'}
                                        </td>
                                        <td className="px-6 py-4 font-bold text-slate-700 uppercase">
                                            🚗 {r.vehicle}
                                        </td>
                                        <td className="px-6 py-4 text-slate-600">
                                            {r.station}
                                        </td>
                                        <td className="px-6 py-4 font-bold text-cyan-600">
                                            {r.fuelType.split(' - ')[0]}
                                        </td>
                                        <td className="px-6 py-4 font-bold text-blue-600">
                                            {formatNumber(r.liters, 1)} L
                                        </td>
                                        <td className="px-6 py-4 font-bold text-slate-700">
                                            {formatNumber(r.odometer, 2)} km
                                        </td>
                                        <td className="px-6 py-4">
                                            {(r as any).efficiency > 0 ? (
                                                <span className="font-bold text-emerald-600">{formatNumber((r as any).efficiency, 1)} km/L</span>
                                            ) : (
                                                <span className="text-slate-300 italic">--</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 font-bold text-emerald-600 text-right text-sm">
                                            {formatCurrency(r.cost)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    };

    const renderDriverView = () => {
        if (selectedDriver) {
            return renderDriverDetail();
        }

        const filteredDrivers = driverStats.filter(d =>
            d.name.toLowerCase().includes(driverSearchTerm.toLowerCase()) ||
            d.sectorName.toLowerCase().includes(driverSearchTerm.toLowerCase()) ||
            (d.cpf && d.cpf.includes(driverSearchTerm))
        );

        const totalDriverSpend = driverStats.reduce((acc, d) => acc + d.totalCost, 0);
        const totalDriverLiters = driverStats.reduce((acc, d) => acc + d.totalLiters, 0);
        const topDriver = driverStats[0];

        return (
            <div className="space-y-6 animate-fade-in pb-12">
                {/* Top KPI Cards for Drivers */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white p-5 rounded-[1.5rem] border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600">
                                <Users className="w-5 h-5" />
                            </div>
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Motoristas Ativos</span>
                        </div>
                        <h3 className="text-2xl font-black text-slate-900">{driverStats.length} condutores</h3>
                        <p className="text-[10px] text-slate-400 font-medium mt-1">Com abastecimentos no período</p>
                    </div>

                    <div className="bg-white p-5 rounded-[1.5rem] border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-blue-50 rounded-xl text-blue-600">
                                <DollarSign className="w-5 h-5" />
                            </div>
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Gasto Total Condutores</span>
                        </div>
                        <h3 className="text-2xl font-black text-blue-900">{formatCurrency(totalDriverSpend)}</h3>
                        <p className="text-[10px] text-slate-400 font-medium mt-1">{formatNumber(totalDriverLiters)} Litros abastecidos</p>
                    </div>

                    <div className="bg-white p-5 rounded-[1.5rem] border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-amber-50 rounded-xl text-amber-600">
                                <UserCheck className="w-5 h-5" />
                            </div>
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Maior Consumo</span>
                        </div>
                        <h3 className="text-lg font-black text-slate-900 truncate" title={topDriver?.name || 'Nenhum'}>
                            {topDriver?.name || 'N/A'}
                        </h3>
                        <p className="text-xs font-bold text-amber-600 mt-0.5">{topDriver ? formatCurrency(topDriver.totalCost) : 'R$ 0,00'}</p>
                    </div>

                    <div className="bg-white p-5 rounded-[1.5rem] border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-cyan-50 rounded-xl text-cyan-600">
                                <BarChart3 className="w-5 h-5" />
                            </div>
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Média Eficiência</span>
                        </div>
                        <h3 className="text-2xl font-black text-cyan-900">
                            {driverStats.length > 0
                                ? formatNumber(driverStats.reduce((acc, d) => acc + d.avgKmL, 0) / driverStats.length, 1) + ' km/L'
                                : '--'}
                        </h3>
                        <p className="text-[10px] text-slate-400 font-medium mt-1">Média entre motoristas</p>
                    </div>
                </div>

                {/* Search and Header bar for Drivers List */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-[1.5rem] border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600">
                            <Users className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-slate-900 uppercase">Gestão e Histórico de Motoristas</h2>
                            <p className="text-xs text-slate-500 font-medium">Selecione um motorista para ver o relatório de consumo detalhado</p>
                        </div>
                    </div>

                    <div className="relative w-full sm:w-80">
                        <input
                            type="text"
                            placeholder="Buscar motorista ou setor..."
                            value={driverSearchTerm}
                            onChange={(e) => setDriverSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-cyan-500 focus:bg-white transition-all"
                        />
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    </div>
                </div>

                {/* Drivers Cards Grid */}
                {filteredDrivers.length === 0 ? (
                    <div className="bg-white p-12 rounded-[2rem] border-2 border-dashed border-slate-200 text-center">
                        <Users className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                        <h3 className="text-lg font-bold text-slate-400 uppercase tracking-wider">Nenhum motorista encontrado</h3>
                        <p className="text-slate-500 text-xs mt-1">Não há abastecimentos atribuídos a motoristas no período selecionado.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 wide:grid-cols-2 xl:grid-cols-3 gap-6">
                        {filteredDrivers.map((d, index) => (
                            <div
                                key={d.name}
                                onClick={() => setSelectedDriver(d.name)}
                                className="group bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-xl hover:border-emerald-300 transition-all duration-300 cursor-pointer relative overflow-hidden flex flex-col justify-between"
                            >
                                <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <ChevronRight className="w-5 h-5 text-emerald-500" />
                                </div>

                                <div>
                                    <div className="flex items-start gap-4 mb-4">
                                        <div className="w-12 h-12 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600 shrink-0 font-black text-lg">
                                            {d.name.substring(0, 2)}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-base font-black text-slate-900 uppercase truncate" title={d.name}>{d.name}</h3>
                                                {index === 0 && (
                                                    <span className="bg-amber-100 text-amber-700 text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider">
                                                        Top 1
                                                    </span>
                                                )}
                                            </div>
                                            <span className="inline-block mt-1 bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-lg uppercase">
                                                🏢 {d.sectorName}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 py-3 border-y border-slate-100 my-4 text-xs">
                                        <div>
                                            <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Valor Gasto</span>
                                            <span className="text-base font-black text-emerald-600">{formatCurrency(d.totalCost)}</span>
                                        </div>
                                        <div>
                                            <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Volume</span>
                                            <span className="text-base font-black text-blue-600">{formatNumber(d.totalLiters, 1)} L</span>
                                        </div>
                                        <div>
                                            <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Abastecimentos</span>
                                            <span className="font-bold text-slate-700">{d.count} registros</span>
                                        </div>
                                        <div>
                                            <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Média</span>
                                            <span className="font-bold text-cyan-600">{d.avgKmL > 0 ? `${formatNumber(d.avgKmL, 1)} km/L` : '--'}</span>
                                        </div>
                                    </div>

                                    {/* Vehicles driven by this driver */}
                                    <div>
                                        <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2">Veículos Operados ({d.vehiclesUsed.length})</span>
                                        <div className="flex flex-wrap gap-1">
                                            {d.vehiclesUsed.slice(0, 3).map((v, i) => (
                                                <span key={i} className="text-[10px] font-bold bg-slate-50 border border-slate-200 text-slate-600 px-2 py-1 rounded-md uppercase">
                                                    🚗 {v}
                                                </span>
                                            ))}
                                            {d.vehiclesUsed.length > 3 && (
                                                <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-1.5 py-1 rounded-md">
                                                    +{d.vehiclesUsed.length - 3}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                                    <span className="text-[10px] font-medium text-slate-400">
                                        Último: {d.lastRefuel ? new Date(d.lastRefuel).toLocaleDateString('pt-BR') : '--'}
                                    </span>
                                    <span className="font-bold text-emerald-600 group-hover:translate-x-1 transition-transform flex items-center gap-1">
                                        Relatório Completo &rarr;
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    const handleUpdatePaymentStatus = async (historyId: string, newStatus: string, recordIds?: string[]) => {
        try {
            await AbastecimentoService.updateReportPaymentStatus(historyId, newStatus, recordIds || []);
            await loadReportHistory();
            await loadRecords(); // Refresh the records to show updated payment status
        } catch (error) {
            console.error("Error updating payment status:", error);
            alert("Erro ao atualizar situação de pagamento.");
        }
    };

    const renderReportsView = () => (
        <div className="space-y-6 animate-fade-in pb-20">
            {/* Filters Section */}
            <div className="bg-white rounded-[1.5rem] sm:rounded-[2rem] shadow-sm border border-slate-200 p-4 sm:p-6 wide:p-8">
                <div className="flex items-center gap-4 mb-6 pb-6 border-b border-slate-100">
                    <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600">
                        <Filter className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-900 uppercase">Filtros do Relatório</h2>
                        <p className="text-slate-500 text-sm font-medium">Refine os dados para geração do relatório</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6">
                    {/* Date inputs */}
                    <div>
                        <ModernDateInput
                            label="Período Inicial"
                            value={pendingFilters.startDate}
                            onChange={(val) => setPendingFilters({ ...pendingFilters, startDate: val })}
                        />
                    </div>
                    <div>
                        <ModernDateInput
                            label="Período Final"
                            value={pendingFilters.endDate}
                            onChange={(val) => setPendingFilters({ ...pendingFilters, endDate: val })}
                        />
                    </div>
                    {/* Select dropdowns */}
                    <div>
                        <ModernSelect
                            label="Posto"
                            value={pendingFilters.station}
                            onChange={(val) => setPendingFilters({ ...pendingFilters, station: val })}
                            options={[
                                { value: 'all', label: 'Todos os Postos' },
                                ...gasStations.map(s => ({ value: s.name, label: s.name }))
                            ]}
                            icon={Building2}
                            placeholder="Todos os Postos"
                        />
                    </div>
                    <div>
                        <ModernSelect
                            label="Setor"
                            value={pendingFilters.sector}
                            onChange={(val) => setPendingFilters({ ...pendingFilters, sector: val })}
                            options={[
                                ...(isAdmin ? [{ value: 'all', label: 'Todos os Setores' }] : []),
                                ...availableSectors.map(s => ({ value: s.name, label: s.name }))
                            ]}
                            icon={Factory}
                            placeholder="Todos os Setores"
                            searchable
                        />
                    </div>
                    <div>
                        <ModernSelect
                            label="Veículo (Placa)"
                            value={pendingFilters.vehicle}
                            onChange={(val) => setPendingFilters({ ...pendingFilters, vehicle: val })}
                            options={[
                                { value: 'all', label: 'Todos os Veículos' },
                                ...vehicles.map(v => ({ value: v.plate || v.id, label: `${v.plate} - ${v.model}` }))
                            ]}
                            icon={Car}
                            placeholder="Selecione o Veículo"
                            searchable
                        />
                    </div>
                    <div>
                        <ModernSelect
                            label="Combustível"
                            value={pendingFilters.fuelType}
                            onChange={(val) => setPendingFilters({ ...pendingFilters, fuelType: val })}
                            options={[
                                { value: 'all', label: 'Todos' },
                                { value: 'diesel', label: 'Diesel' },
                                { value: 'gasolina', label: 'Gasolina' },
                                { value: 'etanol', label: 'Etanol' },
                                { value: 'arla', label: 'Arla' }
                            ]}
                            icon={Fuel}
                            placeholder="Todos"
                            multiple={true}
                        />
                    </div>
                    <div>
                        <ModernSelect
                            label="Situação de Pagamento"
                            value={pendingFilters.paymentStatus || 'all'}
                            onChange={(val) => setPendingFilters({ ...pendingFilters, paymentStatus: val })}
                            options={[
                                { value: 'all', label: 'Todos' },
                                { value: 'Em Aberto', label: 'Em Aberto' },
                                { value: 'Empenhando', label: 'Empenhando' },
                                { value: 'Pago', label: 'Pago' }
                            ]}
                            icon={CreditCard}
                            placeholder="Todos"
                        />
                    </div>

                    <div className="sm:col-span-2 lg:col-span-1 flex items-end">
                        <button
                            onClick={() => setAppliedFilters({ ...pendingFilters })}
                            className="w-full md:w-auto px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest text-xs rounded-xl shadow-lg shadow-indigo-600/20 transition-all active:scale-95 flex items-center justify-center gap-2 h-[46px]"
                        >
                            <Filter className="w-4 h-4" />
                            Aplicar Filtros
                        </button>
                    </div>
                </div>
            </div>

            {/* Summary Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Liters and Value Totals */}
                <div className="bg-slate-900 text-white rounded-[1.5rem] sm:rounded-[2rem] border border-slate-800 p-6 sm:p-8 shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-6 opacity-10">
                        <FileSpreadsheet className="w-32 h-32" />
                    </div>
                    <div className="relative z-10 flex flex-col h-full justify-between">
                        <div>
                            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-indigo-400 mb-6">Resumo Geral</h3>
                            <div className="space-y-6">
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Volume Total</p>
                                    <p className="text-2xl sm:text-4xl font-black tracking-tighter">{formatNumber(reportData.grandTotalLiters)} <span className="text-sm sm:text-xl text-slate-500">L</span></p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Valor Total</p>
                                    <p className="text-2xl sm:text-4xl font-black tracking-tighter text-emerald-400">{formatCurrency(reportData.grandTotalValue)}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total de KM Rodado</p>
                                    <p className="text-2xl sm:text-4xl font-black tracking-tighter text-amber-400">{formatNumber(reportData.grandTotalKm || 0)} <span className="text-sm sm:text-xl text-slate-500">Km</span></p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Consumo Médio</p>
                                    <p className="text-2xl sm:text-4xl font-black tracking-tighter text-violet-400">{formatNumber(reportData.avgKmLFiltered || 0, 1)} <span className="text-sm sm:text-xl text-slate-500">Km/L</span></p>
                                </div>
                            </div>
                        </div>
                        <div className="pt-8 border-t border-white/5 mt-8 space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-slate-500 uppercase">{reportData.records.length} registros</span>
                                <div className="flex bg-white/5 p-1 rounded-xl border border-white/5">
                                    <button
                                        onClick={() => setReportMode('simplified')}
                                        className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${reportMode === 'simplified' ? 'bg-white text-slate-900' : 'text-slate-500 hover:text-slate-300'}`}
                                    >
                                        Simplificado
                                    </button>
                                    <button
                                        onClick={() => setReportMode('complete')}
                                        className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${reportMode === 'complete' ? 'bg-white text-slate-900' : 'text-slate-500 hover:text-slate-300'}`}
                                    >
                                        Completo
                                    </button>
                                    <button
                                        onClick={() => setReportMode('listagem')}
                                        className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${reportMode === 'listagem' ? 'bg-white text-slate-900' : 'text-slate-500 hover:text-slate-300'}`}
                                    >
                                        Listagem
                                    </button>
                                </div>
                            </div>
                            <button
                                onClick={handleOpenReport}
                                disabled={isPreparingReport}
                                className={`w-full flex items-center justify-center gap-3 px-6 py-4 bg-indigo-600 hover:bg-indigo-700 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)] group ${isPreparingReport ? 'opacity-70 cursor-wait' : ''}`}
                            >
                                <div className="p-2 bg-white/20 rounded-lg group-hover:bg-white/30 transition-colors">
                                    <Download className="w-4 h-4 text-white" />
                                </div>
                                <div className="text-left">
                                    <p className="text-white leading-none">Exportar PDF</p>
                                    <p className="text-[8px] text-indigo-200 mt-1 font-bold">{reportMode === 'simplified' ? 'Sem listagem detalhada' : reportMode === 'listagem' ? 'Agrupado por Setor' : 'Relatório Integral'}</p>
                                </div>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Totals by Fuel */}
                <div className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm">
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 mb-6">Por Combustível</h3>
                    <div className="space-y-4">
                        {Object.entries(reportData.totalLitersByFuel).map(([fuel, liters]) => (
                            <div key={fuel} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <div>
                                    <p className="text-xs font-black text-slate-900 uppercase">{fuel}</p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">{formatCurrency(reportData.totalValueByFuel[fuel] as number)}</p>
                                </div>
                                <p className="font-black text-slate-700">{formatNumber(liters as number)} L</p>
                            </div>
                        ))}
                        {Object.keys(reportData.totalLitersByFuel).length === 0 && (
                            <div className="text-center py-12">
                                <Fuel className="w-12 h-12 text-slate-100 mx-auto mb-3" />
                                <p className="text-xs font-bold text-slate-300 uppercase">Nenhum dado</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Totals by Sector */}
                <div className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm">
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 mb-6 text-center">Valor por Setor</h3>
                    <div className="space-y-4 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                        {Object.entries(reportData.totalValueBySector)
                            .sort(([, a], [, b]) => (b as number) - (a as number))
                            .map(([sector, value]) => (
                                <div key={sector} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-xl transition-colors border-b border-slate-50 last:border-0">
                                    <p className="text-[10px] font-bold text-slate-600 uppercase truncate max-w-[120px]" title={sector}>{sector}</p>
                                    <p className="font-black text-slate-900 text-xs">{formatCurrency(value as number)}</p>
                                </div>
                            ))
                        }
                        {Object.keys(reportData.totalValueBySector).length === 0 && (
                            <div className="text-center py-12">
                                <Factory className="w-12 h-12 text-slate-100 mx-auto mb-3" />
                                <p className="text-xs font-bold text-slate-300 uppercase">Nenhum dado</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Detailed Table */}
            <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500">
                            <FileText className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-black text-slate-900">Registros Detalhados</h3>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Histórico filtrado</p>
                        </div>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-100">
                            <tr>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-wider">Protocolo</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-wider">Data/Hora</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-wider">Veículo/Motorista</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-wider">Setor</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-wider">Posto/Combustível</th>
                                <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-wider">Volume/Valor</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {reportData.records.map((record) => (
                                <tr key={record.id} className="hover:bg-slate-50/80 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-2 h-2 rounded-full bg-slate-300 group-hover:bg-indigo-500 transition-colors" />
                                            <span className="font-mono text-xs font-bold text-slate-500">#{record.protocol || 'N/A'}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-slate-900 text-sm">{new Date(record.date).toLocaleDateString()}</span>
                                            <span className="text-[10px] font-medium text-slate-400">{new Date(record.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-slate-900 text-sm">{record.vehicle}</span>
                                            <span className="text-[10px] font-medium text-slate-500 flex items-center gap-1">
                                                <Car className="w-3 h-3" /> {record.derivedPlate} • {record.driver}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-slate-900 text-xs italic">{record.derivedSector}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-slate-900 text-xs">{record.station || 'N/A'}</span>
                                            <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider bg-slate-100 px-2 py-0.5 rounded-md w-fit mt-1">{record.fuelType}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex flex-col items-end">
                                            <span className="font-black text-emerald-600 text-sm">{formatCurrency(record.cost)}</span>
                                            <span className="text-[10px] font-bold text-slate-400">{formatNumber(record.liters)} L</span>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {reportData.records.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                                        Nenhum registro encontrado com os filtros selecionados.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Report History */}
            <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden mt-6">
                <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                            <History className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-black text-slate-900">Histórico de Relatórios</h3>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Relatórios gerados anteriormente</p>
                        </div>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-100">
                            <tr>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-wider">Data do Relatório</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-wider">Filtros (Período / Posto / Setor)</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-wider">Usuário</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-wider">Situação de Pagamento</th>
                                <th className="px-6 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-wider">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {reportHistory.map((history) => (
                                <tr key={history.id} className="hover:bg-slate-50/80 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-slate-900 text-sm">{new Date(history.created_at).toLocaleDateString()}</span>
                                            <span className="text-[10px] font-medium text-slate-400">{new Date(history.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            <span className="text-[10px] font-bold text-indigo-500 uppercase mt-1">{history.report_type === 'simplified' ? 'Simplificado' : 'Completo'}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-xs font-bold text-slate-700">🗓️ {history.start_date ? formatLocalDate(history.start_date) : 'Início'} - {history.end_date ? formatLocalDate(history.end_date) : 'Fim'}</span>
                                            <span className="text-[10px] font-medium text-slate-500">🏢 {history.station || 'Todos os Postos'} • 🏭 {history.sector || 'Todos os Setores'}</span>
                                            <span className="text-[10px] font-medium text-slate-500">🚗 {history.vehicle || 'Todos'} • ⛽ {history.fuel_type || 'Todos'}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-slate-900 text-xs">{history.user_name || 'Desconhecido'}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <select
                                            value={history.payment_status}
                                            onChange={(e) => handleUpdatePaymentStatus(history.id, e.target.value, history.record_ids)}
                                            className={`text-xs font-bold rounded-lg px-3 py-1.5 border-0 focus:ring-2 focus:ring-indigo-500 cursor-pointer ${history.payment_status === 'Pago' ? 'bg-emerald-100 text-emerald-700' :
                                                history.payment_status === 'Empenhando' ? 'bg-amber-100 text-amber-700' :
                                                    'bg-rose-100 text-rose-700'
                                                }`}
                                        >
                                            <option value="Em Aberto">Em Aberto</option>
                                            <option value="Empenhando">Empenhando</option>
                                            <option value="Pago">Pago</option>
                                        </select>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <button
                                            onClick={() => handleDownloadHistoryReport(history)}
                                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition-all active:scale-95 inline-flex items-center justify-center gap-2 text-xs"
                                            title="Baixar PDF"
                                        >
                                            <Download className="w-4 h-4" />
                                            <span>PDF</span>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {reportHistory.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                                        Nenhum histórico de relatório salvo.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );

    const pendingEmpenhoRecords = useMemo(() => {
        return reportData.records.filter(r => !sessionEmpenhados.some(s => s.id === r.id));
    }, [reportData.records, sessionEmpenhados]);

    const groupedRecordsForEmpenho = useMemo(() => {
        const records = [...pendingEmpenhoRecords];
        
        // Sort by sector first, then plate
        records.sort((a, b) => {
            const sectorA = a.derivedSector || '';
            const sectorB = b.derivedSector || '';
            if (sectorA !== sectorB) return sectorA.localeCompare(sectorB);
            const plateA = a.derivedPlate || '';
            const plateB = b.derivedPlate || '';
            return plateA.localeCompare(plateB);
        });

        const groups: Record<string, typeof records> = {};
        records.forEach(r => {
            const sector = r.derivedSector || 'Sem Setor';
            if (!groups[sector]) groups[sector] = [];
            groups[sector].push(r);
        });

        return groups;
    }, [pendingEmpenhoRecords]);

    const handleEmpenharSubmit = () => {
        if (!empenhoForm.projetoAtividade || !empenhoForm.numeroEmpenho) {
            showSuccessToast('Preencha os dados do empenho.');
            return;
        }
        
        // Add selected records to session with their new Emepenho params
        const newBatch = pendingEmpenhoRecords
            .filter(r => selectedEmpenhoRecords.includes(r.id))
            .map(r => ({
                ...r,
                projeto_atividade: empenhoForm.projetoAtividade,
                numero_empenho: empenhoForm.numeroEmpenho
            }));

        setSessionEmpenhados(prev => [...prev, ...newBatch]);
        
        // Reset interaction modal
        setShowEmpenhoModal(false);
        setEmpenhoForm({ projetoAtividade: '', numeroEmpenho: '' });
        setSelectedEmpenhoRecords([]);
        
        showSuccessToast(`Lote anexado. Restam ${pendingEmpenhoRecords.length - newBatch.length} registros pendentes.`);
    };

    const handleFinalizarSessaoEmpenho = async () => {
        setIsEmpenhando(true);
        try {
            // Group session items by Empenho Number to minimize DB updates
            const batches: Record<string, { projeto: string, records: string[] }> = {};
            sessionEmpenhados.forEach(s => {
                const key = s.numero_empenho || '';
                if (!batches[key]) batches[key] = { projeto: s.projeto_atividade || '', records: [] };
                batches[key].records.push(s.id);
            });

            // Dispatch DB Updates
            for (const [empenho, batchData] of Object.entries(batches)) {
                await AbastecimentoService.updateAbastecimentoEmpenho(batchData.records, batchData.projeto, empenho);
            }

            const formatDateSafe = (dateStr: string) => {
                if (!dateStr) return '';
                const parts = dateStr.split('-');
                if (parts.length !== 3) return dateStr;
                return `${parts[2]}/${parts[1]}/${parts[0]}`;
            };

            const periodoStr = `${appliedFilters.startDate ? formatDateSafe(appliedFilters.startDate) : 'Início'} a ${appliedFilters.endDate ? formatDateSafe(appliedFilters.endDate) : 'Fim'}`;
            const postoStr = appliedFilters.station && appliedFilters.station !== 'all' ? appliedFilters.station : 'Todos os Postos';
            
            // Generate Unified PDF grouped by Numero Empenho
            const pdfBlob = generateEmpenhoReportPDF(sessionEmpenhados as any, periodoStr, postoStr, persons, gasStations);
            
            const pdfName = `Empenho_${Date.now()}.pdf`;
            const fileObj = new File([pdfBlob], pdfName, { type: 'application/pdf' });
            
            await uploadFile(fileObj, 'attachments', `empenho_reports/${pdfName}`);
            
            showSuccessToast('Processo de Empenho Finalizado e PDF gerado consolidado!');
            
            loadSavedEmpenhoReports();
            
            // Update UI list safely
            setAllRecords(prev => prev.map(r => {
                const sessionFound = sessionEmpenhados.find(s => s.id === r.id);
                if (sessionFound) {
                    return { ...r, payment_status: 'Empenhado', projeto_atividade: sessionFound.projeto_atividade, numero_empenho: sessionFound.numero_empenho };
                }
                return r;
            }));
            
            setShowEmpenhoOverlay(false);
            setSessionEmpenhados([]);
        } catch (error) {
            console.error(error);
            showSuccessToast('Erro ao finalizar o processo de empenho.');
        } finally {
            setIsEmpenhando(false);
        }
    };

    const renderEmpenhoOverlay = () => {
        const toggleSelection = (record: typeof reportData.records[0]) => {
            const isSelected = selectedEmpenhoRecords.includes(record.id);
            const recordsWithSamePlate = reportData.records.filter(r => r.derivedPlate === record.derivedPlate);
            const idsWithSamePlate = recordsWithSamePlate.map(r => r.id);

            if (isSelected) {
                setSelectedEmpenhoRecords(prev => prev.filter(id => !idsWithSamePlate.includes(id)));
            } else {
                setSelectedEmpenhoRecords(prev => {
                    const uniqueNewIds = idsWithSamePlate.filter(id => !prev.includes(id));
                    return [...prev, ...uniqueNewIds];
                });
            }
        };

        const toggleSector = (sector: string, records: AbastecimentoRecord[]) => {
            const allSelected = records.every(r => selectedEmpenhoRecords.includes(r.id));
            if (allSelected) {
                // Deselect all
                setSelectedEmpenhoRecords(prev => prev.filter(id => !records.some(r => r.id === id)));
            } else {
                // Select all
                const newIds = records.map(r => r.id).filter(id => !selectedEmpenhoRecords.includes(id));
                setSelectedEmpenhoRecords(prev => [...prev, ...newIds]);
            }
        };

        return (
            <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden animate-fade-in relative flex flex-col h-[calc(100vh-200px)]">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10 shrink-0">
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => {
                                if (sessionEmpenhados.length > 0) {
                                    if(window.confirm('Existem lotes processados na memória. Ao sair, todo o progresso atual dessa sessão será perdido. Deseja realmente abortar?')) {
                                        setSessionEmpenhados([]);
                                        setShowEmpenhoOverlay(false);
                                    }
                                } else {
                                    setShowEmpenhoOverlay(false);
                                }
                            }}
                            className="w-10 h-10 bg-slate-50 hover:bg-slate-100 rounded-xl flex items-center justify-center text-slate-500 transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div>
                            <h3 className="font-black text-slate-900 text-lg">Sessão de Empenho</h3>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] font-black text-indigo-500 bg-indigo-50 px-2 rounded uppercase tracking-wider">{pendingEmpenhoRecords.length} aguardando</span>
                                <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 rounded uppercase tracking-wider">{sessionEmpenhados.length} processados no buffer</span>
                            </div>
                        </div>
                    </div>
                    <div>
                        <button
                            onClick={() => setShowEmpenhoModal(true)}
                            disabled={selectedEmpenhoRecords.length === 0}
                            className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-lg ${selectedEmpenhoRecords.length > 0 ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20 active:scale-95' : 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'}`}
                        >
                            <CheckSquare className="w-4 h-4" />
                            Anexar Lote ({selectedEmpenhoRecords.length})
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-auto custom-scrollbar p-6 bg-slate-50 relative">
                    <div className="max-w-4xl mx-auto space-y-8">
                        {Object.entries(groupedRecordsForEmpenho).map(([sector, records]) => {
                            const allSelected = records.every(r => selectedEmpenhoRecords.includes(r.id));
                            const someSelected = records.some(r => selectedEmpenhoRecords.includes(r.id)) && !allSelected;

                            return (
                                <div key={sector} className="bg-white rounded-[1.5rem] shadow-sm border border-slate-200 overflow-hidden">
                                    <div className="bg-slate-50 px-6 py-4 flex items-center justify-between border-b border-slate-100">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center">
                                                <Factory className="w-4 h-4" />
                                            </div>
                                            <h4 className="font-black text-slate-800 uppercase tracking-widest text-xs">{sector}</h4>
                                        </div>
                                        <button 
                                            onClick={() => toggleSector(sector, records)}
                                            className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider hover:text-indigo-600 transition-colors"
                                        >
                                            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${allSelected ? 'bg-indigo-500 border-indigo-500 text-white' : someSelected ? 'bg-indigo-100 border-indigo-500 text-indigo-500' : 'border-slate-300'}`}>
                                                {allSelected && <Check className="w-3 h-3" />}
                                                {someSelected && <div className="w-2 h-0.5 bg-indigo-500 rounded" />}
                                            </div>
                                            {allSelected ? 'Desmarcar Todos' : 'Selecionar Todos'}
                                        </button>
                                    </div>
                                    <div className="divide-y divide-slate-100">
                                        {records.map(record => (
                                            <div 
                                                key={record.id} 
                                                onClick={() => toggleSelection(record)}
                                                className={`px-6 py-3 flex items-center justify-between cursor-pointer transition-colors hover:bg-indigo-50/30 ${selectedEmpenhoRecords.includes(record.id) ? 'bg-indigo-50/50' : ''}`}
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors shrink-0 ${selectedEmpenhoRecords.includes(record.id) ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-slate-300 bg-white'}`}>
                                                        {selectedEmpenhoRecords.includes(record.id) && <Check className="w-3 h-3" />}
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-0.5">
                                                            <span className="font-bold text-slate-900 text-sm">{record.derivedPlate}</span>
                                                            <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-2 rounded-full hidden sm:inline-flex">{record.date.split('T')[0].split('-').reverse().join('/')}</span>
                                                        </div>
                                                        <p className="text-[10px] font-bold text-slate-500 uppercase">{record.driver} • {record.odometer} km</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-6">
                                                    <div className="hidden md:block text-right">
                                                        <p className="font-bold text-slate-700 text-xs">{record.station}</p>
                                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{record.fuelType}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="font-black text-emerald-600 text-sm">{formatCurrency(record.cost)}</p>
                                                        <p className="text-[10px] font-bold text-slate-400">{formatNumber(record.liters)} L</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                        {pendingEmpenhoRecords.length === 0 && sessionEmpenhados.length === 0 && (
                            <div className="text-center py-20">
                                <FileSpreadsheet className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                                <h3 className="text-lg font-black text-slate-900">Nenhum registro encontrado</h3>
                                <p className="text-slate-500">Refine os filtros para buscar lançamentos.</p>
                            </div>
                        )}
                        {pendingEmpenhoRecords.length === 0 && sessionEmpenhados.length > 0 && (
                            <div className="bg-emerald-50 border border-emerald-200 rounded-[2rem] p-10 text-center animate-in zoom-in-95 duration-500">
                                <div className="w-20 h-20 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl shadow-emerald-500/30">
                                    <Check className="w-10 h-10" />
                                </div>
                                <h3 className="text-2xl font-black text-emerald-900 mb-2">Todos os Registros Anexados!</h3>
                                <p className="text-emerald-700 mb-8 max-w-md mx-auto font-medium">Você processou todos os {sessionEmpenhados.length} lançamentos da fila dessa filtragem. O sistema gerará um único arquivo PDF organizando-os por Número de Empenho de forma consolidada e os submeterá ao Banco de Dados.</p>
                                <button
                                    onClick={handleFinalizarSessaoEmpenho}
                                    disabled={isEmpenhando}
                                    className={`px-10 py-5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl shadow-xl shadow-emerald-600/20 transition-all uppercase tracking-widest ${isEmpenhando ? 'opacity-70 cursor-wait flex items-center justify-center gap-3 mx-auto' : 'active:scale-95'}`}
                                >
                                    {isEmpenhando ? <><Check className="w-5 h-5 animate-spin" /> Efetuando Inserção em Massa...</> : 'Gravar Dados e Gerar PDF Consolidado'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Empenho Modal */}
                {showEmpenhoModal && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
                        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden relative">
                            <div className="p-8">
                                <div className="flex items-center justify-between mb-8">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600">
                                            <ShieldAlert className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-black text-slate-900 leading-tight">Confirmar Empenho</h3>
                                            <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider">{selectedEmpenhoRecords.length} lançamentos</p>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => setShowEmpenhoModal(false)}
                                        className="w-8 h-8 bg-slate-100 hover:bg-slate-200 rounded-full flex items-center justify-center text-slate-500 transition-colors"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>

                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2 ml-1">Projeto / Atividade</label>
                                        <input
                                            type="text"
                                            value={empenhoForm.projetoAtividade}
                                            onChange={e => setEmpenhoForm({ ...empenhoForm, projetoAtividade: e.target.value })}
                                            placeholder="Ex: 2024 - Manutenção da Frota"
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-slate-900 font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2 ml-1">Número do Empenho</label>
                                        <input
                                            type="text"
                                            value={empenhoForm.numeroEmpenho}
                                            onChange={e => setEmpenhoForm({ ...empenhoForm, numeroEmpenho: e.target.value })}
                                            placeholder="Ex: 10452/2024"
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-slate-900 font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                                        />
                                    </div>
                                </div>

                                <div className="mt-10 flex gap-3">
                                    <button
                                        onClick={() => setShowEmpenhoModal(false)}
                                        className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black rounded-2xl transition-all uppercase tracking-widest text-xs"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={handleEmpenharSubmit}
                                        disabled={!empenhoForm.projetoAtividade || !empenhoForm.numeroEmpenho}
                                        className={`flex-[2] flex justify-center items-center gap-2 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl transition-all uppercase tracking-widest text-xs shadow-lg shadow-indigo-600/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed`}
                                    >
                                        Adicionar Lote à Sessão
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const renderLancamentosView = () => {
        if (showEmpenhoOverlay) {
            return renderEmpenhoOverlay();
        }

        return (
            <div className="space-y-6 animate-fade-in pb-20">
            <div className="bg-white rounded-[1.5rem] sm:rounded-[2rem] shadow-sm border border-slate-200 p-4 sm:p-6 wide:p-8">
                <div className="flex items-center gap-4 mb-6 pb-6 border-b border-slate-100">
                    <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600">
                        <Filter className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-900 uppercase">Filtros de Lançamentos</h2>
                        <p className="text-slate-500 text-sm font-medium">Extraia relatórios simplificados com os filtros abaixo</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6">
                    <div>
                        <ModernDateInput
                            label="Período Inicial"
                            value={pendingFilters.startDate}
                            onChange={(val) => setPendingFilters({ ...pendingFilters, startDate: val })}
                        />
                    </div>
                    <div>
                        <ModernDateInput
                            label="Período Final"
                            value={pendingFilters.endDate}
                            onChange={(val) => setPendingFilters({ ...pendingFilters, endDate: val })}
                        />
                    </div>
                    <div>
                        <ModernSelect
                            label="Posto"
                            value={pendingFilters.station}
                            onChange={(val) => setPendingFilters({ ...pendingFilters, station: val })}
                            options={[
                                { value: 'all', label: 'Todos os Postos' },
                                ...gasStations.map(s => ({ value: s.name, label: s.name }))
                            ]}
                            icon={Building2}
                            placeholder="Todos os Postos"
                        />
                    </div>
                    <div>
                        <ModernSelect
                            label="Combustível"
                            value={pendingFilters.fuelType}
                            onChange={(val) => setPendingFilters({ ...pendingFilters, fuelType: val })}
                            options={[
                                { value: 'all', label: 'Todos os Combustíveis' },
                                { value: 'diesel', label: 'Diesel' },
                                { value: 'gasolina', label: 'Gasolina' },
                                { value: 'etanol', label: 'Etanol' },
                                { value: 'arla', label: 'Arla' }
                            ]}
                            icon={Fuel}
                            placeholder="Todos"
                            multiple={true}
                        />
                    </div>

                    <div className="sm:col-span-2 lg:col-span-1 flex items-end">
                        <button
                            onClick={() => {
                                // For Lançamentos, clean other filters
                                setAppliedFilters({ 
                                    ...pendingFilters,
                                    vehicle: 'all',
                                    fuelType: ['all'],
                                    paymentStatus: 'all'
                                });
                            }}
                            className="w-full md:w-auto px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest text-xs rounded-xl shadow-lg shadow-blue-600/20 transition-all active:scale-95 flex items-center justify-center gap-2 h-[46px]"
                        >
                            <Filter className="w-4 h-4" />
                            Aplicar
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex flex-col xl:flex-row gap-6 mt-6">
                {/* Resumo Compacto with Integrated Report Modes */}
                <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-xl flex-[2] relative overflow-hidden flex flex-col justify-center">
                    <div className="absolute right-0 top-0 opacity-10 p-4 pointer-events-none">
                        <FileSpreadsheet className="w-48 h-48 -mr-10 -mt-10" />
                    </div>
                    <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
                        <div>
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400 mb-4 flex items-center gap-2"><LayoutDashboard className="w-4 h-4" /> Resumo</h3>
                            <div className="flex items-center gap-6">
                                <div>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Volume</p>
                                    <p className="text-2xl font-black tracking-tighter">{formatNumber(reportData.grandTotalLiters)} L</p>
                                </div>
                                <div className="w-[1px] h-10 bg-white/10"></div>
                                <div>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Valor Total</p>
                                    <p className="text-2xl font-black tracking-tighter text-emerald-400">{formatCurrency(reportData.grandTotalValue)}</p>
                                </div>
                                <div className="w-[1px] h-10 bg-white/10"></div>
                                <div>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">KM Rodado</p>
                                    <p className="text-2xl font-black tracking-tighter text-amber-400">{formatNumber(reportData.grandTotalKm || 0)} Km</p>
                                </div>
                                <div className="w-[1px] h-10 bg-white/10"></div>
                                <div>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Média KM/L</p>
                                    <p className="text-2xl font-black tracking-tighter text-violet-400">{formatNumber(reportData.avgKmLFiltered || 0, 1)} Km/L</p>
                                </div>
                            </div>
                        </div>


                    </div>
                </div>

                {/* Main Action Controls */}
                <div className="flex flex-row xl:flex-col gap-3 flex-1 xl:max-w-xs">
                    <button
                        onClick={() => {
                            if (reportMode === 'complete') setReportMode('simplified');
                            handleOpenReport();
                        }}
                        disabled={isPreparingReport}
                        className={`flex-1 flex items-center justify-center gap-3 px-6 py-4 bg-blue-600 hover:bg-blue-700 rounded-3xl text-sm font-black uppercase tracking-widest transition-all shadow-xl shadow-blue-600/20 text-white ${isPreparingReport ? 'opacity-70 cursor-wait' : 'active:scale-95'}`}
                    >
                        <Download className="w-5 h-5" /> Exportar
                    </button>
                    <button
                        onClick={() => {
                            setSelectedEmpenhoRecords([]);
                            setShowEmpenhoOverlay(true);
                        }}
                        className="flex-1 flex items-center justify-center gap-3 px-6 py-4 bg-indigo-600 hover:bg-indigo-700 rounded-3xl text-sm font-black uppercase tracking-widest transition-all shadow-xl shadow-indigo-600/20 text-white active:scale-95"
                    >
                        <CheckSquare className="w-5 h-5" /> Inserir Empenho
                    </button>
                </div>
            </div>
            
            {savedEmpenhoReports.length > 0 && (
                <div className="mt-12 bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
                                <History className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="font-black text-slate-900 text-lg uppercase">Relatórios de Empenho Salvos</h3>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{savedEmpenhoReports.length} relatórios gerados</p>
                            </div>
                        </div>
                    </div>
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {savedEmpenhoReports.map(file => {
                            const date = new Date(file.created_at || '').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                            return (
                                <div key={file.id} className="bg-slate-50 border border-slate-100 rounded-[1.5rem] p-5 flex items-start gap-4 transition-all hover:bg-slate-100/50 hover:border-slate-200">
                                    <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-red-500 shrink-0 border border-slate-100">
                                        <FileText className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-bold text-slate-900 text-sm truncate">{file.name}</h4>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1 mb-3">Gerado em: {date}</p>
                                        <div className="flex gap-2">
                                            <a
                                                href={`${supabase.storage.from('attachments').getPublicUrl(`empenho_reports/${file.name}`).data.publicUrl}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest text-[9px] rounded-lg transition-colors"
                                            >
                                                <Download className="w-3 h-3" />
                                                Baixar
                                            </a>
                                            <button
                                                onClick={() => setReportToDelete(file)}
                                                className="w-8 h-8 flex items-center justify-center bg-white border border-slate-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 text-slate-400 rounded-lg transition-colors"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

        </div>
        );
    };

    return (
        <div className="flex-1 h-full bg-slate-50 p-4 wide:p-6 overflow-auto custom-scrollbar relative">
            {showToast && (
                <div className={`fixed bottom-8 right-8 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 animate-fade-in z-[100] ${toastType === 'success' ? 'bg-emerald-600' : 'bg-red-600'}`}>
                    {toastType === 'success' ? <Save className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                    <span className="font-bold">{toastMessage}</span>
                </div>
            )}
            {reportToDelete && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-[2rem] w-full max-w-sm overflow-hidden shadow-2xl border border-slate-100 flex flex-col p-6 animate-slide-up">
                        <div className="flex items-center gap-4 mb-4 text-red-500">
                            <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center text-red-600 shrink-0 border border-red-100">
                                <Trash2 className="w-6 h-6" />
                            </div>
                            <h3 className="text-lg font-black text-slate-800 leading-tight">Excluir Relatório?</h3>
                        </div>
                        <p className="text-slate-500 text-sm font-medium mb-6">
                            Tem certeza que deseja excluir o relatório <span className="font-bold text-slate-700">{reportToDelete.name}</span>? Esta ação não pode ser desfeita.
                        </p>
                        <div className="flex gap-3 mt-auto">
                            <button
                                onClick={() => setReportToDelete(null)}
                                className="flex-1 px-4 py-3 bg-slate-100 text-slate-600 font-bold text-sm uppercase tracking-widest rounded-xl hover:bg-slate-200 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={async () => {
                                    const fileToDel = reportToDelete;
                                    setReportToDelete(null);
                                    const { data, error } = await supabase.storage.from('attachments').remove([`empenho_reports/${fileToDel.name}`]);
                                    if (error || !data || data.length === 0) {
                                        showErrorToast(`Falha ou bloqueio do sistema ao excluir. NENHUM arquivo apagado.`);
                                    } else {
                                        loadSavedEmpenhoReports();
                                        showSuccessToast('Arquivo excluído com sucesso.');
                                    }
                                }}
                                className="flex-[2] px-4 py-3 bg-red-600 text-white font-black text-sm uppercase tracking-widest rounded-xl hover:bg-red-700 transition-colors shadow-lg shadow-red-500/30"
                            >
                                Excluir
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <div className="w-full space-y-8 animate-fade-in">
                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 mb-8">
                    <div className="flex items-center gap-4">
                        <button onClick={onBack} className="p-2 -ml-2 text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg transition-all shadow-sm ring-1 ring-slate-200 bg-white">
                            <ArrowLeft className="w-6 h-6" />
                        </button>
                        <div>
                            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Dashboard do Abastecimento</h1>
                            <p className="text-slate-500 font-medium">Indicadores de consumo e custos</p>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                        {/* Seletor Unificado de Período (Mensal / Diário por Intervalo de Datas) */}
                        <div className="w-full sm:w-80">
                            <MonthYearPicker
                                selectedMonth={selectedMonth}
                                selectedYear={selectedYear}
                                onChange={(m, y) => {
                                    setSelectedMonth(m);
                                    setSelectedYear(y);
                                }}
                                periodMode={periodMode}
                                startDate={customStartDate}
                                endDate={customEndDate}
                                onPeriodModeChange={(mode) => setPeriodMode(mode)}
                                onDateRangeChange={(start, end) => {
                                    setCustomStartDate(start);
                                    setCustomEndDate(end);
                                }}
                                onReset={() => {
                                    setPeriodMode('monthly');
                                    setSelectedMonth(new Date().getMonth());
                                    setSelectedYear(new Date().getFullYear());
                                }}
                            />
                        </div>

                        {/* Tab Navigation */}
                        <div className="flex p-1 bg-slate-200/50 border border-slate-200/60 rounded-2xl overflow-x-auto custom-scrollbar">
                            <button
                                onClick={() => setActiveTab('overview')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300 ${activeTab === 'overview'
                                    ? 'bg-white text-cyan-600 shadow-sm ring-1 ring-black/5'
                                    : 'text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                <LayoutDashboard className="w-3.5 h-3.5" />
                                Visão Geral
                            </button>
                            <button
                                onClick={() => setActiveTab('vehicle')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300 ${activeTab === 'vehicle'
                                    ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5'
                                    : 'text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                <Truck className="w-3.5 h-3.5" />
                                Veículos
                            </button>
                            <button
                                onClick={() => setActiveTab('sector')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300 ${activeTab === 'sector'
                                    ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-black/5'
                                    : 'text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                <Factory className="w-3.5 h-3.5" />
                                Setor
                            </button>
                            <button
                                onClick={() => setActiveTab('driver')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300 ${activeTab === 'driver'
                                    ? 'bg-white text-emerald-600 shadow-sm ring-1 ring-black/5'
                                    : 'text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                <Users className="w-3.5 h-3.5" />
                                Motoristas
                            </button>
                            <button
                                onClick={() => setActiveTab('reports')}

                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300 ${activeTab === 'reports'
                                    ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-black/5'
                                    : 'text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                <FileText className="w-3.5 h-3.5" />
                                Relatórios
                            </button>
                            <button
                                onClick={() => setActiveTab('lancamentos')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300 ${activeTab === 'lancamentos'
                                    ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5'
                                    : 'text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                <FileSpreadsheet className="w-3.5 h-3.5" />
                                Lançamentos
                            </button>
                            {user?.role === 'admin' && (
                                <button
                                    onClick={() => setActiveTab('config')}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300 ${activeTab === 'config'
                                        ? 'bg-white text-slate-900 shadow-sm ring-1 ring-black/5'
                                        : 'text-slate-500 hover:text-slate-700'
                                        }`}
                                >
                                    <Settings className="w-3.5 h-3.5" />
                                    Ajustes
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                <div className="min-h-[500px]">
                    {activeTab === 'overview' && renderOverview()}
                    {activeTab === 'vehicle' && renderVehicleView()}
                    {activeTab === 'sector' && renderSectorView()}
                    {activeTab === 'driver' && renderDriverView()}
                    {activeTab === 'reports' && renderReportsView()}
                    {activeTab === 'lancamentos' && renderLancamentosView()}
                    {activeTab === 'config' && user?.role === 'admin' && <ConfigPanel fuelTypes={fuelTypes} gasStations={gasStations as any} />}
                </div>
            </div>

            {/* Modal de Detalhamento Interativo (Drill-Down) de Métricas e Anomalias */}
            {drillDownModal && drillDownModal.isOpen && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-[2rem] w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden animate-slide-up">
                        {/* Header do Modal */}
                        <div className="p-6 sm:p-7 border-b border-slate-100 flex items-start justify-between bg-gradient-to-r from-slate-50 to-white">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-cyan-100 rounded-2xl flex items-center justify-center text-cyan-600 shadow-sm shrink-0">
                                    <Layers className="w-6 h-6" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">{drillDownModal.title}</h3>
                                        <span className="bg-cyan-100 text-cyan-800 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                                            {drillDownModal.records.length} registros
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                                        {drillDownModal.subtitle || 'Registros individuais que compõem este indicador no período'}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    setDrillDownModal(null);
                                    setDrillDownSearch('');
                                }}
                                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Barra de KPIs do Subconjunto e Barra de Pesquisa */}
                        {(() => {
                            const term = drillDownSearch.toLowerCase().trim();
                            const filteredList = drillDownModal.records.filter(r => {
                                if (!term) return true;
                                const vehicleName = (r.vehicle || '').toLowerCase();
                                const driver = (r.driver || '').toLowerCase();
                                const station = (r.station || '').toLowerCase();
                                const fuel = (r.fuelType || '').toLowerCase();
                                const invoice = (r.invoiceNumber || '').toLowerCase();
                                const protocol = (r.protocol || '').toLowerCase();
                                return vehicleName.includes(term) || driver.includes(term) || station.includes(term) || fuel.includes(term) || invoice.includes(term) || protocol.includes(term);
                            });

                            const totalCost = filteredList.reduce((acc, r) => acc + (r.cost || 0), 0);
                            const totalLiters = filteredList.reduce((acc, r) => acc + (r.liters || 0), 0);
                            const avgPrice = totalLiters > 0 ? totalCost / totalLiters : 0;

                            return (
                                <>
                                    <div className="p-4 sm:p-6 bg-slate-50/70 border-b border-slate-100 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                                        {/* Cards Rápidos de Somatório */}
                                        <div className="grid grid-cols-3 gap-3 flex-1">
                                            <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-sm">
                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Gasto Total</span>
                                                <span className="text-sm sm:text-base font-black text-emerald-600">{formatCurrency(totalCost)}</span>
                                            </div>
                                            <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-sm">
                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Volume Total</span>
                                                <span className="text-sm sm:text-base font-black text-blue-600">{formatNumber(totalLiters, 1)} L</span>
                                            </div>
                                            <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-sm">
                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Preço Médio</span>
                                                <span className="text-sm sm:text-base font-black text-slate-700">{formatCurrency(avgPrice)}/L</span>
                                            </div>
                                        </div>

                                        {/* Busca Rápida no Modal */}
                                        <div className="relative w-full md:w-80">
                                            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                                            <input
                                                type="text"
                                                value={drillDownSearch}
                                                onChange={(e) => setDrillDownSearch(e.target.value)}
                                                placeholder="Filtrar por veículo, motorista, NF..."
                                                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all shadow-sm"
                                            />
                                        </div>
                                    </div>

                                    {/* Tabela de Registros com Rolagem */}
                                    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6">
                                        {filteredList.length === 0 ? (
                                            <div className="py-16 text-center text-slate-400">
                                                <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                                                <p className="font-bold text-sm">Nenhum registro encontrado</p>
                                                <p className="text-xs text-slate-400 mt-1">Verifique o termo digitado no filtro de busca.</p>
                                            </div>
                                        ) : (
                                            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                                                <table className="w-full text-left text-xs border-collapse">
                                                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200 text-[10px]">
                                                        <tr>
                                                            <th className="px-4 py-3">Data / Hora</th>
                                                            <th className="px-4 py-3">Protocolo / NF</th>
                                                            <th className="px-4 py-3">Veículo</th>
                                                            <th className="px-4 py-3">Condutor</th>
                                                            <th className="px-4 py-3">Setor</th>
                                                            <th className="px-4 py-3">Posto</th>
                                                            <th className="px-4 py-3">Combustível</th>
                                                            <th className="px-4 py-3 text-right">Litros</th>
                                                            <th className="px-4 py-3 text-right">Hodômetro</th>
                                                            <th className="px-4 py-3 text-right">Preço Unit.</th>
                                                            <th className="px-4 py-3 text-right">Valor Total</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100 font-medium">
                                                        {filteredList.map((r) => {
                                                            const unitPrice = (r as any).pricePerLiter || ((r as any).price !== undefined ? (r as any).price : (r.liters > 0 ? r.cost / r.liters : 0));
                                                            const sector = (r as any).derivedSector || (r.vehicle ? vehicleSectorLookup.get(r.vehicle.toUpperCase().trim()) : undefined) || (r as any).sector || '-';
                                                            return (
                                                                <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                                        <div className="font-bold text-slate-800">
                                                                            {new Date(r.date).toLocaleDateString('pt-BR')}
                                                                        </div>
                                                                        <div className="text-[10px] text-slate-400">
                                                                            {new Date(r.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                                        {r.protocol && (
                                                                            <span className="font-mono text-[11px] font-bold text-slate-700 block">
                                                                                #{r.protocol}
                                                                            </span>
                                                                        )}
                                                                        <span className="text-[10px] text-slate-400 font-medium">
                                                                            NF: {getDisplayInvoiceNumber(r.invoiceNumber) || 'S/N'}
                                                                        </span>
                                                                    </td>
                                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                                        <span className="font-bold text-slate-800 uppercase flex items-center gap-1.5">
                                                                            <Car className="w-3.5 h-3.5 text-cyan-600" />
                                                                            {r.vehicle}
                                                                        </span>
                                                                    </td>
                                                                    <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                                                                        {r.driver || <span className="text-slate-300 italic">Não informado</span>}
                                                                    </td>
                                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                                        <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md uppercase">
                                                                            {sector}
                                                                        </span>
                                                                    </td>
                                                                    <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                                                                        {r.station || '-'}
                                                                    </td>
                                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                                        <span className="font-bold text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded-md text-[10px] uppercase">
                                                                            {r.fuelType}
                                                                        </span>
                                                                    </td>
                                                                    <td className="px-4 py-3 text-right whitespace-nowrap font-bold text-blue-600">
                                                                        {formatNumber(r.liters, 1)} L
                                                                    </td>
                                                                    <td className="px-4 py-3 text-right whitespace-nowrap font-bold text-slate-700">
                                                                        {formatNumber(r.odometer, 0)} km
                                                                    </td>
                                                                    <td className="px-4 py-3 text-right whitespace-nowrap text-slate-600">
                                                                        {formatCurrency(unitPrice)}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-right whitespace-nowrap font-black text-emerald-600">
                                                                        {formatCurrency(r.cost)}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>

                                    {/* Rodapé do Modal */}
                                    <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
                                        <span className="text-slate-500 font-medium">
                                            Exibindo <span className="font-bold text-slate-800">{filteredList.length}</span> de <span className="font-bold text-slate-800">{drillDownModal.records.length}</span> registros
                                        </span>
                                        <button
                                            onClick={() => {
                                                setDrillDownModal(null);
                                                setDrillDownSearch('');
                                            }}
                                            className="px-6 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-95"
                                        >
                                            Fechar
                                        </button>
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                </div>
            )}

            {showPrintPreview && (
                <AbastecimentoReportPDF
                    data={reportData}
                    filters={appliedFilters}
                    state={state}
                    mode={reportMode}
                    persons={persons}
                    gasStations={gasStations}
                    onClose={() => setShowPrintPreview(false)}
                />
            )}

            {showHistoryPrintPreview && selectedHistoryReport && historyReportData && (
                <AbastecimentoReportPDF
                    data={historyReportData}
                    filters={{
                        startDate: selectedHistoryReport.start_date || '',
                        endDate: selectedHistoryReport.end_date || '',
                        station: selectedHistoryReport.station || 'all',
                        sector: selectedHistoryReport.sector || 'all',
                        vehicle: selectedHistoryReport.vehicle || 'all',
                        fuelType: selectedHistoryReport.fuel_type ? selectedHistoryReport.fuel_type.split(',') : ['all']
                    }}
                    state={state}
                    mode={selectedHistoryReport.report_type}
                    persons={persons}
                    gasStations={gasStations}
                    onClose={() => {
                        setShowHistoryPrintPreview(false);
                        setSelectedHistoryReport(null);
                    }}
                />
            )}
        </div>
    );
};

