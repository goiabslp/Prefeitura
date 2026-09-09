import { supabase } from './supabaseClient';

// Cache em memória com TTL de 60s para evitar requisições redundantes de 1.6s a organization_settings
let memoryUiConfigCache: any = null;
let lastCacheFetchTime = 0;
const CACHE_TTL_MS = 60000;

async function getCachedUiConfig(forceRefresh = false): Promise<any> {
  const now = Date.now();
  if (!forceRefresh && memoryUiConfigCache && (now - lastCacheFetchTime < CACHE_TTL_MS)) {
    return memoryUiConfigCache;
  }

  try {
    const { data } = await supabase
      .from('organization_settings')
      .select('ui_config')
      .eq('id', 'global_config')
      .single();

    if (data?.ui_config) {
      memoryUiConfigCache = data.ui_config;
      lastCacheFetchTime = now;
      return memoryUiConfigCache;
    }
  } catch (e) {
    console.warn('Erro ao buscar ui_config no Supabase:', e);
  }

  return memoryUiConfigCache || {};
}

export const getDiariasDespesasEnabled = async (): Promise<boolean> => {
  try {
    // 1. Tenta buscar no localStorage primeiro para retorno ultra-rápido (0ms)
    const stored = localStorage.getItem('diarias_despesas_enabled');
    if (stored !== null) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn('Erro ao ler localStorage de despesas:', e);
  }

  try {
    // 2. Busca do cache em memória/Supabase
    const uiConfig = await getCachedUiConfig();
    if (uiConfig && typeof uiConfig.diarias_despesas_enabled === 'boolean') {
      const isEnabled = uiConfig.diarias_despesas_enabled;
      try {
        localStorage.setItem('diarias_despesas_enabled', JSON.stringify(isEnabled));
      } catch {}
      return isEnabled;
    }
  } catch (e) {
    console.warn('Erro ao buscar configuracao de despesas no Supabase:', e);
  }

  // Oculto por padrão
  return false;
};

export const setDiariasDespesasEnabled = async (enabled: boolean): Promise<boolean> => {
  try {
    localStorage.setItem('diarias_despesas_enabled', JSON.stringify(enabled));
    window.dispatchEvent(new Event('diarias_settings_changed'));
  } catch (e) {
    console.warn('Erro ao salvar no localStorage:', e);
  }

  try {
    const uiConfig = await getCachedUiConfig(true);
    const updatedUiConfig = {
      ...uiConfig,
      diarias_despesas_enabled: enabled
    };
    memoryUiConfigCache = updatedUiConfig;
    lastCacheFetchTime = Date.now();

    await supabase
      .from('organization_settings')
      .update({ ui_config: updatedUiConfig })
      .eq('id', 'global_config');

    return true;
  } catch (e) {
    console.warn('Erro ao salvar configuracao de despesas no Supabase:', e);
    return true;
  }
};

export const getEnabledDespesasEventsMap = async (): Promise<Record<string, boolean>> => {
  let localMap: Record<string, boolean> = {};
  try {
    const stored = localStorage.getItem('diarias_despesas_events_map');
    if (stored) {
      localMap = JSON.parse(stored);
    }
  } catch (e) {
    console.warn('Erro ao ler despesas por evento do localStorage:', e);
  }

  try {
    const uiConfig = await getCachedUiConfig();
    if (uiConfig && typeof uiConfig.diarias_despesas_events_map === 'object') {
      const dbMap = uiConfig.diarias_despesas_events_map || {};
      const mergedMap = { ...localMap, ...dbMap };
      try {
        localStorage.setItem('diarias_despesas_events_map', JSON.stringify(mergedMap));
      } catch {}
      return mergedMap;
    }
  } catch (e) {
    console.warn('Erro ao buscar despesas por evento do Supabase:', e);
  }

  return localMap;
};

