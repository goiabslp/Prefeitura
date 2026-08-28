// Módulo de Consultas e Regulação Municipal
import React from 'react';
import { User, AppState } from '../../types';
import { ArrowLeft, PlusCircle, Activity, History, Database, Users, ShieldCheck } from 'lucide-react';
import { NovoAgendamentoScreen } from './NovoAgendamentoScreen';
import { AcompanharScreen } from './AcompanharScreen';
import { DadosScreen } from './DadosScreen';
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
    const { moduleStatus } = useSystemSettings();
    const isNovoAgendamentoActive = moduleStatus['parent_consultas_novo_agendamento'] !== false;
    const isAcompanharActive = moduleStatus['parent_consultas_acompanhar'] !== false;
    const isDadosActive = moduleStatus['parent_consultas_dados'] !== false;
    const isPacientesActive = moduleStatus['parent_consultas_pacientes'] !== false;
    const isGestorActive = moduleStatus['parent_consultas_gestor'] !== false;

    const userPerms = currentUser?.permissions || [];
    const hasCustomPerms = Array.isArray(currentUser?.permissions) && currentUser.permissions.length > 0;
    const isDefaultAdmin = currentUser?.role === 'admin' && !hasCustomPerms;
    const isAdmin = currentUser?.role === 'admin';

    const canAccessNovoAgendamento = (isDefaultAdmin || userPerms.includes('parent_consultas_novo_agendamento')) && isNovoAgendamentoActive;
    const canAccessAcompanhar = (isDefaultAdmin || userPerms.includes('parent_consultas_acompanhar')) && isAcompanharActive;
    const canAccessDados = (isDefaultAdmin || userPerms.includes('parent_consultas_dados')) && isDadosActive;
    const canAccessPacientes = (isDefaultAdmin || userPerms.includes('parent_consultas_pacientes')) && isPacientesActive;
    const canAccessGestor = (isDefaultAdmin || userPerms.includes('parent_consultas_gestor')) && isGestorActive;

    const showNovoAgendamento = (subView === 'novo-agendamento' || (subView?.startsWith('novo-agendamento') ?? false) || subView === 'vagas-reservadas') && canAccessNovoAgendamento;
    const showAcompanhar = (subView === 'acompanhar' || subView === 'definir-agenda') && canAccessAcompanhar;
    const showDados = (subView === 'dados' || (subView?.startsWith('dados') ?? false)) && canAccessDados;
    const showPacientes = (subView === 'pacientes') && canAccessPacientes;
    const showGestor = (subView === 'gestor') && canAccessGestor;
    
    const isSubView = showNovoAgendamento || showAcompanhar || showDados || showPacientes || showGestor;

    const renderMainScreen = () => {
        return (
            <div className="flex-1 flex flex-col items-center justify-center w-full h-full min-h-[80vh] container mx-auto p-4 relative">
                {/* Back Button */}
                <button
                    onClick={() => onNavigate('home')}
                    className="fixed top-24 left-4 md:top-28 md:left-8 z-[999] group flex items-center gap-2 text-slate-500 hover:text-sky-600 font-bold transition-all p-2 pr-4 rounded-full bg-white/90 backdrop-blur-md border border-slate-200/60 shadow-lg hover:shadow-xl hover:bg-white hover:-translate-y-0.5 hover:border-sky-100"
                    title="Voltar ao Menu"
                >
                    <div className="w-8 h-8 rounded-full bg-white border border-slate-100 flex items-center justify-center group-hover:bg-sky-50 group-hover:border-sky-100 transition-colors">
                        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform text-slate-400 group-hover:text-sky-600" />
                    </div>
                    <span className="text-[10px] uppercase tracking-widest font-extrabold group-hover:text-sky-700">Voltar</span>
                </button>

                <div className="w-full flex-1 flex flex-col items-center justify-center max-h-full mt-16 md:mt-0">
                    {/* Header */}
                    <div className="flex flex-col items-center mb-6 md:mb-12 shrink-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="p-4 rounded-[1.8rem] bg-gradient-to-br from-sky-50 to-sky-100/50 mb-4 shadow-sm ring-6 ring-white/50">
                            <Activity className="w-10 h-10 text-sky-600 drop-shadow-sm animate-pulse" />
                        </div>
                        <h2 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight text-center drop-shadow-sm uppercase">Regulação & Consultas</h2>
                        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em] mt-1 text-center">Agendamento de exames e consultas municipais</p>
                    </div>

                    {/* Cards Grid */}
                    <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 max-w-6xl animate-in zoom-in duration-500 fill-mode-backwards p-2">
                        {/* Novo Agendamento Card */}
                        {canAccessNovoAgendamento && (
                            <button
                                onClick={() => onNavigate('consultas:novo-agendamento')}
                                className="group relative w-full min-h-[140px] md:min-h-[180px] rounded-[2.5rem] bg-gradient-to-br from-white to-slate-50/50 border border-slate-100 shadow-[0_10px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_25px_60px_rgb(0,0,0,0.12)] hover:shadow-sky-500/30 hover:border-sky-200 hover:from-white hover:to-sky-50/30 transition-all duration-300 ease-spring hover:-translate-y-2 active:scale-95 flex flex-col items-center justify-center overflow-hidden text-center cursor-pointer"
                            >
                                <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/5 rounded-bl-[100%] -mr-10 -mt-10 transition-transform duration-700 ease-out group-hover:scale-150"></div>
                                <div className="absolute bottom-0 left-0 w-24 h-24 bg-sky-500/5 rounded-tr-[100%] -ml-10 -mb-10 transition-transform duration-700 ease-out group-hover:scale-125 opacity-0 group-hover:opacity-100"></div>

                                <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-gradient-to-br from-sky-500 to-sky-600 flex items-center justify-center mb-3 text-white group-hover:scale-110 group-hover:rotate-6 transition-transform duration-300 shadow-lg shadow-sky-500/30 ring-4 ring-white">
                                    <PlusCircle className="w-6 h-6 md:w-7 md:h-7 drop-shadow-md" />
                                </div>

                                <h3 className="text-lg md:text-2xl font-bold text-slate-800 mb-1 group-hover:text-slate-900 tracking-tight uppercase">Novo Agendamento</h3>
                                <p className="text-[10px] md:text-xs font-bold text-slate-400 group-hover:text-sky-600 transition-colors uppercase tracking-widest text-center px-4">Cadastrar ou Vincular Paciente</p>
                            </button>
                        )}

                        {/* Acompanhar Card */}
                        {canAccessAcompanhar && (
                            <button
                                onClick={() => onNavigate('consultas:acompanhar')}
                                className="group relative w-full min-h-[140px] md:min-h-[180px] rounded-[2.5rem] bg-gradient-to-br from-white to-slate-50/50 border border-slate-100 shadow-[0_10px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_25px_60px_rgb(0,0,0,0.12)] hover:shadow-indigo-500/30 hover:border-indigo-200 hover:from-white hover:to-indigo-50/30 transition-all duration-300 ease-spring hover:-translate-y-2 active:scale-95 flex flex-col items-center justify-center overflow-hidden text-center cursor-pointer"
                            >
                                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-bl-[100%] -mr-10 -mt-10 transition-transform duration-700 ease-out group-hover:scale-150"></div>
                                <div className="absolute bottom-0 left-0 w-24 h-24 bg-indigo-500/5 rounded-tr-[100%] -ml-10 -mb-10 transition-transform duration-700 ease-out group-hover:scale-125 opacity-0 group-hover:opacity-100"></div>

                                <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center mb-3 text-white group-hover:scale-110 group-hover:rotate-6 transition-transform duration-300 shadow-lg shadow-indigo-500/30 ring-4 ring-white">
                                    <History className="w-6 h-6 md:w-7 md:h-7 drop-shadow-md" />
                                </div>

                                <h3 className="text-lg md:text-2xl font-bold text-slate-800 mb-1 group-hover:text-slate-900 tracking-tight uppercase">Acompanhar</h3>
                                <p className="text-[10px] md:text-xs font-bold text-slate-400 group-hover:text-indigo-600 transition-colors uppercase tracking-widest text-center px-4">Fila de Espera em Tempo Real</p>
                            </button>
                        )}

                        {/* Pacientes Card */}
                        {canAccessPacientes && (
                            <button
                                onClick={() => onNavigate('consultas:pacientes')}
                                className="group relative w-full min-h-[140px] md:min-h-[180px] rounded-[2.5rem] bg-gradient-to-br from-white to-slate-50/50 border border-slate-100 shadow-[0_10px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_25px_60px_rgb(0,0,0,0.12)] hover:shadow-cyan-500/30 hover:border-cyan-200 hover:from-white hover:to-cyan-50/30 transition-all duration-300 ease-spring hover:-translate-y-2 active:scale-95 flex flex-col items-center justify-center overflow-hidden text-center cursor-pointer"
                            >
                                <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-bl-[100%] -mr-10 -mt-10 transition-transform duration-700 ease-out group-hover:scale-150"></div>
                                <div className="absolute bottom-0 left-0 w-24 h-24 bg-cyan-500/5 rounded-tr-[100%] -ml-10 -mb-10 transition-transform duration-700 ease-out group-hover:scale-125 opacity-0 group-hover:opacity-100"></div>

                                <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center mb-3 text-white group-hover:scale-110 group-hover:rotate-6 transition-transform duration-300 shadow-lg shadow-cyan-500/30 ring-4 ring-white">
                                    <Users className="w-6 h-6 md:w-7 md:h-7 drop-shadow-md" />
                                </div>

                                <h3 className="text-lg md:text-2xl font-bold text-slate-800 mb-1 group-hover:text-slate-900 tracking-tight uppercase">Pacientes</h3>
                                <p className="text-[10px] md:text-xs font-bold text-slate-400 group-hover:text-cyan-600 transition-colors uppercase tracking-widest text-center px-4">Farmácia Popular & Consultas</p>
                            </button>
                        )}

                        {/* Dados & Dashboard Card */}
                        {canAccessDados && (
                            <button
                                onClick={() => onNavigate('consultas:dados-dashboard')}
                                className="group relative w-full min-h-[140px] md:min-h-[180px] rounded-[2.5rem] bg-gradient-to-br from-white to-slate-50/50 border border-slate-100 shadow-[0_10px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_25px_60px_rgb(0,0,0,0.12)] hover:shadow-emerald-500/30 hover:border-emerald-200 hover:from-white hover:to-emerald-50/30 transition-all duration-300 ease-spring hover:-translate-y-2 active:scale-95 flex flex-col items-center justify-center overflow-hidden text-center cursor-pointer"
                            >
                                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-bl-[100%] -mr-10 -mt-10 transition-transform duration-700 ease-out group-hover:scale-150"></div>
                                <div className="absolute bottom-0 left-0 w-24 h-24 bg-emerald-500/5 rounded-tr-[100%] -ml-10 -mb-10 transition-transform duration-700 ease-out group-hover:scale-125 opacity-0 group-hover:opacity-100"></div>

                                <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center mb-3 text-white group-hover:scale-110 group-hover:rotate-6 transition-transform duration-300 shadow-lg shadow-emerald-500/30 ring-4 ring-white">
                                    <Database className="w-6 h-6 md:w-7 md:h-7 drop-shadow-md" />
                                </div>

                                <h3 className="text-lg md:text-2xl font-bold text-slate-800 mb-1 group-hover:text-slate-900 tracking-tight uppercase">Dados & Dashboard</h3>
                                <p className="text-[10px] md:text-xs font-bold text-slate-400 group-hover:text-emerald-600 transition-colors uppercase tracking-widest text-center px-4">Indicadores e Administração</p>
                            </button>
                        )}

                        {/* Gestor Card (Acesso por Permissão ou Admin) */}
                        {canAccessGestor && (
                            <button
                                onClick={() => onNavigate('consultas:gestor')}
                                className="group relative w-full min-h-[140px] md:min-h-[180px] rounded-[2.5rem] bg-gradient-to-br from-white to-slate-50/50 border border-slate-100 shadow-[0_10px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_25px_60px_rgb(0,0,0,0.12)] hover:shadow-indigo-500/30 hover:border-indigo-200 hover:from-white hover:to-indigo-50/30 transition-all duration-300 ease-spring hover:-translate-y-2 active:scale-95 flex flex-col items-center justify-center overflow-hidden text-center cursor-pointer"
                            >
                                <div className="absolute top-3 right-4 px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-[9px] font-black uppercase tracking-wider">
                                    GESTOR
                                </div>

                                <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mb-3 text-white group-hover:scale-110 group-hover:rotate-6 transition-transform duration-300 shadow-lg shadow-indigo-500/30 ring-4 ring-white">
                                    <ShieldCheck className="w-6 h-6 md:w-7 md:h-7 drop-shadow-md" />
                                </div>

                                <h3 className="text-lg md:text-2xl font-bold text-slate-800 mb-1 group-hover:text-slate-900 tracking-tight uppercase">Gestor</h3>
                                <p className="text-[10px] md:text-xs font-bold text-slate-400 group-hover:text-indigo-600 transition-colors uppercase tracking-widest text-center px-4">Controle de Permissões</p>
                            </button>
                        )}

                        {!canAccessNovoAgendamento && !canAccessAcompanhar && !canAccessPacientes && !canAccessDados && !canAccessGestor && (
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
