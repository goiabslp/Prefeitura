import React from 'react';
import { ArrowLeft, LayoutDashboard, Building2, ArrowRight, Ticket, Activity, Users, ShieldCheck } from 'lucide-react';
import { User } from '../../types';

interface AutoSenhaHomeScreenProps {
  currentUser?: User | null;
  onNavigateDashboard: () => void;
  onNavigatePacientes: () => void;
  onNavigatePSF1: () => void;
  onNavigatePSF2: () => void;
  onNavigateUPA: () => void;
  onBack: () => void;
}

export const AutoSenhaHomeScreen: React.FC<AutoSenhaHomeScreenProps> = ({
  currentUser,
  onNavigateDashboard,
  onNavigatePacientes,
  onNavigatePSF1,
  onNavigatePSF2,
  onNavigateUPA,
  onBack
}) => {
  // Controle de visibilidade por permissão
  const isGestorOrAdmin = currentUser?.role === 'admin' ||
    currentUser?.permissions?.includes('parent_autosenha') ||
    currentUser?.permissions?.includes('sub_autosenha_dashboard') ||
    currentUser?.permissions?.includes('parent_admin');

  const canAccessPacientes = isGestorOrAdmin ||
    currentUser?.permissions?.includes('sub_autosenha_pacientes') ||
    currentUser?.permissions?.includes('sub_regulacao_pacientes') ||
    currentUser?.permissions?.includes('sub_farmacia_pacientes');

  const canAccessPSF1 = isGestorOrAdmin ||
    currentUser?.permissions?.includes('sub_autosenha_psf1_controle') ||
    currentUser?.permissions?.includes('sub_autosenha_psf1_senhatv');

  const canAccessPSF2 = isGestorOrAdmin ||
    currentUser?.permissions?.includes('sub_autosenha_psf2_controle') ||
    currentUser?.permissions?.includes('sub_autosenha_psf2_senhatv');

  const canAccessUPA = isGestorOrAdmin ||
    currentUser?.permissions?.includes('sub_autosenha_upa_controle') ||
    currentUser?.permissions?.includes('sub_autosenha_upa_senhatv');

  return (
    <>
      {/* Botão Voltar Padronizado do Sistema com Rota URL */}
      <button
        type="button"
        onClick={onBack}
        className="fixed top-20 left-4 desktop:top-24 desktop:left-8 z-[999] group flex items-center gap-2 text-slate-500 hover:text-emerald-600 font-bold transition-all p-2 pr-4 rounded-full bg-white/95 backdrop-blur-md border border-slate-200/80 shadow-md hover:shadow-xl hover:bg-white hover:-translate-y-0.5 hover:border-emerald-100 cursor-pointer"
        title="Voltar ao Menu Principal"
      >
        <div className="w-8 h-8 rounded-full bg-slate-50 border border-slate-200/60 flex items-center justify-center group-hover:bg-emerald-50 group-hover:border-emerald-100 transition-colors">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform text-slate-500 group-hover:text-emerald-600" />
        </div>
        <span className="text-[10px] uppercase tracking-widest font-extrabold group-hover:text-emerald-700">Voltar</span>
      </button>

      {/* Estrutura Padronizada Centralizada do Sistema (100% Viewport) */}
      <div className="w-full h-full flex-1 min-w-0 flex flex-col relative animate-fade-in z-0 overflow-y-auto lg:overflow-hidden bg-[#FAFAFA] justify-center items-center p-3 sm:p-5 lg:p-6">
        <div className="w-full my-auto flex flex-col items-center justify-center max-w-[1440px] py-2 sm:py-4">
          {/* Cabeçalho Oficial do Módulo */}
          <div className="flex flex-col items-center mb-5 md:mb-7 shrink-0 text-center animation-delay-100 animate-in fade-in slide-in-from-bottom-3 duration-500">
            <div className="p-3 md:p-3.5 rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100/50 mb-2 shadow-xs ring-4 ring-white/60">
              <Ticket className="w-8 h-8 md:w-9 md:h-9 text-emerald-600 drop-shadow-sm" />
            </div>
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-black text-slate-800 tracking-tight text-center drop-shadow-sm uppercase">
              Central de Filas & Senhas
            </h1>
            <p className="text-[10px] md:text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1 text-center">
              Gestão de Unidades, Emissão e Painéis de Televisão
            </p>
          </div>

          {/* Grade Oficial Padronizada de Cards de Submódulo (100% Responsivo) */}
          <div className="w-full grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5 sm:gap-4 lg:gap-5 items-stretch animate-in zoom-in duration-500 fill-mode-backwards p-1">
            {/* CARD 1: DASHBOARD */}
            {isGestorOrAdmin && (
              <button
                type="button"
                onClick={onNavigateDashboard}
                className="group relative w-full min-h-[155px] md:min-h-[175px] py-5 px-4 rounded-[2rem] bg-gradient-to-br from-white via-white to-slate-50/60 border border-slate-200/80 shadow-[0_4px_20px_rgb(0,0,0,0.03)] hover:shadow-[0_20px_45px_rgba(147,51,234,0.12)] hover:border-purple-200 hover:from-white hover:to-purple-50/20 hover:-translate-y-1.5 active:scale-95 transition-all duration-300 ease-spring flex flex-col items-center justify-between text-center overflow-hidden shrink-0 cursor-pointer"
              >
                {/* Brilhos de fundo nos cantos */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-bl-[100%] -mr-10 -mt-10 transition-transform duration-700 ease-out group-hover:scale-150" />
                <div className="absolute bottom-0 left-0 w-20 h-20 bg-purple-500/5 rounded-tr-[100%] -ml-10 -mb-10 transition-transform duration-700 ease-out group-hover:scale-125 opacity-0 group-hover:opacity-100" />

                {/* Ícone com Ring */}
                <div className="relative w-12 h-12 md:w-13 md:h-13 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center mb-2.5 text-white group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 shadow-md shadow-purple-500/25 ring-4 ring-white shrink-0">
                  <LayoutDashboard className="w-6 h-6" />
                </div>

                {/* Textos */}
                <div className="flex-1 flex flex-col items-center justify-center w-full">
                  <h3 className="text-sm md:text-base font-extrabold text-slate-800 mb-0.5 group-hover:text-slate-900 tracking-tight uppercase text-center">
                    Dashboard
                  </h3>
                  <p className="text-[9px] md:text-[10px] font-bold text-slate-400 group-hover:text-purple-600 transition-colors uppercase tracking-wider text-center line-clamp-2">
                    Gestão Consolidada
                  </p>
                </div>

                {/* Indicador de Ação no Hover */}
                <div className="mt-2.5 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-1.5 group-hover:translate-y-0 text-purple-700 font-extrabold text-[10px] uppercase tracking-widest flex items-center gap-1">
                  <span>Acessar</span>
                  <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </button>
            )}

            {/* CARD 2: PACIENTES */}
            {canAccessPacientes && (
              <button
                type="button"
                onClick={onNavigatePacientes}
                className="group relative w-full min-h-[155px] md:min-h-[175px] py-5 px-4 rounded-[2rem] bg-gradient-to-br from-white via-white to-slate-50/60 border border-slate-200/80 shadow-[0_4px_20px_rgb(0,0,0,0.03)] hover:shadow-[0_20px_45px_rgba(2,132,199,0.12)] hover:border-sky-200 hover:from-white hover:to-sky-50/20 hover:-translate-y-1.5 active:scale-95 transition-all duration-300 ease-spring flex flex-col items-center justify-between text-center overflow-hidden shrink-0 cursor-pointer"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/5 rounded-bl-[100%] -mr-10 -mt-10 transition-transform duration-700 ease-out group-hover:scale-150" />
                <div className="absolute bottom-0 left-0 w-20 h-20 bg-sky-500/5 rounded-tr-[100%] -ml-10 -mb-10 transition-transform duration-700 ease-out group-hover:scale-125 opacity-0 group-hover:opacity-100" />

                <div className="relative w-12 h-12 md:w-13 md:h-13 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center mb-2.5 text-white group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 shadow-md shadow-sky-500/25 ring-4 ring-white shrink-0">
                  <Users className="w-6 h-6" />
                </div>

                <div className="flex-1 flex flex-col items-center justify-center w-full">
                  <h3 className="text-sm md:text-base font-extrabold text-slate-800 mb-0.5 group-hover:text-slate-900 tracking-tight uppercase text-center">
                    Pacientes
                  </h3>
                  <p className="text-[9px] md:text-[10px] font-bold text-slate-400 group-hover:text-sky-600 transition-colors uppercase tracking-wider text-center line-clamp-2">
                    Central Integrada
                  </p>
                </div>

                <div className="mt-2.5 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-1.5 group-hover:translate-y-0 text-sky-700 font-extrabold text-[10px] uppercase tracking-widest flex items-center gap-1">
                  <span>Acessar</span>
                  <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </button>
            )}

            {/* CARD 3: PSF 1 */}
            {canAccessPSF1 && (
              <button
                type="button"
                onClick={onNavigatePSF1}
                className="group relative w-full min-h-[155px] md:min-h-[175px] py-5 px-4 rounded-[2rem] bg-gradient-to-br from-white via-white to-slate-50/60 border border-slate-200/80 shadow-[0_4px_20px_rgb(0,0,0,0.03)] hover:shadow-[0_20px_45px_rgba(16,185,129,0.12)] hover:border-emerald-200 hover:from-white hover:to-emerald-50/20 hover:-translate-y-1.5 active:scale-95 transition-all duration-300 ease-spring flex flex-col items-center justify-between text-center overflow-hidden shrink-0 cursor-pointer"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-bl-[100%] -mr-10 -mt-10 transition-transform duration-700 ease-out group-hover:scale-150" />
                <div className="absolute bottom-0 left-0 w-20 h-20 bg-emerald-500/5 rounded-tr-[100%] -ml-10 -mb-10 transition-transform duration-700 ease-out group-hover:scale-125 opacity-0 group-hover:opacity-100" />

                <div className="relative w-12 h-12 md:w-13 md:h-13 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center mb-2.5 text-white group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 shadow-md shadow-emerald-500/25 ring-4 ring-white shrink-0">
                  <Building2 className="w-6 h-6" />
                </div>

                <div className="flex-1 flex flex-col items-center justify-center w-full">
                  <h3 className="text-sm md:text-base font-extrabold text-slate-800 mb-0.5 group-hover:text-slate-900 tracking-tight uppercase text-center">
                    PSF 1
                  </h3>
                  <p className="text-[9px] md:text-[10px] font-bold text-slate-400 group-hover:text-emerald-600 transition-colors uppercase tracking-wider text-center line-clamp-2">
                    Dr. José Maria
                  </p>
                </div>

                <div className="mt-2.5 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-1.5 group-hover:translate-y-0 text-emerald-700 font-extrabold text-[10px] uppercase tracking-widest flex items-center gap-1">
                  <span>Acessar</span>
                  <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </button>
            )}

            {/* CARD 4: PSF 2 */}
            {canAccessPSF2 && (
              <button
                type="button"
                onClick={onNavigatePSF2}
                className="group relative w-full min-h-[155px] md:min-h-[175px] py-5 px-4 rounded-[2rem] bg-gradient-to-br from-white via-white to-slate-50/60 border border-slate-200/80 shadow-[0_4px_20px_rgb(0,0,0,0.03)] hover:shadow-[0_20px_45px_rgba(20,184,166,0.12)] hover:border-teal-200 hover:from-white hover:to-teal-50/20 hover:-translate-y-1.5 active:scale-95 transition-all duration-300 ease-spring flex flex-col items-center justify-between text-center overflow-hidden shrink-0 cursor-pointer"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/5 rounded-bl-[100%] -mr-10 -mt-10 transition-transform duration-700 ease-out group-hover:scale-150" />
                <div className="absolute bottom-0 left-0 w-20 h-20 bg-teal-500/5 rounded-tr-[100%] -ml-10 -mb-10 transition-transform duration-700 ease-out group-hover:scale-125 opacity-0 group-hover:opacity-100" />

                <div className="relative w-12 h-12 md:w-13 md:h-13 rounded-2xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center mb-2.5 text-white group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 shadow-md shadow-teal-500/25 ring-4 ring-white shrink-0">
                  <Building2 className="w-6 h-6" />
                </div>

                <div className="flex-1 flex flex-col items-center justify-center w-full">
                  <h3 className="text-sm md:text-base font-extrabold text-slate-800 mb-0.5 group-hover:text-slate-900 tracking-tight uppercase text-center">
                    PSF 2
                  </h3>
                  <p className="text-[9px] md:text-[10px] font-bold text-slate-400 group-hover:text-teal-600 transition-colors uppercase tracking-wider text-center line-clamp-2">
                    Maria das Graças
                  </p>
                </div>

                <div className="mt-2.5 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-1.5 group-hover:translate-y-0 text-teal-700 font-extrabold text-[10px] uppercase tracking-widest flex items-center gap-1">
                  <span>Acessar</span>
                  <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </button>
            )}

            {/* CARD 5: UPA */}
            {canAccessUPA && (
              <button
                type="button"
                onClick={onNavigateUPA}
                className="group relative w-full min-h-[155px] md:min-h-[175px] py-5 px-4 rounded-[2rem] bg-gradient-to-br from-white via-white to-slate-50/60 border border-slate-200/80 shadow-[0_4px_20px_rgb(0,0,0,0.03)] hover:shadow-[0_20px_45px_rgba(244,63,94,0.12)] hover:border-rose-200 hover:from-white hover:to-rose-50/20 hover:-translate-y-1.5 active:scale-95 transition-all duration-300 ease-spring flex flex-col items-center justify-between text-center overflow-hidden shrink-0 cursor-pointer"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 rounded-bl-[100%] -mr-10 -mt-10 transition-transform duration-700 ease-out group-hover:scale-150" />
                <div className="absolute bottom-0 left-0 w-20 h-20 bg-rose-500/5 rounded-tr-[100%] -ml-10 -mb-10 transition-transform duration-700 ease-out group-hover:scale-125 opacity-0 group-hover:opacity-100" />

                <div className="relative w-12 h-12 md:w-13 md:h-13 rounded-2xl bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center mb-2.5 text-white group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 shadow-md shadow-rose-500/25 ring-4 ring-white shrink-0">
                  <Activity className="w-6 h-6" />
                </div>

                <div className="flex-1 flex flex-col items-center justify-center w-full">
                  <h3 className="text-sm md:text-base font-extrabold text-slate-800 mb-0.5 group-hover:text-slate-900 tracking-tight uppercase text-center">
                    UPA
                  </h3>
                  <p className="text-[9px] md:text-[10px] font-bold text-slate-400 group-hover:text-rose-600 transition-colors uppercase tracking-wider text-center line-clamp-2">
                    Pronto Atendimento
                  </p>
                </div>

                <div className="mt-2.5 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-1.5 group-hover:translate-y-0 text-rose-700 font-extrabold text-[10px] uppercase tracking-widest flex items-center gap-1">
                  <span>Acessar</span>
                  <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
