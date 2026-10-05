import React, { useState, useEffect, useRef } from 'react';
import { 
  AssistedMouseMovePayload, 
  AssistedClickPayload,
  resolveElementRelativePosition 
} from '../services/assistedSessionService';

interface AssistedVirtualCursorOverlayProps {
  userCursor: AssistedMouseMovePayload | null;
  userLastClick?: AssistedClickPayload | null;
  targetUserName: string;
  role?: 'user' | 'admin';
}

interface ActiveRipple {
  id: string;
  pixelX: number;
  pixelY: number;
  isTouch?: boolean;
}

export const AssistedVirtualCursorOverlay: React.FC<AssistedVirtualCursorOverlayProps> = ({
  userCursor,
  userLastClick,
  targetUserName,
  role = 'user'
}) => {
  const [ripples, setRipples] = useState<ActiveRipple[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);

  const cursorNodeRef = useRef<HTMLDivElement | null>(null);
  const latestCursorRef = useRef<AssistedMouseMovePayload | null>(null);
  const currentPosRef = useRef<{ x: number; y: number; initialized: boolean }>({ x: 0, y: 0, initialized: false });
  const rafIdRef = useRef<number | null>(null);

  const isAdmin = role === 'admin' || userCursor?.source === 'admin';

  // Monitora movimentos e gerencia visibilidade sem acumular eventos antigos
  useEffect(() => {
    if (!userCursor) {
      latestCursorRef.current = null;
      setIsVisible(false);
      return;
    }

    latestCursorRef.current = userCursor;
    setIsVisible(true);

    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
    }

    // Oculta suavemente após 8 segundos de inatividade
    hideTimerRef.current = setTimeout(() => {
      setIsVisible(false);
    }, 8000);

    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [userCursor?.timestamp, userCursor?.eventId]);

  // Loop de atualização visual fluida via requestAnimationFrame (60-120 FPS com LERP)
  useEffect(() => {
    let active = true;

    const renderFrame = () => {
      if (!active) return;

      const payload = latestCursorRef.current;
      if (payload && cursorNodeRef.current) {
        // Reconstrói a posição matemática exata no elemento DOM
        const { pixelX: targetX, pixelY: targetY } = resolveElementRelativePosition(payload);

        if (!currentPosRef.current.initialized) {
          currentPosRef.current.x = targetX;
          currentPosRef.current.y = targetY;
          currentPosRef.current.initialized = true;
        } else {
          const dx = targetX - currentPosRef.current.x;
          const dy = targetY - currentPosRef.current.y;
          const dist = Math.hypot(dx, dy);

          // Se a distância for imperceptível, atinge o destino exato
          if (dist < 0.25) {
            currentPosRef.current.x = targetX;
            currentPosRef.current.y = targetY;
          } else if (dist > 500) {
            // Salto brusco (troca de aba/seção)
            currentPosRef.current.x = targetX;
            currentPosRef.current.y = targetY;
          } else {
            // Interpolação suave entre posições reais
            currentPosRef.current.x += dx * 0.42;
            currentPosRef.current.y += dy * 0.42;
          }
        }

        cursorNodeRef.current.style.transform = `translate3d(${currentPosRef.current.x}px, ${currentPosRef.current.y}px, 0)`;
      }

      rafIdRef.current = requestAnimationFrame(renderFrame);
    };

    rafIdRef.current = requestAnimationFrame(renderFrame);

    return () => {
      active = false;
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, []);

  // Renderiza efeito visual de pulso / onda de radar (apontamento efêmero de 400ms)
  useEffect(() => {
    if (!userLastClick) return;

    // Resolve a posição exata do clique em pixels no viewport
    const clickPos = resolveElementRelativePosition(userLastClick);
    const rippleId = userLastClick.eventId || `clk_${Date.now()}_${Math.random()}`;

    const newRipple: ActiveRipple = {
      id: rippleId,
      pixelX: clickPos.pixelX,
      pixelY: clickPos.pixelY,
      isTouch: userLastClick.isTouch
    };

    setRipples((prev) => [...prev.filter(r => r.id !== rippleId).slice(-3), newRipple]);

    // Destruição automática e rigorosa após 400ms (duração efêmera)
    const timer = setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== rippleId));
    }, 400);

    return () => clearTimeout(timer);
  }, [userLastClick?.eventId, userLastClick?.timestamp]);

  const rawName = userCursor?.userName || targetUserName || (isAdmin ? 'Administrador' : 'Usuário');
  const displayName = rawName.split(' ')[0] || rawName;

  return (
    <div 
      className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden select-none"
      aria-hidden="true"
    >
      {/* 1. CURSOR VIRTUAL (APONTADOR VISUAL 100% FIEL AO ELEMENTO EM VIEWPORT) */}
      <div
        ref={cursorNodeRef}
        data-assisted-cursor="true"
        className="fixed top-0 left-0 pointer-events-none will-change-transform"
        style={{
          display: (userCursor && isVisible) ? 'block' : 'none'
        }}
      >
        {userCursor?.isTouch ? (
          /* INDICADOR TOUCH / MOBILE */
          <div className="relative -translate-x-1/2 -translate-y-1/2">
            <div className={`w-8 h-8 rounded-full border-2 ${isAdmin ? 'border-indigo-400 bg-indigo-500/25 shadow-indigo-500/30' : 'border-cyan-400 bg-cyan-500/20 shadow-cyan-500/30'} animate-pulse flex items-center justify-center shadow-lg`}>
              <div className={`w-2.5 h-2.5 rounded-full ${isAdmin ? 'bg-indigo-400' : 'bg-cyan-400'}`} />
            </div>
            <div className={`absolute left-1/2 top-full mt-1.5 -translate-x-1/2 whitespace-nowrap bg-slate-950/95 backdrop-blur-md ${isAdmin ? 'text-indigo-200 border-indigo-400/50' : 'text-cyan-200 border-cyan-400/40'} text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-xl border flex items-center gap-1`}>
              <span className={isAdmin ? 'text-indigo-400' : 'text-cyan-400'}>➤</span>
              <span>{displayName}</span>
            </div>
          </div>
        ) : (
          /* CURSOR DESKTOP COM PONTEIRO ESTILIZADO E ETIQUETA */
          <div className="relative -translate-x-[5.5px] -translate-y-[3px]">
            <svg
              className={`w-6 h-6 ${isAdmin ? 'text-indigo-500' : 'text-cyan-500'} drop-shadow-[0_2px_10px_rgba(0,0,0,0.7)]`}
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

            {/* Etiqueta com o Nome: ➤ [Nome] */}
            <div className={`absolute left-4 top-4 whitespace-nowrap bg-gradient-to-r ${isAdmin ? 'from-slate-950 via-indigo-950 to-slate-950 border-indigo-400/50' : 'from-slate-950 via-cyan-950 to-slate-950 border-cyan-400/50'} text-white text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-2xl border flex items-center gap-1 animate-in fade-in zoom-in-90`}>
              <span className={`${isAdmin ? 'text-indigo-300' : 'text-cyan-300'} font-extrabold text-[11px]`}>➤</span>
              <span className={`${isAdmin ? 'text-indigo-100' : 'text-cyan-100'} font-bold`}>{displayName}</span>
            </div>
          </div>
        )}
      </div>

      {/* 2. RIPPLES DE APONTAMENTO / PULSO EFÊMERO (400ms) EM VIEWPORT */}
      {ripples.map((ripple) => (
        <div
          key={ripple.id}
          className="fixed top-0 left-0 pointer-events-none"
          style={{
            transform: `translate3d(${ripple.pixelX}px, ${ripple.pixelY}px, 0)`
          }}
        >
          <div className="relative -translate-x-1/2 -translate-y-1/2">
            <span className={`block w-10 h-10 rounded-full border-2 ${isAdmin ? 'border-indigo-400 bg-indigo-500/30' : 'border-cyan-400 bg-cyan-500/30'} animate-ping opacity-90`} />
            <span className={`absolute inset-0 block w-5 h-5 m-auto rounded-full border ${isAdmin ? 'border-indigo-300 bg-indigo-400/50' : 'border-cyan-300 bg-cyan-400/50'} animate-pulse`} />
          </div>
        </div>
      ))}
    </div>
  );
};
