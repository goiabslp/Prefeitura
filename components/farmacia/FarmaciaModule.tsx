import React from 'react';
import { User, AppState } from '../../types';
import { ArrowLeft, Pill, Search, ClipboardList, Package, Settings, History } from 'lucide-react';
import { FarmaciaDashboard } from './FarmaciaDashboard.tsx';
import { ConsultarScreen } from './ConsultarScreen.tsx';
import { RetirarScreen } from './RetirarScreen.tsx';
import { EstoqueScreen } from './EstoqueScreen.tsx';
import { DadosScreen } from './DadosScreen.tsx';
import { HistoricoScreen } from './HistoricoScreen.tsx';

interface FarmaciaModuleProps {
    currentView: string;
    subView?: string;
    currentUser: User;
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
    const isSubView = !!subView;
    const isAdmin = currentUser.role === 'admin';

    // Permissions
    const canAccessConsultar = currentUser.permissions?.includes('parent_farmacia') || isAdmin;
    const canAccessRetirar = currentUser.permissions?.includes('parent_farmacia') || isAdmin;
    const canAccessEstoque = currentUser.permissions?.includes('parent_farmacia') || isAdmin;
    const canAccessHistorico = currentUser.permissions?.includes('parent_farmacia') || isAdmin;
    const canAccessDados = currentUser.permissions?.includes('parent_farmacia_editar') || currentUser.permissions?.includes('parent_farmacia_aprovar') || isAdmin;

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
            </div>
        );
    };

    return (
        <div className="flex-1 w-full h-full bg-[#f8fafc] relative flex flex-col overflow-hidden min-h-0">
            {/* Header / Subnav container */}
            {subView !== 'consultar' && (
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
                </div>
            )}

            <main className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar flex flex-col min-h-0">
                {!isSubView ? (
                    <FarmaciaDashboard
                        currentUser={currentUser}
                        onNavigate={onNavigate}
                    />
                ) : subView === 'consultar' ? (
                    <ConsultarScreen
                        currentUser={currentUser}
                        onBack={() => onNavigate('farmacia')}
                        appState={appState}
                    />
                ) : subView === 'retirar' ? (
                    <RetirarScreen
                        currentUser={currentUser}
                        onBack={() => onNavigate('farmacia')}
                        onNavigate={onNavigate}
                        appState={appState}
                    />
                ) : subView === 'estoque' ? (
                    <EstoqueScreen
                        currentUser={currentUser}
                        onBack={() => onNavigate('farmacia')}
                        appState={appState}
                    />
                ) : subView === 'dados' ? (
                    <DadosScreen
                        currentUser={currentUser}
                        onBack={() => onNavigate('farmacia')}
                        onNavigate={onNavigate}
                    />
                ) : subView === 'historico' ? (
                    <HistoricoScreen
                        currentUser={currentUser}
                        onBack={() => onNavigate('farmacia')}
                    />
                ) : (
                    <div className="text-center py-10 font-bold text-slate-400">Página Não Encontrada.</div>
                )}
            </main>
        </div>
    );
};
