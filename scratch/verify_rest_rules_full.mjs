import { validateDriverScheduleRules, getUnifiedHolidaysMap, getRestBlock, toDateStr, addDays } from '../services/driverRestRulesService.ts';

console.log('=====================================================');
console.log(' TESTE ABRANGENTE DE REGRAS DE DESCANSO E MOTORISTAS ');
console.log('=====================================================\n');

let passedTests = 0;
let totalTests = 0;

function assert(condition, testName, extraInfo = '') {
  totalTests++;
  if (condition) {
    console.log(`✅ [PASSOU] ${testName}`);
    passedTests++;
  } else {
    console.error(`❌ [FALHOU] ${testName} ${extraInfo}`);
  }
}

// 1. REGRA 1: Final de semana (Sábado e Domingo)
// Cenário 1.1: Motorista tem viagem no Sábado (2026-09-26) e tenta agendar no Domingo (2026-09-27)
const schedSabado = [
  {
    id: 's1',
    driverId: 'drv-01',
    vehicleId: 'veh-A',
    departureDateTime: '2026-09-26T07:00:00',
    returnDateTime: '2026-09-26T18:00:00',
    destination: 'Belo Horizonte',
    status: 'confirmado'
  }
];

const resDomComSabado = validateDriverScheduleRules({
  driverId: 'drv-01',
  driverName: 'Carlos Silva',
  departureDateTime: '2026-09-27T08:00:00',
  returnDateTime: '2026-09-27T17:00:00',
  allSchedules: schedSabado
});

assert(
  !resDomComSabado.isValid && resDomComSabado.code === 'WEEKEND_REST_VIOLATION',
  'Regra 1.1: Viagem no Sábado deve bloquear Domingo',
  JSON.stringify(resDomComSabado)
);

// Cenário 1.2: Motorista tem viagem no Domingo (2026-09-27) e tenta agendar no Sábado (2026-09-26)
const schedDomingo = [
  {
    id: 's2',
    driverId: 'drv-01',
    vehicleId: 'veh-B',
    departureDateTime: '2026-09-27T07:00:00',
    returnDateTime: '2026-09-27T18:00:00',
    destination: 'Ipatinga',
    status: 'confirmado'
  }
];

const resSabComDomingo = validateDriverScheduleRules({
  driverId: 'drv-01',
  driverName: 'Carlos Silva',
  departureDateTime: '2026-09-26T08:00:00',
  returnDateTime: '2026-09-26T17:00:00',
  allSchedules: schedDomingo
});

assert(
  !resSabComDomingo.isValid && resSabComDomingo.code === 'WEEKEND_REST_VIOLATION',
  'Regra 1.2: Viagem no Domingo deve bloquear Sábado',
  JSON.stringify(resSabComDomingo)
);

// Cenário 1.3: Outro motorista tenta agendar no Domingo (deve ser permitido)
const resOutroMotorista = validateDriverScheduleRules({
  driverId: 'drv-02',
  driverName: 'Marcos Souza',
  departureDateTime: '2026-09-27T08:00:00',
  returnDateTime: '2026-09-27T17:00:00',
  allSchedules: schedSabado
});

assert(
  resOutroMotorista.isValid,
  'Regra 1.3: Outro motorista deve ter disponibilidade no Domingo',
  JSON.stringify(resOutroMotorista)
);

// 2. REGRA 2: Dias consecutivos (Máximo 5 dias seguidos)
// Cenário 2.1: Viagens em 5 dias consecutivos de Segunda a Sexta (21 a 25/09/2026). Tentar o 6º dia no Sábado (26/09/2026)
const sched5Dias = [
  { id: 'c1', driverId: 'drv-01', departureDateTime: '2026-09-21T08:00:00', returnDateTime: '2026-09-21T17:00:00', status: 'confirmado' },
  { id: 'c2', driverId: 'drv-01', departureDateTime: '2026-09-22T08:00:00', returnDateTime: '2026-09-22T17:00:00', status: 'confirmado' },
  { id: 'c3', driverId: 'drv-01', departureDateTime: '2026-09-23T08:00:00', returnDateTime: '2026-09-23T17:00:00', status: 'confirmado' },
  { id: 'c4', driverId: 'drv-01', departureDateTime: '2026-09-24T08:00:00', returnDateTime: '2026-09-24T17:00:00', status: 'confirmado' },
  { id: 'c5', driverId: 'drv-01', departureDateTime: '2026-09-25T08:00:00', returnDateTime: '2026-09-25T17:00:00', status: 'confirmado' }
];

