import React, { useState, useEffect, useRef } from 'react';
import { 
  ShieldCheck, 
  Pause
} from 'lucide-react';
import { 
  AssistedMouseMovePayload, 
  AssistedClickPayload, 
  AssistedOperationMode,
  resolveElementRelativePosition 
} from '../services/assistedSessionService';

interface AssistedUserViewerOverlayProps {
  adminName: string;
  adminEmail?: string;
  startedAt: string;
  isPaused: boolean;
  mode?: AssistedOperationMode;
  virtualCursor?: AssistedMouseMovePayload | null;
  lastClick?: AssistedClickPayload | null;
}

interface ActiveRipple {
  id: string;
  pixelX: number;
  pixelY: number;
}

export const AssistedUserViewerOverlay: React.FC<AssistedUserViewerOverlayProps> = ({
  adminName,
  adminEmail,
  startedAt,
  isPaused,
  mode = 'observer',
  virtualCursor,
  lastClick
}) => {
  const [clickRipples, setClickRipples] = useState<ActiveRipple[]>([]);
  const [isBannerCollapsed, setIsBannerCollapsed] = useState(false);
  const [isCursorVisible, setIsCursorVisible] = useState(false);

  const cursorNodeRef = useRef<HTMLDivElement | null>(null);
  const latestCursorRef = useRef<AssistedMouseMovePayload | null>(null);
  const currentPosRef = useRef<{ x: number; y: number; initialized: boolean }>({ x: 0, y: 0, initialized: false });
  const rafIdRef = useRef<number | null>(null);
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Mantém a ref sempre com o evento mais recente (descarta automaticamente eventos antigos)
  useEffect(() => {
    if (!virtualCursor || isPaused) {
      latestCursorRef.current = null;
      setIsCursorVisible(false);
      return;
    }

    latestCursorRef.current = virtualCursor;
    setIsCursorVisible(true);

    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      setIsCursorVisible(false);
    }, 8000);

    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [virtualCursor, isPaused]);

  // Loop de renderização visual ultra-fluido via requestAnimationFrame (60-120 FPS com LERP)
  useEffect(() => {
    let active = true;

    const renderFrame = () => {
      if (!active) return;

      const payload = latestCursorRef.current;
      if (payload && cursorNodeRef.current && !isPaused) {
        // Reconstrói a posição exata baseada no elemento DOM + posição relativa
        const { pixelX: targetX, pixelY: targetY } = resolveElementRelativePosition(payload);

        if (!currentPosRef.current.initialized) {
          currentPosRef.current.x = targetX;
          currentPosRef.current.y = targetY;
          currentPosRef.current.initialized = true;
        } else {
          const dx = targetX - currentPosRef.current.x;
          const dy = targetY - currentPosRef.current.y;
          const dist = Math.hypot(dx, dy);

          // Se a distância for muito pequena, atinge o destino final exato sem erro de truncamento
          if (dist < 0.25) {
            currentPosRef.current.x = targetX;
            currentPosRef.current.y = targetY;
          } else if (dist > 500) {
            // Se o cursor saltou para outra seção da tela, reposiciona imediatamente sem arrasto longo
            currentPosRef.current.x = targetX;
            currentPosRef.current.y = targetY;
          } else {
            // Interpolação suave (LERP) a ~42% por frame: resposta ultrarrápida e natural sem lag
            currentPosRef.current.x += dx * 0.42;
            currentPosRef.current.y += dy * 0.42;
          }
        }

        // Posiciona o cursor virtual utilizando coordenadas do viewport com aceleração de GPU
        cursorNodeRef.current.style.transform = `translate3d(${currentPosRef.current.x}px, ${currentPosRef.current.y}px, 0)`;
      }

      rafIdRef.current = requestAnimationFrame(renderFrame);
    };

    rafIdRef.current = requestAnimationFrame(renderFrame);

    return () => {
      active = false;
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, [isPaused]);

  // Renderiza efeito visual de pulso/ripple efêmero (400ms) quando o Administrador clica
  useEffect(() => {
    if (!lastClick || isPaused) return;

    const clickPos = resolveElementRelativePosition(lastClick);
    const rippleId = lastClick.eventId || `clk_admin_${Date.now()}_${Math.random()}`;

    const newRipple: ActiveRipple = {
      id: rippleId,
      pixelX: clickPos.pixelX,
      pixelY: clickPos.pixelY
    };

    setClickRipples((prev) => [...prev.filter(r => r.id !== rippleId).slice(-3), newRipple]);

    // Destruição imediata e estrita após 400ms (duração do efeito visual efêmero)
    const timer = setTimeout(() => {
      setClickRipples((prev) => prev.filter((r) => r.id !== rippleId));
    }, 400);

    return () => clearTimeout(timer);
  }, [lastClick?.eventId, lastClick?.timestamp, isPaused]);

  const displayAdminName = (virtualCursor?.userName || adminName || 'Administrador').split(' ')[0];

  return (
    <>
      {/* 1. BANNER FIXO SUPERIOR DISCRETO & ELEGANTE */}
      <div 
        role="status"
        aria-live="polite"
        className="fixed top-0 left-0 right-0 z-[9990] select-none pointer-events-auto transition-transform duration-300"
      >
        <div className="w-full bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-950 border-b border-indigo-500/40 text-white shadow-2xl px-3 sm:px-6 py-2.5 backdrop-blur-md">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
              <div className="p-1.5 sm:p-2 rounded-xl bg-indigo-500/20 text-cyan-300 border border-indigo-400/30 shrink-0">
                <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400" />
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-black text-xs sm:text-sm text-white tracking-tight truncate">
                    Acompanhamento Assistido em Tempo Real
                  </h4>

                  {!isPaused ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Ao Vivo
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-500/20 text-amber-300 border border-amber-400/30">
                      <Pause className="w-2.5 h-2.5" />
                      Pausado
                    </span>
                  )}

                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                    mode === 'observer'
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/30'
                      : 'bg-violet-500/20 text-violet-300 border-violet-400/30'
                  }`}>
                    {mode === 'observer' ? 'Diagnóstico Ativo (Você pode operar normalmente)' : 'Simulação Assistida'}
                  </span>
                </div>

                {!isBannerCollapsed && (
                  <p className="text-[11px] text-slate-300 mt-0.5 truncate hidden sm:block">
                    Administrador responsável: <strong className="text-cyan-200">{adminName}</strong>
                    {adminEmail ? ` (${adminEmail})` : ''} • Suas ações e telas estão sendo espelhadas para diagnóstico com fidelidade absoluta.
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsBannerCollapsed(!isBannerCollapsed)}
                className="text-[10px] font-bold text-slate-400 hover:text-white px-2 py-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                title={isBannerCollapsed ? 'Expandir detalhes' : 'Recolher detalhes'}
              >
                {isBannerCollapsed ? 'Detalhes' : 'Ocultar'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. CURSOR VIRTUAL DO ADMINISTRADOR (POSIÇÃO EXATA NO ELEMENTO VIA VIEWPORT E GPU) */}
      <div
        ref={cursorNodeRef}
        data-assisted-cursor="true"
        aria-hidden="true"
        className="fixed top-0 left-0 z-[9995] pointer-events-none will-change-transform"
        style={{
          display: (isCursorVisible && !isPaused) ? 'block' : 'none'
        }}
      >
        <div className="relative -translate-x-[5.5px] -translate-y-[3px]">
          <svg
            className="w-6 h-6 text-indigo-500 drop-shadow-[0_2px_10px_rgba(0,0,0,0.7)]"
            viewBox="0 0 24 24"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87c.45 0 .67-.54.35-.85L5.85 2.85a.5.5 0 0 0-.35.36z"
              stroke="white"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
          </svg>

          {/* Etiqueta com o Nome do Administrador: ➤ [Nome] */}
          <div className="absolute left-4 top-4 whitespace-nowrap bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-950 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-2xl border border-indigo-400/50 flex items-center gap-1 animate-in fade-in zoom-in-90">
            <span className="text-indigo-300 font-extrabold text-[11px]">➤</span>
            <span className="text-indigo-100 font-bold">{displayAdminName}</span>
          </div>
        </div>
      </div>

      {/* 3. RIPPLES DE CLIQUE EFÊMEROS (400ms) COM POSICIONAMENTO EM VIEWPORT */}
      {clickRipples.map((ripple) => (
        <div
          key={ripple.id}
          aria-hidden="true"
          className="fixed top-0 left-0 pointer-events-none z-[9996]"
          style={{
            transform: `translate3d(${ripple.pixelX}px, ${ripple.pixelY}px, 0)`
          }}
        >
          <div className="relative -translate-x-1/2 -translate-y-1/2">
            <span className="block w-10 h-10 rounded-full border-2 border-indigo-400 bg-indigo-500/30 animate-ping opacity-90" />
            <span className="absolute inset-0 block w-5 h-5 m-auto rounded-full border border-indigo-300 bg-indigo-400/50 animate-pulse" />
          </div>
        </div>
      ))}
    </>
  );
};
