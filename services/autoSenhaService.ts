import { supabase } from './supabaseClient';
import {
  getActivePermissionUser,
  getActiveGlobalModuleSettings,
  userCanAccessSubmodule,
  isSuperAdminUser
} from './permissionService';
import {
  AutoSenhaUnidadeId,
  AutoSenhaPrioridadeTipo,
  AutoSenhaPrioridadeCategoria,
  AutoSenhaStatus,
  AutoSenhaRegraAlternancia,
  AutoSenhaSituacaoOperacional,
  AutoSenhaUnidade,
  AutoSenhaConfiguracao,
  AutoSenhaItem,
  AutoSenhaChamadaHistorico,
  AutoSenhaAuditoria,
  AutoSenhaAvaliacaoUrgente,
  AutoSenhaCapacidadeMetricas
} from '../types';

// Chaves locais para cache/fallback de alta resiliência
const STORAGE_PREFIX = 'sys_autosenha_';
const STORAGE_SENHAS_KEY = `${STORAGE_PREFIX}senhas`;
const STORAGE_CONFIG_KEY = `${STORAGE_PREFIX}configs`;
const STORAGE_AUDIT_KEY = `${STORAGE_PREFIX}audit`;
const STORAGE_URGENTES_KEY = `${STORAGE_PREFIX}urgentes`;

// Unidades oficiais do município
export const AUTOSENHA_UNIDADES: AutoSenhaUnidade[] = [
  {
    id: 'psf1',
    nome: 'PSF 1 — Dr. José Maria de Carvalho',
    sigla: 'PSF 1',
    tipo: 'PSF',
    ativo: true,
    horario_inicio: '07:00:00',
    horario_fim: '17:00:00'
  },
  {
    id: 'psf2',
    nome: 'PSF 2 — Maria das Graças Silva',
    sigla: 'PSF 2',
    tipo: 'PSF',
    ativo: true,
    horario_inicio: '07:00:00',
    horario_fim: '17:00:00'
  },
  {
    id: 'upa',
    nome: 'UPA — Unidade de Pronto Atendimento',
    sigla: 'UPA',
    tipo: 'UPA',
    ativo: true,
    horario_inicio: '00:00:00',
    horario_fim: '23:59:59'
  }
];

// Configurações padrão por unidade
const DEFAULT_CONFIGS: Record<AutoSenhaUnidadeId, AutoSenhaConfiguracao> = {
  psf1: {
    id: 'cfg-psf1',
    unidade_id: 'psf1',
    regra_alternancia: '2_P_1_N',
    proporcao_prioridade: 2,
    proporcao_normal: 1,
    contador_prioridade_atual: 0,
    contador_normal_atual: 0,
    limite_espera_atencao_min: 30,
    limite_espera_critico_min: 60,
    limite_fila_atencao_qtd: 10,
    limite_fila_critico_qtd: 20,
    som_habilitado: true,
    ocultar_sobrenome_tv: false,
    mensagem_rodape_tv: 'Prefeitura de São José do Goiabal — Cuidando da nossa gente'
  },
  psf2: {
    id: 'cfg-psf2',
    unidade_id: 'psf2',
    regra_alternancia: '2_P_1_N',
    proporcao_prioridade: 2,
    proporcao_normal: 1,
    contador_prioridade_atual: 0,
    contador_normal_atual: 0,
    limite_espera_atencao_min: 30,
    limite_espera_critico_min: 60,
    limite_fila_atencao_qtd: 10,
    limite_fila_critico_qtd: 20,
    som_habilitado: true,
    ocultar_sobrenome_tv: false,
    mensagem_rodape_tv: 'Prefeitura de São José do Goiabal — Cuidando da nossa gente'
  },
  upa: {
    id: 'cfg-upa',
    unidade_id: 'upa',
    regra_alternancia: '2_P_1_N',
    proporcao_prioridade: 2,
    proporcao_normal: 1,
    contador_prioridade_atual: 0,
    contador_normal_atual: 0,
    limite_espera_atencao_min: 20,
    limite_espera_critico_min: 45,
    limite_fila_atencao_qtd: 15,
    limite_fila_critico_qtd: 30,
    som_habilitado: true,
    ocultar_sobrenome_tv: false,
    mensagem_rodape_tv: 'UPA São José do Goiabal — Senhas da Recepção Administrativa'
  }
};

/**
 * Retorna a data operacional atual no formato YYYY-MM-DD (fuso horário America/Sao_Paulo)
 */
export function getDataOperacionalHoje(): string {
  try {
    const formatter = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const parts = formatter.formatToParts(new Date());
    const ano = parts.find(p => p.type === 'year')?.value || '2026';
    const mes = parts.find(p => p.type === 'month')?.value || '01';
    const dia = parts.find(p => p.type === 'day')?.value || '01';
    return `${ano}-${mes}-${dia}`;
  } catch (e) {
    const d = new Date();
    return d.toISOString().split('T')[0];
  }
}

/**
 * Formata duração legível (ex: "12m 30s", "1h 15m")
 */
export function formatarDuracaoSegundos(segundosTotais: number): string {
  if (isNaN(segundosTotais) || segundosTotais < 0) return '0s';
  const h = Math.floor(segundosTotais / 3600);
  const m = Math.floor((segundosTotais % 3600) / 60);
  const s = Math.floor(segundosTotais % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/**
 * Normaliza exibição do nome do cidadão para a TV
 */
export function formatarNomeParaTV(nomeCompleto: string, ocultarSobrenome: boolean): string {
  if (!nomeCompleto) return '';
  const partes = nomeCompleto.trim().split(/\s+/);
  if (!ocultarSobrenome || partes.length <= 1) return nomeCompleto;
  const primeiro = partes[0];
  const segundo = partes[1]?.charAt(0) ? `${partes[1].charAt(0)}.` : '';
  return `${primeiro} ${segundo}`.trim();
}

// ----------------------------------------------------------------------
// PERSISTÊNCIA LOCAL (FALLBACK E CACHE)
// ----------------------------------------------------------------------
function getLocalSenhas(): AutoSenhaItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_SENHAS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalSenhas(senhas: AutoSenhaItem[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_SENHAS_KEY, JSON.stringify(senhas));
  } catch (e) {
    console.error('[AutoSenha] Erro ao salvar senhas no localStorage:', e);
  }
}

function getLocalConfig(unidadeId: AutoSenhaUnidadeId): AutoSenhaConfiguracao {
  if (typeof window === 'undefined') return DEFAULT_CONFIGS[unidadeId];
  try {
    const raw = localStorage.getItem(`${STORAGE_CONFIG_KEY}_${unidadeId}`);
    return raw ? { ...DEFAULT_CONFIGS[unidadeId], ...JSON.parse(raw) } : DEFAULT_CONFIGS[unidadeId];
  } catch {
    return DEFAULT_CONFIGS[unidadeId];
  }
}

function saveLocalConfig(config: AutoSenhaConfiguracao) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`${STORAGE_CONFIG_KEY}_${config.unidade_id}`, JSON.stringify(config));
  } catch (e) {
    console.error('[AutoSenha] Erro ao salvar config no localStorage:', e);
  }
}

