import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  RefreshCw, 
  CheckCircle2, 
  Sparkles, 
  Layers, 
  Database, 
  Settings2, 
  ShieldCheck,
  Check,
  Clock,
  ArrowRight,
  Cpu
} from 'lucide-react';
import { fetchAndTranslateChangelog } from '../services/systemUpdateService';

export interface SystemDynamicUpdateModalProps {
  isOpen: boolean;
  countdown: number; // Segundos restantes
  totalDuration?: number; // 10 ou 60 segundos
  isIndividual?: boolean;
  adminName?: string;
  onFinishUpdate: () => Promise<void> | void;
}

type UpdatePhase = 'countdown' | 'applying' | 'completed';

interface ProcessingStep {
  id: string;
  label: string;
  subLabel: string;
  icon: React.ElementType;
  minProgress: number;
  maxProgress: number;
}

const PROCESSING_STEPS: ProcessingStep[] = [
  {
    id: 'prepare',
    label: 'Preparando atualização...',
    subLabel: 'Validando integridade dos pacotes e estrutura',
    icon: Settings2,
    minProgress: 5,
    maxProgress: 28
  },
  {
    id: 'cleanup',
    label: 'Limpando arquivos temporários...',
    subLabel: 'Expurgando cache local e sessões obsoletas',
    icon: Database,
    minProgress: 29,
    maxProgress: 60
  },
  {
    id: 'apply',
    label: 'Aplicando nova versão...',
    subLabel: 'Atualizando módulos, schemas e componentes',
    icon: Layers,
    minProgress: 61,
    maxProgress: 88
  },
  {
    id: 'finalize',
    label: 'Finalizando configurações...',
    subLabel: 'Otimizando rotas e parâmetros do ambiente',
    icon: Sparkles,
    minProgress: 89,
    maxProgress: 100
  }
];

