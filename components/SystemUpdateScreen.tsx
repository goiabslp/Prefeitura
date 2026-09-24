import React, { useState, useEffect } from 'react';
import { RefreshCw, Play, ArrowLeft, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { triggerGlobalSystemUpdate } from '../services/systemUpdateService';
import { User } from '../types';

declare const __LATEST_COMMIT__: string | undefined;

interface SystemUpdateScreenProps {
  onBack: () => void;
  currentUser?: User;
  onUpdateTriggered?: (target: number) => void;
}

export const SystemUpdateScreen: React.FC<SystemUpdateScreenProps> = ({ onBack, currentUser, onUpdateTriggered }) => {
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isInitiating, setIsInitiating] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [translatedCommit, setTranslatedCommit] = useState<string>('Carregando notas de versão...');

  useEffect(() => {
    // Sincroniza a URL para a rota permanente /Admin/Dashboard/atualizar
    if (typeof window !== 'undefined' && window.location.pathname !== '/Admin/Dashboard/atualizar') {
      window.history.pushState({}, '', '/Admin/Dashboard/atualizar');
    }
  }, []);

  useEffect(() => {
    const translateCommit = async () => {
      const rawMsg = typeof __LATEST_COMMIT__ !== 'undefined' ? __LATEST_COMMIT__ : 'Atualizações de estabilidade e melhorias gerais.';
      
      const match = rawMsg.match(/^(feat|fix|chore|refactor|docs|style|perf)(?:\([^)]+\))?:\s*(.*)/i);
      
      let prefixText = '';
      let textToTranslate = rawMsg;
      
      if (match) {
        const type = match[1].toLowerCase();
        const prefixes: Record<string, string> = {
          feat: '✨ Nova funcionalidade:',
          fix: '🐛 Correção:',
          chore: '🔧 Manutenção:',
          refactor: '♻️ Refatoração:',
          docs: '📝 Documentação:',
          style: '🎨 Estilos:',
          perf: '🚀 Performance:'
        };
        prefixText = prefixes[type] || '📦 Atualização:';
        textToTranslate = match[2];
      }
      
      try {
        const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=pt&dt=t&q=${encodeURI(textToTranslate)}`);
        const data = await res.json();
        const translated = data[0].map((item: any) => item[0]).join('');
        setTranslatedCommit(prefixText ? `${prefixText} ${translated}` : translated);
      } catch (err) {
        let formatted = rawMsg;
        if (prefixText) {
          formatted = `${prefixText} ${textToTranslate}`;
        }
        setTranslatedCommit(formatted);
      }
    };
    
    translateCommit();
  }, []);

  const handleStartUpdate = async () => {
    setIsInitiating(true);
    
    try {
      const result = await triggerGlobalSystemUpdate({
        id: currentUser?.id,
        name: currentUser?.name || 'Administrador',
        role: currentUser?.role || 'admin'
      });
      
      if (result.success) {
        setIsSuccess(true);
        if (onUpdateTriggered) {
          onUpdateTriggered(result.target);
        }
        setTimeout(() => {
          onBack();
        }, 2500);
      } else {
        alert("Erro ao disparar atualização: " + (result.error || "Tente novamente."));
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
      {/* Header com botão de retorno ao Painel */}
      <div className="absolute top-0 left-0 right-0 p-6 z-10 flex items-center justify-between">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-all font-bold text-xs tracking-wide bg-white/90 backdrop-blur-md px-4 py-2.5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md active:scale-95"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar ao Painel
        </button>

        <span className="text-[11px] font-mono text-slate-400 bg-white/80 px-3 py-1.5 rounded-lg border border-slate-200">
          /Admin/Dashboard/atualizar
        </span>
      </div>

      {/* Card Central - Fiel à Identidade Visual da Interface */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-[480px] bg-white rounded-[2.5rem] border border-slate-200/90 shadow-2xl p-8 sm:p-12 overflow-hidden relative animate-scale-up">
          {/* Faixa superior com detalhe em degradê laranja/âmbar */}
          <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-amber-400 via-orange-500 to-amber-500"></div>
          
          <div className="flex flex-col items-center text-center">
            {/* Ícone circular grande com fundo amarelo/laranja suave */}
            <div className="w-24 h-24 sm:w-28 sm:h-28 bg-[#fef7eb] rounded-[2.2rem] flex items-center justify-center mb-8 text-[#f59e0b] ring-8 ring-amber-500/5 shadow-inner">
              <RefreshCw className="w-12 h-12 sm:w-14 sm:h-14 text-[#ea580c] animate-spin-slow stroke-[2.2]" />
            </div>

            {/* Título Principal */}
            <h2 className="text-2xl sm:text-3xl font-black text-[#0f172a] mb-4 tracking-tight uppercase leading-tight">
              Atualização<br />do Sistema
            </h2>
            
            {/* Texto Explicativo */}
            <p className="text-sm sm:text-base text-slate-600 font-normal mb-9 leading-relaxed max-w-[340px]">
              Esta ação disparará um alerta de <b className="font-bold text-slate-800">60 segundos</b> para todos os usuários online. Após a contagem, o recarregamento será forçado.
            </p>

            {/* Botão de Ação Primária */}
            <button
              onClick={() => setShowConfirmModal(true)}
              className="w-full flex items-center justify-center gap-3 bg-[#0f172a] hover:bg-[#ea580c] text-white font-black py-4 sm:py-4.5 px-8 rounded-2xl transition-all duration-200 active:scale-98 shadow-xl shadow-slate-900/10 uppercase tracking-widest text-xs sm:text-sm cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              Iniciar Agora
            </button>

            {/* Rodapé Institucional */}
            <div className="mt-8 pt-8 border-t border-slate-100 w-full">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.25em]">
                Prefeitura Integrada • Admin
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL DE CONFIRMAÇÃO EXCLUSIVO */}
      {(showConfirmModal || isSuccess) && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-900/50 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 p-8 sm:p-10 text-center relative animate-scale-up overflow-hidden">
            {!isSuccess ? (
              <>
                <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-amber-500 to-orange-500"></div>
                <div className="w-20 h-20 bg-amber-50 rounded-3xl flex items-center justify-center mx-auto mb-6 text-amber-500 ring-8 ring-amber-50/70">
                  <ShieldAlert className="w-10 h-10 text-amber-600" />
                </div>

                <h3 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">
                  Atualização Global do Sistema
                </h3>

                <p className="text-sm text-slate-600 font-medium mb-6 leading-relaxed px-2">
                  Todos os usuários serão desconectados e os arquivos temporários da aplicação serão atualizados. Utilize esta função somente quando necessário.
                </p>
                
                {/* Notas de versão */}
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 mb-6 text-left">
                   <h4 className="text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                      📦 Registro de versão do sistema:
                   </h4>
                   <p className="text-xs text-slate-600 font-medium leading-relaxed italic">
                      {translatedCommit}
                   </p>
                </div>

                <div className="flex flex-col gap-3">
                  <button
                    onClick={handleStartUpdate}
                    disabled={isInitiating}
                    className="w-full flex items-center justify-center gap-2 bg-[#0f172a] hover:bg-[#ea580c] text-white font-bold py-4 rounded-xl transition-all active:scale-95 disabled:opacity-50 text-sm cursor-pointer shadow-lg shadow-slate-900/10"
                  >
                    {isInitiating ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Disparando atualização global...
                      </>
                    ) : (
                      'Atualizar todos os usuários'
                    )}
                  </button>
                  <button
                    onClick={() => setShowConfirmModal(false)}
                    disabled={isInitiating}
                    className="w-full py-3 text-slate-500 font-bold hover:text-slate-800 transition-colors text-xs"
                  >
                    Cancelar
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="absolute top-0 left-0 right-0 h-2 bg-emerald-500"></div>
                <div className="w-20 h-20 bg-emerald-50 rounded-3xl flex items-center justify-center mx-auto mb-6 text-emerald-500 ring-8 ring-emerald-50/70">
                  <CheckCircle2 className="w-10 h-10 text-emerald-600" />
                </div>
                <h3 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">
                  Atualização Disparada!
                </h3>
                <p className="text-sm text-slate-600 font-medium mb-5 leading-relaxed px-4">
                  O alerta de 60 segundos foi transmitido para todos os usuários em tempo real. Ao fim da contagem, todas as sessões e caches serão reiniciados.
                </p>
                <div className="text-xs font-bold text-emerald-700 bg-emerald-50 py-2.5 rounded-xl px-5 inline-block mb-2">
                  Retornando ao painel em instantes...
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
          animation: scale-up 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fade-in {
          animation: fade-in 0.25s ease-out forwards;
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 14s linear infinite;
        }
      `}} />
    </div>
  );
};