function getLocalAudit(): AutoSenhaAuditoria[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_AUDIT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalAudit(audit: AutoSenhaAuditoria) {
  if (typeof window === 'undefined') return;
  try {
    const list = getLocalAudit();
    list.unshift(audit);
    if (list.length > 500) list.length = 500;
    localStorage.setItem(STORAGE_AUDIT_KEY, JSON.stringify(list));
  } catch (e) {
    console.error('[AutoSenha] Erro ao salvar auditoria:', e);
  }
}

function getLocalUrgentes(): AutoSenhaAvaliacaoUrgente[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_URGENTES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalUrgentes(urgentes: AutoSenhaAvaliacaoUrgente[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_URGENTES_KEY, JSON.stringify(urgentes));
  } catch (e) {
    console.error('[AutoSenha] Erro ao salvar avaliacoes urgentes:', e);
  }
}

// ----------------------------------------------------------------------
// AUDITORIA OFICIAL
// ----------------------------------------------------------------------
export async function registrarAuditoria(
  unidadeId: AutoSenhaUnidadeId,
  acao: string,
  descricao: string,
  detalhes: any = {},
  usuarioNome = 'Sistema',
  usuarioId?: string,
  senhaId?: string,
  senhaNumero?: string
): Promise<void> {
  const item: AutoSenhaAuditoria = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `aud-${Date.now()}`,
    unidade_id: unidadeId,
    senha_id: senhaId,
    senha_numero: senhaNumero,
    acao,
    descricao,
    detalhes,
    usuario_id: usuarioId,
    usuario_nome: usuarioNome,
    created_at: new Date().toISOString()
  };

  saveLocalAudit(item);

  try {
    await supabase.from('autosenha_auditoria').insert([item]);
  } catch (e) {
    // Silêncio se tabela ainda não tiver sido criada no Supabase
  }
}

// ----------------------------------------------------------------------
// REALTIME BROADCAST HELPER
// ----------------------------------------------------------------------
export function notificarRealtimeMudanca(unidadeId: AutoSenhaUnidadeId, evento: string, dados: any) {
  try {
    const channelName = `autosenha-${unidadeId}`;
    const channel = supabase.channel(channelName);
    channel.send({
      type: 'broadcast',
      event: evento,
      payload: { unidadeId, timestamp: Date.now(), ...dados }
    }).catch(() => {});

    // Canal geral para o Dashboard consolidado
    const globalChannel = supabase.channel('autosenha-global');
    globalChannel.send({
      type: 'broadcast',
      event: 'atualizacao_geral',
      payload: { unidadeId, evento, timestamp: Date.now() }
    }).catch(() => {});
  } catch (e) {
    console.warn('[AutoSenha] Realtime broadcast notice falhou:', e);
  }
}

// ----------------------------------------------------------------------
// CONTROLE DE ACESSO E ISOLAMENTO POR UNIDADE (AUTOSENHA)
// ----------------------------------------------------------------------
const UNIDADE_PERMISSAO_KEYS: Record<AutoSenhaUnidadeId, { controle: string; tv: string }> = {
  psf1: { controle: 'sub_autosenha_psf1_controle', tv: 'sub_autosenha_psf1_senhatv' },
  psf2: { controle: 'sub_autosenha_psf2_controle', tv: 'sub_autosenha_psf2_senhatv' },
  upa: { controle: 'sub_autosenha_upa_controle', tv: 'sub_autosenha_upa_senhatv' }
};

export function assertCanAccessAutoSenhaUnidade(
  unidadeId: AutoSenhaUnidadeId,
  mode: 'operacional' | 'historico' | 'tv' = 'operacional'
): void {
  const activeUser = getActivePermissionUser();
  if (!activeUser) return; // Contexto isolado/kiosk TV sem sessão ativa ligada

  if (isSuperAdminUser(activeUser)) return;

  const globalSettings = getActiveGlobalModuleSettings();
  const keys = UNIDADE_PERMISSAO_KEYS[unidadeId];
  if (!keys) {
    throw new Error('Unidade do AutoSenha inválida.');
  }

  const canControle = userCanAccessSubmodule(activeUser, 'parent_autosenha', keys.controle, globalSettings);
  const canDashboard = userCanAccessSubmodule(activeUser, 'parent_autosenha', 'sub_autosenha_dashboard', globalSettings);

  if (mode === 'tv') {
    const canTv = userCanAccessSubmodule(activeUser, 'parent_autosenha', keys.tv, globalSettings);
    if (canControle || canTv || canDashboard) return;
  } else {
    if (canControle || canDashboard) return;
  }

  throw new Error(`Acesso negado: você não possui permissão para operar a unidade ${unidadeId.toUpperCase()}.`);
}

function subtrairDiasDataOperacional(dataIso: string, dias: number): string {
  const [y, m, d] = dataIso.split('-').map(Number);
  const dt = new Date(Date.UTC(y || 2026, (m || 1) - 1, d || 1));
  dt.setUTCDate(dt.getUTCDate() - dias);
  return dt.toISOString().slice(0, 10);
}

// ----------------------------------------------------------------------
// CONFIGURAÇÕES DE UNIDADE
// ----------------------------------------------------------------------
export async function getConfiguracao(unidadeId: AutoSenhaUnidadeId): Promise<AutoSenhaConfiguracao> {
  try {
    const { data, error } = await supabase
      .from('autosenha_configuracoes')
      .select('*')
      .eq('unidade_id', unidadeId)
      .maybeSingle();

    if (!error && data) {
      saveLocalConfig(data);
      return data;
    }
  } catch (e) {
    // fallback
  }
  return getLocalConfig(unidadeId);
}

export async function salvarConfiguracao(
  config: AutoSenhaConfiguracao,
  usuarioNome: string,
  usuarioId?: string
): Promise<AutoSenhaConfiguracao> {
  assertCanAccessAutoSenhaUnidade(config.unidade_id, 'operacional');
  config.updated_at = new Date().toISOString();
  saveLocalConfig(config);

  try {
    const { data, error } = await supabase
      .from('autosenha_configuracoes')
      .upsert(config, { onConflict: 'unidade_id' })
      .select()
      .single();

    if (!error && data) {
      config = data;
    }
  } catch (e) {
    console.warn('[AutoSenha] Erro ao salvar config no Supabase:', e);
  }

  await registrarAuditoria(
    config.unidade_id,
    'CONFIG_ALTERADA',
    `Configurações da unidade alteradas por ${usuarioNome}`,
    config,
    usuarioNome,
    usuarioId
  );

  notificarRealtimeMudanca(config.unidade_id, 'config_alterada', { config });
  return config;
}

// ----------------------------------------------------------------------
// GERAÇÃO E CADASTRO DE SENHAS
// ----------------------------------------------------------------------
export interface GerarSenhaPayload {
  unidade_id: AutoSenhaUnidadeId;
  paciente_id?: string;
  paciente_cpf?: string;
  paciente_cartao_sus?: string;
  cidadao_nome: string;
  prioridade_tipo: AutoSenhaPrioridadeTipo;
  prioridade_categoria?: AutoSenhaPrioridadeCategoria | string;
  guiche?: string;
  atendente_id?: string;
  atendente_nome?: string;
}