const res6oDiaConsecutivo = validateDriverScheduleRules({
  driverId: 'drv-01',
  departureDateTime: '2026-09-26T08:00:00', // 6º dia consecutivo
  returnDateTime: '2026-09-26T17:00:00',
  allSchedules: sched5Dias
});

assert(
  !res6oDiaConsecutivo.isValid && res6oDiaConsecutivo.code === 'CONSECUTIVE_DAYS_VIOLATION' && res6oDiaConsecutivo.consecutiveDaysCount === 6,
  'Regra 2.1: 6º dia consecutivo de viagem deve ser bloqueado',
  JSON.stringify(res6oDiaConsecutivo)
);

// Cenário 2.2: Avaliação bi-direcional (passado e futuro)
// Tem viagens em: Seg (21), Ter (22), Qui (24), Sex (25), Sab (26). Tenta encaixar Quarta (23) -> uniria em 6 dias seguidos!
const schedBiDirecional = [
  { id: 'b1', driverId: 'drv-01', departureDateTime: '2026-09-21T08:00:00', returnDateTime: '2026-09-21T17:00:00', status: 'confirmado' },
  { id: 'b2', driverId: 'drv-01', departureDateTime: '2026-09-22T08:00:00', returnDateTime: '2026-09-22T17:00:00', status: 'confirmado' },
  { id: 'b3', driverId: 'drv-01', departureDateTime: '2026-09-24T08:00:00', returnDateTime: '2026-09-24T17:00:00', status: 'confirmado' },
  { id: 'b4', driverId: 'drv-01', departureDateTime: '2026-09-25T08:00:00', returnDateTime: '2026-09-25T17:00:00', status: 'confirmado' },
  { id: 'b5', driverId: 'drv-01', departureDateTime: '2026-09-26T08:00:00', returnDateTime: '2026-09-26T17:00:00', status: 'confirmado' }
];

const resEncaixeConsecutivo = validateDriverScheduleRules({
  driverId: 'drv-01',
  departureDateTime: '2026-09-23T08:00:00', // Quarta-feira
  returnDateTime: '2026-09-23T17:00:00',
  allSchedules: schedBiDirecional
});

assert(
  !resEncaixeConsecutivo.isValid && resEncaixeConsecutivo.code === 'CONSECUTIVE_DAYS_VIOLATION' && resEncaixeConsecutivo.consecutiveDaysCount === 6,
  'Regra 2.2: Encaixe intermediário formando mais de 5 dias consecutivos deve ser bloqueado',
  JSON.stringify(resEncaixeConsecutivo)
);

// 3. REGRA 3: Feriados e Blocos de Descanso
// Cenário 3.1: Sexta-feira é feriado (ex: 2026-05-01). Se houver viagem na Sexta, bloquear Sábado e Domingo.
const schedFeriadoSexta = [
  {
    id: 'f1',
    driverId: 'drv-01',
    departureDateTime: '2026-05-01T08:00:00', // Sexta 01/05 Dia do Trabalhador
    returnDateTime: '2026-05-01T18:00:00',
    status: 'confirmado'
  }
];

const resSabAposFeriado = validateDriverScheduleRules({
  driverId: 'drv-01',
  departureDateTime: '2026-05-02T08:00:00', // Sábado 02/05
  returnDateTime: '2026-05-02T18:00:00',
  allSchedules: schedFeriadoSexta
});

assert(
  !resSabAposFeriado.isValid && resSabAposFeriado.code === 'HOLIDAY_BLOCK_REST_VIOLATION',
  'Regra 3.1: Viagem em feriado na Sexta deve bloquear Sábado no mesmo bloco',
  JSON.stringify(resSabAposFeriado)
);

