import { supabase } from './supabaseClient';
import {
  DocumentoFluxo,
  DocumentoMovimentacao,
  DocumentoPrazoInfo,
  DocumentoPrazoAlerta
} from '../types';
import { auditLogService } from './auditLogService';

const STORAGE_DOCS_KEY = 'sys_documentos_fluxo_cache';
const STORAGE_MOV_KEY = 'sys_documentos_movimentacoes_cache';
const STORAGE_TIPOS_KEY = 'sys_documentos_tipos_cache';
const STORAGE_SETORES_KEY = 'sys_documentos_setores_status_cache';

// Tipos padrão iniciais
export const DEFAULT_TIPOS_DOCUMENTO = [
  'Projeto de Lei',
  'Suplementação',
  'Requerimento',
  'Ofício',
  'Parecer',
  'Resposta',
  'Convênio',
  'Outros'
];

// Status padrão (representam onde o documento está atualmente)
export const DEFAULT_STATUS_LIST = [
  'Em Análise do Jurídico',
  'Em Análise da Contabilidade',
  'Em Análise da Administração',
  'Em Análise de Convênios',
  'Em Análise da Licitação'
];

// Fases padrão (representam a situação do documento)
export const DEFAULT_FASES_LIST = [
  'Protocolado na Câmara',
  'Resposta Judicial Concluída',
  'Parecer Concluído',
  'Aprovado',
  'Rejeitado',
  'Resposta Incompleta',
  'Documentos com Erro'
];

/**
 * Formata data e hora no padrão brasileiro com segundos: "30/09/2026 10:29:35"
 */
export function formatDataHoraComSegundos(dateInput?: string | Date | number): string {
  const d = dateInput ? new Date(dateInput) : new Date();
  if (isNaN(d.getTime())) return '';
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const ano = d.getFullYear();
  const hora = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const seg = String(d.getSeconds()).padStart(2, '0');
  return `${dia}/${mes}/${ano} ${hora}:${min}:${seg}`;
}

/**
 * Formata duração em milissegundos para texto legível
 * Ex: "7 dias, 04h 32min" ou "18h 42min"
 */
function formatarDuracaoLegivel(ms: number): string {
  const totalSegundos = Math.floor(Math.abs(ms) / 1000);
  const dias = Math.floor(totalSegundos / (3600 * 24));
  const horas = Math.floor((totalSegundos % (3600 * 24)) / 3600);
  const minutos = Math.floor((totalSegundos % 3600) / 60);

  const partes: string[] = [];
  if (dias > 0) {
    partes.push(`${dias} ${dias === 1 ? 'dia' : 'dias'}`);
  }
  const horaFormatada = String(horas).padStart(2, '0') + 'h';
  const minFormatado = String(minutos).padStart(2, '0') + 'min';
  partes.push(`${horaFormatada} ${minFormatado}`);

  return partes.join(', ');
}

/**
 * Calcula dinamicamente os prazos (Geral de 10 dias e Etapa de 1 dia com teto no geral)
 * baseado nos timestamps oficiais persistidos
 */
