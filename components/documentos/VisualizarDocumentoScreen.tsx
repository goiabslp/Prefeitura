import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ArrowLeft, FileText, Clock, AlertTriangle, CheckCircle2,
  Building2, UserCheck, Send, Download, History, MessageSquare,
  AlertCircle, ChevronRight, Check, Loader2, Plus, Sparkles, X, RefreshCw
} from 'lucide-react';
import { DocumentoFluxo, DocumentoMovimentacao, User, Sector } from '../../types';
import {
  calcularPrazosDocumento,
  formatDataHoraComSegundos,
  EncaminharDocumentoPayload,
  DEFAULT_STATUS_LIST,
  DEFAULT_FASES_LIST,
  getStatusDisponiveis,
  addStatusSetor,
  uploadAnexoDocumento
} from '../../services/documentosService';

interface VisualizarDocumentoScreenProps {
  documentoId: string;
  documento: DocumentoFluxo | null;
  movimentacoes: DocumentoMovimentacao[];
  currentUser: User | null;
  users: User[];
  sectors: Sector[];
  onVoltar: () => void;
  onEncaminhar: (payload: EncaminharDocumentoPayload) => Promise<void>;
  onConcluir: (faseConclusao: string, observacao: string) => Promise<void>;
  onRefresh: () => void;
  isLoading?: boolean;
}

