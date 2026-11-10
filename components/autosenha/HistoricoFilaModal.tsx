import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  ListOrdered, History, X, Clock, Search, Calendar,
  ArrowUpDown, ChevronLeft, ChevronRight, AlertTriangle,
  RefreshCw, CheckCircle2, UserX, XCircle, RotateCcw, Play, Users,
  Lock, Sparkles, ShieldAlert
} from 'lucide-react';
import {
  AutoSenhaUnidadeId,
  AutoSenhaItem,
  AutoSenhaBloco,
  AutoSenhaConfiguracao,
  AutoSenhaStatus,
  AutoSenhaAvaliacaoUrgente
} from '../../types';
import {
  getBlocosFilaDoDia,
  getHistoricoAtendimentosUnidade,
  getAvaliacoesImediatasUnidade,
  HistoricoPeriodoFiltro,
  getDataOperacionalHoje
} from '../../services/autoSenhaService';

export type HistoricoFilaModalTab = 'fila' | 'historico' | 'avaliacoes';

export interface HistoricoFilaModalProps {
  isOpen: boolean;
  initialTab?: HistoricoFilaModalTab;
  unidadeId: AutoSenhaUnidadeId;
  unidadeNome: string;
  unidadeSigla: string;
  senhasDia: AutoSenhaItem[];
  blocosDia?: AutoSenhaBloco[];
  avaliacoesImediatas?: AutoSenhaAvaliacaoUrgente[];
  config: AutoSenhaConfiguracao | null;
  onClose: () => void;
  onTabChange?: (tab: HistoricoFilaModalTab) => void;
  onCancelarSenha: (senha: AutoSenhaItem) => void;
  onConcluirAcolhimentoImediato?: (avaliacao: AutoSenhaAvaliacaoUrgente) => void;
  onRechamar?: (senha: AutoSenhaItem) => void;
  onIniciar?: (senha: AutoSenhaItem) => void;
  onConcluir?: (senha: AutoSenhaItem) => void;
}

const PRIORIDADE_BADGE: Record<string, string> = {
  ESPECIAL: 'bg-purple-100 text-purple-800 border-purple-200',
  PRIORITARIO: 'bg-amber-100 text-amber-800 border-amber-200',
  NORMAL: 'bg-sky-100 text-sky-800 border-sky-200'
};

const SENHA_PILL: Record<string, string> = {
  ESPECIAL: 'bg-purple-50 text-purple-700 border-purple-200',
  PRIORITARIO: 'bg-amber-50 text-amber-700 border-amber-200',
  NORMAL: 'bg-sky-50 text-sky-700 border-sky-200'
};

