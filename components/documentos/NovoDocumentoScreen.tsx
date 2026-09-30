import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ArrowLeft, Upload, FileText, CheckCircle2, AlertCircle, X,
  Building2, UserCheck, Plus, Loader2, Clock, Sparkles, Send,
  Tag, ShieldCheck, User as UserIcon, ArrowRight, FileCheck, Info, Sparkle
} from 'lucide-react';
import { User, Sector } from '../../types';
import {
  getTiposDocumento,
  addTipoDocumento,
  uploadAnexoDocumento,
  CreateDocumentoPayload
} from '../../services/documentosService';

interface NovoDocumentoScreenProps {
  currentUser: User | null;
  users: User[];
  sectors: Sector[];
  onVoltar: () => void;
  onSalvar: (payload: CreateDocumentoPayload) => Promise<void>;
}

export const NovoDocumentoScreen: React.FC<NovoDocumentoScreenProps> = ({
  currentUser,
  users,
  sectors,
  onVoltar,
  onSalvar
}) => {
  const [tipos, setTipos] = useState<string[]>([]);
  const [tipoSelecionado, setTipoSelecionado] = useState<string>('');
  const [novoTipoCustom, setNovoTipoCustom] = useState<string>('');
  const [isAddingTipo, setIsAddingTipo] = useState<boolean>(false);

  const [titulo, setTitulo] = useState<string>('');
  const [observacao, setObservacao] = useState<string>('');

  const [setorDestino, setSetorDestino] = useState<string>('');
  const [usuarioDestinoId, setUsuarioDestinoId] = useState<string>('');

  const [anexoFile, setAnexoFile] = useState<File | null>(null);
  const [anexoInfo, setAnexoInfo] = useState<{ url: string; nome: string; tamanho: number } | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [erroForm, setErroForm] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Carrega tipos de documentos disponíveis
  useEffect(() => {
    const carregar = async () => {
      const list = await getTiposDocumento();
      setTipos(list);
      if (list.length > 0) {
        setTipoSelecionado(list[0]);
      }
    };
    carregar();
  }, []);

  // Lista de setores disponíveis
  const setoresDisponiveis = useMemo(() => {
    if (sectors.length > 0) {
      return sectors.map(s => s.name);
    }
    return ['Secretaria de Administração', 'Gabinete do Prefeito', 'Finanças', 'Jurídico', 'Obras e Serviços', 'Saúde', 'Educação'];
  }, [sectors]);

  // Define setor de destino padrão
  useEffect(() => {
    if (!setorDestino && setoresDisponiveis.length > 0) {
      setSetorDestino(setoresDisponiveis[0]);
    }
  }, [setoresDisponiveis, setorDestino]);

  // Filtra usuários habilitados
  const usuariosHabilitados = useMemo(() => {
    return users.filter(u => u.permissions?.includes('sub_documentos_acompanhar') || u.permissions?.includes('parent_documentos') || u.role === 'admin' || u.role === 'collaborator');
  }, [users]);

  // Seleciona primeiro usuário por padrão
  useEffect(() => {
    if (!usuarioDestinoId && usuariosHabilitados.length > 0) {
      setUsuarioDestinoId(usuariosHabilitados[0].id);
    }
  }, [usuariosHabilitados, usuarioDestinoId]);

  // Handler para adicionar novo tipo customizado
  const handleCadastrarNovoTipo = async () => {
    if (!novoTipoCustom.trim()) return;
    const atualizada = await addTipoDocumento(novoTipoCustom.trim());
    setTipos(atualizada);
    setTipoSelecionado(novoTipoCustom.trim());
    setNovoTipoCustom('');
    setIsAddingTipo(false);
  };

  // Upload do arquivo de anexo
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAnexoFile(file);
    setIsUploading(true);
    setErroForm('');

    try {
      const res = await uploadAnexoDocumento(file);
      setAnexoInfo(res);
    } catch (err: any) {
      console.error('Erro no upload:', err);
      setErroForm('Erro ao fazer upload do anexo. O documento poderá ser criado sem ele.');
    } finally {
      setIsUploading(false);
    }
  };

  const removerAnexo = () => {
    setAnexoFile(null);
    setAnexoInfo(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Submissão do Formulário
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroForm('');

    if (!tipoSelecionado) {
      setErroForm('Selecione o Tipo de Documento.');
      return;
    }
    if (!titulo.trim()) {
      setErroForm('Informe o Título / Assunto do documento.');
      return;
    }
    if (!setorDestino) {
      setErroForm('Selecione o Setor Responsável de destino.');
      return;
    }
    if (!usuarioDestinoId) {
      setErroForm('Selecione o Servidor Responsável habilitado.');
      return;
    }

    const usuarioDestino = users.find(u => u.id === usuarioDestinoId);

    setIsSubmitting(true);
    try {
      const payload: CreateDocumentoPayload = {
        tipo_documento: tipoSelecionado,
        titulo: titulo.trim(),
        descricao: observacao.trim() || undefined,
        criado_por_id: currentUser?.id || 'admin',
        criado_por_nome: currentUser?.name || 'Servidor',
        destino_setor: setorDestino,
        destino_usuario_id: usuarioDestinoId,
        destino_usuario_nome: usuarioDestino?.name || 'Servidor Responsável',
        observacao_inicial: observacao.trim() || undefined,
        anexo_url: anexoInfo?.url,
        anexo_nome: anexoInfo?.nome
      };

      await onSalvar(payload);
    } catch (err: any) {
      setErroForm(err.message || 'Erro ao criar o documento.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const usuarioDestinoSelecionado = useMemo(() => {
    return users.find(u => u.id === usuarioDestinoId);
  }, [users, usuarioDestinoId]);

  return (
    <div className="w-full flex-1 flex flex-col bg-slate-50 font-sans overflow-hidden min-h-0">
      {/* 1. CABEÇALHO ELEGANTE SLIM COM PREVIEW E BANNER PREMIUM */}
      <header className="w-full bg-white border-b border-slate-200 shrink-0 z-20 shadow-2xs">
        <div className="w-full px-4 sm:px-6 py-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onVoltar}
              className="p-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-all active:scale-95 cursor-pointer"
              title="Voltar para a lista"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-black text-slate-900 leading-tight">
                  Nova Ficha de Tramitação Digital
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200/80 text-blue-700 text-[10px] font-extrabold">
                  <Sparkles className="w-2.5 h-2.5 text-blue-500" /> Abertura Oficial
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium leading-none mt-0.5">
                Emissão instantânea e direcionamento para análise interna
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1 bg-slate-100 rounded-lg border border-slate-200 text-xs font-mono font-bold text-slate-600">
              <FileCheck className="w-3.5 h-3.5 text-blue-600" />
              <span>PREVIEW DE PROTOCOLO</span>
            </div>
            <button
              type="button"
              onClick={onVoltar}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-bold transition-all"
            >
              Cancelar
            </button>
          </div>
        </div>
      </header>

      {/* 2. FORMULÁRIO EXECUTIVO TOTALMENTE REFORMULADO (100% VIEWPORT SEM SCROLL) */}
      <main className="w-full px-4 sm:px-6 py-3 flex-1 flex flex-col justify-between overflow-y-auto min-h-0">
        <form onSubmit={handleSubmit} className="w-full flex-1 flex flex-col justify-between max-w-6xl mx-auto bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
          
          {/* MENSAGEM DE ERRO FLUTUANTE */}
          {erroForm && (
            <div className="p-3 bg-rose-50 border-b border-rose-200 text-xs text-rose-800 flex items-center gap-2 font-semibold">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{erroForm}</span>
            </div>
          )}

          {/* CORPO DO FORMULÁRIO EM 2 COLUNAS HARMONIOSAS COM DIVISOR */}
          <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">

            {/* COLUNA ESQUERDA: 1. IDENTIFICAÇÃO DO DOCUMENTO (7 COLUNAS) */}
            <div className="lg:col-span-7 p-4 sm:p-5 flex flex-col justify-between gap-4">
              <div className="flex flex-col gap-3.5">
                {/* Cabeçalho da Seção 1 */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-200/80 flex items-center justify-center text-blue-600 shrink-0">
                      <Tag className="w-3.5 h-3.5" />
                    </div>
                    <h2 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                      1. Dados do Documento
                    </h2>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Passo 1 de 2</span>
                </div>

                {/* Campo 1: Seleção por Badges Táteis Rápidos de Tipo de Documento */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">
                      Tipo de Documento *
                    </label>
                    {!isAddingTipo && (
                      <button
                        type="button"
                        onClick={() => setIsAddingTipo(true)}
                        className="text-[11px] text-blue-600 font-extrabold hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        + Novo Tipo Customizado
                      </button>
                    )}
                  </div>

                  {isAddingTipo ? (
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <input
                        type="text"
                        value={novoTipoCustom}
                        onChange={e => setNovoTipoCustom(e.target.value)}
                        placeholder="Nome do novo tipo (ex: Memorando Circular)..."
                        className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                      />
                      <button
                        type="button"
                        onClick={handleCadastrarNovoTipo}
                        className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-all cursor-pointer"
                      >
                        Salvar
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsAddingTipo(false)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {tipos.map(t => {
                        const isSelected = tipoSelecionado === t;
                        return (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setTipoSelecionado(t)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                              isSelected
                                ? 'bg-blue-600 text-white shadow-xs scale-[1.02]'
                                : 'bg-slate-100/80 text-slate-700 hover:bg-slate-200/80 border border-slate-200/60'
                            }`}
                          >
                            {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                            <span>{t}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Campo 2: Título / Assunto Oficial */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">
                    Título / Assunto Oficial *
                  </label>
                  <input
                    type="text"
                    value={titulo}
                    onChange={e => setTitulo(e.target.value)}
                    placeholder="Ex: Projeto de Lei nº 12/2026 - Abertura de Crédito Adicional"
                    className="w-full px-3 py-2 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>

                {/* Campo 3: Anexo do Documento (Visual Ultra-Limpo) */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">
                    Anexo Digital Principal (Opcional)
                  </label>

                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                  />

                  {anexoInfo || anexoFile ? (
                    <div className="flex items-center justify-between p-2.5 bg-blue-50/80 border border-blue-200 rounded-xl">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">
                            {anexoInfo?.nome || anexoFile?.name}
                          </p>
                          <p className="text-[10px] text-slate-500 font-mono leading-none">
                            {anexoInfo?.tamanho ? `${(anexoInfo.tamanho / 1024).toFixed(1)} KB` : 'Pronto para anexar'}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={removerAnexo}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-white transition-colors"
                        title="Remover anexo"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="w-full py-3 px-3 border-2 border-dashed border-slate-200 hover:border-blue-500 rounded-xl flex items-center justify-center gap-2 text-slate-600 hover:text-blue-600 bg-slate-50/50 hover:bg-blue-50/20 transition-all cursor-pointer"
                    >
                      {isUploading ? (
                        <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                      ) : (
                        <>
                          <div className="w-6 h-6 rounded-md bg-white border border-slate-200 flex items-center justify-center text-slate-400">
                            <Upload className="w-3.5 h-3.5" />
                          </div>
                          <span className="text-xs font-bold text-slate-700">Clique para anexar o arquivo digital</span>
                          <span className="text-[10px] text-slate-400 font-normal">(PDF, DOCX, Imagens)</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Informação do Emissor (Rodapé da Coluna Esquerda) */}
              <div className="pt-2 border-t border-slate-100 flex items-center gap-2 text-[11px] text-slate-500">
                <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                <span>Emissor responsável: <strong className="text-slate-800 font-bold">{currentUser?.name || 'Servidor'}</strong> ({currentUser?.sector || 'Geral'})</span>
              </div>
            </div>

            {/* COLUNA DIREITA: 2. DESTINATÁRIO E TRAMITAÇÃO (5 COLUNAS) */}
            <div className="lg:col-span-5 p-4 sm:p-5 flex flex-col justify-between gap-4 bg-slate-50/40">
              <div className="flex flex-col gap-3.5">
                {/* Cabeçalho da Seção 2 */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-200/80 flex items-center justify-center text-indigo-600 shrink-0">
                      <Building2 className="w-3.5 h-3.5" />
                    </div>
                    <h2 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                      2. Destino & Direcionamento
                    </h2>
                  </div>
                  <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">Oficial</span>
                </div>

                {/* Campo: Setor de Destino */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">
                    Setor de Destino *
                  </label>
                  <select
                    value={setorDestino}
                    onChange={e => setSetorDestino(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  >
                    {setoresDisponiveis.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                {/* Campo: Servidor Responsável Habilitado */}
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">
                      Servidor Responsável *
                    </label>
                    <span className="text-[10px] font-semibold text-slate-400">Autorizados no Módulo</span>
                  </div>
                  <select
                    value={usuarioDestinoId}
                    onChange={e => setUsuarioDestinoId(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  >
                    <option value="">Selecione o servidor responsável...</option>
                    {usuariosHabilitados.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.name} {u.sector ? `(${u.sector})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Faixa Informativa dos Prazos Automáticos */}
                <div className="bg-white p-2.5 rounded-xl border border-slate-200/90 shadow-2xs flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-slate-700">
                    <Clock className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span className="font-extrabold text-[10px] uppercase">Prazos Oficiais:</span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px]">
                    <span className="text-slate-500">Geral: <strong className="text-slate-900 font-bold">10 dias</strong></span>
                    <span className="text-slate-500">Etapa: <strong className="text-indigo-700 font-bold">24 horas</strong></span>
                  </div>
                </div>

                {/* Campo: Despacho / Observações Iniciais */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">
                    Despacho / Observações Iniciais (Opcional)
                  </label>
                  <textarea
                    rows={2}
                    value={observacao}
                    onChange={e => setObservacao(e.target.value)}
                    placeholder="Instruções ou orientações para a análise inicial..."
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  />
                </div>
              </div>

              {/* RODAPÉ INTERNO DE AÇÃO DA TRAMITAÇÃO */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 px-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-800 text-white rounded-xl font-black text-xs shadow-md shadow-blue-500/25 flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Iniciando Tramitação Oficial...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Tramitar e Emitir Documento</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* BARRA INFERIOR DE RESUMO DA TRAMITAÇÃO */}
          <div className="bg-slate-100/90 px-4 py-2 border-t border-slate-200/80 flex items-center justify-between text-[11px] text-slate-600 shrink-0">
            <div className="flex items-center gap-2 truncate">
              <span className="font-bold text-slate-700">Fluxo:</span>
              <span className="truncate">{currentUser?.sector || 'Origem'}</span>
              <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
              <strong className="text-blue-700 font-bold truncate">{setorDestino || 'Selecione o setor'}</strong>
              {usuarioDestinoSelecionado && (
                <span className="text-slate-500 truncate">({usuarioDestinoSelecionado.name})</span>
              )}
            </div>

            <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 shrink-0">
              <ShieldCheck className="w-3 h-3 text-emerald-600" />
              <span>Assinatura Digital Ativa</span>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
};
