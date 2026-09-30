import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText, Plus, Search, Filter, Clock, AlertCircle, CheckCircle2,
  ChevronRight, ArrowRight, UserCheck, Building2, Calendar, RefreshCw,
  LayoutGrid, List, AlertTriangle, Layers, TrendingUp, Sparkles, Check
} from 'lucide-react';
import { DocumentoFluxo, User } from '../../types';
import { calcularPrazosDocumento, formatDataHoraComSegundos } from '../../services/documentosService';

interface DocumentosListScreenProps {
  documentos: DocumentoFluxo[];
  currentUser: User | null;
  onNovoDocumento: () => void;
  onVisualizarDocumento: (id: string) => void;
  onRefresh: () => void;
  isLoading?: boolean;
}

type TabType = 'meus' | 'recebidos' | 'concluidos';
type ViewMode = 'grid' | 'table';

export const DocumentosListScreen: React.FC<DocumentosListScreenProps> = ({
  documentos,
  currentUser,
  onNovoDocumento,
  onVisualizarDocumento,
  onRefresh,
  isLoading = false
}) => {
  // Sincronização da aba com a URL search param (?aba=meus|recebidos|concluidos)
  const getInitialTab = (): TabType => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search).get('aba');
      if (p === 'recebidos' || p === 'concluidos') return p;
    }
    return 'meus';
  };

  const [activeTab, setActiveTab] = useState<TabType>(getInitialTab());
  const [searchTerm, setSearchTerm] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState<string>('todos');
  const [prazoFiltro, setPrazoFiltro] = useState<string>('todos');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [agora, setAgora] = useState<Date>(new Date());

  // Atualização suave do relógio para manter os cronômetros dinâmicos
  useEffect(() => {
    const timer = setInterval(() => {
      setAgora(new Date());
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  // Altera aba e sincroniza a URL
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('aba', tab);
      window.history.pushState({}, '', url.pathname + url.search);
    }
  };

  // Cálculo das métricas gerais (KPIs)
  const metricas = useMemo(() => {
    let total = documentos.length;
    let meus = 0;
    let recebidos = 0;
    let concluidos = 0;
    let alertasPrazo = 0;

    documentos.forEach(doc => {
      const isDone = doc.concluido || doc.fase === 'Aprovado' || doc.fase === 'Parecer Concluído';
      if (isDone) {
        concluidos++;
      } else {
        const souCriador = doc.criado_por_id === currentUser?.id || doc.criado_por_nome === currentUser?.name;
        const souResponsavel = doc.responsavel_atual_id === currentUser?.id || doc.responsavel_atual_nome === currentUser?.name;
        const eMeuSetor = currentUser?.sector && doc.setor_atual?.toLowerCase() === currentUser.sector.toLowerCase();

        if (souCriador || souResponsavel) meus++;
        if (souResponsavel || eMeuSetor) recebidos++;

        const p = calcularPrazosDocumento(doc, agora);
        if (p.alerta !== 'no_prazo') {
          alertasPrazo++;
        }
      }
    });

    return { total, meus, recebidos, concluidos, alertasPrazo };
  }, [documentos, currentUser, agora]);

  // Filtragem dos documentos
  const documentosFiltrados = useMemo(() => {
    return documentos.filter(doc => {
      // 1. Filtro por Aba
      if (activeTab === 'concluidos') {
        if (!doc.concluido && doc.fase !== 'Aprovado' && doc.fase !== 'Parecer Concluído') {
          return false;
        }
      } else if (activeTab === 'meus') {
        const souCriador = doc.criado_por_id === currentUser?.id || doc.criado_por_nome === currentUser?.name;
        const souResponsavel = doc.responsavel_atual_id === currentUser?.id || doc.responsavel_atual_nome === currentUser?.name;
        if (!souCriador && !souResponsavel) return false;
        if (doc.concluido) return false;
      } else if (activeTab === 'recebidos') {
        const souResponsavel = doc.responsavel_atual_id === currentUser?.id || doc.responsavel_atual_nome === currentUser?.name;
        const eMeuSetor = currentUser?.sector && doc.setor_atual?.toLowerCase() === currentUser.sector.toLowerCase();
        if (!souResponsavel && !eMeuSetor) return false;
        if (doc.concluido) return false;
      }

      // 2. Filtro por Tipo
      if (tipoFiltro !== 'todos' && doc.tipo_documento !== tipoFiltro) {
        return false;
      }

      // 3. Filtro por Prazo / Alerta
      if (prazoFiltro !== 'todos') {
        const p = calcularPrazosDocumento(doc, agora);
        if (prazoFiltro === 'atrasados' && p.alerta !== 'geral_vencido' && p.alerta !== 'etapa_atrasada') {
          return false;
        }
        if (prazoFiltro === 'atencao' && p.alerta !== 'prazo_proximo') {
          return false;
        }
        if (prazoFiltro === 'normal' && p.alerta !== 'no_prazo') {
          return false;
        }
      }

      // 4. Busca por texto
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const num = (doc.numero_sequencial || '').toLowerCase();
        const tit = (doc.titulo || '').toLowerCase();
        const tipo = (doc.tipo_documento || '').toLowerCase();
        const resp = (doc.responsavel_atual_nome || '').toLowerCase();
        const setor = (doc.setor_atual || '').toLowerCase();
        const status = (doc.status || '').toLowerCase();
        const fase = (doc.fase || '').toLowerCase();

        return (
          num.includes(query) ||
          tit.includes(query) ||
          tipo.includes(query) ||
          resp.includes(query) ||
          setor.includes(query) ||
          status.includes(query) ||
          fase.includes(query)
        );
      }

      return true;
    });
  }, [documentos, activeTab, tipoFiltro, prazoFiltro, searchTerm, currentUser, agora]);

  // Lista de tipos únicos para o filtro
  const tiposDisponiveis = useMemo(() => {
    const list = documentos.map(d => d.tipo_documento).filter(Boolean);
    return Array.from(new Set(list));
  }, [documentos]);

  return (
    <div className="w-full flex-1 flex flex-col bg-slate-50 min-h-0 text-slate-800 font-sans pb-12">
      {/* 1. TOPO 100% VIEWPORT COM IDENTIDADE E AÇÕES */}
      <header className="w-full bg-white border-b border-slate-200 sticky top-0 z-20 shadow-xs">
        <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 shrink-0">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight leading-tight">
                  Documentos & Tramitações
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200/80 text-blue-700 text-[11px] font-bold">
                  <Sparkles className="w-3 h-3 text-blue-500" /> Fluxo Oficial
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Controle interno, encaminhamento entre setores e monitoramento de prazos em tempo real
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onRefresh}
              title="Recarregar dados"
              className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-all active:scale-95 shadow-2xs"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
            </button>

            <button
              onClick={onNovoDocumento}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs sm:text-sm font-bold shadow-md shadow-blue-500/25 hover:from-blue-700 hover:to-indigo-700 transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Documento</span>
            </button>
          </div>
        </div>
      </header>

      {/* CONTEÚDO PRINCIPAL 100% FLUIDO */}
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 py-5 flex flex-col gap-5 flex-1">

        {/* 2. PAINEL DE KPIS / MÉTRICAS EM 100% DA LARGURA */}
        <section className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          {/* KPI 1: Total */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total no Fluxo</span>
              <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
                <Layers className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black text-slate-900">{metricas.total}</span>
              <span className="text-[11px] font-semibold text-slate-400">cadastrados</span>
            </div>
          </div>

          {/* KPI 2: Meus Documentos */}
          <div 
            onClick={() => handleTabChange('meus')}
            className={`p-4 rounded-2xl border shadow-xs flex flex-col justify-between transition-all cursor-pointer ${
              activeTab === 'meus' 
                ? 'bg-blue-50/70 border-blue-300 ring-2 ring-blue-500/20' 
                : 'bg-white border-slate-200/90 hover:border-blue-200'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wider">Meus Ativos</span>
              <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700">
                <UserCheck className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black text-blue-900">{metricas.meus}</span>
              <span className="text-[11px] font-semibold text-blue-600">sob minha guarda</span>
            </div>
          </div>

          {/* KPI 3: Recebidos no Setor */}
          <div 
            onClick={() => handleTabChange('recebidos')}
            className={`p-4 rounded-2xl border shadow-xs flex flex-col justify-between transition-all cursor-pointer ${
              activeTab === 'recebidos' 
                ? 'bg-indigo-50/70 border-indigo-300 ring-2 ring-indigo-500/20' 
                : 'bg-white border-slate-200/90 hover:border-indigo-200'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-indigo-800 uppercase tracking-wider">Recebidos Setor</span>
              <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700">
                <Building2 className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black text-indigo-900">{metricas.recebidos}</span>
              <span className="text-[11px] font-semibold text-indigo-600">{currentUser?.sector || 'Meu Setor'}</span>
            </div>
          </div>

          {/* KPI 4: Concluídos */}
          <div 
            onClick={() => handleTabChange('concluidos')}
            className={`p-4 rounded-2xl border shadow-xs flex flex-col justify-between transition-all cursor-pointer ${
              activeTab === 'concluidos' 
                ? 'bg-emerald-50/70 border-emerald-300 ring-2 ring-emerald-500/20' 
                : 'bg-white border-slate-200/90 hover:border-emerald-200'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Concluídos</span>
              <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black text-emerald-900">{metricas.concluidos}</span>
              <span className="text-[11px] font-semibold text-emerald-600">finalizados</span>
            </div>
          </div>

          {/* KPI 5: Alertas de Prazos */}
          <div 
            onClick={() => setPrazoFiltro(prazoFiltro === 'atrasados' ? 'todos' : 'atrasados')}
            className={`p-4 rounded-2xl border shadow-xs flex flex-col justify-between transition-all cursor-pointer col-span-2 sm:col-span-1 ${
              metricas.alertasPrazo > 0 
                ? 'bg-amber-50/70 border-amber-300 hover:border-amber-400' 
                : 'bg-white border-slate-200/90 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wider">Prazos & Atenção</span>
              <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700">
                <Clock className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black text-amber-900">{metricas.alertasPrazo}</span>
              <span className="text-[11px] font-semibold text-amber-700">requer atenção</span>
            </div>
          </div>
        </section>

        {/* 3. BARRA DE CONTROLE: ABAS + BUSCA + FILTROS + MODO DE VISUALIZAÇÃO */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-3 sm:p-4 shadow-xs flex flex-col gap-3">
          {/* Linha Superior: Abas de Navegação Fluidas */}
          <div className="flex items-center justify-between flex-wrap gap-2.5 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto w-full sm:w-auto">
              <button
                onClick={() => handleTabChange('meus')}
                className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
                  activeTab === 'meus'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <span>Meus Documentos</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                  activeTab === 'meus' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                }`}>
                  {metricas.meus}
                </span>
              </button>

              <button
                onClick={() => handleTabChange('recebidos')}
                className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
                  activeTab === 'recebidos'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <span>Recebidos ({currentUser?.sector || 'Setor'})</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                  activeTab === 'recebidos' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                }`}>
                  {metricas.recebidos}
                </span>
              </button>

              <button
                onClick={() => handleTabChange('concluidos')}
                className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
                  activeTab === 'concluidos'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <span>Concluídos</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                  activeTab === 'concluidos' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                }`}>
                  {metricas.concluidos}
                </span>
              </button>
            </div>

            {/* Alternância Grid / Tabela */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl shrink-0 self-end sm:self-auto">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                  viewMode === 'grid' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Modo Grade (Cards)"
              >
                <LayoutGrid className="w-4 h-4" />
                <span className="hidden md:inline">Grade</span>
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                  viewMode === 'table' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Modo Tabela Widescreen"
              >
                <List className="w-4 h-4" />
                <span className="hidden md:inline">Tabela</span>
              </button>
            </div>
          </div>

          {/* Linha Inferior: Barra de Busca Expandida + Filtros Dropdown */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
            {/* Input de Busca */}
            <div className="relative sm:col-span-6 lg:col-span-7">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Buscar por protocolo, título, assunto, responsável, fase ou setor..."
                className="w-full pl-10 pr-9 py-2.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-700 font-bold p-1"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filtro por Tipo de Documento */}
            <div className="sm:col-span-3 lg:col-span-3">
              <select
                value={tipoFiltro}
                onChange={e => setTipoFiltro(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              >
                <option value="todos">Todos os Tipos de Documento</option>
                {tiposDisponiveis.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {/* Filtro por Situação de Prazos */}
            <div className="sm:col-span-3 lg:col-span-2">
              <select
                value={prazoFiltro}
                onChange={e => setPrazoFiltro(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              >
                <option value="todos">Todos os Prazos</option>
                <option value="atrasados">Atrasados / Vencidos</option>
                <option value="atencao">Prazo Próximo (&lt; 2 dias)</option>
                <option value="normal">No Prazo Regular</option>
              </select>
            </div>
          </div>
        </div>

        {/* 4. LISTA OU GRADE DE DOCUMENTOS 100% FLUIDA */}
        {documentosFiltrados.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200/90 p-12 text-center my-4 flex flex-col items-center justify-center gap-3.5 shadow-xs w-full">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
              <FileText className="w-8 h-8" />
            </div>
            <div className="max-w-md">
              <h3 className="text-base sm:text-lg font-black text-slate-900">
                Nenhum documento encontrado
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                {searchTerm || tipoFiltro !== 'todos' || prazoFiltro !== 'todos'
                  ? 'Não encontramos nenhum documento com os filtros e busca aplicados. Tente ajustar os parâmetros.'
                  : activeTab === 'meus'
                  ? 'Você ainda não cadastrou nenhum documento e não possui processos sob sua guarda no momento.'
                  : activeTab === 'recebidos'
                  ? `Nenhum documento aguardando ação do seu setor (${currentUser?.sector || 'Geral'}) no momento.`
                  : 'Nenhum documento finalizado ou arquivado nesta categoria.'}
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              {(searchTerm || tipoFiltro !== 'todos' || prazoFiltro !== 'todos') && (
                <button
                  onClick={() => { setSearchTerm(''); setTipoFiltro('todos'); setPrazoFiltro('todos'); }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
                >
                  Limpar Filtros
                </button>
              )}

              <button
                onClick={onNovoDocumento}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-blue-500/20 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Criar Novo Documento
              </button>
            </div>
          </div>
        ) : viewMode === 'grid' ? (
          /* MODO GRID RESPONSIVO WIDESCREEN */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
            {documentosFiltrados.map(doc => {
              const prazoInfo = calcularPrazosDocumento(doc, agora);

              let badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
              let dotColor = 'bg-emerald-500';
              if (prazoInfo.alerta === 'geral_vencido') {
                badgeColor = 'bg-rose-50 text-rose-800 border-rose-200 font-bold';
                dotColor = 'bg-rose-600 animate-pulse';
              } else if (prazoInfo.alerta === 'etapa_atrasada') {
                badgeColor = 'bg-red-50 text-red-700 border-red-200 font-semibold';
                dotColor = 'bg-red-500 animate-pulse';
              } else if (prazoInfo.alerta === 'prazo_proximo') {
                badgeColor = 'bg-amber-50 text-amber-800 border-amber-200 font-semibold';
                dotColor = 'bg-amber-500';
              }

              return (
                <div
                  key={doc.id}
                  onClick={() => onVisualizarDocumento(doc.id)}
                  className="bg-white rounded-2xl border border-slate-200/90 p-4.5 hover:border-blue-400 hover:shadow-lg hover:shadow-blue-500/5 transition-all duration-200 cursor-pointer flex flex-col justify-between gap-3 group relative overflow-hidden"
                >
                  {/* Linha 1: Tipo + Número + Alerta de Prazo */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] font-black px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 uppercase tracking-wider">
                        {doc.tipo_documento}
                      </span>
                      {doc.numero_sequencial && (
                        <span className="text-[11px] font-mono font-bold text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                          {doc.numero_sequencial}
                        </span>
                      )}
                    </div>

                    <div className={`text-[10px] px-2.5 py-0.5 rounded-full border flex items-center gap-1.5 shrink-0 ${badgeColor}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`}></span>
                      <span>{prazoInfo.alertaLabel}</span>
                    </div>
                  </div>

                  {/* Linha 2: Título do Documento */}
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-2 leading-snug">
                      {doc.titulo}
                    </h3>
                    {doc.descricao && (
                      <p className="text-xs text-slate-500 line-clamp-2 mt-1 font-normal leading-relaxed">
                        {doc.descricao}
                      </p>
                    )}
                  </div>

                  {/* Linha 3: Badges de Fase e Status */}
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-800 font-bold rounded-lg border border-blue-100 flex items-center gap-1">
                      <Building2 className="w-3 h-3 text-blue-500" />
                      {doc.status}
                    </span>
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-semibold rounded-lg border border-slate-200">
                      Fase: {doc.fase}
                    </span>
                  </div>

                  {/* Linha 4: Responsável Atual e Prazos Regressivos */}
                  <div className="pt-3 border-t border-slate-100 flex flex-col gap-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-black text-[10px] flex items-center justify-center uppercase shrink-0 border border-slate-200">
                          {(doc.responsavel_atual_nome || 'A')[0]}
                        </div>
                        <div className="min-w-0">
                          <p className="text-slate-800 font-bold truncate text-[11px] leading-tight">
                            {doc.responsavel_atual_nome || 'A Definir'}
                          </p>
                          <p className="text-[10px] text-slate-400 truncate leading-none">
                            {doc.setor_atual}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 text-[11px] font-mono font-semibold text-slate-700 shrink-0">
                        <Clock className="w-3.5 h-3.5 text-blue-500" />
                        <span>{prazoInfo.geralRestanteTexto}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 text-[10px] text-slate-400">
                      <span>Criado: {new Date(doc.data_criacao).toLocaleDateString('pt-BR')}</span>
                      <span className="inline-flex items-center gap-0.5 text-blue-600 font-bold group-hover:translate-x-0.5 transition-transform">
                        Ver detalhes <ChevronRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* MODO TABELA WIDESCREEN CORPORATIVA */
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden w-full">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">Protocolo / Tipo</th>
                    <th className="py-3 px-4">Título & Assunto</th>
                    <th className="py-3 px-4">Status / Fase</th>
                    <th className="py-3 px-4">Responsável & Setor</th>
                    <th className="py-3 px-4">Prazo Geral</th>
                    <th className="py-3 px-4">Prazo Etapa</th>
                    <th className="py-3 px-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {documentosFiltrados.map(doc => {
                    const prazoInfo = calcularPrazosDocumento(doc, agora);
                    let badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                    if (prazoInfo.alerta === 'geral_vencido') {
                      badgeColor = 'bg-rose-50 text-rose-800 border-rose-200 font-bold';
                    } else if (prazoInfo.alerta === 'etapa_atrasada') {
                      badgeColor = 'bg-red-50 text-red-700 border-red-200 font-semibold';
                    } else if (prazoInfo.alerta === 'prazo_proximo') {
                      badgeColor = 'bg-amber-50 text-amber-800 border-amber-200 font-semibold';
                    }

                    return (
                      <tr
                        key={doc.id}
                        onClick={() => onVisualizarDocumento(doc.id)}
                        className="hover:bg-blue-50/40 transition-colors cursor-pointer group"
                      >
                        <td className="py-3 px-4">
                          <div className="font-mono font-bold text-slate-800">
                            {doc.numero_sequencial || 'S/N'}
                          </div>
                          <span className="text-[10px] font-semibold text-slate-500 uppercase">
                            {doc.tipo_documento}
                          </span>
                        </td>
                        <td className="py-3 px-4 max-w-xs">
                          <div className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                            {doc.titulo}
                          </div>
                          {doc.descricao && (
                            <div className="text-[11px] text-slate-400 truncate">
                              {doc.descricao}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="inline-block px-2 py-0.5 rounded-md bg-blue-50 border border-blue-100 text-blue-800 font-bold text-[10px]">
                            {doc.status}
                          </span>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            Fase: {doc.fase}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-800 truncate max-w-[180px]">
                            {doc.responsavel_atual_nome || 'A Definir'}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">
                            {doc.setor_atual}
                          </div>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className={`inline-block px-2 py-0.5 rounded-full border text-[10px] font-semibold ${badgeColor}`}>
                            {prazoInfo.geralRestanteTexto}
                          </span>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="text-slate-600 font-mono text-[11px]">
                            {prazoInfo.etapaRestanteTexto}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <button
                            onClick={(e) => { e.stopPropagation(); onVisualizarDocumento(doc.id); }}
                            className="px-3 py-1.5 rounded-xl bg-slate-100 group-hover:bg-blue-600 group-hover:text-white text-slate-700 font-bold text-[11px] transition-all inline-flex items-center gap-1"
                          >
                            <span>Abrir</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
