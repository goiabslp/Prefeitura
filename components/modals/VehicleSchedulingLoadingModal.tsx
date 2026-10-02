import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Car, 
  Calendar, 
  Users, 
  CheckCircle2, 
  Loader2, 
  Sparkles, 
  ShieldCheck, 
  Activity, 
  X, 
  Check, 
  ChevronRight
} from 'lucide-react';

export interface VehicleSchedulingLoadingModalProps {
  isOpen: boolean;
  onClose?: () => void;
  vehiclesCount?: number;
  driversCount?: number;
  schedulesCount?: number;
  onFinished?: () => void;
  title?: string;
  subtitle?: string;
}

interface StepItem {
  id: number;
  label: string;
  icon: any;
  desc: string;
}

export const VehicleSchedulingLoadingModal: React.FC<VehicleSchedulingLoadingModalProps> = ({
  isOpen,
  onClose,
  vehiclesCount = 0,
  driversCount = 0,
  schedulesCount = 0,
  onFinished,
  title = "Carregando Agendamento de Veículos",
  subtitle = "Sincronizando dados em tempo real com a Frota Municipal"
}) => {
  const [progress, setProgress] = useState(0);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);

  const steps: StepItem[] = [
    {
      id: 1,
      label: "Catálogo da Frota & Veículos",
      desc: vehiclesCount > 0 ? `${vehiclesCount} veículos identificados na frota` : "Mapeando veículos disponíveis...",
      icon: Car
    },
    {
      id: 2,
      label: "Motoristas & Escalas de Descanso",
      desc: driversCount > 0 ? `${driversCount} condutores e regras de escala` : "Validando descansos e disponibilidade...",
      icon: Users
    },
    {
      id: 3,
      label: "Calendário & Agendamentos de Viagens",
      desc: schedulesCount > 0 ? `${schedulesCount} viagens sincronizadas no sistema` : "Calculando rotas e datas de saída...",
      icon: Calendar
    },
    {
      id: 4,
      label: "Finalizando e Otimizando Visualização",
      desc: "Pronto para agendar e gerenciar viagens com segurança",
      icon: Sparkles
    }
  ];

  useEffect(() => {
    if (!isOpen) {
      setProgress(0);
      setCurrentStepIndex(0);
      setIsCompleted(false);
      return;
    }

    setProgress(5);
    setCurrentStepIndex(0);

    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsCompleted(true);
          return 100;
        }

        // Progresso suave e dinâmico
        const increment = prev < 30 ? 12 : prev < 70 ? 8 : prev < 90 ? 6 : 4;
        const next = Math.min(100, prev + increment);

        if (next >= 25 && next < 55) {
          setCurrentStepIndex(1);
        } else if (next >= 55 && next < 85) {
          setCurrentStepIndex(2);
        } else if (next >= 85) {
          setCurrentStepIndex(3);
        }

        if (next === 100) {
          setIsCompleted(true);
        }

        return next;
      });
    }, 90);

    return () => clearInterval(interval);
  }, [isOpen]);

  useEffect(() => {
    if (isCompleted) {
      const timer = setTimeout(() => {
        if (onFinished) onFinished();
        if (onClose) onClose();
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [isCompleted, onFinished, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-3 sm:p-6 md:p-8 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200 select-none">
      
      {/* Container Principal do Modal - Amplo nas laterais (max-w-3xl) e com altura contida (max-h-[88vh]) para não encostar no topo/base */}
      <div className="relative w-full max-w-3xl max-h-[88vh] bg-white/95 rounded-3xl sm:rounded-[2rem] shadow-2xl border border-white/70 overflow-hidden flex flex-col animate-in zoom-in-95 duration-250 backdrop-blur-xl">
        
        {/* Glows de Fundo Sutis */}
        <div className="absolute -top-20 -right-20 w-56 h-56 bg-gradient-to-br from-amber-400/20 via-orange-400/20 to-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-20 -left-20 w-56 h-56 bg-gradient-to-tr from-indigo-500/20 via-purple-500/20 to-teal-400/20 rounded-full blur-3xl pointer-events-none"></div>

        {/* Botão de Fechar Rápido */}
        <button
          type="button"
          onClick={() => {
            if (onFinished) onFinished();
            if (onClose) onClose();
          }}
          className="absolute top-4 right-4 sm:top-5 sm:right-5 p-2 rounded-xl bg-slate-100/90 hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-all cursor-pointer z-20 shadow-xs"
          title="Fechar e ir para o agendamento"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Corpo com Grid Horizontal em 2 Colunas para aproveitar as laterais em telas maiores */}
        <div className="p-5 sm:p-7 md:p-8 overflow-y-auto no-scrollbar flex-1 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-8 items-center">
            
            {/* COLUNA ESQUERDA (md:col-span-5): Header, Ícone Animado e Barra de Progresso */}
            <div className="md:col-span-5 flex flex-col items-center md:items-start text-center md:text-left space-y-4">
              
              {/* Badge de Ícone com Ripple */}
              <div className="relative">
                <div className="absolute inset-0 rounded-2xl sm:rounded-3xl bg-gradient-to-tr from-amber-500 via-orange-500 to-indigo-600 opacity-35 animate-ping"></div>
                <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl bg-gradient-to-tr from-amber-500 via-orange-500 to-indigo-600 text-white flex items-center justify-center shadow-xl shadow-orange-500/25 border-2 border-white/90">
                  {isCompleted ? (
                    <CheckCircle2 className="w-8 h-8 sm:w-10 sm:h-10 text-white animate-in zoom-in-50 duration-300" />
                  ) : (
                    <Car className="w-8 h-8 sm:w-10 sm:h-10 text-white animate-bounce" />
                  )}
                </div>
                
                {/* Mini Badge Flutuante com Percentual */}
                <div className="absolute -bottom-1.5 -right-1.5 px-2 py-0.5 rounded-full bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest border-2 border-white shadow-md flex items-center gap-1">
                  {!isCompleted ? (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                      <span>{progress}%</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-2.5 h-2.5 text-amber-300" />
                      <span>100%</span>
                    </>
                  )}
                </div>
              </div>

              {/* Títulos e Tag */}
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-orange-50 border border-orange-200/80 text-orange-700 text-[10px] font-black uppercase tracking-wider mb-2">
                  <Activity className="w-3 h-3 text-orange-600 animate-pulse" />
                  <span>{isCompleted ? 'Sincronização Completa' : 'Sincronizando Sistema'}</span>
                </div>
                
                <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight leading-tight">
                  {isCompleted ? 'Dados Carregados com Sucesso!' : title}
                </h3>
                
                <p className="text-xs font-semibold text-slate-500 mt-1 max-w-xs leading-relaxed">
                  {isCompleted ? 'Abrindo visualização do calendário de viagens...' : subtitle}
                </p>
              </div>

              {/* Barra de Progresso com Gradiente */}
              <div className="w-full space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-500">
                  <span className="flex items-center gap-1.5">
                    {!isCompleted ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-orange-600" />
                        Carregando...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Concluído!
                      </>
                    )}
                  </span>
                  <span className="font-mono text-slate-800 font-bold">{progress}%</span>
                </div>

                <div className="w-full h-2.5 sm:h-3 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200/80 shadow-inner">
                  <div 
                    className={`h-full rounded-full transition-all duration-300 ease-out ${
                      isCompleted 
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-500 shadow-md shadow-emerald-500/40' 
                        : 'bg-gradient-to-r from-amber-500 via-orange-500 to-indigo-600 shadow-md shadow-orange-500/40'
                    }`}
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
              </div>

            </div>

            {/* COLUNA DIREITA (md:col-span-7): Lista das Etapas em Cards Compactos */}
            <div className="md:col-span-7 space-y-2.5">
              {steps.map((step, idx) => {
                const isDone = currentStepIndex > idx || isCompleted;
                const isCurrent = currentStepIndex === idx && !isCompleted;
                const StepIcon = step.icon;

                return (
                  <div 
                    key={step.id}
                    className={`p-2.5 sm:p-3 rounded-2xl border transition-all duration-300 flex items-center justify-between gap-3 ${
                      isDone 
                        ? 'bg-emerald-50/70 border-emerald-200/80 text-emerald-950 shadow-xs' 
                        : isCurrent 
                        ? 'bg-white border-orange-300 shadow-md shadow-orange-500/10 ring-2 ring-orange-500/15' 
                        : 'bg-slate-50/40 border-slate-100 text-slate-400 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-transform ${
                        isDone 
                          ? 'bg-emerald-600 text-white shadow-xs' 
                          : isCurrent 
                          ? 'bg-gradient-to-tr from-amber-500 to-orange-500 text-white shadow-md shadow-orange-500/20 scale-105' 
                          : 'bg-slate-200 text-slate-400'
                      }`}>
                        {isDone ? (
                          <Check className="w-4 h-4 text-white" />
                        ) : isCurrent ? (
                          <StepIcon className="w-4 h-4 text-white animate-pulse" />
                        ) : (
                          <StepIcon className="w-4 h-4" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <p className={`text-xs font-black uppercase tracking-tight truncate ${
                          isDone ? 'text-emerald-900' : isCurrent ? 'text-slate-900' : 'text-slate-400'
                        }`}>
                          {step.label}
                        </p>
                        <p className="text-[11px] font-medium text-slate-500 truncate mt-0.5">
                          {step.desc}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {isDone ? (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-200/60 text-emerald-800 text-[9px] font-black uppercase tracking-wider">
                          OK
                        </span>
                      ) : isCurrent ? (
                        <Loader2 className="w-3.5 h-3.5 text-orange-600 animate-spin" />
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-slate-300 block mr-1"></span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        </div>

        {/* Rodapé Fixo e Compacto */}
        <div className="px-5 sm:px-8 py-3.5 bg-slate-50/80 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 relative z-10">
          <div className="text-[11px] text-slate-500 font-semibold flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Regras de descanso e escalas validadas</span>
          </div>

          <button
            type="button"
            onClick={() => {
              if (onFinished) onFinished();
              if (onClose) onClose();
            }}
            className="w-full sm:w-auto px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-95 text-white text-xs font-black uppercase tracking-wider transition-all shadow-md cursor-pointer flex items-center justify-center gap-1.5"
          >
            <span>{isCompleted ? 'Abrir Calendário' : 'Entrar Agora'}</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
};
