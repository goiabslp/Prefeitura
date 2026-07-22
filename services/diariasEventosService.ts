import { supabase } from './supabaseClient';
import { DiariaEvento } from '../types';

export const createDiariaEvento = async (evento: Omit<DiariaEvento, 'id' | 'created_at'>): Promise<DiariaEvento> => {
  let payload: any = { ...evento };
  let { data, error } = await supabase
    .from('diarias_eventos')
    .insert([payload])
    .select()
    .single();

  if (error && error.code === 'PGRST204') {
    console.warn('Coluna ausente no schema cache de diarias_eventos (PGRST204). Executando fallback...', error.message);
    const fallbackPayload = { ...payload };
    delete fallbackPayload.distancia;
    delete fallbackPayload.hospedagem;
    delete fallbackPayload.hospedagem_dias;
    delete fallbackPayload.veiculo;
    delete fallbackPayload.veiculo_outro;

    const fallbackRes = await supabase
      .from('diarias_eventos')
      .insert([fallbackPayload])
      .select()
      .single();

    if (!fallbackRes.error) {
      return fallbackRes.data as DiariaEvento;
    }
  }

  if (error) {
    console.error('Erro ao criar evento de diária:', error);
    throw new Error('Falha ao registrar novo evento. Tente novamente mais tarde.');
  }

  return data as DiariaEvento;
};

export const getDiariaEventosBySector = async (sectorId?: string): Promise<DiariaEvento[]> => {
  let query = supabase
    .from('diarias_eventos')
    .select('*')
    .order('created_at', { ascending: false });

  if (sectorId) {
    query = query.eq('setor_id', sectorId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Erro ao buscar eventos de diárias:', error);
    throw new Error('Falha ao carregar a lista de lançamentos.');
  }

  return data as DiariaEvento[];
};

export const getAllDiariaEventos = async (): Promise<DiariaEvento[]> => {
  const { data, error } = await supabase
    .from('diarias_eventos')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Erro ao buscar todos eventos de diárias:', error);
    throw new Error('Falha ao carregar a lista de lançamentos.');
  }

  return data as DiariaEvento[];
};

export const updateDiariaEvento = async (id: string, updates: Partial<DiariaEvento>): Promise<DiariaEvento> => {
  let { data, error } = await supabase
    .from('diarias_eventos')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error && error.code === 'PGRST204') {
    console.warn('Coluna ausente em updateDiariaEvento (PGRST204). Tentando fallback...', error.message);
    const fallbackUpdates = { ...updates };
    delete fallbackUpdates.gestor_transferido_cargo;

    const fallbackRes = await supabase
      .from('diarias_eventos')
      .update(fallbackUpdates)
      .eq('id', id)
      .select()
      .single();

    if (!fallbackRes.error) {
      return fallbackRes.data as DiariaEvento;
    }
  }

  if (error) {
    console.error('Erro ao atualizar evento de diária:', error);
    throw new Error('Falha ao atualizar o lançamento de viagem.');
  }

  return data as DiariaEvento;
};

export const getDiariasGestores = async (): Promise<{ pessoa_id: string; gestor_id: string }[]> => {
  const { data, error } = await supabase
    .from('diarias_gestores')
    .select('pessoa_id, gestor_id');

  if (error) {
    console.error('Erro ao buscar gestores de diárias:', error);
    return [];
  }

  return data || [];
};

export const saveDiariaGestor = async (pessoaId: string, gestorId: string): Promise<boolean> => {
  const { error } = await supabase
    .from('diarias_gestores')
    .upsert({
      pessoa_id: pessoaId,
      gestor_id: gestorId,
      created_at: new Date().toISOString()
    });

  if (error) {
    console.error('Erro ao salvar gestor de diária:', error);
    throw new Error('Falha ao definir o gestor para o servidor.');
  }

  return true;
};

export const deleteDiariaEvento = async (id: string): Promise<boolean> => {
  const { data, error } = await supabase
    .from('diarias_eventos')
    .delete()
    .eq('id', id)
    .select();

  if (error) {
    console.error('Erro ao excluir evento de diária:', error);
    throw new Error('Falha ao excluir o evento de diária.');
  }

  // Se por restrição de RLS ou indisponibilidade a exclusão com .select() não retornar linhas, tenta a exclusão direta sem select como fallback
  if (!data || data.length === 0) {
    const { error: fallbackError } = await supabase
      .from('diarias_eventos')
      .delete()
      .eq('id', id);

    if (fallbackError) {
      console.error('Erro no fallback de exclusão de evento de diária:', fallbackError);
      throw new Error('Falha ao excluir o evento de diária.');
    }
  }

  return true;
};
