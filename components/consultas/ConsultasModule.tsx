// Módulo de Consultas e Regulação Municipal
import React, { useState, useEffect } from 'react';
import { User, AppState } from '../../types';
import { ArrowLeft, PlusCircle, Activity, History, Database, Users, ShieldCheck, CalendarClock } from 'lucide-react';
import { NovoAgendamentoScreen } from './NovoAgendamentoScreen';
import { AcompanharScreen } from './AcompanharScreen';
import { DadosScreen } from './DadosScreen';
import { LiberarVagasScreen } from './LiberarVagasScreen';
import { PacientesTab } from '../common/PacientesTab';
import { ModuleGestorScreen } from '../common/ModuleGestorScreen';
import { useSystemSettings } from '../../contexts/SystemSettingsContext';

interface ConsultasModuleProps {
    currentView: string;
    subView?: string;
    currentUser?: User | null;
    onNavigate: (view: string) => void;
    onLogout: () => void;
    appState: AppState;
}

export const ConsultasModule: React.FC<ConsultasModuleProps> = ({
    currentView,
    subView,
    currentUser,
    onNavigate,
    onLogout,
    appState
}) => {
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

    const isNovoAgendamentoActive = isModuleActive('parent_consultas_novo_agendamento');
    const isAcompanharActive = isModuleActive('parent_consultas_acompanhar');
    const isDadosActive = isModuleActive('parent_consultas_dados');
    const isPacientesActive = isModuleActive('parent_consultas_pacientes');
    const isGestorActive = isModuleActive('parent_consultas_gestor');
    const isLiberarVagasActive = isModuleActive('parent_consultas_liberar_vagas') !== false;

    const userPerms = currentUser?.permissions || [];
    const hasCustomPerms = Array.isArray(currentUser?.permissions) && currentUser.permissions.length > 0;
    const isDefaultAdmin = currentUser?.role === 'admin' && !hasCustomPerms;
    const isAdmin = currentUser?.role === 'admin';

    const canAccessNovoAgendamento = (isDefaultAdmin || userPerms.includes('parent_consultas_novo_agendamento')) && isNovoAgendamentoActive;
    const canAccessLiberarVagas = (isDefaultAdmin || userPerms.includes('parent_consultas_liberar_vagas') || userPerms.includes('parent_consultas_dados') || isAdmin) && isLiberarVagasActive;
    const canAccessAcompanhar = (isDefaultAdmin || userPerms.includes('parent_consultas_acompanhar')) && isAcompanharActive;
    const canAccessDados = (isDefaultAdmin || userPerms.includes('parent_consultas_dados')) && isDadosActive;
    const canAccessPacientes = (isDefaultAdmin || userPerms.includes('parent_consultas_pacientes')) && isPacientesActive;
    const canAccessGestor = (isDefaultAdmin || userPerms.includes('parent_consultas_gestor')) && isGestorActive;

    const showNovoAgendamento = (subView === 'novo-agendamento' || (subView?.startsWith('novo-agendamento') ?? false) || subView === 'vagas-reservadas') && canAccessNovoAgendamento;
    const showLiberarVagas = (subView === 'liberar-vagas') && canAccessLiberarVagas;
    const showAcompanhar = (subView === 'acompanhar' || subView === 'definir-agenda') && canAccessAcompanhar;
    const showDados = (subView === 'dados' || (subView?.startsWith('dados') ?? false)) && canAccessDados;
    const showPacientes = (subView === 'pacientes') && canAccessPacientes;
    const showGestor = (subView === 'gestor') && canAccessGestor;
    
    const isSubView = showNovoAgendamento || showLiberarVagas || showAcompanhar || showDados || showPacientes || showGestor;

    const renderMainScreen = () => {
        const visibleCardsCount = [
            canAccessNovoAgendamento,
            canAccessLiberarVagas,
            canAccessAcompanhar,
            canAccessPacientes,
            canAccessDados,
            canAccessGestor
        ].filter(Boolean).length;

        const gridClass = visibleCardsCount === 5
            ? "w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 max-w-7xl mb-8"
            : visibleCardsCount === 6
            ? "w-full grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-6 max-w-7xl mb-8"
            : "w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mb-8";

        return (
            <div className="flex-1 flex flex-col justify-center items-center w-full max-w-7xl mx-auto px-4 py-8 animate-in fade-in slide-in-from-bottom-6 duration-500">
                {/* Botão Voltar */}
                <button
                    onClick={() => onNavigate('home')}
                    className="fixed top-24 left-4 md:top-28 md:left-8 z-[999] group flex items-center gap-2 text-slate-500 hover:text-sky-600 font-bold transition-all p-2 pr-4 rounded-full bg-white/90 backdrop-blur-md border border-slate-200/60 shadow-lg hover:shadow-xl hover:bg-white hover:-translate-y-0.5 hover:border-sky-100 cursor-pointer"
                    title="Voltar ao Menu"
                >
                    <div className="w-8 h-8 rounded-full bg-white border border-slate-100 flex items-center justify-center group-hover:bg-sky-50 group-hover:border-sky-100 transition-colors">
                        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform text-slate-400 group-hover:text-sky-600" />
                    </div>
                    <span className="text-[10px] uppercase tracking-widest font-extrabold group-hover:text-sky-700">Voltar</span>
                </button>

                {/* Header intro */}
                <div className="text-center mb-10 max-w-xl shrink-0">
                    <div className="inline-flex p-3.5 rounded-2xl bg-gradient-to-br from-sky-50 to-sky-100/50 mb-3 shadow-xs ring-4 ring-white/60">
                        <Activity className="w-8 h-8 text-sky-600 drop-shadow-xs animate-pulse" />
                    </div>
                    <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight mb-2 uppercase">
                        Regulação & Consultas
                    </h1>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                        Agendamento de exames e consultas municipais
                    </p>
                </div>

                {/* Grid of Main Cards */}
                <div className={gridClass}>
                    {/* Card 1: Novo Agendamento */}
                    {canAccessNovoAgendamento && (
                        <button
                            onClick={() => onNavigate('consultas:novo-agendamento')}
                            className="group relative w-full min-h-[200px] rounded-[2.5rem] bg-gradient-to-br from-white to-slate-50 border border-slate-100 shadow-[0_10px_35px_rgba(0,0,0,0.03)] hover:shadow-[0_30px_70px_rgba(14,165,233,0.15)] hover:border-sky-200 hover:from-white hover:to-sky-50/20 hover:-translate-y-2 active:scale-98 transition-all duration-300 ease-out flex flex-col items-center justify-center text-center overflow-hidden p-6 cursor-pointer"
                        >
                            <div className="absolute top-0 right-0 w-36 h-36 bg-sky-500/5 rounded-bl-[100%] -mr-10 -mt-10 transition-transform duration-700 ease-out group-hover:scale-150"></div>
                            <div className="absolute bottom-0 left-0 w-24 h-24 bg-sky-500/5 rounded-tr-[100%] -ml-10 -mb-10 transition-transform duration-700 ease-out group-hover:scale-125 opacity-0 group-hover:opacity-100"></div>

                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-500 to-sky-600 flex items-center justify-center mb-4 text-white group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-lg shadow-sky-500/30 ring-4 ring-white">
                                <PlusCircle className="w-6.5 h-6.5" />
                            </div>

                            <h3 className="text-xl font-extrabold text-slate-800 mb-1.5 group-hover:text-slate-900 tracking-tight uppercase">
                                Novo Agendamento
                            </h3>
                            <p className="text-xs font-bold text-slate-400 group-hover:text-sky-600 transition-colors uppercase tracking-widest leading-relaxed">
                                Cadastrar ou Vincular
                            </p>
                            <p className="text-[10px] text-slate-400 mt-2 max-w-[180px] font-medium leading-normal">
                                Agendamento rápido de consultas e exames especializados para munícipes.
                            </p>
                        </button>
                    )}

                    {/* Card 2: Liberar Vagas */}
                    {canAccessLiberarVagas && (
                        <button
                            onClick={() => onNavigate('consultas:liberar-vagas')}
                            className="group relative w-full min-h-[200px] rounded-[2.5rem] bg-gradient-to-br from-white to-slate-50 border border-slate-100 shadow-[0_10px_35px_rgba(0,0,0,0.03)] hover:shadow-[0_30px_70px_rgba(20,184,166,0.15)] hover:border-teal-200 hover:from-white hover:to-teal-50/20 hover:-translate-y-2 active:scale-98 transition-all duration-300 ease-out flex flex-col items-center justify-center text-center overflow-hidden p-6 cursor-pointer"
                        >
                            <div className="absolute top-0 right-0 w-36 h-36 bg-teal-500/5 rounded-bl-[100%] -mr-10 -mt-10 transition-transform duration-700 ease-out group-hover:scale-150"></div>
                            <div className="absolute bottom-0 left-0 w-24 h-24 bg-teal-500/5 rounded-tr-[100%] -ml-10 -mb-10 transition-transform duration-700 ease-out group-hover:scale-125 opacity-0 group-hover:opacity-100"></div>

                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center mb-4 text-white group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-lg shadow-teal-500/30 ring-4 ring-white">
                                <CalendarClock className="w-6.5 h-6.5" />
                            </div>

                            <h3 className="text-xl font-extrabold text-slate-800 mb-1.5 group-hover:text-slate-900 tracking-tight uppercase">
                                Liberar Vagas
                            </h3>
                            <p className="text-xs font-bold text-slate-400 group-hover:text-teal-600 transition-colors uppercase tracking-widest leading-relaxed">
                                Gestão de Horários
                            </p>
                            <p className="text-[10px] text-slate-400 mt-2 max-w-[180px] font-medium leading-normal">
                                Liberação de cotas, definição de datas e controle de vagas por procedimento.
                            </p>
                        </button>
                    )}

                    {/* Card 3: Acompanhar */}
                    {canAccessAcompanhar && (
                        <button
                            onClick={() => onNavigate('consultas:acompanhar')}
                            className="group relative w-full min-h-[200px] rounded-[2.5rem] bg-gradient-to-br from-white to-slate-50 border border-slate-100 shadow-[0_10px_35px_rgba(0,0,0,0.03)] hover:shadow-[0_30px_70px_rgba(99,102,241,0.15)] hover:border-indigo-200 hover:from-white hover:to-indigo-50/20 hover:-translate-y-2 active:scale-98 transition-all duration-300 ease-out flex flex-col items-center justify-center text-center overflow-hidden p-6 cursor-pointer"
                        >
                            <div className="absolute top-0 right-0 w-36 h-36 bg-indigo-500/5 rounded-bl-[100%] -mr-10 -mt-10 transition-transform duration-700 ease-out group-hover:scale-150"></div>
                            <div className="absolute bottom-0 left-0 w-24 h-24 bg-indigo-500/5 rounded-tr-[100%] -ml-10 -mb-10 transition-transform duration-700 ease-out group-hover:scale-125 opacity-0 group-hover:opacity-100"></div>

                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center mb-4 text-white group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-lg shadow-indigo-500/30 ring-4 ring-white">
                                <History className="w-6.5 h-6.5" />
                            </div>

                            <h3 className="text-xl font-extrabold text-slate-800 mb-1.5 group-hover:text-slate-900 tracking-tight uppercase">
                                Acompanhar
                            </h3>
                            <p className="text-xs font-bold text-slate-400 group-hover:text-indigo-600 transition-colors uppercase tracking-widest leading-relaxed">
                                Fila de Espera
                            </p>
                            <p className="text-[10px] text-slate-400 mt-2 max-w-[180px] font-medium leading-normal">
                                Controle em tempo real de agendamentos, confirmações e atendimentos.
                            </p>
                        </button>
                    )}

                    {/* Card 4: Pacientes */}
                    {canAccessPacientes && (
                        <button
                            onClick={() => onNavigate('consultas:pacientes')}
                            className="group relative w-full min-h-[200px] rounded-[2.5rem] bg-gradient-to-br from-white to-slate-50 border border-slate-100 shadow-[0_10px_35px_rgba(0,0,0,0.03)] hover:shadow-[0_30px_70px_rgba(6,182,212,0.15)] hover:border-cyan-200 hover:from-white hover:to-cyan-50/20 hover:-translate-y-2 active:scale-98 transition-all duration-300 ease-out flex flex-col items-center justify-center text-center overflow-hidden p-6 cursor-pointer"
                        >
                            <div className="absolute top-0 right-0 w-36 h-36 bg-cyan-500/5 rounded-bl-[100%] -mr-10 -mt-10 transition-transform duration-700 ease-out group-hover:scale-150"></div>
                            <div className="absolute bottom-0 left-0 w-24 h-24 bg-cyan-500/5 rounded-tr-[100%] -ml-10 -mb-10 transition-transform duration-700 ease-out group-hover:scale-125 opacity-0 group-hover:opacity-100"></div>

                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center mb-4 text-white group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-lg shadow-cyan-500/30 ring-4 ring-white">
                                <Users className="w-6.5 h-6.5" />
                            </div>

                            <h3 className="text-xl font-extrabold text-slate-800 mb-1.5 group-hover:text-slate-900 tracking-tight uppercase">
                                Pacientes
                            </h3>
                            <p className="text-xs font-bold text-slate-400 group-hover:text-cyan-600 transition-colors uppercase tracking-widest leading-relaxed">
                                Base Unificada
                            </p>
                            <p className="text-[10px] text-slate-400 mt-2 max-w-[180px] font-medium leading-normal">
                                Cadastro central de munícipes compartilhado entre Farmácia e Consultas.
                            </p>
                        </button>
                    )}

                    {/* Card 5: Dados & Dashboard */}
                    {canAccessDados && (
                        <button
                            onClick={() => onNavigate('consultas:dados-dashboard')}
                            className="group relative w-full min-h-[200px] rounded-[2.5rem] bg-gradient-to-br from-white to-slate-50 border border-slate-100 shadow-[0_10px_35px_rgba(0,0,0,0.03)] hover:shadow-[0_30px_70px_rgba(16,185,129,0.15)] hover:border-emerald-200 hover:from-white hover:to-emerald-50/20 hover:-translate-y-2 active:scale-98 transition-all duration-300 ease-out flex flex-col items-center justify-center text-center overflow-hidden p-6 cursor-pointer"
                        >
                            <div className="absolute top-0 right-0 w-36 h-36 bg-emerald-500/5 rounded-bl-[100%] -mr-10 -mt-10 transition-transform duration-700 ease-out group-hover:scale-150"></div>
                            <div className="absolute bottom-0 left-0 w-24 h-24 bg-emerald-500/5 rounded-tr-[100%] -ml-10 -mb-10 transition-transform duration-700 ease-out group-hover:scale-125 opacity-0 group-hover:opacity-100"></div>

                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center mb-4 text-white group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-lg shadow-emerald-500/30 ring-4 ring-white">
                                <Database className="w-6.5 h-6.5" />
                            </div>

                            <h3 className="text-xl font-extrabold text-slate-800 mb-1.5 group-hover:text-slate-900 tracking-tight uppercase">
                                Dados & Métricas
                            </h3>
                            <p className="text-xs font-bold text-slate-400 group-hover:text-emerald-600 transition-colors uppercase tracking-widest leading-relaxed">
                                Painel de Gestão
                            </p>
                            <p className="text-[10px] text-slate-400 mt-2 max-w-[180px] font-medium leading-normal">
                                Indicadores de atendimento, relatórios de procedimentos e administração.
                            </p>
                        </button>
                    )}

                    {/* Card 6: Gestor */}
                    {canAccessGestor && (
                        <button
                            onClick={() => onNavigate('consultas:gestor')}
                            className="group relative w-full min-h-[200px] rounded-[2.5rem] bg-gradient-to-br from-white to-slate-50 border border-slate-100 shadow-[0_10px_35px_rgba(0,0,0,0.03)] hover:shadow-[0_30px_70px_rgba(168,85,247,0.15)] hover:border-purple-200 hover:from-white hover:to-purple-50/20 hover:-translate-y-2 active:scale-98 transition-all duration-300 ease-out flex flex-col items-center justify-center text-center overflow-hidden p-6 cursor-pointer"
                        >
                            <div className="absolute top-3 right-4 px-2.5 py-0.5 rounded-full bg-purple-50 border border-purple-200 text-purple-700 text-[9px] font-black uppercase tracking-wider">
                                GESTOR
                            </div>

                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center mb-4 text-white group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-lg shadow-purple-500/30 ring-4 ring-white">
                                <ShieldCheck className="w-6.5 h-6.5" />
                            </div>

                            <h3 className="text-xl font-extrabold text-slate-800 mb-1.5 group-hover:text-slate-900 tracking-tight uppercase">
                                Gestor
                            </h3>
                            <p className="text-xs font-bold text-slate-400 group-hover:text-purple-600 transition-colors uppercase tracking-widest leading-relaxed">
                                Controle de Acessos
                            </p>
                            <p className="text-[10px] text-slate-400 mt-2 max-w-[180px] font-medium leading-normal">
                                Configuração avançada de permissões e auditoria do módulo.
                            </p>
                        </button>
                    )}

                    {!canAccessNovoAgendamento && !canAccessLiberarVagas && !canAccessAcompanhar && !canAccessPacientes && !canAccessDados && !canAccessGestor && (
                        <div className="col-span-full text-center p-8 bg-white border border-slate-200 rounded-[2rem] shadow-sm max-w-md mx-auto">
                            <Activity className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Regulação & Consultas</h3>
                            <p className="text-xs text-slate-500 mt-2">Nenhuma funcionalidade deste módulo está disponível no momento.</p>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="flex-1 w-full h-full bg-[#f8fafc] relative flex flex-col overflow-hidden min-h-0">
            <div className="flex-1 flex flex-col h-full bg-[#f8fafc] w-full max-w-[100vw] overflow-hidden relative min-h-0">
                <main className="flex-1 overflow-hidden p-2 sm:p-3 flex flex-col min-h-0">
                    {!isSubView ? (
                        renderMainScreen()
                    ) : showNovoAgendamento ? (
                        <NovoAgendamentoScreen
                            currentUser={currentUser}
                            onBack={() => onNavigate('consultas')}
                            onNavigate={onNavigate}
                            subView={subView}
                            appState={appState}
                        />
                    ) : showLiberarVagas ? (
                        <LiberarVagasScreen
                            currentUser={currentUser}
                            onBack={() => onNavigate('consultas')}
                            onNavigate={onNavigate}
                        />
                    ) : showAcompanhar ? (
                        <AcompanharScreen
                            currentUser={currentUser}
                            onBack={() => onNavigate('consultas')}
                            onNavigate={onNavigate}
                            subView={subView}
                            appState={appState}
                        />
                    ) : showPacientes ? (
                        <div className="w-full max-w-[98%] 2xl:max-w-[1536px] mx-auto flex flex-col h-full max-h-full min-h-0 bg-white/95 backdrop-blur-md rounded-[2.5rem] border border-slate-200/80 shadow-[0_20px_60px_rgba(0,0,0,0.06)] overflow-hidden animate-in fade-in duration-300 p-4 md:p-5">
                            <PacientesTab onBack={() => onNavigate('consultas')} accentColor="sky" />
                        </div>
                    ) : showDados ? (
                        <DadosScreen
                            currentUser={currentUser}
                            onBack={() => onNavigate('consultas')}
                            subView={subView}
                            onNavigate={onNavigate}
                        />
                    ) : showGestor ? (
                        <ModuleGestorScreen
                            moduleType="consultas"
                            moduleTitle="Regulação de Consultas"
                            currentUser={currentUser || null}
                            onBack={() => onNavigate('consultas')}
                        />
                    ) : renderMainScreen()}
                </main>
            </div>
        </div>
    );
};
