import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { ArrowLeft, TrendingUp, Droplet, DollarSign, Truck, Settings, LayoutDashboard, Building2, MapPin, CreditCard, Fuel, Save, Plus, Calendar, ChevronDown, History, BarChart3, Search, ChevronRight, FileText, Filter, FileSpreadsheet, Download, CalendarDays, Factory, Car, AlertTriangle, Trash2, CheckSquare, Check, X, ShieldAlert } from 'lucide-react';
import { ModernSelect } from '../common/ModernSelect';
import { ModernDateInput } from '../common/ModernDateInput';
import { AbastecimentoService, AbastecimentoRecord, AbastecimentoReportHistory, ScheduledPriceUpdate, GasStation, FuelConfig } from '../../services/abastecimentoService';
import { getVehicles, getSectors } from '../../services/entityService';
import { AbastecimentoReportPDF } from './AbastecimentoReportPDF';
import { AppState, Vehicle, Sector } from '../../types';
import { supabase } from '../../services/supabaseClient';
import { uploadFile } from '../../services/storageService';
import { generateEmpenhoReportPDF } from '../../utils/empenhoReportGenerator';
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

type TabType = 'overview' | 'vehicle' | 'sector' | 'reports' | 'lancamentos' | 'config';

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
    const [vehicleSearchTerm, setVehicleSearchTerm] = useState('');
    const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);
    const [allRecords, setAllRecords] = useState<AbastecimentoRecord[]>([]);
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

    const loadRecords = async (limit: number = 2000) => {
        // PERF: Temporarily fetching a large number of records to maintain dashboard functionality 
        // which relies on client-side aggregation. Future TODO: Refactor dashboard to use server-side aggregation.
        const { data } = await AbastecimentoService.getAbastecimentos(1, limit);
        setAllRecords(data);
    };

    const loadReportHistory = async () => {
        const history = await AbastecimentoService.getReportHistory();
        setReportHistory(history);
    };

    useEffect(() => {
        loadRecords();
        loadReportHistory();

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
    }, []);

    // Effect to handle manual refresh trigger
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
            await loadRecords(10000);

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
        // Current filtered records
        const filtered = allRecords.filter(r => {
            const date = new Date(r.date);
            return date.getMonth() === selectedMonth && date.getFullYear() === selectedYear;
        });

        // Previous month records for comparison
        const prevMonth = selectedMonth === 0 ? 11 : selectedMonth - 1;
        const prevYear = selectedMonth === 0 ? selectedYear - 1 : selectedYear;
        const previous = allRecords.filter(r => {
            const date = new Date(r.date);
            return date.getMonth() === prevMonth && date.getFullYear() === prevYear;
        });

        const totalCost = filtered.reduce((acc, r) => acc + r.cost, 0);
        const prevCost = previous.reduce((acc, r) => acc + r.cost, 0);
        const costDiff = prevCost === 0 ? 0 : ((totalCost - prevCost) / prevCost) * 100;

        const totalLiters = filtered.reduce((acc, r) => acc + r.liters, 0);
        const prevLiters = previous.reduce((acc, r) => acc + r.liters, 0);
        const litersDiff = prevLiters === 0 ? 0 : ((totalLiters - prevLiters) / prevLiters) * 100;

        // Group by vehicle
        const vehicleGroups = filtered.reduce((acc, r) => {
            if (!acc[r.vehicle]) {
                // Try to resolve a friendly name if the record stores a Plate
                const matchedVehicle = vehicles.find(v => v.plate === r.vehicle);
                const displayName = matchedVehicle
                    ? `${matchedVehicle.model} (${matchedVehicle.plate})`
                    : r.vehicle;

                // Solve Sector Name
                let sectorName = 'Não Identificado';
                if (matchedVehicle) {
                    const s = sectors.find(sec => sec.id === matchedVehicle.sectorId);
                    if (s) sectorName = s.name;
                }

                acc[r.vehicle] = {
                    id: r.vehicle,
                    name: displayName,
                    totalCost: 0,
                    totalLiters: 0,
                    count: 0,
                    lastRef: r.date,
                    avgKmL: 0,
                    sectorName: sectorName
                };
            }
            acc[r.vehicle].totalCost += r.cost;
            acc[r.vehicle].totalLiters += r.liters;
            acc[r.vehicle].count += 1;
            if (new Date(r.date) > new Date(acc[r.vehicle].lastRef)) {
                acc[r.vehicle].lastRef = r.date;
            }
            return acc;
        }, {} as Record<string, VehicleStat>);

        // Calculate Global Average KM/L (Efficiency) AND Per Vehicle Efficiency
        // We need to calculate efficiency for each fill-up interval across all vehicles
        let totalEfficiencySum = 0;
        let efficiencyCount = 0;
        const vehicleEfficiencySums: Record<string, { sum: number, count: number }> = {};

        // Group ALL records (not just filtered) by vehicle to calculate full history context
        // We need history to calculate efficiency for the CURRENT month records
        const allByVehicle: Record<string, AbastecimentoRecord[]> = {};
        allRecords.forEach(r => {
            if (!allByVehicle[r.vehicle]) allByVehicle[r.vehicle] = [];
            allByVehicle[r.vehicle].push(r);
        });

        // For each vehicle, calculate efficiencies
        Object.values(allByVehicle).forEach(vehicleRecords => {
            // Sort by date
            const sorted = vehicleRecords.map(r => ({ ...r, dateObj: new Date(r.date) }))
                .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());

            sorted.forEach((record, index) => {
                // Check if this record belongs to the CURRENT selected month/year
                const rDate = record.dateObj;
                const isCurrentPeriod = rDate.getMonth() === selectedMonth && rDate.getFullYear() === selectedYear;

                if (isCurrentPeriod) {
                    // Check exclusion for Arla
                    const isArla = record.fuelType.toLowerCase().includes('arla');

                    if (!isArla) {
                        // Look ahead for the next NON-Arla record
                        let nextRecord = null;
                        for (let i = index + 1; i < sorted.length; i++) {
                            if (!sorted[i].fuelType.toLowerCase().includes('arla')) {
                                nextRecord = sorted[i];
                                break;
                            }
                        }

                        if (nextRecord) {
                            const distanceToNext = Number(nextRecord.odometer) - Number(record.odometer);
                            const nextLiters = Number(nextRecord.liters);

                            if (distanceToNext > 0 && nextLiters > 0) {
                                const efficiency = distanceToNext / nextLiters;
                                totalEfficiencySum += efficiency;
                                efficiencyCount++;

                                // Per Vehicle Accumulation
                                if (!vehicleEfficiencySums[record.vehicle]) {
                                    vehicleEfficiencySums[record.vehicle] = { sum: 0, count: 0 };
                                }
                                vehicleEfficiencySums[record.vehicle].sum += efficiency;
                                vehicleEfficiencySums[record.vehicle].count++;
                            }
                        }
                    }
                }
            });
        });

        const avgKmL = efficiencyCount > 0 ? (totalEfficiencySum / efficiencyCount) : 0;

        // Finalize Vehicle Stats with Efficiency
        const vehicleStats = Object.values(vehicleGroups)
            .map((v: VehicleStat) => ({
                ...v,
                avgKmL: vehicleEfficiencySums[v.id] ? (vehicleEfficiencySums[v.id].sum / vehicleEfficiencySums[v.id].count) : 0
            }))
            .sort((a, b) => b.totalCost - a.totalCost);

        const activeVehicles = vehicleStats.length;

        // --- NEW AGGREGATIONS FOR CHARTS ---

        // 1. Spending by Sector
        const sectorSpending: Record<string, number> = {};
        filtered.forEach(r => {
            // Find vehicle to get sector
            // Try matching by Plate first (new records), then by "Model - Brand" (legacy)
            const v = vehicles.find(veh => veh.plate === r.vehicle || `${veh.model} - ${veh.brand}` === r.vehicle);
            if (v) {
                const s = sectors.find(sec => sec.id === v.sectorId);
                const sectorName = s?.name || 'Não Identificado';
                sectorSpending[sectorName] = (sectorSpending[sectorName] || 0) + r.cost;
            } else {
                sectorSpending['Desconhecido'] = (sectorSpending['Desconhecido'] || 0) + r.cost;
            }
        });
        const sectorChartData = Object.entries(sectorSpending)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5); // Top 5

        // 2. Fuel Type Distribution
        const fuelDist: Record<string, number> = {};
        filtered.forEach(r => {
            // Clean fuel name "DIESEL S10 - DIESEL" -> "DIESEL"
            const type = r.fuelType.split(' - ')[0];
            fuelDist[type] = (fuelDist[type] || 0) + r.liters;
        });
        const fuelChartData = Object.entries(fuelDist).map(([name, value]) => ({ name, value }));
        const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

        // 3. Monthly Evolution (Last 6 Months)
        // We need to look at 'allRecords' for this, not just filtered
        const last6MonthsMatches = allRecords.filter(r => {
            const d = new Date(r.date);
            const now = new Date();
            const sixMonthsAgo = new Date();
            sixMonthsAgo.setMonth(now.getMonth() - 6);
            return d >= sixMonthsAgo && d <= now;
        });

        const evolutionMap: Record<string, { month: string, cost: number, liters: number }> = {};
        last6MonthsMatches.forEach(r => {
            const d = new Date(r.date);
            const key = `${d.getFullYear()}-${d.getMonth()}`; // sortable key
            const label = months[d.getMonth()].substring(0, 3);

            if (!evolutionMap[key]) {
                evolutionMap[key] = { month: label, cost: 0, liters: 0 };
            }
            evolutionMap[key].cost += r.cost;
            evolutionMap[key].liters += r.liters;
        });
        // Sort by time
        const evolutionChartData = Object.keys(evolutionMap).sort().map(k => evolutionMap[k]);

        // 4. Vehicle Rankings
        // Most Expensive (Total Cost)
        const topConsumptionVehicles = [...vehicleStats]
            .sort((a, b) => b.totalCost - a.totalCost)
            .slice(0, 5);

        // Best Efficiency (calculated earlier per vehicle in detail, but here we can approximate or reuse logic)
        // Since we calculated 'efficiency' per tank in detail, we don't have it easily available in 'vehicleStats' 
        // without re-running the logic. Let's stick to consumption (R$/km) if possible or just total cost.
        // Let's add 'totalKm' to vehicleStats to compute R$/km

        // 5. Alerts - Efficiency Check
        // Filter: Only vehicles with minKml/maxKml defined AND violating the range
        const costAlerts = vehicleStats.reduce((acc, v) => {
            // Find full vehicle object
            const fullVehicle = vehicles.find(veh =>
                (veh.plate && veh.plate === v.id) ||
                (`${veh.model} - ${veh.brand}` === v.id) ||
                (veh.plate && v.id.includes(veh.plate))
            );

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

        // Total KM (for filtered period)
        // We need to sum the distance of intervals in this period.
        // Re-use logic from Global Avg Calc?
        let totalKmPeriod = 0;
        // Logic: iterate filtered sessions? No, because distance is relative.
        // We can approximate with: sum of (next_odometer - current_odometer) for records in this month.
        // Let's reuse the Global Avg loop variables if possible, or re-run.
        // For simplicity, let's create a 'totalDistance' accumulator in the GLOBAL loop we added step 162.
        // (Wait, I can just modify that loop to export totalDistanceSum)
        // Re-writing that loop slightly to capture 'totalDistanceSum'
        let totalDistanceSum = 0;
        Object.values(allByVehicle).forEach(vehicleRecords => {
            const sorted = vehicleRecords.map(r => ({ ...r, dateObj: new Date(r.date) })).sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
            sorted.forEach((record, index) => {
                const rDate = record.dateObj;
                if (rDate.getMonth() === selectedMonth && rDate.getFullYear() === selectedYear) {
                    const isArla = record.fuelType.toLowerCase().includes('arla');
                    if (!isArla) {
                        // Look ahead logic again
                        let nextRecord = null;
                        for (let i = index + 1; i < sorted.length; i++) {
                            if (!sorted[i].fuelType.toLowerCase().includes('arla')) {
                                nextRecord = sorted[i];
                                break;
                            }
                        }
                        if (nextRecord) {
                            const dist = Number(nextRecord.odometer) - Number(record.odometer);
                            if (dist > 0) totalDistanceSum += dist;
                        }
                    }
                }
            });
        });


        return {
            totalCost,
            costDiff,
            totalLiters,
            litersDiff,
            activeVehicles,
            avgKmL,
            totalKmPeriod: totalDistanceSum,
            allVehiclesCount: vehicles.length,
            filteredCount: filtered.length,
            vehicleStats,
            records: filtered,
            // New Data
            sectorChartData,
            fuelChartData,
            evolutionChartData,
            topConsumptionVehicles,
            costAlerts,
            COLORS
        };
    }, [selectedMonth, selectedYear, allRecords, vehicles, sectors]);

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
    }, [selectedMonth, selectedYear, selectedSector, allRecords, vehicles, sectors]);

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
    }, [allRecords, appliedFilters, vehicles, sectors]);

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
                        {Math.abs(sectorStats.costDiff).toFixed(1)}% vs anterior
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
                        {Math.abs(sectorStats.avgCostDiff).toFixed(1)}% vs anterior
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
                        {Math.abs(sectorStats.kmDiff).toFixed(1)}% vs anterior
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

    useEffect(() => {
        loadSavedEmpenhoReports();
    }, []);

    const renderOverview = () => (
        <div className="space-y-6 animate-fade-in pb-10">
            {/* 1. Top KPI Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Custo Total */}
                <div className="bg-white p-4 sm:p-6 rounded-[1.5rem] sm:rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <DollarSign className="w-24 h-24 text-emerald-600" />
                    </div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600">
                            <DollarSign className="w-5 h-5" />
                        </div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Custo Total</span>
                    </div>
                    <div className="relative z-10">
                        <h3 className="text-2xl sm:text-3xl font-black text-emerald-900 tracking-tight">
                            {formatCurrency(stats.totalCost)}
                        </h3>
                        <div className={`flex items-center gap-1 mt-1 text-xs font-bold ${stats.costDiff > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                            {stats.costDiff > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingUp className="w-3 h-3 rotate-180" />}
                            <span>{Math.abs(stats.costDiff).toFixed(1)}% vs anterior</span>
                        </div>
                    </div>
                </div>

                {/* Litros */}
                <div className="bg-white p-4 sm:p-6 rounded-[1.5rem] sm:rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <Droplet className="w-24 h-24 text-cyan-600" />
                    </div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-cyan-50 rounded-xl text-cyan-600">
                            <Droplet className="w-5 h-5" />
                        </div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Volume Total</span>
                    </div>
                    <div className="relative z-10">
                        <h3 className="text-2xl sm:text-3xl font-black text-cyan-900 tracking-tight">
                            {formatNumber(stats.totalLiters)} L
                        </h3>
                        <div className={`flex items-center gap-1 mt-1 text-xs font-bold ${stats.litersDiff > 0 ? 'text-cyan-500' : 'text-slate-400'}`}>
                            <span>{stats.filteredCount} abastecimentos</span>
                        </div>
                    </div>
                </div>

                {/* Avg KM/L */}
                <div className="bg-white p-4 sm:p-6 rounded-[1.5rem] sm:rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <BarChart3 className="w-24 h-24 text-violet-600" />
                    </div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-violet-50 rounded-xl text-violet-600">
                            <BarChart3 className="w-5 h-5" />
                        </div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Média Geral</span>
                    </div>
                    <div className="relative z-10">
                        <h3 className="text-2xl sm:text-3xl font-black text-violet-900 tracking-tight">
                            {formatNumber(stats.avgKmL, 1)} <span className="text-sm sm:text-lg text-slate-400 font-bold">Km/L</span>
                        </h3>
                        <p className="text-xs font-medium text-slate-400 mt-1">Eficiência da frota (S/ Arla)</p>
                    </div>
                </div>

                {/* Total KM */}
                <div className="bg-white p-4 sm:p-6 rounded-[1.5rem] sm:rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <MapPin className="w-24 h-24 text-amber-600" />
                    </div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-amber-50 rounded-xl text-amber-600">
                            <MapPin className="w-5 h-5" />
                        </div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Rodagem Total</span>
                    </div>
                    <div className="relative z-10">
                        <h3 className="text-2xl sm:text-3xl font-black text-amber-900 tracking-tight">
                            {formatNumber(stats.totalKmPeriod, 2)} <span className="text-sm sm:text-lg text-slate-400 font-bold">Km</span>
                        </h3>
                        <p className="text-xs font-medium text-slate-400 mt-1">Estimado no período</p>
                    </div>
                </div>
            </div>

            {/* 2. Charts Row: Evolution & Fuel Dist */}
            <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
                {/* Evolution Chart */}
                <div className="lg:col-span-2 xl:col-span-3 2xl:col-span-3 bg-white p-4 sm:p-6 rounded-[1.5rem] sm:rounded-[2rem] border border-slate-200 shadow-sm">
                    <div className="mb-6">
                        <h3 className="text-lg font-black text-slate-800">Evolução de Gastos</h3>
                        <p className="text-sm text-slate-400 font-medium">Histórico dos últimos 6 meses</p>
                    </div>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                            <AreaChart data={stats.evolutionChartData}>
                                <defs>
                                    <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.1} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis
                                    dataKey="month"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                                    dy={10}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                                    tickFormatter={(value) => `R$${value / 1000}k`}
                                />
                                <Tooltip
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    formatter={((value: number) => [`R$ ${value.toLocaleString()}`, 'Gasto']) as any}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="cost"
                                    stroke="#10b981"
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#colorCost)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Fuel Distribution */}
                <div className="xl:col-span-1 2xl:col-span-2 bg-white p-4 sm:p-6 rounded-[1.5rem] sm:rounded-[2rem] border border-slate-200 shadow-sm">
                    <div className="mb-6">
                        <h3 className="text-lg font-black text-slate-800">Por Combustível</h3>
                        <p className="text-sm text-slate-400 font-medium">Distribuição de volume (L)</p>
                    </div>
                    <div className="h-[300px] w-full flex flex-col items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                            <PieChart>
                                <Pie
                                    data={stats.fuelChartData}
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {stats.fuelChartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={stats.COLORS[index % stats.COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    formatter={((value: number) => [`${formatNumber(value, 2)} L`, 'Volume']) as any}
                                />
                                <Legend verticalAlign="bottom" height={36} iconType="circle" />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* 3. Charts Row: Sector & Ranking */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {/* Spending by Sector */}
                <div className="xl:col-span-2 bg-white p-4 sm:p-6 rounded-[1.5rem] sm:rounded-[2rem] border border-slate-200 shadow-sm">
                    <div className="mb-6">
                        <h3 className="text-lg font-black text-slate-800">Gastos por Secretaria</h3>
                        <p className="text-sm text-slate-400 font-medium">Top 5 setores com maior consumo</p>
                    </div>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                            <BarChart layout="vertical" data={stats.sectorChartData} margin={{ left: 40 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                                <XAxis type="number" hide />
                                <YAxis
                                    dataKey="name"
                                    type="category"
                                    axisLine={false}
                                    tickLine={false}
                                    width={100}
                                    tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
                                />
                                <Tooltip
                                    cursor={{ fill: '#f8fafc' }}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    formatter={((value: number) => [formatCurrency(value), 'Gasto']) as any}
                                />
                                <Bar dataKey="value" fill="#0ea5e9" radius={[0, 4, 4, 0]} barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Vehicle Ranking */}
                <div className="xl:col-span-1 bg-white p-4 sm:p-6 rounded-[1.5rem] sm:rounded-[2rem] border border-slate-200 shadow-sm">
                    <div className="mb-6 flex justify-between items-center">
                        <div>
                            <h3 className="text-lg font-black text-slate-800">Ranking de Veículos</h3>
                            <p className="text-sm text-slate-400 font-medium">Maiores consumidores do mês</p>
                        </div>
                        <div className="p-2 bg-red-50 text-red-500 rounded-xl">
                            <Fuel className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="space-y-4">
                        {stats.topConsumptionVehicles.map((v, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 flex items-center justify-center bg-white text-slate-700 font-black rounded-lg text-xs shadow-sm border border-slate-100">
                                        {idx + 1}
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-slate-900 uppercase truncate max-w-[120px]">{v.name}</p>
                                        <p className="text-[10px] text-slate-400 font-semibold">{v.count} abastecimentos</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-black text-slate-700">{formatCurrency(v.totalCost)}</p>
                                    <p className="text-[10px] text-slate-400 font-medium">{formatNumber(v.totalLiters)} L</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* 4. Alerts Section (if any) */}
            {stats.costAlerts.length > 0 && (
                <div className="bg-rose-50 p-6 rounded-[2rem] border border-rose-100">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-white text-rose-500 rounded-xl shadow-sm">
                            <TrendingUp className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-rose-700">Alertas de Consumo</h3>
                            <p className="text-sm text-rose-400 font-medium">
                                {stats.costAlerts.length} veículos fora da faixa de consumo esperada
                            </p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 wide:grid-cols-2 lg:grid-cols-3 gap-3">
                        {stats.costAlerts.map((v, idx) => {
                            const isLow = v.alertType === 'low';
                            // Calculate deviation %
                            // Low: (Target - Actual) / Target
                            // High: (Actual - Target) / Target
                            const diff = v.target ? Math.abs((v.avgKmL - v.target) / v.target) * 100 : 0;

                            return (
                                <div key={idx} className={`p-3 rounded-2xl shadow-sm border flex justify-between items-center ${isLow ? 'bg-white border-rose-100' : 'bg-amber-50 border-amber-100'}`}>
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-xl text-white shadow-sm ${isLow ? 'bg-rose-500' : 'bg-amber-500'}`}>
                                            <AlertTriangle className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-black text-slate-700 uppercase">{v.name}</h4>
                                            <p className={`text-[10px] font-bold mt-0.5 ${isLow ? 'text-rose-500' : 'text-amber-600'}`}>
                                                {isLow ? 'Abaixo do Mínimo' : 'Acima do Teto'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-black text-slate-900">{formatNumber(v.avgKmL, 1)} <span className="text-[9px] text-slate-400 font-bold">KM/L</span></p>
                                        <p className="text-[9px] font-bold text-slate-400">
                                            Meta: {isLow ? '>' : '<'} {formatNumber(v.target, 1)} <span className={`ml-1 ${isLow ? 'text-rose-500' : 'text-amber-500'}`}>({Math.round(diff)}%)</span>
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );

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
                                                {r.invoiceNumber || '-'}
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
                                            <span className="text-xs font-bold text-slate-700">🗓️ {history.start_date ? new Date(history.start_date).toLocaleDateString() : 'Início'} - {history.end_date ? new Date(history.end_date).toLocaleDateString() : 'Fim'}</span>
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
                                </tr>
                            ))}
                            {reportHistory.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
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
                        {/* Month/Year Selector */}
                        <div className="flex items-center gap-3">
                            <div className="w-40">
                                <ModernSelect
                                    value={selectedMonth}
                                    onChange={(val) => setSelectedMonth(Number(val))}
                                    options={months.map((m, idx) => ({ value: idx, label: m }))}
                                    icon={CalendarDays}
                                />
                            </div>
                            <div className="w-36">
                                <ModernSelect
                                    value={selectedYear}
                                    onChange={(val) => setSelectedYear(Number(val))}
                                    options={[2024, 2025, 2026].map(y => ({ value: y, label: String(y) }))}
                                    icon={Calendar}
                                />
                            </div>
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
                    {activeTab === 'reports' && renderReportsView()}
                    {activeTab === 'lancamentos' && renderLancamentosView()}
                    {activeTab === 'config' && user?.role === 'admin' && <ConfigPanel fuelTypes={fuelTypes} gasStations={gasStations as any} />}
                </div>
            </div>

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
        </div>
    );
};
