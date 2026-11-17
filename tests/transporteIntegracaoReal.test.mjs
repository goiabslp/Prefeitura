import test from 'node:test';
import assert from 'node:assert/strict';
import { 
  agruparHierarquicoDataDestino,
  calcularIndicadoresTransporte,
  normalizeCityTransporte
} from '../utils/transporteRules.ts';
import {
  isAgendamentoEfetivo,
  sincronizarComRegulacao,
  alocarPacienteEmViagem
} from '../services/transporteService.ts';

test('1. Indicadores reais retornam estritamente 0 quando vazios (zero mocks)', () => {
  const demandasVazias = [];
  const veiculosVazios = [];
  const viagensVazias = [];

  const ind = calcularIndicadoresTransporte(demandasVazias, veiculosVazios, viagensVazias);

  assert.equal(ind.totalPacientes, 0, 'Total de pacientes deve ser 0 quando vazio');
  assert.equal(ind.aguardando, 0, 'Aguardando deve ser 0 quando vazio');
  assert.equal(ind.alocados, 0, 'Alocados deve ser 0 quando vazio');
  assert.equal(ind.confirmados, 0, 'Confirmados deve ser 0 quando vazio');
  assert.equal(ind.vagasDisponiveis, 0, 'Vagas disponíveis deve ser 0 quando vazio');
  assert.equal(ind.veiculosDisponiveis, 0, 'Veículos disponíveis deve ser 0 quando vazio');
});

