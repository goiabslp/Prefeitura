import React, { useState, useEffect, useRef } from 'react';
import { User } from '../../types';
import { ChevronUp } from 'lucide-react';

interface DynamicGlobalFooterProps {
  currentUser: User | null;
  currentView?: string;
  activeBlock?: string | null;
  onNavigatePolicy: (type: 'web' | 'app') => void;
  onOpenEgressModal: () => void;
}

export const DynamicGlobalFooter: React.FC<DynamicGlobalFooterProps> = ({
  currentUser,
  currentView,
  activeBlock,
  onNavigatePolicy,
  onOpenEgressModal,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const isVisibleRef = useRef(false);
  isVisibleRef.current = isVisible;

  // Só deve ser exibido estritamente na Página Inicial (/PaginaInicial ou /)
  const isHomePage = (() => {
    if (currentView !== 'home' || !!activeBlock) return false;
    if (typeof window !== 'undefined') {
      const path = window.location.pathname.replace(/\/$/, '').toLowerCase();
      return path === '' || path === '/paginainicial';
    }
    return true;
  })();

  // Reseta a visibilidade imediatamente ao mudar de tela ou aba
  useEffect(() => {
    setIsVisible(false);
  }, [currentView, activeBlock, isHomePage]);

  useEffect(() => {
    if (!isHomePage) return;

    // Garante que containers de rolagem tenham espaçamento inferior para forçar a rolagem
    const enforceScrollPadding = () => {
      const scrollContainers = document.querySelectorAll('.overflow-y-auto, [data-scroll-container="true"]');
      scrollContainers.forEach((el) => {
        const htmlEl = el as HTMLElement;
        if (!htmlEl.dataset.footerSpaced) {
          htmlEl.dataset.footerSpaced = 'true';
          htmlEl.classList.add('pb-28');
        }
      });
    };

    enforceScrollPadding();
    const interval = setInterval(enforceScrollPadding, 2000);

    const checkScrollPosition = (target: HTMLElement | Window | Document) => {
      let scrollHeight = 0;
      let scrollTop = 0;
      let clientHeight = 0;

      if (target === window || target === document || (target as any) === document.documentElement || (target as any) === document.body) {
        scrollHeight = Math.max(
          document.body.scrollHeight,
          document.documentElement.scrollHeight
        );
        scrollTop = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop;
        clientHeight = window.innerHeight;
      } else {
        const el = target as HTMLElement;
        scrollHeight = el.scrollHeight;
        scrollTop = el.scrollTop;
        clientHeight = el.clientHeight;
      }

      // Só exibe o footer se houver rolagem real e o usuário tiver chegado ao fim da página
      if (scrollHeight > clientHeight + 15) {
        const distanceToBottom = scrollHeight - (scrollTop + clientHeight);

        // Tolerância de 30px do final absoluto da rolagem
        if (distanceToBottom <= 30) {
          if (!isVisibleRef.current) setIsVisible(true);
        } else if (distanceToBottom > 75) {
          if (isVisibleRef.current) setIsVisible(false);
        }
      } else {
        // Se a página não tiver rolagem suficiente, não exibe
        if (isVisibleRef.current) setIsVisible(false);
      }
    };

    const handleScrollCapture = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target) {
        checkScrollPosition(target);
      }
    };

    const handleWindowScroll = () => {
      checkScrollPosition(window);
    };

    // Detecção ativa via Wheel: usuário forçando rolagem para baixo no final
    const handleWheel = (e: WheelEvent) => {
      if (e.deltaY > 10) {
        let el = e.target as HTMLElement | null;
        while (el && el !== document.body) {
          if (el.scrollHeight > el.clientHeight + 10) {
            const distanceToBottom = el.scrollHeight - (el.scrollTop + el.clientHeight);
            if (distanceToBottom <= 35) {
              setIsVisible(true);
              return;
            }
          }
          el = el.parentElement;
        }
        // Verifica também window/document
        const docScrollHeight = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
        const docScrollTop = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop;
        if (docScrollHeight - (docScrollTop + window.innerHeight) <= 35) {
          setIsVisible(true);
        }
      } else if (e.deltaY < -10) {
        // Rolou para cima: esconde o rodapé imediatamente
        if (isVisibleRef.current) {
          setIsVisible(false);
        }
      }
    };

    window.addEventListener('scroll', handleScrollCapture, { capture: true, passive: true });
    window.addEventListener('scroll', handleWindowScroll, { passive: true });
    window.addEventListener('wheel', handleWheel, { passive: true });

    return () => {
      clearInterval(interval);
      window.removeEventListener('scroll', handleScrollCapture, { capture: true });
      window.removeEventListener('scroll', handleWindowScroll);
      window.removeEventListener('wheel', handleWheel);
    };
  }, [isHomePage]);

  if (!currentUser || !isHomePage) return null;

  return (
    <div
      className={`fixed bottom-0 left-0 w-full z-40 transition-all duration-500 ease-in-out transform ${
        isVisible
          ? 'translate-y-0 opacity-100 pointer-events-auto shadow-[0_-10px_30px_rgba(0,0,0,0.35)]'
          : 'translate-y-full opacity-0 pointer-events-none'
      }`}
      style={{ willChange: 'transform, opacity' }}
    >
      <footer className="w-full bg-slate-900/95 backdrop-blur-md text-slate-400 py-2.5 px-6 border-t border-slate-800/90 text-[11px] flex flex-col sm:flex-row items-center justify-between gap-2 print:hidden">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/90 animate-pulse shrink-0"></span>
          <p>© 2026 Prefeitura Municipal de São José do Goiabal - MG. Todos os direitos reservados.</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onNavigatePolicy('web')}
            className="text-slate-400 hover:text-white transition-colors underline cursor-pointer bg-transparent border-0 p-0 text-[11px]"
          >
            Política de Privacidade
          </button>
          <span className="text-slate-700">•</span>
          <button
            type="button"
            onClick={() => onNavigatePolicy('app')}
            className="text-slate-400 hover:text-white transition-colors underline cursor-pointer bg-transparent border-0 p-0 text-[11px]"
          >
            Política do Aplicativo
          </button>

          {(currentUser.role === 'admin' || (currentUser as any).role === 'master') && (
            <>
              <span className="text-slate-700">•</span>
              <button
                type="button"
                onClick={onOpenEgressModal}
                className="text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1.5 font-bold cursor-pointer hover:bg-emerald-950/40 px-2.5 py-1 rounded-lg border border-emerald-500/30 text-[11px]"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                Monitor de Egress
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setIsVisible(false)}
            title="Recolher rodapé"
            className="text-slate-500 hover:text-slate-300 p-1 hover:bg-slate-800/80 rounded-md transition-colors ml-1"
          >
            <ChevronUp className="w-3.5 h-3.5 rotate-180" />
          </button>
        </div>
      </footer>
    </div>
  );
};
