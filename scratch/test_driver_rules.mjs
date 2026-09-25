// Teste das regras de descanso e disponibilidade do motorista

// Funções de apoio
function toDateStr(d) {
  if (typeof d === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
    const dateObj = new Date(d);
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDateStr(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

function addDays(dateStr, days) {
  const dt = parseDateStr(dateStr);
  dt.setDate(dt.getDate() + days);
  return toDateStr(dt);
}

function getEasterDate(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month, day);
}

function generateHolidaysMap(year, customHolidays = []) {
  const map = new Map();

  const addH = (dStr, name) => map.set(dStr, name);

  // Fixos
  addH(`${year}-01-01`, 'Confraternização Universal');
  addH(`${year}-04-21`, 'Tiradentes');
  addH(`${year}-05-01`, 'Dia do Trabalho');
  addH(`${year}-09-07`, 'Independência do Brasil');
  addH(`${year}-10-12`, 'Nossa Senhora Aparecida');
  addH(`${year}-11-02`, 'Finados');
  addH(`${year}-11-15`, 'Proclamação da República');
  addH(`${year}-11-20`, 'Dia Nacional de Zumbi e da Consciência Negra');
  addH(`${year}-12-25`, 'Natal');

  // Móveis
  const easter = getEasterDate(year);
  const dtStr = (d) => toDateStr(d);
  const addD = (base, n) => {
    const r = new Date(base);
    r.setDate(r.getDate() + n);
    return r;
  };

  addH(dtStr(addD(easter, -2)), 'Sexta-feira Santa');
  addH(dtStr(addD(easter, -48)), 'Segunda-feira de Carnaval');
  addH(dtStr(addD(easter, -47)), 'Terça-feira de Carnaval');
  addH(dtStr(addD(easter, 60)), 'Corpus Christi');

  // Customizados
  for (const h of customHolidays) {
    if (h.date && h.name) {
      map.set(h.date, h.name);
    }
  }

  return map;
}

function isRestDay(dateStr, holidaysMap) {
  const dt = parseDateStr(dateStr);
  const dayOfWeek = dt.getDay(); // 0 = Domingo, 6 = Sábado
  if (dayOfWeek === 0 || dayOfWeek === 6) return true;
  return holidaysMap.has(dateStr);
}

function getRestBlock(targetDateStr, holidaysMap) {
  if (!isRestDay(targetDateStr, holidaysMap)) return null;

  let start = targetDateStr;
  while (isRestDay(addDays(start, -1), holidaysMap)) {
    start = addDays(start, -1);
  }

  let end = targetDateStr;
  while (isRestDay(addDays(end, 1), holidaysMap)) {
    end = addDays(end, 1);
  }

  const dates = [];
  let curr = start;
  while (curr <= end) {
    dates.push(curr);
    curr = addDays(curr, 1);
  }

  let hasWeekend = false;
  let hasHoliday = false;
  const holidayNames = [];

  for (const d of dates) {
    const dw = parseDateStr(d).getDay();
    if (dw === 0 || dw === 6) hasWeekend = true;
    if (holidaysMap.has(d)) {
      hasHoliday = true;
      holidayNames.push(`${d}: ${holidaysMap.get(d)}`);
    }
  }

  return {
    startDate: start,
    endDate: end,
    dates,
    hasWeekend,
    hasHoliday,
    holidayNames
  };
}

function getDatesBetween(startIso, endIso) {
  const sStr = toDateStr(startIso);
  const eStr = toDateStr(endIso);
  const dates = [];
  let curr = sStr;
  while (curr <= eStr) {
    dates.push(curr);
    curr = addDays(curr, 1);
  }
  return dates;
}

function validateDriverRest(params) {
  const { driverId, departureDateTime, returnDateTime, existingSchedules = [], customHolidays = [], excludeScheduleId } = params;
  const depDt = parseDateStr(toDateStr(departureDateTime));
  const year = depDt.getFullYear();
  const holidaysMap = new Map([
    ...generateHolidaysMap(year - 1, customHolidays),
    ...generateHolidaysMap(year, customHolidays),
    ...generateHolidaysMap(year + 1, customHolidays)
  ]);

  const activeSchedules = existingSchedules.filter(s => 
    s.driverId === driverId &&
    s.id !== excludeScheduleId &&
    s.status !== 'cancelado'
  );

  const existingDaysMap = new Map();
  for (const s of activeSchedules) {
    const tripDays = getDatesBetween(s.departureDateTime, s.returnDateTime);
    for (const d of tripDays) {
      if (!existingDaysMap.has(d)) existingDaysMap.set(d, []);
      existingDaysMap.get(d).push(s);
    }
  }

  const newTripDays = getDatesBetween(departureDateTime, returnDateTime);

  // 1. Regra de Bloco de Descanso (Final de semana e Feriados)
  for (const d of newTripDays) {
    const block = getRestBlock(d, holidaysMap);
    if (block && block.dates.length > 1) {
      // É um bloco de descanso (ex: Sáb+Dom, ou Sex(Feriado)+Sáb+Dom, ou Sáb+Dom+Seg(Feriado))
      for (const otherDate of block.dates) {
        if (otherDate !== d && existingDaysMap.has(otherDate)) {
          const conflicting = existingDaysMap.get(otherDate)[0];
          const isWeekendOnly = block.hasWeekend && !block.hasHoliday;
          if (isWeekendOnly) {
            return {
              isValid: false,
              code: 'WEEKEND_REST_VIOLATION',
              message: `O motorista já possui viagem no final de semana (${otherDate}) e, pelas regras de descanso, não poderá ser escalado no dia ${d}. Não é permitido viajar no sábado e no domingo do mesmo final de semana.`,
              conflictingSchedule: conflicting
            };
          } else {
            return {
              isValid: false,
              code: 'HOLIDAY_BLOCK_REST_VIOLATION',
              message: `O motorista já possui viagem no dia ${otherDate} dentro do bloco de descanso/feriado (${block.startDate} a ${block.endDate}). Pelas regras de descanso, é permitida apenas 1 viagem dentro do mesmo bloco de feriado/final de semana.`,
              conflictingSchedule: conflicting
            };
          }
        }
      }
    }
  }

  // 2. Regra de Dias Consecutivos (Máximo 5 dias)
  const allWorkedDays = new Set([...existingDaysMap.keys(), ...newTripDays]);
  for (const d of newTripDays) {
    // Busca sequência anterior
    let leftCount = 0;
    let prevD = addDays(d, -1);
    while (allWorkedDays.has(prevD)) {
      leftCount++;
      prevD = addDays(prevD, -1);
    }

    // Busca sequência posterior
    let rightCount = 0;
    let nextD = addDays(d, 1);
    while (allWorkedDays.has(nextD)) {
      rightCount++;
      nextD = addDays(nextD, 1);
    }

    const totalConsecutive = 1 + leftCount + rightCount;
    if (totalConsecutive > 5) {
      const seqStart = addDays(d, -leftCount);
      const seqEnd = addDays(d, rightCount);
      return {
        isValid: false,
        code: 'CONSECUTIVE_DAYS_VIOLATION',
        message: `Esta viagem fará com que o motorista trabalhe ${totalConsecutive} dias consecutivos (de ${seqStart} a ${seqEnd}). O limite máximo permitido é de 5 dias consecutivos com viagens.`,
        consecutiveDaysCount: totalConsecutive
      };
    }
  }

  return { isValid: true };
}

// Testes:
console.log('--- TESTE 1: Sábado e Domingo ---');
const schedSabado = [{ id: '1', driverId: 'd1', departureDateTime: '2026-09-26T08:00:00', returnDateTime: '2026-09-26T18:00:00', status: 'confirmado' }]; // 26/09/2026 = Sábado
const resDomingo = validateDriverRest({
  driverId: 'd1',
  departureDateTime: '2026-09-27T08:00:00', // 27/09/2026 = Domingo
  returnDateTime: '2026-09-27T18:00:00',
  existingSchedules: schedSabado
});
console.log('Tentando domingo com sábado agendado:', resDomingo);

console.log('--- TESTE 2: Feriado Sexta + Sábado + Domingo ---');
// 2026-04-03 = Sexta-feira Santa
const schedSextaSanta = [{ id: '2', driverId: 'd1', departureDateTime: '2026-04-03T08:00:00', returnDateTime: '2026-04-03T18:00:00', status: 'confirmado' }];
const resSabadoPascoa = validateDriverRest({
  driverId: 'd1',
  departureDateTime: '2026-04-04T08:00:00', // Sábado de Aleluia
  returnDateTime: '2026-04-04T18:00:00',
  existingSchedules: schedSextaSanta
});
console.log('Tentando sábado com sexta-feira santa agendada:', resSabadoPascoa);

console.log('--- TESTE 3: 5 dias consecutivos vs 6º dia ---');
// 2026-09-21 (Seg) a 2026-09-25 (Sex) = 5 dias
const sched5Dias = [
  { id: '1', driverId: 'd1', departureDateTime: '2026-09-21T08:00:00', returnDateTime: '2026-09-21T18:00:00', status: 'confirmado' },
  { id: '2', driverId: 'd1', departureDateTime: '2026-09-22T08:00:00', returnDateTime: '2026-09-22T18:00:00', status: 'confirmado' },
  { id: '3', driverId: 'd1', departureDateTime: '2026-09-23T08:00:00', returnDateTime: '2026-09-23T18:00:00', status: 'confirmado' },
  { id: '4', driverId: 'd1', departureDateTime: '2026-09-24T08:00:00', returnDateTime: '2026-09-24T18:00:00', status: 'confirmado' },
  { id: '5', driverId: 'd1', departureDateTime: '2026-09-25T08:00:00', returnDateTime: '2026-09-25T18:00:00', status: 'confirmado' }
];
const res6oDia = validateDriverRest({
  driverId: 'd1',
  departureDateTime: '2026-09-26T08:00:00', // Sábado (6º dia)
  returnDateTime: '2026-09-26T18:00:00',
  existingSchedules: sched5Dias
});
console.log('Tentando 6º dia consecutivo:', res6oDia);

console.log('--- TESTE 4: Encaixe no meio formando 6 dias ---');
// Tem Seg (21), Ter (22), Qui (24), Sex (25), Sab (26). Tenta Quarta (23).
const schedBuraco = [
  { id: '1', driverId: 'd1', departureDateTime: '2026-09-21T08:00:00', returnDateTime: '2026-09-21T18:00:00', status: 'confirmado' },
  { id: '2', driverId: 'd1', departureDateTime: '2026-09-22T08:00:00', returnDateTime: '2026-09-22T18:00:00', status: 'confirmado' },
  { id: '3', driverId: 'd1', departureDateTime: '2026-09-24T08:00:00', returnDateTime: '2026-09-24T18:00:00', status: 'confirmado' },
  { id: '4', driverId: 'd1', departureDateTime: '2026-09-25T08:00:00', returnDateTime: '2026-09-25T18:00:00', status: 'confirmado' },
  { id: '5', driverId: 'd1', departureDateTime: '2026-09-26T08:00:00', returnDateTime: '2026-09-26T18:00:00', status: 'confirmado' }
];
const resBuraco = validateDriverRest({
  driverId: 'd1',
  departureDateTime: '2026-09-23T08:00:00', // Quarta
  returnDateTime: '2026-09-23T18:00:00',
  existingSchedules: schedBuraco
});
console.log('Tentando encaixar quarta formando 6 dias seguidos:', resBuraco);