export function calcularPrazosDocumento(doc: DocumentoFluxo, agoraRef: Date = new Date()): DocumentoPrazoInfo {
  const agoraMs = agoraRef.getTime();
  const limiteGeralMs = new Date(doc.prazo_geral_limite).getTime();
  const limiteEtapaMs = new Date(doc.prazo_etapa_limite).getTime();

  const geralMsRestante = limiteGeralMs - agoraMs;
  const etapaMsRestante = limiteEtapaMs - agoraMs;

  const geralVencido = geralMsRestante <= 0;
  const etapaAtrasada = etapaMsRestante <= 0;

  let alerta: DocumentoPrazoAlerta = 'no_prazo';
  let alertaLabel = 'No prazo';

  if (doc.concluido) {
    alerta = 'no_prazo';
    alertaLabel = 'Concluído';
  } else if (geralVencido) {
    alerta = 'geral_vencido';
    alertaLabel = 'Prazo geral vencido';
  } else if (etapaAtrasada) {
    alerta = 'etapa_atrasada';
    alertaLabel = 'Etapa atrasada';
  } else if (geralMsRestante <= 48 * 3600 * 1000 || etapaMsRestante <= 4 * 3600 * 1000) {
    alerta = 'prazo_proximo';
    alertaLabel = 'Prazo próximo';
  } else {
    alerta = 'no_prazo';
    alertaLabel = 'No prazo';
  }

  // Textos para exibição
  let geralRestanteTexto = '';
  if (doc.concluido) {
    geralRestanteTexto = 'Finalizado';
  } else if (geralVencido) {
    geralRestanteTexto = `Vencido há ${formatarDuracaoLegivel(geralMsRestante)}`;
  } else {
    geralRestanteTexto = `Prazo restante: ${formatarDuracaoLegivel(geralMsRestante)}`;
  }

  let etapaRestanteTexto = '';
  if (doc.concluido) {
    etapaRestanteTexto = 'Finalizado';
  } else if (etapaAtrasada) {
    etapaRestanteTexto = `Atrasada há ${formatarDuracaoLegivel(etapaMsRestante)}`;
  } else {
    etapaRestanteTexto = `Prazo desta etapa: ${formatarDuracaoLegivel(etapaMsRestante)} restantes`;
  }

  return {
    alerta,
    alertaLabel,
    geralRestanteTexto,
    geralVencido,
    geralMilissegundosRestantes: geralMsRestante,
    etapaRestanteTexto,
    etapaAtrasada,
    etapaMilissegundosRestantes: etapaMsRestante
  };
}

// ==========================================
// FUNÇÕES DE FALLBACK LOCAL STORAGE
// ==========================================

function getLocalDocs(): DocumentoFluxo[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_DOCS_KEY);
    if (!raw) {
      const initialSeed = gerarSeedInicial();
      localStorage.setItem(STORAGE_DOCS_KEY, JSON.stringify(initialSeed.docs));
      localStorage.setItem(STORAGE_MOV_KEY, JSON.stringify(initialSeed.movs));
      return initialSeed.docs;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error('Erro ao ler cache de documentos:', e);
    return [];
  }
}

function saveLocalDocs(docs: DocumentoFluxo[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_DOCS_KEY, JSON.stringify(docs));
  } catch (e) {
    console.error('Erro ao salvar cache de documentos:', e);
  }
}

function getLocalMovs(): DocumentoMovimentacao[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_MOV_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Erro ao ler cache de movimentações:', e);
    return [];
  }
}

function saveLocalMovs(movs: DocumentoMovimentacao[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_MOV_KEY, JSON.stringify(movs));
  } catch (e) {
    console.error('Erro ao salvar cache de movimentações:', e);
  }
}

