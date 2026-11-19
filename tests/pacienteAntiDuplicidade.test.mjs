import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Testes Unitários — Prevenção de Pacientes Duplicados
 * Aplicação: Todos os módulos que utilizam a base municipal de pacientes
 * (/Regulacao, /AgendamentoVeiculos, /FarmaciaPopular, /AutoSenha)
 */

// Função de normalização idêntica à implementada no frontend e no banco PostgreSQL
function normalizePatientName(name) {
  if (!name) return '';
  return String(name)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeCpf(cpf) {
  return (cpf || '').replace(/\D/g, '').slice(0, 11);
}

function normalizeBirthDateIso(dateStr) {
  if (!dateStr) return '';
  const trimmed = String(dateStr).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed.slice(0, 10);
  }
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
    const [d, m, y] = trimmed.split('/');
    return `${y}-${m}-${d}`;
  }
  return trimmed;
}

function checkPatientDuplicate(candidate, existingList, excludeId = null) {
  const candidateCpf = normalizeCpf(candidate.cpf);
  const candidateNameNorm = normalizePatientName(candidate.name);
  const candidateBirth = normalizeBirthDateIso(candidate.birth_date);
  const targetExcludeId = excludeId || candidate.id;

  for (const p of existingList) {
    if (targetExcludeId && p.id === targetExcludeId) {
      continue;
    }

    const pCpf = normalizeCpf(p.cpf);
    // 1. Verificação independente por CPF
    if (candidateCpf.length === 11 && pCpf.length === 11 && candidateCpf === pCpf) {
      return {
        hasDuplicate: true,
        conflictType: 'cpf',
        existingPatient: p,
        message: 'Já existe um paciente cadastrado com este CPF.'
      };
    }

    // 2. Verificação independente por Nome Completo Normalizado + Data de Nascimento
    const pNameNorm = normalizePatientName(p.name);
    const pBirth = normalizeBirthDateIso(p.birth_date);

    if (candidateNameNorm && pNameNorm && candidateBirth && pBirth) {
      if (candidateNameNorm === pNameNorm && candidateBirth === pBirth) {
        return {
          hasDuplicate: true,
          conflictType: 'name_and_birth_date',
          existingPatient: p,
          message: 'Já existe um paciente cadastrado com o mesmo Nome Completo e Data de Nascimento.'
        };
      }
    }
  }

  return {
    hasDuplicate: false,
    conflictType: null,
    existingPatient: null
  };
}

// ============================================================================
// TESTES UNITÁRIOS
// ============================================================================

test('1. Normalização de Nomes: ignora maiúsculas, minúsculas, acentos e espaços múltiplos', () => {
  const nome1 = 'JOÃO DA SILVA';
  const nome2 = 'Joao   da   Silva  ';
  const nome3 = '   joão da silva   ';
  const nome4 = 'Jõao Da Silva';

  const norm1 = normalizePatientName(nome1);
  const norm2 = normalizePatientName(nome2);
  const norm3 = normalizePatientName(nome3);
  const norm4 = normalizePatientName(nome4);

  assert.equal(norm1, 'joao da silva');
  assert.equal(norm2, 'joao da silva');
  assert.equal(norm3, 'joao da silva');
  assert.equal(norm4, 'joao da silva');
  assert.equal(norm1, norm2);
  assert.equal(norm1, norm3);
  assert.equal(norm1, norm4);
});

test('2. Exemplo oficial do usuário: JOÃO DA SILVA — 15/03/1980 deve ser igual a Joao da Silva — 15/03/1980', () => {
  const pacienteExistente = {
    id: 'p-1',
    name: 'JOÃO DA SILVA',
    cpf: '11122233344',
    birth_date: '1980-03-15'
  };

  const novoCandidato = {
    name: 'Joao da Silva',
    cpf: '99988877766', // CPF diferente!
    birth_date: '15/03/1980' // Formato BR
  };

  const res = checkPatientDuplicate(novoCandidato, [pacienteExistente]);
  assert.equal(res.hasDuplicate, true);
  assert.equal(res.conflictType, 'name_and_birth_date');
  assert.equal(res.existingPatient.id, 'p-1');
  assert.match(res.message, /mesmo Nome Completo e Data de Nascimento/);
});

test('3. Bloqueio por CPF duplicado independente do nome', () => {
  const pacienteExistente = {
    id: 'p-10',
    name: 'MARIA APARECIDA DOS SANTOS',
    cpf: '12345678901',
    birth_date: '1975-08-20'
  };

  const novoCandidato = {
    name: 'OUTRO NOME QUALQUER',
    cpf: '123.456.789-01', // Mesmo CPF
    birth_date: '2000-01-01' // Data diferente
  };

  const res = checkPatientDuplicate(novoCandidato, [pacienteExistente]);
  assert.equal(res.hasDuplicate, true);
  assert.equal(res.conflictType, 'cpf');
  assert.equal(res.existingPatient.id, 'p-10');
});

test('4. Edição de cadastro: não colide consigo mesmo ao salvar', () => {
  const paciente = {
    id: 'p-50',
    name: 'FERNANDO ALVES',
    cpf: '55566677788',
    birth_date: '1988-12-10'
  };

  // Edita telefone, mantendo nome e CPF
  const updates = {
    id: 'p-50',
    name: 'FERNANDO ALVES',
    cpf: '55566677788',
    birth_date: '1988-12-10',
    phone: '(31) 98888-7777'
  };

  const res = checkPatientDuplicate(updates, [paciente], 'p-50');
  assert.equal(res.hasDuplicate, false);
});

test('5. Edição de cadastro: bloqueia se colidir com outro paciente existente', () => {
  const paciente1 = {
    id: 'p-1',
    name: 'CARLOS DRUMMOND',
    cpf: '11111111111',
    birth_date: '1950-01-01'
  };

  const paciente2 = {
    id: 'p-2',
    name: 'MANUEL BANDEIRA',
    cpf: '22222222222',
    birth_date: '1960-06-06'
  };

  // Paciente 2 tenta mudar seu CPF para o CPF do Paciente 1
  const updatesColidindo = {
    name: 'MANUEL BANDEIRA',
    cpf: '11111111111',
    birth_date: '1960-06-06'
  };

  const res = checkPatientDuplicate(updatesColidindo, [paciente1, paciente2], 'p-2');
  assert.equal(res.hasDuplicate, true);
  assert.equal(res.conflictType, 'cpf');
  assert.equal(res.existingPatient.id, 'p-1');
});

test('6. Pessoas com mesmo nome mas datas de nascimento diferentes não colidem', () => {
  const pai = {
    id: 'p-pai',
    name: 'JOSE SILVA',
    cpf: '33344455566',
    birth_date: '1955-04-10'
  };

  const filho = {
    id: 'p-filho',
    name: 'José Silva',
    cpf: '77788899900', // CPF diferente
    birth_date: '1985-04-10' // Nascimento diferente
  };

  const res = checkPatientDuplicate(filho, [pai]);
  assert.equal(res.hasDuplicate, false);
});

test('7. Detecção de divergência de CPF para encaminhar à conferência administrativa', () => {
  const candidatoCpf = '07117439625';
  const existenteCpf = '07116439625'; // 1 dígito diferente

  const hasDivergence = candidateCpfDiverges(candidatoCpf, existenteCpf);
  assert.equal(hasDivergence, true);

  function candidateCpfDiverges(c1, c2) {
    const clean1 = (c1 || '').replace(/\D/g, '');
    const clean2 = (c2 || '').replace(/\D/g, '');
    return clean1.length === 11 && clean2.length === 11 && clean1 !== clean2;
  }
});
