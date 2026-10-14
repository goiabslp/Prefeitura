import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft, FileDown, Activity, Clock, Users, AlertTriangle, ShieldCheck,
  TrendingUp, BarChart3, RefreshCw, Calendar, Filter, CheckCircle2,
  Ticket, AlertCircle, ArrowUpRight, Flame, HeartPulse, Building2
} from 'lucide-react';
import {
  AutoSenhaUnidadeId,
  AutoSenhaCapacidadeMetricas,
  AutoSenhaAuditoria,
  User
} from '../../types';
import {
  AUTOSENHA_UNIDADES,
  calcularMetricasUnidade,
  getMovimentacoesAuditoria,
  formatarDuracaoSegundos,
  inicializarSeedSeVazio,
  getDataOperacionalHoje
} from '../../services/autoSenhaService';
import { supabase } from '../../services/supabaseClient';

interface AutoSenhaDashboardScreenProps {
  currentUser?: User | null;
  onNavigateUnidade?: (unidadeId: AutoSenhaUnidadeId, sub: 'controle' | 'tv') => void;
  onBack?: () => void;
}

export const AutoSenhaDashboardScreen: React.FC<AutoSenhaDashboardScreenProps> = ({
  currentUser,
  onNavigateUnidade,
  onBack
}) => {
  const [abaAtiva, setAbaAtiva] = useState<'operacional' | 'capacidade' | 'auditoria'>('operacional');
  const [periodoFiltro, setPeriodoFiltro] = useState<number>(0); // 0 = Hoje, 1 = Ontem, 7 = 7d, 30 = 30d
  const [unidadeFiltro, setUnidadeFiltro] = useState<string>('TODAS');
  const [isLoading, setIsLoading] = useState(true);
  const [metricasPorUnidade, setMetricasPorUnidade] = useState<Record<AutoSenhaUnidadeId, AutoSenhaCapacidadeMetricas | null>>({
    psf1: null,
    psf2: null,
    upa: null
  });
  const [movimentacoes, setMovimentacoes] = useState<AutoSenhaAuditoria[]>([]);

  const carregarMetricas = async () => {
    try {
      await inicializarSeedSeVazio();
      const [mPsf1, mPsf2, mUpa, movs] = await Promise.all([
        calcularMetricasUnidade('psf1', periodoFiltro),
        calcularMetricasUnidade('psf2', periodoFiltro),
        calcularMetricasUnidade('upa', periodoFiltro),
        getMovimentacoesAuditoria(undefined, 30)
      ]);

      setMetricasPorUnidade({
        psf1: mPsf1,
        psf2: mPsf2,
        upa: mUpa
      });
      setMovimentacoes(movs);
    } catch (e) {
      console.error('[Dashboard] Erro ao carregar métricas:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    carregarMetricas();

    // Sincronização em tempo real de todas as unidades
    const channel = supabase.channel('autosenha-global');
    channel
      .on('broadcast', { event: 'atualizacao_geral' }, () => {
        carregarMetricas();
      })
      .subscribe();

    const interval = setInterval(carregarMetricas, 12000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [periodoFiltro]);

  // Consolidado Geral Municipal
  const consolidado = useMemo(() => {
    const list = Object.values(metricasPorUnidade).filter(Boolean) as AutoSenhaCapacidadeMetricas[];
    if (list.length === 0) {
      return {
        totalEmitidas: 0,
        aguardandoAgora: 0,
        emAtendimentoAgora: 0,
        concluidos: 0,
        naoCompareceu: 0,
        cancelados: 0,
        normais: 0,
        prioritarios: 0,
        especiais: 0,
        esperaMediaSeg: 0,
        esperaMedianaSeg: 0,
        esperaP90Seg: 0,
        atendimentoMedioSeg: 0,
        taxaConclusaoPct: 0,
        maiorEsperaSeg: 0
      };
    }

    const totalEmitidas = list.reduce((acc, m) => acc + m.total_emitidas_qtd, 0);
    const aguardandoAgora = list.reduce((acc, m) => acc + m.aguardando_qtd, 0);
    const emAtendimentoAgora = list.reduce((acc, m) => acc + m.em_atendimento_qtd, 0);
    const concluidos = list.reduce((acc, m) => acc + m.concluidos_qtd, 0);
    const naoCompareceu = list.reduce((acc, m) => acc + m.nao_compareceu_qtd, 0);
    const cancelados = list.reduce((acc, m) => acc + m.cancelados_qtd, 0);
    const normais = list.reduce((acc, m) => acc + m.normais_qtd, 0);
    const prioritarios = list.reduce((acc, m) => acc + m.prioritarios_qtd, 0);
    const especiais = list.reduce((acc, m) => acc + m.especiais_qtd, 0);

    const esperaMediaSeg = Math.round(list.reduce((acc, m) => acc + m.tempo_medio_espera_seg, 0) / list.length);
    const esperaMedianaSeg = Math.round(list.reduce((acc, m) => acc + m.tempo_mediano_espera_seg, 0) / list.length);
    const esperaP90Seg = Math.max(...list.map(m => m.tempo_p90_espera_seg));
    const atendimentoMedioSeg = Math.round(list.reduce((acc, m) => acc + m.tempo_medio_atendimento_seg, 0) / list.length);
    const taxaConclusaoPct = totalEmitidas > 0 ? Math.round((concluidos / totalEmitidas) * 100) : 0;
    const maiorEsperaSeg = Math.max(...list.map(m => m.maior_espera_atual_seg));

    return {
      totalEmitidas,
      aguardandoAgora,
      emAtendimentoAgora,
      concluidos,
      naoCompareceu,
      cancelados,
      normais,
      prioritarios,
      especiais,
      esperaMediaSeg,
      esperaMedianaSeg,
      esperaP90Seg,
      atendimentoMedioSeg,
      taxaConclusaoPct,
      maiorEsperaSeg
    };
  }, [metricasPorUnidade]);

  // Alertas operacionais automáticos
  const alertasOperacionais = useMemo(() => {
    const list: { unidade: string; tipo: 'CRITICO' | 'ATENCAO'; mensagem: string; detalhe: string }[] = [];
    Object.values(metricasPorUnidade).forEach(m => {
      if (!m) return;
      if (m.situacao === 'ALTA_DEMANDA') {
        list.push({
          unidade: m.unidade_sigla,
          tipo: 'CRITICO',
          mensagem: `Alta Demanda na fila (${m.aguardando_qtd} aguardando)`,
          detalhe: `Maior espera atual de ${formatarDuracaoSegundos(m.maior_espera_atual_seg)} supera o limite crítico.`
        });
      } else if (m.situacao === 'ATENCAO') {
        list.push({
          unidade: m.unidade_sigla,
          tipo: 'ATENCAO',
          mensagem: `Fila em nível de atenção (${m.aguardando_qtd} aguardando)`,
          detalhe: `Tempo médio de espera de ${formatarDuracaoSegundos(m.tempo_medio_espera_seg)} requer acompanhamento.`
        });
      }

      if (m.aguardando_qtd > 5 && m.atendimentos_por_hora === 0) {
        list.push({
          unidade: m.unidade_sigla,
          tipo: 'ATENCAO',
          mensagem: `Ritmo de atendimento reduzido`,
          detalhe: `Há cidadãos aguardando mas nenhum atendimento recente foi registrado na última hora.`
        });
      }
    });
    return list;
  }, [metricasPorUnidade]);

  // Geração de Relatório PDF Institucional
  const handleGerarRelatorioPDF = () => {
    window.print();
  };

  const getSituacaoColor = (situacao: string) => {
    switch (situacao) {
      case 'ALTA_DEMANDA':
        return 'bg-rose-100 text-rose-800 border-rose-300';
      case 'ATENCAO':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      default:
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    }
  };

  return (
    <div className="h-[calc(100vh-68px)] max-h-[calc(100vh-68px)] bg-slate-50 text-slate-800 flex flex-col overflow-hidden">
      {/* CABEÇALHO COMPACTO E RESPONSIVO */}
      <header className="bg-white border-b border-slate-200 shrink-0 z-20 shadow-2xs print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
          {/* Lado Esquerdo: Voltar e Título */}
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
                title="Voltar ao AutoSenha"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-purple-100 text-purple-900">
                  ADMINISTRAÇÃO MUNICIPAL
                </span>
                <span className="text-xs text-slate-400 font-semibold hidden sm:inline">São José do Goiabal — MG</span>
              </div>
              <h1 className="text-base sm:text-lg lg:text-xl font-black text-slate-900 tracking-tight leading-tight">
                Dashboard Central de Filas & Senhas
              </h1>
            </div>
          </div>

          {/* Centro: Abas de Visualização */}
          <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-bold">
            <button
              type="button"
              onClick={() => setAbaAtiva('operacional')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                abaAtiva === 'operacional'
                  ? 'bg-white text-slate-900 shadow-xs font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Activity className="w-3.5 h-3.5 text-emerald-600" />
              <span>Visão Operacional</span>
            </button>

            <button
              type="button"
              onClick={() => setAbaAtiva('capacidade')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                abaAtiva === 'capacidade'
                  ? 'bg-white text-slate-900 shadow-xs font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 text-sky-600" />
              <span>Capacidade & Ritmo</span>
            </button>

            <button
              type="button"
              onClick={() => setAbaAtiva('auditoria')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                abaAtiva === 'auditoria'
                  ? 'bg-white text-slate-900 shadow-xs font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-purple-600" />
              <span>Alertas & Auditoria</span>
              {alertasOperacionais.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-rose-500 text-white">
                  {alertasOperacionais.length}
                </span>
              )}
            </button>
          </div>

          {/* Lado Direito: Filtro de Período e Relatório */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={periodoFiltro}
                onChange={(e) => setPeriodoFiltro(Number(e.target.value))}
                className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
              >
                <option value={0}>Hoje ({getDataOperacionalHoje()})</option>
                <option value={1}>Ontem</option>
                <option value={7}>Últimos 7 dias</option>
                <option value={30}>Últimos 30 dias</option>
              </select>
            </div>

            <button
              type="button"
              onClick={handleGerarRelatorioPDF}
              className="px-3 py-1.5 bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-700 hover:to-blue-800 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Gerar Relatório</span>
            </button>
          </div>
        </div>
      </header>

      {/* CONTEÚDO PRINCIPAL */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 w-full flex-1 flex flex-col gap-8">
        {/* SEÇÃO 1: INDICADORES PRINCIPAIS CONSOLIDADOS */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-emerald-600" />
              Indicadores Consolidados de Saúde Municipal
            </h2>
            <span className="text-[11px] font-bold text-slate-400">
              {periodoFiltro === 0 ? 'Estado Operacional de Hoje' : `Histórico de ${periodoFiltro} dias`}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
            {/* Total Emitidas */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Total Emitidas</span>
              <div className="text-2xl font-black text-slate-900 font-mono">{consolidado.totalEmitidas}</div>
              <span className="text-[11px] text-slate-500 font-semibold">Senhas geradas</span>
            </div>

            {/* Aguardando Agora */}
            <div className="bg-emerald-50/70 border border-emerald-200/90 p-4 rounded-2xl shadow-2xs">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 block mb-1">Aguardando Agora</span>
              <div className="text-2xl font-black text-emerald-900 font-mono">{consolidado.aguardandoAgora}</div>
              <span className="text-[11px] text-emerald-700 font-bold">Cidadãos na fila</span>
            </div>

            {/* Em Atendimento */}
            <div className="bg-sky-50/70 border border-sky-200/90 p-4 rounded-2xl shadow-2xs">
              <span className="text-[10px] font-black uppercase tracking-wider text-sky-700 block mb-1">Em Atendimento</span>
              <div className="text-2xl font-black text-sky-900 font-mono">{consolidado.emAtendimentoAgora}</div>
              <span className="text-[11px] text-sky-700 font-bold">Nos guichês agora</span>
            </div>

            {/* Concluídos */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Concluídos</span>
              <div className="text-2xl font-black text-purple-900 font-mono">{consolidado.concluidos}</div>
              <span className="text-[11px] text-purple-700 font-semibold">{consolidado.taxaConclusaoPct}% do total</span>
            </div>

            {/* Tempo Médio Espera */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Espera Média</span>
              <div className="text-2xl font-black text-slate-900 font-mono">{formatarDuracaoSegundos(consolidado.esperaMediaSeg)}</div>
              <span className="text-[11px] text-slate-500 font-semibold">Até 1ª chamada</span>
            </div>

            {/* Maior Espera Atual */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Maior Espera Agora</span>
              <div className={`text-2xl font-black font-mono ${consolidado.maiorEsperaSeg > 1800 ? 'text-rose-600' : 'text-slate-900'}`}>
                {formatarDuracaoSegundos(consolidado.maiorEsperaSeg)}
              </div>
              <span className="text-[11px] text-slate-500 font-semibold">Mais antiga na fila</span>
            </div>
          </div>
        </section>

        {/* SEÇÃO 2: CARDS DAS 3 UNIDADES DE SAÚDE */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-sky-600" />
              Situação Operacional Individual dos Postos
            </h2>
            <span className="text-[11px] text-slate-400 font-semibold">UPA | PSF 1 | PSF 2</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {AUTOSENHA_UNIDADES.map((u) => {
              const m = metricasPorUnidade[u.id];
              return (
                <div
                  key={u.id}
                  className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow"
                >
                  <div>
                    {/* Cabeçalho do Card */}
                    <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-100 mb-3">
                      <div>
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                          {u.tipo}
                        </span>
                        <h3 className="text-base font-black text-slate-900 mt-1">
                          {u.nome}
                        </h3>
                      </div>
                      <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase border ${
                        m ? getSituacaoColor(m.situacao) : 'bg-slate-100 text-slate-600'
                      }`}>
                        {m?.situacao || 'NORMAL'}
                      </span>
                    </div>

                    {/* Indicadores do Posto */}
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="p-2.5 rounded-xl bg-slate-50">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Aguardando</span>
                        <span className="text-xl font-black text-emerald-800 font-mono">{m?.aguardando_qtd || 0}</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-50">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Em Atendimento</span>
                        <span className="text-xl font-black text-sky-800 font-mono">{m?.em_atendimento_qtd || 0}</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-50">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Espera Média</span>
                        <span className="text-sm font-black text-slate-800 font-mono">
                          {m ? formatarDuracaoSegundos(m.tempo_medio_espera_seg) : '0s'}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-50">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Atendimentos/Hora</span>
                        <span className="text-sm font-black text-slate-800 font-mono">
                          {m?.atendimentos_por_hora || 0}/h
                        </span>
                      </div>
                    </div>

                    {/* Senha Chamada Atual */}
                    <div className="p-3 rounded-2xl bg-slate-900 text-white mb-4 flex items-center justify-between">
                      <div>
                        <span className="text-[9px] font-black uppercase tracking-wider text-emerald-400 block">Chamada Atual</span>
                        <span className="text-lg font-black font-mono">
                          {m?.senha_atual?.numero || 'Nenhuma'}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 font-bold">
                        {m?.senha_atual ? `Guichê: ${m.senha_atual.guiche}` : 'Aguardando'}
                      </span>
                    </div>
                  </div>

                  {/* Links Operacionais para a Unidade */}
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => onNavigateUnidade?.(u.id, 'controle')}
                      className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-colors cursor-pointer text-center"
                    >
                      Acessar Controle
                    </button>
                    <button
                      type="button"
                      onClick={() => onNavigateUnidade?.(u.id, 'tv')}
                      className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                      title="Abrir Painel de TV desta Unidade"
                    >
                      Senha TV
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* SEÇÃO 3: PAINEL DE CAPACIDADE DE ATENDIMENTO */}
        <section className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-emerald-600" />
                Painel de Capacidade e Ritmo de Atendimento
              </h2>
              <p className="text-xs text-slate-500">
                Comparativo oficial de velocidade, escoamento de fila e produtividade das recepções.
              </p>
            </div>
          </div>

          {/* TABELA COMPARATIVA DE CAPACIDADE */}
          <div className="overflow-x-auto border border-slate-200/70 rounded-2xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200/80 text-[10px] font-black uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Unidade</th>
                  <th className="py-3 px-4">Situação</th>
                  <th className="py-3 px-4">Aguardando</th>
                  <th className="py-3 px-4">Em Atendimento</th>
                  <th className="py-3 px-4">Espera Média</th>
                  <th className="py-3 px-4">Espera Mediana</th>
                  <th className="py-3 px-4">Maior Espera</th>
                  <th className="py-3 px-4">Duração Média</th>
                  <th className="py-3 px-4">Atendimentos/h</th>
                  <th className="py-3 px-4">Total Concluídos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-semibold">
                {AUTOSENHA_UNIDADES.map((u) => {
                  const m = metricasPorUnidade[u.id];
                  return (
                    <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-black text-slate-900">{u.nome}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase border ${
                          m ? getSituacaoColor(m.situacao) : 'bg-slate-100 text-slate-600'
                        }`}>
                          {m?.situacao || 'NORMAL'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-emerald-700">{m?.aguardando_qtd || 0}</td>
                      <td className="py-3 px-4 font-mono font-bold text-sky-700">{m?.em_atendimento_qtd || 0}</td>
                      <td className="py-3 px-4 font-mono">{m ? formatarDuracaoSegundos(m.tempo_medio_espera_seg) : '0s'}</td>
                      <td className="py-3 px-4 font-mono">{m ? formatarDuracaoSegundos(m.tempo_mediano_espera_seg) : '0s'}</td>
                      <td className="py-3 px-4 font-mono text-rose-700">{m ? formatarDuracaoSegundos(m.maior_espera_atual_seg) : '0s'}</td>
                      <td className="py-3 px-4 font-mono">{m ? formatarDuracaoSegundos(m.tempo_medio_atendimento_seg) : '0s'}</td>
                      <td className="py-3 px-4 font-mono font-bold">{m?.atendimentos_por_hora || 0} /h</td>
                      <td className="py-3 px-4 font-mono font-black text-purple-900">{m?.concluidos_qtd || 0}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* SEÇÃO 4: ALERTAS OPERACIONAIS E ÚLTIMAS MOVIMENTAÇÕES */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* ALERTAS OPERACIONAIS (COL 5) */}
          <section className="lg:col-span-5 bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs">
            <h3 className="text-sm font-extrabold text-slate-900 mb-3 uppercase tracking-wider flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              Alertas Operacionais Automáticos
            </h3>

            <div className="space-y-3">
              {alertasOperacionais.length > 0 ? (
                alertasOperacionais.map((alerta, idx) => (
                  <div
                    key={idx}
                    className={`p-3.5 rounded-2xl border text-xs ${
                      alerta.tipo === 'CRITICO'
                        ? 'bg-rose-50 border-rose-200 text-rose-900'
                        : 'bg-amber-50 border-amber-200 text-amber-900'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-black uppercase tracking-wide">{alerta.unidade}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-white/80">
                        {alerta.tipo}
                      </span>
                    </div>
                    <p className="font-bold text-slate-900">{alerta.mensagem}</p>
                    <p className="text-[11px] text-slate-600 mt-0.5">{alerta.detalhe}</p>
                  </div>
                ))
              ) : (
                <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold text-center flex flex-col items-center gap-1.5">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                  <span>Todos os postos operando dentro dos parâmetros de normalidade.</span>
                </div>
              )}
            </div>
          </section>

          {/* ÚLTIMAS MOVIMENTAÇÕES AUDITADAS (COL 7) */}
          <section className="lg:col-span-7 bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs">
            <h3 className="text-sm font-extrabold text-slate-900 mb-3 uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-4 h-4 text-sky-600" />
              Últimas Movimentações Auditadas
            </h3>

            <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
              {movimentacoes.length > 0 ? (
                movimentacoes.map((mov) => {
                  const hora = new Date(mov.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                  return (
                    <div
                      key={mov.id}
                      className="p-3 rounded-2xl bg-slate-50 hover:bg-slate-100/80 border border-slate-100 flex items-center justify-between gap-3 text-xs transition-colors"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{mov.descricao}</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded-md font-mono font-bold bg-slate-200 text-slate-700 uppercase">
                            {mov.unidade_id}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400">Responsável: {mov.usuario_nome}</span>
                      </div>
                      <span className="font-mono text-slate-400 text-[11px] shrink-0 font-bold">{hora}</span>
                    </div>
                  );
                })
              ) : (
                <div className="py-8 text-center text-xs text-slate-400">
                  Nenhuma movimentação recente registrada.
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};
