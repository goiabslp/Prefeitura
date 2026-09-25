// Testes adicionais para cobrir múltiplos cenários
import fs from 'fs';

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

  addH(`${year}-01-01`, 'Confraternização Universal');
  addH(`${year}-04-21`, 'Tiradentes');
  addH(`${year}-05-01`, 'Dia do Trabalho');
  addH(`${year}-09-07`, 'Independência do Brasil');
  addH(`${year}-10-12`, 'Nossa Senhora Aparecida');
  addH(`${year}-11-02`, 'Finados');
  addH(`${year}-11-15`, 'Proclamação da República');
  addH(`${year}-11-20`, 'Dia Nacional de Zumbi e da Consciência Negra');
  addH(`${year}-12-25`, 'Natal');

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

  for (const h of customHolidays) {
    if (h.date && h.name) {
      map.set(h.date, h.name);
    }
  }

  return map;
}

function isRestDay(dateStr, holidaysMap) {
  const dt = parseDateStr(dateStr);
  const dayOfWeek = dt.getDay();
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

function formatDayLabel(dateStr, holidaysMap) {
  const dt = parseDateStr(dateStr);
  const daysOfWeek = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  const dayName = daysOfWeek[dt.getDay()];
  const [y, m, d] = dateStr.split('-');
  const brDate = `${d}/${m}/${y}`;
  const holiday = holidaysMap.get(dateStr);
  if (holiday) {
    return `${dayName}, ${brDate} (${holiday})`;
  }
  return `${dayName}, ${brDate}`;
}

function validateDriverRestRules(params) {
  const {
    driverId,
    driverName = 'o motorista',
    departureDateTime,
    returnDateTime,
    allSchedules = [],
    customHolidays = [],
    excludeScheduleId
  } = params;

  if (!driverId || !departureDateTime || !returnDateTime) {
    return { isValid: true };
  }

  const depTime = new Date(departureDateTime).getTime();
  const retTime = new Date(returnDateTime).getTime();

  if (retTime <= depTime) {
    return { isValid: false, code: 'INVALID_INTERVAL', message: 'A data/hora de retorno deve ser posterior à data/hora de saída.' };
  }

  const depDt = parseDateStr(toDateStr(departureDateTime));
  const year = depDt.getFullYear();
  const holidaysMap = new Map([
    ...generateHolidaysMap(year - 1, customHolidays),
    ...generateHolidaysMap(year, customHolidays),
    ...generateHolidaysMap(year + 1, customHolidays)
  ]);

  const activeSchedules = allSchedules.filter(s =>
    s.driverId === driverId &&
    s.id !== excludeScheduleId &&
    s.status !== 'cancelado'
  );

  // 0. Conflito de horário sobreposto
  const oneHourMs = 60 * 60 * 1000;
  for (const s of activeSchedules) {
    const sStart = new Date(s.departureDateTime).getTime();
    const sEnd = new Date(s.returnDateTime).getTime();

    if ((depTime < sEnd + oneHourMs) && (retTime > sStart - oneHourMs)) {
      return {
        isValid: false,
        code: 'TIME_OVERLAP_VIOLATION',
        title: 'Horário Conflitante',
        message: `O condutor já possui uma viagem agendada com horário conflitante neste período (Destino: ${s.destination || 'Não informado'}).`,
        conflictingSchedule: s
      };
    }
  }

  const newTripDays = getDatesBetween(departureDateTime, returnDateTime);

  // Se a própria nova viagem se estender por múltiplos dias de descanso (ex: Sábado a Domingo)
  if (newTripDays.length > 1) {
    const restDaysInTrip = newTripDays.filter(d => isRestDay(d, holidaysMap));
    if (restDaysInTrip.length > 1) {
      // Verifica se pertencem ao mesmo bloco
      const firstBlock = getRestBlock(restDaysInTrip[0], holidaysMap);
      const allInSameBlock = restDaysInTrip.every(d => firstBlock && firstBlock.dates.includes(d));
      if (allInSameBlock) {
        return {
          isValid: false,
          code: 'HOLIDAY_BLOCK_REST_VIOLATION',
          title: 'Motorista Indisponível - Regra de Descanso',
          message: `Esta viagem abrange múltiplos dias de descanso (${restDaysInTrip.map(d => formatDayLabel(d, holidaysMap)).join(' e ')}). Pelas regras de descanso, o motorista pode realizar no máximo 1 dia de viagem por bloco de final de semana/feriado.`,
          details: { restBlockDates: firstBlock ? firstBlock.dates : [] }
        };
      }
    }
  }

  const existingDaysMap = new Map();
  for (const s of activeSchedules) {
    const tripDays = getDatesBetween(s.departureDateTime, s.returnDateTime);
    for (const d of tripDays) {
      if (!existingDaysMap.has(d)) existingDaysMap.set(d, []);
      existingDaysMap.get(d).push(s);
    }
  }

  // 1. Regra de Final de semana e Bloco de Feriados
  for (const d of newTripDays) {
    const block = getRestBlock(d, holidaysMap);
    if (block && block.dates.length > 1) {
      for (const otherDate of block.dates) {
        if (otherDate !== d && existingDaysMap.has(otherDate)) {
          const conflicting = existingDaysMap.get(otherDate)[0];
          const isWeekendOnly = block.hasWeekend && !block.hasHoliday;
          const otherLabel = formatDayLabel(otherDate, holidaysMap);
          const currentLabel = formatDayLabel(d, holidaysMap);

          if (isWeekendOnly) {
            return {
              isValid: false,
              code: 'WEEKEND_REST_VIOLATION',
              title: 'Motorista Indisponível - Descanso de Fim de Semana',
              message: `Este motorista já possui viagem no ${otherLabel} e, pelas regras de descanso, não poderá ser escalado no ${currentLabel}. O mesmo motorista não pode realizar viagens no sábado e no domingo do mesmo final de semana.`,
              conflictingSchedule: conflicting,
              conflictingDate: otherDate,
              details: {
                conflictingSchedule: conflicting,
                conflictingDate: otherDate,
                restBlockDates: block.dates
              }
            };
          } else {
            return {
              isValid: false,
              code: 'HOLIDAY_BLOCK_REST_VIOLATION',
              title: 'Motorista Indisponível - Descanso de Feriado Prolongado',
              message: `Este motorista já possui viagem no dia ${otherLabel} dentro do bloco de descanso de feriado prolongado e não poderá ser escalado no dia ${currentLabel}. Pelas regras de descanso, o motorista poderá realizar somente uma viagem dentro deste bloco de descanso.`,
              conflictingSchedule: conflicting,
              conflictingDate: otherDate,
              details: {
                conflictingSchedule: conflicting,
                conflictingDate: otherDate,
                restBlockDates: block.dates,
                holidayNames: block.holidayNames
              }
            };
          }
        }
      }
    }
  }

  // 2. Regra de Dias Consecutivos (Máximo de 5 dias consecutivos)
  const allWorkedDays = new Set([...existingDaysMap.keys(), ...newTripDays]);
  for (const d of newTripDays) {
    let leftCount = 0;
    let prevD = addDays(d, -1);
    while (allWorkedDays.has(prevD)) {
      leftCount++;
      prevD = addDays(prevD, -1);
    }

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
      const startLabel = formatDayLabel(seqStart, holidaysMap);
      const endLabel = formatDayLabel(seqEnd, holidaysMap);

      return {
        isValid: false,
        code: 'CONSECUTIVE_DAYS_VIOLATION',
        title: 'Motorista Indisponível - Limite de Dias Consecutivos',
        message: `A inclusão desta viagem fará com que o motorista trabalhe ${totalConsecutive} dias consecutivos (sequência ininterrupta de ${startLabel} a ${endLabel}). Pelas regras de descanso, o motorista poderá possuir no máximo 5 dias consecutivos com viagens, sendo o 6º dia consecutivo obrigatoriamente bloqueado.`,
        consecutiveDaysCount: totalConsecutive,
        details: {
          consecutiveDaysCount: totalConsecutive,
          consecutiveDates: [seqStart, seqEnd]
        }
      };
    }
  }

  return { isValid: true };
}

