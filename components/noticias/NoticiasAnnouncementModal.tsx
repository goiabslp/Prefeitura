import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Sparkles,
  ArrowRight,
  X,
  Star,
  Newspaper,
  CheckCircle2
} from 'lucide-react';

interface NoticiasAnnouncementModalProps {
  userId?: string;
  onConhecerNoticias: () => void;
  onClose?: () => void;
  logoUrl?: string;
}

export const NoticiasAnnouncementModal: React.FC<NoticiasAnnouncementModalProps> = ({
  userId,
  onConhecerNoticias,
  onClose,
  logoUrl
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const storageKey = `prefeitura_noticias_anuncio_v1_${userId || 'guest'}`;

  useEffect(() => {
    try {
      const alreadySeen = localStorage.getItem(storageKey);
      if (!alreadySeen) {
        const timer = setTimeout(() => {
          setIsOpen(true);
        }, 400);
        return () => clearTimeout(timer);
      }
    } catch (e) {
      console.error('Erro ao verificar visualização do anúncio:', e);
    }
  }, [storageKey]);

  const handleDismiss = () => {
    try {
      localStorage.setItem(storageKey, 'true');
    } catch (e) {}
    setIsOpen(false);
    if (onClose) onClose();
  };

  const handleConhecer = () => {
    try {
      localStorage.setItem(storageKey, 'true');
    } catch (e) {}
    setIsOpen(false);
    onConhecerNoticias();
  };

  if (!isOpen) return null;

  const dataHoje = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  }).format(new Date());

  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  return createPortal(
    <div 
      className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-6 bg-slate-950/15 backdrop-blur-[2px] animate-in fade-in duration-300 select-none"
      onClick={handleDismiss}
    >
      
      {/* Container Mais Largo em Formato de Tablóide de Jornal */}
      <div 
        className="relative w-full max-w-2xl sm:max-w-3xl bg-[#fcfbfa] text-slate-900 rounded-2xl sm:rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.35),0_0_0_1px_rgba(0,0,0,0.1)] border-2 sm:border-4 border-[#eae5dc] overflow-hidden flex flex-col font-serif animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Textura sutil de papel jornal */}
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(#00000008_1px,transparent_1px)] [background-size:14px_14px] opacity-40"></div>

        {/* Botão Fechar de Alta Visibilidade */}
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute top-3 right-3 sm:top-4 sm:right-4 z-30 w-8 h-8 rounded-full bg-slate-900/10 hover:bg-slate-900 text-slate-700 hover:text-white transition-all flex items-center justify-center cursor-pointer shadow-xs active:scale-90"
          title="Fechar edição"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-4 sm:p-7 md:p-8 space-y-3.5 sm:space-y-4 relative z-10">

          {/* ================================================================= */}
          {/* 1. MASTHEAD / CABEÇALHO DO JORNAL */}
          {/* ================================================================= */}
          <header className="border-b-2 border-slate-950 pb-2.5 space-y-1.5">
            
            {/* Linha Topo: Selo Extra + Edição */}
            <div className="flex items-center justify-between text-[10px] font-sans font-black uppercase tracking-wider text-slate-600 px-0.5">
              <div className="flex items-center gap-1.5">
                <span className="bg-slate-950 text-white px-1.5 py-0.5 rounded text-[8px] font-black tracking-widest">
                  EXTRA
                </span>
                <span>EDIÇÃO HISTÓRICA DE LANÇAMENTO</span>
              </div>
              <div className="font-mono text-slate-500 text-[10px] pr-8">
                ANO I • Nº 001
              </div>
            </div>

            {/* Nome do Jornal */}
            <div className="text-center pt-0.5">
              <div className="flex items-center justify-center gap-2.5">
                {logoUrl && (
                  <img src={logoUrl} alt="Brasão" className="h-6 sm:h-9 object-contain grayscale contrast-125 shrink-0" />
                )}
                <h1 
                  className="text-2xl sm:text-4xl font-black tracking-tight text-slate-950 uppercase font-serif"
                  style={{ fontFamily: 'Georgia, "Times New Roman", serif', letterSpacing: '-0.02em' }}
                >
                  Gazeta de Goiabal
                </h1>
                {logoUrl && (
                  <img src={logoUrl} alt="Brasão" className="h-6 sm:h-9 object-contain grayscale contrast-125 shrink-0" />
                )}
              </div>
              <p className="text-[10px] sm:text-xs text-slate-600 font-serif italic tracking-wide mt-0.5">
                Órgão Oficial de Imprensa, Comunicação e Transparência Municipal de São José do Goiabal
              </p>
            </div>

            {/* Linha Dupla de Data */}
            <div className="border-t border-b border-slate-950/80 py-1 px-1 flex items-center justify-between text-[9px] sm:text-[11px] font-sans font-bold uppercase tracking-wider text-slate-800">
              <span>SÃO JOSÉ DO GOIABAL - MG</span>
              <span className="font-extrabold text-slate-950">{capitalize(dataHoje)}</span>
              <span>SISTEMA INTEGRADO 2026</span>
            </div>
          </header>

          {/* ================================================================= */}
          {/* 2. MANCHETE PRINCIPAL */}
          {/* ================================================================= */}
          <div className="text-center space-y-1">
            <h2 
              className="text-xl sm:text-3xl font-serif font-black tracking-tight text-slate-950 uppercase leading-snug"
              style={{ letterSpacing: '-0.01em' }}
            >
              PREFEITURA LANÇA NOVO MÓDULO DE NOTÍCIAS
            </h2>
            <p className="text-xs sm:text-base font-serif italic text-slate-700 leading-snug border-y border-slate-200 py-1 max-w-2xl mx-auto">
              “Agora ficou ainda mais fácil acompanhar, redigir com IA e divulgar os acontecimentos oficiais do município.”
            </p>
          </div>

          {/* ================================================================= */}
          {/* 3. CONTEÚDO EDITORIAL EM DESTAQUES HORIZONTAIS */}
          {/* ================================================================= */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 pt-1 font-sans">
            
            {/* Bloco 1: IA & Calendário */}
            <div className="bg-slate-100/70 border border-slate-200/90 rounded-2xl p-3.5 space-y-1.5 transition-colors hover:bg-slate-100">
              <div className="w-7 h-7 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-black text-xs border border-indigo-200">
                ✨
              </div>
              <h4 className="text-xs sm:text-sm font-black text-slate-900 leading-snug">
                Redação com IA
              </h4>
              <p className="text-[11px] sm:text-xs text-slate-600 leading-relaxed font-serif">
                Eventos do <strong>/Calendario</strong> viram reportagens redigidas automaticamente pela inteligência artificial.
              </p>
            </div>

            {/* Bloco 2: Métricas Consolidadas */}
            <div className="bg-slate-100/70 border border-slate-200/90 rounded-2xl p-3.5 space-y-1.5 transition-colors hover:bg-slate-100">
              <div className="w-7 h-7 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-black text-xs border border-emerald-200">
                📊
              </div>
              <h4 className="text-xs sm:text-sm font-black text-slate-900 leading-snug">
                Balanço em Tempo Real
              </h4>
              <p className="text-[11px] sm:text-xs text-slate-600 leading-relaxed font-serif">
                Métricas auditadas de <strong>Saúde</strong>, <strong>Regulação</strong> e <strong>Frotas</strong> consolidadas no jornal.
              </p>
            </div>

            {/* Bloco 3: Exportação Story */}
            <div className="bg-slate-100/70 border border-slate-200/90 rounded-2xl p-3.5 space-y-1.5 transition-colors hover:bg-slate-100">
              <div className="w-7 h-7 rounded-xl bg-pink-50 text-pink-700 flex items-center justify-center font-black text-xs border border-pink-200">
                📱
              </div>
              <h4 className="text-xs sm:text-sm font-black text-slate-900 leading-snug">
                Story em PNG
              </h4>
              <p className="text-[11px] sm:text-xs text-slate-600 leading-relaxed font-serif">
                Baixe matérias diagramadas em alta resolução (1080x1920) para WhatsApp e redes sociais em 1 clique.
              </p>
            </div>

          </div>

          {/* ================================================================= */}
          {/* 4. RODAPÉ DE AÇÃO */}
          {/* ================================================================= */}
          <footer className="border-t-2 border-slate-950 pt-3.5 flex items-center justify-between gap-3 font-sans">
            <button
              type="button"
              onClick={handleDismiss}
              className="text-xs font-bold text-slate-500 hover:text-slate-900 px-3 py-2 rounded-lg hover:bg-slate-200/50 transition-colors cursor-pointer"
            >
              Agora não
            </button>

            <button
              type="button"
              onClick={handleConhecer}
              className="px-6 py-2.5 sm:py-3 bg-slate-950 hover:bg-indigo-950 text-white font-black text-xs sm:text-sm uppercase tracking-wider rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center gap-2 cursor-pointer active:scale-95 group"
            >
              <Sparkles className="w-4 h-4 text-amber-400 group-hover:rotate-12 transition-transform" />
              <span>Conhecer Notícias</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </footer>

        </div>

      </div>

    </div>,
    document.body
  );
};
