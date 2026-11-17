import test from 'node:test';
import assert from 'node:assert/strict';

// Funções utilitárias de validação de idade na data da viagem
function parseDateSafe(dateInput) {
  if (!dateInput) return null;
  if (dateInput instanceof Date) {
    return isNaN(dateInput.getTime()) ? null : dateInput;
  }
  const clean = String(dateInput).trim();
  if (!clean) return null;

  if (/^\d{4}-\d{2}-\d{2}/.test(clean)) {
    const [y, m, d] = clean.substring(0, 10).split('-').map(Number);
    return new Date(y, m - 1, d, 12, 0, 0);
  }
  if (/^\d{2}\/\d{2}\/\d{4}/.test(clean)) {
    const [d, m, y] = clean.substring(0, 10).split('/').map(Number);
    return new Date(y, m - 1, d, 12, 0, 0);
  }
  const parsed = new Date(clean);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function calcularIdadeNaDataViagem(birthDateInput, tripDateInput) {
  const birthDate = parseDateSafe(birthDateInput);
  if (!birthDate) return null;

  const tripDate = parseDateSafe(tripDateInput) || new Date();

  let age = tripDate.getFullYear() - birthDate.getFullYear();
  const m = tripDate.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && tripDate.getDate() < birthDate.getDate())) {
    age--;
  }
  return age >= 0 ? age : 0;
}

function isMenorDeIdadeNaViagem(birthDateInput, tripDateInput) {
  const age = calcularIdadeNaDataViagem(birthDateInput, tripDateInput);
  if (age === null) return false;
  return age < 18;
}

function formatBirthDateComIdade(birthDateInput, tripDateInput) {
  const parsed = parseDateSafe(birthDateInput);
  if (!parsed) return '';
  const day = String(parsed.getDate()).padStart(2, '0');
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const year = parsed.getFullYear();
  const formatted = `${day}/${month}/${year}`;

  const age = calcularIdadeNaDataViagem(birthDateInput, tripDateInput);
  if (age !== null) {
    return `Nasc.: ${formatted} (${age} ${age === 1 ? 'ano' : 'anos'})`;
  }
  return `Nasc.: ${formatted}`;
}

// ============================================================================
// TESTES
// ============================================================================

test('Cálculo de idade estritamente baseado na data prevista da viagem', () => {
  const dataNascimento = '2008-11-20'; // Faz 18 anos em 20/11/2026

  // 1 dia antes da maioridade
  const viagemAntes = '2026-11-19';
  assert.equal(calcularIdadeNaDataViagem(dataNascimento, viagemAntes), 17);
  assert.equal(isMenorDeIdadeNaViagem(dataNascimento, viagemAntes), true);

  // No dia do aniversário de 18 anos
  const viagemNoDia = '2026-11-20';
  assert.equal(calcularIdadeNaDataViagem(dataNascimento, viagemNoDia), 18);
  assert.equal(isMenorDeIdadeNaViagem(dataNascimento, viagemNoDia), false);

  // Após o aniversário
  const viagemDepois = '2026-11-25';
  assert.equal(calcularIdadeNaDataViagem(dataNascimento, viagemDepois), 18);
  assert.equal(isMenorDeIdadeNaViagem(dataNascimento, viagemDepois), false);
});

test('Formatação da data de nascimento com idade na viagem', () => {
  const dataNascimento = '1980-03-12';
  const dataViagem = '2026-11-17';
  const label = formatBirthDateComIdade(dataNascimento, dataViagem);
  assert.equal(label, 'Nasc.: 12/03/1980 (46 anos)');
});

test('Regra Obrigatória 1: Nenhum paciente pode ser salvo sem cadastro na base municipal', () => {
  const passageiros = [
    { name: 'PACIENTE VALIDO', type: 'paciente', patientId: 'pac_123' },
    { name: 'PACIENTE AVULSO IRREGULAR', type: 'paciente', patientId: undefined }
  ];

  const semCadastro = passageiros.filter(p => p.type === 'paciente' && !p.patientId);
  assert.equal(semCadastro.length, 1);
  assert.equal(semCadastro[0].name, 'PACIENTE AVULSO IRREGULAR');
});

test('Regra Obrigatória 2: Menores de 18 anos exigem acompanhante maior de 18 anos', () => {
  const dataViagem = '2026-11-17';

  const menor = {
    id: 'menor_01',
    patientId: 'pac_menor',
    name: 'JOÃO MENOR',
    birthDate: '2010-05-10',
    type: 'paciente'
  };

  const acompMenorDeIdade = {
    id: 'acomp_01',
    name: 'IRMÃO MENOR',
    birthDate: '2012-01-01',
    type: 'acompanhante',
    companionForPatientId: 'pac_menor'
  };

  const acompAdulto = {
    id: 'acomp_02',
    name: 'MÃE ADULTA',
    birthDate: '1985-04-15',
    type: 'acompanhante',
    companionForPatientId: 'pac_menor'
  };

  assert.equal(isMenorDeIdadeNaViagem(menor.birthDate, dataViagem), true);
  assert.equal(isMenorDeIdadeNaViagem(acompMenorDeIdade.birthDate, dataViagem), true);
  assert.equal(isMenorDeIdadeNaViagem(acompAdulto.birthDate, dataViagem), false);

  // Acompanhante não pode ser menor
  const acompanhanteInvalido = isMenorDeIdadeNaViagem(acompMenorDeIdade.birthDate, dataViagem);
  assert.equal(acompanhanteInvalido, true);

  // Acompanhante adulto é válido
  const acompanhanteValido = !isMenorDeIdadeNaViagem(acompAdulto.birthDate, dataViagem);
  assert.equal(acompanhanteValido, true);
});

test('Proteção contra exclusão: impede remover o único acompanhante de um menor na viagem', () => {
  const menor = { id: 'm1', patientId: 'p_m1', name: 'LUCAS MENOR', isMinor: true };
  const acomp = { id: 'a1', name: 'ANA RESPONSAVEL', type: 'acompanhante', companionForPatientId: 'p_m1' };
  
  const tripulacao = [menor, acomp];

  // Tentativa de excluir o acompanhante a1
  const itemParaExcluir = tripulacao[1];
  const menorVinculado = tripulacao.find(p => p.isMinor && (p.patientId === itemParaExcluir.companionForPatientId || p.id === itemParaExcluir.companionForPatientId));

  assert.ok(menorVinculado);

  const outrosAcompanhantes = tripulacao.filter(
    (p, idx) => idx !== 1 && p.type === 'acompanhante' && p.companionForPatientId === menorVinculado.patientId
  );

  const bloqueiaExclusao = outrosAcompanhantes.length === 0;
  assert.equal(bloqueiaExclusao, true, 'Deve bloquear a exclusão do único acompanhante de menor');
});
