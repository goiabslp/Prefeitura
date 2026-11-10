import { supabase } from './supabaseClient';
import { calculateAgeYears } from '../utils/cpfUtils';
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
  AutoSenhaBloco,
  AutoSenhaBlocoStatus,
  AutoSenhaFilaBlocoItem,
  AutoSenhaChamadaHistorico,
  AutoSenhaAuditoria,
  AutoSenhaAvaliacaoUrgente,
  AutoSenhaCapacidadeMetricas
} from '../types';

// Chaves locais para cache/fallback de alta resiliência
const STORAGE_PREFIX = 'sys_autosenha_';
const STORAGE_SENHAS_KEY = `${STORAGE_PREFIX}senhas`;
const STORAGE_BLOCOS_KEY = `${STORAGE_PREFIX}blocos`;
const STORAGE_CONFIG_KEY = `${STORAGE_PREFIX}configs`;
const STORAGE_AUDIT_KEY = `${STORAGE_PREFIX}audit`;
const STORAGE_URGENTES_KEY = `${STORAGE_PREFIX}urgentes`;

export const SEQUENCIA_BLOCO_5: AutoSenhaPrioridadeTipo[] = [
  'ESPECIAL',
  'PRIORITARIO',
  'ESPECIAL',
  'PRIORITARIO',
  'NORMAL'
];

// Mutex em memória por unidade para impedir condições de corrida em chamadas/emissões simultâneas
const unidadeOperationLocks = new Map<string, Promise<void>>();
async function withUnidadeMutex<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const previous = unidadeOperationLocks.get(key) || Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>(resolve => {
    release = resolve;
  });
  const chained = previous.catch(() => {}).then(() => current);
  unidadeOperationLocks.set(key, chained);
  await previous.catch(() => {});
  try {
    return await fn();
  } finally {
    release();
    if (unidadeOperationLocks.get(key) === chained) {
      unidadeOperationLocks.delete(key);
    }
  }
}

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

