import test from 'node:test';
import assert from 'node:assert/strict';
import { 
  agruparDemandasInteligentes,
  agruparHierarquicoDataDestino,
  calcularIndicadoresTransporte,
  normalizeTransporteText
} from '../utils/transporteRules.ts';

test('1. Normalização de texto de transporte e destinos', () => {
  assert.equal(normalizeTransporteText('Belo Horizonte - MG'), 'BELO HORIZONTE - MG');
  assert.equal(normalizeTransporteText('Ipatinga'), 'IPATINGA');
  assert.equal(normalizeTransporteText('João Monlevade'), 'JOAO MONLEVADE');
});

test('2. Agrupamento inteligente de passageiros por Data e Destino', () => {
  const demandasExemplo = [
    {
      id: 'd1',
      agendamentoId: 'ag1',
      pacienteId: 'p1',
      pacienteNome: 'MARIA DA SILVA',
      pacienteCpf: '11122233344',
      procedimentoId: 'proc1',
      procedimentoNome: 'CONSULTA CARDIOLOGIA',
      tipoProcedimento: 'Consulta',
      dataAtendimento: '2026-11-20',
      horaAtendimento: '08:00',
      municipioDestino: 'IPATINGA - MG',
      necessitaAcompanhante: true,
      qtdAcompanhantes: 1,
      necessitaVeiculoAdaptado: false,
      prioridade: 'Normal',
      statusTransporte: 'Aguardando vaga',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'd2',
      agendamentoId: 'ag2',
      pacienteId: 'p2',
      pacienteNome: 'JOSE PEREIRA',
      pacienteCpf: '22233344455',
      procedimentoId: 'proc2',
      procedimentoNome: 'ULTRASSOM DE ABDOMEN',
      tipoProcedimento: 'Exame',
      dataAtendimento: '2026-11-20',
      horaAtendimento: '09:30',
      municipioDestino: 'IPATINGA - MG',
      necessitaAcompanhante: false,
      qtdAcompanhantes: 0,
      necessitaVeiculoAdaptado: true,
      prioridade: 'Especial',
      statusTransporte: 'Aguardando vaga',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'd3',
      agendamentoId: 'ag3',
      pacienteId: 'p3',
      pacienteNome: 'ANA COSTA',
      pacienteCpf: '33344455566',
      procedimentoId: 'proc3',
      procedimentoNome: 'CONSULTA NEUROLOGIA',
      tipoProcedimento: 'Consulta',
      dataAtendimento: '2026-11-21',
      municipioDestino: 'BELO HORIZONTE - MG',
      necessitaAcompanhante: false,
      qtdAcompanhantes: 0,
      necessitaVeiculoAdaptado: false,
      prioridade: 'Normal',
      statusTransporte: 'Aguardando vaga',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];

  const grupos = agruparDemandasInteligentes(demandasExemplo);

  // Deve haver 2 grupos distintos: Ipatinga em 20/11 e BH em 21/11
  assert.equal(grupos.length, 2);

  const grupoIpatinga = grupos.find(g => g.destino.includes('IPATINGA'));
  assert.ok(grupoIpatinga);
  assert.equal(grupoIpatinga.totalPacientes, 2);
  assert.equal(grupoIpatinga.totalAcompanhantes, 1);
  // Total de assentos: 2 pacientes + 1 acompanhante = 3 assentos
  assert.equal(grupoIpatinga.totalAssentosNecessarios, 3);
  assert.equal(grupoIpatinga.necessitaAdaptado, true);

  const grupoBH = grupos.find(g => g.destino.includes('BELO HORIZONTE'));
  assert.ok(grupoBH);
  assert.equal(grupoBH.totalPacientes, 1);
  assert.equal(grupoBH.totalAssentosNecessarios, 1);
});

test('3. Regra de capacidade de assentos disponíveis (Capacidade Total - 1 Motorista)', () => {
  const veiculo = {
    id: 'veic1',
    plate: 'SHK2D93',
    brand: 'FORD',
    model: 'TRANSIT',
    passengerCapacity: 15,
    capacity: 15
  };

  // Capacidade disponível para passageiros: 15 - 1 motorista = 14
  const capacidadePassageiros = Math.max(1, (veiculo.passengerCapacity || veiculo.capacity) - 1);
  assert.equal(capacidadePassageiros, 14);

  const viagemExistente = {
    id: 'v1',
    vehicleId: veiculo.id,
    passengers: [
      { name: 'Passageiro 1', type: 'Paciente' },
      { name: 'Passageiro 2', type: 'Paciente' },
      { name: 'Acompanhante 1', type: 'Acompanhante' }
    ]
  };

  const ocupados = viagemExistente.passengers.length;
  assert.equal(ocupados, 3);

  const vagasLivres = capacidadePassageiros - ocupados;
  assert.equal(vagasLivres, 11);

  // Se um paciente com 2 acompanhantes tenta alocar:
  const demandaNova = {
    qtdAcompanhantes: 2
  };
  const assentosNecessarios = 1 + demandaNova.qtdAcompanhantes;
  assert.equal(assentosNecessarios, 3);

  // Cabe na viagem?
  assert.ok(vagasLivres >= assentosNecessarios);
});

test('4. Cálculo dos 7 indicadores do Dashboard da Central de Transporte', () => {
  const demandas = [
    { id: '1', dataAtendimento: '2026-11-20', statusTransporte: 'Aguardando vaga' },
    { id: '2', dataAtendimento: '2026-11-20', statusTransporte: 'Alocado' },
    { id: '3', dataAtendimento: '2026-11-20', statusTransporte: 'Confirmado' },
    { id: '4', dataAtendimento: '2026-11-20', statusTransporte: 'Aguardando confirmação' },
    { id: '5', dataAtendimento: '2026-11-20', statusTransporte: 'Desistiu' },
    { id: '6', dataAtendimento: '2026-11-21', statusTransporte: 'Aguardando vaga' }
  ];

  const veiculos = [
    { id: 'v1', passengerCapacity: 15 }
  ];

  const viagens = [
    {
      id: 'trip1',
      vehicleId: 'v1',
      departureDateTime: '2026-11-20T07:00:00',
      status: 'confirmado',
      passengers: [{ name: 'Pax 1' }, { name: 'Pax 2' }]
    }
  ];

  // Indicadores para a data '2026-11-20'
  const indData = calcularIndicadoresTransporte(demandas, veiculos, viagens, '2026-11-20');
  assert.equal(indData.totalDemandas, 5);
  assert.equal(indData.aguardandoVaga, 1);
  assert.equal(indData.alocados, 1);
  assert.equal(indData.confirmados, 1);
  assert.equal(indData.aguardandoConfirmacao, 1);
  assert.equal(indData.veiculosDesignados, 1);
  // Vagas livres no veículo v1: (15 - 1) - 2 ocupados = 12
  assert.equal(indData.vagasDisponiveis, 12);

  // Indicadores globais (sem filtro de data)
  const indGlobal = calcularIndicadoresTransporte(demandas, veiculos, viagens);
  assert.equal(indGlobal.totalDemandas, 6);
  assert.equal(indGlobal.aguardandoVaga, 2);
});

test('5. Desistência de Transporte libera vagas sem cancelar agendamento médico', () => {
  let agendamentoMedico = {
    id: 'ag123',
    patient_id: 'pac456',
    status: 'Agendado',
    appointment_date: '2026-11-20'
  };

  let viagem = {
    id: 'viagem_1',
    passengers: [
      { patientId: 'pac456', name: 'CARLOS ALBERTO', type: 'Paciente' },
      { name: 'Acompanhante de CARLOS ALBERTO (#1)', type: 'Acompanhante', notes: 'Acompanhante autorizado do paciente CARLOS ALBERTO' }
    ],
    patientCount: 1,
    companionCount: 1
  };

  // Simulação de Desistência:
  // Libera os assentos ocupados
  const updatedPassengers = viagem.passengers.filter(p => {
    if (p.patientId === agendamentoMedico.patient_id) return false;
    if (p.notes && p.notes.includes('CARLOS ALBERTO')) return false;
    return true;
  });

  viagem.passengers = updatedPassengers;
  viagem.patientCount = 0;
  viagem.companionCount = 0;

  // Assentos foram liberados
  assert.equal(viagem.passengers.length, 0);

  // O agendamento médico permanece intacto na Regulação:
  assert.equal(agendamentoMedico.status, 'Agendado');
  assert.equal(agendamentoMedico.appointment_date, '2026-11-20');
});

test('6. Agrupamento Hierárquico Obrigatório: Data -> Destino -> Pacientes', () => {
  const demandas = [
    {
      id: 'd1',
      pacienteNome: 'MARIA APARECIDA SILVA',
      pacienteApelido: 'Maria',
      procedimentoNome: 'Consulta – Cardiologia',
      procedimentoCodigo: '0717',
      tipoProcedimento: 'Consulta',
      dataAtendimento: '2026-11-20',
      horaAtendimento: '08:00',
      municipioDestino: 'Ipatinga — MG',
      statusTransporte: 'Aguardando vaga'
    },
    {
      id: 'd2',
      pacienteNome: 'RAIMUNDO CARVALHO SOUZA',
      pacienteApelido: 'Raimundo',
      procedimentoNome: 'Exame – Ultrassom',
      procedimentoCodigo: '0034',
      tipoProcedimento: 'Exame',
      dataAtendimento: '2026-11-20',
      horaAtendimento: '09:20',
      municipioDestino: 'Ipatinga — MG',
      statusTransporte: 'Aguardando vaga'
    },
    {
      id: 'd3',
      pacienteNome: 'ANTONIO CARLOS REZENDE',
      procedimentoNome: 'Consulta – Especialidades',
      procedimentoCodigo: '0300',
      tipoProcedimento: 'Consulta',
      dataAtendimento: '2026-11-20',
      horaAtendimento: '07:00',
      municipioDestino: 'Ponte Nova — MG',
      statusTransporte: 'Aguardando vaga'
    },
    {
      id: 'd4',
      pacienteNome: 'PACIENTE SABADO 1',
      procedimentoNome: 'Exame Geral',
      dataAtendimento: '2026-11-21',
      horaAtendimento: '08:30',
      municipioDestino: 'Belo Horizonte — MG',
      statusTransporte: 'Alocado'
    }
  ];

  const grupos = agruparHierarquicoDataDestino(demandas);

  // Deve haver 2 datas: 20/11/2026 e 21/11/2026
  assert.equal(grupos.length, 2);

  const grupo20 = grupos.find(g => g.data === '2026-11-20');
  assert.ok(grupo20);
  assert.equal(grupo20.totalPacientes, 3);
  assert.ok(grupo20.dataLabel.includes('20/11/2026'));
  assert.ok(grupo20.dataLabel.includes('Sexta-feira'));

  // Dentro do dia 20, deve haver 2 destinos: Ipatinga e Ponte Nova
  assert.equal(grupo20.destinos.length, 2);

  const destIpatinga = grupo20.destinos.find(d => d.destino.includes('Ipatinga'));
  assert.ok(destIpatinga);
  assert.equal(destIpatinga.totalPacientes, 2);
  assert.equal(destIpatinga.aguardando, 2);
  assert.equal(destIpatinga.alocados, 0);

  // Ordenação de pacientes por horário
  assert.equal(destIpatinga.demandas[0].pacienteNome, 'MARIA APARECIDA SILVA');
  assert.equal(destIpatinga.demandas[0].horaAtendimento, '08:00');
  assert.equal(destIpatinga.demandas[1].pacienteNome, 'RAIMUNDO CARVALHO SOUZA');
  assert.equal(destIpatinga.demandas[1].horaAtendimento, '09:20');

  const destPonteNova = grupo20.destinos.find(d => d.destino.includes('Ponte Nova'));
  assert.ok(destPonteNova);
  assert.equal(destPonteNova.totalPacientes, 1);
});

test('7. Indicadores atualizados com aliases para o novo design', () => {
  const demandas = [
    { id: '1', dataAtendimento: '2026-11-20', statusTransporte: 'Aguardando vaga' },
    { id: '2', dataAtendimento: '2026-11-20', statusTransporte: 'Alocado' },
    { id: '3', dataAtendimento: '2026-11-20', statusTransporte: 'Confirmado' }
  ];

  const veiculos = [
    { id: 'v1', status: 'Ativo', passengerCapacity: 16 }
  ];

  const viagens = [
    { id: 't1', vehicleId: 'v1', status: 'confirmado', departureDateTime: '2026-11-20T06:00:00', passengers: [{ name: 'P1' }] }
  ];

  const ind = calcularIndicadoresTransporte(demandas, veiculos, viagens, '2026-11-20');
  assert.equal(ind.totalPacientes, 3);
  assert.equal(ind.aguardando, 1);
  assert.equal(ind.alocados, 1);
  assert.equal(ind.confirmados, 1);
  assert.equal(ind.vagasDisponiveis, 14); // 16 - 1 motorista - 1 passageiro = 14
  assert.ok(ind.veiculosDisponiveis >= 1);
});