export async function gerarSenha(payload: GerarSenhaPayload): Promise<AutoSenhaItem> {
  assertCanAccessAutoSenhaUnidade(payload.unidade_id, 'operacional');
  const dataHoje = getDataOperacionalHoje();
  const agora = new Date().toISOString();

  // Buscar senhas do dia para obter o próximo número da categoria
  const todasSenhas = await getSenhas(payload.unidade_id, dataHoje);

  // Filtrar pela prioridade no dia daquela unidade
  const senhasMesmoTipo = todasSenhas.filter(s => s.prioridade_tipo === payload.prioridade_tipo);
  const proximoSequencial = senhasMesmoTipo.length + 1;

  let prefixo = 'N';
  if (payload.prioridade_tipo === 'PRIORITARIO') prefixo = 'P';
  else if (payload.prioridade_tipo === 'ESPECIAL') prefixo = 'E';

  const numeroFormatado = `${prefixo}${String(proximoSequencial).padStart(3, '0')}`;

  const novaSenha: AutoSenhaItem = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `snh-${Date.now()}`,
    unidade_id: payload.unidade_id,
    numero: numeroFormatado,
    numero_sequencial: proximoSequencial,
    data_operacional: dataHoje,
    paciente_id: payload.paciente_id,
    paciente_cpf: payload.paciente_cpf,
    paciente_cartao_sus: payload.paciente_cartao_sus,
    cidadao_nome: payload.cidadao_nome.trim(),
    prioridade_tipo: payload.prioridade_tipo,
    prioridade_categoria: payload.prioridade_categoria || (payload.prioridade_tipo === 'NORMAL' ? 'Geral' : undefined),
    status: 'AGUARDANDO',
    guiche: payload.guiche || 'Recepção',
    atendente_id: payload.atendente_id,
    atendente_nome: payload.atendente_nome || 'Atendente',
    created_at: agora,
    call_count: 0
  };

  // Salvar Local
  const localList = getLocalSenhas();
  localList.unshift(novaSenha);
  saveLocalSenhas(localList);

  // Salvar Supabase
  try {
    const { data, error } = await supabase
      .from('autosenha_senhas')
      .insert([novaSenha])
      .select()
      .single();

    if (!error && data) {
      novaSenha.id = data.id;
    }
  } catch (e) {
    console.warn('[AutoSenha] Supabase insert fallback para local:', e);
  }

  await registrarAuditoria(
    payload.unidade_id,
    'EMISSAO',
    `Senha ${novaSenha.numero} emitida para ${novaSenha.cidadao_nome} (${novaSenha.prioridade_tipo})`,
    novaSenha,
    payload.atendente_nome || 'Atendente',
    payload.atendente_id,
    novaSenha.id,
    novaSenha.numero
  );

  notificarRealtimeMudanca(payload.unidade_id, 'senha_emitida', { senha: novaSenha });
  return novaSenha;
}

