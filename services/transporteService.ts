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

const STORAGE_KEY = 'prefeitura_transporte_demandas_v1';

// Base de dados inicial padrão alinhada à especificação visual da Central de Transporte
const getDemandasIniciaisPadrao = (): TransporteDemanda[] => {
  const result: TransporteDemanda[] = [];

  // 1. Data 20/11/2026 — Ipatinga — MG (10 pacientes)
  result.push(
    {
      id: 'dem_ipa_01',
      agendamentoId: 'ag_ipa_01',
      pacienteId: 'pac_ipa_01',
      pacienteNome: 'Maria Aparecida Silva',
      pacienteApelido: 'Maria',
      pacienteCpf: '123.456.789-00',
      procedimentoId: 'proc_cardio',
      procedimentoNome: 'Consulta – Cardiologia',
      procedimentoCodigo: '0717',
      tipoProcedimento: 'Consulta',
      dataAtendimento: '2026-11-20',
      horaAtendimento: '08:00',
      municipioDestino: 'Ipatinga — MG',
      estabelecimentoSaude: 'Hospital Márcio Cunha',
      necessitaAcompanhante: true,
      qtdAcompanhantes: 1,
      necessitaVeiculoAdaptado: false,
      prioridade: 'Normal',
      statusTransporte: 'Aguardando vaga',
      createdAt: '2026-11-15T08:00:00Z',
      updatedAt: '2026-11-15T08:00:00Z'
    },
    {
      id: 'dem_ipa_02',
      agendamentoId: 'ag_ipa_02',
      pacienteId: 'pac_ipa_02',
      pacienteNome: 'Raimundo Carvalho Souza',
      pacienteApelido: 'Raimundo',
      pacienteCpf: '987.654.321-00',
      procedimentoId: 'proc_ultra',
      procedimentoNome: 'Exame – Ultrassom',
      procedimentoCodigo: '0034',
      tipoProcedimento: 'Exame',
      dataAtendimento: '2026-11-20',
      horaAtendimento: '09:20',
      municipioDestino: 'Ipatinga — MG',
      estabelecimentoSaude: 'Centro de Diagnóstico Imagem',
      necessitaAcompanhante: false,
      qtdAcompanhantes: 0,
      necessitaVeiculoAdaptado: true,
      prioridade: 'Normal',
      statusTransporte: 'Aguardando vaga',
      createdAt: '2026-11-15T08:30:00Z',
      updatedAt: '2026-11-15T08:30:00Z'
    },
    {
      id: 'dem_ipa_03',
      agendamentoId: 'ag_ipa_03',
      pacienteId: 'pac_ipa_03',
      pacienteNome: 'Nilton Marques',
      pacienteApelido: 'Nilton',
      pacienteCpf: '456.789.123-00',
      procedimentoId: 'proc_orto',
      procedimentoNome: 'Consulta – Ortopedia',
      procedimentoCodigo: '0210',
      tipoProcedimento: 'Consulta',
      dataAtendimento: '2026-11-20',
      horaAtendimento: '10:00',
      municipioDestino: 'Ipatinga — MG',
      estabelecimentoSaude: 'Clínica Ortopédica Vale do Aço',
      necessitaAcompanhante: true,
      qtdAcompanhantes: 1,
      necessitaVeiculoAdaptado: false,
      prioridade: 'Normal',
      statusTransporte: 'Alocado',
      viagemId: 'trip_qxv_4b21',
      veiculoId: 'veh_qxv_4b21',
      createdAt: '2026-11-15T09:00:00Z',
      updatedAt: '2026-11-15T09:00:00Z'
    },
    {
      id: 'dem_ipa_04',
      agendamentoId: 'ag_ipa_04',
      pacienteId: 'pac_ipa_04',
      pacienteNome: 'Vanilda Pereira dos Santos',
      pacienteApelido: 'Vanilda',
      pacienteCpf: '321.654.987-00',
      procedimentoId: 'proc_ressonancia',
      procedimentoNome: 'Exame – Ressonância',
      procedimentoCodigo: '0108',
      tipoProcedimento: 'Exame',
      dataAtendimento: '2026-11-20',
      horaAtendimento: '10:30',
      municipioDestino: 'Ipatinga — MG',
      estabelecimentoSaude: 'Hospital Márcio Cunha II',
      necessitaAcompanhante: false,
      qtdAcompanhantes: 0,
      necessitaVeiculoAdaptado: false,
      prioridade: 'Normal',
      statusTransporte: 'Alocado',
      viagemId: 'trip_qxv_4b21',
      veiculoId: 'veh_qxv_4b21',
      createdAt: '2026-11-15T09:30:00Z',
      updatedAt: '2026-11-15T09:30:00Z'
    },
    {
      id: 'dem_ipa_05',
      agendamentoId: 'ag_ipa_05',
      pacienteId: 'pac_ipa_05',
      pacienteNome: 'Sebastião Alves Moreira',
      pacienteApelido: 'Tião',
      pacienteCpf: '555.444.333-22',
      procedimentoId: 'proc_oftalmo',
      procedimentoNome: 'Consulta – Oftalmologia',
      procedimentoCodigo: '0412',
      tipoProcedimento: 'Consulta',
      dataAtendimento: '2026-11-20',
      horaAtendimento: '11:00',
      municipioDestino: 'Ipatinga — MG',
      necessitaAcompanhante: false,
      qtdAcompanhantes: 0,
      necessitaVeiculoAdaptado: false,
      prioridade: 'Normal',
      statusTransporte: 'Alocado',
      viagemId: 'trip_rfb_7c32',
      veiculoId: 'veh_rfb_7c32',
      createdAt: '2026-11-15T10:00:00Z',
      updatedAt: '2026-11-15T10:00:00Z'
    },
    {
      id: 'dem_ipa_06',
      agendamentoId: 'ag_ipa_06',
      pacienteId: 'pac_ipa_06',
      pacienteNome: 'Francisca Ferreira Lima',
      pacienteApelido: 'Dona Chica',
      pacienteCpf: '666.777.888-99',
      procedimentoId: 'proc_gineco',
      procedimentoNome: 'Exame – Mamografia',
      procedimentoCodigo: '0520',
      tipoProcedimento: 'Exame',
      dataAtendimento: '2026-11-20',
      horaAtendimento: '11:30',
      municipioDestino: 'Ipatinga — MG',
      necessitaAcompanhante: false,
      qtdAcompanhantes: 0,
      necessitaVeiculoAdaptado: false,
      prioridade: 'Normal',
      statusTransporte: 'Alocado',
      viagemId: 'trip_rfb_7c32',
      veiculoId: 'veh_rfb_7c32',
      createdAt: '2026-11-15T10:30:00Z',
      updatedAt: '2026-11-15T10:30:00Z'
    },
    {
      id: 'dem_ipa_07',
      agendamentoId: 'ag_ipa_07',
      pacienteId: 'pac_ipa_07',
      pacienteNome: 'Geraldo Antônio de Souza',
      pacienteApelido: 'Geraldinho',
      pacienteCpf: '777.888.999-00',
      procedimentoId: 'proc_urologia',
      procedimentoNome: 'Consulta – Urologia',
      procedimentoCodigo: '0630',
      tipoProcedimento: 'Consulta',
      dataAtendimento: '2026-11-20',
      horaAtendimento: '13:00',
      municipioDestino: 'Ipatinga — MG',
      necessitaAcompanhante: false,
      qtdAcompanhantes: 0,
      necessitaVeiculoAdaptado: false,
      prioridade: 'Normal',
      statusTransporte: 'Aguardando vaga',
      createdAt: '2026-11-15T11:00:00Z',
      updatedAt: '2026-11-15T11:00:00Z'
    },
    {
      id: 'dem_ipa_08',
      agendamentoId: 'ag_ipa_08',
      pacienteId: 'pac_ipa_08',
      pacienteNome: 'Luciana Martins Barbosa',
      pacienteApelido: 'Lu',
      pacienteCpf: '888.999.000-11',
      procedimentoId: 'proc_dermato',
      procedimentoNome: 'Consulta – Dermatologia',
      procedimentoCodigo: '0740',
      tipoProcedimento: 'Consulta',
      dataAtendimento: '2026-11-20',
      horaAtendimento: '14:00',
      municipioDestino: 'Ipatinga — MG',
      necessitaAcompanhante: false,
      qtdAcompanhantes: 0,
      necessitaVeiculoAdaptado: false,
      prioridade: 'Normal',
      statusTransporte: 'Aguardando vaga',
      createdAt: '2026-11-15T11:30:00Z',
      updatedAt: '2026-11-15T11:30:00Z'
    },
    {
      id: 'dem_ipa_09',
      agendamentoId: 'ag_ipa_09',
      pacienteId: 'pac_ipa_09',
      pacienteNome: 'José Benedito da Costa',
      pacienteApelido: 'Benedito',
      pacienteCpf: '999.000.111-22',
      procedimentoId: 'proc_eco',
      procedimentoNome: 'Exame – Ecocardiograma',
      procedimentoCodigo: '0850',
      tipoProcedimento: 'Exame',
      dataAtendimento: '2026-11-20',
      horaAtendimento: '14:45',
      municipioDestino: 'Ipatinga — MG',
      necessitaAcompanhante: false,
      qtdAcompanhantes: 0,
      necessitaVeiculoAdaptado: false,
      prioridade: 'Normal',
      statusTransporte: 'Aguardando vaga',
      createdAt: '2026-11-15T12:00:00Z',
      updatedAt: '2026-11-15T12:00:00Z'
    },
    {
      id: 'dem_ipa_10',
      agendamentoId: 'ag_ipa_10',
      pacienteId: 'pac_ipa_10',
      pacienteNome: 'Terezinha de Jesus Ribeiro',
      pacienteApelido: 'Dona Tetê',
      pacienteCpf: '111.222.444-55',
      procedimentoId: 'proc_neuro',
      procedimentoNome: 'Consulta – Neurologia',
      procedimentoCodigo: '0960',
      tipoProcedimento: 'Consulta',
      dataAtendimento: '2026-11-20',
      horaAtendimento: '15:30',
      municipioDestino: 'Ipatinga — MG',
      necessitaAcompanhante: false,
      qtdAcompanhantes: 0,
      necessitaVeiculoAdaptado: false,
      prioridade: 'Normal',
      statusTransporte: 'Aguardando vaga',
      createdAt: '2026-11-15T12:30:00Z',
      updatedAt: '2026-11-15T12:30:00Z'
    }
  );

  // 2. Data 20/11/2026 — Ponte Nova — MG (8 pacientes)
  const nomesPonteNova = [
    'Antônio Carlos Rezende', 'Cláudia Mendes Guimarães', 'Edson Pinheiro Duarte',
    'Helena Vasconcelos', 'Igor Nascimento', 'Joaquim Silva Prado',
    'Kelly Regina Ramos', 'Luiz Fernando Correa'
  ];
  nomesPonteNova.forEach((nome, idx) => {
    result.push({
      id: `dem_pn_${idx + 1}`,
      agendamentoId: `ag_pn_${idx + 1}`,
      pacienteId: `pac_pn_${idx + 1}`,
      pacienteNome: nome,
      pacienteApelido: nome.split(' ')[0],
      pacienteCpf: `123.987.${String(idx + 1).padStart(3, '0')}-00`,
      procedimentoId: `proc_pn_${idx + 1}`,
      procedimentoNome: idx % 2 === 0 ? 'Consulta – Especialidades' : 'Exame Laboratorial',
      procedimentoCodigo: `0${idx + 3}00`,
      tipoProcedimento: idx % 2 === 0 ? 'Consulta' : 'Exame',
      dataAtendimento: '2026-11-20',
      horaAtendimento: `${String(7 + idx).padStart(2, '0')}:00`,
      municipioDestino: 'Ponte Nova — MG',
      estabelecimentoSaude: 'Hospital Nossa Senhora das Dores',
      necessitaAcompanhante: false,
      qtdAcompanhantes: 0,
      necessitaVeiculoAdaptado: false,
      prioridade: 'Normal',
      statusTransporte: 'Aguardando vaga',
      createdAt: '2026-11-15T08:00:00Z',
      updatedAt: '2026-11-15T08:00:00Z'
    });
  });

  // 3. Data 21/11/2026 — Sábado (24 pacientes)
  for (let i = 1; i <= 24; i++) {
    result.push({
      id: `dem_21_${i}`,
      agendamentoId: `ag_21_${i}`,
      pacienteId: `pac_21_${i}`,
      pacienteNome: `Paciente Sábado ${i}`,
      pacienteApelido: `Apelido ${i}`,
      pacienteCpf: `210.000.${String(i).padStart(3, '0')}-11`,
      procedimentoId: `proc_21_${i}`,
      procedimentoNome: i % 2 === 0 ? 'Consulta – Clínica Geral' : 'Exame Geral',
      procedimentoCodigo: `02${String(i).padStart(2, '0')}`,
      tipoProcedimento: i % 2 === 0 ? 'Consulta' : 'Exame',
      dataAtendimento: '2026-11-21',
      horaAtendimento: `${String(7 + (i % 8)).padStart(2, '0')}:30`,
      municipioDestino: i % 2 === 0 ? 'Belo Horizonte — MG' : 'Ipatinga — MG',
      necessitaAcompanhante: i % 4 === 0,
      qtdAcompanhantes: i % 4 === 0 ? 1 : 0,
      necessitaVeiculoAdaptado: false,
      prioridade: 'Normal',
      statusTransporte: i <= 10 ? 'Alocado' : 'Aguardando vaga',
      createdAt: '2026-11-15T08:00:00Z',
      updatedAt: '2026-11-15T08:00:00Z'
    });
  }

  // 4. Data 24/11/2026 — Terça-feira (16 pacientes)
  for (let i = 1; i <= 16; i++) {
    result.push({
      id: `dem_24_${i}`,
      agendamentoId: `ag_24_${i}`,
      pacienteId: `pac_24_${i}`,
      pacienteNome: `Paciente Terça ${i}`,
      pacienteApelido: `Apelido ${i}`,
      pacienteCpf: `240.000.${String(i).padStart(3, '0')}-22`,
      procedimentoId: `proc_24_${i}`,
      procedimentoNome: 'Consulta Especializada',
      procedimentoCodigo: `04${String(i).padStart(2, '0')}`,
      tipoProcedimento: 'Consulta',
      dataAtendimento: '2026-11-24',
      horaAtendimento: `${String(8 + (i % 6)).padStart(2, '0')}:00`,
      municipioDestino: 'Ipatinga — MG',
      necessitaAcompanhante: false,
      qtdAcompanhantes: 0,
      necessitaVeiculoAdaptado: false,
      prioridade: 'Normal',
      statusTransporte: i <= 10 ? 'Alocado' : 'Aguardando vaga',
      createdAt: '2026-11-15T08:00:00Z',
      updatedAt: '2026-11-15T08:00:00Z'
    });
  }

  return result;
};