export const VisualizarDocumentoScreen: React.FC<VisualizarDocumentoScreenProps> = ({
  documentoId,
  documento,
  movimentacoes,
  currentUser,
  users,
  sectors,
  onVoltar,
  onEncaminhar,
  onConcluir,
  onRefresh,
  isLoading = false
}) => {
  const [agora, setAgora] = useState<Date>(new Date());
  const [showEncaminharModal, setShowEncaminharModal] = useState<boolean>(false);
  const [showConcluirModal, setShowConcluirModal] = useState<boolean>(false);

  // Estados do Modal de Encaminhamento
  const [destinoSetor, setDestinoSetor] = useState<string>('Jurídico');
  const [destinoUsuarioId, setDestinoUsuarioId] = useState<string>('');
  const [novoStatus, setNovoStatus] = useState<string>('Em Análise do Jurídico');
  const [novaFase, setNovaFase] = useState<string>('Protocolado na Câmara');
  const [observacao, setObservacao] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [erroModal, setErroModal] = useState<string | null>(null);

  // Status e Fases dinâmicas
  const [statusList, setStatusList] = useState<string[]>(DEFAULT_STATUS_LIST);
  const [novoStatusCustom, setNovoStatusCustom] = useState<string>('');
  const [isAddingStatus, setIsAddingStatus] = useState<boolean>(false);

  // Estados do Modal de Conclusão
  const [faseConclusao, setFaseConclusao] = useState<string>('Aprovado');
  const [obsConclusao, setObsConclusao] = useState<string>('');
  const [isSubmittingConclusao, setIsSubmittingConclusao] = useState<boolean>(false);

  // Relógio dinâmico para atualização dos cronômetros a cada segundo
  useEffect(() => {
    const timer = setInterval(() => {
      setAgora(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Carregar status disponíveis
  useEffect(() => {
    getStatusDisponiveis().then(s => setStatusList(s));
  }, []);

  // Atualizar status sugestivo ao trocar setor de destino
  useEffect(() => {
    if (destinoSetor) {
      const matchStatus = `Em Análise do ${destinoSetor}`;
      setNovoStatus(matchStatus);
    }
  }, [destinoSetor]);

  // Lista de usuários habilitados no módulo Documentos
  const usuariosHabilitados = useMemo(() => {
    return users.filter(u => {
      if (u.role === 'admin') return true;
      if (u.permissions && Array.isArray(u.permissions)) {
        return (
          u.permissions.includes('parent_documentos') ||
          u.permissions.includes('sub_documentos_acompanhamento') ||
          u.permissions.includes('sub_documentos_novo') ||
          u.permissions.includes('sub_documentos_visualizar')
        );
      }
      return false;
    });
  }, [users]);

  // Usuários do setor selecionado
  const usuariosDoSetor = useMemo(() => {
    if (!destinoSetor) return usuariosHabilitados;
    const match = usuariosHabilitados.filter(u =>
      u.sector && u.sector.toLowerCase() === destinoSetor.toLowerCase()
    );
    return match.length > 0 ? match : usuariosHabilitados;
  }, [usuariosHabilitados, destinoSetor]);

  // Define usuário inicial ao trocar setor
  useEffect(() => {
    if (usuariosDoSetor.length > 0) {
      setDestinoUsuarioId(usuariosDoSetor[0].id);
    } else {
      setDestinoUsuarioId('');
    }
  }, [usuariosDoSetor]);

  // Setores disponíveis
  const setoresDisponiveis = useMemo(() => {
    const list = sectors && sectors.length > 0
      ? sectors.map(s => s.name)
      : ['Jurídico', 'Contabilidade', 'Administração', 'Convênios', 'Licitação', 'Gabinete'];
    return Array.from(new Set(list));
  }, [sectors]);

  // Se ainda estiver carregando e não tiver documento
  if (!documento) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center font-sans">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-3" />
        <p className="text-sm font-semibold text-slate-700">Carregando detalhes do documento...</p>
        <button
          onClick={onVoltar}
          className="mt-4 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100"
        >
          Voltar para Lista
        </button>
      </div>
    );
  }

  // Cálculos de prazo e alerta dinâmicos
  const prazos = calcularPrazosDocumento(documento, agora);

  // Cores do alerta visual
  let alertaBadgeStyle = 'bg-emerald-50 text-emerald-800 border-emerald-200';
  let alertaDotColor = 'bg-emerald-500';
  if (prazos.alerta === 'geral_vencido') {
    alertaBadgeStyle = 'bg-rose-50 text-rose-800 border-rose-300 font-bold';
    alertaDotColor = 'bg-rose-600';
  } else if (prazos.alerta === 'etapa_atrasada') {
    alertaBadgeStyle = 'bg-red-50 text-red-800 border-red-200 font-semibold';
    alertaDotColor = 'bg-red-500';
  } else if (prazos.alerta === 'prazo_proximo') {
    alertaBadgeStyle = 'bg-amber-50 text-amber-900 border-amber-300 font-semibold';
    alertaDotColor = 'bg-amber-500';
  }

  // Verifica se o usuário atual pode movimentar ou concluir o documento
  const eResponsavelOuAdmin =
    currentUser?.role === 'admin' ||
    documento.responsavel_atual_id === currentUser?.id ||
    documento.responsavel_atual_nome === currentUser?.name ||
    (currentUser?.sector && documento.setor_atual?.toLowerCase() === currentUser.sector.toLowerCase());

  // Executa o encaminhamento
  const handleConfirmarEncaminhamento = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroModal(null);

    if (!observacao.trim()) {
      setErroModal('A observação / despacho é obrigatória em cada movimentação.');
      return;
    }

    const usuarioDestino = usuariosHabilitados.find(u => u.id === destinoUsuarioId);

    setIsSubmitting(true);
    try {
      await onEncaminhar({
        documentoId: documento.id,
        origem_setor: currentUser?.sector || documento.setor_atual,
        origem_usuario_id: currentUser?.id,
        origem_usuario_nome: currentUser?.name || 'Servidor',
        destino_setor: destinoSetor,
        destino_usuario_id: usuarioDestino?.id,
        destino_usuario_nome: usuarioDestino?.name || 'A Definir',
        status: novoStatus,
        fase: novaFase,
        observacao: observacao.trim()
      });

      setShowEncaminharModal(false);
      setObservacao('');
    } catch (err: any) {
      setErroModal(err.message || 'Erro ao encaminhar documento.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Executa a conclusão
  const handleConfirmarConclusao = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingConclusao(true);
    try {
      await onConcluir(faseConclusao, obsConclusao.trim());
      setShowConcluirModal(false);
      setObsConclusao('');
    } catch (err: any) {
      alert(err.message || 'Erro ao concluir documento.');
    } finally {
      setIsSubmittingConclusao(false);
    }
  };

  // Cadastrar novo status inline
  const handleSalvarNovoStatus = async () => {
    if (!novoStatusCustom.trim()) return;
    const atualizados = await addStatusSetor(novoStatusCustom.trim());
    setStatusList(atualizados);
    setNovoStatus(novoStatusCustom.trim());
    setNovoStatusCustom('');
    setIsAddingStatus(false);
  };

  return (
    <div className="w-full flex-1 flex flex-col bg-slate-50 font-sans pb-28 md:pb-16">
      {/* Topo Limpo 100% Viewport */}
      <header className="w-full bg-white border-b border-slate-200 sticky top-0 z-20 shadow-xs">
        <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onVoltar}
              className="p-2 -ml-2 rounded-xl text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors active:scale-95"
              title="Voltar para a listagem"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-slate-600 uppercase tracking-wider bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                  {documento.tipo_documento}
                </span>
                {documento.numero_sequencial && (
                  <span className="text-xs font-mono font-bold text-slate-600 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                    {documento.numero_sequencial}
                  </span>
                )}
              </div>
              <h1 className="text-base sm:text-xl font-black text-slate-900 leading-tight truncate max-w-md sm:max-w-xl lg:max-w-3xl mt-0.5">
                {documento.titulo}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onRefresh}
              title="Recarregar"
              className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors active:scale-95"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
            </button>

            <div className={`text-xs px-3 py-1.5 rounded-full border flex items-center gap-2 shadow-2xs font-bold ${alertaBadgeStyle}`}>
              <span className={`w-2 h-2 rounded-full ${alertaDotColor}`}></span>
              <span>{prazos.alertaLabel}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Conteúdo Principal 100% Viewport em 2 Colunas */}
      <main className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 py-6 flex-1">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* COLUNA ESQUERDA (7 COLUNAS): DETALHES, PRAZOS E AÇÕES */}
          <div className="lg:col-span-7 flex flex-col gap-5">
            {/* Card 1: Painel dos Prazos Oficiais (10 dias geral e 1 dia etapa) */}
            <section className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex flex-col gap-3.5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Controle de Prazos Oficiais
              </h2>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">
              Início: {formatDataHoraComSegundos(documento.data_criacao)}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Prazo Geral de 10 dias */}
            <div className={`p-3.5 rounded-xl border flex flex-col gap-1 ${
              prazos.geralVencido
                ? 'bg-rose-50/70 border-rose-200'
                : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Prazo Geral (10 dias)</span>
                {prazos.geralVencido && (
                  <span className="text-[10px] font-bold text-rose-700 uppercase">Vencido</span>
                )}
              </div>
              <p className={`text-sm sm:text-base font-bold ${
                prazos.geralVencido ? 'text-rose-800' : 'text-slate-900'
              }`}>
                {prazos.geralRestanteTexto}
              </p>
              <span className="text-[10px] text-slate-400">
                Limite final: {formatDataHoraComSegundos(documento.prazo_geral_limite)}
              </span>
            </div>

            {/* Prazo por Movimentação de 1 dia */}
            <div className={`p-3.5 rounded-xl border flex flex-col gap-1 ${
              prazos.etapaAtrasada && !prazos.geralVencido
                ? 'bg-amber-50/70 border-amber-200'
                : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Prazo Desta Etapa (1 dia)</span>
                {prazos.etapaAtrasada && !documento.concluido && (
                  <span className="text-[10px] font-bold text-amber-700 uppercase">Atrasada</span>
                )}
              </div>
              <p className={`text-sm sm:text-base font-bold ${
                prazos.etapaAtrasada && !documento.concluido ? 'text-amber-800' : 'text-slate-900'
              }`}>
                {prazos.etapaRestanteTexto}
              </p>
              <span className="text-[10px] text-slate-400">
                Limite etapa: {formatDataHoraComSegundos(documento.prazo_etapa_limite)}
              </span>
            </div>
          </div>
        </section>

        {/* Card 2: Localização e Situação Atual */}
        <section className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs flex flex-col gap-3">
          <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-slate-100 pb-2">
            Situação Atual do Documento
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs sm:text-sm">
            {/* Onde está (Status) */}
            <div className="flex flex-col gap-1">
              <span className="text-slate-500 font-medium">Status (Onde está):</span>
              <div className="p-2.5 bg-blue-50/70 border border-blue-200 rounded-xl font-semibold text-blue-900 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-600 shrink-0" />
                <span>{documento.status}</span>
              </div>
            </div>

            {/* Fase (Situação) */}
            <div className="flex flex-col gap-1">
              <span className="text-slate-500 font-medium">Fase (Situação):</span>
              <div className="p-2.5 bg-slate-100 border border-slate-200 rounded-xl font-semibold text-slate-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{documento.fase}</span>
              </div>
            </div>

            {/* Responsável Atual */}
            <div className="flex flex-col gap-1">
              <span className="text-slate-500 font-medium">Responsável Atual:</span>
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-slate-500 shrink-0" />
                <span>{documento.responsavel_atual_nome || 'A Definir'}</span>
              </div>
            </div>

            {/* Setor Atual */}
            <div className="flex flex-col gap-1">
              <span className="text-slate-500 font-medium">Setor Atual:</span>
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-slate-500 shrink-0" />
                <span>{documento.setor_atual}</span>
              </div>
            </div>
          </div>

          {/* Anexo se houver */}
          {documento.anexo_url && (
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between bg-slate-50/80 p-3 rounded-xl border border-slate-200">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                <span className="text-xs font-medium text-slate-800 truncate">
                  {documento.anexo_nome || 'Arquivo Anexo'}
                </span>
              </div>
              <a
                href={documento.anexo_url}
                target="_blank"
                rel="noreferrer"
                download={documento.anexo_nome}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-blue-600 hover:bg-blue-50 transition-colors shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Baixar</span>
              </a>
            </div>
          )}
        </section>

        {/* Card 3: Ações Rápidas (Encaminhar / Concluir) */}
        {!documento.concluido && eResponsavelOuAdmin && (
          <section className="bg-blue-50/50 rounded-2xl border border-blue-200/80 p-4 shadow-xs flex flex-col gap-3">
            <h2 className="text-xs font-bold text-blue-900 uppercase tracking-wider">
              Ações Operacionais
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setShowEncaminharModal(true)}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm shadow-xs flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
              >
                <Send className="w-4 h-4" />
                <span>Encaminhar Documento</span>
              </button>

              <button
                type="button"
                onClick={() => setShowConcluirModal(true)}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm shadow-xs flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
              >
                <Check className="w-4 h-4" />
                <span>Concluir Processo</span>
              </button>
            </div>
          </section>
        )}
      </div>

      {/* COLUNA DIREITA (5 COLUNAS): LINHA DO TEMPO COMPLETA E IMUTÁVEL */}
      <div className="lg:col-span-5 flex flex-col gap-5">
        <section className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex flex-col gap-3.5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
                <History className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Histórico de Movimentações
                </h2>
                <p className="text-[10px] text-slate-400 font-medium">Linha do tempo imutável e auditável</p>
              </div>
            </div>
            <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
              {movimentacoes.length} {movimentacoes.length === 1 ? 'registro' : 'registros'}
            </span>
          </div>

          <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
            {movimentacoes.map((mov, index) => {
              const isFirst = index === 0;
              const isLast = index === movimentacoes.length - 1;

              return (
                <div key={mov.id} className="relative group">
                  {/* Ponto na timeline */}
                  <div className={`absolute -left-[29px] top-1 w-3.5 h-3.5 rounded-full border-2 border-white ${
                    mov.tipo_evento === 'conclusao'
                      ? 'bg-emerald-500 ring-2 ring-emerald-100'
                      : mov.tipo_evento === 'criacao'
                      ? 'bg-blue-500 ring-2 ring-blue-100'
                      : 'bg-slate-400 ring-2 ring-slate-100'
                  }`} />

                  {/* Conteúdo da movimentação */}
                  <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-3.5 flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-xs font-mono font-bold text-slate-700">
                        {mov.data_hora}
                      </span>
                      <span className="text-[11px] font-medium px-2 py-0.5 bg-white border border-slate-200 rounded-md text-slate-600">
                        {mov.tipo_evento === 'criacao'
                          ? 'Criação'
                          : mov.tipo_evento === 'conclusao'
                          ? 'Conclusão'
                          : 'Encaminhamento'}
                      </span>
                    </div>

                    {/* Origem e Destino com Usuário Responsável */}
                    <div className="text-xs text-slate-800 font-medium">
                      {mov.tipo_evento === 'criacao' ? (
                        <p>
                          Documento criado por <strong className="text-blue-700">{mov.origem_usuario_nome || 'Usuário'}</strong>
                        </p>
                      ) : mov.tipo_evento === 'conclusao' ? (
                        <p className="text-emerald-700 font-semibold">
                          Processo finalizado por {mov.responsavel_nome || mov.origem_usuario_nome}
                        </p>
                      ) : (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span>{mov.origem_setor}</span>
                          <span className="text-slate-400">→</span>
                          <strong className="text-blue-700">{mov.destino_setor}</strong>
                          <span className="text-slate-500 font-normal">
                            (Responsável: <strong>{mov.responsavel_nome || mov.destino_usuario_nome}</strong>)
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Status / Fase */}
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                      <span className="px-2 py-0.5 bg-blue-100/60 text-blue-900 rounded font-medium">
                        {mov.status}
                      </span>
                      <span className="px-2 py-0.5 bg-slate-200/60 text-slate-700 rounded font-medium">
                        {mov.fase}
                      </span>
                    </div>

                    {/* Observação / Despacho */}
                    {mov.observacao && (
                      <div className="mt-1 text-xs text-slate-600 bg-white p-2.5 rounded-lg border border-slate-100 flex items-start gap-1.5">
                        <MessageSquare className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                        <span className="italic">{mov.observacao}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  </main>

      {/* Modal 1: Encaminhar Documento */}
      {showEncaminharModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 border border-slate-200 shadow-xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Encaminhar Documento</h3>
                <p className="text-xs text-slate-500">
                  Nova etapa (prazo de 1 dia limitado aos {prazos.geralRestanteTexto})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowEncaminharModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {erroModal && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{erroModal}</span>
              </div>
            )}

            <form onSubmit={handleConfirmarEncaminhamento} className="flex flex-col gap-3.5">
              {/* Setor de Destino */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-700">Setor de Destino *</label>
                <select
                  value={destinoSetor}
                  onChange={e => setDestinoSetor(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                >
                  {setoresDisponiveis.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Usuário Responsável */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700">Novo Usuário Responsável *</label>
                  <span className="text-[10px] text-slate-400">Apenas com acesso a Documentos</span>
                </div>
                <select
                  value={destinoUsuarioId}
                  onChange={e => setDestinoUsuarioId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="">Selecione um usuário...</option>
                  {usuariosHabilitados.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name} {u.sector ? `(${u.sector})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Novo Status */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700">Status (Onde está)</label>
                  {!isAddingStatus && (
                    <button
                      type="button"
                      onClick={() => setIsAddingStatus(true)}
                      className="text-xs text-blue-600 font-semibold hover:underline"
                    >
                      + Novo Status
                    </button>
                  )}
                </div>

                {isAddingStatus ? (
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="text"
                      value={novoStatusCustom}
                      onChange={e => setNovoStatusCustom(e.target.value)}
                      placeholder="Ex: Em Análise da Ouvidoria..."
                      className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800"
                    />
                    <button
                      type="button"
                      onClick={handleSalvarNovoStatus}
                      className="px-3 py-2 bg-blue-600 text-white text-xs font-semibold rounded-xl"
                    >
                      Salvar
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsAddingStatus(false)}
                      className="p-1.5 text-slate-400"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <select
                    value={novoStatus}
                    onChange={e => setNovoStatus(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                  >
                    {statusList.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Nova Fase */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-700">Fase (Situação)</label>
                <select
                  value={novaFase}
                  onChange={e => setNovaFase(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                >
                  {DEFAULT_FASES_LIST.map(f => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>

              {/* Observação / Despacho */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-700">
                  Observação / Despacho *
                </label>
                <textarea
                  rows={3}
                  value={observacao}
                  onChange={e => setObservacao(e.target.value)}
                  placeholder="Instruções para o destinatário..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEncaminharModal(false)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm shadow-xs flex items-center justify-center gap-1.5 transition-all"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Encaminhar</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Concluir Processo */}
      {showConcluirModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 border border-slate-200 shadow-xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Concluir Processo</h3>
                <p className="text-xs text-slate-500">Finalizar o trâmite do documento</p>
              </div>
              <button
                type="button"
                onClick={() => setShowConcluirModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmarConclusao} className="flex flex-col gap-3.5">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-700">Fase de Conclusão</label>
                <select
                  value={faseConclusao}
                  onChange={e => setFaseConclusao(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800"
                >
                  <option value="Aprovado">Aprovado</option>
                  <option value="Parecer Concluído">Parecer Concluído</option>
                  <option value="Resposta Judicial Concluída">Resposta Judicial Concluída</option>
                  <option value="Rejeitado">Rejeitado</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-700">Observação Final</label>
                <textarea
                  rows={3}
                  value={obsConclusao}
                  onChange={e => setObsConclusao(e.target.value)}
                  placeholder="Despacho conclusivo..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800"
                />
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowConcluirModal(false)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingConclusao}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm shadow-xs flex items-center justify-center gap-1.5 transition-all"
                >
                  {isSubmittingConclusao ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Concluir</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