// ----------------------------------------------------------------------
// CONSULTA DE SENHAS E ORDENAÇÃO REAL DA FILA
// ----------------------------------------------------------------------
export async function getSenhas(
  unidadeId?: AutoSenhaUnidadeId,
  dataOperacional?: string
): Promise<AutoSenhaItem[]> {
  if (unidadeId) {
    assertCanAccessAutoSenhaUnidade(unidadeId, 'tv');
  }
  try {
    let query = supabase.from('autosenha_senhas').select('*');
    if (unidadeId) query = query.eq('unidade_id', unidadeId);
    if (dataOperacional) query = query.eq('data_operacional', dataOperacional);

    const { data, error } = await query.order('created_at', { ascending: false });
    if (!error && Array.isArray(data)) {
      // Sincroniza cache local mantendo registros de outras unidades/datas
      const local = getLocalSenhas();
      const outrosEscopos = local.filter(s => {
        if (unidadeId && s.unidade_id !== unidadeId) return true;
        if (dataOperacional && s.data_operacional !== dataOperacional) return true;
        return false;
      });
      saveLocalSenhas([...data, ...outrosEscopos]);
      return data;
    }
  } catch (e) {
    // fallback local abaixo
  }

  // Fallback Local
  let result = getLocalSenhas();
  if (unidadeId) result = result.filter(s => s.unidade_id === unidadeId);
  if (dataOperacional) result = result.filter(s => s.data_operacional === dataOperacional);
  return result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export interface FilaAtualOrdenadaItem {
  senha: AutoSenhaItem;
  posicao: number;
}

/**
 * Ordena os cidadãos aguardando ('AGUARDANDO') na ordem exata em que serão chamados
 * pela unidade (respeitando Especial 80+ e a regra de alternância Prioritário : Normal),
 * sem alterar os contadores persistidos.
 */
export function getFilaAtualOrdenada(
  senhas: AutoSenhaItem[],
  config?: AutoSenhaConfiguracao | null
): FilaAtualOrdenadaItem[] {
  const porOrdemChegada = (a: AutoSenhaItem, b: AutoSenhaItem) => {
    const diffTempo = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    if (diffTempo !== 0) return diffTempo;
    return (a.numero_sequencial || 0) - (b.numero_sequencial || 0);
  };

  const aguardando = senhas.filter(s => s.status === 'AGUARDANDO');
  if (aguardando.length === 0) return [];

  const especiais = aguardando.filter(s => s.prioridade_tipo === 'ESPECIAL').sort(porOrdemChegada);
  const prioritarios = aguardando.filter(s => s.prioridade_tipo === 'PRIORITARIO').sort(porOrdemChegada);
  const normais = aguardando.filter(s => s.prioridade_tipo === 'NORMAL').sort(porOrdemChegada);

  const ordenadas: AutoSenhaItem[] = [...especiais];

  if (config?.regra_alternancia === 'APENAS_PRIORIDADE') {
    ordenadas.push(...prioritarios, ...normais);
  } else {
    const propP = config?.proporcao_prioridade || 2;
    let contP = config?.contador_prioridade_atual || 0;
    const pQueue = [...prioritarios];
    const nQueue = [...normais];

    while (pQueue.length > 0 || nQueue.length > 0) {
      if (pQueue.length > 0 && contP < propP) {
        ordenadas.push(pQueue.shift()!);
        contP += 1;
      } else if (nQueue.length > 0) {
        ordenadas.push(nQueue.shift()!);
        contP = 0;
      } else if (pQueue.length > 0) {
        ordenadas.push(pQueue.shift()!);
        contP = 1;
      }
    }
  }

  return ordenadas.map((senha, idx) => ({
    senha,
    posicao: idx + 1
  }));
}

export type HistoricoPeriodoFiltro = 'hoje' | '7_dias' | '30_dias' | 'todos' | 'data_especifica';

export interface ConsultarHistoricoAtendimentosParams {
  unidadeId: AutoSenhaUnidadeId;
  periodo?: HistoricoPeriodoFiltro;
  dataEspecifica?: string; // YYYY-MM-DD
  status?: 'TODOS' | AutoSenhaStatus;
  prioridade?: 'TODAS' | AutoSenhaPrioridadeTipo;
  busca?: string;
  ordem?: 'desc' | 'asc';
  page?: number;
  pageSize?: number;
}

export interface ConsultarHistoricoAtendimentosResult {
  items: AutoSenhaItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  error?: string;
  errorType?: 'permissao' | 'conexao' | 'validacao';
  fonte: 'supabase' | 'local' | 'erro';
}

function sanitizarTermoPostgrest(termo: string): string {
  return termo.replace(/[,()*%\\]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Consulta paginada e isolada por unidade de todos os registros históricos de atendimento,
 * sem alterar ou excluir registros históricos existentes.
 */
export async function getHistoricoAtendimentosUnidade(
  params: ConsultarHistoricoAtendimentosParams
): Promise<ConsultarHistoricoAtendimentosResult> {
  const {
    unidadeId,
    periodo = 'todos',
    dataEspecifica,
    status = 'TODOS',
    prioridade = 'TODAS',
    busca = '',
    ordem = 'desc',
    page = 1,
    pageSize = 15
  } = params;

  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.min(50, Math.max(5, Number(pageSize) || 15));

  try {
    assertCanAccessAutoSenhaUnidade(unidadeId, 'historico');
  } catch (permErr: any) {
    return {
      items: [],
      total: 0,
      page: safePage,
      pageSize: safePageSize,
      totalPages: 1,
      error: permErr?.message || 'Sem permissão para consultar o histórico desta unidade.',
      errorType: 'permissao',
      fonte: 'erro'
    };
  }

  if (periodo === 'data_especifica' && dataEspecifica && !/^\d{4}-\d{2}-\d{2}$/.test(dataEspecifica)) {
    return {
      items: [],
      total: 0,
      page: safePage,
      pageSize: safePageSize,
      totalPages: 1,
      error: 'Data selecionada inválida para consulta do histórico.',
      errorType: 'validacao',
      fonte: 'erro'
    };
  }

  const hoje = getDataOperacionalHoje();
  const termoLimpo = sanitizarTermoPostgrest(busca);
  const termoLower = termoLimpo.toLowerCase();

  try {
    let query = supabase
      .from('autosenha_senhas')
      .select('*', { count: 'exact' })
      .eq('unidade_id', unidadeId);

    if (periodo === 'hoje') {
      query = query.eq('data_operacional', hoje);
    } else if (periodo === '7_dias') {
      query = query.gte('data_operacional', subtrairDiasDataOperacional(hoje, 7));
    } else if (periodo === '30_dias') {
      query = query.gte('data_operacional', subtrairDiasDataOperacional(hoje, 30));
    } else if (periodo === 'data_especifica' && dataEspecifica) {
      query = query.eq('data_operacional', dataEspecifica);
    }

    if (status && status !== 'TODOS') {
      query = query.eq('status', status);
    }
    if (prioridade && prioridade !== 'TODAS') {
      query = query.eq('prioridade_tipo', prioridade);
    }
    if (termoLimpo) {
      query = query.or(`cidadao_nome.ilike.%${termoLimpo}%,numero.ilike.%${termoLimpo}%`);
    }

    const from = (safePage - 1) * safePageSize;
    const to = from + safePageSize - 1;

    const { data, count, error } = await query
      .order('created_at', { ascending: ordem === 'asc' })
      .range(from, to);

    if (!error && Array.isArray(data)) {
      const lista = data as AutoSenhaItem[];
      const totalRegistros = typeof count === 'number' ? count : lista.length;
      const totalPages = Math.max(1, Math.ceil(totalRegistros / safePageSize));
      return {
        items: lista,
        total: totalRegistros,
        page: safePage,
        pageSize: safePageSize,
        totalPages,
        fonte: 'supabase'
      };
    }

    if (error) {
      const errMsg = String(error.message || '');
      const errCode = String((error as any).code || '');
      const isPermError =
        errCode === '42501' ||
        /permission|rls|row-level|jwt|unauthorized|forbidden/i.test(errMsg);
      if (isPermError) {
        return {
          items: [],
          total: 0,
          page: safePage,
          pageSize: safePageSize,
          totalPages: 1,
          error: 'Acesso negado pela política de segurança ao histórico desta unidade.',
          errorType: 'permissao',
          fonte: 'erro'
        };
      }

      // Em erro real de rede/banco sem tabela ausente, verificar se há dados locais em cache ou reportar erro real
      const isMissingTable = errCode === '42P01' || /does not exist|relation/i.test(errMsg);
      if (!isMissingTable) {
        return {
          items: [],
          total: 0,
          page: safePage,
          pageSize: safePageSize,
          totalPages: 1,
          error: `Não foi possível carregar o histórico de atendimentos: ${errMsg || 'falha na consulta ao servidor.'}`,
          errorType: 'conexao',
          fonte: 'erro'
        };
      }
    }
  } catch (err: any) {
    const locaisCheck = getLocalSenhas().filter(s => s.unidade_id === unidadeId);
    if (locaisCheck.length === 0) {
      return {
        items: [],
        total: 0,
        page: safePage,
        pageSize: safePageSize,
        totalPages: 1,
        error: err?.message || 'Erro de conexão ao consultar o histórico de atendimentos.',
        errorType: 'conexao',
        fonte: 'erro'
      };
    }
  }

  // Fallback Local (apenas para ambiente offline/tabela ainda não provisionada)
  let filtrados = getLocalSenhas().filter(s => s.unidade_id === unidadeId);
  if (periodo === 'hoje') {
    filtrados = filtrados.filter(s => s.data_operacional === hoje);
  } else if (periodo === '7_dias') {
    const min = subtrairDiasDataOperacional(hoje, 7);
    filtrados = filtrados.filter(s => s.data_operacional >= min);
  } else if (periodo === '30_dias') {
    const min = subtrairDiasDataOperacional(hoje, 30);
    filtrados = filtrados.filter(s => s.data_operacional >= min);
  } else if (periodo === 'data_especifica' && dataEspecifica) {
    filtrados = filtrados.filter(s => s.data_operacional === dataEspecifica);
  }

  if (status && status !== 'TODOS') {
    filtrados = filtrados.filter(s => s.status === status);
  }
  if (prioridade && prioridade !== 'TODAS') {
    filtrados = filtrados.filter(s => s.prioridade_tipo === prioridade);
  }
  if (termoLower) {
    filtrados = filtrados.filter(s =>
      (s.cidadao_nome || '').toLowerCase().includes(termoLower) ||
      (s.numero || '').toLowerCase().includes(termoLower)
    );
  }

  filtrados.sort((a, b) => {
    const diff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    return ordem === 'asc' ? diff : -diff;
  });

  const total = filtrados.length;
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));
  const inicio = (safePage - 1) * safePageSize;
  const items = filtrados.slice(inicio, inicio + safePageSize);

  return {
    items,
    total,
    page: safePage,
    pageSize: safePageSize,
    totalPages,
    fonte: 'local'
  };
}

/**
 * Busca todas as senhas/atendimentos de um paciente específico (por ID, CPF ou Nome)
 */
export async function getSenhasDoPaciente(
  pacienteId?: string | null,
  cpf?: string | null,
  nome?: string | null
): Promise<AutoSenhaItem[]> {
  const cleanCpf = (cpf || '').replace(/\D/g, '');
  const cleanNome = (nome || '').trim().toLowerCase();

  try {
    let query = supabase.from('autosenha_senhas').select('*');
    if (pacienteId) {
      query = query.eq('paciente_id', pacienteId);
    } else if (cleanCpf && cleanCpf.length === 11) {
      query = query.eq('paciente_cpf', cleanCpf);
    } else if (cleanNome) {
      query = query.ilike('cidadao_nome', `%${cleanNome}%`);
    } else {
      return [];
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (!error && data && Array.isArray(data) && data.length > 0) {
      return data;
    }
  } catch (e) {
    // fallback
  }

  // Fallback Local
  const locais = getLocalSenhas();
  return locais.filter(s => {
    if (pacienteId && s.paciente_id === pacienteId) return true;
    if (cleanCpf && s.paciente_cpf && s.paciente_cpf.replace(/\D/g, '') === cleanCpf) return true;
    if (cleanNome && s.cidadao_nome && s.cidadao_nome.toLowerCase().includes(cleanNome)) return true;
    return false;
  }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

async function findSenhaParaAcao(
  senhaId: string,
  expectedUnidadeId?: AutoSenhaUnidadeId
): Promise<{ locais: AutoSenhaItem[]; senha: AutoSenhaItem } | null> {
  const locais = getLocalSenhas();
  let senha = locais.find(s => s.id === senhaId);

  if (!senha) {
    try {
      const { data, error } = await supabase
        .from('autosenha_senhas')
        .select('*')
        .eq('id', senhaId)
        .maybeSingle();
      if (!error && data) {
        senha = data as AutoSenhaItem;
        locais.unshift(senha);
      }
    } catch (e) {}
  }

  if (!senha) return null;
  if (expectedUnidadeId && senha.unidade_id !== expectedUnidadeId) {
    throw new Error(`Acesso negado: esta senha pertence à unidade ${senha.unidade_id.toUpperCase()}.`);
  }
  assertCanAccessAutoSenhaUnidade(senha.unidade_id, 'operacional');
  return { locais, senha };
}

// ----------------------------------------------------------------------
// ALGORITMO INTELIGENTE E LEGAL DE CHAMADA DO PRÓXIMO
// ----------------------------------------------------------------------
export async function chamarProximo(
  unidadeId: AutoSenhaUnidadeId,
  guiche = 'Recepção',
  operadorNome = 'Atendente',
  operadorId?: string
): Promise<{ senhaChamada: AutoSenhaItem | null; mensagem?: string }> {
  assertCanAccessAutoSenhaUnidade(unidadeId, 'operacional');
  const dataHoje = getDataOperacionalHoje();
  const senhasHoje = await getSenhas(unidadeId, dataHoje);

  // Apenas senhas com status 'AGUARDANDO' podem ser chamadas
  const aguardando = senhasHoje.filter(s => s.status === 'AGUARDANDO');

  if (aguardando.length === 0) {
    return { senhaChamada: null, mensagem: 'Não há cidadãos aguardando na fila desta unidade.' };
  }

  const config = await getConfiguracao(unidadeId);

  // 1. Prioridade Especial (Idoso 80+, PCD grave etc.) sempre tem prioridade absoluta legal
  const especiais = aguardando.filter(s => s.prioridade_tipo === 'ESPECIAL');
  const prioritarios = aguardando.filter(s => s.prioridade_tipo === 'PRIORITARIO');
  const normais = aguardando.filter(s => s.prioridade_tipo === 'NORMAL');

  let escolhida: AutoSenhaItem | null = null;

  // Lei Federal: maiores de 80 anos têm prioridade especial sobre os demais prioritários
  if (especiais.length > 0) {
    // Escolhe o mais antigo dos especiais
    escolhida = especiais.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0];
  } else {
    // Aplicar regra de alternância configurável
    // Ex: '2_P_1_N': 2 prioritários para 1 normal
    const propP = config.proporcao_prioridade || 2;
    const contP = config.contador_prioridade_atual || 0;

    // Se há prioritários aguardando e ainda não atingiu o limite de proporção P
    if (prioritarios.length > 0 && contP < propP) {
      escolhida = prioritarios.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0];
      config.contador_prioridade_atual = contP + 1;
      config.contador_normal_atual = 0;
    } else if (normais.length > 0) {
      // Chama Normal
      escolhida = normais.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0];
      config.contador_prioridade_atual = 0;
      config.contador_normal_atual = (config.contador_normal_atual || 0) + 1;
    } else if (prioritarios.length > 0) {
      // Se não há normais, chama prioritário mesmo tendo zerado o contador
      escolhida = prioritarios.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0];
      config.contador_prioridade_atual = 1;
      config.contador_normal_atual = 0;
    }
  }

  if (!escolhida) {
    escolhida = aguardando.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0];
  }

  // Atualizar contadores da config
  await salvarConfiguracao(config, 'Sistema de Filas', operadorId);

  // Registrar chamada da senha
  const agora = new Date().toISOString();
  escolhida.status = 'CHAMANDO';
  escolhida.guiche = guiche;
  escolhida.atendente_id = operadorId;
  escolhida.atendente_nome = operadorNome;
  escolhida.last_called_at = agora;
  escolhida.call_count = (escolhida.call_count || 0) + 1;

  if (!escolhida.first_called_at) {
    escolhida.first_called_at = agora;
    const criacaoMs = new Date(escolhida.created_at).getTime();
    const chamadaMs = new Date(agora).getTime();
    escolhida.wait_time_first_call_seconds = Math.max(0, Math.floor((chamadaMs - criacaoMs) / 1000));
  }

  // Atualizar localmente
  const locais = getLocalSenhas();
  const idx = locais.findIndex(s => s.id === escolhida!.id);
  if (idx !== -1) locais[idx] = escolhida;
  else locais.unshift(escolhida);
  saveLocalSenhas(locais);

  // Atualizar no Supabase
  try {
    await supabase
      .from('autosenha_senhas')
      .update({
        status: 'CHAMANDO',
        guiche,
        atendente_id: operadorId,
        atendente_nome: operadorNome,
        first_called_at: escolhida.first_called_at,
        last_called_at: agora,
        call_count: escolhida.call_count,
        wait_time_first_call_seconds: escolhida.wait_time_first_call_seconds
      })
      .eq('id', escolhida.id);
  } catch (e) {
    console.warn('[AutoSenha] Erro ao atualizar chamada no Supabase:', e);
  }

  // Registrar histórico da chamada
  const historicoChamada: AutoSenhaChamadaHistorico = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `chm-${Date.now()}`,
    senha_id: escolhida.id,
    unidade_id: unidadeId,
    numero_chamada: escolhida.call_count,
    tipo_evento: escolhida.call_count === 1 ? 'CHAMADA_INICIAL' : 'RECHAMADA',
    guiche,
    operador_id: operadorId,
    operador_nome: operadorNome,
    timestamp_chamada: agora
  };

  try {
    await supabase.from('autosenha_chamadas').insert([historicoChamada]);
  } catch (e) {}

  await registrarAuditoria(
    unidadeId,
    'CHAMADA',
    `Senha ${escolhida.numero} chamada no ${guiche} por ${operadorNome} (${escolhida.prioridade_tipo})`,
    { senha: escolhida, guiche },
    operadorNome,
    operadorId,
    escolhida.id,
    escolhida.numero
  );

  notificarRealtimeMudanca(unidadeId, 'senha_chamada', { senha: escolhida, guiche });
  return { senhaChamada: escolhida };
}

