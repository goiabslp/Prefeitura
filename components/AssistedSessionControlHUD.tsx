import React, { useState, useEffect, useRef } from 'react';
import { 
  Radio, 
  Pause, 
  Play, 
  LogOut, 
  ChevronUp, 
  ChevronDown, 
  Eye, 
  ShieldAlert, 
  Clock, 
  UserCheck, 
  Sparkles,
  Lock
} from 'lucide-react';
import { ImpersonationSession } from '../services/impersonationService';
import { assistedSessionService } from '../services/assistedSessionService';

interface AssistedSessionControlHUDProps {
  session: ImpersonationSession;
  onStop: () => void;
}

export const AssistedSessionControlHUD: React.FC<AssistedSessionControlHUDProps> = ({
  session,
  onStop
}) => {
  const [isPaused, setIsPaused] = useState(assistedSessionService.getIsPaused());
  const [isTargetUserConnected, setIsTargetUserConnected] = useState(assistedSessionService.getIsTargetUserConnected());
  const [isPinnedOpen, setIsPinnedOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isStopping, setIsStopping] = useState(false);

  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Assina alterações de estado da transmissão e presença do usuário assistido
  useEffect(() => {
    const unsub = assistedSessionService.subscribeState((state) => {
      setIsPaused(state.isPaused);
      setIsTargetUserConnected(state.isTargetUserConnected);
    });
    return unsub;
  }, []);

  // Cronômetro da sessão
  useEffect(() => {
    const startMs = new Date(session.startedAt).getTime();
    const interval = setInterval(() => {
      const now = Date.now();
      const diffSecs = Math.max(0, Math.floor((now - startMs) / 1000));
      setElapsedSeconds(diffSecs);
    }, 1000);

    return () => clearInterval(interval);
  }, [session.startedAt]);

  const formatTimer = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleTogglePause = async () => {
    if (isPaused) {
      await assistedSessionService.resumeTransmission();
    } else {
      await assistedSessionService.pauseTransmission();
    }
  };

  const handleEndSession = async () => {
    if (isStopping) return;
    setIsStopping(true);
    try {
      await assistedSessionService.endSession();
      await onStop();
    } catch (err) {
      console.error('[AssistedHUD] Erro ao encerrar sessão:', err);
      setIsStopping(false);
    }
  };

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    // Suave delay para não fechar acidentalmente ao mover rápido
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 350);
  };

  const isOpen = isPinnedOpen || isHovered;

  return (
    <>
      {/* 1. SENSOR INVISÍVEL NO TETO DA TELA (Ao subir o mouse no teto, abre a barra) */}
      <div
        className="fixed top-0 left-0 right-0 h-3 z-[9998] pointer-events-auto bg-transparent"
        onMouseEnter={handleMouseEnter}
      />

      {/* 2. ALÇA / SETINHA FLUTUANTE CENTRALIZADA NO TOPO (Pill Tab) */}
      <div
        className="fixed top-0 left-1/2 -translate-x-1/2 z-[10001] pointer-events-auto select-none"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <button
          type="button"
          onClick={() => setIsPinnedOpen(!isPinnedOpen)}
          className={`flex items-center gap-2 px-3.5 py-1 rounded-b-2xl border-x border-b shadow-xl backdrop-blur-md transition-all duration-300 group cursor-pointer ${
            isOpen
              ? 'bg-amber-600 text-white border-amber-400/50 shadow-amber-900/30'
              : 'bg-slate-950/90 text-amber-200 border-amber-500/40 shadow-black/40 hover:bg-slate-900 hover:text-white hover:py-1.5'
          }`}
          title={isOpen ? 'Clique para recolher a barra de suporte' : 'Clique ou passe o mouse para abrir o Acesso Administrativo'}
        >
          {/* Indicador pulsante */}
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            {!isPaused ? (
              <>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </>
            ) : (
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-400"></span>
            )}
          </span>

          <span className="text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-300" />
            <span className="hidden sm:inline">Acesso Administrativo:</span>
            <span className="font-extrabold truncate max-w-[140px] sm:max-w-[200px] text-white">
              {session.targetUser.name.split(' ')[0]}
            </span>
          </span>

          {/* Cronômetro rápido */}
          <span className="text-[10px] font-mono font-bold bg-black/30 px-1.5 py-0.5 rounded text-amber-200/90">
            {formatTimer(elapsedSeconds)}
          </span>

          {/* Setinha com animação */}
          <div className="text-amber-300 group-hover:scale-110 transition-transform">
            {isOpen ? (
              <ChevronUp className="w-4 h-4 text-white" />
            ) : (
              <ChevronDown className="w-4 h-4 text-amber-300 group-hover:translate-y-0.5 transition-transform" />
            )}
          </div>
        </button>
      </div>

      {/* 3. BARRA COMPLETA DESLIZANTE DO TOPO (Aparece ao subir o mouse ou clicar na setinha) */}
      <header
        aria-label="Barra de Acesso Administrativo e Acompanhamento em Tempo Real"
        className={`fixed top-0 left-0 right-0 z-[10000] select-none transition-all duration-300 ease-out pointer-events-auto ${
          isOpen
            ? 'translate-y-0 opacity-100 shadow-[0_15px_40px_rgba(0,0,0,0.6)]'
            : '-translate-y-full opacity-0 pointer-events-none'
        }`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div className="w-full bg-gradient-to-r from-amber-600 via-amber-500 to-amber-700 text-white px-3 sm:px-6 py-2.5 border-b border-amber-300/40 backdrop-blur-xl">
          <div className="max-w-[1920px] mx-auto flex flex-col lg:flex-row items-center justify-between gap-2.5 sm:gap-3">
            
            {/* LADO ESQUERDO: TAG DE IDENTIFICAÇÃO E DADOS DO USUÁRIO SIMULADO */}
            <div className="flex items-center gap-2.5 flex-wrap justify-center lg:justify-start min-w-0">
              {/* Badge Principal */}
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-black/30 backdrop-blur-md text-amber-100 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider border border-white/20 shadow-inner shrink-0">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-200 animate-pulse" />
                <span>ACESSO ADMINISTRATIVO</span>
              </div>

              {/* Status da Transmissão */}
              <div className="flex items-center gap-1.5 shrink-0">
                {!isPaused ? (
                  <span className="flex items-center gap-1 px-2.5 py-1 bg-emerald-950/70 text-emerald-200 border border-emerald-400/40 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-inner">
                    <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
                    <span>Ao Vivo</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1 px-2.5 py-1 bg-amber-950/80 text-amber-200 border border-amber-400/50 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-inner">
                    <Pause className="w-3 h-3 text-amber-300" />
                    <span>Pausado</span>
                  </span>
                )}

                {/* Presença do Usuário */}
                <span 
                  className={`hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                    isTargetUserConnected 
                      ? 'bg-emerald-500/20 text-emerald-100 border-emerald-400/30' 
                      : 'bg-black/20 text-amber-200/90 border-white/10'
                  }`}
                  title={isTargetUserConnected ? 'Usuário conectado na tela acompanhando' : 'Aguardando o usuário abrir o sistema'}
                >
                  <Eye className="w-3 h-3" />
                  <span>{isTargetUserConnected ? 'Usuário Acompanhando' : 'Aguardando Conexão'}</span>
                </span>
              </div>

              <span className="text-white/60 hidden xl:inline text-sm">•</span>

              {/* Informações do Usuário Alvo */}
              <div className="flex items-center gap-1.5 text-xs sm:text-sm min-w-0">
                <span className="font-medium text-amber-100/90 hidden md:inline text-xs">Visualizando como:</span>
                <span className="font-black text-white bg-white/20 px-2.5 py-0.5 rounded-lg border border-white/30 truncate max-w-[220px] sm:max-w-none shadow-xs">
                  {session.targetUser.name}
                </span>
                <span className="text-amber-200/90 text-xs font-semibold shrink-0">
                  (@{session.targetUser.username})
                </span>

                <div className="hidden sm:flex items-center gap-1 shrink-0 ml-1">
                  <span className="px-2 py-0.5 bg-black/20 text-white text-[10px] font-bold uppercase rounded-md tracking-wider">
                    {session.targetUser.role}
                  </span>
                  {session.targetUser.sector && (
                    <span className="px-2 py-0.5 bg-white/20 text-white text-[10px] font-semibold rounded-md truncate max-w-[120px]">
                      {session.targetUser.sector}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* LADO DIREITO: CRONÔMETRO, PAUSAR, SAIR E RECOLHER */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0 flex-wrap justify-center">
              {/* Cronômetro */}
              <div className="flex items-center gap-1.5 text-xs font-mono font-bold bg-black/25 text-amber-100 px-2.5 py-1 rounded-xl border border-white/20">
                <Clock className="w-3.5 h-3.5 text-amber-300" />
                <span>{formatTimer(elapsedSeconds)}</span>
              </div>

              {/* Identificação do Administrador Real */}
              <span className="hidden 2xl:inline text-[11px] text-amber-100/90 font-medium">
                Admin Real: <strong className="text-white">{session.realAdmin.name}</strong>
              </span>

              {/* Botão Pausar / Retomar Transmissão */}
              <button
                type="button"
                onClick={handleTogglePause}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md active:scale-95 ${
                  !isPaused
                    ? 'bg-black/30 hover:bg-black/40 text-amber-100 border border-white/20'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-400/40'
                }`}
                title={!isPaused ? 'Pausar transmissão em tempo real' : 'Retomar transmissão em tempo real'}
              >
                {!isPaused ? (
                  <>
                    <Pause className="w-3.5 h-3.5 text-amber-300" />
                    <span>Pausar</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 text-emerald-200" />
                    <span>Retomar</span>
                  </>
                )}
              </button>

              {/* Botão Sair do Acesso Administrativo */}
              <button
                type="button"
                onClick={handleEndSession}
                disabled={isStopping}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-amber-50 text-amber-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-md hover:shadow-xl hover:scale-[1.02] active:scale-95 transition-all cursor-pointer border border-white/90 disabled:opacity-50"
                title="Encerrar acompanhamento e retornar para a conta do administrador"
              >
                <LogOut className="w-3.5 h-3.5 text-amber-800" />
                <span>{isStopping ? 'Saindo...' : 'Sair do Acesso'}</span>
              </button>

              {/* Botão para recolher ao teto */}
              <button
                type="button"
                onClick={() => {
                  setIsPinnedOpen(false);
                  setIsHovered(false);
                }}
                className="p-1.5 rounded-xl bg-black/20 hover:bg-black/30 text-amber-200 hover:text-white transition-colors cursor-pointer"
                title="Recolher barra para o teto"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
            </div>

          </div>
        </div>
      </header>
    </>
  );
};
