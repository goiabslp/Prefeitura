// =========================================================================
// SERVIÇO CENTRAL DE TRANSPORTE DE PACIENTES — INTEGRAÇÃO REGULAÇÃO & FROTAS
// =========================================================================

import { supabase } from './supabaseClient';
import { 
  TransporteDemanda, 
  TransporteStatus, 
  TransporteConfirmacaoContato, 
  ConsultaAgendamento, 
  VehicleSchedule, 
  Vehicle, 
  Person,
  CrewMember 
} from '../types';
import {
  normalizeCityTransporte,
  normalizeTransporteText,
  agruparDemandasInteligentes,
  validarCapacidadeViagem,
  calcularIndicadoresTransporte
} from '../utils/transporteRules';

export {
  normalizeCityTransporte,
  normalizeTransporteText,
  agruparDemandasInteligentes,
  validarCapacidadeViagem,
  calcularIndicadoresTransporte
};

export const normalizeCity = normalizeCityTransporte;

const STORAGE_KEY = 'prefeitura_transporte_demandas_v1';

// Recupera dados locais como fallback imediato e cache offline
const getLocalDemandas = (): TransporteDemanda[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.warn('[transporteService] Erro ao ler demandas locais:', err);
    return [];
  }
};

// Persiste dados locais
const saveLocalDemandas = (demandas: TransporteDemanda[]) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(demandas));
    window.dispatchEvent(new CustomEvent('transporte-demandas-changed', { detail: { count: demandas.length } }));
  } catch (err) {
    console.warn('[transporteService] Erro ao salvar demandas locais:', err);
  }
};

/**
 * Cria ou atualiza demanda a partir da definição de data no Módulo de Regulação
 */
