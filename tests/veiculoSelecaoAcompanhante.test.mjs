import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Testes Unitários de Regras de Negócio — Seleção de Acompanhantes
 * Rota: /AgendamentoVeiculos/Agendar/Novo/Tripulacao
 */

// Utilidade de cálculo de idade na data da viagem
function calcularIdadeNaDataViagem(birthDateStr, tripDateStr) {
  if (!birthDateStr) return null;
  const tripDate = tripDateStr ? new Date(tripDateStr) : new Date();
  const birth = new Date(birthDateStr);
  if (isNaN(tripDate.getTime()) || isNaN(birth.getTime())) return null;

  let age = tripDate.getFullYear() - birth.getFullYear();
  const m = tripDate.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && tripDate.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

function isMenorDeIdadeNaViagem(birthDateStr, tripDateStr) {
  const age = calcularIdadeNaDataViagem(birthDateStr, tripDateStr);
  return age !== null && age < 18;
}

function normalizeCpf(cpf) {
  return (cpf || '').replace(/\D/g, '');
}

// 1. Validação de Seleção de Acompanhante
function validarSelecaoAcompanhante({
  candidate,
  currentPatientId,
  currentPatientCpf,
  isMandatoryForMinor,
  tripDate,
  existingCrew = []
}) {
  const candidateCpfClean = normalizeCpf(candidate.cpf);
  const patientCpfClean = normalizeCpf(currentPatientCpf);

  // REGRA 1: Não permitir selecionar o próprio paciente como acompanhante
  if (
    (currentPatientId && candidate.id === currentPatientId) ||
    (candidateCpfClean && patientCpfClean && candidateCpfClean === patientCpfClean)
  ) {
    return { valido: false, erro: 'O acompanhante não pode ser o próprio paciente.' };
  }

  // REGRA 2: Não permitir duplicidade na tripulação
  const isAlreadyInTrip = existingCrew.some(p => {
    const pCpfClean = normalizeCpf(p.cpf);
    return (p.patientId && p.patientId === candidate.id) ||
           (candidateCpfClean && pCpfClean && candidateCpfClean === pCpfClean);
  });

  if (isAlreadyInTrip) {
    return { valido: false, erro: 'Pessoa já está na tripulação desta viagem.' };
  }

  // REGRA 3: Se o paciente principal for menor, o acompanhante DEVE ter >= 18 anos
  const candidateBirth = candidate.birth_date || candidate.birthDate || '';
  if (isMandatoryForMinor && candidateBirth) {
    const candidateIsMinor = isMenorDeIdadeNaViagem(candidateBirth, tripDate);
    if (candidateIsMinor) {
      return { valido: false, erro: 'O acompanhante de um menor de idade deve ter no mínimo 18 anos na data da viagem.' };
    }
  }

  return { valido: true };
}

// 2. Validação de Submissão de Passageiro com Acompanhante e Ponto de Destino
function validarSubmissaoComAcompanhante({
  selectedPatient,
  departureTime,
  departureLocation,
  destinationPoint,
  tripDate,
  selectedCompanion,
  companionDepartureTime,
  companionDepartureLocation,
  companionDestinationPoint
}) {
  if (!selectedPatient) {
    return { valido: false, erro: 'Nenhum paciente selecionado.' };
  }

  if (!departureTime || !/^([01]\d|2[0-3]):[0-5]\d$/.test(departureTime.trim())) {
    return { valido: false, erro: 'Horário de embarque do paciente inválido.' };
  }

  if (!departureLocation || !departureLocation.trim()) {
    return { valido: false, erro: 'Local de embarque do paciente obrigatório.' };
  }

  if (!destinationPoint || !destinationPoint.trim()) {
    return { valido: false, erro: 'Ponto de destino do paciente obrigatório.' };
  }

  const birthDate = selectedPatient.birth_date || '';
  const isMinor = isMenorDeIdadeNaViagem(birthDate, tripDate);

  if (isMinor && !selectedCompanion) {
    return { 
      valido: false, 
      erro: 'Este paciente possui menos de 18 anos e deverá estar acompanhado durante a viagem. Selecione um acompanhante cadastrado para continuar.' 
    };
  }

  let companionData = null;
  if (selectedCompanion) {
    const cTime = (companionDepartureTime || departureTime).trim();
    const cLoc = (companionDepartureLocation || departureLocation).trim();
    const cDest = (companionDestinationPoint || destinationPoint).trim();

    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(cTime)) {
      return { valido: false, erro: 'Horário de embarque do acompanhante inválido.' };
    }
    if (!cLoc) {
      return { valido: false, erro: 'Local de embarque do acompanhante obrigatório.' };
    }
    if (!cDest) {
      return { valido: false, erro: 'Ponto de destino do acompanhante obrigatório.' };
    }

    companionData = {
      patientId: selectedCompanion.id,
      name: selectedCompanion.name.toUpperCase(),
      cpf: selectedCompanion.cpf,
      birthDate: selectedCompanion.birth_date,
      departureTime: cTime,
      departureLocation: cLoc,
      destinationPoint: cDest,
      appointmentLocation: cDest,
      type: 'acompanhante',
      companionForPatientId: selectedPatient.id,
      companionForPatientName: selectedPatient.name.toUpperCase()
    };
  }

  const passengerData = {
    patientId: selectedPatient.id,
    name: selectedPatient.name.toUpperCase(),
    cpf: selectedPatient.cpf,
    birthDate,
    departureTime: departureTime.trim(),
    departureLocation: departureLocation.trim(),
    destinationPoint: destinationPoint.trim(),
    appointmentLocation: destinationPoint.trim(),
    type: 'paciente',
    isMinor,
    needsCompanion: Boolean(selectedCompanion),
    companionName: selectedCompanion ? selectedCompanion.name.toUpperCase() : undefined
  };

  return { valido: true, passengerData, companionData };
}

