import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

console.log('🧪 Iniciando testes de Suporte a Múltiplos Pacientes com o Mesmo Acompanhante...');

// 1. Verificação Estática de SelecionarAcompanhanteModal.tsx
{
  console.log('  [1] Verificando SelecionarAcompanhanteModal.tsx...');
  const modalPath = path.join(projectRoot, 'components', 'vehicle', 'SelecionarAcompanhanteModal.tsx');
  const modalContent = fs.readFileSync(modalPath, 'utf-8');

  // Não deve conter bloqueio rígido que impede duplicidade de acompanhante
  assert.ok(!modalContent.includes('já está na tripulação desta viagem e não pode ser duplicado'), 'Não deve bloquear acompanhante já presente');
  assert.ok(modalContent.includes('Pode acompanhar múltiplos pacientes') || modalContent.includes('Acompanhará múltiplos pacientes'), 'Deve informar que pode acompanhar múltiplos');
  assert.ok(modalContent.includes('isDisabled = isCurrentPatient || (isMandatoryForMinor && isMinorCandidate)'), 'Apenas paciente atual e menor acompanhando menor devem desabilitar');
}

// 2. Verificação Estática de VehicleSchedulingScreen.tsx
{
  console.log('  [2] Verificando VehicleSchedulingScreen.tsx...');
  const screenPath = path.join(projectRoot, 'components', 'VehicleSchedulingScreen.tsx');
  const screenContent = fs.readFileSync(screenPath, 'utf-8');

  assert.ok(screenContent.includes('companionAlreadyInTrip'), 'Deve detectar se acompanhante já está na viagem');
  assert.ok(screenContent.includes('seatsNeeded = 1 + (companionData && !companionAlreadyInTrip ? 1 : 0)'), 'Deve alocar apenas 1 assento se o acompanhante já estiver no veículo');
  assert.ok(screenContent.includes('companionAlreadyInTripIdx'), 'Deve associar o acompanhante existente ao novo paciente sem duplicar o assento');
  assert.ok(screenContent.includes('stillUsedByOther'), 'Ao remover paciente, só remove o acompanhante se nenhum outro paciente o utilizar');
}

// 3. Simulação Lógica do Fluxo de Múltiplos Pacientes com Mesmo Acompanhante
{
  console.log('  [3] Simulando alocação de tripulação e assentos compartilhados...');

  let passengers = [];

  // Paciente 1: Pedro (Menor de idade) + Acompanhante Maria
  const pedro = {
    id: 'pax_pedro',
    patientId: 'paciente_pedro',
    name: 'PEDRO SILVA',
    isMinor: true,
    companionId: 'acomp_maria',
    companionName: 'MARIA SILVA',
    type: 'paciente'
  };

  const maria = {
    id: 'acomp_maria',
    patientId: 'paciente_maria',
    name: 'MARIA SILVA',
    type: 'acompanhante',
    companionForPatientId: 'paciente_pedro',
    companionForPatientName: 'PEDRO SILVA'
  };

  passengers.push(pedro);
  passengers.push(maria);

  assert.equal(passengers.length, 2, 'Deve ter Pedro e Maria');
  assert.equal(passengers.filter(p => p.type === 'paciente').length, 1);
  assert.equal(passengers.filter(p => p.type === 'acompanhante').length, 1);

  // Paciente 2: Lucas (irmão de Pedro) + A MESMA Acompanhante Maria
  const lucas = {
    id: 'pax_lucas',
    patientId: 'paciente_lucas',
    name: 'LUCAS SILVA',
    isMinor: true,
    companionId: 'acomp_maria',
    companionName: 'MARIA SILVA',
    type: 'paciente'
  };

  // Simula a lógica de handleSavePassenger para companion existente
  const companionAlreadyInTrip = passengers.some(
    p => p.patientId === maria.patientId || p.id === maria.id
  );
  assert.equal(companionAlreadyInTrip, true, 'Maria já está na viagem');

  const seatsNeeded = 1 + (!companionAlreadyInTrip ? 1 : 0);
  assert.equal(seatsNeeded, 1, 'Lucas precisa de apenas 1 assento no veículo, pois Maria já tem o seu assento');

  // Adiciona Lucas sem duplicar Maria
  passengers.push(lucas);

  // Atualiza Maria com a lista de acompanhados
  const mariaIdx = passengers.findIndex(p => p.id === 'acomp_maria');
  passengers[mariaIdx] = {
    ...passengers[mariaIdx],
    companionForPatientName: 'PEDRO SILVA, LUCAS SILVA'
  };

  assert.equal(passengers.length, 3, 'Total de pessoas físicas na viagem deve ser exatamente 3 (Pedro, Maria, Lucas)');
  assert.equal(passengers.filter(p => p.type === 'paciente').length, 2, '2 pacientes');
  assert.equal(passengers.filter(p => p.type === 'acompanhante').length, 1, '1 acompanhante única');

  // 4. Simulação de Remoção de Um dos Pacientes
  console.log('  [4] Simulando remoção de Pedro (Maria deve permanecer acompanhando Lucas)...');
  // Remove Pedro
  passengers = passengers.filter(p => p.id !== 'pax_pedro');

  // Verifica se Maria ainda é necessária para Lucas
  const mariaStillNeeded = passengers.some(
    p => p.type === 'paciente' && p.companionId === 'acomp_maria'
  );
  assert.equal(mariaStillNeeded, true, 'Maria ainda deve ser mantida pois acompanha Lucas');

  if (mariaStillNeeded) {
    const remainingNames = passengers
      .filter(p => p.type === 'paciente' && p.companionId === 'acomp_maria')
      .map(p => p.name);
    passengers[passengers.findIndex(p => p.id === 'acomp_maria')].companionForPatientName = remainingNames.join(', ');
  }

  assert.equal(passengers.length, 2, 'Devem restar Lucas e Maria');
  assert.equal(passengers.find(p => p.id === 'acomp_maria').companionForPatientName, 'LUCAS SILVA');

  // 5. Simulação de Remoção de Lucas (último paciente acompanhado por Maria)
  console.log('  [5] Simulando remoção de Lucas (Maria deve ser liberada da viagem)...');
  passengers = passengers.filter(p => p.id !== 'pax_lucas');
  const mariaNeededAfterLucas = passengers.some(
    p => p.type === 'paciente' && p.companionId === 'acomp_maria'
  );
  assert.equal(mariaNeededAfterLucas, false, 'Nenhum paciente precisa mais de Maria');
  if (!mariaNeededAfterLucas) {
    passengers = passengers.filter(p => p.id !== 'acomp_maria');
  }

  assert.equal(passengers.length, 0, 'Tripulação vazia após remover todos os passageiros');
}

console.log('✅ Todos os testes de Múltiplos Pacientes com o Mesmo Acompanhante foram aprovados com sucesso!');
