import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, Sparkles, Plus, Shield, Layers, History, Sliders,
  Image as ImageIcon, CheckCircle2, ChevronRight, Star, Palette, Download
} from 'lucide-react';
import { ArtPublication, ArtLogoItem, ArtReferenceItem } from '../../types';
import { artStudioService } from '../../services/artStudioService';

interface ArtStudioHubProps {
  onBack: () => void;
  onNavigate: (route: string) => void;
  onSelectPublication?: (pubId: string) => void;
}

export const ArtStudioHub: React.FC<ArtStudioHubProps> = ({
  onBack,
  onNavigate,
  onSelectPublication
}) => {
  const [defaultLogo, setDefaultLogo] = useState<ArtLogoItem | null>(null);
  const [referencesCount, setReferencesCount] = useState<number>(0);
  const [recentPublications, setRecentPublications] = useState<ArtPublication[]>([]);

  useEffect(() => {
    setDefaultLogo(artStudioService.getDefaultLogo());
    setReferencesCount(artStudioService.getReferences().length);
    setRecentPublications(artStudioService.getPublications().slice(0, 4));

    artStudioService.loadPublicationsAsync().then((asyncPubs) => {
      if (asyncPubs && asyncPubs.length > 0) {
        setRecentPublications(asyncPubs.slice(0, 4));
      }
    }).catch(() => {});
  }, []);

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] w-full overflow-hidden font-sans">
      {/* Barra de Navegação Superior com ROTA URL /Art */}
      <header className="shrink-0 bg-white border-b border-slate-200 px-6 md:px-8 py-3.5 flex items-center justify-between z-30 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            type="button"
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-900 hover:text-white transition-all active:scale-95 border border-slate-200/60 cursor-pointer text-xs font-bold group"
            title="Voltar ao Painel Principal"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
            <span>Voltar ao Painel</span>
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-lg border border-indigo-100">
                /Art
              </span>
            </div>
            <h1 className="text-lg md:text-xl font-black text-slate-900 tracking-tight mt-0.5">
              Módulo Art — Estúdio Inteligente de Artes
            </h1>
          </div>
        </div>
      </header>

      {/* Conteúdo Principal com o Modelo de Design Padrão dos Módulos */}
      <main className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8 flex flex-col items-center justify-center">
        <div className="w-full max-w-6xl mx-auto flex flex-col items-center my-auto py-4">

          {/* Cabeçalho Centralizado com Ícone Temático */}
          <div className="flex flex-col items-center mb-8 md:mb-12 shrink-0 animate-in fade-in slide-in-from-bottom-4 duration-500 text-center">
            <div className="p-4 rounded-[1.8rem] bg-gradient-to-br from-indigo-50 to-indigo-100/50 mb-3.5 shadow-sm ring-6 ring-white/50">
              <Palette className="w-10 h-10 text-indigo-600 drop-shadow-sm" />
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight text-center drop-shadow-sm uppercase">
              Estúdio de Artes
            </h2>
            <p className="text-slate-500 text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] mt-1 text-center">
              Criação Inteligente de Peças Gráficas Institucionais
            </p>
          </div>

          {/* Grade de 4 Cards Padronizados (Design System dos Outros Módulos) */}
          <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 animate-in zoom-in duration-500">

            {/* Card 1: Criar Publicação */}
            <button
              type="button"
              onClick={() => onNavigate('/Art/Criar')}
              className="group relative w-full min-h-[190px] md:min-h-[220px] rounded-[2.5rem] bg-gradient-to-br from-white to-slate-50/50 border border-slate-100 shadow-[0_10px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_25px_60px_rgb(0,0,0,0.12)] hover:shadow-indigo-500/30 hover:border-indigo-200 hover:from-white hover:to-indigo-50/30 transition-all duration-300 ease-spring hover:-translate-y-2 active:scale-95 flex flex-col items-center justify-center p-6 overflow-hidden text-center cursor-pointer"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-bl-[100%] -mr-10 -mt-10 transition-transform duration-700 ease-out group-hover:scale-150"></div>
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-indigo-500/5 rounded-tr-[100%] -ml-10 -mb-10 transition-transform duration-700 ease-out group-hover:scale-125 opacity-0 group-hover:opacity-100"></div>

              <div className="relative w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center mb-3.5 text-white group-hover:scale-110 group-hover:rotate-6 transition-transform duration-300 shadow-lg shadow-indigo-500/30 ring-4 ring-white">
                <Sparkles className="w-7 h-7 drop-shadow-md" />
              </div>

              <h3 className="text-xl md:text-2xl font-bold text-slate-800 mb-1 group-hover:text-slate-900 tracking-tight">
                Criar Publicação
              </h3>
              <p className="text-[10px] md:text-xs font-bold text-slate-400 group-hover:text-indigo-600 transition-colors uppercase tracking-widest">
                Feed & Stories com IA
              </p>
              <span className="text-[11px] text-slate-400 mt-2 font-medium">
                3 Variações Originais
              </span>
            </button>

            {/* Card 2: Logos da Prefeitura */}
            <button
              type="button"
              onClick={() => onNavigate('/Art/Logos')}
              className="group relative w-full min-h-[190px] md:min-h-[220px] rounded-[2.5rem] bg-gradient-to-br from-white to-slate-50/50 border border-slate-100 shadow-[0_10px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_25px_60px_rgb(0,0,0,0.12)] hover:shadow-amber-500/30 hover:border-amber-200 hover:from-white hover:to-amber-50/30 transition-all duration-300 ease-spring hover:-translate-y-2 active:scale-95 flex flex-col items-center justify-center p-6 overflow-hidden text-center cursor-pointer"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-bl-[100%] -mr-10 -mt-10 transition-transform duration-700 ease-out group-hover:scale-150"></div>
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-amber-500/5 rounded-tr-[100%] -ml-10 -mb-10 transition-transform duration-700 ease-out group-hover:scale-125 opacity-0 group-hover:opacity-100"></div>

              <div className="relative w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center mb-3.5 text-white group-hover:scale-110 group-hover:rotate-6 transition-transform duration-300 shadow-lg shadow-amber-500/30 ring-4 ring-white">
                <Shield className="w-7 h-7 drop-shadow-md" />
              </div>

              <h3 className="text-xl md:text-2xl font-bold text-slate-800 mb-1 group-hover:text-slate-900 tracking-tight">
                Logos da Prefeitura
              </h3>
              <p className="text-[10px] md:text-xs font-bold text-slate-400 group-hover:text-amber-600 transition-colors uppercase tracking-widest">
                Identidade Institucional
              </p>
              <span className="text-[11px] text-slate-400 mt-2 font-medium truncate max-w-[200px]" title={defaultLogo?.name}>
                {defaultLogo ? 'Logo Ativa Definida' : 'Gerenciar Logos'}
              </span>
            </button>

            {/* Card 3: Imagens de Referência */}
            <button
              type="button"
              onClick={() => onNavigate('/Art/Referencias')}
              className="group relative w-full min-h-[190px] md:min-h-[220px] rounded-[2.5rem] bg-gradient-to-br from-white to-slate-50/50 border border-slate-100 shadow-[0_10px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_25px_60px_rgb(0,0,0,0.12)] hover:shadow-teal-500/30 hover:border-teal-200 hover:from-white hover:to-teal-50/30 transition-all duration-300 ease-spring hover:-translate-y-2 active:scale-95 flex flex-col items-center justify-center p-6 overflow-hidden text-center cursor-pointer"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/5 rounded-bl-[100%] -mr-10 -mt-10 transition-transform duration-700 ease-out group-hover:scale-150"></div>
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-teal-500/5 rounded-tr-[100%] -ml-10 -mb-10 transition-transform duration-700 ease-out group-hover:scale-125 opacity-0 group-hover:opacity-100"></div>

              <div className="relative w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center mb-3.5 text-white group-hover:scale-110 group-hover:rotate-6 transition-transform duration-300 shadow-lg shadow-teal-500/30 ring-4 ring-white">
                <Layers className="w-7 h-7 drop-shadow-md" />
              </div>

              <h3 className="text-xl md:text-2xl font-bold text-slate-800 mb-1 group-hover:text-slate-900 tracking-tight">
                Referências
              </h3>
              <p className="text-[10px] md:text-xs font-bold text-slate-400 group-hover:text-teal-600 transition-colors uppercase tracking-widest">
                Direção Artística
              </p>
              <span className="text-[11px] text-slate-400 mt-2 font-medium">
                {referencesCount} de 9 ativas
              </span>
            </button>

            {/* Card 4: Histórico */}
            <button
              type="button"
              onClick={() => onNavigate('/Art/Historico')}
              className="group relative w-full min-h-[190px] md:min-h-[220px] rounded-[2.5rem] bg-gradient-to-br from-white to-slate-50/50 border border-slate-100 shadow-[0_10px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_25px_60px_rgb(0,0,0,0.12)] hover:shadow-violet-500/30 hover:border-violet-200 hover:from-white hover:to-violet-50/30 transition-all duration-300 ease-spring hover:-translate-y-2 active:scale-95 flex flex-col items-center justify-center p-6 overflow-hidden text-center cursor-pointer"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/5 rounded-bl-[100%] -mr-10 -mt-10 transition-transform duration-700 ease-out group-hover:scale-150"></div>
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-violet-500/5 rounded-tr-[100%] -ml-10 -mb-10 transition-transform duration-700 ease-out group-hover:scale-125 opacity-0 group-hover:opacity-100"></div>

              <div className="relative w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center mb-3.5 text-white group-hover:scale-110 group-hover:rotate-6 transition-transform duration-300 shadow-lg shadow-violet-500/30 ring-4 ring-white">
                <History className="w-7 h-7 drop-shadow-md" />
              </div>

              <h3 className="text-xl md:text-2xl font-bold text-slate-800 mb-1 group-hover:text-slate-900 tracking-tight">
                Histórico
              </h3>
              <p className="text-[10px] md:text-xs font-bold text-slate-400 group-hover:text-violet-600 transition-colors uppercase tracking-widest">
                Publicações Salvas
              </p>
              <span className="text-[11px] text-slate-400 mt-2 font-medium">
                {recentPublications.length} {recentPublications.length === 1 ? 'arte criada' : 'artes criadas'}
              </span>
            </button>

          </div>
        </div>
      </main>
    </div>
  );
};
