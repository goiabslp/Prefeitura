import React, { useState, useEffect, useMemo } from 'react';
import { User, AppState, FarmaciaMedicamento, FarmaciaMovimentacao } from '../../types';
import { ArrowLeft, Pill, Search, ClipboardList, Package, Settings, History, AlertTriangle, X, Info, Users } from 'lucide-react';
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
    const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
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
    const { moduleStatus } = useSystemSettings();
    const isConsultarActive = moduleStatus['parent_farmacia_consultar'] !== false;
    const isRetirarActive = moduleStatus['parent_farmacia_retirar'] !== false;
    const isEstoqueActive = moduleStatus['parent_farmacia_estoque'] !== false;
    const isDashboardActive = moduleStatus['parent_farmacia_dashboard'] !== false;
    const isPacientesActive = moduleStatus['parent_farmacia_pacientes'] !== false;

    const userPerms = currentUser?.permissions || [];
    const canAccessConsultar = userPerms.includes('parent_farmacia_consultar') && isConsultarActive;
    const canAccessRetirar = userPerms.includes('parent_farmacia_retirar') && isRetirarActive;
    const canAccessEstoque = userPerms.includes('parent_farmacia_estoque') && isEstoqueActive;
    const canAccessHistorico = userPerms.includes('parent_farmacia');
    const canAccessDados = userPerms.includes('parent_farmacia_dashboard') && isDashboardActive;
    const canAccessPacientes = (userPerms.includes('parent_farmacia_pacientes') || userPerms.includes('parent_farmacia')) && isPacientesActive;

    const showConsultar = subView === 'consultar' && canAccessConsultar;
    const showRetirar = subView === 'retirar' && canAccessRetirar;
    const showEstoque = subView === 'estoque' && canAccessEstoque;
    const showDashboard = subView === 'dashboard' && canAccessDados;
    const showDados = subView === 'dados' && canAccessDados;
    const showHistorico = subView === 'historico' && canAccessHistorico;
    const showDashboardScreen = subView?.startsWith('dashboard') && canAccessDados;
    const showPacientes = subView === 'pacientes' && canAccessPacientes;

    const isSubView = showConsultar || showRetirar || showEstoque || showDashboard || showDados || showHistorico || showDashboardScreen || showPacientes;

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
            {subView !== 'consultar' && subView !== 'pacientes' && (
                <div className="bg-slate-50 border-b border-slate-200/60 p-4 md:px-8 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 z-40">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => onNavigate(isSubView ? 'farmacia' : 'home')}
                            className="group flex items-center gap-2 text-slate-500 hover:text-pink-600 font-bold transition-all p-2 pr-3.5 rounded-full bg-white border border-slate-200/60 shadow-sm hover:shadow-md"
                            title={isSubView ? "Voltar ao Menu Farmácia" : "Voltar à Página Inicial"}
                        >
                            <div className="w-7 h-7 rounded-full bg-white border border-slate-100 flex items-center justify-center group-hover:bg-pink-50 group-hover:border-pink-100 transition-colors">
                                <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform text-slate-400 group-hover:text-pink-600" />
                            </div>
                            <span className="text-[10px] uppercase tracking-widest font-extrabold group-hover:text-pink-700">Voltar</span>
                        </button>
                        
                        <div className="flex items-center gap-2.5">
                            <div className="p-2 rounded-xl bg-pink-50 text-pink-600 shadow-inner">
                                <Pill className="w-5 h-5 text-pink-600" />
                            </div>
                            <div>
                                <h2 className="text-lg font-black text-slate-800 tracking-tight uppercase leading-none">Farmácia Popular</h2>
                                <p className="text-slate-400 text-[9px] font-bold uppercase tracking-widest mt-0.5">Gestão e dispensação de medicamentos</p>
                            </div>
                        </div>
                    </div>

                    {lowStockMedicamentos.length > 0 && (
                        <button
                            onClick={() => setIsAlertModalOpen(true)}
                            className={`flex items-center gap-2 px-3.5 py-1.5 bg-gradient-to-r ${
                                hasCriticalItems 
                                    ? 'from-rose-500/10 to-red-500/10 border-rose-200/50 text-rose-800 hover:text-rose-950 animate-pulse hover:animate-none' 
                                    : 'from-amber-500/10 to-orange-500/10 border-amber-200/50 text-amber-800 hover:text-amber-950'
                            } border rounded-xl text-xs font-black transition-all shadow-sm shrink-0 uppercase tracking-wider`}
                        >
                            <AlertTriangle className={`w-4 h-4 shrink-0 ${hasCriticalItems ? 'text-rose-500' : 'text-amber-500'}`} />
                            <span>Alerta de Estoque ({lowStockMedicamentos.length})</span>
                        </button>
                    )}
                </div>
            )}

            <main className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar flex flex-col min-h-0">
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
                    <div className="w-full max-w-[98%] 2xl:max-w-[1536px] mx-auto flex flex-col h-full max-h-full min-h-0 bg-white/95 backdrop-blur-md rounded-[2.5rem] border border-slate-200/80 shadow-[0_20px_60px_rgba(0,0,0,0.06)] overflow-hidden animate-in fade-in duration-300 p-4 md:p-5">
                        <PacientesTab onBack={() => onNavigate('farmacia')} accentColor="pink" />
                    </div>
                ) : (
                    <FarmaciaDashboard
                        currentUser={currentUser}
                        onNavigate={onNavigate}
                    />
                )}
            </main>

            {/* Floating Alert Trigger (FAB) */}
            {lowStockMedicamentos.length > 0 && (
                <button
                    onClick={() => setIsAlertModalOpen(true)}
                    className={`absolute bottom-6 right-6 z-50 p-3.5 bg-gradient-to-r ${
                        hasCriticalItems 
                            ? 'from-rose-500 to-red-600 animate-pulse' 
                            : 'from-amber-400 to-orange-500'
                    } text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 flex items-center justify-center group`}
                    title="Alerta de Estoque"
                >
                    <div className="relative flex items-center justify-center">
                        <AlertTriangle className="w-5 h-5 text-white" />
                        <span className="absolute -top-2.5 -right-2.5 w-5.5 h-5.5 bg-rose-600 text-white border border-white text-[9px] font-black rounded-full flex items-center justify-center shadow-sm">
                            {lowStockMedicamentos.length}
                        </span>
                    </div>
                </button>
            )}

            {/* Critical Stock Alert Modal */}
            {isAlertModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-5xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="p-6 bg-gradient-to-r from-amber-50 to-rose-50 border-b border-slate-200/50 flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-3">
                                <div className={`p-2.5 rounded-xl ${hasCriticalItems ? 'bg-rose-500/10 text-rose-600' : 'bg-amber-500/10 text-amber-600'}`}>
                                    <AlertTriangle className={`w-6 h-6 ${hasCriticalItems ? 'animate-bounce' : 'animate-pulse'}`} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-slate-800 tracking-tight uppercase leading-none">Alerta de Estoque Baixo / Crítico</h3>
                                    <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Medicamentos com estoque abaixo dos limites recomendados</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsAlertModalOpen(false)}
                                className="p-2 rounded-full hover:bg-slate-200/50 text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-6">

                            {/* Table of critical medicines */}
                            <div className="border border-slate-200/60 rounded-2xl overflow-hidden bg-white shadow-sm">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">
                                                <th className="p-4">Medicamento</th>
                                                <th className="p-4 text-center">Estoque Atual</th>
                                                <th className="p-4 text-center">Situação</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {lowStockMedicamentos.map(med => {
                                                const percentOfLow = med.thresholdLow > 0 ? (med.quantidade / med.thresholdLow) * 100 : 0;
                                                const isCriticalOrOut = med.quantidade === 0 || med.isCritical;
                                                
                                                return (
                                                    <tr key={med.id} className="hover:bg-slate-50/40 transition-colors text-slate-700 text-xs whitespace-nowrap">
                                                        <td className="p-4 whitespace-nowrap">
                                                            <div className="flex items-center gap-2 whitespace-nowrap">
                                                                <span className="font-extrabold text-slate-900">
                                                                    {med.nome}
                                                                </span>
                                                                <span className="text-[9px] font-bold px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded uppercase tracking-wider shrink-0">
                                                                    {med.categoria}
                                                                </span>
                                                                {med.tipo && (
                                                                    <span className="text-[9px] font-bold px-1.5 py-0.5 bg-pink-50 text-pink-600 rounded uppercase tracking-wider shrink-0">
                                                                        {med.tipo}
                                                                    </span>
                                                                )}
                                                                {med.dosagem && (
                                                                    <span className="text-[9px] font-medium text-slate-400 shrink-0">
                                                                        {med.dosagem}
                                                                    </span>
                                                                )}

                                                            </div>
                                                        </td>
                                                        <td className="p-4 text-center">
                                                            <div className={`font-black text-sm ${isCriticalOrOut ? 'text-rose-600' : 'text-amber-600'}`}>
                                                                {med.quantidade} <span className="text-[10px] font-bold opacity-75">{med.unidade}</span>
                                                            </div>
                                                            <div className="w-16 bg-slate-100 rounded-full h-1.5 mx-auto mt-1 overflow-hidden">
                                                                <div 
                                                                    className={`h-full rounded-full ${isCriticalOrOut ? 'bg-rose-500 animate-pulse' : 'bg-amber-500'}`}
                                                                    style={{ width: `${Math.min(percentOfLow, 100)}%` }}
                                                                ></div>
                                                            </div>
                                                        </td>
                                                        <td className="p-4 text-center whitespace-nowrap">
                                                            {med.quantidade === 0 ? (
                                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-200 whitespace-nowrap">
                                                                    Sem Estoque
                                                                </span>
                                                            ) : med.isCritical ? (
                                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-red-100 text-red-800 border border-red-200 animate-pulse whitespace-nowrap">
                                                                    Crítico (≤ {Math.round(globalAlertPercentage / 2)}%)
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200 whitespace-nowrap">
                                                                    Estoque Baixo (≤ {globalAlertPercentage}%)
                                                                </span>
                                                            )}
                                                         </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-6 border-t border-slate-200/50 bg-slate-50 flex justify-end gap-3 shrink-0">
                            <button
                                onClick={() => setIsAlertModalOpen(false)}
                                className="px-6 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-slate-900/10 hover:shadow-lg uppercase tracking-wider"
                            >
                                Entendi, Fechar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
        </FarmaciaAlertProvider>
    );
};
