import React, { useState, useEffect, useCallback } from 'react';
import { DocumentoFluxo, DocumentoMovimentacao, User, Sector } from '../../types';
import {
  getDocumentos,
  getDocumentoById,
  getDocumentoMovimentacoes,
  createDocumento,
  encaminharDocumento,
  concluirDocumento,
  CreateDocumentoPayload,
  EncaminharDocumentoPayload
} from '../../services/documentosService';
import { DocumentosListScreen } from './DocumentosListScreen';
import { NovoDocumentoScreen } from './NovoDocumentoScreen';
import { VisualizarDocumentoScreen } from './VisualizarDocumentoScreen';

interface DocumentosHubProps {
  currentUser: User | null;
  users?: User[];
  sectors?: Sector[];
  onNavigateHome?: () => void;
}

export const DocumentosHub: React.FC<DocumentosHubProps> = ({
  currentUser,
  users = [],
  sectors = [],
  onNavigateHome
}) => {
  // Estado de navegação interna derivado da URL
  // Rotas suportadas:
  // - /Documentos (listagem)
  // - /Documentos/Novo (criação)
  // - /Documentos/Visualizar/:id (detalhes e movimentação)
  const parseCurrentRoute = () => {
    if (typeof window === 'undefined') return { view: 'list', id: null };
    const rawPath = window.location.pathname;
    const path = rawPath.toLowerCase();
    if (path === '/documentos/novo') {
      return { view: 'novo', id: null };
    }
    const match = rawPath.match(/\/documentos\/visualizar\/([^/]+)/i);
    if (match && match[1]) {
      return { view: 'visualizar', id: match[1] };
    }
    return { view: 'list', id: null };
  };

  const [routeState, setRouteState] = useState(parseCurrentRoute());
  const [documentos, setDocumentos] = useState<DocumentoFluxo[]>([]);
  const [documentoAtivo, setDocumentoAtivo] = useState<DocumentoFluxo | null>(null);
  const [movimentacoes, setMovimentacoes] = useState<DocumentoMovimentacao[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Carrega lista de documentos
  const carregarDocumentos = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getDocumentos();
      setDocumentos(data);
    } catch (e) {
      console.error('Erro ao buscar documentos:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Carrega documento selecionado e suas movimentações
  const carregarDocumentoDetalhes = useCallback(async (id: string) => {
    setIsLoading(true);
    try {
      const [doc, movs] = await Promise.all([
        getDocumentoById(id),
        getDocumentoMovimentacoes(id)
      ]);
      setDocumentoAtivo(doc);
      setMovimentacoes(movs);
    } catch (e) {
      console.error('Erro ao carregar detalhes do documento:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Sincronização com a URL e histórico do navegador
  useEffect(() => {
    const handlePopState = () => {
      const parsed = parseCurrentRoute();
      setRouteState(parsed);
      if (parsed.view === 'visualizar' && parsed.id) {
        carregarDocumentoDetalhes(parsed.id);
      } else {
        setDocumentoAtivo(null);
        setMovimentacoes([]);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [carregarDocumentoDetalhes]);

  // Carga inicial
  useEffect(() => {
    carregarDocumentos();
    const parsed = parseCurrentRoute();
    if (parsed.view === 'visualizar' && parsed.id) {
      carregarDocumentoDetalhes(parsed.id);
    }
  }, [carregarDocumentos, carregarDocumentoDetalhes]);

  // Ações de navegação com pushState
  const navegarParaLista = () => {
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', '/Documentos');
    }
    setRouteState({ view: 'list', id: null });
    setDocumentoAtivo(null);
    carregarDocumentos();
  };

  const navegarParaNovo = () => {
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', '/Documentos/Novo');
    }
    setRouteState({ view: 'novo', id: null });
  };

  const navegarParaVisualizar = (id: string) => {
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', `/Documentos/Visualizar/${id}`);
    }
    setRouteState({ view: 'visualizar', id });
    carregarDocumentoDetalhes(id);
  };

  // Criação de novo documento
  const handleCriarDocumento = async (payload: CreateDocumentoPayload) => {
    setIsLoading(true);
    try {
      const novoDoc = await createDocumento(payload);
      setDocumentoAtivo(novoDoc);
      const movs = await getDocumentoMovimentacoes(novoDoc.id);
      setMovimentacoes(movs);
      if (typeof window !== 'undefined') {
        window.history.pushState({}, '', `/Documentos/Visualizar/${novoDoc.id}`);
      }
      setRouteState({ view: 'visualizar', id: novoDoc.id });
    } catch (e) {
      console.error('Erro ao criar documento:', e);
      throw e;
    } finally {
      setIsLoading(false);
    }
  };

  // Encaminhamento de documento
  const handleEncaminharDocumento = async (payload: EncaminharDocumentoPayload) => {
    const atualizado = await encaminharDocumento(payload);
    setDocumentoAtivo(atualizado);
    if (atualizado.id) {
      const novasMovs = await getDocumentoMovimentacoes(atualizado.id);
      setMovimentacoes(novasMovs);
    }
  };

  // Conclusão de documento
  const handleConcluirDocumento = async (faseConclusao: string, observacao: string) => {
    if (!documentoAtivo) return;
    const atualizado = await concluirDocumento(
      documentoAtivo.id,
      currentUser?.id || 'admin',
      currentUser?.name || 'Servidor',
      observacao,
      faseConclusao
    );
    setDocumentoAtivo(atualizado);
    if (atualizado.id) {
      const novasMovs = await getDocumentoMovimentacoes(atualizado.id);
      setMovimentacoes(novasMovs);
    }
  };

  return (
    <div className="w-full flex-1 h-full min-h-0 overflow-y-auto flex flex-col bg-slate-50">
      {routeState.view === 'novo' ? (
        <NovoDocumentoScreen
          currentUser={currentUser}
          users={users}
          sectors={sectors}
          onVoltar={navegarParaLista}
          onSalvar={handleCriarDocumento}
        />
      ) : routeState.view === 'visualizar' && routeState.id ? (
        <VisualizarDocumentoScreen
          documentoId={routeState.id}
          documento={documentoAtivo}
          movimentacoes={movimentacoes}
          currentUser={currentUser}
          users={users}
          sectors={sectors}
          onVoltar={navegarParaLista}
          onEncaminhar={handleEncaminharDocumento}
          onConcluir={handleConcluirDocumento}
          onRefresh={() => routeState.id && carregarDocumentoDetalhes(routeState.id)}
          isLoading={isLoading}
        />
      ) : (
        <DocumentosListScreen
          documentos={documentos}
          currentUser={currentUser}
          onNovoDocumento={navegarParaNovo}
          onVisualizarDocumento={navegarParaVisualizar}
          onRefresh={carregarDocumentos}
          isLoading={isLoading}
        />
      )}
    </div>
  );
};