function gerarSeedInicial(): { docs: DocumentoFluxo[]; movs: DocumentoMovimentacao[] } {
  const agora = new Date();
  
  // Doc 1: Criado há 2 dias
  const doc1Criacao = new Date(agora.getTime() - 2 * 24 * 3600 * 1000);
  const doc1LimiteGeral = new Date(doc1Criacao.getTime() + 10 * 24 * 3600 * 1000);
  const doc1EtapaInicio = new Date(agora.getTime() - 6 * 3600 * 1000); // 6 horas atrás
  const doc1LimiteEtapa = new Date(Math.min(doc1EtapaInicio.getTime() + 24 * 3600 * 1000, doc1LimiteGeral.getTime()));

  const doc1: DocumentoFluxo = {
    id: 'doc-seed-001',
    numero_sequencial: 'DOC-2026/001',
    tipo_documento: 'Projeto de Lei',
    titulo: 'PL 014/2026 - Adequação do Plano Diretor Municipal',
    descricao: 'Encaminhamento para análise jurídica prévia referente aos gabaritos urbanísticos do centro.',
    setor_atual: 'Jurídico',
    responsavel_atual_id: 'user-juridico',
    responsavel_atual_nome: 'Dra. Camila Jurídico',
    status: 'Em Análise do Jurídico',
    fase: 'Protocolado na Câmara',
    data_criacao: doc1Criacao.toISOString(),
    prazo_geral_limite: doc1LimiteGeral.toISOString(),
    data_etapa_inicio: doc1EtapaInicio.toISOString(),
    prazo_etapa_limite: doc1LimiteEtapa.toISOString(),
    criado_por_id: 'user-admin',
    criado_por_nome: 'Administrador Geral',
    concluido: false,
    anexo_nome: 'PL_014_2026_Plano_Diretor.pdf',
    anexo_url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    created_at: doc1Criacao.toISOString(),
    updated_at: doc1EtapaInicio.toISOString()
  };

  const mov1_1: DocumentoMovimentacao = {
    id: 'mov-001-1',
    documento_id: 'doc-seed-001',
    origem_setor: 'Gabinete do Prefeito',
    origem_usuario_nome: 'João Gabinete',
    destino_setor: 'Jurídico',
    destino_usuario_nome: 'Dra. Camila Jurídico',
    responsavel_nome: 'Dra. Camila Jurídico',
    data_hora: formatDataHoraComSegundos(doc1Criacao),
    timestamp_iso: doc1Criacao.toISOString(),
    status: 'Em Análise do Jurídico',
    fase: 'Protocolado na Câmara',
    observacao: 'Documento criado e protocolado para verificação de constitucionalidade.',
    tipo_evento: 'criacao',
    criado_por_nome: 'Administrador Geral',
    created_at: doc1Criacao.toISOString()
  };

  return {
    docs: [doc1],
    movs: [mov1_1]
  };
}

// ==========================================
// SERVIÇOS PRINCIPAIS
// ==========================================

/**
 * Retorna todos os documentos
 */
export async function getDocumentos(): Promise<DocumentoFluxo[]> {
  try {
    const { data, error } = await supabase
      .from('documentos_fluxo')
      .select('*')
      .order('data_criacao', { ascending: false });

    if (!error && data && Array.isArray(data)) {
      saveLocalDocs(data);
      return data;
    }
  } catch (e) {
    console.warn('[documentosService] Supabase indisponível, usando cache local:', e);
  }

  return getLocalDocs();
}

/**
 * Retorna um documento por ID
 */
export async function getDocumentoById(id: string): Promise<DocumentoFluxo | null> {
  const localDocs = getLocalDocs();
  const localDoc = localDocs.find(d => d.id === id || d.id.toLowerCase() === id.toLowerCase());

  try {
    const { data, error } = await supabase
      .from('documentos_fluxo')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (!error && data) {
      return data;
    }
  } catch (e) {
    console.warn('[documentosService] Supabase getDocumentoById fallback:', e);
  }

  return localDoc || null;
}

/**
 * Retorna as movimentações/histórico de um documento (linha do tempo imutável)
 */
export async function getDocumentoMovimentacoes(documentoId: string): Promise<DocumentoMovimentacao[]> {
  const localMovs = getLocalMovs().filter(m => m.documento_id === documentoId || m.documento_id.toLowerCase() === documentoId.toLowerCase());

  try {
    const { data, error } = await supabase
      .from('documentos_movimentacoes')
      .select('*')
      .eq('documento_id', documentoId)
      .order('timestamp_iso', { ascending: true });

    if (!error && data && Array.isArray(data) && data.length > 0) {
      return data;
    }
  } catch (e) {
    console.warn('[documentosService] Supabase getDocumentoMovimentacoes fallback:', e);
  }

  return localMovs.sort((a, b) => new Date(a.timestamp_iso).getTime() - new Date(b.timestamp_iso).getTime());
}

/**
 * Cria um novo documento com prazos oficiais calculados
 */
export interface CreateDocumentoPayload {
  tipo_documento: string;
  titulo: string;
  descricao?: string;
  anexo_url?: string;
  anexo_nome?: string;
  anexo_tamanho?: number;
  destino_setor: string;
  destino_usuario_id?: string;
  destino_usuario_nome?: string;
  observacao_inicial?: string;
  criado_por_id: string;
  criado_por_nome: string;
  origem_setor?: string;
}

