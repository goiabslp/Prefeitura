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

/**
 * Dispara a Atualização Global do Sistema (Exclusivo para Administrador)
 */
export const triggerGlobalSystemUpdate = async (adminUser: { id?: string; name?: string; role?: string }): Promise<{ success: boolean; target: number; error?: string }> => {
  const targetEpoch = Date.now() + 60000; // 60 segundos
  const adminName = adminUser.name || 'Administrador';
  const adminId = adminUser.id || 'admin';
  const nowIso = new Date().toISOString();

  try {
    // 1. Broadcast instantâneo via Realtime
    const channel = supabase.channel('global-updates');
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
 * Verifica se a versão atual do sistema exige atualização offline/boot
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
