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
  Lock,
  RefreshCw,
  MousePointer,
  Sliders,
  CheckCircle2
} from 'lucide-react';
import { ImpersonationSession } from '../services/impersonationService';
import { 
  assistedSessionService, 
  AssistedOperationMode, 
  AssistedSyncStatus 
} from '../services/assistedSessionService';

interface AssistedSessionControlHUDProps {
  session: ImpersonationSession;
  onStop: () => void;
  onRefreshState?: () => void;
}

export const AssistedSessionControlHUD: React.FC<AssistedSessionControlHUDProps> = ({
  session,
  onStop,
  onRefreshState
}) => {
  const [isPaused, setIsPaused] = useState(assistedSessionService.getIsPaused());
  const [isTargetUserConnected, setIsTargetUserConnected] = useState(assistedSessionService.getIsTargetUserConnected());
  const [mode, setMode] = useState<AssistedOperationMode>(assistedSessionService.getMode());
  const [syncStatus, setSyncStatus] = useState<AssistedSyncStatus>(assistedSessionService.getSyncStatus());
  const [isPinnedOpen, setIsPinnedOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isStopping, setIsStopping] = useState(false);
  const [isSyncingManually, setIsSyncingManually] = useState(false);

  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Assina alterações de estado da transmissão e presença do usuário assistido
  useEffect(() => {
    const unsub = assistedSessionService.subscribeState((state) => {
      setIsPaused(state.isPaused);
      setIsTargetUserConnected(state.isTargetUserConnected);
      setMode(state.mode);
      setSyncStatus(state.syncStatus);
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

  const handleToggleMode = async (newMode: AssistedOperationMode) => {
    await assistedSessionService.setMode(newMode);
  };

  const handleManualSync = () => {
    setIsSyncingManually(true);
    assistedSessionService.requestFullState();
    onRefreshState?.();
    setTimeout(() => {
      setIsSyncingManually(false);
    }, 1200);
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
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 350);
  };

  const isOpen = isPinnedOpen || isHovered;

  const getStatusBadge = () => {
    if (isPaused) {
      return (
        <span className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-950/80 text-amber-200 border border-amber-400/50 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-inner">
          <Pause className="w-3 h-3 text-amber-300" />
          <span>Pausado</span>
        </span>
      );
    }
    if (syncStatus === 'syncing' || syncStatus === 'reconnecting' || isSyncingManually) {
      return (
        <span className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/20 text-amber-100 border border-amber-300/40 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-inner animate-pulse">
          <RefreshCw className="w-3 h-3 animate-spin text-amber-300" />
          <span>Sincronizando sessão...</span>
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-950/70 text-emerald-200 border border-emerald-400/40 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-inner">
        <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
        <span>Ao Vivo</span>
      </span>
    );
  };

  return (
    <>
      {/* 1. SENSOR INVISÍVEL NO TETO DA TELA */}
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
          className={`flex items-center gap-2 px-4 py-1.5 rounded-b-2xl border-x border-b shadow-2xl backdrop-blur-md transition-all duration-300 group cursor-pointer ${
            isOpen
              ? 'bg-slate-950 text-white border-indigo-500/50 shadow-indigo-950/40'
              : 'bg-slate-950/95 text-indigo-200 border-indigo-500/40 shadow-black/50 hover:bg-slate-900 hover:text-white'
          }`}
          title={isOpen ? 'Clique para recolher a barra de acompanhamento' : 'Clique ou passe o mouse para abrir o painel de Acompanhamento Assistido'}
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
            <span className="text-cyan-300 font-extrabold">ACOMPANHAMENTO ASSISTIDO:</span>
            <span className="font-extrabold truncate max-w-[140px] sm:max-w-[200px] text-white">
              {session.targetUser.name}
            </span>
          </span>

          {/* Modo Ativo */}
          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md border ${
            mode === 'observer' 
              ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/30' 
              : 'bg-violet-500/20 text-violet-300 border-violet-400/30'
          }`}>
            {mode === 'observer' ? 'Observador' : 'Simulação'}
          </span>

          {/* Cronômetro */}
          <span className="text-[10px] font-mono font-bold bg-black/40 px-1.5 py-0.5 rounded text-indigo-200/90">
            {formatTimer(elapsedSeconds)}
          </span>

          {/* Setinha */}
          <div className="text-indigo-300 group-hover:scale-110 transition-transform">
            {isOpen ? (
              <ChevronUp className="w-4 h-4 text-white" />
            ) : (
              <ChevronDown className="w-4 h-4 text-indigo-300 group-hover:translate-y-0.5 transition-transform" />
            )}
          </div>
        </button>
      </div>

      {/* 3. BARRA COMPLETA DESLIZANTE DO TOPO */}
      <header
        aria-label="Barra de Acompanhamento Assistido e Simulação em Tempo Real"
        className={`fixed top-0 left-0 right-0 z-[10000] select-none transition-all duration-300 ease-out pointer-events-auto ${
          isOpen
            ? 'translate-y-0 opacity-100 shadow-[0_15px_40px_rgba(0,0,0,0.7)]'
            : '-translate-y-full opacity-0 pointer-events-none'
        }`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div className="w-full bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-950 text-white px-3 sm:px-6 py-3 border-b border-indigo-500/40 backdrop-blur-xl">
          <div className="max-w-[1920px] mx-auto flex flex-col lg:flex-row items-center justify-between gap-3">
            
            {/* LADO ESQUERDO: IDENTIFICAÇÃO, MODO E DADOS DO USUÁRIO */}
            <div className="flex items-center gap-3 flex-wrap justify-center lg:justify-start min-w-0">
              
              {/* Badge Principal */}
              <div className="flex items-center gap-2 px-3 py-1 bg-indigo-500/20 backdrop-blur-md text-cyan-300 rounded-xl text-[11px] font-black uppercase tracking-wider border border-indigo-400/30 shadow-inner shrink-0">
                <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                <span>ACOMPANHAMENTO ASSISTIDO</span>
              </div>

              {/* Status da Transmissão */}
              <div className="flex items-center gap-2 shrink-0">
                {getStatusBadge()}

                {/* Presença do Usuário */}
                <span 
                  className={`hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-bold border ${
                    isTargetUserConnected 
                      ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40' 
                      : 'bg-black/30 text-indigo-300/80 border-indigo-500/20'
                  }`}
                  title={isTargetUserConnected ? 'Usuário conectado na estação de trabalho' : 'Aguardando o usuário abrir a aplicação'}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>{isTargetUserConnected ? 'Usuário Conectado' : 'Aguardando Usuário'}</span>
                </span>
              </div>

              {/* SELETOR DE MODO: OBSERVADOR vs SIMULAÇÃO */}
              <div className="flex items-center bg-black/40 p-0.5 rounded-xl border border-white/10 shrink-0">
                <button
                  type="button"
                  onClick={() => handleToggleMode('observer')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                    mode === 'observer'
                      ? 'bg-cyan-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                  title="Modo Observador: Espelha fielmente a tela e ações do usuário acompanhado em tempo real sem interferir acidentalmente."
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Modo Observador</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleMode('simulation')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                    mode === 'simulation'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                  title="Modo Simulação: Permite interagir com o sistema operando sob as permissões EXATAS do usuário acompanhado."
                >
                  <MousePointer className="w-3.5 h-3.5" />
                  <span>Modo Simulação</span>
                </button>
              </div>

              <span className="text-white/40 hidden xl:inline text-sm">•</span>

              {/* Dados do Usuário Alvo */}
              <div className="flex items-center gap-2 text-xs sm:text-sm min-w-0">
                <span className="font-semibold text-slate-400 hidden md:inline text-xs">Usuário:</span>
                <span className="font-black text-white bg-white/10 px-2.5 py-0.5 rounded-lg border border-white/20 truncate max-w-[220px] sm:max-w-none">
                  {session.targetUser.name}
                </span>
                <span className="text-indigo-300 text-xs font-semibold shrink-0">
                  (@{session.targetUser.username})
                </span>

                <div className="hidden sm:flex items-center gap-1 shrink-0 ml-1">
                  <span className="px-2 py-0.5 bg-indigo-500/20 text-cyan-300 border border-indigo-400/30 text-[10px] font-bold uppercase rounded-md tracking-wider">
                    {session.targetUser.role}
                  </span>
                  {session.targetUser.sector && (
                    <span className="px-2 py-0.5 bg-white/10 text-slate-300 text-[10px] font-semibold rounded-md truncate max-w-[140px]">
                      {session.targetUser.sector}
                    </span>
                  )}
                  <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-bold rounded-md">
                    {session.targetUser.permissions?.length || 0} perms
                  </span>
                </div>
              </div>
            </div>

            {/* LADO DIREITO: CONTROLES, PAUSAR, SINCRONIZAR, CRONÔMETRO E SAIR */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0 flex-wrap justify-center">
              
              {/* Cronômetro */}
              <div className="flex items-center gap-1.5 text-xs font-mono font-bold bg-black/40 text-cyan-200 px-2.5 py-1 rounded-xl border border-white/10">
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                <span>{formatTimer(elapsedSeconds)}</span>
              </div>

              {/* Forçar Sincronização */}
              <button
                type="button"
                onClick={handleManualSync}
                disabled={isSyncingManually || isPaused}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white text-xs font-bold transition-all border border-white/10 cursor-pointer disabled:opacity-40"
                title="Sincronizar agora o estado da sessão com a tela do usuário"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncingManually ? 'animate-spin text-cyan-300' : ''}`} />
                <span className="hidden sm:inline">Sincronizar</span>
              </button>

              {/* Botão Pausar / Retomar Transmissão */}
              <button
                type="button"
                onClick={handleTogglePause}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md active:scale-95 ${
                  !isPaused
                    ? 'bg-amber-600 hover:bg-amber-700 text-white border border-amber-400/40'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-400/40'
                }`}
                title={!isPaused ? 'Pausar transmissão em tempo real' : 'Retomar transmissão em tempo real'}
              >
                {!isPaused ? (
                  <>
                    <Pause className="w-3.5 h-3.5" />
                    <span>Pausar</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" />
                    <span>Retomar</span>
                  </>
                )}
              </button>

              {/* Botão Sair do Acesso */}
              <button
                type="button"
                onClick={handleEndSession}
                disabled={isStopping}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md hover:shadow-xl hover:scale-[1.02] active:scale-95 transition-all cursor-pointer border border-rose-400/40 disabled:opacity-50"
                title="Encerrar acompanhamento e retornar para a conta do administrador"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{isStopping ? 'Saindo...' : 'Encerrar Acompanhamento'}</span>
              </button>

              {/* Recolher barra */}
              <button
                type="button"
                onClick={() => {
                  setIsPinnedOpen(false);
                  setIsHovered(false);
                }}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors cursor-pointer"
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
