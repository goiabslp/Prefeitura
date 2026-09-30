import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft, Upload, FileText, CheckCircle2, AlertCircle, X,
  Building2, UserCheck, Plus, Loader2, Clock
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
  const [tipoSelecionado, setTipoSelecionado] = useState<string>('Projeto de Lei');
  const [novoTipoCustom, setNovoTipoCustom] = useState<string>('');
  const [isAddingTipo, setIsAddingTipo] = useState<boolean>(false);

  const [titulo, setTitulo] = useState<string>('');
  const [descricao, setDescricao] = useState<string>('');

  // Anexo
  const [anexoFile, setAnexoFile] = useState<File | null>(null);
  const [anexoInfo, setAnexoInfo] = useState<{ url: string; nome: string; tamanho: number } | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Encaminhamento (Setor + Usuário)
  const [setorDestino, setSetorDestino] = useState<string>('Jurídico');
  const [usuarioDestinoId, setUsuarioDestinoId] = useState<string>('');

  // Observação
  const [observacao, setObservacao] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [erroForm, setErroForm] = useState<string | null>(null);

  // Carregar tipos de documento do backend/service
  useEffect(() => {
    getTiposDocumento().then(t => {
      setTipos(t);
      if (t.length > 0 && !tipoSelecionado) {
        setTipoSelecionado(t[0]);
      }
    });
  }, []);

  // Setores padrão caso a lista do banco ainda esteja vazia
  const setoresDisponiveis = React.useMemo(() => {
    const list = sectors && sectors.length > 0
      ? sectors.map(s => s.name)
      : ['Jurídico', 'Contabilidade', 'Administração', 'Convênios', 'Licitação', 'Gabinete'];
    return Array.from(new Set(list));
  }, [sectors]);

  // Filtra SOMENTE usuários com acesso ao módulo Documentos ou admin
  const usuariosHabilitados = React.useMemo(() => {
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

  // Usuários filtrados pelo setor selecionado (se houver correspondência), ou todos os habilitados
  const usuariosDoSetor = React.useMemo(() => {
    if (!setorDestino) return usuariosHabilitados;
    const match = usuariosHabilitados.filter(u =>
      u.sector && u.sector.toLowerCase() === setorDestino.toLowerCase()
    );
    return match.length > 0 ? match : usuariosHabilitados;
  }, [usuariosHabilitados, setorDestino]);

  // Quando mudar o setor, define o primeiro usuário compatível se houver
  useEffect(() => {
    if (usuariosDoSetor.length > 0 && !usuarioDestinoId) {
      setUsuarioDestinoId(usuariosDoSetor[0].id);
    }
  }, [usuariosDoSetor, usuarioDestinoId]);

  // Upload do Anexo
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAnexoFile(file);
    setIsUploading(true);
    try {
      const uploaded = await uploadAnexoDocumento(file);
      setAnexoInfo(uploaded);
    } catch (err) {
      console.error('Falha no upload:', err);
    } finally {
      setIsUploading(false);
    }
  };

  const removerAnexo = () => {
    setAnexoFile(null);
    setAnexoInfo(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Cadastrar novo tipo de documento
  const handleCadastrarNovoTipo = async () => {
    if (!novoTipoCustom.trim()) return;
    const atualizados = await addTipoDocumento(novoTipoCustom.trim());
    setTipos(atualizados);
    setTipoSelecionado(novoTipoCustom.trim());
    setNovoTipoCustom('');
    setIsAddingTipo(false);
  };

  // Submissão do Formulário
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroForm(null);

    if (!titulo.trim()) {
      setErroForm('Por favor, informe o título ou assunto do documento.');
      return;
    }

    if (!setorDestino) {
      setErroForm('Por favor, selecione o setor de destino.');
      return;
    }

    const usuarioDestino = usuariosHabilitados.find(u => u.id === usuarioDestinoId);

    setIsSubmitting(true);
    try {
      await onSalvar({
        tipo_documento: tipoSelecionado,
        titulo: titulo.trim(),
        descricao: descricao.trim() || undefined,
        anexo_url: anexoInfo?.url,
        anexo_nome: anexoInfo?.nome,
        anexo_tamanho: anexoInfo?.tamanho,
        destino_setor: setorDestino,
        destino_usuario_id: usuarioDestino?.id,
        destino_usuario_nome: usuarioDestino?.name || 'A Definir',
        observacao_inicial: observacao.trim() || undefined,
        criado_por_id: currentUser?.id || 'admin',
        criado_por_nome: currentUser?.name || 'Administrador',
        origem_setor: currentUser?.sector || 'Gabinete'
      });
    } catch (err: any) {
      setErroForm(err.message || 'Erro ao criar o documento.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full flex-1 flex flex-col bg-slate-50 font-sans pb-16">
      {/* Topo Limpo 100% Viewport */}
      <header className="w-full bg-white border-b border-slate-200 sticky top-0 z-20 shadow-xs">
        <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onVoltar}
              className="p-2 -ml-2 rounded-xl text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors active:scale-95"
              title="Voltar para a lista"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg sm:text-xl font-black text-slate-900 leading-tight">
                Novo Documento
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Abertura de processo interno e encaminhamento oficial
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Formulário Widescreen 100% */}
      <main className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 py-6 flex-1">
        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-6">
          {erroForm && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs sm:text-sm text-rose-800 flex items-start gap-2.5 shadow-xs">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <span className="font-semibold">{erroForm}</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* COLUNA ESQUERDA: DADOS DO DOCUMENTO (7 COLUNAS) */}
            <div className="lg:col-span-7 flex flex-col gap-5">
              {/* 1. Tipo de Documento */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Tipo de Documento *
                  </label>
                  {!isAddingTipo && (
                    <button
                      type="button"
                      onClick={() => setIsAddingTipo(true)}
                      className="text-xs text-blue-600 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Cadastrar Novo Tipo
                    </button>
                  )}
                </div>

                {isAddingTipo ? (
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="text"
                      value={novoTipoCustom}
                      onChange={e => setNovoTipoCustom(e.target.value)}
                      placeholder="Nome do novo tipo (ex: Memorando Circular)..."
                      className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                    />
                    <button
                      type="button"
                      onClick={handleCadastrarNovoTipo}
                      className="px-4 py-2.5 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition-all cursor-pointer"
                    >
                      Salvar
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsAddingTipo(false)}
                      className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <select
                    value={tipoSelecionado}
                    onChange={e => setTipoSelecionado(e.target.value)}
                    className="w-full px-3.5 py-3 bg-slate-50 hover:bg-slate-100/60 focus:bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  >
                    {tipos.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* 2. Título / Assunto */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col gap-2.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Título / Assunto Oficial *
                </label>
                <input
                  type="text"
                  value={titulo}
                  onChange={e => setTitulo(e.target.value)}
                  placeholder="Ex: Projeto de Lei nº 12/2026 - Abertura de Crédito Adicional"
                  className="w-full px-3.5 py-3 bg-slate-50 hover:bg-slate-100/60 focus:bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
              </div>

              {/* 3. Anexo do Documento */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col gap-3">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Anexo Principal / Arquivo Digital (Opcional)
                </label>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                />

                {anexoInfo || anexoFile ? (
                  <div className="flex items-center justify-between p-4 bg-blue-50/70 border border-blue-200 rounded-2xl">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                          {anexoInfo?.nome || anexoFile?.name}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {anexoInfo?.tamanho ? `${(anexoInfo.tamanho / 1024).toFixed(1)} KB` : 'Pronto para tramitação'}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={removerAnexo}
                      className="p-2 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-white transition-colors"
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
                    className="w-full py-8 border-2 border-dashed border-slate-200 hover:border-blue-500 rounded-2xl flex flex-col items-center justify-center gap-2 text-slate-600 hover:text-blue-600 bg-slate-50/60 hover:bg-blue-50/20 transition-all cursor-pointer"
                  >
                    {isUploading ? (
                      <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                    ) : (
                      <>
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:text-blue-600">
                          <Upload className="w-5 h-5" />
                        </div>
                        <span className="text-xs font-bold text-slate-700">Clique para selecionar ou anexar o arquivo</span>
                        <span className="text-[10px] text-slate-400">PDF, DOCX, Imagens e Documentos</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* COLUNA DIREITA: TRAMITAÇÃO, PRAZOS & ENVIO (5 COLUNAS) */}
            <div className="lg:col-span-5 flex flex-col gap-5">
              {/* 4. Encaminhar para: Setor e Usuário */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col gap-3.5">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <Building2 className="w-4 h-4 text-blue-600" />
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Destinatário Inicial *
                  </label>
                </div>

                {/* Setor */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-slate-600">Setor de Destino</span>
                  <select
                    value={setorDestino}
                    onChange={e => setSetorDestino(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100/60 focus:bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 transition-all"
                  >
                    {setoresDisponiveis.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                {/* Usuário Habilitado */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-600">Servidor Responsável</span>
                    <span className="text-[10px] text-slate-400">Autorizados no módulo</span>
                  </div>
                  <select
                    value={usuarioDestinoId}
                    onChange={e => setUsuarioDestinoId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100/60 focus:bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 transition-all"
                  >
                    <option value="">Selecione um servidor responsável...</option>
                    {usuariosHabilitados.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.name} {u.sector ? `(${u.sector})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Card de Regra de Prazos Oficiais */}
              <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-slate-700">
                  <Clock className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-bold uppercase tracking-wider">Prazos Automáticos</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200/80">
                    <span className="text-[10px] text-slate-400 block font-semibold">Prazo Geral</span>
                    <strong className="text-slate-800 font-bold">10 dias corridos</strong>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200/80">
                    <span className="text-[10px] text-slate-400 block font-semibold">Prazo por Etapa</span>
                    <strong className="text-slate-800 font-bold">24 horas / etapa</strong>
                  </div>
                </div>
              </div>

              {/* 5. Observação Inicial */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col gap-2.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Despacho / Observações Iniciais (Opcional)
                </label>
                <textarea
                  rows={3}
                  value={observacao}
                  onChange={e => setObservacao(e.target.value)}
                  placeholder="Instruções ou apontamentos para o destinatário..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100/60 focus:bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
              </div>

              {/* Botão de Envio */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-4 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl font-black text-sm shadow-md shadow-blue-500/25 flex items-center justify-center gap-2.5 transition-all active:scale-[0.98] cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Iniciando Tramitação Oficial...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    <span>Criar e Encaminhar Documento</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
};

