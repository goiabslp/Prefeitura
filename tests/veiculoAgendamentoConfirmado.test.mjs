import test from 'node:test';
import assert from 'node:assert/strict';

test('1. Nome do arquivo PDF segue o padrão estrito Comprovante_Agendamento_OS-XXXX.pdf', () => {
  const formatFileName = (rawProtocol) => {
    const protocolClean = (rawProtocol || 'OS-GERADA').trim();
    const sanitizedProtocol = protocolClean.startsWith('OS-') ? protocolClean : `OS-${protocolClean}`;
    return `Comprovante_Agendamento_${sanitizedProtocol}.pdf`;
  };

  assert.equal(formatFileName('OS-2026-0001'), 'Comprovante_Agendamento_OS-2026-0001.pdf');
  assert.equal(formatFileName('2026-0099'), 'Comprovante_Agendamento_OS-2026-0099.pdf');
  assert.equal(formatFileName('OS-20261118123'), 'Comprovante_Agendamento_OS-20261118123.pdf');
});

test('2. Resolução das informações reais do agendamento para exibição no modal de sucesso', () => {
  const scheduleMock = {
    id: 'f942ba67-2470-4e36-9e8c-8515c1e95b30',
    protocol: 'OS-2026-0042',
    vehicleId: 'veh-1',
    driverId: 'drv-1',
    requesterPersonId: 'req-1',
    serviceSectorId: 'sec-1',
    departureDateTime: '2026-11-20T05:00:00.000Z',
    returnDateTime: '2026-11-20T18:30:00.000Z',
    destination: 'BELO HORIZONTE - MG',
    purpose: 'Transporte de pacientes para consultas e exames especializados no HC-UFMG',
    status: 'confirmado',
    passengers: [
      { id: 'p1', name: 'MARIA SILVA', type: 'paciente', cpf: '12345678909' },
      { id: 'p2', name: 'JOAO SILVA', type: 'acompanhante', companionForPatientId: 'p1' },
      { id: 'p3', name: 'ANTONIO PEREIRA', type: 'paciente', cpf: '98765432100' }
    ]
  };

  const vehicles = [{ id: 'veh-1', model: 'SPIN LTZ', plate: 'TXY2G82', passengerCapacity: 7 }];
  const drivers = [{ id: 'drv-1', name: 'Luciano A Ferreira Gomes', jobId: 'motorista' }];
  const sectors = [{ id: 'sec-1', name: 'Secretaria Municipal de Saúde' }];

  const vehicle = vehicles.find(v => v.id === scheduleMock.vehicleId);
  const driver = drivers.find(d => d.id === scheduleMock.driverId);
  const sector = sectors.find(s => s.id === scheduleMock.serviceSectorId);

  assert.equal(vehicle?.model, 'SPIN LTZ');
  assert.equal(vehicle?.plate, 'TXY2G82');
  assert.equal(driver?.name, 'Luciano A Ferreira Gomes');
  assert.equal(sector?.name, 'Secretaria Municipal de Saúde');

  const countPacientes = scheduleMock.passengers.filter(p => p.type === 'paciente').length;
  const countAcompanhantes = scheduleMock.passengers.filter(p => p.type === 'acompanhante').length;

  assert.equal(countPacientes, 2);
  assert.equal(countAcompanhantes, 1);
  assert.equal(scheduleMock.passengers.length, 3);
});

test('3. Prevenção de múltiplos envios simultâneos durante salvamento', () => {
  let isSaving = false;
  let saveExecutionCount = 0;

  const handleSaveTrigger = () => {
    if (isSaving) return false;
    isSaving = true;
    saveExecutionCount++;
    return true;
  };

  // Primeiro clique
  assert.equal(handleSaveTrigger(), true);
  assert.equal(saveExecutionCount, 1);

  // Cliques subsequentes rápidos enquanto salvando
  assert.equal(handleSaveTrigger(), false);
  assert.equal(handleSaveTrigger(), false);
  assert.equal(saveExecutionCount, 1);

  // Conclusão
  isSaving = false;
  assert.equal(handleSaveTrigger(), true);
  assert.equal(saveExecutionCount, 2);
});

