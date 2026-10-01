import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft, FileText, Clock, AlertTriangle, CheckCircle2,
  Building2, UserCheck, Send, Download, History, MessageSquare,
  AlertCircle, ChevronRight, Check, Loader2, Plus, Sparkles, X, RefreshCw, Paperclip
} from 'lucide-react';
import { DocumentoFluxo, DocumentoMovimentacao, User, Sector } from '../../types';
import {
  calcularPrazosDocumento,
  formatDataHoraComSegundos,
  EncaminharDocumentoPayload,
  DEFAULT_STATUS_LIST,
  DEFAULT_FASES_LIST,
  getStatusDisponiveis
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
  const [destinoUsuarioId, setDestinoUsuarioId] = useState<string>('');
  const [novoStatus, setNovoStatus] = useState<string>('Em Análise do Gabinete');
  const [novaFase, setNovaFase] = useState<string>('Protocolado na Câmara');
  const [observacao, setObservacao] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [erroModal, setErroModal] = useState<string | null>(null);

  // Status e Fases dinâmicas
  const [statusList, setStatusList] = useState<string[]>(DEFAULT_STATUS_LIST);

  // Estados do Modal de Conclusão
  const [faseConclusao, setFaseConclusao] = useState<string>('Aprovado');
  const [obsConclusao, setObsConclusao] = useState<string>('');
  const [isSubmittingConclusao, setIsSubmittingConclusao] = useState<boolean>(false);

  // Relógio dinâmico para atualização dos cronômetros a cada segundo
  useEffect(() => {
    const timer = setInterval(() => {
      setAgora(new Date());
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  // Carregar status disponíveis
  useEffect(() => {
    getStatusDisponiveis().then(s => setStatusList(s));
  }, []);

  // Lista de usuários habilitados no sistema
  const usuariosDisponiveis = useMemo(() => {
    if (users && users.length > 0) return users;
    return [];
  }, [users]);

  // Define usuário inicial
  useEffect(() => {
    if (usuariosDisponiveis.length > 0 && !destinoUsuarioId) {
      setDestinoUsuarioId(usuariosDisponiveis[0].id);
    }
  }, [usuariosDisponiveis, destinoUsuarioId]);

  // Handler de Encaminhamento
  const handleEncaminharSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!documento) return;

    setErroModal(null);
    if (!destinoUsuarioId) {
      setErroModal('Selecione o servidor de destino.');
      return;
    }

    const usuarioDestino = users.find(u => u.id === destinoUsuarioId);
    const setorDestinoAuto = usuarioDestino?.sector || documento.setor_atual || 'Gabinete';

    setIsSubmitting(true);
    try {
      await onEncaminhar({
        documentoId: documento.id,
        origem_setor: documento.setor_atual,
        origem_usuario_id: currentUser?.id || 'admin',
        origem_usuario_nome: currentUser?.name || 'Servidor',
        destino_setor: setorDestinoAuto,
        destino_usuario_id: destinoUsuarioId,
        destino_usuario_nome: usuarioDestino?.name || 'Servidor Responsável',
        status: novoStatus,
        fase: novaFase,
        observacao: observacao.trim()
      });

      setShowEncaminharModal(false);
      setObservacao('');
    } catch (err: any) {
      console.error('Erro ao encaminhar:', err);
      setErroModal('Erro ao encaminhar o documento.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handler de Conclusão
  const handleConcluirSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!documento) return;

    setIsSubmittingConclusao(true);
    try {
      await onConcluir(faseConclusao, obsConclusao.trim());
      setShowConcluirModal(false);
      setObsConclusao('');
    } catch (err: any) {
      console.error('Erro ao concluir:', err);
    } finally {
      setIsSubmittingConclusao(false);
    }
  };

  // Se ainda estiver carregando e não tiver documento
  if (!documento) {
    if (isLoading) {
      return (
        <div className="w-full flex-1 flex flex-col items-center justify-center p-6 text-center font-sans bg-slate-50">
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

    return (
      <div className="w-full flex-1 flex flex-col items-center justify-center p-6 text-center font-sans bg-slate-50">
        <AlertCircle className="w-12 h-12 text-amber-500 mb-3" />
        <h3 className="text-base font-bold text-slate-800">Documento Não Encontrado</h3>
        <p className="text-xs text-slate-500 mt-1 mb-4 max-w-sm">
          O documento especificado (<span className="font-mono text-slate-700">{documentoId}</span>) não foi encontrado.
        </p>
        <div className="flex gap-2">
          <button
            onClick={onVoltar}
            className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 shadow-xs"
          >
            Voltar para Lista
          </button>
          <button
            onClick={onRefresh}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 flex items-center gap-1.5 shadow-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  // Cálculos de prazo e alerta dinâmicos
  const prazos = calcularPrazosDocumento(documento, agora);

  return (
    <div className="w-full flex-1 flex flex-col bg-slate-50 font-sans min-h-0 overflow-y-auto">
      {/* Topo Limpo */}
      <div className="bg-white border-b border-slate-200/80 px-4 md:px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={onVoltar}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all"
            title="Voltar para a Lista"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-lg border border-blue-100">
                {documento.numero_sequencial}
              </span>
              <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                {documento.tipo_documento}
              </span>
              <span className="text-xs font-bold text-slate-800 bg-slate-100 px-2.5 py-0.5 rounded-lg">
                {documento.status}
              </span>
              <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-lg">
                {documento.fase}
              </span>
            </div>
            <h1 className="text-base md:text-lg font-bold text-slate-900 mt-1 leading-tight">{documento.titulo}</h1>
          </div>
        </div>

        {/* Botões de Ação */}
        <div className="flex items-center gap-2 self-end md:self-auto">
          {!documento.concluido ? (
            <>
              <button
                onClick={() => setShowEncaminharModal(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" /> Encaminhar
              </button>

              <button
                onClick={() => setShowConcluirModal(true)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Concluir
              </button>
            </>
          ) : (
            <span className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold rounded-xl flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Documento Concluído
            </span>
          )}
        </div>
      </div>

      {/* Conteúdo Principal */}
      <div className="p-4 md:p-6 max-w-5xl mx-auto w-full space-y-6">
        {/* Card 1: Resumo do Documento */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 md:p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Informações Principais</h2>
            <span className="text-xs text-slate-500">
              Criado por: <strong className="text-slate-800">{documento.criado_por_nome}</strong> em {new Date(documento.data_criacao).toLocaleDateString('pt-BR')}
            </span>
          </div>

          {documento.descricao && (
            <div>
              <p className="text-xs font-bold text-slate-500 mb-1">Descrição / Detalhes:</p>
              <p className="text-xs text-slate-800 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                {documento.descricao}
              </p>
            </div>
          )}

          {/* Servidor Responsável Atual & Setor */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-3">
              <Building2 className="w-5 h-5 text-blue-600 shrink-0" />
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Setor Atual</span>
                <span className="text-xs font-bold text-slate-800">{documento.setor_atual}</span>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-3">
              <UserCheck className="w-5 h-5 text-blue-600 shrink-0" />
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Servidor Responsável</span>
                <span className="text-xs font-bold text-slate-800">{documento.responsavel_atual_nome}</span>
              </div>
            </div>
          </div>

          {/* Anexo se houver */}
          {documento.anexo_url && (
            <div className="pt-2">
              <span className="text-xs font-bold text-slate-500 block mb-1.5">Anexo Anexado:</span>
              <a
                href={documento.anexo_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl text-xs font-bold text-blue-700 transition-all"
              >
                <Paperclip className="w-4 h-4 text-blue-600" />
                <span>{documento.anexo_nome || 'Baixar Anexo do Documento'}</span>
                <Download className="w-3.5 h-3.5 text-blue-600 ml-1" />
              </a>
            </div>
          )}
        </div>

        {/* Card 2: Linha do Tempo / Histórico de Movimentações */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 md:p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Histórico de Movimentações & Fases</h2>
            <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-lg">
              {movimentacoes.length} Registros
            </span>
          </div>

          {movimentacoes.length > 0 ? (
            <div className="space-y-4 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-slate-200 pl-8 pt-1">
              {movimentacoes.map((mov, idx) => (
                <div key={mov.id || idx} className="relative group">
                  <div className="absolute -left-8 top-0.5 w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shadow-xs">
                    {movimentacoes.length - idx}
                  </div>

                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-1.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
                      <div className="flex items-center gap-1.5 font-bold text-slate-800">
                        <span>{mov.origem_setor}</span>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-blue-700">{mov.destino_setor}</span>
                      </div>
                      <span className="text-[11px] text-slate-400">{mov.data_hora}</span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      <span>De: <strong>{mov.origem_usuario_nome}</strong></span>
                      <span>→</span>
                      <span>Para: <strong>{mov.destino_usuario_nome}</strong></span>
                    </div>

                    <div className="flex items-center gap-2 pt-1 flex-wrap">
                      <span className="text-[10px] font-bold text-slate-700 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                        Status: {mov.status}
                      </span>
                      <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                        Fase: {mov.fase}
                      </span>
                    </div>

                    {mov.observacao && (
                      <p className="text-xs text-slate-700 bg-white p-2.5 rounded-lg border border-slate-200/60 mt-1 italic">
                        "{mov.observacao}"
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500 text-center py-6">Nenhuma movimentação registrada.</p>
          )}
        </div>
      </div>

      {/* Modal de Encaminhamento */}
      {showEncaminharModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Send className="w-4 h-4 text-blue-600" /> Encaminhar Documento
              </h3>
              <button
                onClick={() => setShowEncaminharModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {erroModal && (
              <p className="text-xs font-semibold text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-200">{erroModal}</p>
            )}

            <form onSubmit={handleEncaminharSubmit} className="space-y-3.5">
              {/* Servidor Destinatário */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Destinatário (Servidor do Sistema) *</label>
                <select
                  value={destinoUsuarioId}
                  onChange={(e) => {
                    const uid = e.target.value;
                    setDestinoUsuarioId(uid);
                    const u = users.find(usr => usr.id === uid);
                    if (u?.sector) {
                      setNovoStatus(`Em Análise do ${u.sector}`);
                    }
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                >
                  <option value="">Selecione o servidor destinatário...</option>
                  {usuariosDisponiveis.map(u => (
                    <option key={u.id} value={u.id}>{u.name} {u.sector ? `— Setor: ${u.sector}` : ''}</option>
                  ))}
                </select>
              </div>

              {/* Novo Status */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Novo Status</label>
                <input
                  type="text"
                  value={novoStatus}
                  onChange={(e) => setNovoStatus(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                />
              </div>

              {/* Nova Fase */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nova Fase</label>
                <select
                  value={novaFase}
                  onChange={(e) => setNovaFase(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                >
                  {DEFAULT_FASES_LIST.map(f => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>

              {/* Despacho / Observação */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Despacho / Observação</label>
                <textarea
                  rows={3}
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  placeholder="Instruções ou parecer para o servidor destinatário..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEncaminharModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Confimar Encaminhamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Conclusão */}
      {showConcluirModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Concluir Documento
              </h3>
              <button
                onClick={() => setShowConcluirModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConcluirSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Fase Final de Conclusão *</label>
                <select
                  value={faseConclusao}
                  onChange={(e) => setFaseConclusao(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                >
                  <option value="Aprovado">Aprovado</option>
                  <option value="Parecer Concluído">Parecer Concluído</option>
                  <option value="Resposta Judicial Concluída">Resposta Judicial Concluída</option>
                  <option value="Rejeitado">Rejeitado</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Observação Final</label>
                <textarea
                  rows={3}
                  value={obsConclusao}
                  onChange={(e) => setObsConclusao(e.target.value)}
                  placeholder="Considerações finais sobre a conclusão do processo..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConcluirModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingConclusao}
                  className="px-5 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSubmittingConclusao ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} Finalizar Documento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
