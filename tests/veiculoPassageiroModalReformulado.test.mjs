import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Testes Unitários de Regras de Negócio do Modal NOVO PASSAGEIRO Reformulado
 * Rota: /AgendamentoVeiculos/Agendar/Novo/Tripulacao
 */

// 1. Simulação da Lógica de Recuperação Automática de Apelido (Regra 2)
function resolverApelidoDoPaciente(pacienteCadastro) {
  if (!pacienteCadastro) return '';
  const rawNick = (pacienteCadastro.nickname || pacienteCadastro.apelido || '').trim();
  // Regra: "Caso o paciente não tenha apelido cadastrado, exibir Não informado"
  // Regra: "Não utilizar o nome completo, primeiro nome ou qualquer valor gerado como substituto do apelido"
  return rawNick || 'Não informado';
}

// 2. Simulação da Lógica de Local de Embarque como Texto Livre Obrigatório (Regra 4)
function validarLocalEmbarque(embarque) {
  if (!embarque || typeof embarque !== 'string') return { valido: false, erro: 'Local de embarque é obrigatório.' };
  const limpo = embarque.trim();
  if (limpo.length === 0) return { valido: false, erro: 'Local de embarque é obrigatório.' };
  return { valido: true, valor: limpo };
}

// 3. Simulação de Troca de Paciente (Limpeza estrita de dados anteriores)
function trocarPacienteSelecionado(pacienteAnterior, novoPaciente) {
  if (!novoPaciente) {
    return {
      selectedPatient: null,
      searchTerm: '',
      nicknameDisplay: '',
      birthDateDisplay: ''
    };
  }

  return {
    selectedPatient: novoPaciente,
    searchTerm: novoPaciente.name,
    nicknameDisplay: resolverApelidoDoPaciente(novoPaciente),
    birthDateDisplay: novoPaciente.birth_date ? novoPaciente.birth_date : 'Não informada'
  };
}

// 4. Validação de Submissão do Modal (Regras 1, 4 e 5)
function validarSubmissaoPassageiro({ selectedPatient, departureLocation, tripDate }) {
  if (!selectedPatient || !selectedPatient.id) {
    return { valido: false, erro: 'Nenhum paciente selecionado. É obrigatório selecionar um paciente cadastrado na base municipal.' };
  }

  const validacaoEmbarque = validarLocalEmbarque(departureLocation);
  if (!validacaoEmbarque.valido) {
    return { valido: false, erro: validacaoEmbarque.erro };
  }

  return {
    valido: true,
    passengerData: {
      patientId: selectedPatient.id,
      name: selectedPatient.name.trim().toUpperCase(),
      cpf: selectedPatient.cpf,
      birthDate: selectedPatient.birth_date,
      nickname: resolverApelidoDoPaciente(selectedPatient) !== 'Não informado' ? resolverApelidoDoPaciente(selectedPatient) : undefined,
      departureLocation: validacaoEmbarque.valor
    }
  };
}

test('1. Apelido cadastrado no Supabase é recuperado automaticamente e com fidelidade', () => {
  const paciente = {
    id: 'pac-123',
    name: 'MARIA APARECIDA SILVA',
    cpf: '12345678900',
    nickname: 'Dona Cida',
    birth_date: '1978-03-15'
  };

  const apelido = resolverApelidoDoPaciente(paciente);
  assert.equal(apelido, 'Dona Cida');
});

test('2. Paciente sem apelido cadastrado exibe obrigatoriamente "Não informado" sem inventar primeiro nome', () => {
  const pacienteSemNick = {
    id: 'pac-456',
    name: 'JOSE AUGUSTO PEREIRA',
    cpf: '98765432100',
    nickname: '',
    birth_date: '1985-06-20'
  };

  const apelido = resolverApelidoDoPaciente(pacienteSemNick);
  assert.equal(apelido, 'Não informado');
  assert.notEqual(apelido, 'JOSE');
  assert.notEqual(apelido, 'Jose');
});

test('3. Troca de paciente atualiza imediatamente o apelido e limpa dados do paciente anterior', () => {
  const pacienteA = {
    id: 'pac-1',
    name: 'MARIA APARECIDA SILVA',
    cpf: '111',
    nickname: 'Dona Cida'
  };

  const pacienteB = {
    id: 'pac-2',
    name: 'CARLOS ALBERTO MARTINS',
    cpf: '222',
    nickname: ''
  };

  const estadoA = trocarPacienteSelecionado(null, pacienteA);
  assert.equal(estadoA.selectedPatient.name, 'MARIA APARECIDA SILVA');
  assert.equal(estadoA.nicknameDisplay, 'Dona Cida');

  // Troca para o paciente B
  const estadoB = trocarPacienteSelecionado(estadoA.selectedPatient, pacienteB);
  assert.equal(estadoB.selectedPatient.name, 'CARLOS ALBERTO MARTINS');
  assert.equal(estadoB.nicknameDisplay, 'Não informado'); // Atualizou para B, removendo "Dona Cida" de A

  // Limpa seleção
  const estadoLimpo = trocarPacienteSelecionado(estadoB.selectedPatient, null);
  assert.equal(estadoLimpo.selectedPatient, null);
  assert.equal(estadoLimpo.nicknameDisplay, '');
});

test('4. Local de Embarque aceita texto livre com endereço ou ponto de referência', () => {
  const res1 = validarLocalEmbarque('Rua Principal, nº 120, próximo à Praça Central');
  assert.equal(res1.valido, true);
  assert.equal(res1.valor, 'Rua Principal, nº 120, próximo à Praça Central');

  const res2 = validarLocalEmbarque('Garagem Municipal');
  assert.equal(res2.valido, true);
  assert.equal(res2.valor, 'Garagem Municipal');

  const res3 = validarLocalEmbarque('    ');
  assert.equal(res3.valido, false);
  assert.equal(res3.erro, 'Local de embarque é obrigatório.');
});

test('5. Bloqueio estrito de adição de passageiro sem cadastro municipal selecionado', () => {
  const res = validarSubmissaoPassageiro({
    selectedPatient: null,
    departureLocation: 'Sede'
  });

  assert.equal(res.valido, false);
  assert.match(res.erro, /Nenhum paciente selecionado/i);
});

test('6. Submissão bem-sucedida vincula o patientId e dados cadastrais oficiais', () => {
  const paciente = {
    id: 'pac-999',
    name: 'MARIA APARECIDA SILVA',
    cpf: '12345678900',
    nickname: 'Cidinha',
    birth_date: '1978-03-15'
  };

  const res = validarSubmissaoPassageiro({
    selectedPatient: paciente,
    departureLocation: 'Rua Principal, nº 120, próximo à Praça Central'
  });

  assert.equal(res.valido, true);
  assert.equal(res.passengerData.patientId, 'pac-999');
  assert.equal(res.passengerData.name, 'MARIA APARECIDA SILVA');
  assert.equal(res.passengerData.nickname, 'Cidinha');
  assert.equal(res.passengerData.departureLocation, 'Rua Principal, nº 120, próximo à Praça Central');
});