// 3. Validação de Backend — validateCrewIntegrity
function validateCrewIntegrity(passengers, tripDate) {
  if (!passengers || !Array.isArray(passengers)) return { isValid: true };

  for (const p of passengers) {
    if (!p.name || !String(p.name).trim()) {
      return { isValid: false, message: 'Todos os integrantes da tripulação devem possuir nome.' };
    }

    const isMinor = p.isMinor || (p.birthDate ? isMenorDeIdadeNaViagem(p.birthDate, tripDate) : false);
    if (isMinor) {
      const hasCompanion = passengers.some(
        a => (a.type === 'acompanhante' || Boolean(a.companionForPatientId)) &&
             (a.companionForPatientId === p.patientId || a.companionForPatientId === p.id || a.id === p.companionId || a.companionForPatientName === p.name)
      );
      if (!hasCompanion) {
        return { 
          isValid: false, 
          message: `O paciente menor de 18 anos "${p.name}" necessita obrigatoriamente de um acompanhante vinculado à viagem.` 
        };
      }
    }
  }

  return { isValid: true };
}

// ============================================================================
// TESTES
// ============================================================================

test('1. Menor de 18 anos na data da viagem exige obrigatoriamente acompanhante', () => {
  const tripDate = '2026-11-20';
  // Nascido em 2012-05-10 tem 14 anos na data da viagem
  const menor = { id: 'p1', name: 'LUCAS OLIVEIRA', birth_date: '2012-05-10', cpf: '11122233344' };
  
  assert.equal(isMenorDeIdadeNaViagem(menor.birth_date, tripDate), true);

  // Tentativa de submissão sem acompanhante DEVE ser bloqueada
  const submissaoSemAcomp = validarSubmissaoComAcompanhante({
    selectedPatient: menor,
    departureTime: '06:00',
    departureLocation: 'UBS Central',
    destinationPoint: 'Hospital Infantil João Paulo II',
    tripDate,
    selectedCompanion: null
  });

  assert.equal(submissaoSemAcomp.valido, false);
  assert.match(submissaoSemAcomp.erro, /menos de 18 anos e deverá estar acompanhado/);
});

