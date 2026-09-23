import React, { useState, useEffect, useMemo } from 'react';
import { User, AppState, FarmaciaMedicamento, FarmaciaMovimentacao } from '../../types';
import { ArrowLeft, Pill, Search, ClipboardList, Package, Settings, History, AlertTriangle, X, Info, Users, ShieldCheck } from 'lucide-react';
import { useSystemSettings } from '../../contexts/SystemSettingsContext';
import * as db from '../../services/farmaciaService';
import { FarmaciaDashboard } from './FarmaciaDashboard';
import { ConsultarScreen } from './ConsultarScreen';
import { RetirarScreen } from './RetirarScreen';
import { EstoqueScreen } from './EstoqueScreen';
import { DadosScreen } from './DadosScreen';
import { HistoricoScreen } from './HistoricoScreen';
import { DashboardScreen } from './DashboardScreen';
import { FarmaciaAlertProvider } from './FarmaciaAlertContext';
import { PacientesTab } from '../common/PacientesTab';
import { ModuleGestorScreen } from '../common/ModuleGestorScreen';
import { userCanAccessSubmodule } from '../../services/permissionService';

interface FarmaciaModuleProps {
    currentView: string;
    subView?: string;
    currentUser: User | null;
    onNavigate: (view: string) => void;
    onLogout: () => void;
    appState: AppState;
}