export const criarDemandaDeAgendamento = async (
  booking: ConsultaAgendamento,
  dadosTransporte: {
    necessitaAcompanhante: boolean;
    qtdAcompanhantes: number;
    necessitaVeiculoAdaptado: boolean;
    observacoes?: string;
  }
): Promise<TransporteDemanda> => {
  const localList = getLocalDemandas();
  const existingIndex = localList.findIndex(d => d.agendamentoId === booking.id);

  const pacienteNome = booking.paciente?.name || 'Paciente Não Identificado';
  const pacienteCpf = booking.paciente?.cpf || '';
  const pacienteDataNasc = booking.paciente?.birth_date || (booking.paciente as any)?.birthDate || '';
  const pacienteTelefone = booking.paciente?.phone || '';

  const procNome = booking.procedimento?.name || 'Procedimento';
  const tipoProc = booking.procedimento?.type || 'Consulta';

  // Destino prioritário da vaga/agendamento
  const destinoRaw = booking.municipio || booking.prestador || 'BELO HORIZONTE - MG';
  const destinoFinal = destinoRaw.toUpperCase().includes('MG') ? destinoRaw.toUpperCase() : `${destinoRaw.toUpperCase()} - MG`;

  const novaDemanda: TransporteDemanda = {
    id: existingIndex >= 0 ? localList[existingIndex].id : `td_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    agendamentoId: booking.id,
    pacienteId: booking.patient_id,
    pacienteNome,
    pacienteCpf,
    pacienteDataNascimento: pacienteDataNasc,
    pacienteTelefone,
    procedimentoId: booking.procedimento_id,
    procedimentoNome: procNome,
    tipoProcedimento: tipoProc as any,
    dataAtendimento: booking.appointment_date || new Date().toISOString().substring(0, 10),
    horaAtendimento: booking.appointment_time ? booking.appointment_time.substring(0, 5) : '08:00',
    municipioDestino: destinoFinal,
    estabelecimentoSaude: booking.prestador || booking.convenio || '',
    enderecoAtendimento: '',
    necessitaAcompanhante: dadosTransporte.necessitaAcompanhante,
    qtdAcompanhantes: dadosTransporte.necessitaAcompanhante ? Math.max(1, dadosTransporte.qtdAcompanhantes || 1) : 0,
    necessitaVeiculoAdaptado: dadosTransporte.necessitaVeiculoAdaptado,
    observacoes: dadosTransporte.observacoes || '',
    prioridade: booking.priority || 'Normal',
    statusTransporte: existingIndex >= 0 ? localList[existingIndex].statusTransporte : 'Aguardando vaga',
    viagemId: existingIndex >= 0 ? localList[existingIndex].viagemId : undefined,
    veiculoId: existingIndex >= 0 ? localList[existingIndex].veiculoId : undefined,
    motoristaId: existingIndex >= 0 ? localList[existingIndex].motoristaId : undefined,
    historicoConfirmacao: existingIndex >= 0 ? localList[existingIndex].historicoConfirmacao : [],
    createdAt: existingIndex >= 0 ? localList[existingIndex].createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  if (existingIndex >= 0) {
    localList[existingIndex] = novaDemanda;
  } else {
    localList.unshift(novaDemanda);
  }

  saveLocalDemandas(localList);

  // Tenta persistir no Supabase (se a tabela ou campos existirem)
  try {
    await supabase
      .from('consultas_agendamentos')
      .update({
        transporte_necessario: true,
        transporte_acompanhantes: novaDemanda.qtdAcompanhantes,
        transporte_adaptado: novaDemanda.necessitaVeiculoAdaptado,
        transporte_observacoes: novaDemanda.observacoes,
        transporte_demanda_id: novaDemanda.id
      })
      .eq('id', booking.id);
  } catch (err) {
    console.warn('[transporteService] Aviso ao atualizar consultas_agendamentos com metadata de transporte:', err);
  }

  try {
    await supabase
      .from('transporte_demandas')
      .upsert(novaDemanda);
  } catch (err) {
    // Tabela pode ainda não ter sido migrada no banco de dados remoto
  }

  return novaDemanda;
};

/**
 * Retorna as demandas com filtros opcionais
 */
export const getDemandas = async (filtros?: {
  data?: string;
  dataInicio?: string;
  dataFim?: string;
  destino?: string;
  status?: TransporteStatus | 'TODOS';
  tipoProcedimento?: string;
  estabelecimento?: string;
  search?: string;
}): Promise<TransporteDemanda[]> => {
  let list = getLocalDemandas();

  // Tenta sincronizar com Supabase se a tabela existir
  try {
    const { data, error } = await supabase
      .from('transporte_demandas')
      .select('*')
      .order('dataAtendimento', { ascending: true });

    if (!error && data && data.length > 0) {
      // Mescla com dados locais priorizando mais recente
      const map = new Map<string, TransporteDemanda>();
      list.forEach(item => map.set(item.id, item));
      data.forEach((item: any) => {
        const local = map.get(item.id);
        if (!local || new Date(item.updatedAt || 0) >= new Date(local.updatedAt || 0)) {
          map.set(item.id, item);
        }
      });
      list = Array.from(map.values());
      saveLocalDemandas(list);
    }
  } catch (e) {
    // Modo offline/local
  }

  // Aplica filtros em memória
  if (filtros) {
    if (filtros.data) {
      list = list.filter(d => d.dataAtendimento === filtros.data);
    }
    if (filtros.dataInicio && filtros.dataFim) {
      list = list.filter(d => d.dataAtendimento >= filtros.dataInicio! && d.dataAtendimento <= filtros.dataFim!);
    }
    if (filtros.destino && filtros.destino !== 'TODOS') {
      const normDest = normalizeCity(filtros.destino);
      list = list.filter(d => normalizeCity(d.municipioDestino).includes(normDest) || normDest.includes(normalizeCity(d.municipioDestino)));
    }
    if (filtros.status && filtros.status !== 'TODOS') {
      list = list.filter(d => d.statusTransporte === filtros.status);
    }
    if (filtros.tipoProcedimento && filtros.tipoProcedimento !== 'TODOS') {
      list = list.filter(d => d.tipoProcedimento?.toUpperCase() === filtros.tipoProcedimento?.toUpperCase());
    }
    if (filtros.estabelecimento && filtros.estabelecimento !== 'TODOS') {
      const normEst = normalizeTransporteText(filtros.estabelecimento);
      list = list.filter(d => normalizeTransporteText(d.estabelecimentoSaude).includes(normEst));
    }
    if (filtros.search && filtros.search.trim()) {
      const query = normalizeTransporteText(filtros.search);
      const cleanDigits = filtros.search.replace(/\D/g, '');
      list = list.filter(d => {
        const normNome = normalizeTransporteText(d.pacienteNome);
        const normCpf = (d.pacienteCpf || '').replace(/\D/g, '');
        const normProc = normalizeTransporteText(d.procedimentoNome);
        return normNome.includes(query) || (cleanDigits && normCpf.includes(cleanDigits)) || normProc.includes(query);
      });
    }
  }

  return list;
};

/**
 * Salva ou atualiza uma demanda individual
 */
export const salvarDemanda = async (demanda: TransporteDemanda): Promise<TransporteDemanda> => {
  demanda.updatedAt = new Date().toISOString();
  const list = getLocalDemandas();
  const index = list.findIndex(d => d.id === demanda.id);
  if (index >= 0) {
    list[index] = demanda;
  } else {
    list.unshift(demanda);
  }
  saveLocalDemandas(list);

  try {
    await supabase.from('transporte_demandas').upsert(demanda);
  } catch (err) {}

  return demanda;
};

/**
 * Aloca um paciente (e seus acompanhantes) em uma viagem de veículo existente
 */
export const alocarPacienteEmViagem = async (
  demandaId: string,
  viagem: VehicleSchedule,
  veiculo: Vehicle,
  usuarioNome: string
): Promise<{ success: boolean; message?: string }> => {
  const list = getLocalDemandas();
  const demanda = list.find(d => d.id === demandaId);
  if (!demanda) {
    return { success: false, message: 'Demanda de transporte não localizada.' };
  }

  // 1. Calcular ocupação atual da viagem
  const currentPassengers = viagem.passengers || [];
  const assentosOcupados = currentPassengers.length;
  // A capacidade para passageiros é a capacidade total do veículo menos 1 (motorista)
  const capacidadePassageiros = Math.max(1, (veiculo.passengerCapacity || (veiculo as any).capacity || 5) - 1);

  // Assentos necessários para o paciente + acompanhantes
  const assentosNecessarios = 1 + (demanda.qtdAcompanhantes || 0);

  if (assentosOcupados + assentosNecessarios > capacidadePassageiros) {
    return {
      success: false,
      message: `Capacidade insuficiente. A viagem tem ${capacidadePassageiros - assentosOcupados} assento(s) livre(s), mas são necessários ${assentosNecessarios} (1 paciente + ${demanda.qtdAcompanhantes} acompanhante(s)).`
    };
  }

  // 2. Montar passageiros a adicionar
  const novosMembros: CrewMember[] = [
    {
      id: `pax_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      patientId: demanda.pacienteId,
      name: demanda.pacienteNome,
      cpf: demanda.pacienteCpf,
      birthDate: demanda.pacienteDataNascimento,
      phone: demanda.pacienteTelefone,
      type: 'Paciente',
      appointmentTime: demanda.horaAtendimento,
      procedureName: demanda.procedimentoNome,
      destination: demanda.municipioDestino,
      notes: demanda.observacoes
    }
  ];

  // Adicionar acompanhantes autorizados
  for (let i = 1; i <= (demanda.qtdAcompanhantes || 0); i++) {
    novosMembros.push({
      id: `acomp_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`,
      name: `Acompanhante de ${demanda.pacienteNome} (#${i})`,
      type: 'Acompanhante',
      notes: `Acompanhante autorizado do paciente ${demanda.pacienteNome}`
    });
  }

  // Atualizar a viagem
  const updatedPassengers = [...currentPassengers, ...novosMembros];
  viagem.passengers = updatedPassengers;
  viagem.patientCount = (viagem.patientCount || 0) + 1;
  viagem.companionCount = (viagem.companionCount || 0) + (demanda.qtdAcompanhantes || 0);

  // 3. Atualizar a demanda
  demanda.viagemId = viagem.id;
  demanda.veiculoId = veiculo.id;
  demanda.motoristaId = viagem.driverId;
  demanda.statusTransporte = 'Alocado';
  demanda.alocadoEm = new Date().toISOString();
  demanda.alocadoPor = usuarioNome;
  demanda.updatedAt = new Date().toISOString();

  saveLocalDemandas(list);

  // Sincronizar viagem no Supabase se possível
  try {
    await supabase
      .from('vehicle_schedules')
      .update({
        passengers: updatedPassengers,
        patient_count: viagem.patientCount,
        companion_count: viagem.companionCount
      })
      .eq('id', viagem.id);
  } catch (err) {
    console.warn('[transporteService] Erro ao sincronizar vehicle_schedules no Supabase:', err);
  }

  // Disparar evento global para atualizar as telas em tempo real sem reload
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('transporte-alocacao-changed', { detail: { demandaId, viagemId: viagem.id } }));
  }

  return { success: true };
};

