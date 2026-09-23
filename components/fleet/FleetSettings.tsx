import React, { useState, useEffect } from 'react';
import { 
    FleetSettings as FleetSettingsType 
} from '../../types/fleetTypes';
import { 
    fleetManagementService 
} from '../../services/fleetManagementService';
import { 
    Sliders, 
    Save, 
    Loader2, 
    CheckCircle2, 
    AlertTriangle, 
    Droplet, 
    Layers, 
    Calendar, 
    ShieldCheck 
} from 'lucide-react';

interface FleetSettingsProps {
    onSettingsSaved?: (settings: FleetSettingsType) => void;
}

export const FleetSettings: React.FC<FleetSettingsProps> = ({ onSettingsSaved }) => {
    const [settings, setSettings] = useState<FleetSettingsType>({
        oilAlertThresholdKm: 500,
        timingBeltAlertThresholdKm: 2000,
        maintenanceAlertThresholdDays: 15,
        defaultOilKm: 5000,
        defaultTimingBeltKm: 50000
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [successMessage, setSuccessMessage] = useState(false);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const s = await fleetManagementService.getSettings();
                setSettings(s);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const saved = await fleetManagementService.saveSettings(settings);
            setSuccessMessage(true);
            setTimeout(() => setSuccessMessage(false), 3000);
            if (onSettingsSaved) onSettingsSaved(saved);
        } catch (err: any) {
            alert('Erro ao salvar configurações: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="h-64 flex items-center justify-center gap-2">
                <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
                <span className="text-xs font-bold text-slate-500 uppercase">Carregando configurações...</span>
            </div>
        );
    }

    return (
        <div className="space-y-4 md:space-y-6 pb-12 animate-in fade-in duration-300 max-w-4xl">
            {/* Header */}
            <div className="bg-white p-4 md:p-5 rounded-3xl border border-slate-200/90 shadow-sm">
                <div className="flex items-center gap-2">
                    <h2 className="text-base md:text-xl font-black bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 bg-clip-text text-transparent uppercase tracking-tight">
                        Configurações da Frota Municipal
                    </h2>
                </div>
                <p className="text-xs font-semibold text-slate-500 mt-0.5">
                    Parâmetros de alerta mecânico, bases de cálculo e regras armazenadas no Supabase
                </p>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
                {/* Bloco 1: Limites de Alerta de Manutenção */}
                <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-5 space-y-4">
                    <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                        <AlertTriangle className="w-5 h-5 text-amber-500" />
                        <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                            Limites de Aviso Preventivo (Status Próximo - 🟡)
                        </h3>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                            <label className="text-[11px] font-black uppercase text-slate-500 block mb-1">
                                Alerta de Troca de Óleo (KM Antes)
                            </label>
                            <input
                                type="number"
                                required
                                min="100"
                                max="2000"
                                value={settings.oilAlertThresholdKm}
                                onChange={e => setSettings({ ...settings, oilAlertThresholdKm: Number(e.target.value) })}
                                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                            />
                            <span className="text-[10px] text-slate-400 mt-0.5 block">
                                O status vira 🟡 quando faltar esta quilometragem
                            </span>
                        </div>

                        <div>
                            <label className="text-[11px] font-black uppercase text-slate-500 block mb-1">
                                Alerta de Correia Dentada (KM Antes)
                            </label>
                            <input
                                type="number"
                                required
                                min="500"
                                max="10000"
                                value={settings.timingBeltAlertThresholdKm}
                                onChange={e => setSettings({ ...settings, timingBeltAlertThresholdKm: Number(e.target.value) })}
                                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                            />
                            <span className="text-[10px] text-slate-400 mt-0.5 block">
                                Padrão sugerido: 2.000 km antes do limite
                            </span>
                        </div>

                        <div>
                            <label className="text-[11px] font-black uppercase text-slate-500 block mb-1">
                                Alerta por Data (Dias Antes)
                            </label>
                            <input
                                type="number"
                                required
                                min="1"
                                max="60"
                                value={settings.maintenanceAlertThresholdDays}
                                onChange={e => setSettings({ ...settings, maintenanceAlertThresholdDays: Number(e.target.value) })}
                                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                            />
                            <span className="text-[10px] text-slate-400 mt-0.5 block">
                                Avisa revisões que vencerão nos próximos N dias
                            </span>
                        </div>
                    </div>
                </div>

                {/* Bloco 2: Bases Padrão de Cálculo */}
                <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-5 space-y-4">
                    <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                        <Droplet className="w-5 h-5 text-sky-500" />
                        <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                            Bases de Cálculo Padrão
                        </h3>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="text-[11px] font-black uppercase text-slate-500 block mb-1">
                                Periodicidade Padrão de Troca de Óleo
                            </label>
                            <select
                                value={settings.defaultOilKm}
                                onChange={e => setSettings({ ...settings, defaultOilKm: Number(e.target.value) })}
                                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                            >
                                <option value="5000">5.000 km (Padrão Uso Severo / Urbano)</option>
                                <option value="7000">7.000 km</option>
                                <option value="10000">10.000 km (Sintético / Rodoviário)</option>
                            </select>
                        </div>

                        <div>
                            <label className="text-[11px] font-black uppercase text-slate-500 block mb-1">
                                Periodicidade Padrão de Correia Dentada
                            </label>
                            <select
                                value={settings.defaultTimingBeltKm}
                                onChange={e => setSettings({ ...settings, defaultTimingBeltKm: Number(e.target.value) })}
                                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                            >
                                <option value="40000">40.000 km</option>
                                <option value="50000">50.000 km (Padrão Geral)</option>
                                <option value="60000">60.000 km</option>
                                <option value="80000">80.000 km</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Botão de Salvar */}
                <div className="flex items-center justify-between pt-2">
                    {successMessage ? (
                        <div className="flex items-center gap-1.5 text-emerald-600 text-xs font-black uppercase animate-in fade-in">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Configurações salvas no Supabase com sucesso!</span>
                        </div>
                    ) : <div></div>}

                    <button
                        type="submit"
                        disabled={saving}
                        className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md active:scale-95 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        <span>{saving ? 'Salvando...' : 'Salvar Configurações'}</span>
                    </button>
                </div>
            </form>
        </div>
    );
};