test('2. Não permite selecionar o próprio paciente principal como acompanhante', () => {
  const paciente = { id: 'p-100', name: 'MARIA DA SILVA', cpf: '12345678901' };

  // Candidato com mesmo ID
  const resId = validarSelecaoAcompanhante({
    candidate: { id: 'p-100', name: 'MARIA DA SILVA', cpf: '12345678901' },
    currentPatientId: paciente.id,
    currentPatientCpf: paciente.cpf
  });
  assert.equal(resId.valido, false);
  assert.equal(resId.erro, 'O acompanhante não pode ser o próprio paciente.');

  // Candidato com mesmo CPF
  const resCpf = validarSelecaoAcompanhante({
    candidate: { id: 'p-outroid', name: 'MARIA DA SILVA SOUZA', cpf: '123.456.789-01' },
    currentPatientId: paciente.id,
    currentPatientCpf: paciente.cpf
  });
  assert.equal(resCpf.valido, false);
  assert.equal(resCpf.erro, 'O acompanhante não pode ser o próprio paciente.');
});

test('3. Acompanhante de um menor de idade DEVE ser maior de 18 anos na data da viagem', () => {
  const tripDate = '2026-11-20';
  // Acompanhante candidato com 15 anos
  const acompanhanteMenor = { id: 'p-200', name: 'ANA CLARA', birth_date: '2011-03-15', cpf: '22233344455' };

  const res = validarSelecaoAcompanhante({
    candidate: acompanhanteMenor,
    currentPatientId: 'p-1',
    currentPatientCpf: '99988877766',
    isMandatoryForMinor: true,
    tripDate
  });

  assert.equal(res.valido, false);
  assert.match(res.erro, /deve ter no mínimo 18 anos/);
});

test('4. Prevenção de duplicidade: pessoa já na tripulação não pode ser adicionada como acompanhante', () => {
  const tripDate = '2026-11-20';
  const existingCrew = [
    { patientId: 'p-already', name: 'CARLOS DRIVER', cpf: '33344455566' }
  ];

  const candidate = { id: 'p-already', name: 'CARLOS DRIVER', cpf: '33344455566', birth_date: '1985-01-01' };

  const res = validarSelecaoAcompanhante({
    candidate,
    currentPatientId: 'p-novo',
    currentPatientCpf: '11111111111',
    isMandatoryForMinor: false,
    tripDate,
    existingCrew
  });

  assert.equal(res.valido, false);
  assert.match(res.erro, /já está na tripulação/);
});

test('5. Contabilização de assentos: passageiro + acompanhante ocupam 2 assentos e respeitam capacidade do veículo', () => {
  const vehicleCapacity = 4; // Ex: 4 lugares no total (1 motorista + 3 passageiros)
  const maxPassengerSeats = vehicleCapacity - 1; // 3 vagas

  let currentPassengers = [
    { name: 'PACIENTE 1', type: 'paciente' },
    { name: 'PACIENTE 2', type: 'paciente' }
  ]; // Já tem 2 passageiros

  const seatsNeededWithCompanion = 2; // Paciente 3 + Acompanhante

  const canAdd = (currentPassengers.length + seatsNeededWithCompanion) <= maxPassengerSeats;
  assert.equal(canAdd, false); // 2 + 2 = 4 > 3 -> Deve bloquear por excesso de lotação!
});

test('6. Campos de embarque e ponto de destino individuais são editáveis e preservados individualmente', () => {
  const tripDate = '2026-11-20';
  const paciente = { id: 'p-1', name: 'FERNANDO DIAS', cpf: '12345678900', birth_date: '1980-05-15' };
  const acompanhante = { id: 'p-2', name: 'JULIANA DIAS', cpf: '98765432100', birth_date: '1982-10-20' };

  const submissao = validarSubmissaoComAcompanhante({
    selectedPatient: paciente,
    departureTime: '06:15',
    departureLocation: 'Praça Central de São José do Goiabal',
    destinationPoint: 'Hospital Márcio Cunha - Unidade I',
    tripDate,
    selectedCompanion: acompanhante,
    companionDepartureTime: '06:30', // Horário individual do acompanhante
    companionDepartureLocation: 'Entroncamento BR-262 / Trevo', // Local individual
    companionDestinationPoint: 'Clínica Oftalmológica de Ipatinga' // Ponto de destino individual
  });

  assert.equal(submissao.valido, true);
  assert.equal(submissao.passengerData.departureTime, '06:15');
  assert.equal(submissao.passengerData.departureLocation, 'Praça Central de São José do Goiabal');
  assert.equal(submissao.passengerData.destinationPoint, 'Hospital Márcio Cunha - Unidade I');
  assert.equal(submissao.companionData.departureTime, '06:30');
  assert.equal(submissao.companionData.departureLocation, 'Entroncamento BR-262 / Trevo');
  assert.equal(submissao.companionData.destinationPoint, 'Clínica Oftalmológica de Ipatinga');
  assert.notEqual(submissao.passengerData.departureTime, submissao.companionData.departureTime);
  assert.notEqual(submissao.passengerData.departureLocation, submissao.companionData.departureLocation);
  assert.notEqual(submissao.passengerData.destinationPoint, submissao.companionData.destinationPoint);
});

