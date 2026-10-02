import React, { useState, useEffect, useRef } from 'react';
import { 
  Radio, 
  Pause, 
  Play, 
  LogOut, 
  ChevronDown, 
  Eye, 
  ShieldAlert, 
  Clock, 
  RefreshCw,
  MousePointer,
  CheckCircle2,
  X,
  Sliders,
  UserCheck
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
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isStopping, setIsStopping] = useState(false);
  const [isSyncingManually, setIsSyncingManually] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);

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

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

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
    }, 1000);
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

  return (
    <div ref={containerRef} className="relative flex items-center">
      {/* 1. BADGE PRINCIPAL COMPACTO E ELEGANTE NO HEADER (SEM SOBREPOR NADA) */}
      <div className="flex items-center gap-2 px-3 py-1 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-xl border border-indigo-500/40 shadow-sm">
        {/* Indicador pulsante */}
        <span className="relative flex h-2 w-2 shrink-0">
          {!isPaused ? (
            <>
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </>
          ) : (
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400"></span>
          )}
        </span>

        {/* Título e Nome do Usuário */}
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-cyan-300 shrink-0">
            Acompanhamento:
          </span>
          <span className="text-xs font-bold text-white truncate max-w-[130px] sm:max-w-[180px] lg:max-w-[220px]">
            {session.targetUser.name}
          </span>
        </div>

        {/* Tag do Modo Ativo */}
        <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded border shrink-0 ${
          mode === 'observer' 
            ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/30' 
            : 'bg-violet-500/20 text-violet-300 border-violet-400/30'
        }`}>
          {mode === 'observer' ? 'Observador' : 'Simulação'}
        </span>

        {/* Cronômetro */}
        <span className="text-[10px] font-mono font-bold text-slate-300 bg-black/40 px-1.5 py-0.5 rounded shrink-0 hidden sm:inline-block">
          {formatTimer(elapsedSeconds)}
        </span>

        {/* Botão de Setinha Discreta para abrir Configurações */}
        <button
          type="button"
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className={`p-1 rounded-lg transition-all cursor-pointer ${
            isDropdownOpen
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-300 hover:text-white hover:bg-white/10'
          }`}
          title={isDropdownOpen ? 'Fechar configurações' : 'Abrir configurações do acompanhamento assistido'}
        >
          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180 text-white' : 'text-slate-300'}`} />
        </button>
      </div>

      {/* 2. POPOVER / MENU FLUTUANTE COMPACTO DE CONFIGURAÇÕES (ANCORADO ABAIXO) */}
      {isDropdownOpen && (
        <div className="absolute top-full left-0 mt-2 w-80 sm:w-96 bg-slate-950/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-indigo-500/40 p-4 z-[200] text-white animate-in fade-in slide-in-from-top-2">
          
          {/* Header do Popover */}
          <div className="flex items-center justify-between pb-3 border-b border-indigo-500/20 mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-indigo-500/20 text-cyan-300 rounded-lg border border-indigo-400/30">
                <Radio className="w-3.5 h-3.5 animate-pulse" />
              </div>
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-white">
                  Controle da Sessão
                </h4>
                <p className="text-[10px] text-slate-400">
                  Duração: <strong className="text-cyan-300 font-mono">{formatTimer(elapsedSeconds)}</strong>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Presença do Usuário */}
              <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold border ${
                isTargetUserConnected 
                  ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30' 
                  : 'bg-black/30 text-indigo-300/80 border-indigo-500/20'
              }`}>
                {isTargetUserConnected ? 'Usuário Online' : 'Aguardando Usuário'}
              </span>

              <button
                type="button"
                onClick={() => setIsDropdownOpen(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                title="Fechar painel"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Seleção de Modo: Observador vs Simulação */}
          <div className="space-y-1.5 mb-3.5">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <Sliders className="w-3 h-3 text-indigo-400" />
              Modo de Operação
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleToggleMode('observer')}
                className={`p-2 rounded-xl text-left border transition-all cursor-pointer flex flex-col justify-between ${
                  mode === 'observer'
                    ? 'bg-cyan-500/20 text-cyan-200 border-cyan-400/50 ring-1 ring-cyan-400/30'
                    : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-1 text-xs font-black">
                  <Eye className="w-3.5 h-3.5 text-cyan-400" />
                  Observador
                </span>
                <span className="text-[9px] text-slate-400 mt-1 leading-tight">
                  Espelha tela do usuário
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleToggleMode('simulation')}
                className={`p-2 rounded-xl text-left border transition-all cursor-pointer flex flex-col justify-between ${
                  mode === 'simulation'
                    ? 'bg-violet-500/20 text-violet-200 border-violet-400/50 ring-1 ring-violet-400/30'
                    : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-1 text-xs font-black">
                  <MousePointer className="w-3.5 h-3.5 text-violet-400" />
                  Simulação
                </span>
                <span className="text-[9px] text-slate-400 mt-1 leading-tight">
                  Interativo c/ permissões
                </span>
              </button>
            </div>
          </div>

          {/* Dados do Usuário e Auditoria */}
          <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-xs space-y-1.5 mb-3.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Usuário Alvo:</span>
              <span className="font-bold text-white truncate max-w-[160px]">{session.targetUser.name}</span>
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-slate-400">Cargo / Setor:</span>
              <span className="text-slate-300">{session.targetUser.role} {session.targetUser.sector ? `• ${session.targetUser.sector}` : ''}</span>
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-slate-400">Admin Executor:</span>
              <span className="font-bold text-cyan-300">{session.realAdmin.name}</span>
            </div>
          </div>

          {/* Ações Rápidas: Pausar, Sincronizar e Encerrar */}
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleTogglePause}
                className={`py-2 px-3 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  !isPaused
                    ? 'bg-amber-600 hover:bg-amber-700 text-white'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                }`}
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

              <button
                type="button"
                onClick={handleManualSync}
                disabled={isSyncingManually || isPaused}
                className="py-2 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all border border-white/10 cursor-pointer disabled:opacity-40"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncingManually ? 'animate-spin text-cyan-300' : ''}`} />
                <span>Sincronizar</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleEndSession}
              disabled={isStopping}
              className="w-full py-2.5 px-3 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{isStopping ? 'Encerrando...' : 'Encerrar Acompanhamento'}</span>
            </button>
          </div>

        </div>
      )}
    </div>
  );
};
