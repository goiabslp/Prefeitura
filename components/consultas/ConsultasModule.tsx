// Módulo de Consultas e Regulação Municipal
import React, { useState, useEffect } from 'react';
import { User, AppState } from '../../types';
import { ArrowLeft, PlusCircle, Activity, History, Database, Users, ShieldCheck, CalendarClock, CalendarCheck, Settings } from 'lucide-react';
import { NovoAgendamentoScreen } from './NovoAgendamentoScreen';
import { AcompanharScreen } from './AcompanharScreen';
import { DadosScreen } from './DadosScreen';
import { LiberarVagasScreen } from './LiberarVagasScreen';
import { ProcedimentosScreen } from './ProcedimentosScreen';
import { PacientesTab } from '../common/PacientesTab';
import { ModuleGestorScreen } from '../common/ModuleGestorScreen';
import { useSystemSettings } from '../../contexts/SystemSettingsContext';
import { userCanAccessSubmodule } from '../../services/permissionService';

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

    const isNovoAgendamentoActive = isModuleActive('sub_consultas_novo_agendamento') || isModuleActive('parent_consultas_novo_agendamento');
    const isLiberarVagasActive = isModuleActive('sub_consultas_liberar_vagas') !== false || isModuleActive('parent_consultas_liberar_vagas') !== false;
    const isAcompanharActive = isModuleActive('sub_consultas_acompanhar') || isModuleActive('parent_consultas_acompanhar');
    const isProcedimentosActive = isModuleActive('sub_consultas_procedimentos') || isModuleActive('parent_consultas_procedimentos');
    const isDadosActive = isModuleActive('sub_consultas_dados') || isModuleActive('parent_consultas_dados');
    const isPacientesActive = isModuleActive('sub_consultas_pacientes') || isModuleActive('parent_consultas_pacientes');
    const isGestorActive = isModuleActive('sub_consultas_gestor') || isModuleActive('parent_consultas_gestor');

    const canAccessNovoAgendamento = userCanAccessSubmodule(currentUser, 'parent_consultas', 'sub_consultas_novo_agendamento', isMobileViewport ? mobileModuleStatus : moduleStatus);
    const canAccessLiberarVagas = userCanAccessSubmodule(currentUser, 'parent_consultas', 'sub_consultas_liberar_vagas', isMobileViewport ? mobileModuleStatus : moduleStatus);
    const canAccessAcompanhar = userCanAccessSubmodule(currentUser, 'parent_consultas', 'sub_consultas_acompanhar', isMobileViewport ? mobileModuleStatus : moduleStatus);
    const canAccessProcedimentos = userCanAccessSubmodule(currentUser, 'parent_consultas', 'sub_consultas_procedimentos', isMobileViewport ? mobileModuleStatus : moduleStatus);
    const canAccessDados = userCanAccessSubmodule(currentUser, 'parent_consultas', 'sub_consultas_dados', isMobileViewport ? mobileModuleStatus : moduleStatus);
    const canAccessPacientes = userCanAccessSubmodule(currentUser, 'parent_consultas', 'sub_consultas_pacientes', isMobileViewport ? mobileModuleStatus : moduleStatus);
    const canAccessGestor = userCanAccessSubmodule(currentUser, 'parent_consultas', 'sub_consultas_gestor', isMobileViewport ? mobileModuleStatus : moduleStatus);

    const showNovoAgendamento = (subView === 'novo-agendamento' || (subView?.startsWith('novo-agendamento') ?? false) || subView === 'vagas-reservadas') && canAccessNovoAgendamento;
    const showLiberarVagas = (subView === 'liberar-vagas') && canAccessLiberarVagas;
    const showAcompanhar = (subView === 'acompanhar' || subView === 'definir-agenda') && canAccessAcompanhar;
    const showProcedimentos = (subView === 'procedimentos') && canAccessProcedimentos;
    const showDados = (subView === 'dados' || (subView?.startsWith('dados') ?? false)) && canAccessDados;
    const showPacientes = (subView === 'pacientes') && canAccessPacientes;
    const showGestor = (subView === 'gestor') && canAccessGestor;
    
    const isSubView = showNovoAgendamento || showLiberarVagas || showAcompanhar || showProcedimentos || showDados || showPacientes || showGestor;

    const renderMainScreen = () => {
        const visibleCardsCount = [
            canAccessNovoAgendamento,
            canAccessLiberarVagas,
            canAccessAcompanhar,
            canAccessProcedimentos,
            canAccessPacientes,
            canAccessDados,
            canAccessGestor
        ].filter(Boolean).length;

        const gridClass = visibleCardsCount >= 7
            ? "w-full grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7 gap-2.5 md:gap-3.5 max-w-7xl mb-4"
            : visibleCardsCount === 6
            ? "w-full grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 xl:grid-cols-6 gap-2.5 md:gap-3.5 max-w-7xl mb-4"
            : visibleCardsCount === 5
            ? "w-full grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 max-w-6xl mb-4"
            : "w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 max-w-5xl mb-4";

        return (
            <div className="flex-1 w-full p-4 md:p-6 overflow-y-auto lg:overflow-hidden flex flex-col justify-center items-center">
                <div className="w-full max-h-full flex flex-col items-center justify-center container mx-auto">
                    {/* Botão Voltar */}
                    <button
                        onClick={() => onNavigate('home')}
                        className="fixed top-20 left-4 desktop:top-24 desktop:left-8 z-[999] group flex items-center gap-2 text-slate-500 hover:text-sky-600 font-bold transition-all p-2 pr-4 rounded-full bg-white/90 backdrop-blur-md border border-slate-200/60 shadow-lg hover:shadow-xl hover:bg-white hover:-translate-y-0.5 hover:border-sky-100 cursor-pointer"
                        title="Voltar ao Menu"
                    >
                        <div className="w-8 h-8 rounded-full bg-white border border-slate-100 flex items-center justify-center group-hover:bg-sky-50 group-hover:border-sky-100 transition-colors">
                            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform text-slate-400 group-hover:text-sky-600" />
                        </div>
                        <span className="text-[10px] uppercase tracking-widest font-extrabold group-hover:text-sky-700">Voltar</span>
                    </button>

                    {/* Header intro */}
                    <div className="text-center mb-5 md:mb-7 shrink-0 animation-delay-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="inline-flex p-3 rounded-2xl bg-gradient-to-br from-sky-50 to-sky-100/50 mb-2.5 shadow-xs ring-4 ring-white/60">
                            <Activity className="w-8 h-8 md:w-9 md:h-9 text-sky-600 drop-shadow-xs animate-pulse" />
                        </div>
                        <h1 className="text-2xl md:text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight mb-1 uppercase">
                            Regulação & Consultas
                        </h1>
                        <p className="text-[10px] md:text-[11px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                            Agendamento de exames e consultas municipais
                        </p>
                    </div>

                    {/* Grid of Main Cards */}
                    <div className={`${gridClass} animate-in zoom-in duration-500 fill-mode-backwards p-1`}>
                        {/* Card 1: Novo Agendamento */}
                        {canAccessNovoAgendamento && (
                            <button
                                onClick={() => onNavigate('consultas:novo-agendamento')}
                                className="group relative w-full min-h-[115px] md:min-h-[135px] rounded-[2rem] bg-gradient-to-br from-white to-slate-50 border border-slate-100 shadow-[0_10px_35px_rgba(0,0,0,0.03)] hover:shadow-[0_25px_60px_rgba(14,165,233,0.15)] hover:border-sky-200 hover:from-white hover:to-sky-50/20 hover:-translate-y-1.5 active:scale-95 transition-all duration-300 ease-out flex flex-col items-center justify-center text-center overflow-hidden p-3.5 md:p-4 cursor-pointer shrink-0"
                            >
                                <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/5 rounded-bl-[100%] -mr-10 -mt-10 transition-transform duration-700 ease-out group-hover:scale-150"></div>
                                <div className="absolute bottom-0 left-0 w-20 h-20 bg-sky-500/5 rounded-tr-[100%] -ml-10 -mb-10 transition-transform duration-700 ease-out group-hover:scale-125 opacity-0 group-hover:opacity-100"></div>

                                <div className="w-11 h-11 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-sky-500 to-sky-600 flex items-center justify-center mb-2 text-white group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 shadow-md shadow-sky-500/30 ring-4 ring-white">
                                    <PlusCircle className="w-5.5 h-5.5" />
                                </div>

                                <h3 className="text-sm md:text-base font-extrabold text-slate-800 mb-0.5 group-hover:text-slate-900 tracking-tight uppercase text-center">
                                    Novo Agendamento
                                </h3>
                                <p className="text-[9px] md:text-[10px] font-bold text-slate-400 group-hover:text-sky-600 transition-colors uppercase tracking-wider text-center">
                                    Cadastrar ou Vincular
                                </p>
                            </button>
                        )}

                        {/* Card 2: Liberar Vagas */}
                        {canAccessLiberarVagas && (
                            <button
                                onClick={() => onNavigate('consultas:liberar-vagas')}
                                className="group relative w-full min-h-[115px] md:min-h-[135px] rounded-[2rem] bg-gradient-to-br from-white to-slate-50 border border-slate-100 shadow-[0_10px_35px_rgba(0,0,0,0.03)] hover:shadow-[0_25px_60px_rgba(20,184,166,0.15)] hover:border-teal-200 hover:from-white hover:to-teal-50/20 hover:-translate-y-1.5 active:scale-95 transition-all duration-300 ease-out flex flex-col items-center justify-center text-center overflow-hidden p-3.5 md:p-4 cursor-pointer shrink-0"
                            >
                                <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/5 rounded-bl-[100%] -mr-10 -mt-10 transition-transform duration-700 ease-out group-hover:scale-150"></div>
                                <div className="absolute bottom-0 left-0 w-20 h-20 bg-teal-500/5 rounded-tr-[100%] -ml-10 -mb-10 transition-transform duration-700 ease-out group-hover:scale-125 opacity-0 group-hover:opacity-100"></div>

                                <div className="w-11 h-11 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center mb-2 text-white group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 shadow-md shadow-teal-500/30 ring-4 ring-white">
                                    <CalendarClock className="w-5.5 h-5.5" />
                                </div>

                                <h3 className="text-sm md:text-base font-extrabold text-slate-800 mb-0.5 group-hover:text-slate-900 tracking-tight uppercase text-center">
                                    Liberar Vagas
                                </h3>
                                <p className="text-[9px] md:text-[10px] font-bold text-slate-400 group-hover:text-teal-600 transition-colors uppercase tracking-wider text-center">
                                    Gestão de Horários
                                </p>
                            </button>
                        )}

                        {/* Card 3: Acompanhar */}
                        {canAccessAcompanhar && (
                            <button
                                onClick={() => onNavigate('consultas:acompanhar')}
                                className="group relative w-full min-h-[115px] md:min-h-[135px] rounded-[2rem] bg-gradient-to-br from-white to-slate-50 border border-slate-100 shadow-[0_10px_35px_rgba(0,0,0,0.03)] hover:shadow-[0_25px_60px_rgba(99,102,241,0.15)] hover:border-indigo-200 hover:from-white hover:to-indigo-50/20 hover:-translate-y-1.5 active:scale-95 transition-all duration-300 ease-out flex flex-col items-center justify-center text-center overflow-hidden p-3.5 md:p-4 cursor-pointer shrink-0"
                            >
                                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-bl-[100%] -mr-10 -mt-10 transition-transform duration-700 ease-out group-hover:scale-150"></div>
                                <div className="absolute bottom-0 left-0 w-20 h-20 bg-indigo-500/5 rounded-tr-[100%] -ml-10 -mb-10 transition-transform duration-700 ease-out group-hover:scale-125 opacity-0 group-hover:opacity-100"></div>

                                <div className="w-11 h-11 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center mb-2 text-white group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 shadow-md shadow-indigo-500/30 ring-4 ring-white">
                                    <History className="w-5.5 h-5.5" />
                                </div>

                                <h3 className="text-sm md:text-base font-extrabold text-slate-800 mb-0.5 group-hover:text-slate-900 tracking-tight uppercase text-center">
                                    Acompanhar
                                </h3>
                                <p className="text-[9px] md:text-[10px] font-bold text-slate-400 group-hover:text-indigo-600 transition-colors uppercase tracking-wider text-center">
                                    Fila de Espera
                                </p>
                            </button>
                        )}

                        {/* Card 4: Procedimentos */}
                        {canAccessProcedimentos && (
                            <button
                                onClick={() => onNavigate('consultas:procedimentos')}
                                className="group relative w-full min-h-[115px] md:min-h-[135px] rounded-[2rem] bg-gradient-to-br from-white to-slate-50 border border-slate-100 shadow-[0_10px_35px_rgba(0,0,0,0.03)] hover:shadow-[0_25px_60px_rgba(37,99,235,0.15)] hover:border-blue-200 hover:from-white hover:to-blue-50/20 hover:-translate-y-1.5 active:scale-95 transition-all duration-300 ease-out flex flex-col items-center justify-center text-center overflow-hidden p-3.5 md:p-4 cursor-pointer shrink-0"
                            >
                                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-bl-[100%] -mr-10 -mt-10 transition-transform duration-700 ease-out group-hover:scale-150"></div>
                                <div className="absolute bottom-0 left-0 w-20 h-20 bg-blue-500/5 rounded-tr-[100%] -ml-10 -mb-10 transition-transform duration-700 ease-out group-hover:scale-125 opacity-0 group-hover:opacity-100"></div>

                                <div className="w-11 h-11 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mb-2 text-white group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 shadow-md shadow-blue-500/30 ring-4 ring-white">
                                    <Settings className="w-5.5 h-5.5" />
                                </div>

                                <h3 className="text-sm md:text-base font-extrabold text-slate-800 mb-0.5 group-hover:text-slate-900 tracking-tight uppercase text-center">
                                    Procedimentos
                                </h3>
                                <p className="text-[9px] md:text-[10px] font-bold text-slate-400 group-hover:text-blue-600 transition-colors uppercase tracking-wider text-center">
                                    Exames & Consultas
                                </p>
                            </button>
                        )}

                        {/* Card 5: Pacientes */}
                        {canAccessPacientes && (
                            <button
                                onClick={() => onNavigate('consultas:pacientes')}
                                className="group relative w-full min-h-[115px] md:min-h-[135px] rounded-[2rem] bg-gradient-to-br from-white to-slate-50 border border-slate-100 shadow-[0_10px_35px_rgba(0,0,0,0.03)] hover:shadow-[0_25px_60px_rgba(6,182,212,0.15)] hover:border-cyan-200 hover:from-white hover:to-cyan-50/20 hover:-translate-y-1.5 active:scale-95 transition-all duration-300 ease-out flex flex-col items-center justify-center text-center overflow-hidden p-3.5 md:p-4 cursor-pointer shrink-0"
                            >
                                <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-bl-[100%] -mr-10 -mt-10 transition-transform duration-700 ease-out group-hover:scale-150"></div>
                                <div className="absolute bottom-0 left-0 w-20 h-20 bg-cyan-500/5 rounded-tr-[100%] -ml-10 -mb-10 transition-transform duration-700 ease-out group-hover:scale-125 opacity-0 group-hover:opacity-100"></div>

                                <div className="w-11 h-11 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center mb-2 text-white group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 shadow-md shadow-cyan-500/30 ring-4 ring-white">
                                    <Users className="w-5.5 h-5.5" />
                                </div>

                                <h3 className="text-sm md:text-base font-extrabold text-slate-800 mb-0.5 group-hover:text-slate-900 tracking-tight uppercase text-center">
                                    Pacientes
                                </h3>
                                <p className="text-[9px] md:text-[10px] font-bold text-slate-400 group-hover:text-cyan-600 transition-colors uppercase tracking-wider text-center">
                                    Base Unificada
                                </p>
                            </button>
                        )}

                        {/* Card 6: Dados & Dashboard */}
                        {canAccessDados && (
                            <button
                                onClick={() => onNavigate('consultas:dados-dashboard')}
                                className="group relative w-full min-h-[115px] md:min-h-[135px] rounded-[2rem] bg-gradient-to-br from-white to-slate-50 border border-slate-100 shadow-[0_10px_35px_rgba(0,0,0,0.03)] hover:shadow-[0_25px_60px_rgba(16,185,129,0.15)] hover:border-emerald-200 hover:from-white hover:to-emerald-50/20 hover:-translate-y-1.5 active:scale-95 transition-all duration-300 ease-out flex flex-col items-center justify-center text-center overflow-hidden p-3.5 md:p-4 cursor-pointer shrink-0"
                            >
                                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-bl-[100%] -mr-10 -mt-10 transition-transform duration-700 ease-out group-hover:scale-150"></div>
                                <div className="absolute bottom-0 left-0 w-20 h-20 bg-emerald-500/5 rounded-tr-[100%] -ml-10 -mb-10 transition-transform duration-700 ease-out group-hover:scale-125 opacity-0 group-hover:opacity-100"></div>

                                <div className="w-11 h-11 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center mb-2 text-white group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 shadow-md shadow-emerald-500/30 ring-4 ring-white">
                                    <Database className="w-5.5 h-5.5" />
                                </div>

                                <h3 className="text-sm md:text-base font-extrabold text-slate-800 mb-0.5 group-hover:text-slate-900 tracking-tight uppercase text-center">
                                    Dados & Métricas
                                </h3>
                                <p className="text-[9px] md:text-[10px] font-bold text-slate-400 group-hover:text-emerald-600 transition-colors uppercase tracking-wider text-center">
                                    Painel de Gestão
                                </p>
                            </button>
                        )}

                        {/* Card 7: Gestor */}
                        {canAccessGestor && (
                            <button
                                onClick={() => onNavigate('consultas:gestor')}
                                className="group relative w-full min-h-[115px] md:min-h-[135px] rounded-[2rem] bg-gradient-to-br from-white to-slate-50 border border-slate-100 shadow-[0_10px_35px_rgba(0,0,0,0.03)] hover:shadow-[0_25px_60px_rgba(168,85,247,0.15)] hover:border-purple-200 hover:from-white hover:to-purple-50/20 hover:-translate-y-1.5 active:scale-95 transition-all duration-300 ease-out flex flex-col items-center justify-center text-center overflow-hidden p-3.5 md:p-4 cursor-pointer shrink-0"
                            >
                                <div className="absolute top-2.5 right-3 px-2 py-0.5 rounded-full bg-purple-50 border border-purple-200 text-purple-700 text-[8px] font-black uppercase tracking-wider">
                                    GESTOR
                                </div>

                                <div className="w-11 h-11 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center mb-2 text-white group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 shadow-md shadow-purple-500/30 ring-4 ring-white">
                                    <ShieldCheck className="w-5.5 h-5.5" />
                                </div>

                                <h3 className="text-sm md:text-base font-extrabold text-slate-800 mb-0.5 group-hover:text-slate-900 tracking-tight uppercase text-center">
                                    Gestor
                                </h3>
                                <p className="text-[9px] md:text-[10px] font-bold text-slate-400 group-hover:text-purple-600 transition-colors uppercase tracking-wider text-center">
                                    Controle de Acessos
                                </p>
                            </button>
                        )}

                        {!canAccessNovoAgendamento && !canAccessLiberarVagas && !canAccessAcompanhar && !canAccessProcedimentos && !canAccessPacientes && !canAccessDados && !canAccessGestor && (
                            <div className="col-span-full text-center p-8 bg-white border border-slate-200 rounded-[2rem] shadow-sm max-w-md mx-auto">
                                <Activity className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Regulação & Consultas</h3>
                                <p className="text-xs text-slate-500 mt-2">Nenhuma funcionalidade deste módulo está disponível no momento.</p>
                            </div>
                        )}
                    </div>
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
                    ) : showProcedimentos ? (
                        <ProcedimentosScreen
                            currentUser={currentUser}
                            onBack={() => onNavigate('consultas')}
                            onNavigate={onNavigate}
                        />
                    ) : showPacientes ? (
                        <div className="w-full flex-1 flex flex-col h-full max-h-full min-h-0 bg-white/95 backdrop-blur-md rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden animate-in fade-in duration-200 p-2 sm:p-3">
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