// ----------------------------------------------------------------------
// RECHAMAR SENHA
// ----------------------------------------------------------------------
export async function rechamarSenha(
  senhaId: string,
  guiche = 'Recepção',
  operadorNome = 'Atendente',
  operadorId?: string,
  expectedUnidadeId?: AutoSenhaUnidadeId
): Promise<AutoSenhaItem | null> {
  const found = await findSenhaParaAcao(senhaId, expectedUnidadeId);
  if (!found) return null;
  const { locais, senha } = found;

  const agora = new Date().toISOString();
  senha.status = 'CHAMANDO';
  senha.guiche = guiche;
  senha.last_called_at = agora;
  senha.call_count = (senha.call_count || 1) + 1;

  saveLocalSenhas(locais);

  try {
    await supabase
      .from('autosenha_senhas')
      .update({
        status: 'CHAMANDO',
        guiche,
        last_called_at: agora,
        call_count: senha.call_count
      })
      .eq('id', senha.id);

    await supabase.from('autosenha_chamadas').insert([{
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `chm-${Date.now()}`,
      senha_id: senha.id,
      unidade_id: senha.unidade_id,
      numero_chamada: senha.call_count,
      tipo_evento: 'RECHAMADA',
      guiche,
      operador_id: operadorId,
      operador_nome: operadorNome,
      timestamp_chamada: agora
    }]);
  } catch (e) {}

  await registrarAuditoria(
    senha.unidade_id,
    'RECHAMADA',
    `Senha ${senha.numero} rechamada no ${guiche} (${senha.call_count}ª vez)`,
    { senha, guiche },
    operadorNome,
    operadorId,
    senha.id,
    senha.numero
  );

  notificarRealtimeMudanca(senha.unidade_id, 'senha_chamada', { senha, guiche, isRechamada: true });
  return senha;
}