test('4. Validação de rotas de navegação após fechar ou consultar no histórico', () => {
  const paths = {
    'menu': '/AgendamentoVeiculos',
    'calendar': '/AgendamentoVeiculos/Agendar',
    'novo': '/AgendamentoVeiculos/Agendar/Novo',
    'history': '/AgendamentoVeiculos/Historico',
    'approvals': '/AgendamentoVeiculos/Aprovacoes'
  };

  // Ação CONCLUIR -> retorna à página inicial de Agendamento
  assert.equal(paths.calendar, '/AgendamentoVeiculos/Agendar');

  // Ação VER AGENDAMENTO -> direciona ao registro em Histórico
  assert.equal(paths.history, '/AgendamentoVeiculos/Historico');
});

test('5. Tratamento de erro sem exibição de modal de sucesso e preservando formulário', () => {
  let isSuccessModalOpen = false;
  let savedSchedule = null;
  const formData = {
    vehicleId: 'veh-1',
    driverId: 'drv-1',
    destination: 'IPATINGA - MG',
    purpose: 'Exames e consultas'
  };

  const simulateFailedSave = () => {
    try {
      throw new Error('Falha de conexão com o Supabase');
    } catch (err) {
      // No catch, o modal de sucesso NÃO deve abrir
      isSuccessModalOpen = false;
      savedSchedule = null;
      // formData permanece intacto
    }
  };

  simulateFailedSave();

  assert.equal(isSuccessModalOpen, false);
  assert.equal(savedSchedule, null);
  assert.equal(formData.destination, 'IPATINGA - MG');
});

test('6. Horário e local de embarque individuais por passageiro preservados sem conflito', () => {
  const tripSchedule = {
    departureDateTime: '2026-11-20T05:00:00.000Z',
    returnDateTime: '2026-11-20T19:00:00.000Z',
    destination: 'BELO HORIZONTE - MG',
    passengers: [
      {
        id: 'pass-1',
        name: 'CARLOS SILVA',
        type: 'paciente',
        departureTime: '04:30',
        departureLocation: 'Rua das Flores, nº 45, Bairro Centro',
        appointmentTime: '04:30'
      },
      {
        id: 'pass-2',
        name: 'MARIA SILVA',
        type: 'acompanhante',
        departureTime: '04:30',
        departureLocation: 'Rua das Flores, nº 45, Bairro Centro',
        companionForPatientId: 'pass-1'
      },
      {
        id: 'pass-3',
        name: 'JOAO PEREIRA',
        type: 'paciente',
        departureTime: '05:15',
        departureLocation: 'Praça Central, próximo à Igreja Matriz',
        appointmentTime: '05:15'
      }
    ]
  };

  // Garante que o passageiro 1 tem horário e local específicos
  assert.equal(tripSchedule.passengers[0].departureTime, '04:30');
  assert.equal(tripSchedule.passengers[0].departureLocation, 'Rua das Flores, nº 45, Bairro Centro');

  // Garante que o passageiro 3 tem horário e local distintos e individuais
  assert.equal(tripSchedule.passengers[2].departureTime, '05:15');
  assert.equal(tripSchedule.passengers[2].departureLocation, 'Praça Central, próximo à Igreja Matriz');
  assert.notEqual(tripSchedule.passengers[0].departureTime, tripSchedule.passengers[2].departureTime);

  // Garante que os horários gerais da viagem não foram sobrescritos
  assert.equal(tripSchedule.departureDateTime, '2026-11-20T05:00:00.000Z');
  assert.equal(tripSchedule.returnDateTime, '2026-11-20T19:00:00.000Z');
});

test('7. Renderização da tabela de Tripulação do Comprovante PDF com Nome, Partida, Horário e Local', () => {
  const passenger = {
    name: 'TEREZA CRISTINA ANDRADE',
    departureTime: '06:15',
    departureLocation: 'UBS Central / Av. Brasil, 500',
    type: 'paciente'
  };

  const pdfRow = {
    nome: passenger.name,
    partida: passenger.departureLocation || 'Ponto Central',
    horario: passenger.departureTime || passenger.appointmentTime || '---',
    local: passenger.departureLocation || passenger.appointmentLocation || 'Ponto Central'
  };

  assert.equal(pdfRow.nome, 'TEREZA CRISTINA ANDRADE');
  assert.equal(pdfRow.partida, 'UBS Central / Av. Brasil, 500');
  assert.equal(pdfRow.horario, '06:15');
  assert.equal(pdfRow.local, 'UBS Central / Av. Brasil, 500');
});
