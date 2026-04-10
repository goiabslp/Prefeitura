import React, { useState } from 'react';
import { RefreshCw, Play, ArrowLeft, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { updateSystemUpdateTarget } from '../services/settingsService';
import { supabase } from '../services/supabaseClient';

interface SystemUpdateScreenProps {
  onBack: () => void;
}

export const SystemUpdateScreen: React.FC<SystemUpdateScreenProps> = ({ onBack }) => {
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isInitiating, setIsInitiating] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleStartUpdate = async () => {
    setIsInitiating(true);
    const targetEpoch = Date.now() + 60000;
    
    try {
      // 1. BROADCAST INSTANTLY for real-time (no DB latency)
      const channel = supabase.channel('global-updates');
      await channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.send({
            type: 'broadcast',
            event: 'system_update',
            payload: { target: targetEpoch }
          });
        }
      });

      // 2. Persist in DB for new logins/refreshers
      const success = await updateSystemUpdateTarget(targetEpoch);
      
      if (success) {
         setIsSuccess(true);
         setTimeout(() => {
            onBack();
         }, 3000);
      } else {
         alert("Erro ao disparar atualização.");
         setIsInitiating(false);
         setShowConfirmModal(false);
      }
    } catch (err) {
      console.error(err);
      setIsInitiating(false);
      setShowConfirmModal(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden relative">
      {/* Header with Back button */}
      <div className="absolute top-0 left-0 right-0 p-6 z-10">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-slate-400 hover:text-indigo-600 transition-all font-bold text-[10px] tracking-widest bg-white/80 backdrop-blur-md px-4 py-2.5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md active:scale-95 uppercase"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Voltar ao Painel
        </button>
      </div>

      {/* Main Card */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-[480px] bg-white rounded-[2.5rem] border border-slate-200 shadow-2xl p-8 desktop:p-12 overflow-hidden relative animate-scale-up">
          <div className="absolute top-0 left-0 right-0 h-2.5 bg-gradient-to-r from-amber-400 via-orange-500 to-amber-600"></div>
          
          <div className="flex flex-col items-center text-center">
            <div className="w-24 h-24 desktop:w-28 desktop:h-28 bg-amber-50 rounded-[2rem] desktop:rounded-[2.5rem] flex items-center justify-center mb-8 text-amber-500 ring-8 ring-amber-500/5 animate-pulse-glow">
              <RefreshCw className="w-12 h-12 desktop:w-14 desktop:h-14 animate-spin-slow" />
            </div>

            <h2 className="text-2xl desktop:text-3xl font-black text-slate-900 mb-4 tracking-tighter uppercase leading-tight">
              Atualização<br />do Sistema
            </h2>
            
            <p className="text-sm desktop:text-base text-slate-500 font-medium mb-10 leading-relaxed max-w-[320px]">
              Esta ação disparará um alerta de <b>60 segundos</b> para todos os usuários online. Após a contagem, o recarregamento será forçado.
            </p>

            <button
              onClick={() => setShowConfirmModal(true)}
              className="w-full flex items-center justify-center gap-3 bg-slate-900 hover:bg-amber-600 text-white font-black py-4 desktop:py-5 px-8 rounded-2xl transition-all active:scale-95 shadow-xl shadow-slate-300 uppercase tracking-widest text-xs desktop:text-sm"
            >
              <Play className="w-5 h-5 fill-current" />
              Iniciar Agora
            </button>

            <div className="mt-8 pt-8 border-t border-slate-50 w-full">
              <p className="text-[10px] text-slate-300 font-black uppercase tracking-[0.2em]">
                Prefeitura Integrada • Admin
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* MODERN INTERNAL MODAL */}
      {(showConfirmModal || isSuccess) && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-md bg-white rounded-[3rem] shadow-2xl border border-slate-100 p-10 text-center relative animate-scale-up overflow-hidden">
            {!isSuccess ? (
              <>
                <div className="absolute top-0 left-0 right-0 h-2 bg-amber-500"></div>
                <div className="w-20 h-20 bg-amber-50 rounded-3xl flex items-center justify-center mx-auto mb-8 text-amber-500 ring-8 ring-amber-50">
                  <ShieldAlert className="w-10 h-10" />
                </div>
                <h3 className="text-2xl font-black text-slate-900 mb-4 uppercase tracking-tighter">Atenção!</h3>
                <p className="text-sm text-slate-500 font-medium mb-10 leading-relaxed px-4">
                  Esta ação afetará **todos os usuários ativos**. O sistema será forçado a reiniciar em 60 segundos. Deseja continuar?
                </p>
                <div className="flex flex-col gap-3">
                  <button
                    onClick={handleStartUpdate}
                    disabled={isInitiating}
                    className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-emerald-600 text-white font-black py-5 rounded-2xl transition-all active:scale-95 disabled:opacity-50 uppercase tracking-widest text-xs"
                  >
                    {isInitiating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                    Confirmar Atualização
                  </button>
                  <button
                    onClick={() => setShowConfirmModal(false)}
                    className="w-full py-4 text-slate-400 font-bold hover:text-slate-600 transition-colors uppercase tracking-widest text-[10px]"
                  >
                    Cancelar
                  </button>
                </div>
              </>
            ) : (
                <>
                <div className="absolute top-0 left-0 right-0 h-2 bg-emerald-500"></div>
                <div className="w-20 h-20 bg-emerald-50 rounded-3xl flex items-center justify-center mx-auto mb-8 text-emerald-500 ring-8 ring-emerald-50">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h3 className="text-2xl font-black text-slate-900 mb-4 uppercase tracking-tighter">Iniciado!</h3>
                <p className="text-sm text-slate-500 font-medium mb-4 leading-relaxed px-4">
                  O cronômetro foi disparado com sucesso para todos os usuários.
                </p>
                <div className="text-[10px] font-black text-emerald-600 bg-emerald-50 py-3 rounded-xl px-6 uppercase tracking-widest inline-block mb-4">
                    Redirecionando em 3s...
                </div>
              </>
            )}
          </div>
        </div>
      )}
      
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes scale-up {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-scale-up {
          animation: scale-up 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out forwards;
        }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.3); transform: scale(1); }
          50% { box-shadow: 0 0 0 15px rgba(245, 158, 11, 0); transform: scale(1.02); }
        }
        .animate-pulse-glow {
          animation: pulse-glow 3s infinite ease-in-out;
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 12s linear infinite;
        }
      `}} />
    </div>
  );
};
