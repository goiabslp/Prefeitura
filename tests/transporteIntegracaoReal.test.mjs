import test from 'node:test';
import assert from 'node:assert/strict';
import { 
  agruparHierarquicoDataDestino,
  calcularIndicadoresTransporte,
  normalizeCityTransporte,
  filtrarVeiculosElegiveisTransporte
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

test('4. isAgendamentoEfetivo inclui estritamente status Agendado e rejeita histórico Realizado e solicitações', () => {
  // Caso válido: Somente status 'Agendado' com appointment_date válida
  assert.equal(isAgendamentoEfetivo({ status: 'Agendado', appointment_date: '2026-11-20' }), true);

  // Rejeição estrita de atendimentos históricos já realizados (evita os 495 registros excedentes)
  assert.equal(isAgendamentoEfetivo({ status: 'Realizado', appointment_date: '2026-02-27' }), false);

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

test('7. filtrarVeiculosElegiveisTransporte classifica viagem para o destino com vagas como LARANJA', () => {
  const vehicles = [
    { id: 'v1', plate: 'ABC-1234', model: 'Van Ducato', passengerCapacity: 16, capacity: 16, status: 'Ativo' }
  ];
  const schedules = [
    {
      id: 'sch_ipatinga_01',
      vehicleId: 'v1',
      driverId: 'mot_01',
      departureDateTime: '2026-11-20T07:00:00',
      destination: 'IPATINGA - MG',
      status: 'agendado',
      passengers: [{ id: 'p1', name: 'Paciente 1' }] // 1 passageiro ocupando de 15 vagas
    }
  ];

  const res = filtrarVeiculosElegiveisTransporte({
    dataAlvo: '2026-11-20',
    destAlvo: 'IPATINGA',
    schedules,
    vehicles
  });

  assert.equal(res.veiculosLaranja.length, 1);
  assert.equal(res.veiculosLaranja[0].tipo, 'laranja');
  assert.equal(res.veiculosLaranja[0].vagasLivres, 14); // 16 - 1 motorista - 1 passageiro = 14
  assert.equal(res.vagasDisponiveis, 14);
});

test('8. Veículo com viagem lotada (0 vagas livres) é estritamente OCULTADO', () => {
  const vehicles = [
    { id: 'v_lotado', plate: 'LOT-9999', model: 'Carro Spin', passengerCapacity: 4, capacity: 4, status: 'Ativo' }
  ];
  const schedules = [
    {
      id: 'sch_lotado',
      vehicleId: 'v_lotado',
      driverId: 'mot_01',
      departureDateTime: '2026-11-20T08:00:00',
      destination: 'IPATINGA - MG',
      status: 'agendado',
      passengers: [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }] // 3 passageiros = capacidade máxima (4 - 1 = 3)
    }
  ];

  const res = filtrarVeiculosElegiveisTransporte({
    dataAlvo: '2026-11-20',
    destAlvo: 'IPATINGA',
    schedules,
    vehicles
  });

  assert.equal(res.veiculosLaranja.length, 0, 'Viagem lotada deve ser ocultada');
  assert.equal(res.vagasDisponiveis, 0);
});

test('9. Veículo com viagem para outra cidade é OCULTADO (proibido misturar destinos)', () => {
  const vehicles = [
    { id: 'v_bh', plate: 'BHZ-1111', model: 'Van Master', passengerCapacity: 16, capacity: 16, status: 'Ativo' }
  ];
  const schedules = [
    {
      id: 'sch_bh',
      vehicleId: 'v_bh',
      driverId: 'mot_02',
      departureDateTime: '2026-11-20T05:00:00',
      destination: 'BELO HORIZONTE - MG', // Destino diferente de Ipatinga
      status: 'agendado',
      passengers: []
    }
  ];

  const res = filtrarVeiculosElegiveisTransporte({
    dataAlvo: '2026-11-20',
    destAlvo: 'IPATINGA',
    schedules,
    vehicles
  });

  assert.equal(res.veiculosLaranja.length, 0, 'Viagem com destino diferente deve ser ocultada');
  assert.equal(res.vagasDisponiveis, 0);
});

test('10. Veículo livre sem nenhuma viagem na data é classificado como VERDE', () => {
  const vehicles = [
    { id: 'v_livre', plate: 'LIV-2222', model: 'Van Sprinter', passengerCapacity: 18, capacity: 18, status: 'Ativo' }
  ];
  const schedules = []; // Nenhuma viagem agendada na data

  const res = filtrarVeiculosElegiveisTransporte({
    dataAlvo: '2026-11-20',
    destAlvo: 'IPATINGA',
    schedules,
    vehicles
  });

  assert.equal(res.veiculosVerdes.length, 1);
  assert.equal(res.veiculosVerdes[0].tipo, 'verde');
  assert.equal(res.veiculosVerdes[0].vagasLivres, 17); // 18 - 1 = 17 lugares
  // Veículo verde não tem viagem criada ainda, portanto não soma em vagasDisponiveis de viagens existentes
  assert.equal(res.vagasDisponiveis, 0);
  assert.equal(res.veiculosDisponiveis, 1);
});

test('11. Veículo em manutenção é OCULTADO de ambas as categorias', () => {
  const vehicles = [
    { id: 'v_manut', plate: 'MAN-3333', model: 'Ambulância', passengerCapacity: 3, capacity: 3, status: 'Manutenção', maintenanceStatus: 'Em Manutenção' }
  ];
  const schedules = [];

  const res = filtrarVeiculosElegiveisTransporte({
    dataAlvo: '2026-11-20',
    destAlvo: 'IPATINGA',
    schedules,
    vehicles
  });

  assert.equal(res.veiculosVerdes.length, 0, 'Veículo em manutenção deve ser ocultado');
  assert.equal(res.veiculosElegiveis.length, 0);
});

test('12. Ordem estrita: Veículos LARANJA aparecem antes dos VERDES', () => {
  const vehicles = [
    { id: 'v_verde', plate: 'VER-0001', model: 'Van', passengerCapacity: 10, capacity: 10, status: 'Ativo' },
    { id: 'v_laranja', plate: 'LAR-0002', model: 'Micro-ônibus', passengerCapacity: 20, capacity: 20, status: 'Ativo' }
  ];
  const schedules = [
    {
      id: 'sch_laranja',
      vehicleId: 'v_laranja',
      departureDateTime: '2026-11-20T08:00:00',
      destination: 'IPATINGA - MG',
      status: 'agendado',
      passengers: []
    }
  ];

  const res = filtrarVeiculosElegiveisTransporte({
    dataAlvo: '2026-11-20',
    destAlvo: 'IPATINGA',
    schedules,
    vehicles
  });

  assert.equal(res.veiculosElegiveis.length, 2);
  assert.equal(res.veiculosElegiveis[0].tipo, 'laranja', 'Primeiro deve ser Laranja');
  assert.equal(res.veiculosElegiveis[1].tipo, 'verde', 'Segundo deve ser Verde');
});

test('13. Sem data selecionada, retorna estritamente listas vazias e 0 vagas', () => {
  const res = filtrarVeiculosElegiveisTransporte({
    dataAlvo: '',
    destAlvo: 'IPATINGA',
    schedules: [{ id: 's1', departureDateTime: '2026-11-20T08:00:00' }],
    vehicles: [{ id: 'v1', status: 'Ativo', passengerCapacity: 5 }]
  });

  assert.equal(res.veiculosElegiveis.length, 0);
  assert.equal(res.vagasDisponiveis, 0);
  assert.equal(res.veiculosDisponiveis, 0);
});

test('14. Sem destino selecionado (ou "Destino não informado"), não cria veículos laranja de outras cidades', () => {
  const vehicles = [
    { id: 'v_bh', plate: 'BHZ-9999', model: 'Van', passengerCapacity: 10, capacity: 10, status: 'Ativo' }
  ];
  const schedules = [
    {
      id: 'sch_bh',
      vehicleId: 'v_bh',
      departureDateTime: '2026-11-20T08:00:00',
      destination: 'BELO HORIZONTE - MG',
      status: 'agendado',
      passengers: []
    }
  ];

  const resSemDestino = filtrarVeiculosElegiveisTransporte({
    dataAlvo: '2026-11-20',
    destAlvo: '',
    schedules,
    vehicles
  });

  assert.equal(resSemDestino.veiculosLaranja.length, 0, 'Sem destino selecionado não pode haver veículo Laranja');
  assert.equal(resSemDestino.vagasDisponiveis, 0);

  const resNaoInformado = filtrarVeiculosElegiveisTransporte({
    dataAlvo: '2026-11-20',
    destAlvo: 'Destino não informado',
    schedules,
    vehicles
  });

  assert.equal(resNaoInformado.veiculosLaranja.length, 0, 'Destino não informado não pode misturar viagens de cidades específicas');
});

test('15. Auditoria de divergência: 148 agendamentos com status Agendado vs 495 Realizados gera exatamente 148 demandas', async () => {
  const agendamentosMistos = [];

  // 148 agendamentos ativos na Regulação com status 'Agendado'
  for (let i = 1; i <= 148; i++) {
    agendamentosMistos.push({
      id: `ag_ativo_${i}`,
      patient_id: `pac_${i}`,
      status: 'Agendado',
      appointment_date: '2026-11-27',
      appointment_time: '07:30',
      municipio: 'Ipatinga - MG',
      paciente: { id: `pac_${i}`, name: `Paciente Ativo ${i}`, cpf: `000.000.${String(i).padStart(3, '0')}-00` },
      procedimento: { id: `proc_${i}`, name: 'Consulta Médica', code: '0749' }
    });
  }

  // 495 atendimentos passados com status 'Realizado' (histórico que causava a contagem de 643)
  for (let j = 1; j <= 495; j++) {
    agendamentosMistos.push({
      id: `ag_historico_${j}`,
      patient_id: `pac_hist_${j}`,
      status: 'Realizado',
      appointment_date: '2026-02-27',
      appointment_time: '08:00',
      municipio: 'Belo Horizonte - MG',
      paciente: { id: `pac_hist_${j}`, name: `Paciente Passado ${j}` },
      procedimento: { id: `proc_hist_${j}`, name: 'Consulta Psiquiatria', code: '8822' }
    });
  }

  // Sincronização estrita da Central de Transporte
  const demandas = await sincronizarComRegulacao(agendamentosMistos);

  // A Central deve retornar EXATAMENTE 148 demandas, descartando todos os 495 atendimentos passados
  assert.equal(demandas.length, 148, 'Deve conter rigorosamente 148 demandas correspondentes aos 148 agendamentos ativos');
  assert.equal(demandas.every(d => d.dataAtendimento === '2026-11-27'), true, 'Todas as 148 demandas devem ser de agendamentos futuros válidos');
});
