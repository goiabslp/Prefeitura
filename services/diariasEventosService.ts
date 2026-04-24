import { supabase } from './supabaseClient';
import { DiariaEvento } from '../types';

export const createDiariaEvento = async (evento: Omit<DiariaEvento, 'id' | 'created_at'>): Promise<DiariaEvento> => {
  const { data, error } = await supabase
    .from('diarias_eventos')
    .insert([evento])
    .select()
    .single();

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
