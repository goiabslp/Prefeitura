import { RefreshCw, Play, ArrowLeft } from 'lucide-react';
import { updateSystemUpdateTarget } from '../services/settingsService';
import { supabase } from '../services/supabaseClient';

interface SystemUpdateScreenProps {
  onBack: () => void;
}

export const SystemUpdateScreen: React.FC<SystemUpdateScreenProps> = ({ onBack }) => {
  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden relative">
      {/* Header with Back button - Absolute to stay at top without affecting centered content */}
      <div className="absolute top-0 left-0 right-0 p-6 z-10">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-slate-400 hover:text-indigo-600 transition-all font-bold text-[10px] tracking-widest bg-white/80 backdrop-blur-md px-4 py-2.5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md active:scale-95 uppercase"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Voltar ao Painel
        </button>
      </div>

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
              onClick={async () => {
                if (!window.confirm("ATENÇÃO: Isso afetará todos os usuários ativos. Deseja iniciar o processo de atualização agora?")) return;
                
                const targetEpoch = Date.now() + 60000;
                
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
                   alert("Atualização iniciada com sucesso!");
                   onBack();
                } else {
                   alert("Erro ao disparar atualização.");
                }
              }}
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
      
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes scale-up {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-scale-up {
          animation: scale-up 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
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
