import { VehicleSchedule } from '../types';
import { supabase } from './supabaseClient';

export interface SystemHoliday {
    date: string; // YYYY-MM-DD
    name: string;
    type?: string;
}

export interface DriverValidationResult {
    isValid: boolean;
    code?: 'WEEKEND_REST_VIOLATION' | 'HOLIDAY_BLOCK_REST_VIOLATION' | 'CONSECUTIVE_DAYS_VIOLATION' | 'TIME_OVERLAP_VIOLATION' | 'INVALID_INTERVAL';
    title?: string;
    message?: string;
    conflictingSchedule?: VehicleSchedule;
    conflictingDate?: string;
    consecutiveDaysCount?: number;
    details?: {
        conflictingSchedule?: VehicleSchedule;
        conflictingDate?: string;
        consecutiveDaysCount?: number;
        consecutiveDates?: [string, string];
        restBlockDates?: string[];
        holidayNames?: string[];
        tripDates?: string[];
    };
}

/**
 * Converte qualquer Date ou string de data/ISO para 'YYYY-MM-DD' seguro (considerando fuso local).
 */
export const toDateStr = (d: Date | string): string => {
    if (!d) return '';
    if (typeof d === 'string') {
        if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
        // Se já começa com YYYY-MM-DD mas tem hora (ex: 2026-09-25T14:00:00)
        if (d.includes('T')) {
            const dateObj = new Date(d);
            const y = dateObj.getFullYear();
            const m = String(dateObj.getMonth() + 1).padStart(2, '0');
            const day = String(dateObj.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
        }
        const dateObj = new Date(d);
        if (!isNaN(dateObj.getTime())) {
            const y = dateObj.getFullYear();
            const m = String(dateObj.getMonth() + 1).padStart(2, '0');
            const day = String(dateObj.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
        }
    }
    const dateObj = d as Date;
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

/**
 * Converte 'YYYY-MM-DD' para objeto Date configurado ao meio-dia para evitar desvios de DST/fuso.
 */
export const parseDateStr = (str: string): Date => {
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d, 12, 0, 0);
};

/**
 * Soma X dias a uma string de data 'YYYY-MM-DD'.
 */
export const addDays = (dateStr: string, days: number): string => {
    const dt = parseDateStr(dateStr);
    dt.setDate(dt.getDate() + days);
    return toDateStr(dt);
};

/**
 * Retorna todos os dias civis (YYYY-MM-DD) compreendidos entre a saída e o retorno.
 */
export const getDatesBetween = (startIso: string, endIso: string): string[] => {
    const sStr = toDateStr(startIso);
    const eStr = toDateStr(endIso);
    if (!sStr || !eStr) return [];

    const dates: string[] = [];
    let curr = sStr;
    // Limite de segurança para evitar loops infinitos
    let maxSafety = 60;
    while (curr <= eStr && maxSafety > 0) {
        dates.push(curr);
        curr = addDays(curr, 1);
        maxSafety--;
    }
    return dates;
};

/**
 * Cálculo da data de Páscoa (Algoritmo de Meeus/Jones/Butcher).
 */
export const getEasterDate = (year: number): Date => {
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
};

/**
 * Gera os feriados nacionais e estaduais (MG) para um determinado ano.
 */
export const generateStandardHolidaysMap = (year: number): Map<string, string> => {
    const map = new Map<string, string>();
    const add = (dStr: string, name: string) => map.set(dStr, name);

    // Feriados Nacionais Fixos (Lei Federal 10.607/2002 e Lei 14.759/2023)
    add(`${year}-01-01`, 'Confraternização Universal');
    add(`${year}-04-21`, 'Tiradentes');
    add(`${year}-05-01`, 'Dia do Trabalhador');
    add(`${year}-09-07`, 'Independência do Brasil');
    add(`${year}-10-12`, 'Nossa Senhora Aparecida');
    add(`${year}-11-02`, 'Finados');
    add(`${year}-11-15`, 'Proclamação da República');
    add(`${year}-11-20`, 'Dia Nacional de Zumbi e da Consciência Negra');
    add(`${year}-12-25`, 'Natal');

    // Feriados Móveis baseados na Páscoa
    const easter = getEasterDate(year);
    const addDateOffset = (base: Date, daysOffset: number): string => {
        const r = new Date(base);
        r.setDate(r.getDate() + daysOffset);
        return toDateStr(r);
    };

    add(addDateOffset(easter, -2), 'Sexta-feira Santa');
    add(addDateOffset(easter, -48), 'Segunda-feira de Carnaval');
    add(addDateOffset(easter, -47), 'Terça-feira de Carnaval');
    add(addDateOffset(easter, 60), 'Corpus Christi');

    return map;
};

// Cache de feriados do sistema
let cachedDbHolidays: SystemHoliday[] = [];
let lastFetchTime = 0;

/**
 * Busca feriados municipais e eventos de feriado cadastrados no banco de dados.
 */
export const fetchSystemHolidaysFromDatabase = async (): Promise<SystemHoliday[]> => {
    const now = Date.now();
    // Cache de 5 minutos
    if (cachedDbHolidays.length > 0 && (now - lastFetchTime < 5 * 60 * 1000)) {
        return cachedDbHolidays;
    }

    try {
        const { data, error } = await supabase
            .from('calendar_events')
            .select('id, title, type, start_date, end_date, is_recurring');

        if (error) {
            console.warn('Aviso: Não foi possível carregar feriados do banco de dados:', error);
            return cachedDbHolidays;
        }

        const holidays: SystemHoliday[] = [];
        for (const evt of data || []) {
            const isHolidayType = evt.type === 'Feriado' || evt.type === 'Feriado Municipal' || evt.type === 'Feriado Geral';
            const titleLower = (evt.title || '').toLowerCase();
            const hasHolidayWord = titleLower.includes('feriado') || titleLower.includes('recesso');

            if (isHolidayType || hasHolidayWord) {
                const sDate = toDateStr(evt.start_date);
                const eDate = toDateStr(evt.end_date || evt.start_date);
                const allDates = getDatesBetween(sDate, eDate);

                for (const d of allDates) {
                    holidays.push({
                        date: d,
                        name: evt.title ? evt.title.trim() : 'Feriado Municipal',
                        type: evt.type
                    });
                }
            }
        }

        cachedDbHolidays = holidays;
        lastFetchTime = now;
        return holidays;
    } catch (err) {
        console.warn('Erro ao buscar feriados do banco:', err);
        return cachedDbHolidays;
    }
};

/**
 * Monta o mapa unificado de feriados para os anos pertinentes.
 */
export const getUnifiedHolidaysMap = (years: number[], customHolidays: SystemHoliday[] = []): Map<string, string> => {
    const holidaysMap = new Map<string, string>();

    for (const yr of years) {
        const std = generateStandardHolidaysMap(yr);
        for (const [d, name] of std.entries()) {
            holidaysMap.set(d, name);
        }
    }

    // Mescla com feriados customizados / do banco
    for (const h of customHolidays) {
        if (h.date && h.name) {
            const dateStr = toDateStr(h.date);
            holidaysMap.set(dateStr, h.name);
        }
    }

    return holidaysMap;
};

/**
 * Verifica se uma data específica é dia de descanso (Sábado, Domingo ou Feriado).
 */
export const isRestDay = (dateStr: string, holidaysMap: Map<string, string>): boolean => {
    const dt = parseDateStr(dateStr);
    const dayOfWeek = dt.getDay(); // 0 = Domingo, 6 = Sábado
    if (dayOfWeek === 0 || dayOfWeek === 6) return true;
    return holidaysMap.has(dateStr);
};

export interface RestBlock {
    startDate: string;
    endDate: string;
    dates: string[];
    hasWeekend: boolean;
    hasHoliday: boolean;
    holidayNames: string[];
    description: string;
}

/**
 * Identifica o bloco contíguo de descanso em torno de uma data (ex: Sex feriado + Sáb + Dom).
 */
export const getRestBlock = (targetDateStr: string, holidaysMap: Map<string, string>): RestBlock | null => {
    if (!isRestDay(targetDateStr, holidaysMap)) return null;

    let start = targetDateStr;
    while (isRestDay(addDays(start, -1), holidaysMap)) {
        start = addDays(start, -1);
    }

    let end = targetDateStr;
    while (isRestDay(addDays(end, 1), holidaysMap)) {
        end = addDays(end, 1);
    }

    const dates: string[] = [];
    let curr = start;
    while (curr <= end) {
        dates.push(curr);
        curr = addDays(curr, 1);
    }

    let hasWeekend = false;
    let hasHoliday = false;
    const holidayNames: string[] = [];

    for (const d of dates) {
        const dw = parseDateStr(d).getDay();
        if (dw === 0 || dw === 6) hasWeekend = true;
        if (holidaysMap.has(d)) {
            hasHoliday = true;
            holidayNames.push(`${d}: ${holidaysMap.get(d)}`);
        }
    }

    let description = 'Bloco de Descanso';
    if (hasWeekend && !hasHoliday) {
        description = 'Final de Semana';
    } else if (hasWeekend && hasHoliday) {
        description = 'Feriado Prolongado / Final de Semana';
    } else if (hasHoliday) {
        description = 'Feriado';
    }

    return {
        startDate: start,
        endDate: end,
        dates,
        hasWeekend,
        hasHoliday,
        holidayNames,
        description
    };
};

/**
 * Formata um rótulo legível em português para a data (ex: "Sábado, 26/09/2026" ou "Sexta-feira, 03/04/2026 (Sexta-feira Santa)").
 */
export const formatDayLabel = (dateStr: string, holidaysMap?: Map<string, string>): string => {
    if (!dateStr) return '';
    const dt = parseDateStr(dateStr);
    const daysOfWeek = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    const dayName = daysOfWeek[dt.getDay()];
    const [y, m, d] = dateStr.split('-');
    const brDate = `${d}/${m}/${y}`;
    const holiday = holidaysMap?.get(dateStr);
    if (holiday) {
        return `${dayName}, ${brDate} (${holiday})`;
    }
    return `${dayName}, ${brDate}`;
};

export interface ValidateDriverRulesParams {
    driverId: string;
    driverName?: string;
    departureDateTime: string;
    returnDateTime: string;
    allSchedules: VehicleSchedule[];
    customHolidays?: SystemHoliday[];
    excludeScheduleId?: string;
}

/**
 * Validação abrangente de todas as regras de descanso e disponibilidade do motorista:
 * 1. Regra de Final de Semana (não pode sábado e domingo do mesmo final de semana).
 * 2. Regra de Dias Consecutivos (máximo 5 dias consecutivos com viagens, 6º dia bloqueado; avalia antes e depois).
 * 3. Regra de Feriados (máximo 1 viagem no bloco contíguo de descanso/feriado).
 * 4. Conflito direto de horário.
 */
export const validateDriverScheduleRules = (params: ValidateDriverRulesParams): DriverValidationResult => {
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

    if (isNaN(depTime) || isNaN(retTime)) {
        return { isValid: true };
    }

    if (retTime <= depTime) {
        return {
            isValid: false,
            code: 'INVALID_INTERVAL',
            title: 'Intervalo Inválido',
            message: 'A data e horário de retorno devem ser posteriores à data e horário de saída.'
        };
    }

    const depDateStr = toDateStr(departureDateTime);
    const depDt = parseDateStr(depDateStr);
    const year = depDt.getFullYear();

    const holidaysMap = getUnifiedHolidaysMap([year - 1, year, year + 1], [
        ...cachedDbHolidays,
        ...customHolidays
    ]);

    // Filtra todas as viagens ativas que comprometem este motorista
    const activeSchedules = allSchedules.filter(s =>
        s.driverId === driverId &&
        s.id !== excludeScheduleId &&
        s.status !== 'cancelado'
    );

    // 0. Conflito Direto de Horário (com margem de segurança de 1 hora)
    const oneHourMs = 60 * 60 * 1000;
    for (const s of activeSchedules) {
        const sStart = new Date(s.departureDateTime).getTime();
        const sEnd = new Date(s.returnDateTime).getTime();

        if ((depTime < sEnd + oneHourMs) && (retTime > sStart - oneHourMs)) {
            const startLabel = new Date(s.departureDateTime).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
            const endLabel = new Date(s.returnDateTime).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
            return {
                isValid: false,
                code: 'TIME_OVERLAP_VIOLATION',
                title: 'Motorista com Horário Conflitante',
                message: `Este motorista já possui uma viagem agendada com horário sobreposto ou muito próximo no mesmo período (Destino: ${s.destination || 'Não informado'}, Saída: ${startLabel}, Retorno: ${endLabel}).`,
                conflictingSchedule: s,
                details: { conflictingSchedule: s }
            };
        }
    }

    const newTripDays = getDatesBetween(departureDateTime, returnDateTime);

    // Se a própria nova viagem abranger múltiplos dias de um mesmo bloco de descanso (ex: viagem com saída no sábado e retorno no domingo)
    if (newTripDays.length > 1) {
        const restDaysInTrip = newTripDays.filter(d => isRestDay(d, holidaysMap));
        if (restDaysInTrip.length > 1) {
            const firstBlock = getRestBlock(restDaysInTrip[0], holidaysMap);
            const allInSameBlock = restDaysInTrip.every(d => firstBlock && firstBlock.dates.includes(d));
            if (allInSameBlock) {
                const restLabels = restDaysInTrip.map(d => formatDayLabel(d, holidaysMap)).join(' e ');
                return {
                    isValid: false,
                    code: 'HOLIDAY_BLOCK_REST_VIOLATION',
                    title: 'Motorista Indisponível — Regra de Descanso',
                    message: `Esta viagem abrange múltiplos dias de descanso seguidos (${restLabels}). Pelas regras de descanso, o motorista só pode realizar no máximo 1 dia de viagem dentro do mesmo bloco de final de semana ou feriado.`,
                    details: {
                        restBlockDates: firstBlock ? firstBlock.dates : [],
                        tripDates: restDaysInTrip
                    }
                };
            }
        }
    }

    // Mapeamento dos dias já ocupados por outras viagens do motorista
    const existingDaysMap = new Map<string, VehicleSchedule[]>();
    for (const s of activeSchedules) {
        const tripDays = getDatesBetween(s.departureDateTime, s.returnDateTime);
        for (const d of tripDays) {
            if (!existingDaysMap.has(d)) existingDaysMap.set(d, []);
            existingDaysMap.get(d)!.push(s);
        }
    }

    // 1 & 3. Regra de Final de Semana e Bloco de Feriados
    for (const d of newTripDays) {
        const block = getRestBlock(d, holidaysMap);
        if (block && block.dates.length > 1) {
            // Verifica todos os outros dias do mesmo bloco de descanso
            for (const otherDate of block.dates) {
                if (otherDate !== d && existingDaysMap.has(otherDate)) {
                    const conflicting = existingDaysMap.get(otherDate)![0];
                    const isWeekendOnly = block.hasWeekend && !block.hasHoliday;
                    const otherLabel = formatDayLabel(otherDate, holidaysMap);
                    const currentLabel = formatDayLabel(d, holidaysMap);

                    if (isWeekendOnly) {
                        return {
                            isValid: false,
                            code: 'WEEKEND_REST_VIOLATION',
                            title: 'Motorista Indisponível',
                            message: `Este motorista já possui viagem no ${otherLabel} e, pelas regras de descanso, não poderá ser escalado no ${currentLabel}. O mesmo motorista não poderá realizar viagens no sábado e no domingo do mesmo final de semana.`,
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
                            title: 'Motorista Indisponível',
                            message: `Este motorista já possui viagem no dia ${otherLabel} dentro do bloco de descanso (${block.description}) e não poderá ser escalado no dia ${currentLabel}. Quando houver feriado junto ou próximo ao final de semana, o motorista poderá realizar somente uma viagem dentro daquele bloco de descanso.`,
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

    // 2. Regra de Dias Consecutivos (Máximo de 5 dias consecutivos com viagens)
    const allWorkedDays = new Set<string>([...existingDaysMap.keys(), ...newTripDays]);
    for (const d of newTripDays) {
        // Sequência anterior contígua
        let leftCount = 0;
        let prevD = addDays(d, -1);
        while (allWorkedDays.has(prevD)) {
            leftCount++;
            prevD = addDays(prevD, -1);
        }

        // Sequência posterior contígua
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
                title: 'Motorista Indisponível',
                message: `A inclusão desta viagem fará com que o motorista trabalhe ${totalConsecutive} dias consecutivos (sequência ininterrupta de ${startLabel} a ${endLabel}). Durante a semana, o motorista poderá possuir no máximo 5 dias consecutivos com viagens, sendo o 6º dia consecutivo obrigatoriamente bloqueado.`,
                consecutiveDaysCount: totalConsecutive,
                details: {
                    consecutiveDaysCount: totalConsecutive,
                    consecutiveDates: [seqStart, seqEnd]
                }
            };
        }
    }

    return { isValid: true };
};