export async function createDocumento(payload: CreateDocumentoPayload): Promise<DocumentoFluxo> {
  const agora = new Date();
  const agoraIso = agora.toISOString();
  const dataHoraFormatada = formatDataHoraComSegundos(agora);

  // Prazo Geral de 10 dias
  const limiteGeral = new Date(agora.getTime() + 10 * 24 * 3600 * 1000);
  // Prazo da Etapa de 1 dia (24 horas)
  const limiteEtapa = new Date(Math.min(agora.getTime() + 24 * 3600 * 1000, limiteGeral.getTime()));

  // Gerar número sequencial legível (ex: DOC-2026/042)
  const ano = agora.getFullYear();
  const randomNum = Math.floor(100 + Math.random() * 900);
  const numeroSeq = `DOC-${ano}/${randomNum}`;

  // Status inicial padrão conforme o setor de destino
  const statusInicial = `Em Análise do ${payload.destino_setor}`;
  const faseInicial = 'Protocolado na Câmara';

  const novoDoc: DocumentoFluxo = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `doc-${Date.now()}`,
    numero_sequencial: numeroSeq,
    tipo_documento: payload.tipo_documento,
    titulo: payload.titulo,
    descricao: payload.descricao || '',
    anexo_url: payload.anexo_url,
    anexo_nome: payload.anexo_nome,
    anexo_tamanho: payload.anexo_tamanho,
    setor_atual: payload.destino_setor,
    responsavel_atual_id: payload.destino_usuario_id,
    responsavel_atual_nome: payload.destino_usuario_nome || 'A Definir',
    status: statusInicial,
    fase: faseInicial,
    data_criacao: agoraIso,
    prazo_geral_limite: limiteGeral.toISOString(),
    data_etapa_inicio: agoraIso,
    prazo_etapa_limite: limiteEtapa.toISOString(),
    criado_por_id: payload.criado_por_id,
    criado_por_nome: payload.criado_por_nome,
    concluido: false,
    created_at: agoraIso,
    updated_at: agoraIso
  };

  const primeiraMovimentacao: DocumentoMovimentacao = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `mov-${Date.now()}`,
    documento_id: novoDoc.id,
    origem_setor: payload.origem_setor || 'Gabinete / Origem',
    origem_usuario_id: payload.criado_por_id,
    origem_usuario_nome: payload.criado_por_nome,
    destino_setor: payload.destino_setor,
    destino_usuario_id: payload.destino_usuario_id,
    destino_usuario_nome: payload.destino_usuario_nome,
    responsavel_id: payload.destino_usuario_id,
    responsavel_nome: payload.destino_usuario_nome || 'A Definir',
    data_hora: dataHoraFormatada,
    timestamp_iso: agoraIso,
    status: statusInicial,
    fase: faseInicial,
    observacao: payload.observacao_inicial || 'Documento criado e encaminhado para análise inicial.',
    tipo_evento: 'criacao',
    anexo_url: payload.anexo_url,
    anexo_nome: payload.anexo_nome,
    criado_por_id: payload.criado_por_id,
    criado_por_nome: payload.criado_por_nome,
    created_at: agoraIso
  };

  // Tentar gravar no Supabase
  let gravouSupabase = false;
  try {
    const { data: docData, error: docError } = await supabase
      .from('documentos_fluxo')
      .insert([novoDoc])
      .select()
      .single();

    if (!docError && docData) {
      novoDoc.id = docData.id;
      primeiraMovimentacao.documento_id = docData.id;

      await supabase
        .from('documentos_movimentacoes')
        .insert([primeiraMovimentacao]);

      gravouSupabase = true;
    }
  } catch (e) {
    console.warn('[documentosService] Erro ao gravar novo documento no Supabase, usando fallback:', e);
  }

  // Atualizar cache local
  const docs = getLocalDocs();
  docs.unshift(novoDoc);
  saveLocalDocs(docs);

  const movs = getLocalMovs();
  movs.push(primeiraMovimentacao);
  saveLocalMovs(movs);

  // Auditoria oficial
  try {
    await auditLogService.logAction({
      action_type: 'CRIACAO_DOCUMENTO',
      module: 'documentos',
      description: `Documento ${novoDoc.numero_sequencial} (${novoDoc.tipo_documento}) criado por ${payload.criado_por_nome}`,
      details: {
        documento_id: novoDoc.id,
        numero: novoDoc.numero_sequencial,
        tipo: novoDoc.tipo_documento,
        titulo: novoDoc.titulo,
        destino_setor: payload.destino_setor,
        responsavel: payload.destino_usuario_nome,
        data_hora: dataHoraFormatada
      }
    });
  } catch (e) {}

  return novoDoc;
}

