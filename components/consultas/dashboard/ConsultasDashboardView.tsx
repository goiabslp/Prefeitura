import React, { useState, useEffect, useMemo } from 'react';
import { User, ConsultaAgendamento, ConsultaProcedimento, ConsultaVaga } from '../../../types';
import * as db from '../../../services/consultasService';
import {
  processarAnaliseConsultas,
  gerarMockConsultasDataset,
  ConsultasAnalyticsCompleto
} from '../../../services/consultasAnalyticsService';
import { ConsultasIAPanel } from './ConsultasIAPanel';
import {
  BarChart3,
  Brain,
  Clock,
  Users,
  Activity,
  Calendar,
  Filter,
  RefreshCw,
  Printer,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileSpreadsheet,
  ChevronRight,
  ShieldCheck,
  Stethoscope,
  Building2,
  UserCheck,
  Layers,
  ArrowUpRight,
  Sliders
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';

interface ConsultasDashboardViewProps {
  currentUser?: User | null;
  subView?: string;
  onNavigate?: (view: string) => void;
}

type TabType = 'geral' | 'prazos' | 'filas' | 'ia' | 'eficiencia';

export const ConsultasDashboardView: React.FC<ConsultasDashboardViewProps> = ({
  currentUser,
  subView,
  onNavigate
}) => {
  // Sincronização de Aba com base na subView / Rota
  const activeTab: TabType = useMemo(() => {
    if (subView === 'dados-dashboard-prazos') return 'prazos';
    if (subView === 'dados-dashboard-filas') return 'filas';
    if (subView === 'dados-dashboard-ia') return 'ia';
    if (subView === 'dados-dashboard-eficiencia') return 'eficiencia';
    return 'geral';
  }, [subView]);

  // Função para troca de aba com navegação de URL garantida
  const handleTabChange = (tabId: TabType) => {
    const routeMap: Record<TabType, { routeKey: string; path: string }> = {
      geral: { routeKey: 'consultas:dados-dashboard-geral', path: '/Consultas/DADOS/Dashboard/VisaoGeral' },
      prazos: { routeKey: 'consultas:dados-dashboard-prazos', path: '/Consultas/DADOS/Dashboard/Prazos' },
      filas: { routeKey: 'consultas:dados-dashboard-filas', path: '/Consultas/DADOS/Dashboard/Filas' },
      ia: { routeKey: 'consultas:dados-dashboard-ia', path: '/Consultas/DADOS/Dashboard/IA' },
      eficiencia: { routeKey: 'consultas:dados-dashboard-eficiencia', path: '/Consultas/DADOS/Dashboard/Eficiencia' }
    };

    const target = routeMap[tabId];
    if (onNavigate) {
      onNavigate(target.routeKey);
    } else {
      window.history.pushState({}, '', target.path);
    }
  };

  // Estados de Dados
  const [loading, setLoading] = useState(true);
  const [agendamentosReais, setAgendamentosReais] = useState<ConsultaAgendamento[]>([]);
  const [procedimentosReais, setProcedimentosReais] = useState<ConsultaProcedimento[]>([]);
  const [vagasReais, setVagasReais] = useState<ConsultaVaga[]>([]);
  const [useSimulation, setUseSimulation] = useState(false);

  // Estados de Filtro
  const [filtroPeriodo, setFiltroPeriodo] = useState<'7d' | '30d' | 'mes_atual' | 'ano_atual' | 'tudo'>('tudo');
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'Exame' | 'Consulta' | 'Cirurgia'>('todos');
  const [filtroPrioridade, setFiltroPrioridade] = useState<'todas' | 'Normal' | 'Especial' | 'Urgência'>('todas');

  // Carregamento dos dados
  const fetchData = async () => {
    setLoading(true);
    try {
      const [ags, procs, vgs] = await Promise.all([
        db.getAgendamentos(),
        db.getProcedimentos(),
        db.getVagas()
      ]);
      setAgendamentosReais(ags || []);
      setProcedimentosReais(procs || []);
      setVagasReais(vgs || []);

      // Se a base de agendamentos reais estiver vazia, ativa simulação por padrão
      if (!ags || ags.length === 0) {
        setUseSimulation(true);
      }
    } catch (err) {
      console.error('[ConsultasDashboardView] Erro ao buscar dados:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Dados calculados via analytics service
  const analytics: ConsultasAnalyticsCompleto = useMemo(() => {
    if (useSimulation) {
      const mock = gerarMockConsultasDataset(procedimentosReais);
      return processarAnaliseConsultas(
        mock.agendamentos,
        procedimentosReais,
        mock.vagas,
        filtroPeriodo,
        filtroTipo,
        filtroPrioridade,
        true
      );
    }

    return processarAnaliseConsultas(
      agendamentosReais,
      procedimentosReais,
      vagasReais,
      filtroPeriodo,
      filtroTipo,
      filtroPrioridade,
      false
    );
  }, [agendamentosReais, procedimentosReais, vagasReais, useSimulation, filtroPeriodo, filtroTipo, filtroPrioridade]);

  // Lista de pacientes atualmente na fila para a aba Filas
  const pacientesFilaAtual = useMemo(() => {
    const list = useSimulation
      ? gerarMockConsultasDataset(procedimentosReais).agendamentos
      : agendamentosReais;
    return list
      .filter(a => a.status === 'Fila de espera')
      .sort((a, b) => (a.queue_position || 999) - (b.queue_position || 999));
  }, [agendamentosReais, procedimentosReais, useSimulation]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* 1. CABEÇALHO ANALÍTICO & CONTROLE DE MODO */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10px] font-black uppercase tracking-wider">
              Regulação Municipal & SUS
            </span>
            {analytics.isMockData ? (
              <span className="px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-500" /> Modo Demonstração Preditivo Ativo
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Base de Dados Conectada
              </span>
            )}
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
            Diagnóstico & Métricas de Gestão das Consultas
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            Monitoramento de fluxo de atendimento, cálculo de prazos médios e projeção preditiva por IA
          </p>
        </div>

        {/* Filtros e Ações Rápidas */}
        <div className="flex flex-wrap items-center gap-2.5">
          
          {/* Seletor de Período */}
          <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200 text-xs font-bold text-slate-600">
            <Calendar className="w-3.5 h-3.5 text-slate-400 ml-1" />
            <select
              value={filtroPeriodo}
              onChange={e => setFiltroPeriodo(e.target.value as any)}
              className="bg-transparent border-none focus:outline-none pr-2 cursor-pointer font-bold text-slate-700 text-xs"
            >
              <option value="tudo">Todo o Histórico</option>
              <option value="7d">Últimos 7 dias</option>
              <option value="30d">Últimos 30 dias</option>
              <option value="mes_atual">Mês Atual</option>
              <option value="ano_atual">Ano Atual</option>
            </select>
          </div>

          {/* Seletor de Tipo */}
          <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200 text-xs font-bold text-slate-600">
            <Filter className="w-3.5 h-3.5 text-slate-400 ml-1" />
            <select
              value={filtroTipo}
              onChange={e => setFiltroTipo(e.target.value as any)}
              className="bg-transparent border-none focus:outline-none pr-2 cursor-pointer font-bold text-slate-700 text-xs"
            >
              <option value="todos">Todos os Tipos</option>
              <option value="Exame">Apenas Exames</option>
              <option value="Consulta">Apenas Consultas</option>
              <option value="Cirurgia">Apenas Cirurgias</option>
            </select>
          </div>

          {/* Toggle Simulação / Dados Reais */}
          <button
            onClick={() => setUseSimulation(!useSimulation)}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer border ${
              useSimulation
                ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-600 shadow-sm'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
            }`}
            title="Alternar entre dados reais do banco ou simulação estatística rica para visualização do diagnóstico"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {useSimulation ? 'Simulação Ativa' : 'Ativar Simulação'}
          </button>

          {/* Atualizar */}
          <button
            onClick={fetchData}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-all cursor-pointer"
            title="Recarregar Dados em Tempo Real"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {/* Imprimir */}
          <button
            onClick={() => window.print()}
            className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
            title="Imprimir Relatório do Painel"
          >
            <Printer className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Exportar</span>
          </button>
        </div>

      </div>

      {/* 2. BARRA DE ABAS COM URLS INDIVIDUAIS */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200/80 pb-3">
        {[
          { id: 'geral', label: 'Visão Geral & Funil', icon: BarChart3, path: '/Consultas/DADOS/Dashboard/VisaoGeral' },
          { id: 'prazos', label: 'Prazos Médios & SLA', icon: Clock, path: '/Consultas/DADOS/Dashboard/Prazos' },
          { id: 'filas', label: 'Fila & Especiais', icon: Users, path: '/Consultas/DADOS/Dashboard/Filas' },
          { id: 'ia', label: 'Diagnóstico & IA Preditiva', icon: Brain, path: '/Consultas/DADOS/Dashboard/IA', highlight: true },
          { id: 'eficiencia', label: 'Eficiência & Absenteísmo', icon: Activity, path: '/Consultas/DADOS/Dashboard/Eficiencia' }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id as TabType)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-extrabold text-xs uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                isActive
                  ? tab.highlight
                    ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-md shadow-indigo-500/20'
                    : 'bg-sky-600 text-white shadow-md shadow-sky-500/20'
                  : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200/70'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {tab.highlight && !isActive && (
                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
              )}
            </button>
          );
        })}
      </div>

      {/* 3. CONTEÚDO DAS ABAS */}

      {/* === ABA 1: VISÃO GERAL === */}
      {activeTab === 'geral' && (
        <div className="space-y-6">
          
          {/* Mini-Banner de Destaque da IA */}
          <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 text-white p-5 rounded-3xl shadow-lg flex flex-col md:flex-row items-center justify-between gap-4 border border-indigo-800/40">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center shrink-0">
                <Brain className="w-6 h-6 text-indigo-300" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-widest text-indigo-300">
                    Diagnóstico da IA Municipal
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 text-[10px] font-black uppercase border border-indigo-400/20">
                    Score: {analytics.ia.scoreRegulacao}/100 ({analytics.ia.classificacaoScore})
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-0.5 font-medium max-w-2xl">
                  {analytics.ia.parecerTecnicoIA.resumoExecutivo}
                </p>
              </div>
            </div>

            <button
              onClick={() => handleTabChange('ia')}
              className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white font-extrabold text-xs rounded-xl transition-all shrink-0 flex items-center gap-1.5 shadow-md shadow-indigo-500/30 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" /> Ver IA Preditiva & Previsões <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Cards de KPIs Principais */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            
            {/* Total Solicitações */}
            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Solicitações</span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl font-black text-slate-800">{analytics.volume.totalSolicitacoes}</span>
                <span className="text-[10px] font-bold text-sky-600 bg-sky-50 px-1.5 py-0.5 rounded">100%</span>
              </div>
              <span className="text-[9px] text-slate-400 mt-2 font-medium">Demanda global recebida</span>
            </div>

            {/* Fila de Espera */}
            <div className="p-4 bg-amber-50/60 rounded-2xl border border-amber-200/60 shadow-xs flex flex-col justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-700">Fila de Espera</span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl font-black text-amber-800">{analytics.volume.totalFilaEspera}</span>
                {analytics.volume.totalEspeciais > 0 && (
                  <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded">
                    {analytics.volume.totalEspeciais} Especiais
                  </span>
                )}
              </div>
              <span className="text-[9px] text-amber-600 mt-2 font-medium">
                Média {analytics.prazos.tempoMedioFilaEsperaAtualDias} dias aguardando
              </span>
            </div>

            {/* Agendados */}
            <div className="p-4 bg-indigo-50/60 rounded-2xl border border-indigo-200/60 shadow-xs flex flex-col justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700">Confirmados / Agenda</span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl font-black text-indigo-800">{analytics.volume.totalAgendados}</span>
                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded">Com Data</span>
              </div>
              <span className="text-[9px] text-indigo-600 mt-2 font-medium">Próximos atendimentos</span>
            </div>

            {/* Realizados */}
            <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-200/60 shadow-xs flex flex-col justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700">Concluídos / Realizados</span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl font-black text-emerald-800">{analytics.volume.totalRealizados}</span>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                  {analytics.volume.taxaConversaoResolucao}%
                </span>
              </div>
              <span className="text-[9px] text-emerald-600 mt-2 font-medium">Taxa de resolução final</span>
            </div>

            {/* Vagas Ofertadas */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Vagas Ocupadas</span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl font-black text-slate-800">{analytics.volume.taxaOcupacaoVagas}%</span>
                <span className="text-[10px] font-bold text-slate-600 bg-slate-200 px-1.5 py-0.5 rounded">
                  {analytics.volume.vagasDisponiveisLivres} livres
                </span>
              </div>
              <span className="text-[9px] text-slate-400 mt-2 font-medium">
                {analytics.volume.vagasTotaisCadastradas} vagas no sistema
              </span>
            </div>

            {/* Absenteísmo */}
            <div className="p-4 bg-rose-50/60 rounded-2xl border border-rose-200/60 shadow-xs flex flex-col justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-rose-700">Taxa de Faltas</span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl font-black text-rose-800">{analytics.volume.taxaAbsenteismo}%</span>
                <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded">
                  {analytics.volume.totalNaoRealizados + analytics.volume.totalCancelados} perdas
                </span>
              </div>
              <span className="text-[9px] text-rose-600 mt-2 font-medium">Cancelados e não comparecimentos</span>
            </div>

          </div>

          {/* Gráficos Principais: Evolução e Distribuição de Status */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Gráfico de Evolução Temporal */}
            <div className="lg:col-span-8 bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col h-[380px]">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-sky-600" /> Fluxo Temporal de Atendimento
                  </h4>
                  <p className="text-[10px] text-slate-400 font-medium">
                    Comparativo histórico: novas solicitações vs agendamentos vs atendimentos concluídos
                  </p>
                </div>
              </div>

              <div className="flex-1 w-full min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analytics.evolucaoTemporal} margin={{ left: -15, right: 10, top: 10, bottom: 5 }}>
                    <defs>
                      <linearGradient id="solColor" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="realColor" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="periodoLabel" stroke="#94a3b8" style={{ fontSize: 10, fontWeight: 'bold' }} />
                    <YAxis stroke="#94a3b8" style={{ fontSize: 10, fontWeight: 'bold' }} />
                    <Tooltip contentStyle={{ borderRadius: '1rem', border: '1px solid #e2e8f0', fontSize: '11px', fontWeight: 'bold' }} />
                    <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', paddingTop: '8px' }} />
                    <Area type="monotone" dataKey="solicitados" name="Novas Solicitações" stroke="#0284c7" strokeWidth={2.5} fillOpacity={1} fill="url(#solColor)" />
                    <Area type="monotone" dataKey="realizados" name="Realizados" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#realColor)" />
                    <Area type="monotone" dataKey="faltas" name="Faltas / Cancelados" stroke="#ef4444" strokeWidth={1.5} fillOpacity={0} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Distribuição por Status da Regulação */}
            <div className="lg:col-span-4 bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 mb-1">
                  Distribuição por Status
                </h4>
                <p className="text-[10px] text-slate-400 font-medium mb-3">
                  Divisão percentual das demandas na regulação
                </p>

                <div className="space-y-2.5">
                  {analytics.distribuicaoStatus.map((st, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: st.color }} />
                        <span className="font-bold text-slate-700 truncate">{st.status}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-black text-slate-800">{st.count}</span>
                        <span className="text-[10px] text-slate-400 font-bold w-10 text-right">{st.percentual}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-600">
                <span>Total Auditado:</span>
                <span className="text-indigo-600 font-black">{analytics.volume.totalSolicitacoes} solicitações</span>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* === ABA 2: PRAZOS MÉDIOS & SLA === */}
      {activeTab === 'prazos' && (
        <div className="space-y-6">
          
          {/* Cards de Métricas de Prazos Médios */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            
            <div className="p-5 bg-white rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Prazo Médio Solicitação ➔ Agendamento
              </span>
              <div className="my-2">
                <span className="text-3xl font-black text-indigo-600">
                  {analytics.prazos.prazoMedioSolicitacaoAgendamentoDias} <span className="text-sm font-bold text-slate-500">dias</span>
                </span>
              </div>
              <span className="text-[10px] text-slate-500 font-medium">
                Lead Time médio da triagem até a marcação
              </span>
            </div>

            <div className="p-5 bg-white rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Ciclo Completo até Realização
              </span>
              <div className="my-2">
                <span className="text-3xl font-black text-emerald-600">
                  {analytics.prazos.prazoMedioSolicitacaoRealizacaoDias} <span className="text-sm font-bold text-slate-500">dias</span>
                </span>
              </div>
              <span className="text-[10px] text-slate-500 font-medium">
                Tempo total decorrido até a consulta/exame
              </span>
            </div>

            <div className="p-5 bg-white rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Tempo na Fila de Espera Atual
              </span>
              <div className="my-2">
                <span className="text-3xl font-black text-amber-600">
                  {analytics.prazos.tempoMedioFilaEsperaAtualDias} <span className="text-sm font-bold text-slate-500">dias</span>
                </span>
              </div>
              <span className="text-[10px] text-slate-500 font-medium">
                Média de dias dos pacientes que ainda aguardam
              </span>
            </div>

            {/* Destaque do Agendamento Especial */}
            <div className="p-5 bg-gradient-to-br from-rose-500 to-rose-600 text-white rounded-3xl shadow-md shadow-rose-500/20 flex flex-col justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-rose-100">
                Eficiência do Agendamento Especial
              </span>
              <div className="my-2">
                <span className="text-3xl font-black">
                  -{analytics.prazos.reducaoTempoEspecialPerc}% <span className="text-sm font-bold text-rose-100">tempo</span>
                </span>
              </div>
              <div className="text-[10px] text-rose-100 font-medium flex justify-between border-t border-rose-400/40 pt-1.5">
                <span>Especial: <strong>{analytics.prazos.prazoEspecialDias}d</strong></span>
                <span>Normal: <strong>{analytics.prazos.prazoNormalDias}d</strong></span>
              </div>
            </div>

          </div>

          {/* Gráfico de Distribuição das Faixas de Espera */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            <div className="lg:col-span-6 bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col h-[340px]">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 mb-1">
                Distribuição dos Pacientes por Faixa de Tempo de Espera
              </h4>
              <p className="text-[10px] text-slate-400 font-medium mb-4">
                Percentual de solicitações atendidas ou em espera dentro de cada janela temporal
              </p>

              <div className="flex-1 w-full min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.prazos.faixasEspera} margin={{ left: -15, right: 10, top: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="faixa" stroke="#94a3b8" style={{ fontSize: 10, fontWeight: 'bold' }} />
                    <YAxis stroke="#94a3b8" style={{ fontSize: 10, fontWeight: 'bold' }} />
                    <Tooltip contentStyle={{ borderRadius: '1rem', border: '1px solid #e2e8f0', fontSize: '11px', fontWeight: 'bold' }} />
                    <Bar dataKey="quantidade" name="Pacientes" radius={[8, 8, 0, 0]}>
                      {analytics.prazos.faixasEspera.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Comparativo de Prazos por Prioridade */}
            <div className="lg:col-span-6 bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 mb-1">
                  Comparativo de Prazos por Prioridade de Atendimento
                </h4>
                <p className="text-[10px] text-slate-400 font-medium mb-4">
                  Validação empírica do tempo de resposta da fila de acordo com a classificação de risco
                </p>

                <div className="space-y-4">
                  
                  {/* Urgência */}
                  <div className="p-3.5 bg-rose-50 rounded-2xl border border-rose-100">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-extrabold text-rose-800 uppercase">Urgência Médica</span>
                      <span className="font-black text-rose-700 text-sm">{analytics.prazos.prazoUrgenciaDias} dias médios</span>
                    </div>
                    <p className="text-[10px] text-rose-600 font-medium">
                      Atendimento imediato regulado prioritariamente pelo médico auditor.
                    </p>
                  </div>

                  {/* Especial */}
                  <div className="p-3.5 bg-indigo-50 rounded-2xl border border-indigo-100">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-extrabold text-indigo-800 uppercase flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-600" /> Agendamento Especial
                      </span>
                      <span className="font-black text-indigo-700 text-sm">{analytics.prazos.prazoEspecialDias} dias médios</span>
                    </div>
                    <p className="text-[10px] text-indigo-600 font-medium">
                      Inserção no topo da fila sequencial com ganho de {analytics.prazos.reducaoTempoEspecialPerc}% de agilidade.
                    </p>
                  </div>

                  {/* Normal */}
                  <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/70">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-extrabold text-slate-700 uppercase">Agendamento Normal</span>
                      <span className="font-black text-slate-800 text-sm">{analytics.prazos.prazoNormalDias} dias médios</span>
                    </div>
                    <p className="text-[10px] text-slate-500 font-medium">
                      Fila padrão cronológica por ordem de solicitação e cotas da rede.
                    </p>
                  </div>

                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500 font-medium">
                * Os dados refletem a medição em tempo real entre a data do encaminhamento e a marcação definitiva.
              </div>
            </div>

          </div>

          {/* Tabela de Ranking de Prazos por Procedimento */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 mb-3">
              Ranking de Prazos Médios e Situação de SLA por Especialidade
            </h4>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-400 bg-slate-50/50">
                    <th className="py-2.5 px-3">Procedimento</th>
                    <th className="py-2.5 px-3">Tipo</th>
                    <th className="py-2.5 px-3 text-center">Prazo Médio</th>
                    <th className="py-2.5 px-3 text-center">Atendidos</th>
                    <th className="py-2.5 px-3 text-center">Aguardando</th>
                    <th className="py-2.5 px-3 text-center">SLA Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {analytics.prazos.rankingProcedimentosPrazos.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-3 font-extrabold text-slate-800">{item.nome}</td>
                      <td className="py-3 px-3 text-[10px] font-black uppercase text-slate-400">{item.tipo}</td>
                      <td className="py-3 px-3 text-center font-black text-slate-800">{item.tempoMedioDias} dias</td>
                      <td className="py-3 px-3 text-center font-bold text-slate-600">{item.totalAtendidos}</td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full font-bold text-xs ${
                          item.pacientesAguardando > 10 ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-700'
                        }`}>
                          {item.pacientesAguardando}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full font-black text-[9px] uppercase tracking-wider ${
                          item.slaStatus === 'critico' ? 'bg-rose-100 text-rose-700' :
                          item.slaStatus === 'alerta' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          {item.slaStatus === 'critico' ? 'Crítico (>30d)' : item.slaStatus === 'alerta' ? 'Atenção (15-30d)' : 'Adequado (<15d)'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* === ABA 3: FILAS & AGENDAMENTOS ESPECIAIS === */}
      {activeTab === 'filas' && (
        <div className="space-y-6">
          
          {/* Header da Fila */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 bg-white rounded-3xl border border-slate-200/80 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Total Aguardando</span>
                <span className="text-3xl font-black text-slate-800">{analytics.volume.totalFilaEspera}</span>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                <Users className="w-6 h-6" />
              </div>
            </div>

            <div className="p-5 bg-rose-50 rounded-3xl border border-rose-100 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-rose-700 block">Casos Especiais no Topo</span>
                <span className="text-3xl font-black text-rose-800">{analytics.volume.totalEspeciais}</span>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center font-bold">
                <Sparkles className="w-6 h-6" />
              </div>
            </div>

            <div className="p-5 bg-sky-50 rounded-3xl border border-sky-100 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-sky-700 block">Tempo Médio na Fila</span>
                <span className="text-3xl font-black text-sky-800">{analytics.prazos.tempoMedioFilaEsperaAtualDias} dias</span>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-sky-100 text-sky-600 flex items-center justify-center font-bold">
                <Clock className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Monitor da Fila em Tempo Real */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                  Auditoria da Fila de Espera em Tempo Real
                </h4>
                <p className="text-[10px] text-slate-400 font-medium">
                  Sequência oficial respeitando ordenação especial no topo e posições calculadas no banco de dados
                </p>
              </div>
              <span className="text-xs font-bold text-slate-500">
                {pacientesFilaAtual.length} pacientes listados
              </span>
            </div>

            {pacientesFilaAtual.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-400 bg-slate-50/50">
                      <th className="py-2.5 px-3 text-center">Posição</th>
                      <th className="py-2.5 px-3">Paciente</th>
                      <th className="py-2.5 px-3">Procedimento / Exame</th>
                      <th className="py-2.5 px-3">Data Solicitação</th>
                      <th className="py-2.5 px-3">Bairro / PSF</th>
                      <th className="py-2.5 px-3 text-center">Prioridade</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {pacientesFilaAtual.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-3 text-center">
                          <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full font-black text-xs ${
                            item.priority === 'Especial'
                              ? 'bg-rose-100 text-rose-700 border border-rose-200'
                              : 'bg-slate-100 text-slate-700'
                          }`}>
                            {item.queue_position || idx + 1}º
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-extrabold text-slate-800">
                            {item.paciente?.name || 'Paciente'}
                          </div>
                          <span className="text-[10px] text-slate-400 font-bold">
                            CPF: {item.paciente?.cpf || '-'}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-700">
                            {item.procedimento?.name || 'Procedimento'}
                          </div>
                          <span className="text-[9px] font-black uppercase text-slate-400">
                            {item.procedimento?.type}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-600 font-bold">
                          {item.solicitation_date || item.created_at?.split('T')[0] || '-'}
                        </td>
                        <td className="py-3 px-3 text-slate-600 font-medium">
                          {item.paciente?.neighborhood || 'Centro'}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className={`px-2.5 py-0.5 rounded-full font-black text-[9px] uppercase tracking-wider ${
                            item.priority === 'Especial'
                              ? 'bg-rose-100 text-rose-700 border border-rose-200'
                              : item.priority === 'Urgência'
                              ? 'bg-amber-100 text-amber-700 border border-amber-200'
                              : 'bg-slate-100 text-slate-700'
                          }`}>
                            {item.priority === 'Especial' ? `Especial ${item.special_sequence ? `#${item.special_sequence}` : ''}` : item.priority}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-10 text-xs font-bold text-slate-400">
                Nenhum paciente aguardando na fila de espera no momento.
              </div>
            )}
          </div>

        </div>
      )}

      {/* === ABA 4: DIAGNÓSTICO & IA PREDITIVA === */}
      {activeTab === 'ia' && (
        <ConsultasIAPanel iaData={analytics.ia} />
      )}

      {/* === ABA 5: EFICIÊNCIA & ABSENTEÍSMO === */}
      {activeTab === 'eficiencia' && (
        <div className="space-y-6">
          
          {/* Cards de Eficiência */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 bg-white rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Taxa de Ocupação das Vagas
              </span>
              <div className="my-2">
                <span className="text-3xl font-black text-indigo-600">
                  {analytics.volume.taxaOcupacaoVagas}%
                </span>
              </div>
              <span className="text-[10px] text-slate-500 font-medium">
                {analytics.volume.vagasDisponiveisLivres} vagas ainda livres para agendamento
              </span>
            </div>

            <div className="p-5 bg-white rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Índice de Faltas (No-Show)
              </span>
              <div className="my-2">
                <span className="text-3xl font-black text-rose-600">
                  {analytics.volume.taxaAbsenteismo}%
                </span>
              </div>
              <span className="text-[10px] text-slate-500 font-medium">
                {analytics.volume.totalNaoRealizados} pacientes não compareceram
              </span>
            </div>

            <div className="p-5 bg-white rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Resolutividade Geral
              </span>
              <div className="my-2">
                <span className="text-3xl font-black text-emerald-600">
                  {analytics.volume.taxaConversaoResolucao}%
                </span>
              </div>
              <span className="text-[10px] text-slate-500 font-medium">
                Solicitações finalizadas com atendimento realizado
              </span>
            </div>
          </div>

          {/* Distribuição Territorial e por Agentes de Saúde */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Por Bairro */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 mb-1 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-sky-600" /> Origem das Demandas por Bairro / PSF
              </h4>
              <p className="text-[10px] text-slate-400 font-medium mb-4">
                Concentração das solicitações por região do município
              </p>

              <div className="space-y-3">
                {analytics.distribuicaoBairros.map((b, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs border-b border-slate-100 pb-2">
                    <span className="font-extrabold text-slate-800">{b.bairro}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-slate-500 font-medium">{b.realizados} atendidos</span>
                      <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full font-bold text-[10px] border border-amber-200">
                        {b.fila} na fila
                      </span>
                      <span className="font-black text-slate-800">{b.total} total</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Por Agente Comunitário de Saúde */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 mb-1 flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-teal-600" /> Atuação dos Agentes de Saúde
              </h4>
              <p className="text-[10px] text-slate-400 font-medium mb-4">
                Volume de munícipes cadastrados e encaminhados por agente
              </p>

              <div className="space-y-3">
                {analytics.distribuicaoAgentes.map((ag, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs border-b border-slate-100 pb-2">
                    <span className="font-extrabold text-slate-800">{ag.agente}</span>
                    <div className="flex items-center gap-2">
                      {ag.especiais > 0 && (
                        <span className="px-2 py-0.5 bg-rose-50 text-rose-600 rounded-full font-bold text-[10px] border border-rose-200">
                          {ag.especiais} especiais
                        </span>
                      )}
                      <span className="px-2.5 py-0.5 bg-slate-100 rounded-full font-black text-slate-700 text-xs">
                        {ag.total} encaminhamentos
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>
      )}

    </div>
  );
};
