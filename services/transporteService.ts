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
  agruparHierarquicoDataDestino,
  GrupoDataHierarquico,
  GrupoDestinoHierarquico,
  validarCapacidadeViagem,
  calcularIndicadoresTransporte
} from '../utils/transporteRules';
import { getAgendamentos } from './consultasService';

export {
  normalizeCityTransporte,
  normalizeTransporteText,
  agruparDemandasInteligentes,
  agruparHierarquicoDataDestino,
  validarCapacidadeViagem,
  calcularIndicadoresTransporte
};

export type { GrupoDataHierarquico, GrupoDestinoHierarquico };

export const normalizeCity = normalizeCityTransporte;

// Chave única de persistência do cache offline das demandas reais
const STORAGE_KEY = 'prefeitura_transporte_demandas_v1';

/**
 * Recupera demandas locais como cache e persistência de alocação/status.
 * Purga estritamente quaisquer registros fictícios ou mockados gravados em versões anteriores.
 * NUNCA retorna dados inventados ou simulados.
 */
export const getLocalDemandas = (): TransporteDemanda[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    // Purga estrita: rejeita dados falsos, simulados ou com prefixos mockados
    const dadosReais = parsed.filter((item: any) => {
      if (!item || typeof item !== 'object') return false;
      const id = String(item.id || '');
      const agId = String(item.agendamentoId || '');
      const pacId = String(item.pacienteId || '');

      if (id.startsWith('dem_ipa_') || id.startsWith('dem_pn_') || id.startsWith('dem_21_') || id.startsWith('dem_24_')) return false;
      if (agId.startsWith('ag_ipa_') || agId.startsWith('ag_pn_') || agId.startsWith('ag_21_') || agId.startsWith('ag_24_')) return false;
      if (pacId.startsWith('pac_ipa_') || pacId.startsWith('pac_pn_') || pacId.startsWith('pac_21_') || pacId.startsWith('pac_24_')) return false;
      if (item.pacienteNome?.includes('Paciente Sábado') || item.pacienteNome?.includes('Paciente Terça')) return false;

      return true;
    });

    if (dadosReais.length !== parsed.length) {
      saveLocalDemandas(dadosReais);
    }

    return dadosReais;
  } catch (err) {
    console.warn('[transporteService] Erro ao ler demandas locais:', err);
    return [];
  }
};