/**
 * Encaminha o documento para outro setor/usuário
 * Regra de Prazo: inicia 1 dia (24h) para a movimentação com teto no prazo geral de 10 dias!
 */
export interface EncaminharDocumentoPayload {
  documentoId: string;
  origem_setor: string;
  origem_usuario_id?: string;
  origem_usuario_nome: string;
  destino_setor: string;
  destino_usuario_id?: string;
  destino_usuario_nome: string;
  status: string;
  fase: string;
  observacao: string;
  anexo_url?: string;
  anexo_nome?: string;
}

export async function encaminharDocumento(payload: EncaminharDocumentoPayload): Promise<DocumentoFluxo> {
  const docAtual = await getDocumentoById(payload.documentoId);
  if (!docAtual) {
    throw new Error('Documento não encontrado');
  }

  const agora = new Date();
  const agoraIso = agora.toISOString();
  const dataHoraFormatada = formatDataHoraComSegundos(agora);

  // Prazo Geral NÃO reinicia!
  const limiteGeralMs = new Date(docAtual.prazo_geral_limite).getTime();

  // Prazo da nova movimentação: 1 dia (24h) limitado ao prazo geral!
  const prazo24hMs = agora.getTime() + 24 * 3600 * 1000;
  const novoLimiteEtapaMs = Math.min(prazo24hMs, limiteGeralMs);
  const novoLimiteEtapaIso = new Date(novoLimiteEtapaMs).toISOString();

  // Atualizar dados do documento
  const docAtualizado: DocumentoFluxo = {
    ...docAtual,
    setor_atual: payload.destino_setor,
    responsavel_atual_id: payload.destino_usuario_id,
    responsavel_atual_nome: payload.destino_usuario_nome,
    status: payload.status,
    fase: payload.fase,
    data_etapa_inicio: agoraIso,
    prazo_etapa_limite: novoLimiteEtapaIso,
    updated_at: agoraIso,
    anexo_url: payload.anexo_url || docAtual.anexo_url,
    anexo_nome: payload.anexo_nome || docAtual.anexo_nome
  };

  // Registrar movimentação obrigatória com segundos
  const novaMov: DocumentoMovimentacao = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `mov-${Date.now()}`,
    documento_id: docAtual.id,
    origem_setor: payload.origem_setor,
    origem_usuario_id: payload.origem_usuario_id,
    origem_usuario_nome: payload.origem_usuario_nome,
    destino_setor: payload.destino_setor,
    destino_usuario_id: payload.destino_usuario_id,
    destino_usuario_nome: payload.destino_usuario_nome,
    responsavel_id: payload.destino_usuario_id,
    responsavel_nome: payload.destino_usuario_nome,
    data_hora: dataHoraFormatada,
    timestamp_iso: agoraIso,
    status: payload.status,
    fase: payload.fase,
    observacao: payload.observacao,
    tipo_evento: 'encaminhamento',
    anexo_url: payload.anexo_url,
    anexo_nome: payload.anexo_nome,
    criado_por_id: payload.origem_usuario_id,
    criado_por_nome: payload.origem_usuario_nome,
    created_at: agoraIso
  };

  // Salvar no Supabase
  try {
    await supabase
      .from('documentos_fluxo')
      .update({
        setor_atual: docAtualizado.setor_atual,
        responsavel_atual_id: docAtualizado.responsavel_atual_id,
        responsavel_atual_nome: docAtualizado.responsavel_atual_nome,
        status: docAtualizado.status,
        fase: docAtualizado.fase,
        data_etapa_inicio: docAtualizado.data_etapa_inicio,
        prazo_etapa_limite: docAtualizado.prazo_etapa_limite,
        anexo_url: docAtualizado.anexo_url,
        anexo_nome: docAtualizado.anexo_nome,
        updated_at: docAtualizado.updated_at
      })
      .eq('id', docAtual.id);

    await supabase
      .from('documentos_movimentacoes')
      .insert([novaMov]);
  } catch (e) {
    console.warn('[documentosService] Falha Supabase em encaminhar, usando cache:', e);
  }

  // Atualizar cache local
  const docs = getLocalDocs();
  const idx = docs.findIndex(d => d.id === docAtual.id);
  if (idx >= 0) {
    docs[idx] = docAtualizado;
  } else {
    docs.unshift(docAtualizado);
  }
  saveLocalDocs(docs);

  const movs = getLocalMovs();
  movs.push(novaMov);
  saveLocalMovs(movs);

  // Auditoria
  try {
    await auditLogService.logAction({
      action_type: 'ENCAMINHAMENTO_DOCUMENTO',
      module: 'documentos',
      description: `Documento ${docAtual.numero_sequencial} encaminhado: ${payload.origem_setor} (${payload.origem_usuario_nome}) → ${payload.destino_setor} (${payload.destino_usuario_nome})`,
      details: {
        documento_id: docAtual.id,
        origem: `${payload.origem_setor} - ${payload.origem_usuario_nome}`,
        destino: `${payload.destino_setor} - ${payload.destino_usuario_nome}`,
        status: payload.status,
        fase: payload.fase,
        observacao: payload.observacao,
        data_hora: dataHoraFormatada
      }
    });
  } catch (e) {}

  return docAtualizado;
}

