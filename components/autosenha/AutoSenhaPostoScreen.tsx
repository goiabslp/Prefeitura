import React from 'react';
import { ArrowLeft, Monitor, Tv, ArrowRight, Shield, HeartPulse, Building2 } from 'lucide-react';
import { AutoSenhaUnidadeId } from '../../types';
import { AUTOSENHA_UNIDADES } from '../../services/autoSenhaService';

interface AutoSenhaPostoScreenProps {
  unidadeId: AutoSenhaUnidadeId;
  onNavigateControle: () => void;
  onNavigateTV: () => void;
  onBack: () => void;
}

export const AutoSenhaPostoScreen: React.FC<AutoSenhaPostoScreenProps> = ({
  unidadeId,
  onNavigateControle,
  onNavigateTV,
  onBack
}) => {
  const unidade = AUTOSENHA_UNIDADES.find(u => u.id === unidadeId)!;

  return (
    <div className="h-[calc(100vh-68px)] max-h-[calc(100vh-68px)] bg-slate-50 text-slate-800 flex flex-col justify-between overflow-hidden">
      {/* CABEÇALHO COMPACTO */}
      <header className="bg-white border-b border-slate-200 shrink-0 z-20 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
              title="Voltar ao AutoSenha"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                  {unidade.sigla}
                </span>
                <span className="text-xs text-slate-400 font-semibold">{unidade.tipo}</span>
              </div>
              <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight leading-tight">
                {unidade.nome}
              </h1>
            </div>
          </div>
        </div>
      </header>

      {/* ÁREA CENTRALIZADA DOS DOIS CARDS: CONTROLE | SENHA TV */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6 w-full flex-1 flex flex-col justify-center items-center min-h-0 overflow-y-auto md:overflow-hidden">
        <div className="text-center mb-5 sm:mb-8 shrink-0">
          <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">
            Selecione o Modo de Operação
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1.5 max-w-md mx-auto leading-relaxed">
            Acesse o painel operacional para emissão e chamada de senhas ou abra a visualização pública para televisores.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6 w-full items-stretch">
          {/* CARD 1: CONTROLE */}
          <div
            onClick={onNavigateControle}
            className="group relative bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-sm hover:shadow-xl hover:border-emerald-500/50 transition-all duration-300 cursor-pointer flex flex-col justify-between hover:-translate-y-1"
          >
            <div>
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-emerald-500 text-white flex items-center justify-center mb-5 shadow-md shadow-emerald-500/25 group-hover:scale-110 transition-transform">
                <Monitor className="w-6 h-6 sm:w-7 sm:h-7" />
              </div>
              <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-emerald-700 block mb-1">
                Operação da Recepção
              </span>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 mb-2">
                Controle
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Central operacional rápida para cadastro de cidadãos, emissão de senhas diárias (Normais e Prioritárias), chamada automática e condução da fila.
              </p>
            </div>

            <div className="mt-6 sm:mt-8 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-black text-emerald-700 uppercase tracking-wider">
              <span>Abrir Controle</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform" />
            </div>
          </div>

          {/* CARD 2: SENHA TV */}
          <div
            onClick={onNavigateTV}
            className="group relative bg-gradient-to-br from-slate-900 to-slate-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl hover:shadow-2xl border border-white/10 transition-all duration-300 cursor-pointer flex flex-col justify-between hover:-translate-y-1"
          >
            <div>
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-teal-400 to-emerald-500 text-slate-950 flex items-center justify-center mb-5 shadow-lg shadow-emerald-500/25 group-hover:scale-110 transition-transform">
                <Tv className="w-6 h-6 sm:w-7 sm:h-7" />
              </div>
              <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-emerald-400 block mb-1">
                Painel Público de Televisão
              </span>
              <h3 className="text-xl sm:text-2xl font-black text-white mb-2">
                Senha TV
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Exibição em tela cheia com alta legibilidade para televisores da sala de espera, animação suave, aviso sonoro curto e sincronização em tempo real.
              </p>
            </div>

            <div className="mt-6 sm:mt-8 pt-4 border-t border-white/10 flex items-center justify-between text-xs font-black text-emerald-400 uppercase tracking-wider">
              <span>Iniciar Senha TV</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform" />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