// ----------------------------------------------------------------------
// INICIAR ATENDIMENTO
// ----------------------------------------------------------------------
export async function iniciarAtendimento(
  senhaId: string,
  operadorNome = 'Atendente',
  operadorId?: string,
  expectedUnidadeId?: AutoSenhaUnidadeId
): Promise<AutoSenhaItem | null> {
  const found = await findSenhaParaAcao(senhaId, expectedUnidadeId);
  if (!found) return null;
  const { locais, senha } = found;

  const agora = new Date().toISOString();
  senha.status = 'EM_ATENDIMENTO';
  senha.service_started_at = agora;

  const criacaoMs = new Date(senha.created_at).getTime();
  const inicioMs = new Date(agora).getTime();
  senha.wait_time_total_seconds = Math.max(0, Math.floor((inicioMs - criacaoMs) / 1000));

  saveLocalSenhas(locais);

  try {
    await supabase
      .from('autosenha_senhas')
      .update({
        status: 'EM_ATENDIMENTO',
        service_started_at: agora,
        wait_time_total_seconds: senha.wait_time_total_seconds
      })
      .eq('id', senha.id);
  } catch (e) {}

  await registrarAuditoria(
    senha.unidade_id,
    'INICIO_ATENDIMENTO',
    `Atendimento da senha ${senha.numero} iniciado por ${operadorNome}`,
    senha,
    operadorNome,
    operadorId,
    senha.id,
    senha.numero
  );

  notificarRealtimeMudanca(senha.unidade_id, 'atendimento_iniciado', { senha });
  return senha;
}

// ----------------------------------------------------------------------
// CONCLUIR ATENDIMENTO
// ----------------------------------------------------------------------
export async function concluirAtendimento(
  senhaId: string,
  operadorNome = 'Atendente',
  operadorId?: string,
  expectedUnidadeId?: AutoSenhaUnidadeId
): Promise<AutoSenhaItem | null> {
  const found = await findSenhaParaAcao(senhaId, expectedUnidadeId);
  if (!found) return null;
  const { locais, senha } = found;

  const agora = new Date().toISOString();
  senha.status = 'CONCLUIDO';
  senha.service_finished_at = agora;

  if (senha.service_started_at) {
    const inicioMs = new Date(senha.service_started_at).getTime();
    const fimMs = new Date(agora).getTime();
    senha.service_duration_seconds = Math.max(0, Math.floor((fimMs - inicioMs) / 1000));
  } else {
    // Se não tinha marcado início formal, calcula a partir do first_called_at ou 5 min padrão
    const inicioMs = senha.first_called_at ? new Date(senha.first_called_at).getTime() : new Date(agora).getTime() - 300000;
    senha.service_started_at = new Date(inicioMs).toISOString();
    senha.service_duration_seconds = Math.max(0, Math.floor((new Date(agora).getTime() - inicioMs) / 1000));
  }

  saveLocalSenhas(locais);

  try {
    await supabase
      .from('autosenha_senhas')
      .update({
        status: 'CONCLUIDO',
        service_started_at: senha.service_started_at,
        service_finished_at: agora,
        service_duration_seconds: senha.service_duration_seconds
      })
      .eq('id', senha.id);
  } catch (e) {}

  await registrarAuditoria(
    senha.unidade_id,
    'CONCLUSAO',
    `Atendimento da senha ${senha.numero} concluído por ${operadorNome} (Duração: ${formatarDuracaoSegundos(senha.service_duration_seconds || 0)})`,
    senha,
    operadorNome,
    operadorId,
    senha.id,
    senha.numero
  );

  notificarRealtimeMudanca(senha.unidade_id, 'atendimento_concluido', { senha });
  return senha;
}

// ----------------------------------------------------------------------
// REGISTRAR NÃO COMPARECIMENTO
// ----------------------------------------------------------------------
export async function registrarNaoCompareceu(
  senhaId: string,
  operadorNome = 'Atendente',
  operadorId?: string,
  expectedUnidadeId?: AutoSenhaUnidadeId
): Promise<AutoSenhaItem | null> {
  const found = await findSenhaParaAcao(senhaId, expectedUnidadeId);
  if (!found) return null;
  const { locais, senha } = found;

  const agora = new Date().toISOString();
  senha.status = 'NAO_COMPARECEU';
  senha.motivo_encerramento = 'Cidadão não compareceu após as chamadas regulamentares.';
  senha.service_finished_at = agora;

  saveLocalSenhas(locais);

  try {
    await supabase
      .from('autosenha_senhas')
      .update({
        status: 'NAO_COMPARECEU',
        motivo_encerramento: senha.motivo_encerramento,
        service_finished_at: agora
      })
      .eq('id', senha.id);
  } catch (e) {}

  await registrarAuditoria(
    senha.unidade_id,
    'NAO_COMPARECEU',
    `Senha ${senha.numero} finalizada como NÃO COMPARECEU por ${operadorNome}`,
    senha,
    operadorNome,
    operadorId,
    senha.id,
    senha.numero
  );

  notificarRealtimeMudanca(senha.unidade_id, 'nao_compareceu', { senha });
  return senha;
}

// ----------------------------------------------------------------------
// CANCELAR SENHA COM JUSTIFICATIVA
// ----------------------------------------------------------------------
export async function cancelarSenha(
  senhaId: string,
  motivo: string,
  operadorNome = 'Atendente',
  operadorId?: string,
  expectedUnidadeId?: AutoSenhaUnidadeId
): Promise<AutoSenhaItem | null> {
  const found = await findSenhaParaAcao(senhaId, expectedUnidadeId);
  if (!found) return null;
  const { locais, senha } = found;

  const agora = new Date().toISOString();
  senha.status = 'CANCELADO';
  senha.motivo_encerramento = motivo;
  senha.service_finished_at = agora;

  saveLocalSenhas(locais);

  try {
    await supabase
      .from('autosenha_senhas')
      .update({
        status: 'CANCELADO',
        motivo_encerramento: motivo,
        service_finished_at: agora
      })
      .eq('id', senha.id);
  } catch (e) {}

  await registrarAuditoria(
    senha.unidade_id,
    'CANCELAMENTO',
    `Senha ${senha.numero} cancelada por ${operadorNome}. Motivo: ${motivo}`,
    { senha, motivo },
    operadorNome,
    operadorId,
    senha.id,
    senha.numero
  );

  notificarRealtimeMudanca(senha.unidade_id, 'senha_cancelada', { senha });
  return senha;
}