/**
 * Conclui um documento marcando como concluído e registrando no histórico
 */
export async function concluirDocumento(
  documentoId: string,
  usuarioId: string,
  usuarioNome: string,
  observacao: string,
  faseConclusao: string = 'Aprovado'
): Promise<DocumentoFluxo> {
  const docAtual = await getDocumentoById(documentoId);
  if (!docAtual) throw new Error('Documento não encontrado');

  const agora = new Date();
  const agoraIso = agora.toISOString();
  const dataHoraFormatada = formatDataHoraComSegundos(agora);

  const docAtualizado: DocumentoFluxo = {
    ...docAtual,
    concluido: true,
    concluido_em: agoraIso,
    fase: faseConclusao,
    status: `Concluído (${docAtual.setor_atual})`,
    updated_at: agoraIso
  };

  const movConclusao: DocumentoMovimentacao = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `mov-${Date.now()}`,
    documento_id: docAtual.id,
    origem_setor: docAtual.setor_atual,
    origem_usuario_id: usuarioId,
    origem_usuario_nome: usuarioNome,
    destino_setor: docAtual.setor_atual,
    destino_usuario_id: usuarioId,
    destino_usuario_nome: usuarioNome,
    responsavel_id: usuarioId,
    responsavel_nome: usuarioNome,
    data_hora: dataHoraFormatada,
    timestamp_iso: agoraIso,
    status: docAtualizado.status,
    fase: faseConclusao,
    observacao: observacao || 'Processo do documento concluído com sucesso.',
    tipo_evento: 'conclusao',
    criado_por_id: usuarioId,
    criado_por_nome: usuarioNome,
    created_at: agoraIso
  };

  try {
    await supabase
      .from('documentos_fluxo')
      .update({
        concluido: true,
        concluido_em: agoraIso,
        fase: faseConclusao,
        status: docAtualizado.status,
        updated_at: agoraIso
      })
      .eq('id', docAtual.id);

    await supabase
      .from('documentos_movimentacoes')
      .insert([movConclusao]);
  } catch (e) {
    console.warn('[documentosService] Erro ao concluir documento no Supabase:', e);
  }

  const docs = getLocalDocs();
  const idx = docs.findIndex(d => d.id === docAtual.id);
  if (idx >= 0) docs[idx] = docAtualizado;
  saveLocalDocs(docs);

  const movs = getLocalMovs();
  movs.push(movConclusao);
  saveLocalMovs(movs);

  try {
    await auditLogService.logAction({
      action_type: 'CONCLUSAO_DOCUMENTO',
      module: 'documentos',
      description: `Documento ${docAtual.numero_sequencial} concluído por ${usuarioNome}`,
      details: {
        documento_id: docAtual.id,
        fase: faseConclusao,
        observacao,
        data_hora: dataHoraFormatada
      }
    });
  } catch (e) {}

  return docAtualizado;
}

