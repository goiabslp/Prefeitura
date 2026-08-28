import React from 'react';
import { User } from '../../types';
import { Search, ClipboardList, Package, Settings, History, Pill, Users } from 'lucide-react';
import { useSystemSettings } from '../../contexts/SystemSettingsContext';

interface FarmaciaDashboardProps {
    currentUser: User | null;
    onNavigate: (view: string) => void;
}

export const FarmaciaDashboard: React.FC<FarmaciaDashboardProps> = ({
    currentUser,
    onNavigate
}) => {
    const { moduleStatus } = useSystemSettings();
    const isConsultarActive = moduleStatus['parent_farmacia_consultar'] !== false;
    const isRetirarActive = moduleStatus['parent_farmacia_retirar'] !== false;
    const isEstoqueActive = moduleStatus['parent_farmacia_estoque'] !== false;
    const isDashboardActive = moduleStatus['parent_farmacia_dashboard'] !== false;
    const isPacientesActive = moduleStatus['parent_farmacia_pacientes'] !== false;

    const userPerms = currentUser?.permissions || [];
    const isAdmin = currentUser?.role === 'admin';
    const canAccessConsultar = (isAdmin || userPerms.includes('parent_farmacia_consultar')) && isConsultarActive;
    const canAccessRetirar = (isAdmin || userPerms.includes('parent_farmacia_retirar')) && isRetirarActive;
    const canAccessEstoque = (isAdmin || userPerms.includes('parent_farmacia_estoque')) && isEstoqueActive;
    const canAccessHistorico = isAdmin || userPerms.includes('parent_farmacia');
    const canAccessDados = (isAdmin || userPerms.includes('parent_farmacia_dashboard')) && isDashboardActive;
    const canAccessPacientes = (isAdmin || userPerms.includes('parent_farmacia_pacientes')) && isPacientesActive;

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
            </div>
        </div>
    );
};
