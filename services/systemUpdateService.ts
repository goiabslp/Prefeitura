import { supabase } from './supabaseClient';
import { auditLogService } from './auditLogService';
import { User } from '../types';

declare const __LATEST_COMMIT__: string | undefined;

export const APPLIED_SYSTEM_VERSION_KEY = 'system_applied_version';
export const LAST_FORCED_UPDATE_KEY = 'last_forced_update_target';

export interface SystemUpdateInfo {
  target: number;
  triggeredBy: string;
  triggeredAt: string;
  version: string | number;
}

export interface UserUpdateRequest {
  target: number; // execute_at (timestamp epoch em ms)
  version: string | number; // system_version
  targetUserId: string; // target_user_id
  targetUserName: string;
  targetUserUsername?: string;
  triggeredBy: string; // requested_by (nome do administrador)
  triggeredById?: string; // requested_by id
  triggeredAt: string; // requested_at (ISO string)
  notifiedAt?: string; // momento em que o navegador do usuário acusou recebimento
  startedAt?: string; // momento em que o contador começou a rodar
  status: 'pending' | 'notified' | 'in_progress' | 'completed';
  completedAt?: string;
}

/**
 * Traduz e formata mensagens de commit/deploy para PT-BR simples e amigável ao usuário comum
 */
export async function fetchAndTranslateChangelog(rawCommit?: string): Promise<string[]> {
  const commitText = rawCommit || (typeof __LATEST_COMMIT__ !== 'undefined' ? __LATEST_COMMIT__ : '');
  
  if (!commitText || commitText.trim().length === 0) {
    return ['Melhorias e correções do sistema estão sendo aplicadas.'];
  }

  // Divide o commit em linhas ou itens
  const rawLines = commitText
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0 && !l.startsWith('#') && !l.startsWith('Signed-off-by:'));

  if (rawLines.length === 0) {
    return ['Melhorias e correções do sistema estão sendo aplicadas.'];
  }

  // Lista de substituições comuns de termos técnicos em inglês para PT-BR amigável
  const dictionary: Array<[RegExp, string]> = [
    [/^fix(\([^)]+\))?:\s*/i, 'Correção de '],
    [/^feat(\([^)]+\))?:\s*/i, 'Novo recurso: '],
    [/^perf(\([^)]+\))?:\s*/i, 'Melhoria de desempenho em '],
    [/^refactor(\([^)]+\))?:\s*/i, 'Otimização do sistema: '],
    [/^chore(\([^)]+\))?:\s*/i, 'Manutenção preventiva: '],
    [/^style(\([^)]+\))?:\s*/i, 'Aprimoramento visual em '],
    [/^docs(\([^)]+\))?:\s*/i, 'Atualização de documentação: '],
    [/\bprevent\b/gi, 'evitar'],
    [/\bduplicate notifications\b/gi, 'notificações duplicadas'],
    [/\bnotification\b/gi, 'notificação'],
    [/\bnotifications\b/gi, 'notificações'],
    [/\bimprove\b/gi, 'melhorias em'],
    [/\brealtime\b/gi, 'em tempo real'],
    [/\buser update\b/gi, 'atualização de usuários'],
    [/\buser\b/gi, 'usuário'],
    [/\busers\b/gi, 'usuários'],
    [/\bvehicle\b/gi, 'veículo'],
    [/\bvehicles\b/gi, 'veículos'],
    [/\bschedule\b/gi, 'agendamento'],
    [/\bdashboard\b/gi, 'painel gerencial'],
    [/\bpermission\b/gi, 'permissão'],
    [/\bpermissions\b/gi, 'permissões'],
    [/\brole\b/gi, 'perfil'],
    [/\baccess\b/gi, 'acesso'],
    [/\bsession\b/gi, 'sessão'],
    [/\bsimulation\b/gi, 'simulação assistida'],
    [/\bcursor\b/gi, 'cursor'],
    [/\bflicker\b/gi, 'oscilações'],
    [/\binput\b/gi, 'campo'],
    [/\binputs\b/gi, 'campos e formulários'],
    [/\bloading\b/gi, 'carregamento'],
    [/\bperformance\b/gi, 'desempenho'],
    [/\bsecurity\b/gi, 'segurança'],
    [/\bcleanup\b/gi, 'limpeza'],
    [/\bcache\b/gi, 'cache e dados locais'],
    [/\bmodal\b/gi, 'janela'],
    [/\brouting\b/gi, 'navegação de telas'],
    [/\broute\b/gi, 'tela'],
    [/\bbutton\b/gi, 'botão']
  ];

  const processedItems: string[] = [];

  for (const rawLine of rawLines) {
    let cleanLine = rawLine
      .replace(/^[-*•]\s*/, '') // Remove marcadores de lista
      .replace(/\b([a-f0-9]{7,40})\b/gi, '') // Remove hashes de commit
      .replace(/\(#\d+\)/g, '') // Remove referências a PRs (#123)
      .trim();

    if (!cleanLine || cleanLine.length < 3) continue;

    // Tenta traduzir via API ou dicionário
    let translatedLine = cleanLine;

    // Aplica regras de prefixo e dicionário
    for (const [pattern, replacement] of dictionary) {
      translatedLine = translatedLine.replace(pattern, replacement);
    }

    // Se a linha ainda contiver trecho significativo em inglês e tivermos internet, tenta traduzir
    const containsEnglishKeywords = /\b(and|with|for|to|from|by|on|in|of|the|a|an|is|are|was|were|fix|fixed|fixing|add|added|adding|update|updated|updating|remove|removed|removing|clean|cleaner|prevent|prevented|preventing)\b/i.test(translatedLine);

    if (containsEnglishKeywords) {
      try {
        const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=pt&dt=t&q=${encodeURIComponent(cleanLine)}`);
        if (res.ok) {
          const data = await res.json();
          const googleTranslated = data[0].map((item: any) => item[0]).join('').trim();
          if (googleTranslated && googleTranslated.length > 2) {
            translatedLine = googleTranslated.charAt(0).toUpperCase() + googleTranslated.slice(1);
          }
        }
      } catch (e) {
        // Fallback silencioso
      }
    }

    // Limpa pontuações no final e normaliza
    translatedLine = translatedLine.replace(/[.;,]+$/, '').trim();
    if (translatedLine) {
      translatedLine = translatedLine.charAt(0).toUpperCase() + translatedLine.slice(1);
      processedItems.push(translatedLine);
    }
  }

  if (processedItems.length === 0) {
    return ['Melhorias e correções do sistema estão sendo aplicadas.'];
  }

  return processedItems.slice(0, 5);
}

/**
 * Função utilitária resiliente para envio de mensagens via Supabase Realtime Broadcast
 */
export const sendRealtimeBroadcast = async (channelName: string, event: string, payload: any): Promise<boolean> => {
  return new Promise((resolve) => {
    try {
      const channel = supabase.channel(channelName, {
        config: { broadcast: { self: true } }
      });

      let resolved = false;
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve(false);
        }
      }, 3500);

      const doSend = async () => {
        try {
          await channel.send({
            type: 'broadcast',
            event,
            payload
          });
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            resolve(true);
          }
        } catch (e) {
          console.warn(`[SystemUpdate] Falha ao enviar broadcast em ${channelName}:`, e);
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            resolve(false);
          }
        }
      };

      if ((channel as any).state === 'joined' || (channel as any).status === 'SUBSCRIBED') {
        doSend();
      } else {
        channel.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            doSend();
          }
        });
      }
    } catch (err) {
      console.warn(`[SystemUpdate] Erro ao criar canal para broadcast (${channelName}):`, err);
      resolve(false);
    }
  });
};

/**
 * Executa a limpeza restrita de dados locais e caches controlados da aplicação:
 * - Cache Storage da aplicação
 * - Service Worker registrations
 * - sessionStorage da aplicação
 * - Chaves de cache da aplicação no localStorage
 * - Grava a versão aplicada para evitar loops infinitos
 */
export const performClientCleanup = async (newVersion?: number | string): Promise<void> => {
  try {
    const versionToSave = String(newVersion || Date.now());

    // Preservar credenciais salvas se o usuário marcou "lembrar de mim"
    const savedUser = localStorage.getItem('remember_user');
    const savedPass = localStorage.getItem('remember_pass');

    // 1. Limpeza do Cache Storage da aplicação
    if (typeof window !== 'undefined' && 'caches' in window) {
      try {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      } catch (err) {
        console.warn('[SystemUpdate] Erro ao limpar Cache Storage:', err);
      }
    }

    // 2. Desregistrar e atualizar Service Workers
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.unregister();
        }
      } catch (err) {
        console.warn('[SystemUpdate] Erro ao desregistrar Service Worker:', err);
      }
    }

    // 3. Limpar Session Storage
    try {
      sessionStorage.clear();
    } catch (err) {
      console.warn('[SystemUpdate] Erro ao limpar sessionStorage:', err);
    }

    // 4. Limpeza controlada do Local Storage (dados temporários da aplicação)
    try {
      const appCacheKeys = [
        'cachedPersons',
        'cachedVehicles',
        'cachedGasStations',
        'cachedFuelTypes',
        'diarias_draft_data',
        'oficio_draft_data',
        'compras_draft_data',
        'prefeitura_offline_sync_queue',
        'consultas_analytics_cache',
        'cached_theme_data'
      ];

      appCacheKeys.forEach(k => localStorage.removeItem(k));

      // Limpa todas as chaves dinâmicas de rascunhos e caches de requisições
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('cache_') || key.startsWith('draft_') || key.startsWith('temp_'))) {
          localStorage.removeItem(key);
        }
      }

      // 5. Registra versão aplicada para evitar loops
      localStorage.setItem(APPLIED_SYSTEM_VERSION_KEY, versionToSave);
      localStorage.setItem(LAST_FORCED_UPDATE_KEY, versionToSave);

      if (savedUser) localStorage.setItem('remember_user', savedUser);
      if (savedPass) localStorage.setItem('remember_pass', savedPass);
    } catch (err) {
      console.warn('[SystemUpdate] Erro ao limpar localStorage:', err);
    }

    // 6. Limpar cache de logs de auditoria
    try {
      auditLogService.clearCache();
    } catch (err) {
      console.warn('[SystemUpdate] Erro ao limpar auditLogService:', err);
    }
  } catch (globalErr) {
    console.error('[SystemUpdate] Erro durante a rotina de limpeza:', globalErr);
  }
};

/**
 * Dispara a Atualização Global do Sistema (Exclusivo para Administrador)
 */
export const triggerGlobalSystemUpdate = async (adminUser: { id?: string; name?: string; role?: string }): Promise<{ success: boolean; target: number; error?: string }> => {
  if (adminUser.role !== 'admin') {
    return { success: false, target: 0, error: 'Acesso negado: Somente administradores podem atualizar o sistema.' };
  }

  const targetEpoch = Date.now() + 60000; // 60 segundos
  const adminName = adminUser.name || 'Administrador';
  const adminId = adminUser.id || 'admin';
  const nowIso = new Date().toISOString();

  try {
    // 1. Broadcast instantâneo via Realtime
    await sendRealtimeBroadcast('global-updates', 'system_update', {
      target: targetEpoch,
      version: targetEpoch,
      triggeredBy: adminName,
      triggeredAt: nowIso
    });

    // 2. Persistência no Backend (organization_settings)
    const { data: existingSettings } = await supabase
      .from('organization_settings')
      .select('ui_config')
      .eq('id', 'global_config')
      .single();

    const updatedUiConfig = {
      ...(existingSettings?.ui_config || {}),
      system_update_target: targetEpoch,
      system_force_update_version: targetEpoch,
      system_update_by_name: adminName,
      system_update_by_id: adminId,
      system_update_at: nowIso
    };

    const { error: dbError } = await supabase
      .from('organization_settings')
      .update({
        system_update_target: targetEpoch,
        ui_config: updatedUiConfig,
        updated_at: nowIso
      })
      .eq('id', 'global_config');

    if (dbError) {
      console.error('[SystemUpdate] Erro ao salvar no banco:', dbError);
      return { success: false, target: targetEpoch, error: dbError.message };
    }

    // 3. Registro no Log de Auditoria
    await auditLogService.logAction({
      action_type: 'system_update',
      module: 'admin',
      description: `Atualização Global do Sistema disparada por ${adminName}. Versão: ${targetEpoch}. Alvo: ${nowIso}`
    });

    return { success: true, target: targetEpoch };
  } catch (err: any) {
    console.error('[SystemUpdate] Falha geral ao iniciar atualização:', err);
    return { success: false, target: targetEpoch, error: err.message || 'Erro desconhecido' };
  }
};

/**
 * Dispara a Atualização Individual por Usuário (Exclusivo para Administrador)
 */
export const triggerUserSystemUpdate = async (
  adminUser: { id?: string; name?: string; role?: string },
  targetUser: { id: string; name: string; username?: string }
): Promise<{ success: boolean; target: number; error?: string }> => {
  if (adminUser.role !== 'admin') {
    return { success: false, target: 0, error: 'Acesso negado: Somente administradores podem atualizar usuários.' };
  }

  // Contagem regressiva imediata de 10 segundos
  const targetEpoch = Date.now() + 10000; // 10 segundos
  const adminName = adminUser.name || 'Administrador';
  const adminId = adminUser.id || 'admin';
  const nowIso = new Date().toISOString();

  try {
    const payload = {
      target: targetEpoch,
      version: targetEpoch,
      countdownSeconds: 10,
      isIndividualUserUpdate: true,
      targetUserId: targetUser.id,
      targetUserName: targetUser.name,
      targetUserUsername: targetUser.username,
      triggeredBy: adminName,
      triggeredById: adminId,
      triggeredAt: nowIso
    };

    // 1. Broadcast instantâneo via Realtime no canal dedicado do usuário E no canal global
    await Promise.all([
      sendRealtimeBroadcast(`user-channel-${targetUser.id}`, 'system_update', payload),
      sendRealtimeBroadcast('global-updates', 'system_update', payload)
    ]);

    // 2. Persistência no Backend (organization_settings -> ui_config.user_update_requests)
    const { data: existingSettings } = await supabase
      .from('organization_settings')
      .select('ui_config')
      .eq('id', 'global_config')
      .single();

    const existingUiConfig = existingSettings?.ui_config || {};
    const existingRequests: Record<string, UserUpdateRequest> = existingUiConfig.user_update_requests || {};

    const newRequest: UserUpdateRequest = {
      target: targetEpoch,
      version: targetEpoch,
      targetUserId: targetUser.id,
      targetUserName: targetUser.name,
      targetUserUsername: targetUser.username,
      triggeredBy: adminName,
      triggeredById: adminId,
      triggeredAt: nowIso,
      status: 'pending'
    };

    const updatedUiConfig = {
      ...existingUiConfig,
      user_update_requests: {
        ...existingRequests,
        [targetUser.id]: newRequest
      }
    };

    const { error: dbError } = await supabase
      .from('organization_settings')
      .update({
        ui_config: updatedUiConfig,
        updated_at: nowIso
      })
      .eq('id', 'global_config');

    if (dbError) {
      console.error('[SystemUpdate] Erro ao salvar solicitação individual no banco:', dbError);
      return { success: false, target: targetEpoch, error: dbError.message };
    }

    // 3. Registro no Log de Auditoria
    await auditLogService.logAction({
      action_type: 'system_update_user',
      module: 'admin',
      description: `Atualização de Sistema solicitada para o usuário "${targetUser.name}" (@${targetUser.username || targetUser.id}) por ${adminName}. Versão: ${targetEpoch}.`,
      details: {
        admin_id: adminId,
        admin_name: adminName,
        target_user_id: targetUser.id,
        target_user_name: targetUser.name,
        target_username: targetUser.username,
        version: targetEpoch,
        status: 'pending',
        triggered_at: nowIso
      }
    });

    return { success: true, target: targetEpoch };
  } catch (err: any) {
    console.error('[SystemUpdate] Falha ao iniciar atualização individual:', err);
    return { success: false, target: targetEpoch, error: err.message || 'Erro desconhecido' };
  }
};

/**
 * Obtém o mapa de solicitações de atualização individual por usuário
 */
export const getUserUpdateRequests = async (): Promise<Record<string, UserUpdateRequest>> => {
  try {
    const { data, error } = await supabase
      .from('organization_settings')
      .select('ui_config')
      .eq('id', 'global_config')
      .single();

    if (error || !data) return {};
    return data.ui_config?.user_update_requests || {};
  } catch (err) {
    console.warn('[SystemUpdate] Erro ao carregar solicitações de atualização de usuários:', err);
    return {};
  }
};

/**
 * Confirma recebimento ou início de contagem do usuário e sincroniza com o Admin em tempo real
 */
export const acknowledgeUserUpdate = async (
  userId: string,
  version: number | string,
  status: 'notified' | 'in_progress'
): Promise<boolean> => {
  if (!userId) return false;
  const nowIso = new Date().toISOString();

  try {
    // 1. Broadcast instantâneo de status para atualizar o Admin sem esperar banco
    await Promise.all([
      sendRealtimeBroadcast('global-updates', 'user_update_status', {
        targetUserId: userId,
        status,
        timestamp: nowIso
      }),
      sendRealtimeBroadcast(`user-channel-${userId}`, 'user_update_status', {
        targetUserId: userId,
        status,
        timestamp: nowIso
      })
    ]);

    // 2. Persiste status no banco de dados
    const { data: existingSettings } = await supabase
      .from('organization_settings')
      .select('ui_config')
      .eq('id', 'global_config')
      .single();

    const existingUiConfig = existingSettings?.ui_config || {};
    const existingRequests: Record<string, UserUpdateRequest> = existingUiConfig.user_update_requests || {};

    if (existingRequests[userId]) {
      existingRequests[userId] = {
        ...existingRequests[userId],
        status,
        ...(status === 'notified' ? { notifiedAt: nowIso } : {}),
        ...(status === 'in_progress' ? { startedAt: nowIso } : {})
      };

      await supabase
        .from('organization_settings')
        .update({
          ui_config: {
            ...existingUiConfig,
            user_update_requests: existingRequests
          },
          updated_at: nowIso
        })
        .eq('id', 'global_config');
    }

    return true;
  } catch (e) {
    console.warn('[SystemUpdate] Erro ao registrar confirmação de atualização do usuário:', e);
    return false;
  }
};

/**
 * Marca uma atualização individual de usuário como concluída
 */
export const markUserUpdateCompleted = async (userId: string, version?: number | string): Promise<boolean> => {
  if (!userId) return false;
  const nowIso = new Date().toISOString();

  try {
    // 1. Notifica o Admin em tempo real
    await Promise.all([
      sendRealtimeBroadcast('global-updates', 'user_update_status', {
        targetUserId: userId,
        status: 'completed',
        timestamp: nowIso
      }),
      sendRealtimeBroadcast(`user-channel-${userId}`, 'user_update_status', {
        targetUserId: userId,
        status: 'completed',
        timestamp: nowIso
      })
    ]);

    // 2. Grava no banco de dados
    const { data: existingSettings } = await supabase
      .from('organization_settings')
      .select('ui_config')
      .eq('id', 'global_config')
      .single();

    const existingUiConfig = existingSettings?.ui_config || {};
    const existingRequests: Record<string, UserUpdateRequest> = existingUiConfig.user_update_requests || {};

    if (!existingRequests[userId]) {
      existingRequests[userId] = {
        target: Date.now(),
        version: version || Date.now(),
        targetUserId: userId,
        targetUserName: 'Usuário',
        triggeredBy: 'Sistema',
        triggeredAt: nowIso,
        status: 'completed',
        completedAt: nowIso
      };
    } else {
      existingRequests[userId] = {
        ...existingRequests[userId],
        status: 'completed',
        completedAt: nowIso
      };
    }

    const updatedUiConfig = {
      ...existingUiConfig,
      user_update_requests: existingRequests
    };

    const { error } = await supabase
      .from('organization_settings')
      .update({
        ui_config: updatedUiConfig,
        updated_at: nowIso
      })
      .eq('id', 'global_config');

    if (!error) {
      await auditLogService.logAction({
        action_type: 'system_update_user_completed',
        module: 'admin',
        description: `Atualização de Sistema individual concluída com sucesso para o usuário ID "${userId}".`,
        details: {
          target_user_id: userId,
          version: version || Date.now(),
          completed_at: nowIso
        }
      });
      return true;
    }
  } catch (err) {
    console.warn('[SystemUpdate] Erro ao marcar atualização como concluída:', err);
  }
  return false;
};

/**
 * Verifica se há atualização individual pendente para o usuário (inclusive offline/boot)
 */
export const checkAndApplyUserOfflineUpdate = async (
  userId: string,
  signOutFn?: () => Promise<void>
): Promise<boolean> => {
  if (!userId) return false;

  try {
    const requests = await getUserUpdateRequests();
    const userReq = requests[userId];

    if (userReq && (userReq.status === 'pending' || userReq.status === 'notified' || userReq.status === 'in_progress')) {
      const now = Date.now();
      // Se o prazo da atualização já passou enquanto o usuário estava offline, apenas marca como concluída sem derrubar a sessão
      if (now >= userReq.target) {
        console.log(`[SystemUpdate] Atualização individual anterior finalizada para o usuário ${userId}. Sincronizando estado silenciosamente...`);
        await markUserUpdateCompleted(userId, userReq.version);
        return false;
      }
    }
  } catch (err) {
    console.warn('[SystemUpdate] Erro ao verificar atualização offline individual:', err);
  }

  return false;
};

/**
 * Verifica se a versão atual do sistema exige atualização offline/boot global
 */
export const checkAndApplyOfflineUpdate = async (
  serverTarget: number | null,
  signOutFn?: () => Promise<void>
): Promise<boolean> => {
  if (!serverTarget) return false;

  const appliedVersion = localStorage.getItem(APPLIED_SYSTEM_VERSION_KEY) || localStorage.getItem(LAST_FORCED_UPDATE_KEY);
  const now = Date.now();

  // Se o servidor exige uma versão e localmente ainda não foi registrada
  if (!appliedVersion || parseInt(appliedVersion, 10) < serverTarget) {
    // Se o alvo já passou, apenas marca como aplicada localmente sem deslogar o usuário
    if (now >= serverTarget) {
      localStorage.setItem(APPLIED_SYSTEM_VERSION_KEY, String(serverTarget));
      localStorage.setItem(LAST_FORCED_UPDATE_KEY, String(serverTarget));
      return false;
    }
  }

  return false;
};