const resDomAposFeriado = validateDriverScheduleRules({
  driverId: 'drv-01',
  departureDateTime: '2026-05-03T08:00:00', // Domingo 03/05
  returnDateTime: '2026-05-03T18:00:00',
  allSchedules: schedFeriadoSexta
});

assert(
  !resDomAposFeriado.isValid && resDomAposFeriado.code === 'HOLIDAY_BLOCK_REST_VIOLATION',
  'Regra 3.2: Viagem em feriado na Sexta deve bloquear Domingo no mesmo bloco',
  JSON.stringify(resDomAposFeriado)
);

// Cenário 3.3: Feriado na Segunda-feira (ex: 2026-10-12). Se houver viagem no Sábado (10/10), bloquear Domingo (11/10) e Segunda (12/10).
const schedSabFeriadoSeg = [
  {
    id: 'f2',
    driverId: 'drv-01',
    departureDateTime: '2026-10-10T08:00:00', // Sábado 10/10
    returnDateTime: '2026-10-10T18:00:00',
    status: 'confirmado'
  }
];

const resSegFeriado = validateDriverScheduleRules({
  driverId: 'drv-01',
  departureDateTime: '2026-10-12T08:00:00', // Segunda 12/10 (N. Sra. Aparecida)
  returnDateTime: '2026-10-12T18:00:00',
  allSchedules: schedSabFeriadoSeg
});

assert(
  !resSegFeriado.isValid && resSegFeriado.code === 'HOLIDAY_BLOCK_REST_VIOLATION',
  'Regra 3.3: Viagem no Sábado deve bloquear Segunda-feira de Feriado no bloco',
  JSON.stringify(resSegFeriado)
);

// Cenário 3.4: Feriado Municipal cadastrado (ex: Dia de São José, 2026-03-19 Quinta + Recesso Sexta 2026-03-20 + Sáb + Dom)
const customMunicipalHolidays = [
  { date: '2026-03-19', name: 'Dia de São José (Feriado Municipal)', type: 'Feriado Municipal' },
  { date: '2026-03-20', name: 'Recesso Municipal', type: 'Feriado' }
];

const schedFeriadoMun = [
  {
    id: 'fm1',
    driverId: 'drv-01',
    departureDateTime: '2026-03-19T08:00:00', // Quinta Feriado
    returnDateTime: '2026-03-19T18:00:00',
    status: 'confirmado'
  }
];

const resSextaRecesso = validateDriverScheduleRules({
  driverId: 'drv-01',
  departureDateTime: '2026-03-20T08:00:00', // Sexta Recesso
  returnDateTime: '2026-03-20T18:00:00',
  allSchedules: schedFeriadoMun,
  customHolidays: customMunicipalHolidays
});

assert(
  !resSextaRecesso.isValid && resSextaRecesso.code === 'HOLIDAY_BLOCK_REST_VIOLATION',
  'Regra 3.4: Feriados e recessos municipais cadastrados formam bloco contíguo de descanso com limite de 1 viagem',
  JSON.stringify(resSextaRecesso)
);

// 4. Edição do Próprio Agendamento
// Ao editar um agendamento existente, ele deve ignorar a si mesmo (excludeScheduleId)
const resEdicaoPropria = validateDriverScheduleRules({
  driverId: 'drv-01',
  departureDateTime: '2026-09-26T08:00:00',
  returnDateTime: '2026-09-26T18:00:00',
  allSchedules: schedSabado,
  excludeScheduleId: 's1'
});

assert(
  resEdicaoPropria.isValid,
  'Regra 4: Edição do próprio agendamento não deve conflitar consigo mesmo',
  JSON.stringify(resEdicaoPropria)
);

console.log('\n-----------------------------------------------------');
console.log(`RESULTADO FINAL DOS TESTES: ${passedTests}/${totalTests} PASSARAM`);
console.log('-----------------------------------------------------\n');

if (passedTests === totalTests) {
  process.exit(0);
} else {
  process.exit(1);
}
