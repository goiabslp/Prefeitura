import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Clock, Zap, ShieldCheck, CheckCircle, ArrowLeft, X, Sparkles, Check } from 'lucide-react';
import {
  setAuthGracePeriodMinutes,
  recordAuthSuccess,
  dismissAuthPromoForToday,
  GRACE_PERIOD_OPTIONS
} from '../../services/authTimeService';

interface AuthTimePromoModalProps {
  isOpen: boolean;
  onClose: () => void; // Continuar com o 2FA normal
  onSuccessAuthorized: () => void; // Sessão ativada e operação autorizada automaticamente
}

export const AuthTimePromoModal: React.FC<AuthTimePromoModalProps> = ({
  isOpen,
  onClose,
  onSuccessAuthorized
}) => {
  const [step, setStep] = useState<'ask' | 'select_time'>('ask');
  const [selectedMinutes, setSelectedMinutes] = useState<number>(15); // Padrão 15 min

  if (!isOpen) return null;

  const handleDismissToday = () => {
    dismissAuthPromoForToday();
    onClose();
  };

  const handleConfirmTime = () => {
    setAuthGracePeriodMinutes(selectedMinutes);
    recordAuthSuccess();
    onSuccessAuthorized();
  };

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[99999] flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 sm:p-7 relative overflow-hidden transition-all duration-300 transform scale-100 border border-slate-100">
        
        {/* Glow de Fundo Decorativo */}
        <div className="absolute -top-16 -right-16 w-36 h-36 bg-gradient-to-br from-indigo-400/20 to-teal-400/20 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-36 h-36 bg-gradient-to-br from-emerald-400/20 to-blue-400/20 rounded-full blur-2xl pointer-events-none" />

        {/* PASSO 1: PERGUNTA AMIGÁVEL */}
        {step === 'ask' && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shadow-inner">
                <Sparkles className="w-6 h-6 text-amber-500 animate-pulse" />
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                title="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-black text-slate-900 tracking-tight leading-snug">
                Gostaria de agilizar suas assinaturas hoje?
              </h3>
              <p className="text-xs text-slate-600 font-medium leading-relaxed">
                Você pode definir um tempo de autorização temporária (ex: 15 minutos ou 1 hora). Durante esse período, o sistema não solicitará a confirmação 2FA a cada nova assinatura.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              {/* Botão Sim */}
              <button
                type="button"
                onClick={() => setStep('select_time')}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-emerald-600/20 active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Clock className="w-4 h-4 text-amber-300" />
                <span>Sim, definir tempo agora</span>
              </button>

              {/* Botão Agora não */}
              <button
                type="button"
                onClick={onClose}
                className="w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold text-xs uppercase tracking-wider transition-colors active:scale-95 cursor-pointer"
              >
                Agora não (Digitar 2FA nesta vez)
              </button>

              {/* Botão Não exibir novamente hoje */}
              <button
                type="button"
                onClick={handleDismissToday}
                className="w-full py-2.5 text-slate-400 hover:text-slate-600 text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 cursor-pointer pt-1"
              >
                <span>Não exibir esta mensagem novamente hoje</span>
              </button>
            </div>
          </div>
        )}

        {/* PASSO 2: SELEÇÃO DO TEMPO SEM SAIR DA TELA */}
        {step === 'select_time' && (
          <div className="space-y-5 animate-fade-in">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep('ask')}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors flex items-center gap-1 text-xs font-bold"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Voltar</span>
              </button>
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-md">
                Passo 2 de 2
              </span>
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                <Clock className="w-5 h-5 text-indigo-600" />
                Escolha a Duração Autorizada
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Selecione por quanto tempo o sistema manterá sua autorização ativa sem pedir o código 2FA.
              </p>
            </div>

            {/* Grid de Opções de Tempo */}
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              {GRACE_PERIOD_OPTIONS.filter(opt => opt.value > 0).map((opt) => {
                const isSelected = selectedMinutes === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSelectedMinutes(opt.value)}
                    className={`
                      p-3 rounded-2xl border-2 text-left transition-all flex flex-col justify-between gap-1.5 cursor-pointer active:scale-95
                      ${isSelected
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-md ring-2 ring-indigo-300'
                        : 'bg-slate-50 border-slate-200 hover:border-slate-300 hover:bg-white text-slate-800'
                      }
                    `}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className={`text-xs font-black uppercase tracking-wider ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                        {opt.label}
                      </span>
                      {isSelected && <Check className="w-4 h-4 text-white shrink-0" />}
                    </div>
                    <span className={`text-[10px] font-medium ${isSelected ? 'text-indigo-100' : 'text-slate-500'}`}>
                      {opt.value >= 60 ? `${opt.value / 60} hora(s)` : `${opt.value} minutos`}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Botão de Confirmação */}
            <div className="pt-3 space-y-2">
              <button
                type="button"
                onClick={handleConfirmTime}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-indigo-600/20 active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
              >
                <CheckCircle className="w-4.5 h-4.5 text-emerald-400" />
                <span>Confirmar e Ativar ({selectedMinutes >= 60 ? `${selectedMinutes / 60}h` : `${selectedMinutes} min`})</span>
              </button>
              <p className="text-[10px] text-slate-400 text-center font-medium">
                Esta ação autorizará imediatamente sua operação atual.
              </p>
            </div>
          </div>
        )}

      </div>
    </div>,
    document.body
  );
};
