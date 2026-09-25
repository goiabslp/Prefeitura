import { supabase } from './supabaseClient';
import { auditLogService } from './auditLogService';
import { User } from '../types';

export const APPLIED_SYSTEM_VERSION_KEY = 'system_applied_version';
export const LAST_FORCED_UPDATE_KEY = 'last_forced_update_target';

export interface SystemUpdateInfo {
  target: number;
  triggeredBy: string;
  triggeredAt: string;
  version: string | number;
}

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
      // Lista de chaves a serem limpas
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

export interface UserUpdateRequest {
  target: number;
  version: string | number;
  targetUserId: string;
  targetUserName: string;
  targetUserUsername?: string;
  triggeredBy: string;
  triggeredById?: string;
  triggeredAt: string;
  status: 'pending' | 'completed';
  completedAt?: string;
}

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
    // 1. Broadcast instantâneo via Realtime (com self: true para sincronizar todas as abas e o próprio emissor)
    const channel = supabase.channel('global-updates', {
      config: { broadcast: { self: true } }
    });
    await channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        try {
          await channel.send({
            type: 'broadcast',
            event: 'system_update',
            payload: {
              target: targetEpoch,
              version: targetEpoch,
              triggeredBy: adminName,
              triggeredAt: nowIso
            }
          });
        } catch (bErr) {
          console.warn('[SystemUpdate] Falha no envio do broadcast:', bErr);
        }
      }
    });

    // 2. Persistência no Backend (organization_settings)
    // Busca ui_config existente para mesclar com metadata de atualização
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

  const targetEpoch = Date.now() + 60000; // 60 segundos para oportunidade segura
  const adminName = adminUser.name || 'Administrador';
  const adminId = adminUser.id || 'admin';
  const nowIso = new Date().toISOString();

  try {
    // 1. Broadcast instantâneo via Realtime direcionado ao user_id
    const channel = supabase.channel('global-updates', {
      config: { broadcast: { self: true } }
    });
    await channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        try {
          await channel.send({
            type: 'broadcast',
            event: 'system_update',
            payload: {
              target: targetEpoch,
              version: targetEpoch,
              targetUserId: targetUser.id,
              targetUserName: targetUser.name,
              targetUserUsername: targetUser.username,
              triggeredBy: adminName,
              triggeredById: adminId,
              triggeredAt: nowIso
            }
          });
        } catch (bErr) {
          console.warn('[SystemUpdate] Falha no broadcast de atualização de usuário:', bErr);
        }
      }
    });

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
 * Marca uma atualização individual de usuário como concluída
 */
export const markUserUpdateCompleted = async (userId: string, version?: number | string): Promise<boolean> => {
  if (!userId) return false;
  const nowIso = new Date().toISOString();

  try {
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

    if (userReq && userReq.status === 'pending') {
      console.log(`[SystemUpdate] Atualização individual pendente detectada para o usuário ${userId}. Executando renovação de cache e ambiente...`);
      await performClientCleanup(userReq.version);
      await markUserUpdateCompleted(userId, userReq.version);
      if (signOutFn) {
        try {
          await signOutFn();
        } catch (e) {}
      }
      return true;
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

  // Se o servidor exige uma versão e localmente ainda não foi aplicada
  if (!appliedVersion || parseInt(appliedVersion, 10) < serverTarget) {
    // Se o alvo já passou (atualização que ocorreu quando o usuário estava offline/fechado)
    if (now >= serverTarget) {
      console.log('[SystemUpdate] Versão local desatualizada em relação ao servidor. Executando atualização de ambiente...');
      await performClientCleanup(serverTarget);
      if (signOutFn) {
        try {
          await signOutFn();
        } catch (e) { }
      }
      return true;
    }
  }

  return false;
};
