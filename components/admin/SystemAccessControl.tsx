import React, { useState, useMemo } from 'react';
import { 
  Shield, ShieldCheck, ShieldAlert, CheckCircle2, XCircle, 
  AlertTriangle, Search, Lock, ArrowLeft, RefreshCw, 
  ChevronRight, ChevronDown, Layout, Settings2, Power,
  Activity, Info, FileText, ShoppingCart, Gavel, Briefcase,
  Car, Calendar, Truck, Fuel, Sprout, HardHat, CheckSquare,
  Users, Megaphone, Box, Monitor, Smartphone
} from 'lucide-react';
import { useSystemSettings } from '../../contexts/SystemSettingsContext';
import { GlobalLoading } from '../common/GlobalLoading';

interface SystemAccessControlProps {
    onBack?: () => void;
}

export const SystemAccessControl: React.FC<SystemAccessControlProps> = ({ onBack }) => {
    const { settings = [], toggleModule, isLoading } = useSystemSettings();
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<'web' | 'mobile'>('web');
    const [processingKey, setProcessingKey] = useState<string | null>(null);
    const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});

    const getModuleIcon = (key: string) => {
        switch (key) {
            case 'parent_criar_oficio': return <FileText className="w-7 h-7 transition-transform duration-500 group-hover:scale-110" />;
            case 'parent_compras': return <ShoppingCart className="w-7 h-7 transition-transform duration-500 group-hover:scale-110" />;
            case 'parent_licitacao': return <Gavel className="w-7 h-7 transition-transform duration-500 group-hover:scale-110" />;
            case 'parent_diarias': return <Briefcase className="w-7 h-7 transition-transform duration-500 group-hover:scale-110" />;
            case 'parent_agendamento_veiculo': return <Car className="w-7 h-7 transition-transform duration-500 group-hover:scale-110" />;
            case 'parent_calendario': return <Calendar className="w-7 h-7 transition-transform duration-500 group-hover:scale-110" />;
            case 'parent_frotas': return <Truck className="w-7 h-7 transition-transform duration-500 group-hover:scale-110" />;
            case 'parent_abastecimento': return <Fuel className="w-7 h-7 transition-transform duration-500 group-hover:scale-110" />;
            case 'parent_agricultura': return <Sprout className="w-7 h-7 transition-transform duration-500 group-hover:scale-110" />;
            case 'parent_obras': return <HardHat className="w-7 h-7 transition-transform duration-500 group-hover:scale-110" />;
            case 'parent_tarefas': return <CheckSquare className="w-7 h-7 transition-transform duration-500 group-hover:scale-110" />;
            case 'parent_rh': return <Users className="w-7 h-7 transition-transform duration-500 group-hover:scale-110" />;
            case 'parent_marketing': return <Megaphone className="w-7 h-7 transition-transform duration-500 group-hover:scale-110" />;
            case 'parent_projetos': return <Box className="w-7 h-7 transition-transform duration-500 group-hover:scale-110" />;
            default: return <Layout className="w-7 h-7 transition-transform duration-500 group-hover:scale-110" />;
        }
    };

    // Grouping logic
    const parentModules = useMemo(() => {
        return settings
            .filter(s => !s.parent_key)
            .sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
    }, [settings]);

    const handleToggle = async (key: string, currentValue: boolean) => {
        setProcessingKey(key);
        try {
            await toggleModule(key, !currentValue, activeTab);
        } finally {
            setProcessingKey(null);
        }
    };

    const toggleExpand = (key: string) => {
        setExpandedModules(prev => ({ ...prev, [key]: !prev[key] }));
    };

    if (isLoading) {
        return (
            <div className="fixed inset-0 flex items-center justify-center bg-slate-50/50 backdrop-blur-sm z-50">
                <GlobalLoading type="inline" message="Sincronizando permissões globais..." />
            </div>
        );
    }

    const filteredParents = parentModules.filter(parent => {
        const children = settings.filter(s => s.parent_key === parent.module_key);
        return parent.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
               parent.module_key.toLowerCase().includes(searchTerm.toLowerCase()) ||
               children.some(c => c.label.toLowerCase().includes(searchTerm.toLowerCase()));
    });

    return (
        <div className="flex flex-col h-full bg-[#f8fafc] w-full overflow-hidden font-sans">
            {/* Header: Premium, Compact, Dynamic */}
            <header className="shrink-0 bg-white border-b border-slate-200 px-8 py-5 flex items-center justify-between z-30 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
                <div className="flex items-center gap-8">
                    {onBack && (
                        <button
                            onClick={onBack}
                            className="group p-3 rounded-2xl bg-slate-50 text-slate-400 hover:bg-slate-900 hover:text-white transition-all active:scale-95 border border-slate-100"
                        >
                            <ArrowLeft className="w-5 h-5 transition-transform group-hover:-translate-x-0.5" />
                        </button>
                    )}
                    <div>
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-200">
                                <Shield className="w-5 h-5 text-white" />
                            </div>
                            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Controle de Acesso</h1>
                            <div className="px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-100 flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></div>
                                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Global Master</span>
                            </div>
                        </div>
                        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mt-1 ml-1">Ambiente de gestão de disponibilidade multicanal</p>
                    </div>
                </div>

                <div className="flex items-center gap-4 flex-1 max-w-xl mx-12">
                    <div className="relative w-full">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Pesquisar módulo ou permissão..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full bg-slate-50 pl-11 pr-4 py-3 rounded-2xl border border-slate-200 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all outline-none text-sm font-medium placeholder:text-slate-400 shadow-sm"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl">
                    <button 
                        onClick={() => setActiveTab('web')}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-[1.25rem] text-xs font-black uppercase tracking-widest transition-all duration-300 ${
                            activeTab === 'web' 
                                ? 'bg-white text-indigo-600 shadow-lg shadow-indigo-500/10' 
                                : 'text-slate-400 hover:text-slate-600'
                        }`}
                    >
                        <Monitor className="w-4 h-4" />
                        Versão Web
                    </button>
                    <button 
                        onClick={() => setActiveTab('mobile')}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-[1.25rem] text-xs font-black uppercase tracking-widest transition-all duration-300 ${
                            activeTab === 'mobile' 
                                ? 'bg-white text-rose-600 shadow-lg shadow-rose-500/10' 
                                : 'text-slate-400 hover:text-slate-600'
                        }`}
                    >
                        <Smartphone className="w-4 h-4" />
                        Versão Mobile
                    </button>
                </div>
            </header>

            {/* List View Area */}
            <main className="flex-1 overflow-y-auto custom-scrollbar p-8">
                <div className="max-w-5xl mx-auto space-y-4">
                    {filteredParents.length > 0 ? (
                        filteredParents.map((parent) => {
                            const children = settings.filter(s => s.parent_key === parent.module_key);
                            const isExpanded = expandedModules[parent.module_key] || searchTerm.length > 0;
                            
                            const isEnabled = activeTab === 'web' ? parent.is_enabled : parent.is_enabled_mobile;
                            const activeChildrenCount = children.filter(c => activeTab === 'web' ? c.is_enabled : c.is_enabled_mobile).length;

                            return (
                                <div 
                                    key={parent.id}
                                    className={`group bg-white rounded-3xl border transition-all duration-300 overflow-hidden shadow-sm hover:shadow-md ${
                                        isEnabled ? 'border-slate-200' : (activeTab === 'web' ? 'border-indigo-100 bg-indigo-50/10' : 'border-rose-100 bg-rose-50/10')
                                    }`}
                                >
                                    {/* Parent Item */}
                                    <div className="p-5 flex items-center justify-between gap-6 cursor-pointer" onClick={() => toggleExpand(parent.module_key)}>
                                        <div className="flex items-center gap-5 min-w-0">
                                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500 ${
                                                isEnabled 
                                                    ? `bg-slate-50 text-slate-900 group-hover:bg-${activeTab === 'web' ? 'indigo' : 'rose'}-600 group-hover:text-white shadow-inner` 
                                                    : `bg-${activeTab === 'web' ? 'indigo' : 'rose'}-100/50 text-${activeTab === 'web' ? 'indigo' : 'rose'}-500 shadow-none`
                                            }`}>
                                                {getModuleIcon(parent.module_key)}
                                            </div>
                                            
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <h3 className={`font-black text-lg tracking-tight ${isEnabled ? 'text-slate-900' : 'text-slate-400 font-bold'}`}>
                                                        {parent.label}
                                                    </h3>
                                                    {children.length > 0 && (
                                                        <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${
                                                            isEnabled ? 'bg-slate-100 text-slate-500' : 'bg-slate-50 text-slate-300'
                                                        }`}>
                                                            {activeChildrenCount}/{children.length} {activeTab === 'web' ? 'WEB' : 'MOB'}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 mt-1">
                                                    {parent.description && (
                                                        <span className="text-[11px] text-slate-400 font-medium truncate max-w-xs">{parent.description}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-6" onClick={e => e.stopPropagation()}>
                                            <button 
                                                onClick={() => handleToggle(parent.module_key, isEnabled)}
                                                disabled={processingKey === parent.module_key}
                                                className="flex items-center gap-3 pr-6 border-r border-slate-100 group/status"
                                            >
                                                <span className={`text-[10px] font-black uppercase tracking-widest transition-colors ${
                                                    isEnabled 
                                                        ? (activeTab === 'web' ? 'text-indigo-500' : 'text-rose-500') 
                                                        : 'text-slate-300'
                                                } group-hover/status:underline`}>
                                                    {isEnabled ? 'Habilitado' : 'Desabilitado'}
                                                </span>
                                                <div className="relative inline-flex items-center cursor-pointer">
                                                    <div className={`w-12 h-6.5 bg-slate-200 rounded-full transition-all relative ${
                                                        isEnabled 
                                                            ? (activeTab === 'web' ? 'bg-indigo-500' : 'bg-rose-500') 
                                                            : 'bg-slate-200'
                                                    }`}>
                                                        <div className={`absolute top-0.75 left-[3px] bg-white border-slate-300 border rounded-full h-5 w-5 transition-all transform ${
                                                            isEnabled ? 'translate-x-[22px]' : 'translate-x-0'
                                                        }`}></div>
                                                    </div>
                                                </div>
                                            </button>

                                            <button 
                                                onClick={(e) => { e.stopPropagation(); toggleExpand(parent.module_key); }}
                                                className={`p-2 rounded-xl border transition-all ${isExpanded ? 'bg-slate-900 border-slate-900 text-white rotate-180' : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'}`}
                                            >
                                                <ChevronDown className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Children List (Sub-permissões) */}
                                    {children.length > 0 && isExpanded && (
                                        <div className="bg-slate-50/50 border-t border-slate-100 p-2 animate-slide-down">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                {children.map((child) => {
                                                    const isChildEnabled = activeTab === 'web' ? child.is_enabled : child.is_enabled_mobile;
                                                    
                                                    return (
                                                        <div
                                                            key={child.id}
                                                            className={`flex items-center justify-between pl-14 pr-4 py-3 rounded-2xl transition-all border group/child ${
                                                                isChildEnabled && isEnabled 
                                                                    ? 'bg-white border-slate-200 shadow-sm hover:shadow-md' 
                                                                    : 'bg-transparent border-transparent opacity-60'
                                                            }`}
                                                        >
                                                            <div className="flex items-center gap-3 min-w-0">
                                                                <div className={`p-1.5 rounded-lg ${isChildEnabled && isEnabled ? (activeTab === 'web' ? 'bg-indigo-50 text-indigo-600' : 'bg-rose-50 text-rose-600') : 'bg-slate-200/50 text-slate-300'}`}>
                                                                    <Settings2 className="w-3.5 h-3.5" />
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <span className={`text-xs font-bold tracking-tight block truncate ${isChildEnabled && isEnabled ? 'text-slate-800' : 'text-slate-400'}`}>
                                                                        {child.label}
                                                                    </span>
                                                                </div>
                                                            </div>

                                                            <button
                                                                disabled={processingKey === child.module_key || !isEnabled}
                                                                onClick={() => handleToggle(child.module_key, isChildEnabled)}
                                                                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${
                                                                    !isEnabled
                                                                        ? 'text-slate-200 border-transparent opacity-20 cursor-not-allowed'
                                                                        : isChildEnabled
                                                                            ? (activeTab === 'web' ? 'text-indigo-600 bg-indigo-50 border-indigo-100 hover:bg-indigo-600 hover:text-white' : 'text-rose-600 bg-rose-50 border-rose-100 hover:bg-rose-600 hover:text-white')
                                                                            : 'text-slate-400 bg-white border-slate-200 hover:bg-slate-900 hover:text-white'
                                                                }`}
                                                            >
                                                                {isChildEnabled ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                                                                {isChildEnabled ? 'Desabilitar' : 'Habilitar'}
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    ) : (
                        <div className="py-24 flex flex-col items-center justify-center text-center bg-white rounded-[3rem] border-2 border-dashed border-slate-200">
                            <div className="w-20 h-20 bg-slate-50 rounded-[2.5rem] flex items-center justify-center mb-6">
                                <Search className="w-10 h-10 text-slate-200" />
                            </div>
                            <h3 className="font-black text-xl text-slate-800">Nenhum módulo corresponde à busca</h3>
                            <button 
                                onClick={() => setSearchTerm('')}
                                className="mt-8 px-8 py-3 bg-indigo-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-lg shadow-indigo-200 hover:bg-slate-900 transition-all active:scale-95"
                            >
                                Limpar Busca
                            </button>
                        </div>
                    )}
                </div>
            </main>


            {/* Processing Overlay */}
            <GlobalLoading
                type="overlay"
                isOpen={!!processingKey}
                message="Sincronizando..."
                description={`Atualizando disponibilidade no canal ${activeTab.toUpperCase()}`}
            />
        </div>
    );
};
