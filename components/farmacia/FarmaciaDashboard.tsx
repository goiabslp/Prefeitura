import React, { useState, useEffect } from 'react';
import { User } from '../../types';
import { Search, ClipboardList, Package, Settings, History, Pill, Users, ShieldCheck } from 'lucide-react';
import { useSystemSettings } from '../../contexts/SystemSettingsContext';

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

    const isConsultarActive = isModuleActive('parent_farmacia_consultar');
    const isRetirarActive = isModuleActive('parent_farmacia_retirar');
    const isEstoqueActive = isModuleActive('parent_farmacia_estoque');
    const isDashboardActive = isModuleActive('parent_farmacia_dashboard');
    const isPacientesActive = isModuleActive('parent_farmacia_pacientes');
    const isGestorActive = isModuleActive('parent_farmacia_gestor');

    const userPerms = currentUser?.permissions || [];
    const hasCustomPerms = Array.isArray(currentUser?.permissions) && currentUser.permissions.length > 0;
    const isDefaultAdmin = currentUser?.role === 'admin' && !hasCustomPerms;
    const isAdmin = currentUser?.role === 'admin';

    const canAccessConsultar = (isDefaultAdmin || userPerms.includes('parent_farmacia_consultar')) && isConsultarActive;
    const canAccessRetirar = (isDefaultAdmin || userPerms.includes('parent_farmacia_retirar')) && isRetirarActive;
    const canAccessEstoque = (isDefaultAdmin || userPerms.includes('parent_farmacia_estoque')) && isEstoqueActive;
    const canAccessHistorico = isDefaultAdmin || userPerms.includes('parent_farmacia');
    const canAccessDados = (isDefaultAdmin || userPerms.includes('parent_farmacia_dashboard')) && isDashboardActive;
    const canAccessPacientes = (isDefaultAdmin || userPerms.includes('parent_farmacia_pacientes')) && isPacientesActive;
    const canAccessGestor = (isDefaultAdmin || userPerms.includes('parent_farmacia_gestor')) && isGestorActive;

    return (
        <div className="flex-1 flex flex-col justify-center items-center w-full max-w-7xl mx-auto px-4 py-8 animate-in fade-in slide-in-from-bottom-6 duration-500">
            {/* Header intro */}
            <div className="text-center mb-10 max-w-xl shrink-0">
                <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight mb-2 uppercase">
                    Central de Medicamentos
                </h1>
            </div>

            {/* Grid of Main Cards */}
            <div className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-12">
                {/* Card 1: Consultar */}
                {canAccessConsultar && (
                    <button
                        onClick={() => onNavigate('farmacia:consultar')}
                        className="group relative w-full min-h-[200px] rounded-[2.5rem] bg-gradient-to-br from-white to-slate-50 border border-slate-100 shadow-[0_10px_35px_rgba(0,0,0,0.03)] hover:shadow-[0_30px_70px_rgba(219,39,119,0.15)] hover:border-pink-200 hover:from-white hover:to-pink-50/20 hover:-translate-y-2 active:scale-98 transition-all duration-300 ease-out flex flex-col items-center justify-center text-center overflow-hidden p-6 cursor-pointer"
                    >
                        <div className="absolute top-0 right-0 w-36 h-36 bg-pink-500/5 rounded-bl-[100%] -mr-10 -mt-10 transition-transform duration-700 ease-out group-hover:scale-150"></div>
                        <div className="absolute bottom-0 left-0 w-24 h-24 bg-pink-500/5 rounded-tr-[100%] -ml-10 -mb-10 transition-transform duration-700 ease-out group-hover:scale-125 opacity-0 group-hover:opacity-100"></div>

                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center mb-4 text-white group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-lg shadow-pink-500/30 ring-4 ring-white">
                            <Search className="w-6.5 h-6.5" />
                        </div>

                        <h3 className="text-xl font-extrabold text-slate-800 mb-1.5 group-hover:text-slate-900 tracking-tight uppercase">
                            Consultar
                        </h3>
                        <p className="text-xs font-bold text-slate-400 group-hover:text-pink-600 transition-colors uppercase tracking-widest leading-relaxed">
                            Busca Dinâmica de Medicamentos
                        </p>
                        <p className="text-[10px] text-slate-400 mt-2 max-w-[180px] font-medium leading-normal">
                            Pesquisa instantânea por nome, categoria e disponibilidade em estoque.
                        </p>
                    </button>
                )}

                {/* Card 2: Retirar */}
                {canAccessRetirar && (
                    <button
                        onClick={() => onNavigate('farmacia:retirar')}
                        className="group relative w-full min-h-[200px] rounded-[2.5rem] bg-gradient-to-br from-white to-slate-50 border border-slate-100 shadow-[0_10px_35px_rgba(0,0,0,0.03)] hover:shadow-[0_30px_70px_rgba(219,39,119,0.15)] hover:border-pink-200 hover:from-white hover:to-pink-50/20 hover:-translate-y-2 active:scale-98 transition-all duration-300 ease-out flex flex-col items-center justify-center text-center overflow-hidden p-6 cursor-pointer"
                    >
                        <div className="absolute top-0 right-0 w-36 h-36 bg-pink-500/5 rounded-bl-[100%] -mr-10 -mt-10 transition-transform duration-700 ease-out group-hover:scale-150"></div>
                        <div className="absolute bottom-0 left-0 w-24 h-24 bg-pink-500/5 rounded-tr-[100%] -ml-10 -mb-10 transition-transform duration-700 ease-out group-hover:scale-125 opacity-0 group-hover:opacity-100"></div>

                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center mb-4 text-white group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-lg shadow-pink-500/30 ring-4 ring-white">
                            <ClipboardList className="w-6.5 h-6.5" />
                        </div>

                        <h3 className="text-xl font-extrabold text-slate-800 mb-1.5 group-hover:text-slate-900 tracking-tight uppercase">
                            Retirar
                        </h3>
                        <p className="text-xs font-bold text-slate-400 group-hover:text-pink-600 transition-colors uppercase tracking-widest leading-relaxed">
                            Dar Baixa em Entrega
                        </p>
                        <p className="text-[10px] text-slate-400 mt-2 max-w-[180px] font-medium leading-normal">
                            Validação automatizada de estoque e registro de logs de retirada de pacientes.
                        </p>
                    </button>
                )}

                {/* Card 3: Estoque */}
                {canAccessEstoque && (
                    <button
                        onClick={() => onNavigate('farmacia:estoque')}
                        className="group relative w-full min-h-[200px] rounded-[2.5rem] bg-gradient-to-br from-white to-slate-50 border border-slate-100 shadow-[0_10px_35px_rgba(0,0,0,0.03)] hover:shadow-[0_30px_70px_rgba(219,39,119,0.15)] hover:border-pink-200 hover:from-white hover:to-pink-50/20 hover:-translate-y-2 active:scale-98 transition-all duration-300 ease-out flex flex-col items-center justify-center text-center overflow-hidden p-6 cursor-pointer"
                    >
                        <div className="absolute top-0 right-0 w-36 h-36 bg-pink-500/5 rounded-bl-[100%] -mr-10 -mt-10 transition-transform duration-700 ease-out group-hover:scale-150"></div>
                        <div className="absolute bottom-0 left-0 w-24 h-24 bg-pink-500/5 rounded-tr-[100%] -ml-10 -mb-10 transition-transform duration-700 ease-out group-hover:scale-125 opacity-0 group-hover:opacity-100"></div>

                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center mb-4 text-white group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-lg shadow-pink-500/30 ring-4 ring-white">
                            <Package className="w-6.5 h-6.5" />
                        </div>

                        <h3 className="text-xl font-extrabold text-slate-800 mb-1.5 group-hover:text-slate-900 tracking-tight uppercase">
                            Estoque
                        </h3>
                        <p className="text-xs font-bold text-slate-400 group-hover:text-pink-600 transition-colors uppercase tracking-widest leading-relaxed">
                            Controle de Lotes e Dashboard
                        </p>
                        <p className="text-[10px] text-slate-400 mt-2 max-w-[180px] font-medium leading-normal">
                            Cadastro de novos itens, controle de alertas de vencimento e relatórios de fluxo.
                        </p>
                    </button>
                )}

                {/* Card 4: Dashboard */}
                {canAccessDados && (
                    <button
                        onClick={() => onNavigate('farmacia:dashboard')}
                        className="group relative w-full min-h-[200px] rounded-[2.5rem] bg-gradient-to-br from-white to-slate-50 border border-slate-100 shadow-[0_10px_35px_rgba(0,0,0,0.03)] hover:shadow-[0_30px_70px_rgba(219,39,119,0.15)] hover:border-pink-200 hover:from-white hover:to-pink-50/20 hover:-translate-y-2 active:scale-98 transition-all duration-300 ease-out flex flex-col items-center justify-center text-center overflow-hidden p-6 cursor-pointer"
                    >
                        <div className="absolute top-0 right-0 w-36 h-36 bg-pink-500/5 rounded-bl-[100%] -mr-10 -mt-10 transition-transform duration-700 ease-out group-hover:scale-150"></div>
                        <div className="absolute bottom-0 left-0 w-24 h-24 bg-pink-500/5 rounded-tr-[100%] -ml-10 -mb-10 transition-transform duration-700 ease-out group-hover:scale-125 opacity-0 group-hover:opacity-100"></div>

                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center mb-4 text-white group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-lg shadow-pink-500/30 ring-4 ring-white">
                            <History className="w-6.5 h-6.5" />
                        </div>

                        <h3 className="text-xl font-extrabold text-slate-800 mb-1.5 group-hover:text-slate-900 tracking-tight uppercase">
                            Dashboard
                        </h3>
                        <p className="text-xs font-bold text-slate-400 group-hover:text-pink-600 transition-colors uppercase tracking-widest leading-relaxed">
                            Análises e Relatórios
                        </p>
                        <p className="text-[10px] text-slate-400 mt-2 max-w-[180px] font-medium leading-normal">
                            Visão gerencial, gráficos de dispensação e análise de demanda futura.
                        </p>
                    </button>
                )}

                {/* Card 5: Pacientes */}
                {canAccessPacientes && (
                    <button
                        onClick={() => onNavigate('farmacia:pacientes')}
                        className="group relative w-full min-h-[200px] rounded-[2.5rem] bg-gradient-to-br from-white to-slate-50 border border-slate-100 shadow-[0_10px_35px_rgba(0,0,0,0.03)] hover:shadow-[0_30px_70px_rgba(219,39,119,0.15)] hover:border-pink-200 hover:from-white hover:to-pink-50/20 hover:-translate-y-2 active:scale-98 transition-all duration-300 ease-out flex flex-col items-center justify-center text-center overflow-hidden p-6 cursor-pointer"
                    >
                        <div className="absolute top-0 right-0 w-36 h-36 bg-pink-500/5 rounded-bl-[100%] -mr-10 -mt-10 transition-transform duration-700 ease-out group-hover:scale-150"></div>
                        <div className="absolute bottom-0 left-0 w-24 h-24 bg-pink-500/5 rounded-tr-[100%] -ml-10 -mb-10 transition-transform duration-700 ease-out group-hover:scale-125 opacity-0 group-hover:opacity-100"></div>

                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center mb-4 text-white group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-lg shadow-pink-500/30 ring-4 ring-white">
                            <Users className="w-6.5 h-6.5" />
                        </div>

                        <h3 className="text-xl font-extrabold text-slate-800 mb-1.5 group-hover:text-slate-900 tracking-tight uppercase">
                            Pacientes
                        </h3>
                        <p className="text-xs font-bold text-slate-400 group-hover:text-pink-600 transition-colors uppercase tracking-widest leading-relaxed">
                            Base Unificada de Pacientes
                        </p>
                        <p className="text-[10px] text-slate-400 mt-2 max-w-[180px] font-medium leading-normal">
                            Visualização, cadastro, edição e histórico unificado de atendimentos.
                        </p>
                    </button>
                )}

                {/* Card 6: Gestor (Acesso por Permissão ou Admin) */}
                {canAccessGestor && (
                    <button
                        onClick={() => onNavigate('farmacia:gestor')}
                        className="group relative w-full min-h-[200px] rounded-[2.5rem] bg-gradient-to-br from-white to-slate-50 border border-slate-100 shadow-[0_10px_35px_rgba(0,0,0,0.03)] hover:shadow-[0_30px_70px_rgba(99,102,241,0.15)] hover:border-indigo-200 hover:from-white hover:to-indigo-50/20 hover:-translate-y-2 active:scale-98 transition-all duration-300 ease-out flex flex-col items-center justify-center text-center overflow-hidden p-6 cursor-pointer"
                    >
                        <div className="absolute top-3 right-4 px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-[9px] font-black uppercase tracking-wider">
                            GESTOR
                        </div>

                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mb-4 text-white group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-lg shadow-indigo-500/30 ring-4 ring-white">
                            <ShieldCheck className="w-6.5 h-6.5" />
                        </div>

                        <h3 className="text-xl font-extrabold text-slate-800 mb-1.5 group-hover:text-slate-900 tracking-tight uppercase">
                            Gestor
                        </h3>
                        <p className="text-xs font-bold text-slate-400 group-hover:text-indigo-600 transition-colors uppercase tracking-widest leading-relaxed">
                            Controle de Permissões
                        </p>
                        <p className="text-[10px] text-slate-400 mt-2 max-w-[180px] font-medium leading-normal">
                            Gerenciamento individual de permissões do módulo.
                        </p>
                    </button>
                )}
            </div>
        </div>
    );
};