export const SystemDynamicUpdateModal: React.FC<SystemDynamicUpdateModalProps> = ({
  isOpen,
  countdown,
  totalDuration = 10,
  isIndividual = false,
  adminName,
  onFinishUpdate
}) => {
  const [phase, setPhase] = useState<UpdatePhase>('countdown');
  const [changelogItems, setChangelogItems] = useState<string[]>([]);
  const [isLoadingChangelog, setIsLoadingChangelog] = useState(true);
  const [progressPct, setProgressPct] = useState(0);
  const [activeStepIdx, setActiveStepIdx] = useState(0);
  const hasFinishedRef = useRef(false);

  // Bloqueio de rolagem do body enquanto o modal estiver aberto
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  // Carrega as novidades do commit/deploy de forma assíncrona
  useEffect(() => {
    let isMounted = true;
    const loadChangelog = async () => {
      try {
        setIsLoadingChangelog(true);
        const items = await fetchAndTranslateChangelog();
        if (isMounted) {
          setChangelogItems(items);
        }
      } catch (err) {
        if (isMounted) {
          setChangelogItems(['Melhorias e correções do sistema estão sendo aplicadas.']);
        }
      } finally {
        if (isMounted) {
          setIsLoadingChangelog(false);
        }
      }
    };

    if (isOpen) {
      loadChangelog();
    }

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Transição automática quando o contador chega a 0
  useEffect(() => {
    if (countdown > 0) {
      setPhase('countdown');
      hasFinishedRef.current = false;
    } else if (countdown <= 0 && phase === 'countdown') {
      // Inicia a transição para a Etapa 2 (Aplicando atualizações)
      setPhase('applying');
      setProgressPct(10);
      setActiveStepIdx(0);
    }
  }, [countdown, phase]);

  // Animação dinâmica das etapas de processamento durante a fase 'applying'
  useEffect(() => {
    if (phase !== 'applying') return;

    let start = Date.now();
    const duration = 4500; // 4.5 segundos de animação detalhada

    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const progress = Math.min(100, Math.round((elapsed / duration) * 100));
      setProgressPct(progress);

      if (progress < 30) {
        setActiveStepIdx(0);
      } else if (progress < 60) {
        setActiveStepIdx(1);
      } else if (progress < 90) {
        setActiveStepIdx(2);
      } else {
        setActiveStepIdx(3);
      }

      if (elapsed >= duration) {
        clearInterval(interval);
        setPhase('completed');
        setProgressPct(100);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [phase]);

  // Conclusão com aguardo de 1.8 segundos para visualização do status de sucesso
  useEffect(() => {
    if (phase === 'completed' && !hasFinishedRef.current) {
      hasFinishedRef.current = true;
      const timer = setTimeout(() => {
        onFinishUpdate();
      }, 1800);
      return () => clearTimeout(timer);
    }
  }, [phase, onFinishUpdate]);

  if (!isOpen) return null;

  const currentStep = PROCESSING_STEPS[activeStepIdx] || PROCESSING_STEPS[0];
  const StepIcon = currentStep.icon;

  const initialDuration = totalDuration || (isIndividual ? 10 : 60);
  const countdownProgress = Math.min(100, Math.max(0, (countdown / initialDuration) * 100));

  return createPortal(
    <div 
      className="fixed inset-0 z-[99999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 select-none pointer-events-auto overflow-y-auto animate-in fade-in duration-300"
      role="dialog"
      aria-modal="true"
      aria-labelledby="system-update-title"
    >
      <div className="w-full max-w-lg bg-white rounded-[2rem] sm:rounded-[2.5rem] shadow-[0_25px_70px_rgba(0,0,0,0.45)] border border-slate-100 overflow-hidden relative transform transition-all animate-in zoom-in-95 duration-300 flex flex-col">
        
        {/* Faixa decorativa superior com gradiente dinâmico por etapa */}
        <div className={`h-2.5 w-full transition-all duration-500 bg-gradient-to-r ${
          phase === 'countdown' 
            ? 'from-amber-400 via-orange-500 to-amber-600'
            : phase === 'applying'
              ? 'from-indigo-600 via-purple-600 to-cyan-500 animate-pulse'
              : 'from-emerald-500 via-teal-500 to-emerald-600'
        }`} />

        <div className="p-6 sm:p-9 flex flex-col items-center text-center space-y-6">
          
          {/* ========================================================================= */}
          {/* ETAPA 1: CONTAGEM REGRESSIVA                                              */}
          {/* ========================================================================= */}
          {phase === 'countdown' && (
            <div className="w-full space-y-6 animate-in fade-in duration-300">
              
              {/* Círculo do Contador */}
              <div className="relative w-28 h-28 mx-auto flex items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-orange-50 ring-8 ring-orange-100/70 animate-pulse" />
                <div className="relative flex flex-col items-center justify-center text-orange-600">
                  <span className="text-5xl font-black tracking-tighter tabular-nums leading-none">
                    {countdown}
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-orange-500 mt-1">
                    segundos
                  </span>
                </div>
              </div>

              {/* Títulos e Descrição */}
              <div className="space-y-2">
                <h2 id="system-update-title" className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight">
                  Atualização do sistema
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 font-medium leading-relaxed max-w-sm mx-auto">
                  {adminName 
                    ? `Uma atualização foi iniciada pelo administrador (${adminName}). O sistema será atualizado em:`
                    : 'Uma atualização foi iniciada pelo administrador. O sistema será atualizado em:'}
                </p>
              </div>

              {/* Barra de Progresso Regressiva */}
              <div className="space-y-1.5 w-full">
                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden shadow-inner">
                  <div
                    className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 h-full rounded-full transition-all duration-500 ease-linear"
                    style={{ width: `${countdownProgress}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 px-1">
                  <span>Início</span>
                  <span className="text-orange-600 font-extrabold">{countdown}s restantes</span>
                  <span>Aplicação</span>
                </div>
              </div>

              {/* Status de Aviso */}
              <div className="inline-flex items-center justify-center gap-2 py-3 px-4 bg-orange-50 rounded-2xl border border-orange-200/70 text-orange-800 text-xs font-bold w-full shadow-sm">
                <RefreshCw className="w-4 h-4 animate-spin-slow text-orange-600 shrink-0" />
                <span className="truncate">
                  Encerrando sessão e preparando atualização em {countdown}s
                </span>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ETAPA 2: APLICANDO NOVAS ATUALIZAÇÕES & NOVIDADES DA VERSÃO                */}
          {/* ========================================================================= */}
          {phase === 'applying' && (
            <div className="w-full space-y-5 animate-in fade-in zoom-in-95 duration-400">
              
              {/* Ícone de Processamento Animado */}
              <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-indigo-50 ring-8 ring-indigo-100/80 animate-pulse" />
                <div className="absolute inset-0 border-4 border-indigo-200/60 rounded-full" />
                <div className="absolute inset-0 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin" />
                <div className="relative w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-700 text-white flex items-center justify-center shadow-lg shadow-indigo-500/30">
                  <StepIcon className="w-5 h-5 animate-bounce-subtle" />
                </div>
              </div>

              {/* Cabeçalho da Etapa 2 */}
              <div className="space-y-1.5">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200/70">
                  <Cpu className="w-3.5 h-3.5" />
                  Sincronização Ativa
                </span>
                <h2 id="system-update-title" className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-tight">
                  Novas atualizações estão sendo aplicadas
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 font-semibold">
                  Confira o que está chegando nesta versão:
                </p>
              </div>

              {/* Card com as Novidades Reais da Versão (Convertidas em PT-BR) */}
              <div className="w-full bg-slate-50/90 rounded-2xl p-4 sm:p-4.5 border border-slate-200/80 shadow-inner text-left space-y-2.5 max-h-48 overflow-y-auto">
                <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">
                      Novidades desta atualização
                    </h4>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                    Ao Vivo
                  </span>
                </div>

                {isLoadingChangelog ? (
                  <div className="py-4 flex flex-col items-center justify-center gap-2 text-slate-400">
                    <RefreshCw className="w-4 h-4 animate-spin text-indigo-500" />
                    <span className="text-xs font-medium">Carregando notas da versão...</span>
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {changelogItems.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-700 font-medium leading-snug">
                        <div className="w-4 h-4 rounded-full bg-emerald-500/15 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                        <span className="flex-1">{item}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Indicador Dinâmico das Fases de Processamento */}
              <div className="w-full space-y-2.5 pt-1">
                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden shadow-inner">
                  <div
                    className="bg-gradient-to-r from-indigo-600 via-purple-600 to-cyan-500 h-full rounded-full transition-all duration-300 ease-out shadow-md"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-xs font-bold text-indigo-900 bg-indigo-50/70 border border-indigo-100 py-2 px-3.5 rounded-xl">
                  <div className="flex items-center gap-2 min-w-0">
                    <StepIcon className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span className="truncate">{currentStep.label}</span>
                  </div>
                  <span className="text-indigo-600 font-extrabold tabular-nums shrink-0">{progressPct}%</span>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ETAPA 3: ATUALIZAÇÃO CONCLUÍDA COM SUCESSO                                */}
          {/* ========================================================================= */}
          {phase === 'completed' && (
            <div className="w-full space-y-5 animate-in fade-in zoom-in-95 duration-400">
              
              {/* Ícone de Sucesso */}
              <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-emerald-100 ring-8 ring-emerald-200/60 animate-ping opacity-60" />
                <div className="relative w-16 h-16 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-xl shadow-emerald-600/30">
                  <CheckCircle2 className="w-9 h-9 stroke-[2.5]" />
                </div>
              </div>

              <div className="space-y-2">
                <h2 id="system-update-title" className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight flex items-center justify-center gap-2">
                  <Check className="w-7 h-7 text-emerald-600 stroke-[3]" />
                  Atualização concluída
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 font-medium leading-relaxed max-w-sm mx-auto">
                  A nova versão do sistema foi aplicada com sucesso.
                </p>
              </div>

              {/* Barra de Progresso Completa */}
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden shadow-inner">
                <div className="bg-emerald-500 h-full rounded-full w-full" />
              </div>

              <div className="inline-flex items-center justify-center gap-2 py-3 px-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-emerald-800 text-xs font-bold w-full shadow-sm">
                <RefreshCw className="w-4 h-4 animate-spin text-emerald-600 shrink-0" />
                <span>Recarregando ambiente com os novos recursos...</span>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>,
    document.body
  );
};
