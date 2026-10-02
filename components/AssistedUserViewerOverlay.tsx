import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Radio, 
  Eye, 
  Pause, 
  Play, 
  Info, 
  MousePointer, 
  Sparkles,
  Lock,
  Activity
} from 'lucide-react';
import { 
  AssistedMouseMovePayload, 
  AssistedClickPayload, 
  AssistedOperationMode 
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

export const AssistedUserViewerOverlay: React.FC<AssistedUserViewerOverlayProps> = ({
  adminName,
  adminEmail,
  startedAt,
  isPaused,
  mode = 'observer',
  virtualCursor,
  lastClick
}) => {
  const [clickRipples, setClickRipples] = useState<Array<{ id: number; x: number; y: number }>>([]);
  const [isBannerCollapsed, setIsBannerCollapsed] = useState(false);

  // Renderiza efeito visual de pulso/ripple quando houver clique do Administrador em modo de simulação
  useEffect(() => {
    if (!lastClick || isPaused) return;

    const newRipple = {
      id: Date.now() + Math.random(),
      x: lastClick.xPct,
      y: lastClick.yPct
    };

    setClickRipples((prev) => [...prev.slice(-4), newRipple]);

    const timer = setTimeout(() => {
      setClickRipples((prev) => prev.filter((r) => r.id !== newRipple.id));
    }, 1200);

    return () => clearTimeout(timer);
  }, [lastClick, isPaused]);

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
                className="text-[10px] font-bold text-slate-400 hover:text-white px-2 py-1 rounded-lg hover:bg-white/10 transition-colors"
                title={isBannerCollapsed ? 'Expandir detalhes' : 'Recolher detalhes'}
              >
                {isBannerCollapsed ? 'Detalhes' : 'Ocultar'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. CURSOR VIRTUAL DO ADMINISTRADOR (QUANDO EM SIMULAÇÃO/DEMONSTRAÇÃO) */}
      {virtualCursor && !isPaused && (
        <div
          className="fixed z-[9995] pointer-events-none transition-all duration-75 ease-out"
          style={{
            left: `${virtualCursor.xPct}%`,
            top: `${virtualCursor.yPct}%`,
            transform: 'translate(-2px, -2px)'
          }}
        >
          <div className="relative">
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
      )}

      {/* 3. ANIMAÇÕES DE RIPPLE PARA CLIQUES DO ADMINISTRADOR */}
      {clickRipples.map((ripple) => (
        <div
          key={ripple.id}
          className="fixed z-[9994] pointer-events-none"
          style={{
            left: `${ripple.x}%`,
            top: `${ripple.y}%`,
            transform: 'translate(-50%, -50%)'
          }}
        >
          <span className="block w-10 h-10 rounded-full border-2 border-indigo-400 bg-indigo-500/30 animate-ping opacity-90" />
        </div>
      ))}
    </>
  );
};