// Persiste dados locais
export const saveLocalDemandas = (demandas: TransporteDemanda[]) => {
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
  const pacienteApelido = booking.paciente?.nickname || 'Não informado';
  const pacienteCpf = booking.paciente?.cpf || 'Não informado';
  const pacienteDataNasc = booking.paciente?.birth_date || (booking.paciente as any)?.birthDate || '';
  const pacienteTelefone = booking.paciente?.phone || '';

  const procNome = booking.procedimento?.name || 'Procedimento';
  const procCod = booking.procedimento?.code || '';
  const tipoProc = booking.procedimento?.type || 'Consulta';

  // Destino prioritário da vaga/agendamento — se não informado, não inventar cidade
  const destinoRaw = (booking.municipio || booking.prestador || '').trim();
  const destinoFinal = destinoRaw 
    ? (destinoRaw.toUpperCase().includes('MG') ? destinoRaw : `${destinoRaw} — MG`) 
    : 'Destino não informado';

  const novaDemanda: TransporteDemanda = {
    id: existingIndex >= 0 ? localList[existingIndex].id : `dem_${booking.id}`,
    agendamentoId: booking.id,
    pacienteId: booking.patient_id,
    pacienteNome,
    pacienteApelido,
    pacienteCpf,
    pacienteDataNascimento: pacienteDataNasc,
    pacienteTelefone,
    procedimentoId: booking.procedimento_id,
    procedimentoNome: procNome,
    procedimentoCodigo: procCod,
    tipoProcedimento: tipoProc as any,
    // REGRA OBRIGATÓRIA: Utilizar exclusivamente a data do agendamento (appointment_date)
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
  return novaDemanda;
};

/**
 * Retorna as demandas com filtros opcionais
 * Consulta a sincronização real com a Regulação
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
  // Sincroniza com agendamentos reais da Regulação
  let list = await sincronizarComRegulacao();

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
        const normApelido = normalizeTransporteText(d.pacienteApelido || '');
        const normCpf = (d.pacienteCpf || '').replace(/\D/g, '');
        const normProc = normalizeTransporteText(d.procedimentoNome);
        const codProc = (d.procedimentoCodigo || '').toLowerCase();
        return (
          normNome.includes(query) ||
          normApelido.includes(query) ||
          (cleanDigits && normCpf.includes(cleanDigits)) ||
          normProc.includes(query) ||
          codProc.includes(query)
        );
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
 * Sincronização automática com a Regulação (/Regulacao/Acompanhar)
 * Consulta os agendamentos reais existentes no Supabase e deriva as demandas de transporte.
 * NÃO inventa cidades, NÃO usa data de solicitação e NÃO gera dados fictícios.
 */
export const sincronizarComRegulacao = async (agendamentosFornecidos?: ConsultaAgendamento[]): Promise<TransporteDemanda[]> => {
  let agendamentosLista = agendamentosFornecidos;

  // Se não foi fornecida lista em memória, consulta os agendamentos reais do módulo de Regulação
  if (!agendamentosLista || agendamentosLista.length === 0) {
    try {
      const ags = await getAgendamentos();
      if (Array.isArray(ags) && ags.length > 0) {
        agendamentosLista = ags;
      }
    } catch (err) {
      console.warn('[transporteService] getAgendamentos falhou, tentando consulta direta ao Supabase...', err);
    }

    if (!agendamentosLista || agendamentosLista.length === 0) {
      const { data, error } = await supabase
        .from('consultas_agendamentos')
        .select(`
          id, patient_id, procedimento_id, appointment_date, appointment_time, solicitation_date,
          status, priority, is_deleted, prestador, municipio, convenio,
          paciente:consultas_pacientes(id, name, cpf, nickname, birth_date, phone),
          procedimento:consultas_procedimentos(id, name, code, type)
        `)
        .not('appointment_date', 'is', null);

      if (error) {
        console.error('[transporteService] Erro ao sincronizar consultas_agendamentos:', error);
        throw new Error(error.message || 'Falha de comunicação com o banco de dados Supabase.');
      }

      agendamentosLista = (data || []) as any[];
    }
  }

  // Lista local prévia para preservar alocações e contatos de confirmação já efetuados
  const localList = getLocalDemandas();
  const mapaDemandasExistentes = new Map<string, TransporteDemanda>();
  localList.forEach(d => {
    if (d.agendamentoId) {
      mapaDemandasExistentes.set(d.agendamentoId, d);
    }
  });

  // Filtragem estrita dos critérios de inclusão:
  // - Possuir appointment_date preenchido (data de agendamento realizada)
  // - NÃO estar cancelado, excluído, em fila de espera ou aguardando data
  // - Não estar deletado (is_deleted !== true)
  const statusExcluidos = new Set([
    'Cancelado',
    'Excluído',
    'Fila de espera',
    'Aguardando Data',
    'Pausada',
    'Suspensa — Exclusão Pendente'
  ]);

  const demandasResultado: TransporteDemanda[] = [];

  (agendamentosLista || []).forEach(booking => {
    if (!booking) return;
    if (booking.is_deleted || (booking as any).isDeleted) return;
    if (!booking.appointment_date || booking.appointment_date.trim() === '') return;

    const statusBooking = (booking.status || '').trim();
    if (statusExcluidos.has(statusBooking)) return;

    const pac = booking.paciente;
    const proc = booking.procedimento;

    // Destino: se não informado, não inventar cidade. Exibir "Destino não informado"
    const destinoRaw = (booking.municipio || booking.prestador || '').trim();
    let destinoFinal = 'Destino não informado';
    if (destinoRaw) {
      destinoFinal = destinoRaw.toUpperCase().includes('MG') ? destinoRaw : `${destinoRaw} — MG`;
    }

    // Verificar se já existia demanda vinculada a este agendamento real
    const existente = mapaDemandasExistentes.get(booking.id);

    // Se houve remarcação de data na Regulação, atualiza data e desvincula se estava alocado em data diferente
    let statusTransporte = existente?.statusTransporte || 'Aguardando vaga';
    let viagemId = existente?.viagemId;
    let veiculoId = existente?.veiculoId;
    let motoristaId = existente?.motoristaId;

    if (existente && existente.dataAtendimento !== booking.appointment_date) {
      viagemId = undefined;
      veiculoId = undefined;
      motoristaId = undefined;
      statusTransporte = 'Aguardando vaga';
    }

    const demanda: TransporteDemanda = {
      id: existente?.id || `dem_${booking.id}`,
      agendamentoId: booking.id,
      pacienteId: booking.patient_id || pac?.id || '',
      pacienteNome: pac?.name || 'Paciente Não Identificado',
      pacienteApelido: pac?.nickname || 'Não informado',
      pacienteCpf: pac?.cpf || 'Não informado',
      pacienteDataNascimento: pac?.birth_date || (pac as any)?.birthDate || '',
      pacienteTelefone: pac?.phone || '',
      procedimentoId: booking.procedimento_id || proc?.id || '',
      procedimentoNome: proc?.name || 'Procedimento',
      procedimentoCodigo: proc?.code || '',
      especialista: proc?.especialista?.nome || (proc?.especialista as any)?.name || '',
      tipoProcedimento: (proc?.type as any) || 'Consulta',
      // REGRA OBRIGATÓRIA: Utilizar exclusivamente a data do agendamento (appointment_date), NUNCA da solicitação
      dataAtendimento: booking.appointment_date,
      horaAtendimento: booking.appointment_time ? booking.appointment_time.substring(0, 5) : '08:00',
      municipioDestino: destinoFinal,
      estabelecimentoSaude: booking.prestador || booking.convenio || '',
      enderecoAtendimento: '',
      necessitaAcompanhante: existente ? existente.necessitaAcompanhante : false,
      qtdAcompanhantes: existente ? existente.qtdAcompanhantes : 0,
      necessitaVeiculoAdaptado: existente ? existente.necessitaVeiculoAdaptado : false,
      observacoes: existente?.observacoes || '',
      prioridade: (booking.priority as any) || 'Normal',
      statusTransporte,
      viagemId,
      veiculoId,
      motoristaId,
      alocadoEm: existente?.alocadoEm,
      alocadoPor: existente?.alocadoPor,
      historicoConfirmacao: existente?.historicoConfirmacao || [],
      createdAt: existente?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    demandasResultado.push(demanda);
  });

  saveLocalDemandas(demandasResultado);
  return demandasResultado;
};