/**
 * Desaloca um paciente de uma viagem e libera os assentos
 */
export const desalocarPacienteDeViagem = async (
  demandaId: string,
  viagem?: VehicleSchedule
): Promise<{ success: boolean; message?: string }> => {
  const list = getLocalDemandas();
  const demanda = list.find(d => d.id === demandaId);
  if (!demanda) {
    return { success: false, message: 'Demanda não encontrada.' };
  }

  const viagemId = demanda.viagemId;

  // Atualizar a demanda para aguardando vaga
  demanda.viagemId = undefined;
  demanda.veiculoId = undefined;
  demanda.motoristaId = undefined;
  demanda.statusTransporte = 'Aguardando vaga';
  demanda.alocadoEm = undefined;
  demanda.alocadoPor = undefined;
  demanda.updatedAt = new Date().toISOString();

  saveLocalDemandas(list);

  // Se a viagem foi informada ou identificada, remover paciente e acompanhantes da tripulação
  if (viagem && viagemId === viagem.id && viagem.passengers) {
    const updatedPassengers = viagem.passengers.filter(p => {
      // Remove o próprio paciente
      if (p.patientId === demanda.pacienteId) return false;
      if (p.name === demanda.pacienteNome) return false;
      // Remove acompanhantes vinculados
      if (p.notes && p.notes.includes(demanda.pacienteNome)) return false;
      return true;
    });

    viagem.passengers = updatedPassengers;
    viagem.patientCount = Math.max(0, (viagem.patientCount || 1) - 1);
    viagem.companionCount = Math.max(0, (viagem.companionCount || 0) - (demanda.qtdAcompanhantes || 0));

    try {
      await supabase
        .from('vehicle_schedules')
        .update({
          passengers: updatedPassengers,
          patient_count: viagem.patientCount,
          companion_count: viagem.companionCount
        })
        .eq('id', viagem.id);
    } catch (err) {}
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('transporte-alocacao-changed', { detail: { demandaId } }));
  }

  return { success: true };
};