test('2. Agrupamento trata agendamento sem destino como "Destino não informado" sem inventar cidade', () => {
  const demandas = [
    {
      id: 'dem_real_01',
      agendamentoId: 'ag_real_01',
      pacienteId: 'pac_01',
      pacienteNome: 'MARIA APARECIDA DA SILVA',
      pacienteCpf: '123.456.789-00',
      procedimentoId: 'proc_01',
      procedimentoNome: 'CONSULTA CARDIOLOGIA',
      tipoProcedimento: 'Consulta',
      dataAtendimento: '2026-11-20',
      horaAtendimento: '08:00',
      municipioDestino: 'Destino não informado',
      necessitaAcompanhante: false,
      qtdAcompanhantes: 0,
      necessitaVeiculoAdaptado: false,
      prioridade: 'Normal',
      statusTransporte: 'Aguardando vaga',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];

  const grupos = agruparHierarquicoDataDestino(demandas);
  assert.equal(grupos.length, 1);
  assert.equal(grupos[0].data, '2026-11-20');
  assert.equal(grupos[0].destinos.length, 1);
  assert.equal(grupos[0].destinos[0].destino, 'Destino não informado');
  assert.equal(grupos[0].destinos[0].demandas[0].pacienteNome, 'MARIA APARECIDA DA SILVA');
});

test('3. Agrupamento hierárquico ordena pacientes pelo horário do agendamento', () => {
  const demandas = [
    {
      id: 'dem_real_02',
      agendamentoId: 'ag_real_02',
      pacienteId: 'pac_02',
      pacienteNome: 'PACIENTE DA TARDE',
      procedimentoNome: 'ORTOPEDIA',
      tipoProcedimento: 'Consulta',
      dataAtendimento: '2026-11-20',
      horaAtendimento: '14:30',
      municipioDestino: 'IPATINGA - MG',
      statusTransporte: 'Aguardando vaga'
    },
    {
      id: 'dem_real_03',
      agendamentoId: 'ag_real_03',
      pacienteId: 'pac_03',
      pacienteNome: 'PACIENTE DA MANHÃ',
      procedimentoNome: 'CARDIOLOGIA',
      tipoProcedimento: 'Consulta',
      dataAtendimento: '2026-11-20',
      horaAtendimento: '07:15',
      municipioDestino: 'IPATINGA - MG',
      statusTransporte: 'Aguardando vaga'
    }
  ];

  const grupos = agruparHierarquicoDataDestino(demandas);
  const pacientesOrdenados = grupos[0].destinos[0].demandas;
  assert.equal(pacientesOrdenados[0].horaAtendimento, '07:15');
  assert.equal(pacientesOrdenados[1].horaAtendimento, '14:30');
});

test('4. isAgendamentoEfetivo inclui estritamente status Agendado/Realizado e rejeita solicitações', () => {
  // Casos válidos
  assert.equal(isAgendamentoEfetivo({ status: 'Agendado', appointment_date: '2026-11-20' }), true);
  assert.equal(isAgendamentoEfetivo({ status: 'Realizado', appointment_date: '2026-11-20' }), true);

  // Rejeição estrita de solicitações e filas (mesmo com datas residuais da solicitação)
  assert.equal(isAgendamentoEfetivo({ status: 'Solicitado', appointment_date: '2026-09-11', solicitation_date: '2026-09-11' }), false);
  assert.equal(isAgendamentoEfetivo({ status: 'Fila de espera', appointment_date: '2026-09-11' }), false);
  assert.equal(isAgendamentoEfetivo({ status: 'Aguardando Data', appointment_date: '2026-09-16' }), false);
  assert.equal(isAgendamentoEfetivo({ status: 'Pausada', appointment_date: '2026-11-20' }), false);
  assert.equal(isAgendamentoEfetivo({ status: 'Cancelado', appointment_date: '2026-11-20' }), false);
  assert.equal(isAgendamentoEfetivo({ status: 'Excluído', appointment_date: '2026-11-20' }), false);
  assert.equal(isAgendamentoEfetivo({ status: 'Agendado', appointment_date: '' }), false);
  assert.equal(isAgendamentoEfetivo({ status: 'Agendado', appointment_date: null }), false);
});

test('5. Agrupamento utiliza EXCLUSIVAMENTE appointment_date e descarta solicitações da fila', async () => {
  const agendamentosMistos = [
    // 2 agendamentos confirmados para novembro
    {
      id: 'ag_conf_01',
      patient_id: 'pac_01',
      procedimento_id: 'proc_01',
      status: 'Agendado',
      appointment_date: '2026-11-20',
      appointment_time: '08:00:00',
      solicitation_date: '2026-09-10', // data da solicitação deve ser IGNORADA
      municipio: 'Ipatinga - MG',
      paciente: { id: 'pac_01', name: 'Maria Silva', cpf: '111.111.111-11' },
      procedimento: { id: 'proc_01', name: 'Consulta Cardiologia', code: '8717' }
    },
    {
      id: 'ag_conf_02',
      patient_id: 'pac_02',
      procedimento_id: 'proc_02',
      status: 'Agendado',
      appointment_date: '2026-11-20',
      appointment_time: '09:00:00',
      solicitation_date: '2026-09-12',
      municipio: 'Ipatinga - MG',
      paciente: { id: 'pac_02', name: 'João Santos', cpf: '222.222.222-22' },
      procedimento: { id: 'proc_02', name: 'Exame Ressonância', code: '8718' }
    },
    // Solicitações em fila em setembro (NÃO devem virar demanda nem agrupar em setembro)
    {
      id: 'sol_01',
      patient_id: 'pac_03',
      procedimento_id: 'proc_03',
      status: 'Solicitado',
      appointment_date: '2026-09-11',
      solicitation_date: '2026-09-11',
      paciente: { id: 'pac_03', name: 'Fila Paciente 1', cpf: '333.333.333-33' },
      procedimento: { id: 'proc_03', name: 'Consulta Oftalmo', code: '8719' }
    },
    {
      id: 'sol_02',
      patient_id: 'pac_04',
      status: 'Fila de espera',
      appointment_date: '2026-09-16',
      solicitation_date: '2026-09-16',
      paciente: { id: 'pac_04', name: 'Fila Paciente 2', cpf: '444.444.444-44' }
    }
  ];

  const demandas = await sincronizarComRegulacao(agendamentosMistos);

  // Apenas os 2 agendamentos confirmados devem ser gerados
  assert.equal(demandas.length, 2, 'Apenas agendamentos confirmados geram demandas');
  assert.equal(demandas.every(d => d.dataAtendimento === '2026-11-20'), true, 'Data deve ser exclusivamente a do agendamento (20/11/2026)');

  // Agrupamento hierárquico
  const grupos = agruparHierarquicoDataDestino(demandas);
  assert.equal(grupos.length, 1);
  assert.equal(grupos[0].data, '2026-11-20');
  assert.equal(grupos[0].dataFormatada, '20/11/2026');
  assert.equal(grupos[0].totalPacientes, 2);
});

test('6. Múltiplos procedimentos para o mesmo paciente não duplicam contagem nem vaga', async () => {
  const demandasMesmoPaciente = [
    {
      id: 'dem_pac_multi_01',
      agendamentoId: 'ag_m1',
      pacienteId: 'pac_multi',
      pacienteNome: 'Raimundo Carvalho',
      pacienteCpf: '987.654.321-00',
      procedimentoId: 'proc_cardio',
      procedimentoNome: 'Consulta Cardiologia',
      tipoProcedimento: 'Consulta',
      dataAtendimento: '2026-11-20',
      horaAtendimento: '08:00',
      municipioDestino: 'Ipatinga - MG',
      necessitaAcompanhante: false,
      qtdAcompanhantes: 0,
      statusTransporte: 'Aguardando vaga',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'dem_pac_multi_02',
      agendamentoId: 'ag_m2',
      pacienteId: 'pac_multi',
      pacienteNome: 'Raimundo Carvalho',
      pacienteCpf: '987.654.321-00',
      procedimentoId: 'proc_echo',
      procedimentoNome: 'Exame Ecocardiograma',
      tipoProcedimento: 'Exame',
      dataAtendimento: '2026-11-20',
      horaAtendimento: '10:30',
      municipioDestino: 'Ipatinga - MG',
      necessitaAcompanhante: false,
      qtdAcompanhantes: 0,
      statusTransporte: 'Aguardando vaga',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];

  // 1. Agrupamento preserva ambos os procedimentos mas conta 1 paciente único
  const grupos = agruparHierarquicoDataDestino(demandasMesmoPaciente);
  assert.equal(grupos[0].totalPacientes, 1, 'Total de pacientes únicos deve ser 1');
  assert.equal(grupos[0].destinos[0].totalPacientes, 1, 'Total de pacientes únicos no destino deve ser 1');
  assert.equal(grupos[0].destinos[0].demandas.length, 2, 'Preserva ambos os procedimentos agendados');

  // 2. Indicadores do dashboard contam 1 paciente único
  const ind = calcularIndicadoresTransporte(demandasMesmoPaciente);
  assert.equal(ind.totalPacientes, 1, 'Indicador totalPacientes deve ser 1');

  // 3. Ao vincular o segundo procedimento na mesma viagem, não consome vaga adicional
  const veiculo = {
    id: 'veic_01',
    plate: 'ABC-1234',
    passengerCapacity: 4,
    capacity: 4
  };
  const viagem = {
    id: 'viagem_01',
    vehicleId: 'veic_01',
    driverId: 'mot_01',
    departureDateTime: '2026-11-20T07:00:00',
    destination: 'Ipatinga - MG',
    passengers: [],
    patientCount: 0,
    companionCount: 0
  };

  // Prepara demandas locais em memória para o teste unitário
  const { saveLocalDemandas } = await import('../services/transporteService.ts');
  saveLocalDemandas(demandasMesmoPaciente);

  // Aloca primeiro procedimento
  const res1 = await alocarPacienteEmViagem(demandasMesmoPaciente[0].id, viagem, veiculo, 'Operador');
  assert.equal(res1.success, true);
  assert.equal(viagem.passengers.length, 1);
  assert.equal(viagem.patientCount, 1);

  // Aloca segundo procedimento do mesmo paciente na mesma viagem
  const res2 = await alocarPacienteEmViagem(demandasMesmoPaciente[1].id, viagem, veiculo, 'Operador');
  assert.equal(res2.success, true);
  // Não duplica passageiro nem incrementa contagem de pacientes
  assert.equal(viagem.passengers.length, 1, 'Não deve duplicar passageiro na mesma viagem');
  assert.equal(viagem.patientCount, 1, 'patientCount permanece 1');
  assert.equal(viagem.passengers[0].procedureName.includes('Consulta Cardiologia'), true);
  assert.equal(viagem.passengers[0].procedureName.includes('Exame Ecocardiograma'), true);
});
