import { supabase } from './supabaseClient';
import { DiariaEvento } from '../types';
import { getEnabledDespesasEventsMap, setEventoDespesasEnabled, getGlobalDeletedEventIds, addGlobalDeletedEventId } from './diariasSettingsService';

export const getDeletedEventIds = async (): Promise<Set<string>> => {
  const ids = await getGlobalDeletedEventIds();
  return new Set(ids);
};

export const markEventAsDeleted = async (id: string | number) => {
  await addGlobalDeletedEventId(id);
};

export const checkAndApplyAutoCancellation = (events: DiariaEvento[]): DiariaEvento[] => {
  const agora = new Date();

  return events.map(evt => {
    const isProgramado = evt.status === 'viagem_programada' || !evt.status;
    if (isProgramado && evt.data_saida) {
      const hasStarted = evt.pessoas && Array.isArray(evt.pessoas) && evt.pessoas.some(p => (p as any).viagem_inicio);
      if (!hasStarted) {
        try {
          const scheduledDate = new Date(evt.data_saida);
          const limitTime = new Date(scheduledDate.getTime() + 2 * 60 * 60 * 1000);

          if (agora > limitTime) {
            const cancelledEvt = { ...evt, status: 'cancelado' };
            updateDiariaEvento(evt.id, { status: 'cancelado' }).catch(err => {
              console.warn('Erro ao atualizar status cancelado no Supabase:', err);
            });
            return cancelledEvt;
          }
        } catch (e) {}
      }
    }
    return evt;
  });
};

const mergeDespesasFlag = async (events: DiariaEvento[]): Promise<DiariaEvento[]> => {
  const deletedIds = await getDeletedEventIds();
  const validEvents = events.filter(evt => !deletedIds.has(String(evt.id)));
  const processedEvents = checkAndApplyAutoCancellation(validEvents);
  const map = await getEnabledDespesasEventsMap();
  return processedEvents.map(evt => {
    const sId = String(evt.id);
    const isEnabled = map[sId] !== undefined ? !!map[sId] : !!(evt as any).permitir_despesas_pos_finalizacao;
    return {
      ...evt,
      permitir_despesas_pos_finalizacao: isEnabled
    };
  });
};

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

  return await mergeDespesasFlag(data as DiariaEvento[]);
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

  return await mergeDespesasFlag(data as DiariaEvento[]);
};

export const updateDiariaEvento = async (id: string, updates: Partial<DiariaEvento>): Promise<DiariaEvento> => {
  let isDespesasEnabledOverride: boolean | undefined = undefined;
  if ('permitir_despesas_pos_finalizacao' in updates) {
    isDespesasEnabledOverride = updates.permitir_despesas_pos_finalizacao;
    await setEventoDespesasEnabled(id, !!isDespesasEnabledOverride);
  }

  const cleanUpdates = { ...updates };
  delete cleanUpdates.permitir_despesas_pos_finalizacao;

  if (Object.keys(cleanUpdates).length === 0) {
    const { data } = await supabase.from('diarias_eventos').select('*').eq('id', id).single();
    const map = await getEnabledDespesasEventsMap();
    if (data) {
      return {
        ...data,
        permitir_despesas_pos_finalizacao: isDespesasEnabledOverride ?? !!map[id]
      } as DiariaEvento;
    }
  }

  let { data, error } = await supabase
    .from('diarias_eventos')
    .update(cleanUpdates)
    .eq('id', id)
    .select()
    .single();

  if (error && error.code === 'PGRST204') {
    console.warn('Coluna ausente em updateDiariaEvento (PGRST204). Tentando fallback...', error.message);
    const fallbackUpdates = { ...cleanUpdates };
    delete fallbackUpdates.gestor_transferido_cargo;
    delete fallbackUpdates.permitir_despesas_pos_finalizacao;
    delete fallbackUpdates.checklist;

    const fallbackRes = await supabase
      .from('diarias_eventos')
      .update(fallbackUpdates)
      .eq('id', id)
      .select()
      .single();

    if (!fallbackRes.error) {
      window.dispatchEvent(new Event('diarias_eventos_updated'));
      const map = await getEnabledDespesasEventsMap();
      return {
        ...fallbackRes.data,
        permitir_despesas_pos_finalizacao: isDespesasEnabledOverride ?? !!map[id]
      } as DiariaEvento;
    }
  }

  if (error) {
    console.error('Erro ao atualizar evento de diária:', error);
    throw new Error('Falha ao atualizar o lançamento de viagem.');
  }

  window.dispatchEvent(new Event('diarias_eventos_updated'));
  window.dispatchEvent(new Event('diarias_eventos_updated'));
  const map = await getEnabledDespesasEventsMap();
  return {
    ...data,
    permitir_despesas_pos_finalizacao: isDespesasEnabledOverride ?? !!map[id]
  } as DiariaEvento;
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
  const cleanId = String(id).trim();
  await markEventAsDeleted(cleanId);
  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanId);

    if (isUuid) {
      const { error } = await supabase
        .from('diarias_eventos')
        .delete()
        .eq('id', cleanId);

      if (error && error.code !== '42883') {
        console.warn('Alerta ao excluir evento de diária:', error.message);
      }

      await supabase
        .from('service_requests')
        .delete()
        .eq('id', cleanId);
    } else {
      // Se for id numérico/timestamp, executa exclusão tratada para evitar exceção de operador Postgres 42883
      const { error } = await supabase
        .from('diarias_eventos')
        .delete()
        .filter('id', 'eq', cleanId);

      if (error) {
        console.warn('Alerta na exclusao com ID nao-UUID:', error.message);
      }

      await supabase
        .from('service_requests')
        .delete()
        .filter('id', 'eq', cleanId);
    }
  } catch (err) {
    console.warn('Exclusão tratada:', err);
  }

  return true;
};
