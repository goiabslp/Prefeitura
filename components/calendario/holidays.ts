import { CalendarEvent } from '../../services/calendarService';

/**
 * Funções focadas em calcular Feriados Nacionais e do Estado de Minas Gerais (MG)
 * para exibição em calendários de forma recorrente sem depender de banco de dados.
 */

// Cálculo da data de Páscoa (Algoritmo de Meeus/Jones/Butcher)
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
    const month = Math.floor((h + l - 7 * m + 114) / 31) - 1; // 0-based
    const day = ((h + l - 7 * m + 114) % 31) + 1;

    return new Date(year, month, day);
};

// Adiciona X dias a uma data
const addDays = (date: Date, days: number): Date => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
};

// Formata uma data para o padrão 'YYYY-MM-DD' gerado localmente 
const formatAsYYYYMMDD = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export const generateHolidaysForYear = (year: number): CalendarEvent[] => {
    const holidays: CalendarEvent[] = [];

    // Factory helper para montar os mocks como CalendarEvent perfeitos
    const createHoliday = (title: string, date: Date | string, customIdName: string): CalendarEvent => {
        let dateStr = typeof date === 'string' ? date : formatAsYYYYMMDD(date);
        return {
            id: `system-holiday-${customIdName}-${year}`, // IDs que começam com 'system-' bloquearão a ação de exclusão
            title,
            type: 'Feriado',
            start_date: dateStr,
            end_date: dateStr,
            is_all_day: true,
            description: `${title} - Feriado Oficial`,
            created_at: new Date().toISOString()
        };
    };

    // --- FERIADOS NACIONAIS FIXOS ---
    holidays.push(createHoliday('Confraternização Universal', `${year}-01-01`, 'confraternizacao'));
    holidays.push(createHoliday('Tiradentes', `${year}-04-21`, 'tiradentes'));
    holidays.push(createHoliday('Dia do Trabalho', `${year}-05-01`, 'trabalho'));
    holidays.push(createHoliday('Independência do Brasil', `${year}-09-07`, 'independencia'));
    holidays.push(createHoliday('Nossa Senhora Aparecida', `${year}-10-12`, 'aparecida'));
    holidays.push(createHoliday('Finados', `${year}-11-02`, 'finados'));
    holidays.push(createHoliday('Proclamação da República', `${year}-11-15`, 'republica'));
    holidays.push(createHoliday('Natal', `${year}-12-25`, 'natal'));

    // --- FERIADOS FIXOS ESTADUAIS (MINAS GERAIS) ---
    holidays.push(createHoliday('Data Magna de Minas Gerais', `${year}-04-21`, 'datamagna-mg')); // Coincide com Tiradentes mas é formal

    // --- FERIADOS MÓVEIS (Baseados na Páscoa) ---
    const easter = getEasterDate(year);

    // Sexta-feira Santa é 2 dias antes da Páscoa
    const goodFriday = addDays(easter, -2);
    holidays.push(createHoliday('Sexta-feira Santa', goodFriday, 'paixao'));

    // Carnaval é 47 e 46 dias antes da Páscoa (Segunda e Terça)
    const carnavalMonday = addDays(easter, -48); // Segunda
    const carnavalTuesday = addDays(easter, -47); // Terça
    holidays.push(createHoliday('Carnaval', carnavalMonday, 'carnaval-seg'));
    holidays.push(createHoliday('Carnaval', carnavalTuesday, 'carnaval-ter'));

    // Corpus Christi é 60 dias após a Páscoa
    const corpusChristi = addDays(easter, 60);
    holidays.push(createHoliday('Corpus Christi', corpusChristi, 'corpuschristi'));

    return holidays;
};