/**
 * Gestão de Tipos de Documento
 */
export async function getTiposDocumento(): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('documentos_tipos')
      .select('nome')
      .eq('ativo', true)
      .order('nome');

    if (!error && data && data.length > 0) {
      const nomes = data.map(d => d.nome);
      return Array.from(new Set([...DEFAULT_TIPOS_DOCUMENTO, ...nomes]));
    }
  } catch (e) {}

  if (typeof window !== 'undefined') {
    try {
      const local = localStorage.getItem(STORAGE_TIPOS_KEY);
      if (local) {
        const parsed = JSON.parse(local);
        return Array.from(new Set([...DEFAULT_TIPOS_DOCUMENTO, ...parsed]));
      }
    } catch (e) {}
  }

  return DEFAULT_TIPOS_DOCUMENTO;
}

export async function addTipoDocumento(novoTipo: string): Promise<string[]> {
  const tipoTrim = novoTipo.trim();
  if (!tipoTrim) return getTiposDocumento();

  try {
    await supabase
      .from('documentos_tipos')
      .insert([{ nome: tipoTrim, ativo: true }]);
  } catch (e) {}

  const atuais = await getTiposDocumento();
  const atualizados = Array.from(new Set([...atuais, tipoTrim]));
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_TIPOS_KEY, JSON.stringify(atualizados));
  }
  return atualizados;
}

/**
 * Gestão de Setores / Status
 */
export async function getStatusDisponiveis(): Promise<string[]> {
  if (typeof window !== 'undefined') {
    try {
      const local = localStorage.getItem(STORAGE_SETORES_KEY);
      if (local) {
        const parsed = JSON.parse(local);
        return Array.from(new Set([...DEFAULT_STATUS_LIST, ...parsed]));
      }
    } catch (e) {}
  }
  return DEFAULT_STATUS_LIST;
}

export async function addStatusSetor(novoStatus: string): Promise<string[]> {
  const statusTrim = novoStatus.trim();
  if (!statusTrim) return getStatusDisponiveis();

  const atuais = await getStatusDisponiveis();
  const atualizados = Array.from(new Set([...atuais, statusTrim]));
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_SETORES_KEY, JSON.stringify(atualizados));
  }
  return atualizados;
}

/**
 * Upload de Anexo com fallback para Base64 / LocalStorage
 */
export async function uploadAnexoDocumento(file: File): Promise<{ url: string; nome: string; tamanho: number }> {
  try {
    const fileExt = file.name.split('.').pop();
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9_.-]/g, '_');
    const path = `documentos/${Date.now()}_${cleanFileName}`;

    const { data, error } = await supabase.storage
      .from('documentos')
      .upload(path, file, { cacheControl: '3600', upsert: true });

    if (!error && data) {
      const { data: publicUrlData } = supabase.storage
        .from('documentos')
        .getPublicUrl(data.path);

      return {
        url: publicUrlData.publicUrl,
        nome: file.name,
        tamanho: file.size
      };
    }
  } catch (e) {
    console.warn('[documentosService] Upload no Supabase storage falhou, gerando URL em memória/base64:', e);
  }

  // Fallback para URL de Objeto ou Base64 para visualização imediata
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve({
        url: reader.result as string,
        nome: file.name,
        tamanho: file.size
      });
    };
    reader.readAsDataURL(file);
  });
}
