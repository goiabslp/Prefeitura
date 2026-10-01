import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ArrowLeft, Upload, FileText, CheckCircle2, AlertCircle, X,
  Building2, UserCheck, Plus, Loader2, Send, Paperclip
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
  const [descricao, setDescricao] = useState<string>('');
  const [observacao, setObservacao] = useState<string>('');

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

  // Lista de usuários habilitados do sistema
  const usuariosDisponiveis = useMemo(() => {
    if (users && users.length > 0) return users;
    return [];
  }, [users]);

  // Seleciona primeiro usuário do setor por padrão
  useEffect(() => {
    if (usuariosDisponiveis.length > 0 && !usuarioDestinoId) {
      setUsuarioDestinoId(usuariosDisponiveis[0].id);
    }
  }, [usuariosDisponiveis, usuarioDestinoId]);

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
    if (!usuarioDestinoId) {
      setErroForm('Selecione o destinatário (servidor do sistema).');
      return;
    }

    const usuarioDestino = users.find(u => u.id === usuarioDestinoId);
    const setorDestinoDerivado = usuarioDestino?.sector || 'Gabinete';

    setIsSubmitting(true);
    try {
      const payload: CreateDocumentoPayload = {
        tipo_documento: tipoSelecionado,
        titulo: titulo.trim(),
        descricao: descricao.trim() || undefined,
        criado_por_id: currentUser?.id || 'admin',
        criado_por_nome: currentUser?.name || 'Servidor',
        destino_setor: setorDestinoDerivado,
        destino_usuario_id: usuarioDestinoId,
        destino_usuario_nome: usuarioDestino?.name || 'Servidor Responsável',
        observacao_inicial: observacao.trim() || undefined,
        anexo_url: anexoInfo?.url,
        anexo_nome: anexoInfo?.nome,
        anexo_tamanho: anexoInfo?.tamanho
      };

      await onSalvar(payload);
    } catch (err: any) {
      console.error('Erro na criação:', err);
      setErroForm(err.message || 'Erro ao criar o documento.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full flex-1 flex flex-col bg-slate-50 font-sans min-h-0 overflow-y-auto">
      {/* Topo Limpo */}
      <div className="bg-white border-b border-slate-200/80 px-4 md:px-6 py-4 flex items-center justify-between shrink-0 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={onVoltar}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all"
            title="Voltar para a Lista"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-slate-900 leading-tight">Novo Documento Interno</h1>
            <p className="text-xs text-slate-500">Crie, anexe arquivos e encaminhe para servidores do sistema</p>
          </div>
        </div>

        <button
          onClick={onVoltar}
          className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all"
        >
          Cancelar
        </button>
      </div>

      {/* Formulário Limpo */}
      <form onSubmit={handleSubmit} className="flex-1 p-4 md:p-6 max-w-3xl mx-auto w-full space-y-5">
        {erroForm && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{erroForm}</span>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 md:p-6 space-y-4">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">
            1. Dados do Documento
          </h2>

          {/* Tipo de Documento */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Tipo de Documento <span className="text-rose-500">*</span>
            </label>
            <div className="flex items-center gap-2">
              <select
                value={tipoSelecionado}
                onChange={(e) => setTipoSelecionado(e.target.value)}
                className="flex-1 px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white transition-all cursor-pointer"
              >
                {tipos.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>

              {!isAddingTipo ? (
                <button
                  type="button"
                  onClick={() => setIsAddingTipo(true)}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all shrink-0 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Outro Tipo
                </button>
              ) : (
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={novoTipoCustom}
                    onChange={(e) => setNovoTipoCustom(e.target.value)}
                    placeholder="Novo tipo..."
                    className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium w-36 focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={handleCadastrarNovoTipo}
                    className="p-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700"
                  >
                    OK
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddingTipo(false)}
                    className="p-2 bg-slate-200 text-slate-600 rounded-xl text-xs font-bold"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Título / Assunto */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Título / Assunto <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Requerimento de Suplementação Orçamentária para a Saúde"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
            />
          </div>

          {/* Descrição / Conteúdo */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Descrição / Detalhes
            </label>
            <textarea
              rows={3}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descreva brevemente a finalidade e os detalhes do documento..."
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-all resize-none"
            />
          </div>

          {/* Anexo de Arquivo */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Anexo (PDF ou Documento)
            </label>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
              className="hidden"
            />

            {!anexoInfo ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-200 hover:border-blue-400 bg-slate-50/50 hover:bg-blue-50/30 rounded-2xl p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-1.5"
              >
                {isUploading ? (
                  <div className="flex items-center gap-2 text-xs font-semibold text-blue-600">
                    <Loader2 className="w-4 h-4 animate-spin" /> Fazendo upload do anexo...
                  </div>
                ) : (
                  <>
                    <Upload className="w-5 h-5 text-slate-400" />
                    <span className="text-xs font-semibold text-slate-700">Clique para selecionar um arquivo</span>
                    <span className="text-[10px] text-slate-400">PDF, Word ou Imagem (máx 15MB)</span>
                  </>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs">
                <div className="flex items-center gap-2 truncate">
                  <Paperclip className="w-4 h-4 text-blue-600 shrink-0" />
                  <span className="font-semibold text-blue-900 truncate">{anexoInfo.nome}</span>
                </div>
                <button
                  type="button"
                  onClick={removerAnexo}
                  className="p-1 text-slate-400 hover:text-rose-600 rounded-lg transition-colors shrink-0"
                  title="Remover anexo"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Destinatário e Encaminhamento */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 md:p-6 space-y-4">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">
            2. Destinatário & Encaminhamento
          </h2>

          {/* Servidor / Usuário do Sistema */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Destinatário (Servidor do Sistema) <span className="text-rose-500">*</span>
            </label>
            <select
              value={usuarioDestinoId}
              onChange={(e) => setUsuarioDestinoId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white transition-all cursor-pointer"
            >
              <option value="">Selecione o servidor de destino...</option>
              {usuariosDisponiveis.map(u => (
                <option key={u.id} value={u.id}>
                  {u.name} {u.sector ? `— Setor: ${u.sector}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Despacho / Observação Inicial */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Despacho Inicial / Observação
            </label>
            <textarea
              rows={2}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Instrução ou despacho inicial para o servidor destinatário..."
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-all resize-none"
            />
          </div>
        </div>

        {/* Botão de Envio */}
        <div className="flex justify-end gap-3 pt-2 pb-8">
          <button
            type="button"
            onClick={onVoltar}
            className="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-100 transition-all"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting || isUploading}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Criando...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" /> Criar e Encaminhar Documento
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
