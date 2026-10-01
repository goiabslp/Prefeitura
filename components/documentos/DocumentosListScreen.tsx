import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText, Plus, Search, Filter, Clock, AlertCircle, CheckCircle2,
  ChevronRight, ArrowRight, UserCheck, Building2, Calendar, RefreshCw,
  LayoutGrid, List, AlertTriangle, Layers, TrendingUp, Sparkles, Check, Send
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
  const [agora, setAgora] = useState<Date>(new Date());

  // Relógio para manter prazos atualizados
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

  // Tipos únicos para filtro
  const tiposDisponiveis = useMemo(() => {
    const set = new Set<string>();
    documentos.forEach(d => {
      if (d.tipo_documento) set.add(d.tipo_documento);
    });
    return Array.from(set);
  }, [documentos]);

  // Contadores simples para as abas
  const contadores = useMemo(() => {
    let meus = 0;
    let recebidos = 0;
    let concluidos = 0;

    documentos.forEach(doc => {
      const isDone = doc.concluido || doc.fase === 'Aprovado' || doc.fase === 'Parecer Concluído' || doc.fase === 'Rejeitado';
      if (isDone) {
        concluidos++;
      } else {
        const souCriador = doc.criado_por_id === currentUser?.id || doc.criado_por_nome === currentUser?.name;
        const souResponsavel = doc.responsavel_atual_id === currentUser?.id || doc.responsavel_atual_nome === currentUser?.name;
        const eMeuSetor = currentUser?.sector && doc.setor_atual?.toLowerCase() === currentUser.sector.toLowerCase();

        if (souCriador || souResponsavel) meus++;
        if (souResponsavel || eMeuSetor) recebidos++;
      }
    });

    return { meus, recebidos, concluidos };
  }, [documentos, currentUser]);

  // Filtragem dos documentos
  const documentosFiltrados = useMemo(() => {
    return documentos.filter(doc => {
      const isDone = doc.concluido || doc.fase === 'Aprovado' || doc.fase === 'Parecer Concluído' || doc.fase === 'Rejeitado';

      // 1. Filtro por Aba
      if (activeTab === 'concluidos') {
        if (!isDone) return false;
      } else if (activeTab === 'recebidos') {
        if (isDone) return false;
        const souResponsavel = doc.responsavel_atual_id === currentUser?.id || doc.responsavel_atual_nome === currentUser?.name;
        const eMeuSetor = currentUser?.sector && doc.setor_atual?.toLowerCase() === currentUser.sector.toLowerCase();
        if (!souResponsavel && !eMeuSetor) return false;
      } else {
        // Meus Documentos
        if (isDone) return false;
        const souCriador = doc.criado_por_id === currentUser?.id || doc.criado_por_nome === currentUser?.name;
        const souResponsavel = doc.responsavel_atual_id === currentUser?.id || doc.responsavel_atual_nome === currentUser?.name;
        if (!souCriador && !souResponsavel) return false;
      }

      // 2. Filtro por Tipo
      if (tipoFiltro !== 'todos' && doc.tipo_documento !== tipoFiltro) {
        return false;
      }

      // 3. Filtro por Busca de Texto
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const matchesSeq = doc.numero_sequencial?.toLowerCase().includes(term);
        const matchesTitulo = doc.titulo?.toLowerCase().includes(term);
        const matchesDesc = doc.descricao?.toLowerCase().includes(term);
        const matchesStatus = doc.status?.toLowerCase().includes(term);
        const matchesFase = doc.fase?.toLowerCase().includes(term);
        const matchesResp = doc.responsavel_atual_nome?.toLowerCase().includes(term);
        const matchesSetor = doc.setor_atual?.toLowerCase().includes(term);
        if (!matchesSeq && !matchesTitulo && !matchesDesc && !matchesStatus && !matchesFase && !matchesResp && !matchesSetor) {
          return false;
        }
      }

      return true;
    });
  }, [documentos, activeTab, tipoFiltro, searchTerm, currentUser]);

  return (
    <div className="w-full flex-1 flex flex-col bg-slate-50 font-sans min-h-0 overflow-hidden">
      {/* Topo / Header Limpo */}
      <div className="bg-white border-b border-slate-200/80 px-4 md:px-6 py-4 flex flex-col gap-3 shrink-0 shadow-xs">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-sm shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 leading-tight">Documentos Internos</h1>
              <p className="text-xs text-slate-500">Fluxo, encaminhamento e acompanhamento entre setores</p>
            </div>
          </div>

          <button
            onClick={onNovoDocumento}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Criar Documento</span>
            <span className="sm:hidden">Novo</span>
          </button>
        </div>

        {/* Abas e Filtros Simples */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1">
          {/* Abas Tab Pill */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/60 shrink-0">
            <button
              onClick={() => handleTabChange('meus')}
              className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'meus' ? 'bg-white text-blue-600 shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Meus Documentos</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${activeTab === 'meus' ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-600'}`}>
                {contadores.meus}
              </span>
            </button>

            <button
              onClick={() => handleTabChange('recebidos')}
              className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'recebidos' ? 'bg-white text-blue-600 shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Recebidos / Setor</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${activeTab === 'recebidos' ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-600'}`}>
                {contadores.recebidos}
              </span>
            </button>

            <button
              onClick={() => handleTabChange('concluidos')}
              className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'concluidos' ? 'bg-white text-blue-600 shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Concluidos</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${activeTab === 'concluidos' ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-600'}`}>
                {contadores.concluidos}
              </span>
            </button>
          </div>

          {/* Busca & Filtro de Tipo */}
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por número, título, setor..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                >
                  ×
                </button>
              )}
            </div>

            {tiposDisponiveis.length > 0 && (
              <select
                value={tipoFiltro}
                onChange={(e) => setTipoFiltro(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:border-blue-500 transition-all cursor-pointer"
              >
                <option value="todos">Todos os Tipos</option>
                {tiposDisponiveis.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            )}

            <button
              onClick={onRefresh}
              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-xl transition-all shrink-0"
              title="Atualizar lista"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Conteúdo Principal: Lista de Cards Limpos */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6">
        {documentosFiltrados.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 max-w-7xl mx-auto">
            {documentosFiltrados.map(doc => {
              const prazos = calcularPrazosDocumento(doc, agora);

              return (
                <div
                  key={doc.id}
                  onClick={() => onVisualizarDocumento(doc.id)}
                  className="bg-white rounded-2xl border border-slate-200/90 hover:border-blue-400 shadow-2xs hover:shadow-md transition-all p-4 flex flex-col justify-between cursor-pointer group relative overflow-hidden"
                >
                  {/* Topo do Card: Número Sequencial + Badge Tipo */}
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-[11px] font-bold font-mono text-blue-700 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100">
                        {doc.numero_sequencial}
                      </span>

                      <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200/60 truncate max-w-[140px]">
                        {doc.tipo_documento}
                      </span>
                    </div>

                    {/* Título do Documento */}
                    <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-2 leading-snug mb-1.5">
                      {doc.titulo}
                    </h3>

                    {/* Descrição em miniatura */}
                    {doc.descricao && (
                      <p className="text-xs text-slate-500 line-clamp-2 mb-3 leading-relaxed">
                        {doc.descricao}
                      </p>
                    )}
                  </div>

                  {/* Detalhes de Localização, Status e Fase */}
                  <div className="pt-3 border-t border-slate-100 space-y-2 mt-2">
                    {/* Localização Atual */}
                    <div className="flex items-center justify-between text-xs text-slate-600">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-semibold text-slate-800 truncate">{doc.setor_atual}</span>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-slate-500 shrink-0">
                        <UserCheck className="w-3 h-3 text-slate-400" />
                        <span className="truncate max-w-[110px]">{doc.responsavel_atual_nome}</span>
                      </div>
                    </div>

                    {/* Badges de Status & Fase */}
                    <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                      <span className="text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                        {doc.status}
                      </span>
                      <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
                        {doc.fase}
                      </span>

                      {/* Prazo */}
                      {prazos.alerta !== 'no_prazo' && !doc.concluido && (
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
                          prazos.alerta === 'geral_vencido' ? 'bg-rose-100 text-rose-700' :
                          prazos.alerta === 'etapa_atrasada' ? 'bg-amber-100 text-amber-800' :
                          'bg-amber-50 text-amber-700'
                        }`}>
                          {prazos.alertaLabel}
                        </span>
                      )}
                    </div>

                    {/* Rodapé do Card: Data de Criação + Ação */}
                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                      <span>Criado em: {new Date(doc.data_criacao).toLocaleDateString('pt-BR')}</span>
                      <span className="text-blue-600 font-bold group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                        Ver Detalhes <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-white rounded-2xl border border-dashed border-slate-200 max-w-md mx-auto my-12">
            <FileText className="w-12 h-12 text-slate-300 mb-3" />
            <h3 className="text-sm font-bold text-slate-700">Nenhum documento encontrado</h3>
            <p className="text-xs text-slate-500 mt-1 mb-4">
              {searchTerm ? 'Nenhum resultado corresponde à sua busca.' : 'Não há documentos nesta categoria ainda.'}
            </p>
            <button
              onClick={onNovoDocumento}
              className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-all flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Criar Novo Documento
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
