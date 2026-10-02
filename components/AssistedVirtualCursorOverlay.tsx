import React, { useState, useEffect, useRef } from 'react';
import { AssistedMouseMovePayload, AssistedClickPayload } from '../services/assistedSessionService';

interface AssistedVirtualCursorOverlayProps {
  userCursor: AssistedMouseMovePayload | null;
  userLastClick?: AssistedClickPayload | null;
  targetUserName: string;
}

export const AssistedVirtualCursorOverlay: React.FC<AssistedVirtualCursorOverlayProps> = ({
  userCursor,
  userLastClick,
  targetUserName
}) => {
  const [ripples, setRipples] = useState<Array<{ id: number; x: number; y: number; isTouch?: boolean }>>([]);
  const [isVisible, setIsVisible] = useState(false);
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Monitora movimentos e gerencia auto-hide caso fique inativo
  useEffect(() => {
    if (!userCursor) {
      setIsVisible(false);
      return;
    }

    setIsVisible(true);

    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
    }

    // Oculta suavemente após 10 segundos sem novos movimentos
    hideTimerRef.current = setTimeout(() => {
      setIsVisible(false);
    }, 10000);

    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [userCursor?.xPct, userCursor?.yPct, userCursor?.timestamp]);

  // Renderiza efeito visual de pulso / onda de radar (apontamento) quando o usuário clica ou toca
  useEffect(() => {
    if (!userLastClick) return;

    const newRipple = {
      id: Date.now() + Math.random(),
      x: userLastClick.xPct,
      y: userLastClick.yPct,
      isTouch: userLastClick.isTouch
    };

    setRipples((prev) => [...prev.slice(-4), newRipple]);

    const timer = setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== newRipple.id));
    }, 1400);

    return () => clearTimeout(timer);
  }, [userLastClick?.timestamp, userLastClick?.xPct, userLastClick?.yPct]);

  const displayName = userCursor?.userName || targetUserName.split(' ')[0] || 'Usuário';

  return (
    <div 
      className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden select-none"
      aria-hidden="true"
    >
      {/* 1. CURSOR VIRTUAL DO USUÁRIO (APONTADOR VISUAL) */}
      {userCursor && isVisible && (
        <div
          className="fixed pointer-events-none transition-all duration-75 ease-out"
          style={{
            left: `${userCursor.xPct}%`,
            top: `${userCursor.yPct}%`,
            transform: 'translate(-2px, -2px)'
          }}
        >
          {userCursor.isTouch ? (
            /* INDICADOR TOUCH / MOBILE */
            <div className="relative -translate-x-1/2 -translate-y-1/2">
              <div className="w-8 h-8 rounded-full border-2 border-cyan-400 bg-cyan-500/20 animate-pulse flex items-center justify-center shadow-lg shadow-cyan-500/30">
                <div className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
              </div>
              <div className="absolute left-1/2 top-full mt-1.5 -translate-x-1/2 whitespace-nowrap bg-slate-950/95 backdrop-blur-md text-cyan-200 text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-xl border border-cyan-400/40 flex items-center gap-1">
                <span className="text-cyan-400">➤</span>
                <span>{displayName}</span>
              </div>
            </div>
          ) : (
            /* CURSOR DESKTOP COM PONTEIRO ESTILIZADO E ETIQUETA */
            <div className="relative">
              {/* SVG do ponteiro do mouse */}
              <svg
                className="w-6 h-6 text-cyan-500 drop-shadow-[0_2px_10px_rgba(0,0,0,0.7)]"
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

              {/* Etiqueta com o Nome do Usuário: ➤ [Nome] */}
              <div className="absolute left-4 top-4 whitespace-nowrap bg-gradient-to-r from-slate-950 via-cyan-950 to-slate-950 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-2xl border border-cyan-400/50 flex items-center gap-1 animate-in fade-in zoom-in-90">
                <span className="text-cyan-300 font-extrabold text-[11px]">➤</span>
                <span className="text-cyan-100 font-bold">{displayName}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. RIPPLES DE APONTAMENTO / PULSO QUANDO O USUÁRIO INDICA UM ELEMENTO */}
      {ripples.map((ripple) => (
        <div
          key={ripple.id}
          className="fixed pointer-events-none"
          style={{
            left: `${ripple.x}%`,
            top: `${ripple.y}%`,
            transform: 'translate(-50%, -50%)'
          }}
        >
          <span className="block w-12 h-12 rounded-full border-2 border-cyan-400 bg-cyan-500/25 animate-ping opacity-90" />
          <span className="absolute inset-0 block w-6 h-6 m-auto rounded-full border border-cyan-300 bg-cyan-400/40 animate-pulse" />
        </div>
      ))}
    </div>
  );
};
