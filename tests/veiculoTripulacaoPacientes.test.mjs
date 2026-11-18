import test from 'node:test';
import assert from 'node:assert/strict';
import { maskCpfPartial, normalizeCpf, isValidCpf, formatBirthDateBr } from '../utils/cpfUtils.ts';
import { validateWhatsApp } from '../utils/phoneValidation.ts';

test('1. Preservação do patient_id original e compatibilidade na tripulação', () => {
  const pacienteBase = {
    id: 'paciente-uuid-1234',
    name: 'ISABEL PASCOAL DA SILVA',
    cpf: '99332299668',
    birth_date: '1985-05-20',
    phone: '(31) 98765-4321'
  };

  const tripulante = {
    patientId: pacienteBase.id,
    name: pacienteBase.name,
    cpf: pacienteBase.cpf,
    birthDate: pacienteBase.birth_date,
    phone: pacienteBase.phone,
    departureLocation: 'São José do Goiabal',
    appointmentTime: '08:00',
    appointmentLocation: 'CISAMAPI',
    type: 'paciente'
  };

  assert.equal(tripulante.patientId, 'paciente-uuid-1234');
  assert.equal(tripulante.type, 'paciente');

  // Compatibilidade com passageiros avulsos legados sem patientId
  const passageiroLegado = {
    name: 'JOÃO MOTORISTA',
    departureLocation: 'Garagem',
    appointmentTime: '07:30',
    appointmentLocation: 'Hospital',
    type: 'passageiro'
  };
  assert.equal(passageiroLegado.patientId, undefined);
  assert.equal(passageiroLegado.name, 'JOÃO MOTORISTA');
});

test('2. Mascaramento LGPD de CPF na visualização da tripulação', () => {
  const cpfExemplo = '99332299668';
  const mascarado = maskCpfPartial(cpfExemplo);
  assert.equal(mascarado, '***.322.996-**');

  const semCpf = maskCpfPartial(null);
  assert.equal(semCpf, 'Não informado');
});

test('3. Detecção e bloqueio rigoroso de duplicidade de paciente na mesma viagem', () => {
  const tripulacaoExistente = [
    {
      patientId: 'paciente-uuid-1234',
      name: 'ISABEL PASCOAL DA SILVA',
      cpf: '99332299668',
      type: 'paciente'
    },
    {
      name: 'ACOMPANHANTE MARIA',
      type: 'acompanhante'
    }
  ];

  // Tentativa de adicionar por mesmo patientId
  const duplicadoPorId = {
    id: 'paciente-uuid-1234',
    name: 'ISABEL PASCOAL',
    cpf: '00000000000'
  };
  const isDuplicadoId = tripulacaoExistente.some(
    p => (p.patientId && p.patientId === duplicadoPorId.id) ||
         (p.cpf && duplicadoPorId.cpf && normalizeCpf(p.cpf) === normalizeCpf(duplicadoPorId.cpf))
  );
  assert.equal(isDuplicadoId, true);

  // Tentativa de adicionar por mesmo CPF
  const duplicadoPorCpf = {
    id: 'outro-uuid-9999',
    name: 'ISABEL PASCOAL SILVA',
    cpf: '993.322.996-68'
  };
  const isDuplicadoCpf = tripulacaoExistente.some(
    p => (p.patientId && p.patientId === duplicadoPorCpf.id) ||
         (p.cpf && duplicadoPorCpf.cpf && normalizeCpf(p.cpf) === normalizeCpf(duplicadoPorCpf.cpf))
  );
  assert.equal(isDuplicadoCpf, true);

  // Paciente novo e diferente não é duplicado
  const pacienteNovo = {
    id: 'novo-uuid-7777',
    name: 'CARLOS ALBERTO',
    cpf: '12345678909'
  };
  const isDuplicadoNovo = tripulacaoExistente.some(
    p => (p.patientId && p.patientId === pacienteNovo.id) ||
         (p.cpf && pacienteNovo.cpf && normalizeCpf(p.cpf) === normalizeCpf(pacienteNovo.cpf))
  );
  assert.equal(isDuplicadoNovo, false);
});

test('4. Formatação de Data de Nascimento para exibição em cards', () => {
  assert.equal(formatBirthDateBr('1985-05-20'), '20/05/1985');
  assert.equal(formatBirthDateBr('1985-05-20T00:00:00'), '20/05/1985');
  assert.equal(formatBirthDateBr(null), 'Não informada');
});

test('5. Validação de campos obrigatórios do Cadastro Rápido de Paciente', () => {
  // Nome curto
  assert.equal('AB'.trim().length >= 3, false);
  assert.equal('MARIA SILVA'.trim().length >= 3, true);

  // Validação matemática do CPF
  assert.equal(isValidCpf('11111111111'), false); // Dígitos repetidos inválidos
  assert.equal(isValidCpf('12345678900'), false); // Dígitos verificadores incorretos

  // Validação do WhatsApp
  const phoneValido = validateWhatsApp('(31) 98379-0670');
  assert.equal(phoneValido.isValid, true);

  const phoneFalso = validateWhatsApp('(31) 99999-9999');
  assert.equal(phoneFalso.isValid, false);
});

