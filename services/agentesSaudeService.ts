import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { AGENTES_DE_SAUDE } from '../types';

export interface AgenteSaudeItem {
  id?: string;
  nome: string;
  psf?: string;
}

const STORAGE_KEY = 'prefeitura_agentes_saude_v2';
const EVENT_NAME = 'consultas-agentes-saude-changed';

// Cache em memória para acesso imediato e 0ms
let agentesMemoryCache: AgenteSaudeItem[] | null = null;

export const normalizeAgenteItem = (item: any): AgenteSaudeItem => {
  if (typeof item === 'string') {
    return { nome: item.trim().toUpperCase(), psf: '' };
  }
  if (item && typeof item === 'object') {
    return {
      nome: (item.nome || '').trim().toUpperCase(),
      psf: (item.psf || '').trim().toUpperCase()
    };
  }
  return { nome: '', psf: '' };
};

/**
 * Retorna os itens completos de agentes de saúde (com PSF)
 */
export const getAgentesSaudeItems = (): AgenteSaudeItem[] => {
  if (agentesMemoryCache && agentesMemoryCache.length > 0) {
    return agentesMemoryCache;
  }
  if (typeof localStorage !== 'undefined') {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('prefeitura_agentes_saude_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const normalized = parsed
            .map(normalizeAgenteItem)
            .filter(a => a.nome.length > 0)
            .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
          agentesMemoryCache = normalized;
          return normalized;
        }
      }
    } catch {}
  }
  // Padrão inicial oficial baseado na lista padrão do município
  const padrao: AgenteSaudeItem[] = AGENTES_DE_SAUDE.map(nome => ({
    nome: nome.trim().toUpperCase(),
    psf: ''
  })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  agentesMemoryCache = padrao;
  return agentesMemoryCache;
};

/**
 * Retorna a lista síncrona de nomes dos agentes de saúde (para compatibilidade com selects legados)
 */
export const getAgentesSaudeList = (): string[] => {
  return getAgentesSaudeItems().map(a => a.nome);
};

/**
 * Busca a lista persistida no Supabase ou no cache local
 */
export const fetchAgentesSaude = async (): Promise<AgenteSaudeItem[]> => {
  try {
    const { data, error } = await supabase
      .from('organization_settings')
      .select('ui_config')
      .eq('id', 'global_config')
      .single();

    if (!error && data?.ui_config?.consultas_agentes_saude && Array.isArray(data.ui_config.consultas_agentes_saude)) {
      const list = data.ui_config.consultas_agentes_saude
        .map(normalizeAgenteItem)
        .filter((a: AgenteSaudeItem) => a.nome.length > 0)
        .sort((a: AgenteSaudeItem, b: AgenteSaudeItem) => a.nome.localeCompare(b.nome, 'pt-BR'));

      agentesMemoryCache = list;
      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
        } catch {}
      }
      return list;
    }
  } catch (e) {
    console.warn('Erro ao carregar agentes de saúde do Supabase:', e);
  }

  return getAgentesSaudeItems();
};

/**
 * Notifica ouvintes e salva no localStorage
 */
const notifyAgentesChanged = (newList: AgenteSaudeItem[]) => {
  agentesMemoryCache = newList;
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newList));
    } catch {}
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { 
      detail: { 
        agentes: newList.map(a => a.nome),
        items: newList 
      } 
    }));
  }
};

/**
 * Persiste a lista de agentes de saúde no Supabase
 */
const persistToSupabase = async (newList: AgenteSaudeItem[]) => {
  try {
    const { data: orgData } = await supabase
      .from('organization_settings')
      .select('ui_config')
      .eq('id', 'global_config')
      .single();

    const currentUiConfig = orgData?.ui_config || {};
    const updatedUiConfig = {
      ...currentUiConfig,
      consultas_agentes_saude: newList
    };

    await supabase
      .from('organization_settings')
      .update({ ui_config: updatedUiConfig })
      .eq('id', 'global_config');
  } catch (err) {
    console.warn('Erro ao salvar agentes de saúde no Supabase:', err);
  }
};

