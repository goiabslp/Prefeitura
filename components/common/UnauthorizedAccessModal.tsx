import React from 'react';
import { ShieldAlert, ArrowLeft, Home, Lock, AlertOctagon } from 'lucide-react';

interface UnauthorizedAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  reason?: string;
  route?: string;
  moduleName?: string;
  submoduleName?: string;
}

export const UnauthorizedAccessModal: React.FC<UnauthorizedAccessModalProps> = ({
  isOpen,
  onClose,
  reason,
  route,
  moduleName,
  submoduleName
}) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="unauthorized-title"
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div 
        className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl border border-rose-100 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Faixa decorativa superior com gradiente */}
        <div className="h-2.5 w-full bg-gradient-to-r from-rose-500 via-amber-500 to-rose-600" />

        <div className="p-6 sm:p-8">
          {/* Cabeçalho com Ícone */}
          <div className="flex items-start gap-4 mb-5">
            <div className="p-3.5 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100 shrink-0 shadow-sm">
              <ShieldAlert className="w-8 h-8 text-rose-600 animate-pulse" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-700 mb-1.5">
                <Lock className="w-3 h-3" />
                Controle de Acesso Restrito
              </span>
              <h3 id="unauthorized-title" className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-tight">
                Acesso Não Autorizado
              </h3>
            </div>
          </div>

          {/* Mensagem e Motivo */}
          <div className="mb-6 space-y-3">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
              <p className="text-sm font-semibold text-slate-700 leading-relaxed">
                {reason || 'Seu perfil de usuário não possui permissão ativa para visualizar ou operar este módulo.'}
              </p>
            </div>

            {route && (
              <div className="flex items-center gap-2 text-xs font-medium text-slate-500 bg-white p-2.5 rounded-xl border border-slate-200/80">
                <span className="font-bold text-slate-600 uppercase tracking-wide text-[10px]">Rota solicitada:</span>
                <code className="text-rose-600 font-mono text-[11px] bg-rose-50/80 px-2 py-0.5 rounded-md truncate max-w-full">
                  {route}
                </code>
              </div>
            )}
          </div>

          {/* Dica de Segurança & Orientação */}
          <div className="p-3.5 mb-6 rounded-2xl bg-amber-50/60 border border-amber-200/60 flex items-start gap-2.5">
            <AlertOctagon className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-900 leading-relaxed font-medium">
              O Controle de Acesso é estrito e individual. Caso necessite de acesso a esta funcionalidade, solicite a ativação das permissões correspondentes ao administrador do sistema.
            </p>
          </div>

          {/* Botões de Ação */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 hover:from-slate-800 hover:to-indigo-900 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-slate-900/20 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <Home className="w-4 h-4" />
              <span>Voltar ao Início</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