function formatarHora(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatarDataCurta(dataIso?: string): string {
  if (!dataIso) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dataIso);
  if (!match) return dataIso;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function formatarTempoEspera(item: AutoSenhaItem, agoraMs: number): string {
  if (typeof item.wait_time_first_call_seconds === 'number' && item.status !== 'AGUARDANDO') {
    const min = Math.floor(item.wait_time_first_call_seconds / 60);
    const seg = item.wait_time_first_call_seconds % 60;
    return min > 0 ? `${min} min` : `${seg}s`;
  }
  const diffSeg = Math.max(0, Math.floor((agoraMs - new Date(item.created_at).getTime()) / 1000));
  const min = Math.floor(diffSeg / 60);
  const horas = Math.floor(min / 60);
  const restoMin = min % 60;
  if (horas > 0) return `${horas}h ${String(restoMin).padStart(2, '0')}m`;
  if (min > 0) return `${String(min).padStart(2, '0')} min`;
  return `${diffSeg}s`;
}

export const HistoricoFilaModal: React.FC<HistoricoFilaModalProps> = ({
  isOpen,
  initialTab = 'fila',
  unidadeId,
  unidadeNome,
  unidadeSigla,
  senhasDia,
  blocosDia,
  avaliacoesImediatas,
  onClose,
  onTabChange,
  onCancelarSenha,
  onConcluirAcolhimentoImediato,
  onRechamar,
  onIniciar,
  onConcluir
}) => {
  const [activeTab, setActiveTab] = useState<HistoricoFilaModalTab>(initialTab);
  const [agoraMs, setAgoraMs] = useState<number>(() => Date.now());

  // Estados da Aba 2 — Histórico de Atendimentos
  const [buscaInput, setBuscaInput] = useState('');
  const [buscaDebounced, setBuscaDebounced] = useState('');
  const [periodoFiltro, setPeriodoFiltro] = useState<HistoricoPeriodoFiltro>('todos');
  const [dataEspecifica, setDataEspecifica] = useState<string>(() => getDataOperacionalHoje());
  const [statusFiltro, setStatusFiltro] = useState<'TODOS' | AutoSenhaStatus>('TODOS');
  const [ordemHorario, setOrdemHorario] = useState<'desc' | 'asc'>('desc');
  const [paginaAtual, setPaginaAtual] = useState<number>(1);
  const PAGE_SIZE = 15;

  const [historicoItems, setHistoricoItems] = useState<AutoSenhaItem[]>([]);
  const [historicoTotal, setHistoricoTotal] = useState<number>(0);
  const [historicoTotalPages, setHistoricoTotalPages] = useState<number>(1);
  const [isLoadingHistorico, setIsLoadingHistorico] = useState<boolean>(false);
  const [historicoError, setHistoricoError] = useState<string | null>(null);

  // Estados da Aba 3 — Registro Específico de Avaliações Imediatas
  const [avaliacoesLista, setAvaliacoesLista] = useState<AutoSenhaAvaliacaoUrgente[]>(avaliacoesImediatas || []);
  const [isLoadingAvaliacoes, setIsLoadingAvaliacoes] = useState<boolean>(false);
  const [avaliacoesError, setAvaliacoesError] = useState<string | null>(null);

  const hojeIso = getDataOperacionalHoje();

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  const trocarAba = (tab: HistoricoFilaModalTab) => {
    setActiveTab(tab);
    onTabChange?.(tab);
  };

  // Trava scroll do body enquanto modal estiver aberto e habilita fechamento por ESC
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Atualização periódica dos tempos de espera apenas enquanto modal aberto
  useEffect(() => {
    if (!isOpen) return;
    setAgoraMs(Date.now());
    const timer = setInterval(() => setAgoraMs(Date.now()), 30000);
    return () => clearInterval(timer);
  }, [isOpen]);

  // Debounce da busca na aba de histórico
  useEffect(() => {
    const t = setTimeout(() => {
      setBuscaDebounced(buscaInput.trim());
      setPaginaAtual(1);
    }, 300);
    return () => clearTimeout(t);
  }, [buscaInput]);

  useEffect(() => {
    setPaginaAtual(1);
  }, [unidadeId]);

  // Blocos de 5 do dia (fechados + bloco em formação)
  const blocosDoDia = useMemo(() => {
    const somenteUnidade = senhasDia.filter(s => s.unidade_id === unidadeId);
    const blocosUnidade = (blocosDia || []).filter(b => b.unidade_id === unidadeId);
    return getBlocosFilaDoDia(somenteUnidade, blocosUnidade);
  }, [senhasDia, blocosDia, unidadeId]);

  const totalAguardando = useMemo(() => {
    return senhasDia.filter(s => s.unidade_id === unidadeId && s.status === 'AGUARDANDO').length;
  }, [senhasDia, unidadeId]);

  // Consulta Aba 2 — Histórico de Atendimentos
  const carregarHistorico = useCallback(async () => {
    if (!isOpen || activeTab !== 'historico') return;
    setIsLoadingHistorico(true);
    setHistoricoError(null);
    try {
      const res = await getHistoricoAtendimentosUnidade({
        unidadeId,
        periodo: periodoFiltro,
        dataEspecifica: periodoFiltro === 'data_especifica' ? dataEspecifica : undefined,
        status: statusFiltro,
        busca: buscaDebounced,
        ordem: ordemHorario,
        page: paginaAtual,
        pageSize: PAGE_SIZE
      });

      if (res.error) {
        setHistoricoItems([]);
        setHistoricoTotal(0);
        setHistoricoTotalPages(1);
        setHistoricoError(res.error);
      } else {
        setHistoricoItems(res.items);
        setHistoricoTotal(res.total);
        setHistoricoTotalPages(res.totalPages);
      }
    } catch (err: any) {
      setHistoricoItems([]);
      setHistoricoTotal(0);
      setHistoricoTotalPages(1);
      setHistoricoError(err?.message || 'Erro inesperado ao consultar histórico da unidade.');
    } finally {
      setIsLoadingHistorico(false);
    }
  }, [
    isOpen,
    activeTab,
    unidadeId,
    periodoFiltro,
    dataEspecifica,
    statusFiltro,
    buscaDebounced,
    ordemHorario,
    paginaAtual
  ]);

  useEffect(() => {
    carregarHistorico();
  }, [carregarHistorico]);

  // Consulta Aba 3 — Registro Específico de Avaliações Imediatas
  const carregarAvaliacoes = useCallback(async () => {
    if (!isOpen) return;
    setIsLoadingAvaliacoes(true);
    setAvaliacoesError(null);
    try {
      const lista = await getAvaliacoesImediatasUnidade(unidadeId, true);
      setAvaliacoesLista(lista);
    } catch (err: any) {
      setAvaliacoesError(err?.message || 'Erro ao carregar registros de Avaliação Imediata.');
    } finally {
      setIsLoadingAvaliacoes(false);
    }
  }, [isOpen, unidadeId]);

  useEffect(() => {
    if (isOpen && activeTab === 'avaliacoes') {
      carregarAvaliacoes();
    } else if (avaliacoesImediatas) {
      setAvaliacoesLista(avaliacoesImediatas);
    }
  }, [isOpen, activeTab, avaliacoesImediatas, carregarAvaliacoes]);

  if (!isOpen) return null;

  const renderPrioridadeBadge = (tipo: string) => {
    const label = tipo === 'PRIORITARIO' ? 'PRIORITÁRIO' : tipo;
    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${
          PRIORIDADE_BADGE[tipo] || PRIORIDADE_BADGE.NORMAL
        }`}
      >
        {label}
      </span>
    );
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'CONCLUIDO':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" /> Concluído
          </span>
        );
      case 'NAO_COMPARECEU':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-200">
            <UserX className="w-3 h-3" /> Não Compareceu
          </span>
        );
      case 'CANCELADO':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-slate-200 text-slate-700 border border-slate-300">
            <XCircle className="w-3 h-3" /> Cancelado
          </span>
        );
      case 'CHAMANDO':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-sky-100 text-sky-800 border border-sky-200">
            Chamando
          </span>
        );
      case 'EM_ATENDIMENTO':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-200">
            Em Atendimento
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-800 border border-indigo-200">
            Aguardando
          </span>
        );
    }
  };

  const temFiltrosAtivos =
    buscaDebounced.length > 0 ||
    statusFiltro !== 'TODOS' ||
    periodoFiltro !== 'todos';

  const blocosFechadosCount = blocosDoDia.filter(b => b.status === 'FECHADO').length;
  const avaliacoesAbertasCount = avaliacoesLista.filter(a => a.status !== 'ATENDIDO').length;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-fade-in"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="historico-fila-modal-title"
    >
      <div className="bg-white rounded-3xl w-[95vw] md:w-[90vw] lg:w-[82vw] max-w-6xl max-h-[90vh] flex flex-col shadow-2xl border border-slate-200/80 overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Cabeçalho com Gradiente Azul -> Roxo */}
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 px-5 sm:px-7 py-4 sm:py-5 text-white flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center shrink-0">
              <ListOrdered className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 id="historico-fila-modal-title" className="text-base sm:text-xl font-black tracking-tight truncate">
                  Histórico da Fila
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-white/15 border border-white/20 text-[10px] font-black uppercase tracking-wider">
                  {unidadeSigla}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-indigo-100 font-medium truncate">
                Blocos de 5 pacientes, atendimentos realizados e Avaliações Imediatas — {unidadeNome}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
            aria-label="Fechar modal Histórico da Fila"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navegação em 3 Abas: Fila em Blocos, Histórico de Atendimentos, Avaliações Imediatas */}
        <div className="px-5 sm:px-7 pt-3.5 pb-3 bg-slate-50/70 border-b border-slate-200 shrink-0">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-1 bg-slate-200/60 rounded-2xl">
            <button
              type="button"
              onClick={() => trocarAba('fila')}
              className={`py-2 px-3 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeTab === 'fila'
                  ? 'bg-white text-indigo-700 shadow-sm border border-indigo-200/80'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-4 h-4 shrink-0" />
              <span>Fila Atual ({totalAguardando})</span>
            </button>

            <button
              type="button"
              onClick={() => trocarAba('historico')}
              className={`py-2 px-3 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeTab === 'historico'
                  ? 'bg-white text-indigo-700 shadow-sm border border-indigo-200/80'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <History className="w-4 h-4 shrink-0" />
              <span>Histórico de Atendimentos</span>
            </button>

            <button
              type="button"
              onClick={() => trocarAba('avaliacoes')}
              className={`py-2 px-3 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeTab === 'avaliacoes'
                  ? 'bg-white text-red-700 shadow-sm border border-red-200/80'
                  : 'text-slate-600 hover:text-red-700'
              }`}
            >
              <ShieldAlert className="w-4 h-4 shrink-0 text-red-600" />
              <span>Avaliações Imediatas</span>
              {avaliacoesAbertasCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-red-600 text-white text-[10px] font-black">
                  {avaliacoesAbertasCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Corpo Interno com Scroll Controlado */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-white">
          {activeTab === 'fila' ? (
            <div className="flex-1 min-h-0 flex flex-col p-4 sm:p-6 overflow-y-auto gap-4">
              {/* Cabeçalho Informativo dos Blocos de 5 */}
              <div className="flex flex-wrap items-center justify-between gap-2 shrink-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs sm:text-sm font-black text-slate-800">
                    Organização por Blocos de 5 (E → P → E → P → N)
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-bold">
                    {blocosFechadosCount} {blocosFechadosCount === 1 ? 'bloco fechado' : 'blocos fechados'}
                  </span>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-black">
                  {totalAguardando} aguardando na fila
                </span>
              </div>

              {blocosDoDia.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center py-12 px-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50">
                  <Users className="w-10 h-10 text-slate-300 mb-2" />
                  <p className="text-sm font-bold text-slate-600">
                    Nenhum bloco formado nesta unidade hoje.
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Novas senhas emitidas formarão blocos dinâmicos consecutivos de 5 pacientes.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {blocosDoDia.map(bloco => {
                    const isFechado = bloco.status === 'FECHADO';
                    return (
                      <div
                        key={bloco.numero_bloco}
                        className={`rounded-2xl border overflow-hidden ${
                          isFechado ? 'border-slate-200 bg-white' : 'border-indigo-200 bg-indigo-50/20'
                        }`}
                      >
                        {/* Cabeçalho do Bloco */}
                        <div
                          className={`px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 border-b ${
                            isFechado ? 'bg-slate-100/80 border-slate-200' : 'bg-indigo-50/90 border-indigo-200'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {isFechado ? (
                              <Lock className="w-4 h-4 text-slate-600" />
                            ) : (
                              <Sparkles className="w-4 h-4 text-indigo-600" />
                            )}
                            <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                              Bloco #{bloco.numero_bloco}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                isFechado
                                  ? 'bg-slate-800 text-white'
                                  : 'bg-indigo-600 text-white'
                              }`}
                            >
                              {isFechado ? 'Fechado (Consolidado)' : 'Em Formação (Posições Provisórias)'}
                            </span>
                          </div>
                          <span className="text-[11px] font-black text-slate-600">
                            {bloco.total_pacientes} / 5 pacientes
                          </span>
                        </div>

                        {bloco.itens.length === 0 ? (
                          <div className="py-5 px-4 text-center text-xs text-slate-400 font-semibold">
                            Bloco aberto aguardando próximas senhas emitidas.
                          </div>
                        ) : (
                          <>
                            {/* Tabela Desktop */}
                            <div className="hidden md:block overflow-x-auto">
                              <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50/80 border-b border-slate-200">
                                  <tr className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                                    <th className="py-2.5 px-3.5 w-24">Posição</th>
                                    <th className="py-2.5 px-3.5 w-24">Senha</th>
                                    <th className="py-2.5 px-3.5">Paciente</th>
                                    <th className="py-2.5 px-3.5 w-32">Classificação</th>
                                    <th className="py-2.5 px-3.5 w-24">Chegada</th>
                                    <th className="py-2.5 px-3.5 w-28">Espera</th>
                                    <th className="py-2.5 px-3.5 w-36">Status</th>
                                    <th className="py-2.5 px-3.5 w-24 text-right">Ações</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-xs">
                                  {bloco.itens.map(entry => {
                                    const s = entry.senha;
                                    return (
                                      <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                                        <td className="py-2.5 px-3.5">
                                          <div className="flex items-center gap-1.5">
                                            <span className="font-black text-slate-800">{entry.posicao_no_bloco}º</span>
                                            <span
                                              className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                                                entry.posicao_provisoria
                                                  ? 'bg-indigo-50 text-indigo-700'
                                                  : 'bg-slate-100 text-slate-600'
                                              }`}
                                            >
                                              {entry.posicao_provisoria ? 'Provisória' : 'Fixa'}
                                            </span>
                                          </div>
                                        </td>
                                        <td className="py-2.5 px-3.5">
                                          <span
                                            className={`inline-block px-2 py-0.5 rounded-lg font-black text-xs border ${
                                              SENHA_PILL[s.prioridade_tipo] || SENHA_PILL.NORMAL
                                            }`}
                                          >
                                            {s.numero}
                                          </span>
                                        </td>
                                        <td className="py-2.5 px-3.5 font-black text-slate-800 uppercase">
                                          {s.cidadao_nome}
                                        </td>
                                        <td className="py-2.5 px-3.5">{renderPrioridadeBadge(s.prioridade_tipo)}</td>
                                        <td className="py-2.5 px-3.5 font-mono font-bold text-slate-600">
                                          {formatarHora(s.created_at)}
                                        </td>
                                        <td className="py-2.5 px-3.5 font-bold text-slate-600">
                                          <span className="inline-flex items-center gap-1">
                                            <Clock className="w-3 h-3 text-slate-400" />
                                            {formatarTempoEspera(s, agoraMs)}
                                          </span>
                                        </td>
                                        <td className="py-2.5 px-3.5">{renderStatusBadge(s.status)}</td>
                                        <td className="py-2.5 px-3.5 text-right">
                                          {s.status === 'AGUARDANDO' ? (
                                            <button
                                              type="button"
                                              onClick={() => onCancelarSenha(s)}
                                              className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 font-bold text-[11px] transition-colors cursor-pointer"
                                            >
                                              Cancelar
                                            </button>
                                          ) : (
                                            <span className="text-[10px] text-slate-400 font-semibold">—</span>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>

                            {/* Cards Mobile */}
                            <div className="md:hidden p-3 flex flex-col gap-2">
                              {bloco.itens.map(entry => {
                                const s = entry.senha;
                                return (
                                  <div
                                    key={s.id}
                                    className="p-3 rounded-xl border border-slate-200 bg-white flex flex-col gap-1.5"
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-xs font-black text-slate-700">
                                          {entry.posicao_no_bloco}º ({entry.posicao_provisoria ? 'Provisória' : 'Fixa'})
                                        </span>
                                        <span
                                          className={`px-2 py-0.5 rounded-lg font-black text-xs border ${
                                            SENHA_PILL[s.prioridade_tipo] || SENHA_PILL.NORMAL
                                          }`}
                                        >
                                          {s.numero}
                                        </span>
                                      </div>
                                      {renderPrioridadeBadge(s.prioridade_tipo)}
                                    </div>
                                    <div className="font-black text-xs text-slate-800 uppercase break-words">
                                      {s.cidadao_nome}
                                    </div>
                                    <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                                      <span>
                                        Chegada: <strong>{formatarHora(s.created_at)}</strong> • Espera:{' '}
                                        <strong>{formatarTempoEspera(s, agoraMs)}</strong>
                                      </span>
                                      {renderStatusBadge(s.status)}
                                    </div>
                                    {s.status === 'AGUARDANDO' && (
                                      <div className="flex justify-end pt-1">
                                        <button
                                          type="button"
                                          onClick={() => onCancelarSenha(s)}
                                          className="px-2.5 py-1 rounded-lg bg-slate-100 text-rose-600 font-bold text-[11px] cursor-pointer"
                                        >
                                          Cancelar
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : activeTab === 'historico' ? (
            <div className="flex-1 min-h-0 flex flex-col p-4 sm:p-6 overflow-hidden gap-3">
              {/* Filtros Dinâmicos do Histórico */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 shrink-0">
                <div className="lg:col-span-4 relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={buscaInput}
                    onChange={e => setBuscaInput(e.target.value)}
                    placeholder="Buscar paciente ou senha..."
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="lg:col-span-3 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-slate-400 shrink-0 hidden sm:block" />
                  <select
                    value={periodoFiltro}
                    onChange={e => {
                      setPeriodoFiltro(e.target.value as HistoricoPeriodoFiltro);
                      setPaginaAtual(1);
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
                    aria-label="Filtrar período do histórico"
                  >
                    <option value="todos">Todo o Histórico</option>
                    <option value="hoje">Hoje ({formatarDataCurta(hojeIso)})</option>
                    <option value="7_dias">Últimos 7 dias</option>
                    <option value="30_dias">Últimos 30 dias</option>
                    <option value="data_especifica">Data específica</option>
                  </select>
                </div>

                {periodoFiltro === 'data_especifica' && (
                  <div className="lg:col-span-2">
                    <input
                      type="date"
                      value={dataEspecifica}
                      onChange={e => {
                        setDataEspecifica(e.target.value);
                        setPaginaAtual(1);
                      }}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                )}

                <div className={periodoFiltro === 'data_especifica' ? 'lg:col-span-2' : 'lg:col-span-3'}>
                  <select
                    value={statusFiltro}
                    onChange={e => {
                      setStatusFiltro(e.target.value as 'TODOS' | AutoSenhaStatus);
                      setPaginaAtual(1);
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
                    aria-label="Filtrar status do histórico"
                  >
                    <option value="TODOS">Todos os Status</option>
                    <option value="CONCLUIDO">Concluído</option>
                    <option value="NAO_COMPARECEU">Não Compareceu</option>
                    <option value="CANCELADO">Cancelado</option>
                    <option value="EM_ATENDIMENTO">Em Atendimento</option>
                    <option value="CHAMANDO">Chamando</option>
                    <option value="AGUARDANDO">Aguardando</option>
                  </select>
                </div>

                <div className={periodoFiltro === 'data_especifica' ? 'lg:col-span-1 flex' : 'lg:col-span-2 flex gap-1.5'}>
                  <button
                    type="button"
                    onClick={() => {
                      setOrdemHorario(prev => (prev === 'desc' ? 'asc' : 'desc'));
                      setPaginaAtual(1);
                    }}
                    className="flex-1 px-2.5 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl text-[11px] font-bold text-slate-700 flex items-center justify-center gap-1 cursor-pointer transition-colors"
                    title="Alternar ordenação por data/horário"
                  >
                    <ArrowUpDown className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{ordemHorario === 'desc' ? 'Recentes' : 'Antigos'}</span>
                  </button>
                </div>
              </div>

              {isLoadingHistorico ? (
                <div className="flex-1 flex flex-col items-center justify-center py-12 gap-3 text-slate-500">
                  <RefreshCw className="w-7 h-7 animate-spin text-indigo-600" />
                  <p className="text-xs font-bold uppercase tracking-wider">
                    Carregando histórico da unidade {unidadeSigla}...
                  </p>
                </div>
              ) : historicoError ? (
                <div className="flex-1 flex flex-col items-center justify-center py-10 px-4 text-center rounded-2xl border border-rose-200 bg-rose-50/70 gap-3">
                  <AlertTriangle className="w-9 h-9 text-rose-500" />
                  <div>
                    <p className="text-sm font-black text-rose-800">Erro ao consultar o histórico</p>
                    <p className="text-xs text-rose-700 mt-1 max-w-md">{historicoError}</p>
                  </div>
                  <button
                    type="button"
                    onClick={carregarHistorico}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black uppercase tracking-wider cursor-pointer flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Tentar novamente
                  </button>
                </div>
              ) : historicoItems.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-12 px-4 text-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 gap-2">
                  <History className="w-9 h-9 text-slate-300" />
                  <p className="text-sm font-bold text-slate-600">
                    Nenhum registro encontrado para esta consulta.
                  </p>
                  <p className="text-xs text-slate-400">
                    {temFiltrosAtivos
                      ? 'Tente ajustar a busca, o status ou o período selecionado.'
                      : `Ainda não há atendimentos registrados na unidade ${unidadeSigla}.`}
                  </p>
                  {temFiltrosAtivos && (
                    <button
                      type="button"
                      onClick={() => {
                        setBuscaInput('');
                        setBuscaDebounced('');
                        setStatusFiltro('TODOS');
                        setPeriodoFiltro('todos');
                        setPaginaAtual(1);
                      }}
                      className="mt-2 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold cursor-pointer"
                    >
                      Limpar filtros
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {/* Tabela Desktop */}
                  <div className="hidden md:block flex-1 min-h-0 overflow-y-auto rounded-2xl border border-slate-200">
                    <table className="w-full text-left border-collapse">
                      <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200">
                        <tr className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                          <th className="py-3 px-4 w-28">Senha / Bloco</th>
                          <th className="py-3 px-4">Paciente</th>
                          <th className="py-3 px-4 w-32">Classificação</th>
                          <th className="py-3 px-4 w-28">Chamada</th>
                          <th className="py-3 px-4 w-28">Atendimento</th>
                          <th className="py-3 px-4 w-44">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {historicoItems.map(item => {
                          const isHojeAtivo =
                            item.data_operacional === hojeIso &&
                            (item.status === 'CHAMANDO' || item.status === 'EM_ATENDIMENTO' || item.status === 'AGUARDANDO');
                          return (
                            <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                              <td className="py-3 px-4">
                                <span
                                  className={`inline-block px-2.5 py-1 rounded-xl font-black text-xs border ${
                                    SENHA_PILL[item.prioridade_tipo] || SENHA_PILL.NORMAL
                                  }`}
                                >
                                  {item.numero}
                                </span>
                                {item.bloco_numero && (
                                  <div className="text-[10px] font-bold text-slate-400 mt-1">
                                    Bloco #{item.bloco_numero}{item.posicao_bloco ? ` • ${item.posicao_bloco}º` : ''}
                                  </div>
                                )}
                              </td>
                              <td className="py-3 px-4">
                                <div className="font-black text-slate-800 uppercase">{item.cidadao_nome}</div>
                                <div className="text-[10px] font-semibold text-slate-400">
                                  {formatarDataCurta(item.data_operacional)} • Chegada {formatarHora(item.created_at)}
                                </div>
                              </td>
                              <td className="py-3 px-4">{renderPrioridadeBadge(item.prioridade_tipo)}</td>
                              <td className="py-3 px-4 font-bold text-slate-700">
                                {formatarHora(item.last_called_at || item.first_called_at)}
                              </td>
                              <td className="py-3 px-4 font-bold text-slate-700">
                                {formatarHora(item.service_started_at || item.service_finished_at)}
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex flex-col items-start gap-1.5">
                                  {renderStatusBadge(item.status)}
                                  {isHojeAtivo && (
                                    <div className="flex items-center gap-1 flex-wrap">
                                      {item.status === 'CHAMANDO' && onRechamar && (
                                        <button
                                          type="button"
                                          onClick={() => onRechamar(item)}
                                          className="px-1.5 py-0.5 rounded bg-sky-50 hover:bg-sky-100 text-sky-700 text-[10px] font-bold flex items-center gap-0.5 cursor-pointer"
                                        >
                                          <RotateCcw className="w-2.5 h-2.5" /> Rechamar
                                        </button>
                                      )}
                                      {item.status === 'CHAMANDO' && onIniciar && (
                                        <button
                                          type="button"
                                          onClick={() => onIniciar(item)}
                                          className="px-1.5 py-0.5 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[10px] font-bold flex items-center gap-0.5 cursor-pointer"
                                        >
                                          <Play className="w-2.5 h-2.5" /> Iniciar
                                        </button>
                                      )}
                                      {(item.status === 'CHAMANDO' || item.status === 'EM_ATENDIMENTO') && onConcluir && (
                                        <button
                                          type="button"
                                          onClick={() => onConcluir(item)}
                                          className="px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-bold cursor-pointer"
                                        >
                                          Concluir
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Cards Mobile */}
                  <div className="md:hidden flex-1 min-h-0 overflow-y-auto flex flex-col gap-2.5 pr-0.5">
                    {historicoItems.map(item => (
                      <div
                        key={item.id}
                        className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/50 flex flex-col gap-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`px-2.5 py-0.5 rounded-lg font-black text-xs border ${
                                SENHA_PILL[item.prioridade_tipo] || SENHA_PILL.NORMAL
                              }`}
                            >
                              {item.numero}
                            </span>
                            {item.bloco_numero && (
                              <span className="text-[10px] font-bold text-slate-500">
                                Bloco #{item.bloco_numero}
                              </span>
                            )}
                          </div>
                          {renderStatusBadge(item.status)}
                        </div>
                        <div className="font-black text-xs text-slate-800 uppercase break-words">
                          {item.cidadao_nome}
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                          {renderPrioridadeBadge(item.prioridade_tipo)}
                          <span>
                            {formatarDataCurta(item.data_operacional)} • Cham: <strong>{formatarHora(item.last_called_at || item.first_called_at)}</strong> • Atend: <strong>{formatarHora(item.service_started_at)}</strong>
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Barra de Paginação */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 shrink-0 text-xs">
                    <span className="text-slate-500 font-semibold">
                      Exibindo <strong className="text-slate-800">{historicoItems.length}</strong> de{' '}
                      <strong className="text-slate-800">{historicoTotal}</strong> registros
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={paginaAtual <= 1 || isLoadingHistorico}
                        onClick={() => setPaginaAtual(p => Math.max(1, p - 1))}
                        className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" /> Anterior
                      </button>
                      <span className="px-2.5 py-1 font-bold text-slate-600">
                        {paginaAtual} / {historicoTotalPages}
                      </span>
                      <button
                        type="button"
                        disabled={paginaAtual >= historicoTotalPages || isLoadingHistorico}
                        onClick={() => setPaginaAtual(p => Math.min(historicoTotalPages, p + 1))}
                        className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 font-bold flex items-center gap-1 cursor-pointer"
                      >
                        Próxima <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="flex-1 min-h-0 flex flex-col p-4 sm:p-6 overflow-hidden gap-3">
              {/* Banner Informativo de Avaliação Imediata */}
              <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-red-900 flex flex-wrap items-center justify-between gap-2 shrink-0">
                <div className="flex items-start gap-2.5 min-w-0">
                  <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div className="text-xs leading-snug">
                    <strong className="font-black uppercase block">
                      Registro de Avaliações Imediatas — Prioridade Máxima Fora dos Blocos
                    </strong>
                    <span className="text-red-800">
                      Solicitações acionadas diretamente para acolhimento imediato pela equipe assistencial, sem ocupar vaga nos blocos de 5.
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={carregarAvaliacoes}
                  className="px-3 py-1.5 rounded-xl bg-white border border-red-200 text-red-700 hover:bg-red-100 text-[11px] font-black cursor-pointer flex items-center gap-1 shrink-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingAvaliacoes ? 'animate-spin' : ''}`} /> Atualizar
                </button>
              </div>

              {isLoadingAvaliacoes ? (
                <div className="flex-1 flex flex-col items-center justify-center py-12 gap-3 text-slate-500">
                  <RefreshCw className="w-7 h-7 animate-spin text-red-600" />
                  <p className="text-xs font-bold uppercase tracking-wider">Carregando avaliações imediatas...</p>
                </div>
              ) : avaliacoesError ? (
                <div className="flex-1 flex flex-col items-center justify-center py-10 px-4 text-center rounded-2xl border border-rose-200 bg-rose-50/70 gap-3">
                  <AlertTriangle className="w-8 h-8 text-rose-500" />
                  <p className="text-xs font-bold text-rose-800">{avaliacoesError}</p>
                </div>
              ) : avaliacoesLista.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-12 px-4 text-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 gap-2">
                  <ShieldAlert className="w-9 h-9 text-slate-300" />
                  <p className="text-sm font-bold text-slate-600">
                    Nenhuma solicitação de Avaliação Imediata registrada nesta unidade.
                  </p>
                </div>
              ) : (
                <>
                  {/* Tabela Desktop Avaliações Imediatas */}
                  <div className="hidden md:block flex-1 min-h-0 overflow-y-auto rounded-2xl border border-slate-200">
                    <table className="w-full text-left border-collapse">
                      <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200">
                        <tr className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                          <th className="py-3 px-4">Identificação / Paciente</th>
                          <th className="py-3 px-4">Motivo / Situação</th>
                          <th className="py-3 px-4 w-36">Responsável</th>
                          <th className="py-3 px-4 w-28">Solicitação</th>
                          <th className="py-3 px-4 w-28">Encaminh.</th>
                          <th className="py-3 px-4 w-28">Acolhimento</th>
                          <th className="py-3 px-4 w-40 text-right">Status / Ação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {avaliacoesLista.map(av => (
                          <tr key={av.id} className="hover:bg-red-50/30 transition-colors">
                            <td className="py-3 px-4">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-600 text-white text-[9px] font-black uppercase mb-1">
                                <AlertTriangle className="w-2.5 h-2.5" /> AVALIAÇÃO IMEDIATA
                              </span>
                              <div className="font-black text-slate-900 uppercase">{av.cidadao_nome}</div>
                              <div className="text-[10px] text-slate-400 font-semibold">
                                {formatarDataCurta(av.created_at.slice(0, 10))}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-slate-700 font-medium">{av.motivo_queixa}</td>
                            <td className="py-3 px-4 font-bold text-slate-700">{av.solicitante_nome}</td>
                            <td className="py-3 px-4 font-mono font-bold text-slate-700">
                              {formatarHora(av.created_at)}
                            </td>
                            <td className="py-3 px-4 font-mono font-bold text-slate-700">
                              {formatarHora(av.encaminhado_em || av.created_at)}
                            </td>
                            <td className="py-3 px-4 font-mono font-bold text-slate-700">
                              {formatarHora(av.atendido_em)}
                            </td>
                            <td className="py-3 px-4 text-right">
                              {av.status === 'ATENDIDO' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-black">
                                  <CheckCircle2 className="w-3 h-3" /> Acolhido
                                </span>
                              ) : (
                                <div className="flex flex-col items-end gap-1">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-200 text-[10px] font-black">
                                    Encaminhado Presencial
                                  </span>
                                  {onConcluirAcolhimentoImediato && (
                                    <button
                                      type="button"
                                      onClick={() => onConcluirAcolhimentoImediato(av)}
                                      className="px-2 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[10px] font-black uppercase cursor-pointer"
                                    >
                                      Confirmar Acolhimento
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Cards Mobile Avaliações Imediatas */}
                  <div className="md:hidden flex-1 min-h-0 overflow-y-auto flex flex-col gap-2.5">
                    {avaliacoesLista.map(av => (
                      <div
                        key={av.id}
                        className="p-3.5 rounded-2xl border border-red-200 bg-red-50/40 flex flex-col gap-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="px-2 py-0.5 rounded-full bg-red-600 text-white text-[9px] font-black uppercase">
                            AVALIAÇÃO IMEDIATA
                          </span>
                          <span className="text-[10px] font-bold text-slate-600">
                            {av.status === 'ATENDIDO' ? 'Acolhido' : 'Encaminhado Presencial'}
                          </span>
                        </div>
                        <div className="font-black text-xs text-slate-900 uppercase">{av.cidadao_nome}</div>
                        <p className="text-xs text-slate-700">{av.motivo_queixa}</p>
                        <div className="text-[10px] text-slate-500">
                          Solic.: <strong>{formatarHora(av.created_at)}</strong> • Enc.:{' '}
                          <strong>{formatarHora(av.encaminhado_em || av.created_at)}</strong> • Acolh.:{' '}
                          <strong>{formatarHora(av.atendido_em)}</strong>
                        </div>
                        {av.status !== 'ATENDIDO' && onConcluirAcolhimentoImediato && (
                          <button
                            type="button"
                            onClick={() => onConcluirAcolhimentoImediato(av)}
                            className="mt-1 px-3 py-1.5 rounded-xl bg-red-600 text-white text-[10px] font-black uppercase cursor-pointer self-end"
                          >
                            Confirmar Acolhimento
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Rodapé do Modal */}
        <div className="px-5 sm:px-7 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <span className="text-[11px] font-semibold text-slate-400">
            Blocos de 5 e histórico isolados por unidade ({unidadeSigla}) • Registros preservados integralmente
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 text-xs font-black uppercase tracking-wider shadow-xs transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
