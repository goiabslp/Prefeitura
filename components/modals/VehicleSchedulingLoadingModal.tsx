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
  Flame, 
  Activity, 
  Layers, 
  Compass, 
  X, 
  Check, 
  ChevronRight,
  Truck
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

        // Progresso suave
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
      }, 550);
      return () => clearTimeout(timer);
    }
  }, [isCompleted, onFinished, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white/95 rounded-[2.5rem] shadow-2xl border border-white/60 p-6 sm:p-8 overflow-hidden animate-in zoom-in-95 duration-250 backdrop-blur-xl">
        
        {/* Glow de fundo dinâmico */}
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-gradient-to-br from-amber-400/20 via-orange-400/20 to-indigo-500/20 rounded-full blur-3xl pointer-events-none animate-pulse"></div>
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-gradient-to-tr from-indigo-500/20 via-purple-500/20 to-teal-400/20 rounded-full blur-3xl pointer-events-none animate-pulse"></div>

        {/* Botão de Fechar rápido caso usuário prefira entrar imediatamente */}
        <button
          type="button"
          onClick={() => {
            if (onFinished) onFinished();
            if (onClose) onClose();
          }}
          className="absolute top-5 right-5 p-2 rounded-2xl bg-slate-100/80 hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-all cursor-pointer z-10"
          title="Fechar e ir para o calendário"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header com Ícone Animado */}
        <div className="flex flex-col items-center text-center space-y-3 relative z-10">
          
          {/* Badge de Ícone com Radar Ripple Effect */}
          <div className="relative my-2">
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-tr from-amber-500 via-orange-500 to-indigo-600 opacity-40 animate-ping"></div>
            <div className="relative w-20 h-20 rounded-3xl bg-gradient-to-tr from-amber-500 via-orange-500 to-indigo-600 text-white flex items-center justify-center shadow-xl shadow-orange-500/30 border-2 border-white/80">
              {isCompleted ? (
                <CheckCircle2 className="w-10 h-10 text-white animate-in zoom-in-50 duration-300" />
              ) : (
                <Car className="w-10 h-10 text-white animate-bounce" />
              )}
            </div>
            
            {/* Mini Badge Flutuante */}
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

          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-50 border border-orange-200/80 text-orange-700 text-[10px] font-black uppercase tracking-wider mb-2">
              <Activity className="w-3 h-3 text-orange-600 animate-pulse" />
              <span>{isCompleted ? 'Sincronização Completa' : 'Sincronizando Sistema'}</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {isCompleted ? 'Dados Carregados com Sucesso!' : title}
            </h3>
            <p className="text-xs font-semibold text-slate-500 mt-1 max-w-sm mx-auto">
              {isCompleted ? 'Abrindo visualização do calendário de viagens...' : subtitle}
            </p>
          </div>
        </div>

        {/* Barra de Progresso com Gradiente Animado */}
        <div className="mt-6 space-y-1.5 relative z-10">
          <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-slate-500">
            <span className="flex items-center gap-1.5">
              {!isCompleted ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-orange-600" />
                  Carregando informações...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Tudo pronto!
                </>
              )}
            </span>
            <span className="font-mono text-slate-800">{progress}%</span>
          </div>

          <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200/80 shadow-inner">
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

        {/* Lista Interativa de Etapas */}
        <div className="mt-6 space-y-2.5 relative z-10">
          {steps.map((step, idx) => {
            const isDone = currentStepIndex > idx || isCompleted;
            const isCurrent = currentStepIndex === idx && !isCompleted;
            const StepIcon = step.icon;

            return (
              <div 
                key={step.id}
                className={`p-3 sm:p-3.5 rounded-2xl border transition-all duration-300 flex items-center justify-between gap-3 ${
                  isDone 
                    ? 'bg-emerald-50/70 border-emerald-200/80 text-emerald-950 shadow-xs' 
                    : isCurrent 
                    ? 'bg-white border-orange-300 shadow-md shadow-orange-500/5 ring-2 ring-orange-500/10' 
                    : 'bg-slate-50/50 border-slate-100 text-slate-400 opacity-60'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-transform ${
                    isDone 
                      ? 'bg-emerald-600 text-white shadow-sm' 
                      : isCurrent 
                      ? 'bg-gradient-to-tr from-amber-500 to-orange-500 text-white shadow-md shadow-orange-500/20 scale-105' 
                      : 'bg-slate-200 text-slate-400'
                  }`}>
                    {isDone ? (
                      <Check className="w-4.5 h-4.5 text-white" />
                    ) : isCurrent ? (
                      <StepIcon className="w-4.5 h-4.5 text-white animate-pulse" />
                    ) : (
                      <StepIcon className="w-4.5 h-4.5" />
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
                    <Loader2 className="w-4 h-4 text-orange-600 animate-spin" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-slate-300 block mr-1"></span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer com Dica e Botão de Acesso */}
        <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 relative z-10">
          <div className="text-[11px] text-slate-400 font-semibold flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Regras de descanso e escalas validadas</span>
          </div>

          <button
            type="button"
            onClick={() => {
              if (onFinished) onFinished();
              if (onClose) onClose();
            }}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-95 text-white text-xs font-black uppercase tracking-wider transition-all shadow-md cursor-pointer flex items-center justify-center gap-1.5"
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