// Teste adicional: Segunda-feira feriado (ex: 2026-10-12)
// Sábado = 2026-10-10, Domingo = 2026-10-11, Segunda = 2026-10-12 (Feriado N. Sra. Aparecida)
console.log('--- TESTE 5: Feriado na Segunda (12/10) ---');
const schedSegunda = [{ id: '1', driverId: 'd1', departureDateTime: '2026-10-12T08:00:00', returnDateTime: '2026-10-12T18:00:00', status: 'confirmado', destination: 'Belo Horizonte' }];
const resSabado = validateDriverRestRules({
  driverId: 'd1',
  departureDateTime: '2026-10-10T08:00:00', // Sábado
  returnDateTime: '2026-10-10T18:00:00',
  allSchedules: schedSegunda
});
console.log('Tentando sábado com segunda feriado agendada:', resSabado);

console.log('--- TESTE 6: Viagem única pegando Sábado e Domingo juntos ---');
const resViagemMultiplosDias = validateDriverRestRules({
  driverId: 'd1',
  departureDateTime: '2026-10-10T08:00:00', // Sábado
  returnDateTime: '2026-10-11T18:00:00', // Domingo
  allSchedules: []
});
console.log('Tentando viagem de 2 dias no mesmo final de semana:', resViagemMultiplosDias);