// Recupera dados locais como fallback imediato e cache offline
const getLocalDemandas = (): TransporteDemanda[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
    const defaultData = getDemandasIniciaisPadrao();
    saveLocalDemandas(defaultData);
    return defaultData;
  } catch (err) {
    console.warn('[transporteService] Erro ao ler demandas locais:', err);
    return getDemandasIniciaisPadrao();
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
 * Garante que agendamentos confirmados gerem demandas e alterações reflitam no transporte
 */
export const sincronizarComRegulacao = async (agendamentos?: ConsultaAgendamento[]): Promise<TransporteDemanda[]> => {
  let agendamentosLista = agendamentos;

  // Se não foi fornecida lista em memória, tenta buscar diretamente no Supabase
  if (!agendamentosLista || agendamentosLista.length === 0) {
    try {
      const { data, error } = await supabase
        .from('consultas_agendamentos')
        .select(`
          id, patient_id, procedimento_id, appointment_date, appointment_time, status,
          prestador, municipio, convenio, priority,
          transporte_necessario, transporte_acompanhantes, transporte_adaptado, transporte_observacoes,
          paciente:consultas_pacientes(id, name, cpf, nickname, birth_date, phone),
          procedimento:consultas_procedimentos(id, name, code, type)
        `)
        .not('appointment_date', 'is', null)
        .not('status', 'in', '("Cancelado", "Excluído", "Fila de espera", "Aguardando Data", "Pausada", "Suspensa — Exclusão Pendente")');

      if (!error && data && data.length > 0) {
        agendamentosLista = data as any;
      }
    } catch (err) {
      console.warn('[transporteService] Erro ao sincronizar consultas_agendamentos do Supabase:', err);
    }
  }

  const list = getLocalDemandas();
  if (!agendamentosLista || agendamentosLista.length === 0) {
    return list;
  }

  const bookingsMap = new Map<string, any>();
  agendamentosLista.forEach(b => bookingsMap.set(b.id, b));

  let modified = false;

  // 1. Atualizar ou cancelar demandas existentes
  list.forEach(demanda => {
    const booking = bookingsMap.get(demanda.agendamentoId);
    if (!booking) return;

    // Cancelamento ou Exclusão na Regulação
    const isCancelledInRegulacao = 
      booking.status === 'Cancelado' || 
      booking.status === 'Excluído' || 
      booking.is_deleted === true;

    if (isCancelledInRegulacao && demanda.statusTransporte !== 'Cancelado') {
      demanda.statusTransporte = 'Cancelado';
      demanda.observacoes = (demanda.observacoes ? demanda.observacoes + ' | ' : '') + 'Cancelado automaticamente via Regulação.';
      demanda.updatedAt = new Date().toISOString();
      modified = true;
    }

    // Remarcação de Data / Horário na Regulação
    if (booking.appointment_date && booking.appointment_date !== demanda.dataAtendimento) {
      demanda.dataAtendimento = booking.appointment_date;
      if (booking.appointment_time) {
        demanda.horaAtendimento = booking.appointment_time.substring(0, 5);
      }
      if (demanda.viagemId) {
        demanda.viagemId = undefined;
        demanda.veiculoId = undefined;
        demanda.motoristaId = undefined;
        demanda.statusTransporte = 'Aguardando vaga';
      }
      demanda.updatedAt = new Date().toISOString();
      modified = true;
    }

    // Atualiza apelido ou código se estiverem vazios
    const pac = booking.paciente;
    if (pac?.nickname && !demanda.pacienteApelido) {
      demanda.pacienteApelido = pac.nickname;
      modified = true;
    }
    const proc = booking.procedimento;
    if (proc?.code && !demanda.procedimentoCodigo) {
      demanda.procedimentoCodigo = proc.code;
      modified = true;
    }
  });

  // 2. Criar novas demandas para agendamentos confirmados que ainda não possuem demanda
  const idsDemandasExistentes = new Set(list.map(d => d.agendamentoId));

  agendamentosLista.forEach(booking => {
    if (!idsDemandasExistentes.has(booking.id)) {
      const isValido = 
        booking.appointment_date && 
        booking.status !== 'Cancelado' && 
        booking.status !== 'Excluído' && 
        booking.status !== 'Fila de espera' &&
        booking.status !== 'Aguardando Data';

      if (isValido) {
        const pac = booking.paciente;
        const proc = booking.procedimento;
        const destinoRaw = booking.municipio || booking.prestador || 'BELO HORIZONTE — MG';
        const destinoFinal = destinoRaw.toUpperCase().includes('MG') ? destinoRaw : `${destinoRaw} — MG`;

        const nova: TransporteDemanda = {
          id: `td_${booking.id}_${Date.now()}`,
          agendamentoId: booking.id,
          pacienteId: booking.patient_id || pac?.id || 'pac_desconhecido',
          pacienteNome: pac?.name || 'Paciente da Regulação',
          pacienteApelido: pac?.nickname || (pac?.name ? pac.name.split(' ')[0] : 'Não informado'),
          pacienteCpf: pac?.cpf || '000.000.000-00',
          pacienteDataNascimento: pac?.birth_date || '',
          pacienteTelefone: pac?.phone || '',
          procedimentoId: booking.procedimento_id || proc?.id || 'proc_geral',
          procedimentoNome: proc?.name || 'Consulta Médica',
          procedimentoCodigo: proc?.code || '0001',
          tipoProcedimento: (proc?.type as any) || 'Consulta',
          dataAtendimento: booking.appointment_date,
          horaAtendimento: booking.appointment_time ? booking.appointment_time.substring(0, 5) : '08:00',
          municipioDestino: destinoFinal,
          estabelecimentoSaude: booking.prestador || booking.convenio || '',
          necessitaAcompanhante: Boolean(booking.transporte_acompanhantes && booking.transporte_acompanhantes > 0),
          qtdAcompanhantes: booking.transporte_acompanhantes || 0,
          necessitaVeiculoAdaptado: Boolean(booking.transporte_adaptado),
          observacoes: booking.transporte_observacoes || '',
          prioridade: booking.priority || 'Normal',
          statusTransporte: 'Aguardando vaga',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        list.push(nova);
        idsDemandasExistentes.add(booking.id);
        modified = true;
      }
    }
  });

  if (modified) {
    saveLocalDemandas(list);
  }

  return list;
};