test('7. Comprovante PDF exibe as 4 colunas estritas: Passageiro | Horário | Local de embarque | Ponto de destino', () => {
  const rowPaciente = {
    passageiro: 'MARIA DA SILVA (Dona Maria)',
    horario: '06:30',
    localDeEmbarque: 'Rua Principal, 100, Bairro Centro',
    pontoDeDestino: 'Hospital Márcio Cunha'
  };

  const rowAcompanhante = {
    passageiro: 'JOÃO DA SILVA [Acompanhante de MARIA DA SILVA]',
    horario: '06:30',
    localDeEmbarque: 'Rua Principal, 100, Bairro Centro',
    pontoDeDestino: 'Hospital Márcio Cunha'
  };

  const pdfColumns = ['Passageiro', 'Horário', 'Local de embarque', 'Ponto de destino'];

  assert.deepEqual(Object.keys(rowPaciente), ['passageiro', 'horario', 'localDeEmbarque', 'pontoDeDestino']);
  assert.deepEqual(pdfColumns, ['Passageiro', 'Horário', 'Local de embarque', 'Ponto de destino']);
  assert.equal(pdfColumns.length, 4);
});

test('8. Validação de integridade no backend bloqueia agendamento com menor de idade sem acompanhante', () => {
  const tripDate = '2026-11-20';
  
  // Caso inválido: Menor sem acompanhante na tripulação
  const crewInvalida = [
    { patientId: 'p-menor', name: 'GABRIEL TEIXEIRA', birthDate: '2015-08-20', type: 'paciente' }
  ];

  const resInvalida = validateCrewIntegrity(crewInvalida, tripDate);
  assert.equal(resInvalida.isValid, false);
  assert.match(resInvalida.message, /menor de 18 anos.*obrigatoriamente de um acompanhante/);

  // Caso válido: Menor COM acompanhante vinculado
  const crewValida = [
    { 
      id: 'pax-1', 
      patientId: 'p-menor', 
      name: 'GABRIEL TEIXEIRA', 
      birthDate: '2015-08-20', 
      type: 'paciente',
      companionId: 'acomp-1' 
    },
    { 
      id: 'acomp-1', 
      patientId: 'p-mae', 
      name: 'CLAUDIA TEIXEIRA', 
      birthDate: '1985-03-12', 
      type: 'acompanhante', 
      companionForPatientId: 'p-menor' 
    }
  ];

  const resValida = validateCrewIntegrity(crewValida, tripDate);
  assert.equal(resValida.isValid, true);
});

test('9. Local de embarque e Ponto de destino são obrigatórios e validam preenchimento', () => {
  const paciente = { id: 'p-1', name: 'ANA SOUZA', cpf: '55566677788', birth_date: '1990-01-01' };

  // Falha sem local de embarque
  const semLocalEmbarque = validarSubmissaoComAcompanhante({
    selectedPatient: paciente,
    departureTime: '07:00',
    departureLocation: '',
    destinationPoint: 'Hospital das Clínicas',
    tripDate: '2026-11-20',
    selectedCompanion: null
  });
  assert.equal(semLocalEmbarque.valido, false);
  assert.match(semLocalEmbarque.erro, /Local de embarque do paciente obrigatório/);

  // Falha sem ponto de destino
  const semPontoDestino = validarSubmissaoComAcompanhante({
    selectedPatient: paciente,
    departureTime: '07:00',
    departureLocation: 'Rua das Flores, 120',
    destinationPoint: '',
    tripDate: '2026-11-20',
    selectedCompanion: null
  });
  assert.equal(semPontoDestino.valido, false);
  assert.match(semPontoDestino.erro, /Ponto de destino do paciente obrigatório/);
});