/**
 * Registra o contato de confirmação com o paciente
 */
export const registrarContatoConfirmacao = async (
  demandaId: string,
  contato: Omit<TransporteConfirmacaoContato, 'id'>,
  viagemCorrespondente?: VehicleSchedule
): Promise<{ demanda: TransporteDemanda; liberouVagas: boolean }> => {
  const list = getLocalDemandas();
  const demanda = list.find(d => d.id === demandaId);
  if (!demanda) {
    throw new Error('Demanda não localizada');
  }

  const novoContato: TransporteConfirmacaoContato = {
    id: `cont_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    ...contato
  };

  demanda.historicoConfirmacao = demanda.historicoConfirmacao || [];
  demanda.historicoConfirmacao.unshift(novoContato);
  demanda.updatedAt = new Date().toISOString();

  let liberouVagas = false;

  // Atualização de Status conforme o resultado do contato
  if (contato.resultado === 'Confirmado') {
    demanda.statusTransporte = 'Confirmado';
  } else if (contato.resultado === 'Desistiu') {
    demanda.statusTransporte = 'Desistiu';
    // Regra Obrigatória: se desistiu, liberar imediatamente as vagas ocupadas na viagem!
    if (demanda.viagemId) {
      await desalocarPacienteDeViagem(demandaId, viagemCorrespondente);
      liberouVagas = true;
      // Reatribui status de desistiu após a desalocação
      demanda.statusTransporte = 'Desistiu';
    }
  } else {
    // Ausente / Não atendeu
    if (demanda.statusTransporte !== 'Confirmado' && demanda.statusTransporte !== 'Desistiu') {
      demanda.statusTransporte = 'Aguardando confirmação';
    }
  }

  saveLocalDemandas(list);

  try {
    await supabase.from('transporte_demandas').upsert(demanda);
  } catch (err) {}

  return { demanda, liberouVagas };
};

/**
 * Sincronização automática com a Regulação
 * Garante que alterações de data, cancelamentos ou exclusões no agendamento médico reflitam no transporte
 */
export const sincronizarComRegulacao = async (agendamentos?: ConsultaAgendamento[]): Promise<TransporteDemanda[]> => {
  if (!agendamentos || agendamentos.length === 0) {
    return getLocalDemandas();
  }

  const list = getLocalDemandas();
  const bookingsMap = new Map<string, ConsultaAgendamento>();
  agendamentos.forEach(b => bookingsMap.set(b.id, b));

  let modified = false;

  list.forEach(demanda => {
    const booking = bookingsMap.get(demanda.agendamentoId);
    if (!booking) return;

    // 1. Cancelamento ou Exclusão na Regulação -> Cancela a demanda de transporte
    const isCancelledInRegulacao = 
      booking.status === 'Cancelado' || 
      booking.status === 'Excluído' || 
      (booking as any).is_deleted === true;

    if (isCancelledInRegulacao && demanda.statusTransporte !== 'Cancelado') {
      demanda.statusTransporte = 'Cancelado';
      demanda.observacoes = (demanda.observacoes ? demanda.observacoes + ' | ' : '') + 'Cancelado automaticamente via Regulação.';
      demanda.updatedAt = new Date().toISOString();
      modified = true;
    }

    // 2. Remarcação de Data / Horário na Regulação
    if (booking.appointment_date && booking.appointment_date !== demanda.dataAtendimento) {
      demanda.dataAtendimento = booking.appointment_date;
      if (booking.appointment_time) {
        demanda.horaAtendimento = booking.appointment_time.substring(0, 5);
      }
      // Se a data mudou e estava alocado em uma viagem antiga, requer realocação
      if (demanda.viagemId) {
        demanda.viagemId = undefined;
        demanda.veiculoId = undefined;
        demanda.motoristaId = undefined;
        demanda.statusTransporte = 'Aguardando vaga';
      }
      demanda.updatedAt = new Date().toISOString();
      modified = true;
    }
  });

  if (modified) {
    saveLocalDemandas(list);
  }

  return list;
};