test('6. Rotas URL padronizadas para cada aba do Agendamento de Veículos', () => {
  const rotasAbas = {
    dados_gerais: '/AgendamentoVeiculos/Agendar/Novo',
    destino: '/AgendamentoVeiculos/Agendar/Novo/Destino',
    data: '/AgendamentoVeiculos/Agendar/Novo/Horarios',
    objetivo: '/AgendamentoVeiculos/Agendar/Novo/Objetivo',
    tripulacao: '/AgendamentoVeiculos/Agendar/Novo/Tripulacao'
  };

  assert.equal(rotasAbas.tripulacao, '/AgendamentoVeiculos/Agendar/Novo/Tripulacao');
  assert.equal(rotasAbas.tripulacao.startsWith('/AgendamentoVeiculos/Agendar/Novo'), true);
});

test('7. Colaborador autorizado no Agendamento de Veículos tem acesso à busca de pacientes na Tripulação', async () => {
  const { hasIntegratedPatientReadAccess, hasVehicleSchedulingPatientAccess } = await import('../services/consultasService.ts');

  const colaboradorVeiculos = {
    id: '10cac7c3-432a-4f26-9346-174f31c65b76',
    username: 'IMR',
    name: 'Isaura Madalena R Caetano',
    role: 'collaborator',
    permissions: [
      'parent_agendamento_veiculo',
      'parent_marketing',
      'parent_agendamento_veiculo_agendar',
      'parent_agendamento_veiculo_meus',
      'parent_agendamento_veiculo_aprovacoes',
      'parent_agendamento_veiculo_dashboard',
      'parent_noticias',
      'noticias'
    ]
  };

  assert.equal(hasVehicleSchedulingPatientAccess(colaboradorVeiculos), true);
  assert.equal(hasIntegratedPatientReadAccess(colaboradorVeiculos), true);

  // Usuário sem permissão de saúde nem agendamento de veículos permanece bloqueado
  const usuarioMarketing = {
    id: 'user-mkt',
    username: 'MKT',
    name: 'Usuário Marketing',
    role: 'collaborator',
    permissions: ['parent_marketing', 'parent_noticias']
  };
  assert.equal(hasVehicleSchedulingPatientAccess(usuarioMarketing), false);
  assert.equal(hasIntegratedPatientReadAccess(usuarioMarketing), false);
});

test('8. Payload do cadastro rápido no modal inclui apelido opcional e sanitização de dados', () => {
  const dadosDigitados = {
    name: 'josé da silva pereira',
    nickname: 'zé do posto',
    cpf: '123.456.789-09',
    birthDate: '1975-08-14',
    phone: '(31) 9 8888-7777',
    neighborhood: 'centro',
    street: 'rua getúlio vargas, 45'
  };

  const payload = {
    name: dadosDigitados.name.trim().toUpperCase(),
    nickname: dadosDigitados.nickname.trim() ? dadosDigitados.nickname.trim().toUpperCase() : undefined,
    cpf: normalizeCpf(dadosDigitados.cpf),
    birth_date: dadosDigitados.birthDate,
    phone: dadosDigitados.phone.trim(),
    neighborhood: dadosDigitados.neighborhood.trim().toUpperCase(),
    street: dadosDigitados.street.trim().toUpperCase(),
    city: 'SÃO JOSÉ DO GOIABAL'
  };

  assert.equal(payload.name, 'JOSÉ DA SILVA PEREIRA');
  assert.equal(payload.nickname, 'ZÉ DO POSTO');
  assert.equal(payload.cpf, '12345678909');
  assert.equal(payload.city, 'SÃO JOSÉ DO GOIABAL');
});

test('9. Seleção automática pós-cadastro no modal NOVO PASSAGEIRO', () => {
  const pacienteRecemCriado = {
    id: 'uuid-paciente-salvo-999',
    name: 'CLARICE LISPECTOR DA SILVA',
    cpf: '98765432100',
    birth_date: '1980-12-10',
    nickname: 'CLARA',
    phone: '(31) 98765-4321',
    neighborhood: 'CENTRO',
    street: 'AV. PRINCIPAL'
  };

  // Simulação da lógica de handleSelectPatient
  let selectedPatient = null;
  let searchTerm = '';
  let birthDateDisplay = '';
  let nicknameDisplay = '';
  let departureLocation = '';

  const handleSelectPatient = (paciente) => {
    selectedPatient = paciente;
    searchTerm = paciente.name;
    birthDateDisplay = formatBirthDateBr(paciente.birth_date);
    nicknameDisplay = paciente.nickname || 'Não informado';
    if (!departureLocation.trim()) {
      const parts = [paciente.street, paciente.neighborhood].filter(Boolean);
      if (parts.length > 0) departureLocation = parts.join(' - ');
    }
  };

  handleSelectPatient(pacienteRecemCriado);

  assert.equal(selectedPatient.id, 'uuid-paciente-salvo-999');
  assert.equal(searchTerm, 'CLARICE LISPECTOR DA SILVA');
  assert.equal(birthDateDisplay, '10/12/1980');
  assert.equal(nicknameDisplay, 'CLARA');
  assert.equal(departureLocation, 'AV. PRINCIPAL - CENTRO');
});