export const FarmaciaModule: React.FC<FarmaciaModuleProps> = ({
    currentView,
    subView,
    currentUser,
    onNavigate,
    onLogout,
    appState
}) => {
    const isAdmin = currentUser?.role === 'admin';

    // Data states for stock alerts
    const [medicamentos, setMedicamentos] = useState<FarmaciaMedicamento[]>([]);
    const [movimentacoes, setMovimentacoes] = useState<FarmaciaMovimentacao[]>([]);
    const [globalAlertPercentage, setGlobalAlertPercentage] = useState<number>(20);
    const [loading, setLoading] = useState(true);
    const [hasAlerted, setHasAlerted] = useState(false);

    const loadData = async () => {
        try {
            const [medData, movData, alertPct] = await Promise.all([
                db.getMedicamentos(),
                db.getMovimentacoes(),
                db.getGlobalAlertPercentage()
            ]);
            setMedicamentos(medData);
            setMovimentacoes(movData);
            setGlobalAlertPercentage(alertPct);
        } catch (error) {
            console.error('[FarmaciaModule] Error loading alert data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();

        const handleMedChange = () => loadData();
        const handleMovChange = () => loadData();
        const handleConfigChange = () => {
            db.getGlobalAlertPercentage().then(pct => setGlobalAlertPercentage(pct));
        };

        window.addEventListener('farmacia-medicamentos-changed', handleMedChange);
        window.addEventListener('farmacia-movimentacoes-changed', handleMovChange);
        window.addEventListener('farmacia-config-changed', handleConfigChange);

        return () => {
            window.removeEventListener('farmacia-medicamentos-changed', handleMedChange);
            window.removeEventListener('farmacia-movimentacoes-changed', handleMovChange);
            window.removeEventListener('farmacia-config-changed', handleConfigChange);
        };
    }, []);

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return '';
        try {
            const date = new Date(dateStr);
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            return `${day}/${month}/${year} ${hours}:${minutes}`;
        } catch (e) {
            return dateStr;
        }
    };

    // Filter low stock medicines based on rule:
    // Alert triggers when stock reaches globalAlertPercentage of max historical stock
    const lowStockMedicamentos = useMemo(() => {
        const groups: Record<string, {
            id: string;
            nome: string;
            dosagem?: string;
            tipo?: string;
            categoria: string;
            unidade: string;
            quantidadeTotal: number;
            limite_minimo: number;
            medIds: Set<string>;
        }> = {};

        medicamentos.forEach(med => {
            if (med.quantidade === 0 && med.lote === 'LOTE-INICIAL') return;
            const groupKey = `${(med.nome || '').trim().toUpperCase()}_${(med.dosagem || '').trim().toUpperCase()}_${(med.tipo || '').trim().toUpperCase()}`;
            if (!groups[groupKey]) {
                groups[groupKey] = {
                    id: med.id,
                    nome: med.nome,
                    dosagem: med.dosagem,
                    tipo: med.tipo,
                    categoria: med.categoria,
                    unidade: med.unidade || 'un',
                    quantidadeTotal: 0,
                    limite_minimo: med.limite_minimo || 0,
                    medIds: new Set()
                };
            }
            groups[groupKey].quantidadeTotal += (med.quantidade || 0);
            groups[groupKey].medIds.add(med.id);
            if (med.limite_minimo && med.limite_minimo > groups[groupKey].limite_minimo) {
                groups[groupKey].limite_minimo = med.limite_minimo;
            }
        });

        // Determina a data limite do dia 05 do ciclo ativo
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        const day = now.getDate();
        const refMonth = day >= 5 ? month : month - 1;
        const targetDay5 = new Date(year, refMonth, 5, 23, 59, 59, 999);

        return Object.values(groups).map(group => {
            const groupMovs = movimentacoes.filter(m => 
                group.medIds.has(m.medicamento_id) || 
                (m.medicamento_nome && m.medicamento_nome.toLowerCase().trim() === group.nome.toLowerCase().trim())
            );

            // Rebobina movimentações que ocorreram APÓS o dia 05 às 23:59:59
            const movsAfterDay5 = groupMovs.filter(m => {
                if (!m.data) return false;
                const d = new Date(m.data);
                return !isNaN(d.getTime()) && d > targetDay5;
            });

            let calculatedDay5Stock = group.quantidadeTotal;
            for (const mov of movsAfterDay5) {
                if (mov.tipo === 'Entrada') {
                    calculatedDay5Stock -= mov.quantidade;
                } else if (mov.tipo === 'Saída') {
                    calculatedDay5Stock += mov.quantidade;
                }
            }

            const estoqueDia05 = calculatedDay5Stock > 0 ? calculatedDay5Stock : Math.max(0, group.quantidadeTotal);

            const pctFraction = globalAlertPercentage / 100;
            const thresholdLow = Math.round(estoqueDia05 * pctFraction);
            const thresholdCritical = Math.round(thresholdLow / 2);

            const isOutOfStock = group.quantidadeTotal === 0;
            const isCritical = !isOutOfStock && group.quantidadeTotal <= thresholdCritical;
            const isLow = !isOutOfStock && !isCritical && group.quantidadeTotal <= thresholdLow;

            return {
                id: group.id,
                nome: group.nome,
                dosagem: group.dosagem,
                tipo: group.tipo,
                categoria: group.categoria,
                unidade: group.unidade,
                quantidade: group.quantidadeTotal,
                estoqueDia05,
                thresholdLow,
                thresholdCritical,
                isLow,
                isCritical,
                isOutOfStock
            };
        }).filter(item => item.isLow || item.isCritical || item.isOutOfStock);
    }, [medicamentos, movimentacoes, globalAlertPercentage]);

    const hasCriticalItems = useMemo(() => {
        return lowStockMedicamentos.some(med => med.isCritical || med.isOutOfStock);
    }, [lowStockMedicamentos]);

    // Permissions
    const { moduleStatus, mobileModuleStatus } = useSystemSettings();
    const [isMobileViewport, setIsMobileViewport] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);

    useEffect(() => {
        const handleResize = () => setIsMobileViewport(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const isModuleActive = (key: string) => {
        if (isMobileViewport) {
            return mobileModuleStatus[key] !== false;
        }
        return moduleStatus[key] !== false;
    };

    const isConsultarActive = isModuleActive('sub_farmacia_consultar') || isModuleActive('parent_farmacia_consultar');
    const isRetirarActive = isModuleActive('sub_farmacia_retirar') || isModuleActive('parent_farmacia_retirar');
    const isEstoqueActive = isModuleActive('sub_farmacia_estoque') || isModuleActive('parent_farmacia_estoque');
    const isDashboardActive = isModuleActive('sub_farmacia_dashboard') || isModuleActive('parent_farmacia_dashboard');
    const isPacientesActive = isModuleActive('sub_farmacia_pacientes') || isModuleActive('parent_farmacia_pacientes');
    const isGestorActive = isModuleActive('sub_farmacia_gestor') || isModuleActive('parent_farmacia_gestor');

    const canAccessConsultar = userCanAccessSubmodule(currentUser, 'parent_farmacia', 'sub_farmacia_consultar', moduleStatus);
    const canAccessRetirar = userCanAccessSubmodule(currentUser, 'parent_farmacia', 'sub_farmacia_retirar', moduleStatus);
    const canAccessEstoque = userCanAccessSubmodule(currentUser, 'parent_farmacia', 'sub_farmacia_estoque', moduleStatus);
    const canAccessDados = userCanAccessSubmodule(currentUser, 'parent_farmacia', 'sub_farmacia_dashboard', moduleStatus);
    const canAccessHistorico = canAccessDados;
    const canAccessPacientes = userCanAccessSubmodule(currentUser, 'parent_farmacia', 'sub_farmacia_pacientes', moduleStatus);
    const canAccessGestor = userCanAccessSubmodule(currentUser, 'parent_farmacia', 'sub_farmacia_gestor', moduleStatus);

    const showConsultar = subView === 'consultar' && canAccessConsultar;
    const showRetirar = subView === 'retirar' && canAccessRetirar;
    const showEstoque = subView === 'estoque' && canAccessEstoque;
    const showDashboard = subView === 'dashboard' && canAccessDados;
    const showDados = subView === 'dados' && canAccessDados;
    const showHistorico = subView === 'historico' && canAccessHistorico;
    const showDashboardScreen = subView?.startsWith('dashboard') && canAccessDados;
    const showPacientes = subView === 'pacientes' && canAccessPacientes;
    const showGestor = subView === 'gestor' && canAccessGestor;

    const isSubView = showConsultar || showRetirar || showEstoque || showDashboard || showDados || showHistorico || showDashboardScreen || showPacientes || showGestor;

    const renderSubNavigation = () => {
        if (!isSubView) return null;

        return (
            <div className="flex flex-wrap items-center gap-1 bg-white/70 backdrop-blur-md border border-slate-200/50 p-1.5 rounded-2xl shadow-sm max-w-max mx-auto md:mx-0 shrink-0">
                {canAccessConsultar && (
                    <button
                        onClick={() => onNavigate('farmacia:consultar')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all uppercase tracking-wider ${
                            subView === 'consultar'
                                ? 'bg-pink-600 text-white shadow-md shadow-pink-500/20'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                    >
                        <Search className="w-3.5 h-3.5" />
                        Consultar
                    </button>
                )}
                {canAccessRetirar && (
                    <button
                        onClick={() => onNavigate('farmacia:retirar')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all uppercase tracking-wider ${
                            subView === 'retirar'
                                ? 'bg-pink-600 text-white shadow-md shadow-pink-500/20'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                    >
                        <ClipboardList className="w-3.5 h-3.5" />
                        Retirar
                    </button>
                )}
                {canAccessEstoque && (
                    <button
                        onClick={() => onNavigate('farmacia:estoque')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all uppercase tracking-wider ${
                            subView === 'estoque'
                                ? 'bg-pink-600 text-white shadow-md shadow-pink-500/20'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                    >
                        <Package className="w-3.5 h-3.5" />
                        Estoque
                    </button>
                )}
                {canAccessDados && (
                    <button
                        onClick={() => onNavigate('farmacia:dashboard')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all uppercase tracking-wider ${
                            subView === 'dashboard'
                                ? 'bg-pink-600 text-white shadow-md shadow-pink-500/20'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                    >
                        <History className="w-3.5 h-3.5" />
                        Dashboard
                    </button>
                )}
            </div>
        );
    };

    return (
        <FarmaciaAlertProvider>
        <div className="flex-1 w-full h-full bg-[#f8fafc] relative flex flex-col overflow-hidden min-h-0">
            {/* Header / Subnav container */}
            {subView !== 'consultar' && subView !== 'pacientes' && subView !== 'estoque' && (
                <div className="bg-slate-50 border-b border-slate-200/60 py-2.5 px-4 md:px-6 flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0 z-40">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => onNavigate(isSubView ? 'farmacia' : 'home')}
                            className="group flex items-center gap-2 text-slate-500 hover:text-pink-600 font-bold transition-all p-1.5 pr-3 rounded-full bg-white border border-slate-200/60 shadow-xs hover:shadow-sm"
                            title={isSubView ? "Voltar ao Menu Farmácia" : "Voltar à Página Inicial"}
                        >
                            <div className="w-6 h-6 rounded-full bg-white border border-slate-100 flex items-center justify-center group-hover:bg-pink-50 group-hover:border-pink-100 transition-colors">
                                <ArrowLeft className="w-3 h-3 group-hover:-translate-x-0.5 transition-transform text-slate-400 group-hover:text-pink-600" />
                            </div>
                            <span className="text-[9px] uppercase tracking-widest font-extrabold group-hover:text-pink-700">Voltar</span>
                        </button>
                        
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-lg bg-pink-50 text-pink-600 shadow-inner">
                                <Pill className="w-4 h-4 text-pink-600" />
                            </div>
                            <div>
                                <h2 className="text-sm font-black text-slate-800 tracking-tight uppercase leading-none">Farmácia Popular</h2>
                                <p className="text-slate-400 text-[8px] font-bold uppercase tracking-widest mt-0.5">Gestão e dispensação de medicamentos</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <main className={`flex-1 ${showEstoque || showConsultar || showRetirar ? 'p-2 md:p-3 overflow-hidden' : 'overflow-y-auto p-4 md:p-6'} custom-scrollbar flex flex-col min-h-0`}>
                {!isSubView ? (
                    <FarmaciaDashboard
                        currentUser={currentUser}
                        onNavigate={onNavigate}
                    />
                ) : showConsultar ? (
                    <ConsultarScreen
                        currentUser={currentUser}
                        onBack={() => onNavigate('farmacia')}
                        appState={appState}
                    />
                ) : showRetirar ? (
                    <RetirarScreen
                        currentUser={currentUser}
                        onBack={() => onNavigate('farmacia')}
                        onNavigate={onNavigate}
                        appState={appState}
                    />
                ) : showEstoque ? (
                    <EstoqueScreen
                        currentUser={currentUser}
                        onBack={() => onNavigate('farmacia')}
                        appState={appState}
                        lowStockMedicamentos={lowStockMedicamentos}
                        hasCriticalItems={hasCriticalItems}
                    />
                ) : showDados ? (
                    <DadosScreen
                        currentUser={currentUser}
                        onBack={() => onNavigate('farmacia')}
                        onNavigate={onNavigate}
                    />
                ) : showHistorico ? (
                    <HistoricoScreen
                        currentUser={currentUser}
                        onBack={() => onNavigate('farmacia')}
                    />
                ) : showDashboardScreen ? (
                    <DashboardScreen
                        currentUser={currentUser}
                        onBack={() => onNavigate('farmacia')}
                        onNavigate={onNavigate}
                        subView={subView}
                    />
                ) : showPacientes ? (
                    <div className="w-full flex-1 flex flex-col h-full max-h-full min-h-0 bg-white/95 backdrop-blur-md rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden animate-in fade-in duration-200 p-2 sm:p-3">
                        <PacientesTab onBack={() => onNavigate('farmacia')} accentColor="pink" />
                    </div>
                ) : showGestor ? (
                    <ModuleGestorScreen
                        moduleType="farmacia"
                        moduleTitle="Farmácia Popular"
                        currentUser={currentUser || null}
                        onBack={() => onNavigate('farmacia')}
                    />
                ) : (
                    <FarmaciaDashboard
                        currentUser={currentUser}
                        onNavigate={onNavigate}
                    />
                )}
            </main>
        </div>
        </FarmaciaAlertProvider>
    );
};
