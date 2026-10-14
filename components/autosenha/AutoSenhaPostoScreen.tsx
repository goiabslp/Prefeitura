import React from 'react';
import { ArrowLeft, Monitor, Tv, ArrowRight, Building2, Ticket } from 'lucide-react';
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
    <>
      {/* Botão Voltar Padronizado do Sistema com Rota URL */}
      <button
        type="button"
        onClick={onBack}
        className="fixed top-20 left-4 desktop:top-24 desktop:left-8 z-[999] group flex items-center gap-2 text-slate-500 hover:text-emerald-600 font-bold transition-all p-2 pr-4 rounded-full bg-white/95 backdrop-blur-md border border-slate-200/80 shadow-md hover:shadow-xl hover:bg-white hover:-translate-y-0.5 hover:border-emerald-100 cursor-pointer"
        title="Voltar ao AutoSenha"
      >
        <div className="w-8 h-8 rounded-full bg-slate-50 border border-slate-200/60 flex items-center justify-center group-hover:bg-emerald-50 group-hover:border-emerald-100 transition-colors">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform text-slate-500 group-hover:text-emerald-600" />
        </div>
        <span className="text-[10px] uppercase tracking-widest font-extrabold group-hover:text-emerald-700">Voltar</span>
      </button>

      {/* Estrutura Padronizada Centralizada do Sistema */}
      <div className="w-full h-full flex-1 flex flex-col relative animate-fade-in z-0 overflow-y-auto lg:overflow-hidden bg-[#FAFAFA] justify-center items-center p-4 md:p-6 min-h-[calc(100vh-68px)]">
        <div className="w-full my-auto flex flex-col items-center justify-center max-w-4xl py-4 md:py-6">
          {/* Cabeçalho Oficial do Posto */}
          <div className="flex flex-col items-center mb-6 md:mb-8 shrink-0 text-center animation-delay-100 animate-in fade-in slide-in-from-bottom-3 duration-500">
            <div className="p-3 md:p-3.5 rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100/50 mb-2.5 shadow-xs ring-4 ring-white/60">
              <Building2 className="w-8 h-8 md:w-9 md:h-9 text-emerald-600 drop-shadow-sm" />
            </div>
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-black text-slate-800 tracking-tight text-center drop-shadow-sm uppercase">
              {unidade.nome}
            </h1>
            <p className="text-[10px] md:text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1 text-center">
              {unidade.tipo} • Selecione o modo operacional desejado
            </p>
          </div>

          {/* Grade de 2 Cards: Recepção/Controle e Painel Senha TV */}
          <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6 max-w-2xl mx-auto items-stretch animate-in zoom-in duration-500 fill-mode-backwards p-1">
            {/* CARD 1: CONTROLE */}
            <button
              type="button"
              onClick={onNavigateControle}
              className="group relative w-full min-h-[170px] md:min-h-[195px] py-6 px-5 rounded-[2rem] bg-gradient-to-br from-white via-white to-slate-50/60 border border-slate-200/80 shadow-[0_4px_20px_rgb(0,0,0,0.03)] hover:shadow-[0_20px_45px_rgba(16,185,129,0.12)] hover:border-emerald-200 hover:from-white hover:to-emerald-50/20 hover:-translate-y-1.5 active:scale-95 transition-all duration-300 ease-spring flex flex-col items-center justify-between text-center overflow-hidden shrink-0 cursor-pointer"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-bl-[100%] -mr-10 -mt-10 transition-transform duration-700 ease-out group-hover:scale-150" />
              <div className="absolute bottom-0 left-0 w-20 h-20 bg-emerald-500/5 rounded-tr-[100%] -ml-10 -mb-10 transition-transform duration-700 ease-out group-hover:scale-125 opacity-0 group-hover:opacity-100" />

              <div className="relative w-13 h-13 md:w-14 md:h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center mb-3 text-white group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 shadow-md shadow-emerald-500/25 ring-4 ring-white shrink-0">
                <Monitor className="w-7 h-7" />
              </div>

              <div className="flex-1 flex flex-col items-center justify-center w-full">
                <h3 className="text-base md:text-lg font-black text-slate-800 mb-0.5 group-hover:text-slate-900 tracking-tight uppercase text-center">
                  Controle
                </h3>
                <p className="text-[10px] md:text-[11px] font-bold text-slate-400 group-hover:text-emerald-600 transition-colors uppercase tracking-wider text-center">
                  Operação da Recepção
                </p>
                <p className="text-xs text-slate-500 mt-2 line-clamp-2 max-w-xs">
                  Emissão de senhas diárias, chamada de guichê e condução da fila.
                </p>
              </div>

              <div className="mt-3 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-1.5 group-hover:translate-y-0 text-emerald-700 font-extrabold text-[10px] uppercase tracking-widest flex items-center gap-1">
                <span>Abrir Controle</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </button>

            {/* CARD 2: SENHA TV */}
            <button
              type="button"
              onClick={onNavigateTV}
              className="group relative w-full min-h-[170px] md:min-h-[195px] py-6 px-5 rounded-[2rem] bg-gradient-to-br from-white via-white to-slate-50/60 border border-slate-200/80 shadow-[0_4px_20px_rgb(0,0,0,0.03)] hover:shadow-[0_20px_45px_rgba(15,23,42,0.12)] hover:border-slate-300 hover:from-white hover:to-slate-100/40 hover:-translate-y-1.5 active:scale-95 transition-all duration-300 ease-spring flex flex-col items-center justify-between text-center overflow-hidden shrink-0 cursor-pointer"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-slate-900/5 rounded-bl-[100%] -mr-10 -mt-10 transition-transform duration-700 ease-out group-hover:scale-150" />
              <div className="absolute bottom-0 left-0 w-20 h-20 bg-slate-900/5 rounded-tr-[100%] -ml-10 -mb-10 transition-transform duration-700 ease-out group-hover:scale-125 opacity-0 group-hover:opacity-100" />

              <div className="relative w-13 h-13 md:w-14 md:h-14 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-950 flex items-center justify-center mb-3 text-white group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 shadow-md shadow-slate-900/30 ring-4 ring-white shrink-0">
                <Tv className="w-7 h-7 text-emerald-400" />
              </div>

              <div className="flex-1 flex flex-col items-center justify-center w-full">
                <h3 className="text-base md:text-lg font-black text-slate-800 mb-0.5 group-hover:text-slate-900 tracking-tight uppercase text-center">
                  Senha TV
                </h3>
                <p className="text-[10px] md:text-[11px] font-bold text-slate-400 group-hover:text-slate-900 transition-colors uppercase tracking-wider text-center">
                  Painel de Televisão
                </p>
                <p className="text-xs text-slate-500 mt-2 line-clamp-2 max-w-xs">
                  Modo tela cheia com alta legibilidade para televisores da sala de espera.
                </p>
              </div>

              <div className="mt-3 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-1.5 group-hover:translate-y-0 text-slate-900 font-extrabold text-[10px] uppercase tracking-widest flex items-center gap-1">
                <span>Iniciar Painel TV</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