// ----------------------------------------------------------------------
// FLUXO INTEGRADO — SOLICITAR AVALIAÇÃO IMEDIATA (ENCAMINHAMENTO PRESENCIAL)
// ----------------------------------------------------------------------
export async function solicitarAvaliacaoImediataUPA(
  cidadaoNome: string,
  motivoQueixa: string,
  operadorNome: string,
  operadorId?: string,
  senhaId?: string,
  senhaNumero?: string,
  unidadeId: AutoSenhaUnidadeId = 'upa'
): Promise<AutoSenhaAvaliacaoUrgente> {
  assertCanAccessAutoSenhaUnidade(unidadeId, 'operacional');
  const avaliacao: AutoSenhaAvaliacaoUrgente = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `urg-${Date.now()}`,
    unidade_id: unidadeId,
    senha_id: senhaId,
    senha_numero: senhaNumero,
    cidadao_nome: cidadaoNome.trim(),
    motivo_queixa: motivoQueixa.trim(),
    status: 'ENCAMINHADO_PRESENCIAL',
    solicitante_id: operadorId,
    solicitante_nome: operadorNome,
    created_at: new Date().toISOString()
  };

  const lista = getLocalUrgentes();
  lista.unshift(avaliacao);
  saveLocalUrgentes(lista);

  try {
    await supabase.from('autosenha_avaliacoes_urgentes').insert([avaliacao]);
  } catch (e) {}

  await registrarAuditoria(
    unidadeId,
    unidadeId === 'upa' ? 'AVALIACAO_URGENTE_UPA' : `AVALIACAO_URGENTE_${unidadeId.toUpperCase()}`,
    `ALERTA ASSISTENCIAL ${unidadeId.toUpperCase()}: Solicitação de avaliação presencial imediata para ${cidadaoNome}. Queixa: ${motivoQueixa}`,
    avaliacao,
    operadorNome,
    operadorId,
    senhaId,
    senhaNumero
  );

  notificarRealtimeMudanca(unidadeId, 'alerta_urgencia_clinica', { avaliacao });
  return avaliacao;
}

