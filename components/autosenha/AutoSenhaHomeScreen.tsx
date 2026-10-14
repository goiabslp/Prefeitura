import React from 'react';
import { ArrowLeft, LayoutDashboard, Building2, Shield, ArrowRight, Ticket, Activity, Stethoscope } from 'lucide-react';
import { User } from '../../types';

interface AutoSenhaHomeScreenProps {
  currentUser?: User | null;
  onNavigateDashboard: () => void;
  onNavigatePSF1: () => void;
  onNavigatePSF2: () => void;
  onNavigateUPA: () => void;
  onBack: () => void;
}

export const AutoSenhaHomeScreen: React.FC<AutoSenhaHomeScreenProps> = ({
  currentUser,
  onNavigateDashboard,
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
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col pb-16">
      {/* CABEÇALHO */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="p-2 rounded-xl hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
              title="Voltar à Página Inicial"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                  SAÚDE MUNICIPAL
                </span>
                <span className="text-xs text-slate-400 font-semibold">São José do Goiabal — MG</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                AutoSenha — Gestão de Filas & Senhas
              </h1>
            </div>
          </div>
        </div>
      </header>

      {/* ÁREA DOS 4 CARDS PRINCIPAIS */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10 w-full flex-1 flex flex-col justify-center">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Selecione a Unidade de Atendimento
          </h2>
          <p className="text-sm text-slate-500 mt-2 max-w-lg mx-auto">
            Cada posto funciona de forma autônoma e independente. A Administração Municipal possui visão gerencial consolidada.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* CARD 1: DASHBOARD ADMINISTRATIVO */}
          {isGestorOrAdmin && (
            <div
              onClick={onNavigateDashboard}
              className="group relative bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 text-white rounded-3xl p-6 shadow-xl hover:shadow-2xl border border-white/10 transition-all duration-300 cursor-pointer flex flex-col justify-between hover:-translate-y-1.5"
            >
              <div>
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white flex items-center justify-center mb-5 shadow-lg shadow-purple-500/25 group-hover:scale-110 transition-transform">
                  <LayoutDashboard className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-purple-300 block mb-1">
                  Gestão Consolidada
                </span>
                <h3 className="text-xl font-black text-white mb-2">
                  Dashboard
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Monitoramento executivo das três unidades em tempo real, capacidade de atendimento, ritmo e relatórios.
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between text-xs font-black text-purple-300 uppercase tracking-wider">
                <span>Acessar Central</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform" />
              </div>
            </div>
          )}

          {/* CARD 2: PSF 1 */}
          {canAccessPSF1 && (
            <div
              onClick={onNavigatePSF1}
              className="group relative bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xs hover:shadow-xl hover:border-emerald-500/50 transition-all duration-300 cursor-pointer flex flex-col justify-between hover:-translate-y-1.5"
            >
              <div>
                <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center mb-5 shadow-md shadow-emerald-500/25 group-hover:scale-110 transition-transform">
                  <Building2 className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700 block mb-1">
                  Atenção Primária
                </span>
                <h3 className="text-xl font-black text-slate-900 mb-2">
                  PSF 1
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Dr. José Maria de Carvalho. Acesso rápido ao Controle da recepção e Senha TV da unidade.
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-black text-emerald-700 uppercase tracking-wider">
                <span>Abrir PSF 1</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform" />
              </div>
            </div>
          )}

          {/* CARD 3: PSF 2 */}
          {canAccessPSF2 && (
            <div
              onClick={onNavigatePSF2}
              className="group relative bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xs hover:shadow-xl hover:border-emerald-500/50 transition-all duration-300 cursor-pointer flex flex-col justify-between hover:-translate-y-1.5"
            >
              <div>
                <div className="w-12 h-12 rounded-2xl bg-teal-600 text-white flex items-center justify-center mb-5 shadow-md shadow-teal-600/25 group-hover:scale-110 transition-transform">
                  <Building2 className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-teal-700 block mb-1">
                  Atenção Primária
                </span>
                <h3 className="text-xl font-black text-slate-900 mb-2">
                  PSF 2
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Maria das Graças Silva. Central de emissão, fila de espera e transmissão na televisão.
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-black text-teal-700 uppercase tracking-wider">
                <span>Abrir PSF 2</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform" />
              </div>
            </div>
          )}

          {/* CARD 4: UPA */}
          {canAccessUPA && (
            <div
              onClick={onNavigateUPA}
              className="group relative bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xs hover:shadow-xl hover:border-rose-500/50 transition-all duration-300 cursor-pointer flex flex-col justify-between hover:-translate-y-1.5"
            >
              <div>
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-500 to-red-600 text-white flex items-center justify-center mb-5 shadow-md shadow-rose-500/25 group-hover:scale-110 transition-transform">
                  <Activity className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-rose-700 block mb-1">
                  Pronto Atendimento
                </span>
                <h3 className="text-xl font-black text-slate-900 mb-2">
                  UPA
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Recepção Administrativa da UPA e alerta de encaminhamento imediato para avaliação clínica presencial.
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-black text-rose-700 uppercase tracking-wider">
                <span>Abrir UPA</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform" />
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
