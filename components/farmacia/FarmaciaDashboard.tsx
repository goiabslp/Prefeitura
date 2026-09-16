import React, { useState, useEffect } from 'react';
import { User } from '../../types';
import { Search, ClipboardList, Package, Settings, History, Pill, Users, ShieldCheck } from 'lucide-react';
import { useSystemSettings } from '../../contexts/SystemSettingsContext';
import { userCanAccessSubmodule } from '../../services/permissionService';

interface FarmaciaDashboardProps {
    currentUser: User | null;
    onNavigate: (view: string) => void;
}

export const FarmaciaDashboard: React.FC<FarmaciaDashboardProps> = ({
    currentUser,
    onNavigate
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

    const isConsultarActive = isModuleActive('sub_farmacia_consultar') || isModuleActive('parent_farmacia_consultar');
    const isRetirarActive = isModuleActive('sub_farmacia_retirar') || isModuleActive('parent_farmacia_retirar');
    const isEstoqueActive = isModuleActive('sub_farmacia_estoque') || isModuleActive('parent_farmacia_estoque');
    const isDashboardActive = isModuleActive('sub_farmacia_dashboard') || isModuleActive('parent_farmacia_dashboard');
    const isPacientesActive = isModuleActive('sub_farmacia_pacientes') || isModuleActive('parent_farmacia_pacientes');
    const isGestorActive = isModuleActive('sub_farmacia_gestor') || isModuleActive('parent_farmacia_gestor');

    const canAccessConsultar = userCanAccessSubmodule(currentUser, 'parent_farmacia', 'sub_farmacia_consultar', isMobileViewport ? mobileModuleStatus : moduleStatus);
    const canAccessRetirar = userCanAccessSubmodule(currentUser, 'parent_farmacia', 'sub_farmacia_retirar', isMobileViewport ? mobileModuleStatus : moduleStatus);
    const canAccessEstoque = userCanAccessSubmodule(currentUser, 'parent_farmacia', 'sub_farmacia_estoque', isMobileViewport ? mobileModuleStatus : moduleStatus);
    const canAccessDados = userCanAccessSubmodule(currentUser, 'parent_farmacia', 'sub_farmacia_dashboard', isMobileViewport ? mobileModuleStatus : moduleStatus);
    const canAccessHistorico = canAccessDados;
    const canAccessPacientes = userCanAccessSubmodule(currentUser, 'parent_farmacia', 'sub_farmacia_pacientes', isMobileViewport ? mobileModuleStatus : moduleStatus);
    const canAccessGestor = userCanAccessSubmodule(currentUser, 'parent_farmacia', 'sub_farmacia_gestor', isMobileViewport ? mobileModuleStatus : moduleStatus);

    const visibleCardsCount = [
        canAccessConsultar,
        canAccessRetirar,
        canAccessEstoque,
        canAccessDados,
        canAccessPacientes,
        canAccessGestor
    ].filter(Boolean).length;

    const gridClass = visibleCardsCount >= 6
        ? "w-full grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 desktop:gap-4 max-w-7xl"
        : visibleCardsCount === 5
        ? "w-full grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 desktop:gap-4 max-w-6xl"
        : "w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 desktop:gap-4 max-w-5xl";

    return (
        <div className="flex-1 w-full p-4 md:p-6 overflow-y-auto lg:overflow-hidden flex flex-col justify-center items-center">
            <div className="w-full max-h-full flex flex-col items-center justify-center container mx-auto">
                {/* Header intro */}
                <div className="flex flex-col items-center mb-5 md:mb-7 shrink-0 animation-delay-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="p-3 md:p-3.5 rounded-2xl bg-gradient-to-br from-pink-50 to-pink-100/50 mb-2.5 shadow-xs ring-4 ring-white/60">
                        <Pill className="w-8 h-8 md:w-9 md:h-9 text-pink-600 drop-shadow-sm" />
                    </div>
                    <h1 className="text-2xl md:text-3xl lg:text-4xl font-black text-slate-800 tracking-tight text-center drop-shadow-sm uppercase">
                        Central de Medicamentos
                    </h1>
                    <p className="text-[10px] md:text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1 text-center">
                        Gestão integrada, controle de lotes e dispensação
                    </p>
                </div>

                {/* Grid of Main Cards */}
                <div className={`${gridClass} animate-in zoom-in duration-500 fill-mode-backwards p-1`}>
                    {/* Card 1: Consultar */}
                    {canAccessConsultar && (
                        <button
                            onClick={() => onNavigate('farmacia:consultar')}
                            className="group relative w-full min-h-[110px] md:min-h-[135px] py-4 md:py-5 px-3 md:px-4 rounded-[2rem] bg-gradient-to-br from-white to-slate-50 border border-slate-100 shadow-[0_10px_35px_rgba(0,0,0,0.03)] hover:shadow-[0_25px_60px_rgba(219,39,119,0.15)] hover:border-pink-200 hover:from-white hover:to-pink-50/20 hover:-translate-y-1.5 active:scale-95 transition-all duration-300 ease-out flex flex-col items-center justify-center text-center overflow-hidden cursor-pointer shrink-0"
                        >
                            <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/5 rounded-bl-[100%] -mr-10 -mt-10 transition-transform duration-700 ease-out group-hover:scale-150"></div>
                            <div className="absolute bottom-0 left-0 w-20 h-20 bg-pink-500/5 rounded-tr-[100%] -ml-10 -mb-10 transition-transform duration-700 ease-out group-hover:scale-125 opacity-0 group-hover:opacity-100"></div>

                            <div className="relative w-11 h-11 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center mb-2.5 text-white group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 shadow-md shadow-pink-500/30 ring-4 ring-white">
                                <Search className="w-5.5 h-5.5" />
                            </div>

                            <h3 className="text-sm md:text-base lg:text-lg font-extrabold text-slate-800 mb-0.5 group-hover:text-slate-900 tracking-tight uppercase text-center">
                                Consultar
                            </h3>
                            <p className="text-[9px] md:text-[10px] font-bold text-slate-400 group-hover:text-pink-600 transition-colors uppercase tracking-wider text-center">
                                Busca de Medicamentos
                            </p>
                        </button>
                    )}

                    {/* Card 2: Retirar */}
                    {canAccessRetirar && (
                        <button
                            onClick={() => onNavigate('farmacia:retirar')}
                            className="group relative w-full min-h-[110px] md:min-h-[135px] py-4 md:py-5 px-3 md:px-4 rounded-[2rem] bg-gradient-to-br from-white to-slate-50 border border-slate-100 shadow-[0_10px_35px_rgba(0,0,0,0.03)] hover:shadow-[0_25px_60px_rgba(219,39,119,0.15)] hover:border-pink-200 hover:from-white hover:to-pink-50/20 hover:-translate-y-1.5 active:scale-95 transition-all duration-300 ease-out flex flex-col items-center justify-center text-center overflow-hidden cursor-pointer shrink-0"
                        >
                            <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/5 rounded-bl-[100%] -mr-10 -mt-10 transition-transform duration-700 ease-out group-hover:scale-150"></div>
                            <div className="absolute bottom-0 left-0 w-20 h-20 bg-pink-500/5 rounded-tr-[100%] -ml-10 -mb-10 transition-transform duration-700 ease-out group-hover:scale-125 opacity-0 group-hover:opacity-100"></div>

                            <div className="relative w-11 h-11 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center mb-2.5 text-white group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 shadow-md shadow-pink-500/30 ring-4 ring-white">
                                <ClipboardList className="w-5.5 h-5.5" />
                            </div>

                            <h3 className="text-sm md:text-base lg:text-lg font-extrabold text-slate-800 mb-0.5 group-hover:text-slate-900 tracking-tight uppercase text-center">
                                Retirar
                            </h3>
                            <p className="text-[9px] md:text-[10px] font-bold text-slate-400 group-hover:text-pink-600 transition-colors uppercase tracking-wider text-center">
                                Baixa em Entrega
                            </p>
                        </button>
                    )}

                    {/* Card 3: Estoque */}
                    {canAccessEstoque && (
                        <button
                            onClick={() => onNavigate('farmacia:estoque')}
                            className="group relative w-full min-h-[110px] md:min-h-[135px] py-4 md:py-5 px-3 md:px-4 rounded-[2rem] bg-gradient-to-br from-white to-slate-50 border border-slate-100 shadow-[0_10px_35px_rgba(0,0,0,0.03)] hover:shadow-[0_25px_60px_rgba(219,39,119,0.15)] hover:border-pink-200 hover:from-white hover:to-pink-50/20 hover:-translate-y-1.5 active:scale-95 transition-all duration-300 ease-out flex flex-col items-center justify-center text-center overflow-hidden cursor-pointer shrink-0"
                        >
                            <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/5 rounded-bl-[100%] -mr-10 -mt-10 transition-transform duration-700 ease-out group-hover:scale-150"></div>
                            <div className="absolute bottom-0 left-0 w-20 h-20 bg-pink-500/5 rounded-tr-[100%] -ml-10 -mb-10 transition-transform duration-700 ease-out group-hover:scale-125 opacity-0 group-hover:opacity-100"></div>

                            <div className="relative w-11 h-11 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center mb-2.5 text-white group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 shadow-md shadow-pink-500/30 ring-4 ring-white">
                                <Package className="w-5.5 h-5.5" />
                            </div>

                            <h3 className="text-sm md:text-base lg:text-lg font-extrabold text-slate-800 mb-0.5 group-hover:text-slate-900 tracking-tight uppercase text-center">
                                Estoque
                            </h3>
                            <p className="text-[9px] md:text-[10px] font-bold text-slate-400 group-hover:text-pink-600 transition-colors uppercase tracking-wider text-center">
                                Controle de Lotes
                            </p>
                        </button>
                    )}

                    {/* Card 4: Dashboard */}
                    {canAccessDados && (
                        <button
                            onClick={() => onNavigate('farmacia:dashboard')}
                            className="group relative w-full min-h-[110px] md:min-h-[135px] py-4 md:py-5 px-3 md:px-4 rounded-[2rem] bg-gradient-to-br from-white to-slate-50 border border-slate-100 shadow-[0_10px_35px_rgba(0,0,0,0.03)] hover:shadow-[0_25px_60px_rgba(219,39,119,0.15)] hover:border-pink-200 hover:from-white hover:to-pink-50/20 hover:-translate-y-1.5 active:scale-95 transition-all duration-300 ease-out flex flex-col items-center justify-center text-center overflow-hidden cursor-pointer shrink-0"
                        >
                            <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/5 rounded-bl-[100%] -mr-10 -mt-10 transition-transform duration-700 ease-out group-hover:scale-150"></div>
                            <div className="absolute bottom-0 left-0 w-20 h-20 bg-pink-500/5 rounded-tr-[100%] -ml-10 -mb-10 transition-transform duration-700 ease-out group-hover:scale-125 opacity-0 group-hover:opacity-100"></div>

                            <div className="relative w-11 h-11 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center mb-2.5 text-white group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 shadow-md shadow-pink-500/30 ring-4 ring-white">
                                <History className="w-5.5 h-5.5" />
                            </div>

                            <h3 className="text-sm md:text-base lg:text-lg font-extrabold text-slate-800 mb-0.5 group-hover:text-slate-900 tracking-tight uppercase text-center">
                                Dashboard
                            </h3>
                            <p className="text-[9px] md:text-[10px] font-bold text-slate-400 group-hover:text-pink-600 transition-colors uppercase tracking-wider text-center">
                                Análises e Relatórios
                            </p>
                        </button>
                    )}

                    {/* Card 5: Pacientes */}
                    {canAccessPacientes && (
                        <button
                            onClick={() => onNavigate('farmacia:pacientes')}
                            className="group relative w-full min-h-[110px] md:min-h-[135px] py-4 md:py-5 px-3 md:px-4 rounded-[2rem] bg-gradient-to-br from-white to-slate-50 border border-slate-100 shadow-[0_10px_35px_rgba(0,0,0,0.03)] hover:shadow-[0_25px_60px_rgba(219,39,119,0.15)] hover:border-pink-200 hover:from-white hover:to-pink-50/20 hover:-translate-y-1.5 active:scale-95 transition-all duration-300 ease-out flex flex-col items-center justify-center text-center overflow-hidden cursor-pointer shrink-0"
                        >
                            <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/5 rounded-bl-[100%] -mr-10 -mt-10 transition-transform duration-700 ease-out group-hover:scale-150"></div>
                            <div className="absolute bottom-0 left-0 w-20 h-20 bg-pink-500/5 rounded-tr-[100%] -ml-10 -mb-10 transition-transform duration-700 ease-out group-hover:scale-125 opacity-0 group-hover:opacity-100"></div>

                            <div className="relative w-11 h-11 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center mb-2.5 text-white group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 shadow-md shadow-pink-500/30 ring-4 ring-white">
                                <Users className="w-5.5 h-5.5" />
                            </div>

                            <h3 className="text-sm md:text-base lg:text-lg font-extrabold text-slate-800 mb-0.5 group-hover:text-slate-900 tracking-tight uppercase text-center">
                                Pacientes
                            </h3>
                            <p className="text-[9px] md:text-[10px] font-bold text-slate-400 group-hover:text-pink-600 transition-colors uppercase tracking-wider text-center">
                                Base Unificada
                            </p>
                        </button>
                    )}

                    {/* Card 6: Gestor (Acesso por Permissão ou Admin) */}
                    {canAccessGestor && (
                        <button
                            onClick={() => onNavigate('farmacia:gestor')}
                            className="group relative w-full min-h-[110px] md:min-h-[135px] py-4 md:py-5 px-3 md:px-4 rounded-[2rem] bg-gradient-to-br from-white to-slate-50 border border-slate-100 shadow-[0_10px_35px_rgba(0,0,0,0.03)] hover:shadow-[0_25px_60px_rgba(99,102,241,0.15)] hover:border-indigo-200 hover:from-white hover:to-indigo-50/20 hover:-translate-y-1.5 active:scale-95 transition-all duration-300 ease-out flex flex-col items-center justify-center text-center overflow-hidden cursor-pointer shrink-0"
                        >
                            <div className="absolute top-2.5 right-3 px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-[8px] font-black uppercase tracking-wider">
                                GESTOR
                            </div>

                            <div className="relative w-11 h-11 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mb-2.5 text-white group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 shadow-md shadow-indigo-500/30 ring-4 ring-white">
                                <ShieldCheck className="w-5.5 h-5.5" />
                            </div>

                            <h3 className="text-sm md:text-base lg:text-lg font-extrabold text-slate-800 mb-0.5 group-hover:text-slate-900 tracking-tight uppercase text-center">
                                Gestor
                            </h3>
                            <p className="text-[9px] md:text-[10px] font-bold text-slate-400 group-hover:text-indigo-600 transition-colors uppercase tracking-wider text-center">
                                Permissões
                            </p>
                        </button>
                    )}

                    {!canAccessConsultar && !canAccessRetirar && !canAccessEstoque && !canAccessDados && !canAccessPacientes && !canAccessGestor && (
                        <div className="col-span-full text-center p-8 bg-white border border-slate-200 rounded-[2rem] shadow-sm max-w-md mx-auto">
                            <Pill className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Farmácia Popular</h3>
                            <p className="text-xs text-slate-500 mt-2">Nenhuma funcionalidade deste módulo está disponível para o seu perfil ou dispositivo.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