function getLocalBlocos(): AutoSenhaBloco[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_BLOCOS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalBlocos(blocos: AutoSenhaBloco[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_BLOCOS_KEY, JSON.stringify(blocos));
  } catch (e) {
    console.error('[AutoSenha] Erro ao salvar blocos no localStorage:', e);
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
export interface ClassificacaoPorIdadeResult {
  idade: number | null;
  prioridade: AutoSenhaPrioridadeTipo;
}

/**
 * Calcula a idade atual pela data de nascimento e determina automaticamente
 * a classificação de senha aplicável (<60 Normal, 60-79 Prioritário, 80+ Especial).
 * Nunca retorna AVALIACAO_IMEDIATA automaticamente.
 */
export function resolverClassificacaoAutomaticaPorIdade(
  birthDate?: string | null,
  referenceDate?: Date
): ClassificacaoPorIdadeResult {
  const idade = calculateAgeYears(birthDate, referenceDate);
  if (idade !== null && idade >= 80) {
    return { idade, prioridade: 'ESPECIAL' };
  }
  if (idade !== null && idade >= 60) {
    return { idade, prioridade: 'PRIORITARIO' };
  }
  return { idade, prioridade: 'NORMAL' };
}

export interface GerarSenhaPayload {
  unidade_id: AutoSenhaUnidadeId;
  paciente_id?: string;
  paciente_cpf?: string;
  paciente_cartao_sus?: string;
  paciente_birth_date?: string;
  prioridade_ajuste_manual?: boolean;
  cidadao_nome: string;
  prioridade_tipo: AutoSenhaPrioridadeTipo;
  prioridade_categoria?: AutoSenhaPrioridadeCategoria | string;
  guiche?: string;
  atendente_id?: string;
  atendente_nome?: string;
}

const PRIORIDADES_VALIDAS_SENHA: ReadonlySet<AutoSenhaPrioridadeTipo> = new Set([
  'NORMAL',
  'PRIORITARIO',
  'ESPECIAL'
]);

const porOrdemChegadaSenha = (a: AutoSenhaItem, b: AutoSenhaItem): number => {
  const diffTempo = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  if (diffTempo !== 0) return diffTempo;
  return (a.numero_sequencial || 0) - (b.numero_sequencial || 0);
};

/**
 * Reorganiza dinamicamente as senhas dentro de um bloco de até 5 pacientes,
 * respeitando a sequência preferencial: Especial -> Prioritário -> Especial -> Prioritário -> Normal,
 * ordem de chegada dentro de cada categoria e fechamento automático ao atingir 5 pacientes.
 * Não altera posições de senhas que já saíram de AGUARDANDO nem blocos já FECHADOS.
 */
export function reorganizarItensNoBloco5(
  itensDoBloco: AutoSenhaItem[],
  blocoStatusAtual: AutoSenhaBlocoStatus = 'EM_FORMACAO'
): { itensAtualizados: AutoSenhaItem[]; fechou: boolean } {
  if (itensDoBloco.length === 0) {
    return { itensAtualizados: [], fechou: false };
  }

  // Blocos fechados jamais sofrem reorganização convencional
  if (blocoStatusAtual === 'FECHADO') {
    const congelados = [...itensDoBloco]
      .sort((a, b) => (a.posicao_bloco || 99) - (b.posicao_bloco || 99) || porOrdemChegadaSenha(a, b))
      .map((s, idx) => ({
        ...s,
        bloco_status: 'FECHADO' as AutoSenhaBlocoStatus,
        posicao_bloco: s.posicao_bloco || idx + 1,
        posicao_provisoria: false
      }));
    return { itensAtualizados: congelados, fechou: true };
  }

  const fechou = itensDoBloco.length >= 5;
  const novoStatus: AutoSenhaBlocoStatus = fechou ? 'FECHADO' : 'EM_FORMACAO';
  const resultMap = new Map<string, AutoSenhaItem>();
  const posicoesFixas = new Set<number>();

  // Preserva posições de senhas do bloco que já foram chamadas/finalizadas antes do fechamento
  itensDoBloco.forEach(item => {
    if (item.status !== 'AGUARDANDO' && item.posicao_bloco) {
      posicoesFixas.add(item.posicao_bloco);
      resultMap.set(item.id, {
        ...item,
        bloco_status: novoStatus,
        posicao_provisoria: !fechou
      });
    }
  });

  const aguardando = itensDoBloco
    .filter(item => item.status === 'AGUARDANDO')
    .sort(porOrdemChegadaSenha);

  const usadas = new Set<string>();
  const ordemBuscaPorSlot = (slotPref: AutoSenhaPrioridadeTipo): AutoSenhaPrioridadeTipo[] => {
    if (slotPref === 'ESPECIAL') return ['ESPECIAL', 'PRIORITARIO', 'NORMAL'];
    if (slotPref === 'PRIORITARIO') return ['PRIORITARIO', 'ESPECIAL', 'NORMAL'];
    return ['NORMAL', 'ESPECIAL', 'PRIORITARIO'];
  };

  for (let slotIdx = 1; slotIdx <= 5; slotIdx++) {
    if (posicoesFixas.has(slotIdx)) continue;
    const pref = SEQUENCIA_BLOCO_5[slotIdx - 1];
    const prioridades = ordemBuscaPorSlot(pref);

    let escolhida: AutoSenhaItem | undefined;
    for (const pTipo of prioridades) {
      escolhida = aguardando.find(s => !usadas.has(s.id) && s.prioridade_tipo === pTipo);
      if (escolhida) break;
    }

    if (escolhida) {
      usadas.add(escolhida.id);
      resultMap.set(escolhida.id, {
        ...escolhida,
        posicao_bloco: slotIdx,
        bloco_status: novoStatus,
        posicao_provisoria: !fechou
      });
    }
  }

  const itensAtualizados = Array.from(resultMap.values()).sort(
    (a, b) => (a.posicao_bloco || 99) - (b.posicao_bloco || 99) || porOrdemChegadaSenha(a, b)
  );
  return { itensAtualizados, fechou };
}

export async function getBlocos(
  unidadeId: AutoSenhaUnidadeId,
  dataOperacional?: string
): Promise<AutoSenhaBloco[]> {
  assertCanAccessAutoSenhaUnidade(unidadeId, 'tv');
  const dataRef = dataOperacional || getDataOperacionalHoje();

  try {
    const { data, error } = await supabase
      .from('autosenha_blocos')
      .select('*')
      .eq('unidade_id', unidadeId)
      .eq('data_operacional', dataRef)
      .order('numero_bloco', { ascending: true });

    if (!error && Array.isArray(data)) {
      const lista = data as AutoSenhaBloco[];
      const outros = getLocalBlocos().filter(b => !(b.unidade_id === unidadeId && b.data_operacional === dataRef));
      saveLocalBlocos([...lista, ...outros]);
      return lista;
    }
  } catch {
    // fallback local abaixo
  }

  return getLocalBlocos()
    .filter(b => b.unidade_id === unidadeId && b.data_operacional === dataRef)
    .sort((a, b) => a.numero_bloco - b.numero_bloco);
}

export async function gerarSenha(payload: GerarSenhaPayload): Promise<AutoSenhaItem> {
  assertCanAccessAutoSenhaUnidade(payload.unidade_id, 'operacional');

  if (!payload.cidadao_nome || !payload.cidadao_nome.trim()) {
    throw new Error('Informe o paciente antes de emitir a senha.');
  }
  if (!PRIORIDADES_VALIDAS_SENHA.has(payload.prioridade_tipo)) {
    throw new Error('Classificação inválida para emissão de senha na fila convencional.');
  }

  // Recalcula/valida na hora da emissão com base na data de nascimento atual, preservando ajuste manual justificado
  let prioridadeFinal: AutoSenhaPrioridadeTipo = payload.prioridade_tipo;
  if (!payload.prioridade_ajuste_manual && payload.paciente_birth_date) {
    prioridadeFinal = resolverClassificacaoAutomaticaPorIdade(payload.paciente_birth_date).prioridade;
  }

  const dataHoje = getDataOperacionalHoje();
  const lockKey = `emissao_${payload.unidade_id}_${dataHoje}`;

  return withUnidadeMutex(lockKey, async () => {
    const agora = new Date().toISOString();

    // Tenta executar emissão transacional direta via RPC no Postgres
    try {
      if (typeof (supabase as any).rpc === 'function') {
        const { data: rpcData, error: rpcErr } = await (supabase as any).rpc('emitir_senha_bloco5', {
          p_unidade_id: payload.unidade_id,
          p_cidadao_nome: payload.cidadao_nome.trim(),
          p_prioridade_tipo: prioridadeFinal,
          p_prioridade_categoria: payload.prioridade_categoria || (prioridadeFinal === 'NORMAL' ? 'Geral' : null),
          p_guiche: payload.guiche || 'Recepção',
          p_atendente_id: payload.atendente_id || null,
          p_atendente_nome: payload.atendente_nome || 'Recepção',
          p_paciente_id: payload.paciente_id || null,
          p_paciente_cpf: payload.paciente_cpf || null,
          p_paciente_cartao_sus: payload.paciente_cartao_sus || null
        });

        if (!rpcErr && rpcData) {
          const emitida = rpcData as AutoSenhaItem;
          // Atualiza cache local sincronizado do dia/blocos
          await Promise.allSettled([
            getSenhas(payload.unidade_id, dataHoje),
            getBlocos(payload.unidade_id, dataHoje)
          ]);
          notificarRealtimeMudanca(payload.unidade_id, 'senha_emitida', { senha: emitida });
          notificarRealtimeMudanca(payload.unidade_id, 'bloco_atualizado', { blocoNumero: emitida.bloco_numero });
          return emitida;
        }
      }
    } catch {
      // Fallback para serviço transacional compatível abaixo
    }

    // Buscar senhas e blocos do dia para alocação no bloco em formação (< 5)
    const [todasSenhas, blocosExistentes] = await Promise.all([
      getSenhas(payload.unidade_id, dataHoje),
      getBlocos(payload.unidade_id, dataHoje)
    ]);

    const senhasMesmoTipo = todasSenhas.filter(s => s.prioridade_tipo === prioridadeFinal);
    const proximoSequencial = senhasMesmoTipo.length + 1;

    let prefixo = 'N';
    if (prioridadeFinal === 'PRIORITARIO') prefixo = 'P';
    else if (prioridadeFinal === 'ESPECIAL') prefixo = 'E';
    const numeroFormatado = `${prefixo}${String(proximoSequencial).padStart(3, '0')}`;

    // Localiza bloco EM_FORMACAO com menos de 5 pacientes
    const contagemPorBloco = new Map<number, AutoSenhaItem[]>();
    todasSenhas.forEach(s => {
      const bNum = s.bloco_numero || 1;
      const arr = contagemPorBloco.get(bNum) || [];
      arr.push(s);
      contagemPorBloco.set(bNum, arr);
    });

    let blocoAtivo = blocosExistentes
      .filter(b => b.status === 'EM_FORMACAO' && (contagemPorBloco.get(b.numero_bloco)?.length ?? b.total_pacientes) < 5)
      .sort((a, b) => a.numero_bloco - b.numero_bloco)[0];

    if (!blocoAtivo) {
      // Inferir próximo bloco livre considerando blocos existentes e senhas
      const maxNumBlocos = blocosExistentes.reduce((m, b) => Math.max(m, b.numero_bloco), 0);
      const maxNumSenhas = todasSenhas.reduce((m, s) => Math.max(m, s.bloco_numero || 0), 0);
      let candidatoNumero = Math.max(1, maxNumBlocos);
      const existenteCandidato = blocosExistentes.find(b => b.numero_bloco === candidatoNumero);
      const itensCandidato = contagemPorBloco.get(candidatoNumero) || [];

      if (existenteCandidato?.status === 'FECHADO' || itensCandidato.length >= 5) {
        candidatoNumero = Math.max(maxNumBlocos, maxNumSenhas) + 1;
      } else if (maxNumSenhas > candidatoNumero) {
        candidatoNumero = (contagemPorBloco.get(maxNumSenhas)?.length || 0) >= 5 ? maxNumSenhas + 1 : maxNumSenhas;
      }

      blocoAtivo = {
        id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `blk-${Date.now()}-${candidatoNumero}`,
        unidade_id: payload.unidade_id,
        data_operacional: dataHoje,
        numero_bloco: candidatoNumero,
        status: 'EM_FORMACAO',
        total_pacientes: (contagemPorBloco.get(candidatoNumero) || []).length,
        created_at: agora
      };
    }

    let novaSenha: AutoSenhaItem = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `snh-${Date.now()}-${proximoSequencial}`,
      unidade_id: payload.unidade_id,
      numero: numeroFormatado,
      numero_sequencial: proximoSequencial,
      data_operacional: dataHoje,
      paciente_id: payload.paciente_id,
      paciente_cpf: payload.paciente_cpf,
      paciente_cartao_sus: payload.paciente_cartao_sus,
      cidadao_nome: payload.cidadao_nome.trim(),
      prioridade_tipo: prioridadeFinal,
      prioridade_categoria: payload.prioridade_categoria || (prioridadeFinal === 'NORMAL' ? 'Geral' : undefined),
      status: 'AGUARDANDO',
      bloco_id: blocoAtivo.id,
      bloco_numero: blocoAtivo.numero_bloco,
      bloco_status: 'EM_FORMACAO',
      posicao_bloco: (contagemPorBloco.get(blocoAtivo.numero_bloco)?.length || 0) + 1,
      posicao_provisoria: true,
      guiche: payload.guiche || 'Recepção',
      atendente_id: payload.atendente_id,
      atendente_nome: payload.atendente_nome || 'Atendente',
      created_at: agora,
      call_count: 0
    };

    const membrosAntes = contagemPorBloco.get(blocoAtivo.numero_bloco) || [];
    const { itensAtualizados, fechou } = reorganizarItensNoBloco5([...membrosAntes, novaSenha], 'EM_FORMACAO');
    const novaReorganizada = itensAtualizados.find(i => i.id === novaSenha.id) || novaSenha;
    novaSenha = novaReorganizada;

    const blocoAtualizado: AutoSenhaBloco = {
      ...blocoAtivo,
      total_pacientes: itensAtualizados.length,
      status: fechou ? 'FECHADO' : 'EM_FORMACAO',
      closed_at: fechou ? agora : undefined
    };

    // Ao fechar bloco com 5 pacientes, criar automaticamente o próximo bloco vazio em formação
    const proximoBlocoAuto: AutoSenhaBloco | null = fechou
      ? {
          id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `blk-${Date.now()}-${blocoAtivo.numero_bloco + 1}`,
          unidade_id: payload.unidade_id,
          data_operacional: dataHoje,
          numero_bloco: blocoAtivo.numero_bloco + 1,
          status: 'EM_FORMACAO',
          total_pacientes: 0,
          created_at: agora
        }
      : null;

    // Persistir bloco no Supabase (se tabela existir) e localStorage
    const locaisBlocos = getLocalBlocos();
    const salvarBlocoLocal = (blk: AutoSenhaBloco) => {
      const idx = locaisBlocos.findIndex(
        b => b.unidade_id === blk.unidade_id && b.data_operacional === blk.data_operacional && b.numero_bloco === blk.numero_bloco
      );
      if (idx >= 0) locaisBlocos[idx] = blk;
      else locaisBlocos.push(blk);
    };
    salvarBlocoLocal(blocoAtualizado);
    if (proximoBlocoAuto) salvarBlocoLocal(proximoBlocoAuto);
    saveLocalBlocos(locaisBlocos);

    try {
      const { data: blkRow, error: blkErr } = await supabase
        .from('autosenha_blocos')
        .upsert(blocoAtualizado, { onConflict: 'unidade_id,data_operacional,numero_bloco' })
        .select()
        .single();
      if (!blkErr && blkRow?.id) {
        novaSenha.bloco_id = blkRow.id;
        itensAtualizados.forEach(it => {
          it.bloco_id = blkRow.id;
        });
      }
      if (proximoBlocoAuto) {
        await supabase
          .from('autosenha_blocos')
          .upsert(proximoBlocoAuto, { onConflict: 'unidade_id,data_operacional,numero_bloco' });
      }
    } catch {
      // Fallback local preservado
    }

    // Atualizar cache local das senhas do bloco + nova senha
    const localList = getLocalSenhas().filter(s => !itensAtualizados.some(u => u.id === s.id));
    localList.unshift(...itensAtualizados);
    saveLocalSenhas(localList);

    // Inserir nova senha no Supabase e sincronizar posições reorganizadas dos membros do bloco
    try {
      const { data, error } = await supabase
        .from('autosenha_senhas')
        .insert([novaSenha])
        .select()
        .single();

      if (!error && data) {
        novaSenha.id = data.id;
      }

      // Atualiza posição consolidada / provisória dos demais membros do mesmo bloco
      await Promise.allSettled(
        itensAtualizados
          .filter(it => it.id !== novaSenha.id)
          .map(it =>
            supabase
              .from('autosenha_senhas')
              .update({
                bloco_id: it.bloco_id,
                bloco_numero: it.bloco_numero,
                bloco_status: it.bloco_status,
                posicao_bloco: it.posicao_bloco,
                posicao_provisoria: it.posicao_provisoria
              })
              .eq('id', it.id)
          )
      );
    } catch (e) {
      console.warn('[AutoSenha] Supabase insert fallback para local:', e);
    }

    await registrarAuditoria(
      payload.unidade_id,
      'EMISSAO',
      `Senha ${novaSenha.numero} emitida para ${novaSenha.cidadao_nome} (${novaSenha.prioridade_tipo}) — Bloco ${novaSenha.bloco_numero}, Posição ${novaSenha.posicao_bloco}${fechou ? ' [Bloco Fechado]' : ' [Provisória]'}`,
      { senha: novaSenha, bloco: blocoAtualizado, fechou },
      payload.atendente_nome || 'Atendente',
      payload.atendente_id,
      novaSenha.id,
      novaSenha.numero
    );

    if (fechou) {
      await registrarAuditoria(
        payload.unidade_id,
        'BLOCO_FECHADO',
        `Bloco #${blocoAtualizado.numero_bloco} consolidado e fechado com 5 pacientes; Bloco #${blocoAtualizado.numero_bloco + 1} criado.`,
        { blocoFechado: blocoAtualizado, proximoBloco: proximoBlocoAuto },
        'Sistema de Blocos'
      );
    }

    notificarRealtimeMudanca(payload.unidade_id, 'senha_emitida', { senha: novaSenha, fechou });
    notificarRealtimeMudanca(payload.unidade_id, 'bloco_atualizado', { bloco: blocoAtualizado });
    return novaSenha;
  });
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
  bloco_numero: number;
  bloco_status: AutoSenhaBlocoStatus;
  posicao_no_bloco: number;
  slot_referencia: AutoSenhaPrioridadeTipo;
  posicao_provisoria: boolean;
}

export interface BlocoFilaVisualizado {
  numero_bloco: number;
  status: AutoSenhaBlocoStatus;
  total_pacientes: number;
  closed_at?: string;
  itens: AutoSenhaFilaBlocoItem[];
}

/**
 * Monta todos os blocos de 5 do dia (fechados e em formação), preservando
 * posições consolidadas dos blocos fechados e reorganizando blocos em formação
 * pela sequência Especial -> Prioritário -> Especial -> Prioritário -> Normal.
 */
export function getBlocosFilaDoDia(
  senhasDia: AutoSenhaItem[],
  blocosPersistidos?: AutoSenhaBloco[]
): BlocoFilaVisualizado[] {
  const ordenadasCrono = [...senhasDia].sort(porOrdemChegadaSenha);
  const grupos = new Map<number, AutoSenhaItem[]>();

  // Agrupa por bloco_numero explícito ou particiona em blocos de 5 para registros legados
  const semBloco: AutoSenhaItem[] = [];
  ordenadasCrono.forEach(s => {
    if (s.bloco_numero && s.bloco_numero >= 1) {
      const arr = grupos.get(s.bloco_numero) || [];
      arr.push(s);
      grupos.set(s.bloco_numero, arr);
    } else {
      semBloco.push(s);
    }
  });

  if (semBloco.length > 0) {
    let nextBlk = grupos.size > 0 ? Math.max(...Array.from(grupos.keys())) + 1 : 1;
    for (let i = 0; i < semBloco.length; i += 5) {
      grupos.set(nextBlk++, semBloco.slice(i, i + 5));
    }
  }

  // Inclui blocos vazios recém-criados existentes em blocosPersistidos
  (blocosPersistidos || []).forEach(b => {
    if (!grupos.has(b.numero_bloco)) {
      grupos.set(b.numero_bloco, []);
    }
  });

  const numerosOrdenados = Array.from(grupos.keys()).sort((a, b) => a - b);
  let posGlobal = 1;
  const resultado: BlocoFilaVisualizado[] = [];

  for (const numBloco of numerosOrdenados) {
    const membros = grupos.get(numBloco) || [];
    const blkMeta = blocosPersistidos?.find(b => b.numero_bloco === numBloco);
    const blocoFechado =
      blkMeta?.status === 'FECHADO' ||
      membros.length >= 5 ||
      membros.some(m => m.bloco_status === 'FECHADO');

    const { itensAtualizados } = reorganizarItensNoBloco5(
      membros,
      blocoFechado ? 'FECHADO' : 'EM_FORMACAO'
    );

    const statusBloco: AutoSenhaBlocoStatus = blocoFechado ? 'FECHADO' : 'EM_FORMACAO';
    const visualItens: AutoSenhaFilaBlocoItem[] = itensAtualizados.map((s, idx) => {
      const posNoBloco = s.posicao_bloco || idx + 1;
      const slotRef = SEQUENCIA_BLOCO_5[Math.min(Math.max(posNoBloco - 1, 0), 4)];
      const globalAtual = s.status === 'AGUARDANDO' ? posGlobal++ : 0;
      return {
        senha: {
          ...s,
          bloco_numero: numBloco,
          bloco_status: statusBloco,
          posicao_bloco: posNoBloco,
          posicao_provisoria: !blocoFechado
        },
        bloco_numero: numBloco,
        bloco_status: statusBloco,
        posicao_no_bloco: posNoBloco,
        posicao_global: globalAtual,
        slot_referencia: slotRef,
        posicao_provisoria: !blocoFechado
      };
    });

    resultado.push({
      numero_bloco: numBloco,
      status: statusBloco,
      total_pacientes: visualItens.length,
      closed_at: blkMeta?.closed_at,
      itens: visualItens
    });
  }

  return resultado;
}

/**
 * Retorna os cidadãos aguardando ('AGUARDANDO') na ordem exata em que serão chamados
 * pela unidade seguindo a Fila Inteligente por Blocos de 5.
 */
export function getFilaAtualOrdenada(
  senhas: AutoSenhaItem[],
  _config?: AutoSenhaConfiguracao | null,
  blocosPersistidos?: AutoSenhaBloco[]
): FilaAtualOrdenadaItem[] {
  const blocos = getBlocosFilaDoDia(senhas, blocosPersistidos);
  const ordenadosAguardando: FilaAtualOrdenadaItem[] = [];
  let posGlobal = 1;

  for (const bloco of blocos) {
    for (const item of bloco.itens) {
      if (item.senha.status === 'AGUARDANDO') {
        ordenadosAguardando.push({
          senha: item.senha,
          posicao: posGlobal++,
          bloco_numero: item.bloco_numero,
          bloco_status: item.bloco_status,
          posicao_no_bloco: item.posicao_no_bloco,
          slot_referencia: item.slot_referencia,
          posicao_provisoria: item.posicao_provisoria
        });
      }
    }
  }

  return ordenadosAguardando;
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
// CHAMADA TRANSACIONAL POR BLOCOS DE 5 (ANTI-DUPLICIDADE ENTRE GUICHÊS)
// ----------------------------------------------------------------------
export async function chamarProximo(
  unidadeId: AutoSenhaUnidadeId,
  guiche = 'Recepção',
  operadorNome = 'Atendente',
  operadorId?: string
): Promise<{ senhaChamada: AutoSenhaItem | null; mensagem?: string }> {
  assertCanAccessAutoSenhaUnidade(unidadeId, 'operacional');
  const dataHoje = getDataOperacionalHoje();

  return withUnidadeMutex(`chamada_${unidadeId}_${dataHoje}`, async () => {
    // 1. Tenta chamada atômica direta no PostgreSQL via RPC (SELECT ... FOR UPDATE SKIP LOCKED)
    try {
      if (typeof (supabase as any).rpc === 'function') {
        const { data: rpcChamada, error: rpcErr } = await (supabase as any).rpc('chamar_proxima_senha_autosenha', {
          p_unidade_id: unidadeId,
          p_guiche: guiche,
          p_operador_id: operadorId || null,
          p_operador_nome: operadorNome
        });

        if (!rpcErr) {
          if (!rpcChamada) {
            return { senhaChamada: null, mensagem: 'Não há cidadãos aguardando na fila desta unidade.' };
          }
          const senhaChamada = rpcChamada as AutoSenhaItem;
          const locais = getLocalSenhas();
          const idx = locais.findIndex(s => s.id === senhaChamada.id);
          if (idx !== -1) locais[idx] = senhaChamada;
          else locais.unshift(senhaChamada);
          saveLocalSenhas(locais);

          notificarRealtimeMudanca(unidadeId, 'senha_chamada', { senha: senhaChamada, guiche });
          return { senhaChamada };
        }
      }
    } catch {
      // Fallback transacional com update otimista condicional abaixo
    }

    // 2. Fallback seguro por blocos de 5 + trava condicional otimista no status = AGUARDANDO
    const [senhasHoje, blocosHoje, config] = await Promise.all([
      getSenhas(unidadeId, dataHoje),
      getBlocos(unidadeId, dataHoje),
      getConfiguracao(unidadeId)
    ]);

    const filaOrdenada = getFilaAtualOrdenada(senhasHoje, config, blocosHoje);
    if (filaOrdenada.length === 0) {
      return { senhaChamada: null, mensagem: 'Não há cidadãos aguardando na fila desta unidade.' };
    }

    let escolhida: AutoSenhaItem | null = null;
    const agora = new Date().toISOString();

    for (const itemFila of filaOrdenada) {
      const candidata = { ...itemFila.senha };
      const criacaoMs = new Date(candidata.created_at).getTime();
      const chamadaMs = new Date(agora).getTime();
      const waitFirst = candidata.wait_time_first_call_seconds ?? Math.max(0, Math.floor((chamadaMs - criacaoMs) / 1000));
      const nextCallCount = (candidata.call_count || 0) + 1;
      const firstCalled = candidata.first_called_at || agora;

      try {
        const { data: updatedRows, error: updErr } = await supabase
          .from('autosenha_senhas')
          .update({
            status: 'CHAMANDO',
            guiche,
            atendente_id: operadorId,
            atendente_nome: operadorNome,
            first_called_at: firstCalled,
            last_called_at: agora,
            call_count: nextCallCount,
            wait_time_first_call_seconds: waitFirst
          })
          .eq('id', candidata.id)
          .eq('status', 'AGUARDANDO')
          .select();

        if (!updErr && Array.isArray(updatedRows)) {
          if (updatedRows.length === 0) {
            // Outro guichê chamou esta senha exatamente antes — avança para o próximo da fila
            continue;
          }
          escolhida = updatedRows[0] as AutoSenhaItem;
          break;
        }
      } catch {
        // Segue para fallback local abaixo
      }

      // Ambiente offline sem Supabase disponível: confirma em memória local que segue AGUARDANDO
      const locaisAtual = getLocalSenhas();
      const atualLocal = locaisAtual.find(s => s.id === candidata.id);
      if (atualLocal && atualLocal.status !== 'AGUARDANDO') {
        continue;
      }

      candidata.status = 'CHAMANDO';
      candidata.guiche = guiche;
      candidata.atendente_id = operadorId;
      candidata.atendente_nome = operadorNome;
      candidata.first_called_at = firstCalled;
      candidata.last_called_at = agora;
      candidata.call_count = nextCallCount;
      candidata.wait_time_first_call_seconds = waitFirst;
      escolhida = candidata;
      break;
    }

    if (!escolhida) {
      return { senhaChamada: null, mensagem: 'Não há cidadãos aguardando na fila desta unidade.' };
    }

    // Atualiza cache local
    const locais = getLocalSenhas();
    const idx = locais.findIndex(s => s.id === escolhida!.id);
    if (idx !== -1) locais[idx] = escolhida;
    else locais.unshift(escolhida);
    saveLocalSenhas(locais);

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
    } catch {}

    await registrarAuditoria(
      unidadeId,
      'CHAMADA',
      `Senha ${escolhida.numero} chamada no ${guiche} por ${operadorNome} [Bloco ${escolhida.bloco_numero || 1} • Posição ${escolhida.posicao_bloco || '-'}]`,
      { senha: escolhida, guiche },
      operadorNome,
      operadorId,
      escolhida.id,
      escolhida.numero
    );

    notificarRealtimeMudanca(unidadeId, 'senha_chamada', { senha: escolhida, guiche });
    return { senhaChamada: escolhida };
  });
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
// FLUXO INTEGRADO — SOLICITAR AVALIAÇÃO IMEDIATA (FORA DOS BLOCOS DE 5)
// ----------------------------------------------------------------------
export async function solicitarAvaliacaoImediataUPA(
  cidadaoNome: string,
  motivoQueixa: string,
  operadorNome: string,
  operadorId?: string,
  senhaId?: string,
  senhaNumero?: string,
  unidadeId: AutoSenhaUnidadeId = 'upa',
  pacienteId?: string,
  pacienteCpf?: string
): Promise<AutoSenhaAvaliacaoUrgente> {
  assertCanAccessAutoSenhaUnidade(unidadeId, 'operacional');
  const agora = new Date().toISOString();
  const avaliacao: AutoSenhaAvaliacaoUrgente = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `urg-${Date.now()}`,
    unidade_id: unidadeId,
    senha_id: senhaId,
    senha_numero: senhaNumero,
    paciente_id: pacienteId,
    paciente_cpf: pacienteCpf,
    cidadao_nome: cidadaoNome.trim(),
    motivo_queixa: motivoQueixa.trim(),
    status: 'ENCAMINHADO_PRESENCIAL',
    solicitante_id: operadorId,
    solicitante_nome: operadorNome,
    created_at: agora,
    encaminhado_em: agora
  };

  const lista = getLocalUrgentes();
  lista.unshift(avaliacao);
  saveLocalUrgentes(lista);

  try {
    const { data, error } = await supabase
      .from('autosenha_avaliacoes_urgentes')
      .insert([avaliacao])
      .select()
      .single();
    if (!error && data) {
      avaliacao.id = data.id;
    }
  } catch (e) {}

  await registrarAuditoria(
    unidadeId,
    unidadeId === 'upa' ? 'AVALIACAO_URGENTE_UPA' : `AVALIACAO_URGENTE_${unidadeId.toUpperCase()}`,
    `ALERTA ASSISTENCIAL ${unidadeId.toUpperCase()}: Solicitação de avaliação imediata fora da fila para ${cidadaoNome}. Motivo: ${motivoQueixa}`,
    avaliacao,
    operadorNome,
    operadorId,
    senhaId,
    senhaNumero
  );

  notificarRealtimeMudanca(unidadeId, 'alerta_urgencia_clinica', { avaliacao });
  return avaliacao;
}

/**
 * Lista todas as solicitações de Avaliação Imediata da unidade (preservando ordem cronológica,
 * sem impor ordenação clínica automática entre casos simultâneos).
 */
export async function getAvaliacoesImediatasUnidade(
  unidadeId: AutoSenhaUnidadeId,
  incluirAtendidas = true
): Promise<AutoSenhaAvaliacaoUrgente[]> {
  assertCanAccessAutoSenhaUnidade(unidadeId, 'operacional');

  try {
    let query = supabase
      .from('autosenha_avaliacoes_urgentes')
      .select('*')
      .eq('unidade_id', unidadeId);

    if (!incluirAtendidas) {
      query = query.neq('status', 'ATENDIDO');
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (!error && Array.isArray(data)) {
      const lista = data as AutoSenhaAvaliacaoUrgente[];
      const outros = getLocalUrgentes().filter(u => u.unidade_id !== unidadeId);
      saveLocalUrgentes([...lista, ...outros]);
      return lista;
    }
  } catch {
    // fallback local abaixo
  }

  let locais = getLocalUrgentes().filter(u => u.unidade_id === unidadeId);
  if (!incluirAtendidas) {
    locais = locais.filter(u => u.status !== 'ATENDIDO');
  }
  return locais.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

/**
 * Registra o acolhimento presencial de uma Avaliação Imediata sem interferir na fila convencional de blocos.
 */
export async function marcarAcolhimentoAvaliacaoImediata(
  avaliacaoId: string,
  responsavelNome: string,
  expectedUnidadeId?: AutoSenhaUnidadeId,
  observacoes?: string
): Promise<AutoSenhaAvaliacaoUrgente | null> {
  const locais = getLocalUrgentes();
  let alvo = locais.find(u => u.id === avaliacaoId);

  if (!alvo) {
    try {
      const { data, error } = await supabase
        .from('autosenha_avaliacoes_urgentes')
        .select('*')
        .eq('id', avaliacaoId)
        .maybeSingle();
      if (!error && data) {
        alvo = data as AutoSenhaAvaliacaoUrgente;
        locais.unshift(alvo);
      }
    } catch {}
  }

  if (!alvo) return null;
  if (expectedUnidadeId && alvo.unidade_id !== expectedUnidadeId) {
    throw new Error(`Acesso negado: avaliação pertence à unidade ${alvo.unidade_id.toUpperCase()}.`);
  }
  assertCanAccessAutoSenhaUnidade(alvo.unidade_id, 'operacional');

  const agora = new Date().toISOString();
  alvo.status = 'ATENDIDO';
  alvo.atendido_em = agora;
  alvo.atendido_por = responsavelNome;
  alvo.observacoes_desfecho = observacoes?.trim() || 'Acolhimento presencial realizado pela equipe assistencial.';
  if (!alvo.encaminhado_em) {
    alvo.encaminhado_em = alvo.created_at;
  }

  saveLocalUrgentes(locais);

  try {
    await supabase
      .from('autosenha_avaliacoes_urgentes')
      .update({
        status: 'ATENDIDO',
        atendido_em: agora,
        atendido_por: responsavelNome,
        observacoes_desfecho: alvo.observacoes_desfecho
      })
      .eq('id', alvo.id);
  } catch {}

  await registrarAuditoria(
    alvo.unidade_id,
    'AVALIACAO_IMEDIATA_ACOLHIDA',
    `Acolhimento presencial de Avaliação Imediata registrado para ${alvo.cidadao_nome} por ${responsavelNome}.`,
    alvo,
    responsavelNome
  );

  notificarRealtimeMudanca(alvo.unidade_id, 'avaliacao_acolhida', { avaliacao: alvo });
  return alvo;
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
        saveLocalBlocos(getLocalBlocos().filter(b => !(b.unidade_id === unidadeId && b.data_operacional === hoje)));
        const cfg = getLocalConfig(unidadeId);
        cfg.contador_prioridade_atual = 0;
        cfg.contador_normal_atual = 0;
        saveLocalConfig(cfg);
      } else {
        localStorage.setItem(STORAGE_SENHAS_KEY, JSON.stringify([]));
        localStorage.setItem(STORAGE_BLOCOS_KEY, JSON.stringify([]));
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
          .from('autosenha_blocos')
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