/**
 * Adiciona um novo agente de saúde com PSF opcional
 */
export const addAgenteSaude = async (nome: string, psf: string = ''): Promise<{ success: boolean; error?: string }> => {
  const cleanName = nome.trim().toUpperCase();
  const cleanPsf = psf.trim().toUpperCase();
  if (!cleanName) {
    return { success: false, error: 'O nome do agente de saúde não pode estar vazio.' };
  }

  const currentList = getAgentesSaudeItems();
  const exists = currentList.some(a => a.nome.toLowerCase() === cleanName.toLowerCase());
  if (exists) {
    return { success: false, error: 'Já existe um agente de saúde cadastrado com este nome.' };
  }

  const newItem: AgenteSaudeItem = { nome: cleanName, psf: cleanPsf };
  const updated = [...currentList, newItem].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  notifyAgentesChanged(updated);
  await persistToSupabase(updated);
  return { success: true };
};

/**
 * Atualiza o nome e o PSF de um agente de saúde existente
 */
export const updateAgenteSaude = async (
  nomeAntigo: string, 
  nomeNovo: string, 
  novoPsf: string = ''
): Promise<{ success: boolean; error?: string }> => {
  const cleanOld = nomeAntigo.trim().toUpperCase();
  const cleanNew = nomeNovo.trim().toUpperCase();
  const cleanPsf = novoPsf.trim().toUpperCase();
  if (!cleanNew) {
    return { success: false, error: 'O novo nome não pode estar vazio.' };
  }

  const currentList = getAgentesSaudeItems();
  const exists = currentList.some(a => a.nome.toLowerCase() === cleanNew.toLowerCase() && a.nome.toLowerCase() !== cleanOld.toLowerCase());
  if (exists) {
    return { success: false, error: 'Já existe outro agente de saúde cadastrado com este nome.' };
  }

  const updated = currentList
    .map(a => (a.nome.toLowerCase() === cleanOld.toLowerCase() ? { ...a, nome: cleanNew, psf: cleanPsf } : a))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  notifyAgentesChanged(updated);
  await persistToSupabase(updated);

  // Propaga o novo nome aos pacientes que possuíam o nome antigo cadastrado
  if (cleanOld !== cleanNew) {
    try {
      await supabase
        .from('consultas_pacientes')
        .update({ agente_saude: cleanNew })
        .ilike('agente_saude', cleanOld);
    } catch (e) {
      console.warn('Erro ao propagar nome atualizado aos pacientes:', e);
    }
  }

  return { success: true };
};

/**
 * Remove um agente de saúde da lista
 */
export const deleteAgenteSaude = async (nome: string): Promise<{ success: boolean; error?: string }> => {
  const clean = nome.trim().toLowerCase();
  const currentList = getAgentesSaudeItems();
  const updated = currentList.filter(a => a.nome.toLowerCase() !== clean);
  notifyAgentesChanged(updated);
  await persistToSupabase(updated);
  return { success: true };
};

/**
 * Restaura a lista oficial padrão de agentes de saúde
 */
export const resetAgentesSaudePadrao = async (): Promise<{ success: boolean }> => {
  const padrao: AgenteSaudeItem[] = AGENTES_DE_SAUDE.map(nome => ({
    nome: nome.trim().toUpperCase(),
    psf: ''
  })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  notifyAgentesChanged(padrao);
  await persistToSupabase(padrao);
  return { success: true };
};

/**
 * Hook reativo para utilizar a lista de agentes de saúde sempre atualizada
 */
export const useAgentesSaude = (): { 
  agentes: string[]; 
  items: AgenteSaudeItem[]; 
  list: string[] 
} => {
  const [items, setItems] = useState<AgenteSaudeItem[]>(() => getAgentesSaudeItems());

  useEffect(() => {
    fetchAgentesSaude().then(list => setItems(list));

    const handler = () => {
      setItems(getAgentesSaudeItems());
    };
    window.addEventListener(EVENT_NAME, handler);
    return () => window.removeEventListener(EVENT_NAME, handler);
  }, []);

  const nomes = items.map(i => i.nome);
  return { agentes: nomes, items, list: nomes };
};
