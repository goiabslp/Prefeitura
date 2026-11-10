import React from 'react';
import {
  Bell, Volume2, ListOrdered, Settings, RotateCcw,
  Play, CheckCircle2, UserX, XCircle
} from 'lucide-react';
import { AutoSenhaItem } from '../../types';

export interface AutoSenhaChamadaCardProps {
  regraAlternanciaLabel: string;
  isSubmitting: boolean;
  contadores: {
    aguardando: number;
    chamando: number;
    emAtendimento: number;
    concluidos: number;
  };
  senhasAtivas: AutoSenhaItem[];
  ausenteConfirmId: string | null;
  onChamarProximo: () => void;
  onRechamar: (senha: AutoSenhaItem) => void;
  onIniciar: (senha: AutoSenhaItem) => void;
  onConcluir: (senha: AutoSenhaItem) => void;
  onSolicitarConfirmAusente: (senhaId: string | null) => void;
  onConfirmarAusente: (senha: AutoSenhaItem) => void;
  onAbrirModalCancelar: (senha: AutoSenhaItem) => void;
  onAbrirHistoricoFila: () => void;
  onAbrirConfiguracoes: () => void;
}

export const AutoSenhaChamadaCard: React.FC<AutoSenhaChamadaCardProps> = ({
  regraAlternanciaLabel,
  isSubmitting,
  contadores,
  senhasAtivas,
  ausenteConfirmId,
  onChamarProximo,
  onRechamar,
  onIniciar,
  onConcluir,
  onSolicitarConfirmAusente,
  onConfirmarAusente,
  onAbrirModalCancelar,
  onAbrirHistoricoFila,
  onAbrirConfiguracoes
}) => {
  return (
    <div className="flex flex-col gap-3.5 h-full justify-between">
      {/* Card Escuro de Chamada Automática */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 rounded-3xl p-5 sm:p-6 text-white shadow-xl border border-slate-800 flex flex-col gap-4 flex-1 justify-between">
        <div>
          {/* Topo: Título e Badge de Espera */}
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-[11px] font-black uppercase tracking-widest text-slate-300">
                Chamada Automática
              </span>
            </div>
            <span className="text-[11px] font-black text-emerald-300 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
              {contadores.aguardando} {contadores.aguardando === 1 ? 'na espera' : 'na espera'}
            </span>
          </div>

          {/* Pill de Regra de Alternância */}
          <div className="flex justify-center mb-3.5">
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-[10px] sm:text-[11px] font-black tracking-widest uppercase text-emerald-300">
              {regraAlternanciaLabel}
            </span>
          </div>

          {/* Botão Compacto de Chamar Próximo Cidadão */}
          <button
            type="button"
            onClick={onChamarProximo}
            disabled={isSubmitting || contadores.aguardando === 0}
            className="w-full py-2.5 px-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-slate-950 rounded-2xl font-black text-xs sm:text-sm uppercase tracking-wider shadow-lg shadow-emerald-500/20 hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Volume2 className="w-4 h-4 shrink-0" />
            <span>Chamar Próximo Cidadão</span>
          </button>
        </div>

        {/* Chamadas e Atendimentos Ativos no Momento (Controle Direto sem Tabela Fixa) */}
        {senhasAtivas.length > 0 && (
          <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-3 flex flex-col gap-2 max-h-44 overflow-y-auto">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Em Chamada / Atendimento Atual ({senhasAtivas.length})
            </span>
            <div className="flex flex-col gap-2">
              {senhasAtivas.map(s => {
                const confirmandoAusencia = ausenteConfirmId === s.id;
                return (
                  <div
                    key={s.id}
                    className="flex flex-col gap-2 p-2.5 rounded-xl bg-slate-950/60 border border-white/10"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`px-2 py-0.5 rounded-lg text-[11px] font-black shrink-0 ${
                            s.prioridade_tipo === 'ESPECIAL'
                              ? 'bg-purple-500/20 text-purple-200 border border-purple-400/30'
                              : s.prioridade_tipo === 'PRIORITARIO'
                                ? 'bg-amber-500/20 text-amber-200 border border-amber-400/30'
                                : 'bg-sky-500/20 text-sky-200 border border-sky-400/30'
                          }`}
                        >
                          {s.numero}
                        </span>
                        <span className="text-xs font-bold text-white truncate uppercase">
                          {s.cidadao_nome}
                        </span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase shrink-0 ${
                          s.status === 'CHAMANDO'
                            ? 'bg-sky-500/20 text-sky-300 border border-sky-400/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-400/30'
                        }`}
                      >
                        {s.status === 'CHAMANDO' ? 'Chamando' : 'Atendendo'}
                      </span>
                    </div>

                    {confirmandoAusencia ? (
                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/10">
                        <span className="text-[10px] font-bold text-rose-300">
                          Confirmar ausência de {s.numero}?
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onSolicitarConfirmAusente(null)}
                            className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold cursor-pointer"
                          >
                            Não
                          </button>
                          <button
                            type="button"
                            onClick={() => onConfirmarAusente(s)}
                            className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-black cursor-pointer"
                          >
                            Sim, Ausente
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {s.status === 'CHAMANDO' && (
                          <>
                            <button
                              type="button"
                              onClick={() => onRechamar(s)}
                              className="px-2 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              <RotateCcw className="w-3 h-3" /> Rechamar
                            </button>
                            <button
                              type="button"
                              onClick={() => onIniciar(s)}
                              className="px-2 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              <Play className="w-3 h-3" /> Iniciar
                            </button>
                            <button
                              type="button"
                              onClick={() => onSolicitarConfirmAusente(s.id)}
                              className="px-2 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              <UserX className="w-3 h-3" /> Ausente
                            </button>
                          </>
                        )}
                        {(s.status === 'EM_ATENDIMENTO' || s.status === 'CHAMANDO') && (
                          <button
                            type="button"
                            onClick={() => onConcluir(s)}
                            className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <CheckCircle2 className="w-3 h-3" /> Concluir
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onAbrirModalCancelar(s)}
                          className="px-2 py-1 rounded-lg bg-white/5 hover:bg-rose-500/20 text-slate-300 hover:text-rose-200 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors ml-auto"
                          title="Cancelar senha com justificativa"
                        >
                          <XCircle className="w-3 h-3" /> Cancelar
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 4 Indicadores de Situação */}
        <div className="grid grid-cols-4 gap-2 pt-2 border-t border-white/10">
          <div className="p-2.5 rounded-2xl bg-white/[0.04] border border-white/10 text-center">
            <span className="block text-xl sm:text-2xl font-black text-emerald-400 leading-tight">
              {contadores.aguardando}
            </span>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Espera</span>
          </div>
          <div className="p-2.5 rounded-2xl bg-white/[0.04] border border-white/10 text-center">
            <span className="block text-xl sm:text-2xl font-black text-sky-400 leading-tight">
              {contadores.chamando}
            </span>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Chamando</span>
          </div>
          <div className="p-2.5 rounded-2xl bg-white/[0.04] border border-white/10 text-center">
            <span className="block text-xl sm:text-2xl font-black text-amber-400 leading-tight">
              {contadores.emAtendimento}
            </span>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Em Atend.</span>
          </div>
          <div className="p-2.5 rounded-2xl bg-white/[0.04] border border-white/10 text-center">
            <span className="block text-xl sm:text-2xl font-black text-purple-400 leading-tight">
              {contadores.concluidos}
            </span>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Concluídos</span>
          </div>
        </div>
      </div>

      {/* Botões Abaixo da Chamada Automática: Histórico da Fila + Configurações */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={onAbrirHistoricoFila}
          className="py-3.5 px-4 rounded-2xl bg-white hover:bg-indigo-50/70 text-indigo-700 border-2 border-indigo-200 hover:border-indigo-400 shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 font-black text-xs sm:text-sm uppercase tracking-wider cursor-pointer"
        >
          <ListOrdered className="w-4.5 h-4.5 text-indigo-600 shrink-0" />
          <span>Histórico da Fila</span>
          {contadores.aguardando > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-black">
              {contadores.aguardando}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={onAbrirConfiguracoes}
          className="py-3.5 px-4 rounded-2xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 hover:border-slate-300 shadow-sm transition-all flex items-center justify-center gap-2 font-black text-xs sm:text-sm uppercase tracking-wider cursor-pointer"
        >
          <Settings className="w-4.5 h-4.5 text-slate-600 shrink-0" />
          <span>Configurações</span>
        </button>
      </div>
    </div>
  );
};