export const setEventoDespesasEnabled = async (eventId: string | number, enabled: boolean): Promise<Record<string, boolean>> => {
  const sId = String(eventId);
  const currentMap = await getEnabledDespesasEventsMap();
  const updatedMap = { ...currentMap, [sId]: enabled };

  try {
    localStorage.setItem('diarias_despesas_events_map', JSON.stringify(updatedMap));
    window.dispatchEvent(new CustomEvent('diarias_settings_changed', { detail: { eventId: sId, enabled } }));
  } catch (e) {
    console.warn('Erro ao salvar despesas por evento no localStorage:', e);
  }

  try {
    const uiConfig = await getCachedUiConfig(true);
    const updatedUiConfig = {
      ...uiConfig,
      diarias_despesas_events_map: updatedMap
    };
    memoryUiConfigCache = updatedUiConfig;
    lastCacheFetchTime = Date.now();

    await supabase
      .from('organization_settings')
      .update({ ui_config: updatedUiConfig })
      .eq('id', 'global_config');
  } catch (e) {
    console.warn('Erro ao salvar despesas por evento no Supabase:', e);
  }

  return updatedMap;
};

export const getGlobalDeletedEventIds = async (): Promise<string[]> => {
  let localIds: string[] = [];
  try {
    const stored = localStorage.getItem('deleted_diarias_eventos_ids');
    if (stored) {
      localIds = JSON.parse(stored);
    }
  } catch (e) {
    console.warn('Erro ao ler IDs excluidos do localStorage:', e);
  }

  try {
    const uiConfig = await getCachedUiConfig();
    if (uiConfig && Array.isArray(uiConfig.deleted_diarias_eventos_ids)) {
      const dbIds: string[] = uiConfig.deleted_diarias_eventos_ids;
      const mergedIds = Array.from(new Set([...localIds, ...dbIds]));
      try {
        localStorage.setItem('deleted_diarias_eventos_ids', JSON.stringify(mergedIds));
      } catch {}
      return mergedIds;
    }
  } catch (e) {
    console.warn('Erro ao buscar IDs excluidos do Supabase:', e);
  }

  return localIds;
};

export const addGlobalDeletedEventId = async (eventId: string | number): Promise<string[]> => {
  const sId = String(eventId);
  
  // 1. Salva imediatamente no localStorage de forma síncrona para sumir instantaneamente da UI
  let localIds: string[] = [];
  try {
    const stored = localStorage.getItem('deleted_diarias_eventos_ids');
    if (stored) {
      localIds = JSON.parse(stored);
    }
  } catch (e) {
    console.warn('Erro ao ler IDs excluidos do localStorage:', e);
  }

  if (!localIds.includes(sId)) {
    localIds.push(sId);
  }

  try {
    localStorage.setItem('deleted_diarias_eventos_ids', JSON.stringify(localIds));
    window.dispatchEvent(new Event('diarias_settings_changed'));
  } catch (e) {
    console.warn('Erro ao salvar ID excluido no localStorage:', e);
  }

  // 2. Sincroniza com as configurações globais do Supabase
  try {
    const { data: orgData } = await supabase
      .from('organization_settings')
      .select('ui_config')
      .eq('id', 'global_config')
      .single();

    const currentUiConfig = orgData?.ui_config || {};
    const dbIds: string[] = Array.isArray(currentUiConfig.deleted_diarias_eventos_ids)
      ? currentUiConfig.deleted_diarias_eventos_ids
      : [];

    const merged = Array.from(new Set([...localIds, ...dbIds]));

    const updatedUiConfig = {
      ...currentUiConfig,
      deleted_diarias_eventos_ids: merged
    };

    await supabase
      .from('organization_settings')
      .update({ ui_config: updatedUiConfig })
      .eq('id', 'global_config');

    try {
      localStorage.setItem('deleted_diarias_eventos_ids', JSON.stringify(merged));
    } catch {}

    return merged;
  } catch (e) {
    console.warn('Erro ao sincronizar ID excluido no Supabase:', e);
  }

  return localIds;
};