// ----------------------------------------------------------------------
// CÁLCULO DE CAPACIDADE E MÉTRICAS POR UNIDADE
// ----------------------------------------------------------------------
export async function calcularMetricasUnidade(
  unidadeId: AutoSenhaUnidadeId,
  periodoDias = 0 // 0 = Hoje, 1 = Ontem, 7 = 7 dias, etc.
): Promise<AutoSenhaCapacidadeMetricas> {
  const unidade = AUTOSENHA_UNIDADES.find(u => u.id === unidadeId)!;
  const config = await getConfiguracao(unidadeId);
  const dataHoje = getDataOperacionalHoje();

  const todasSenhas = await getSenhas(unidadeId);

  // Filtragem de período
  const senhasPeriodo = todasSenhas.filter(s => {
    if (periodoDias === 0) return s.data_operacional === dataHoje;
    // Se for período histórico amplo
    const dSenha = new Date(s.created_at);
    const limitePassado = new Date();
    limitePassado.setDate(limitePassado.getDate() - periodoDias);
    return dSenha >= limitePassado;
  });

  // Senhas AGORA (estado presente em tempo real)
  const senhasHoje = todasSenhas.filter(s => s.data_operacional === dataHoje);
  const aguardandoAgora = senhasHoje.filter(s => s.status === 'AGUARDANDO');
  const emAtendimentoAgora = senhasHoje.filter(s => s.status === 'EM_ATENDIMENTO' || s.status === 'CHAMANDO');
  const concluídosHoje = senhasHoje.filter(s => s.status === 'CONCLUIDO');

  // Última senha chamada hoje
  const chamadasHoje = senhasHoje
    .filter(s => s.first_called_at || s.last_called_at)
    .sort((a, b) => new Date(b.last_called_at || b.first_called_at!).getTime() - new Date(a.last_called_at || a.first_called_at!).getTime());
  const senhaAtual = chamadasHoje[0];

  // Cálculo da Maior Espera Atual (segundos)
  let maiorEsperaAtualSeg = 0;
  if (aguardandoAgora.length > 0) {
    const agoraMs = Date.now();
    aguardandoAgora.forEach(s => {
      const esperaMs = agoraMs - new Date(s.created_at).getTime();
      const seg = Math.max(0, Math.floor(esperaMs / 1000));
      if (seg > maiorEsperaAtualSeg) maiorEsperaAtualSeg = seg;
    });
  }

  // Cálculos no período selecionado
  const totalEmitidas = senhasPeriodo.length;
  const concluidosPeriodo = senhasPeriodo.filter(s => s.status === 'CONCLUIDO');
  const naoCompareceuPeriodo = senhasPeriodo.filter(s => s.status === 'NAO_COMPARECEU');
  const canceladosPeriodo = senhasPeriodo.filter(s => s.status === 'CANCELADO');
  const normais = senhasPeriodo.filter(s => s.prioridade_tipo === 'NORMAL');
  const prioritarios = senhasPeriodo.filter(s => s.prioridade_tipo === 'PRIORITARIO');
  const especiais = senhasPeriodo.filter(s => s.prioridade_tipo === 'ESPECIAL');

  // Média, Mediana e P90 do Tempo de Espera
  const temposEspera = senhasPeriodo
    .filter(s => s.wait_time_first_call_seconds !== undefined && s.wait_time_first_call_seconds > 0)
    .map(s => s.wait_time_first_call_seconds!)
    .sort((a, b) => a - b);

  let tempoMedioEsperaSeg = 0;
  let tempoMedianoEsperaSeg = 0;
  let tempoP90EsperaSeg = 0;

  if (temposEspera.length > 0) {
    const soma = temposEspera.reduce((acc, v) => acc + v, 0);
    tempoMedioEsperaSeg = Math.round(soma / temposEspera.length);

    // Mediana
    const mid = Math.floor(temposEspera.length / 2);
    tempoMedianoEsperaSeg = temposEspera.length % 2 !== 0
      ? temposEspera[mid]
      : Math.round((temposEspera[mid - 1] + temposEspera[mid]) / 2);

    // Percentil 90
    const idx90 = Math.floor(temposEspera.length * 0.9);
    tempoP90EsperaSeg = temposEspera[Math.min(idx90, temposEspera.length - 1)];
  }

  // Tempo Médio de Atendimento
  const temposAtendimento = concluidosPeriodo
    .filter(s => s.service_duration_seconds !== undefined && s.service_duration_seconds > 0)
    .map(s => s.service_duration_seconds!);

  let tempoMedioAtendimentoSeg = 0;
  if (temposAtendimento.length > 0) {
    const somaAt = temposAtendimento.reduce((acc, v) => acc + v, 0);
    tempoMedioAtendimentoSeg = Math.round(somaAt / temposAtendimento.length);
  }

  // Ritmo de Atendimento (atendimentos concluídos por hora operacional)
  // Calcula com base nas conclusões das últimas horas
  let atendimentosPorHora = 0;
  if (concluídosHoje.length > 0) {
    // Estimativa baseada no histórico de hoje: total concluídos dividido por horas decorridas
    const horasDecorridas = Math.max(1, (new Date().getHours() - 7));
    atendimentosPorHora = Number((concluídosHoje.length / horasDecorridas).toFixed(1));
  }

  // Taxa de conclusão
  const taxaConclusaoPct = totalEmitidas > 0 ? Math.round((concluidosPeriodo.length / totalEmitidas) * 100) : 0;

  // Situação Operacional (NORMAL, ATENCAO, ALTA_DEMANDA)
  let situacao: AutoSenhaSituacaoOperacional = 'NORMAL';
  const maiorEsperaMin = Math.floor(maiorEsperaAtualSeg / 60);

  if (
    aguardandoAgora.length >= config.limite_fila_critico_qtd ||
    maiorEsperaMin >= config.limite_espera_critico_min
  ) {
    situacao = 'ALTA_DEMANDA';
  } else if (
    aguardandoAgora.length >= config.limite_fila_atencao_qtd ||
    maiorEsperaMin >= config.limite_espera_atencao_min
  ) {
    situacao = 'ATENCAO';
  }

  // Projeção de escoamento da fila (apenas quando houver dados suficientes)
  let projecaoEscoamentoMin: number | undefined = undefined;
  let ritmoDescricao = 'Dados insuficientes para estimativa';
  if (atendimentosPorHora > 0 && aguardandoAgora.length > 0) {
    const horasEstimadas = aguardandoAgora.length / atendimentosPorHora;
    projecaoEscoamentoMin = Math.round(horasEstimadas * 60);
    ritmoDescricao = `Aprox. ${projecaoEscoamentoMin} min para escoamento atual (${atendimentosPorHora} atendimentos/hora)`;
  } else if (aguardandoAgora.length === 0) {
    ritmoDescricao = 'Fila vazia no momento';
  }

  let ultimaChamadaHora = '';
  if (senhaAtual?.last_called_at || senhaAtual?.first_called_at) {
    const d = new Date(senhaAtual.last_called_at || senhaAtual.first_called_at!);
    ultimaChamadaHora = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  return {
    unidade_id: unidadeId,
    unidade_nome: unidade.nome,
    unidade_sigla: unidade.sigla,
    situacao,
    aguardando_qtd: aguardandoAgora.length,
    em_atendimento_qtd: emAtendimentoAgora.length,
    concluidos_qtd: concluidosPeriodo.length,
    total_emitidas_qtd: totalEmitidas,
    normais_qtd: normais.length,
    prioritarios_qtd: prioritarios.length,
    especiais_qtd: especiais.length,
    nao_compareceu_qtd: naoCompareceuPeriodo.length,
    cancelados_qtd: canceladosPeriodo.length,
    tempo_medio_espera_seg: tempoMedioEsperaSeg,
    tempo_mediano_espera_seg: tempoMedianoEsperaSeg,
    tempo_p90_espera_seg: tempoP90EsperaSeg,
    maior_espera_atual_seg: maiorEsperaAtualSeg,
    tempo_medio_atendimento_seg: tempoMedioAtendimentoSeg,
    taxa_conclusao_pct: taxaConclusaoPct,
    atendimentos_por_hora: atendimentosPorHora,
    ritmo_descricao: ritmoDescricao,
    projecao_escoamento_min: projecaoEscoamentoMin,
    ultima_chamada_hora: ultimaChamadaHora,
    senha_atual: senhaAtual
  };
}

// ----------------------------------------------------------------------
// HISTÓRICO DE AUDITORIA E MOVIMENTAÇÕES
// ----------------------------------------------------------------------
export async function getMovimentacoesAuditoria(
  unidadeId?: AutoSenhaUnidadeId,
  limite = 50
): Promise<AutoSenhaAuditoria[]> {
  try {
    let query = supabase.from('autosenha_auditoria').select('*');
    if (unidadeId) query = query.eq('unidade_id', unidadeId);
    const { data, error } = await query.order('created_at', { ascending: false }).limit(limite);
    if (!error && data && Array.isArray(data) && data.length > 0) {
      return data;
    }
  } catch (e) {}

  let locais = getLocalAudit();
  if (unidadeId) locais = locais.filter(a => a.unidade_id === unidadeId);
  return locais.slice(0, limite);
}

// ----------------------------------------------------------------------
// PRODUÇÃO: LIMPEZA E ZERAGEM DE REGISTROS DO AUTOSENHA
// ----------------------------------------------------------------------

/**
 * Desativado: Módulo em PRODUÇÃO OFICIAL. Não gera senhas fictícias.
 */
export async function inicializarSeedSeVazio(): Promise<void> {
  return;
}

/**
 * Reinicia a fila ativa do dia e os contadores da unidade (ou de todo o módulo para Super Admin),
 * sem jamais ser executado automaticamente ao carregar o módulo e preservando permissões/isolamento.
 */
export async function zerarTodosDadosAutoSenha(unidadeId?: AutoSenhaUnidadeId): Promise<void> {
  if (unidadeId) {
    assertCanAccessAutoSenhaUnidade(unidadeId, 'operacional');
  } else {
    const activeUser = getActivePermissionUser();
    const globalSettings = getActiveGlobalModuleSettings();
    if (activeUser && !userCanAccessSubmodule(activeUser, 'parent_autosenha', 'sub_autosenha_dashboard', globalSettings)) {
      throw new Error('Acesso negado: apenas usuários com permissão administrativa no AutoSenha podem reiniciar todas as unidades.');
    }
  }

  const hoje = getDataOperacionalHoje();

  // 1. Limpeza controlada no cache local (isolada pela unidade quando informada)
  if (typeof window !== 'undefined') {
    try {
      if (unidadeId) {
        saveLocalSenhas(getLocalSenhas().filter(s => !(s.unidade_id === unidadeId && s.data_operacional === hoje)));
        const cfg = getLocalConfig(unidadeId);
        cfg.contador_prioridade_atual = 0;
        cfg.contador_normal_atual = 0;
        saveLocalConfig(cfg);
      } else {
        localStorage.setItem(STORAGE_SENHAS_KEY, JSON.stringify([]));
        localStorage.setItem(STORAGE_AUDIT_KEY, JSON.stringify([]));
        localStorage.setItem(STORAGE_URGENTES_KEY, JSON.stringify([]));
        for (const u of AUTOSENHA_UNIDADES) {
          const cfg = getLocalConfig(u.id);
          cfg.contador_prioridade_atual = 0;
          cfg.contador_normal_atual = 0;
          saveLocalConfig(cfg);
        }
      }

      localStorage.setItem('sys_autosenha_producao_limpo_v1', 'true');
    } catch (e) {
      console.error('[AutoSenha] Erro ao limpar registros no localStorage:', e);
    }
  }

  // 2. Limpeza controlada no Supabase (somente fila do dia na unidade selecionada para não destruir históricos anteriores)
  try {
    if (unidadeId) {
      await Promise.allSettled([
        supabase
          .from('autosenha_senhas')
          .delete()
          .eq('unidade_id', unidadeId)
          .eq('data_operacional', hoje),
        supabase
          .from('autosenha_configuracoes')
          .update({ contador_prioridade_atual: 0, contador_normal_atual: 0 })
          .eq('unidade_id', unidadeId)
      ]);
    } else {
      await Promise.allSettled([
        supabase.from('autosenha_senhas').delete().eq('data_operacional', hoje),
        supabase.from('autosenha_chamadas').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      ]);
    }
  } catch (e) {
    console.warn('[AutoSenha] Limpeza no Supabase:', e);
  }

  // 3. Notificar telas conectadas apenas do escopo alterado
  const unidadesNotificar = unidadeId
    ? AUTOSENHA_UNIDADES.filter(u => u.id === unidadeId)
    : AUTOSENHA_UNIDADES;
  for (const u of unidadesNotificar) {
    notificarRealtimeMudanca(u.id, 'dados_zerados', {});
  }
}

