// Utilitários para normalização, máscara e validação matemática de CPF e datas de pacientes

/**
 * Remove toda pontuação/caracteres não numéricos do CPF e limita a 11 dígitos.
 */
export const normalizeCpf = (value?: string | null): string => {
  if (!value) return '';
  return String(value).replace(/\D/g, '').slice(0, 11);
};

/**
 * Aplica máscara progressiva de CPF no padrão 000.000.000-00.
 */
export const formatCpf = (value?: string | null): string => {
  const digits = normalizeCpf(value);
  if (digits.length > 9) {
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
  }
  if (digits.length > 6) {
    return digits.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
  }
  if (digits.length > 3) {
    return digits.replace(/(\d{3})(\d{1,3})/, '$1.$2');
  }
  return digits;
};

/**
 * Valida o CPF considerando exatamente 11 dígitos, rejeitando sequências repetidas
 * e conferindo os dois dígitos verificadores oficiais.
 */
export const isValidCpf = (value?: string | null): boolean => {
  const digits = normalizeCpf(value);
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;

  // 1º dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += Number(digits[i]) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== Number(digits[9])) return false;

  // 2º dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += Number(digits[i]) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== Number(digits[10])) return false;

  return true;
};

/**
 * Formata data YYYY-MM-DD (ou ISO) para DD/MM/AAAA sem deslocamento de fuso horário.
 */
export const formatBirthDateBr = (dateStr?: string | null): string => {
  if (!dateStr) return 'Não informada';
  const cleanPart = String(dateStr).split('T')[0].trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(cleanPart);
  if (!match) return dateStr;
  return `${match[3]}/${match[2]}/${match[1]}`;
};

/**
 * Retorna ano, mês (0-11) e dia atuais no fuso horário oficial de Brasília (ou da data de referência).
 */
const getReferenceYmd = (referenceDate?: Date): { year: number; monthIndex: number; day: number } => {
  const ref = referenceDate || new Date();
  if (!referenceDate) {
    try {
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      const parts = formatter.formatToParts(ref);
      const y = Number(parts.find(p => p.type === 'year')?.value);
      const m = Number(parts.find(p => p.type === 'month')?.value);
      const d = Number(parts.find(p => p.type === 'day')?.value);
      if (y && m && d) {
        return { year: y, monthIndex: m - 1, day: d };
      }
    } catch {
      // Fallback para data local se Intl com timeZone não estiver disponível
    }
  }
  return {
    year: ref.getFullYear(),
    monthIndex: ref.getMonth(),
    day: ref.getDate()
  };
};

/**
 * Calcula idade completa em anos na data atual (ou de referência), considerando dia, mês e ano
 * a partir de data YYYY-MM-DD (com ou sem horário ISO) ou DD/MM/AAAA, sem mutar o dado original.
 */
export const calculateAgeYears = (dateStr?: string | null, referenceDate?: Date): number | null => {
  if (!dateStr) return null;
  const cleanPart = String(dateStr).split('T')[0].trim();

  let birthYear: number;
  let birthMonth: number;
  let birthDay: number;

  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(cleanPart);
  const brMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(cleanPart);

  if (isoMatch) {
    birthYear = Number(isoMatch[1]);
    birthMonth = Number(isoMatch[2]) - 1;
    birthDay = Number(isoMatch[3]);
  } else if (brMatch) {
    birthDay = Number(brMatch[1]);
    birthMonth = Number(brMatch[2]) - 1;
    birthYear = Number(brMatch[3]);
  } else {
    return null;
  }

  if (birthMonth < 0 || birthMonth > 11 || birthDay < 1 || birthDay > 31 || birthYear < 1850) {
    return null;
  }

  // Valida data existente no calendário (ex.: rejeita 31/02)
  const probe = new Date(Date.UTC(birthYear, birthMonth, birthDay));
  if (
    probe.getUTCFullYear() !== birthYear ||
    probe.getUTCMonth() !== birthMonth ||
    probe.getUTCDate() !== birthDay
  ) {
    return null;
  }

  const today = getReferenceYmd(referenceDate);
  let age = today.year - birthYear;
  const mDiff = today.monthIndex - birthMonth;
  if (mDiff < 0 || (mDiff === 0 && today.day < birthDay)) {
    age--;
  }
  return age >= 0 ? age : null;
};

/**
 * Remove acentuação, normaliza espaços e converte texto para minúsculas.
 */
export const removeAccents = (value?: string | null): string => {
  if (!value) return '';
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
};

/**
 * Remove caracteres não numéricos do Cartão Nacional de Saúde (CNS) e limita a 15 dígitos.
 */
export const normalizeCns = (value?: string | null): string => {
  if (!value) return '';
  return String(value).replace(/\D/g, '').slice(0, 15);
};

/**
 * Valida o dígito verificador oficial do Cartão Nacional de Saúde (CNS - 15 dígitos).
 */
export const isValidCns = (value?: string | null): boolean => {
  const digits = normalizeCns(value);
  if (digits.length !== 15) return false;
  if (/^0{15}$/.test(digits)) return false;

  const first = digits[0];
  if (first === '1' || first === '2') {
    const pis = digits.slice(0, 11);
    let sum = 0;
    for (let i = 0; i < 11; i++) {
      sum += Number(pis[i]) * (15 - i);
    }
    let resto = sum % 11;
    let dv = 11 - resto;
    if (dv === 11) dv = 0;
    let expected = '';
    if (dv === 10) {
      const sumAdj = sum + 2;
      const restoAdj = sumAdj % 11;
      let dvAdj = 11 - restoAdj;
      if (dvAdj === 11) dvAdj = 0;
      expected = `${pis}001${dvAdj}`;
    } else {
      expected = `${pis}000${dv}`;
    }
    return digits === expected;
  }

  if (first === '7' || first === '8' || first === '9') {
    let sum = 0;
    for (let i = 0; i < 15; i++) {
      sum += Number(digits[i]) * (15 - i);
    }
    return sum % 11 === 0;
  }

  return false;
};

/**
 * Mascara parcialmente o CPF para exibição segura em listagens (***.456.789-**).
 */
export const maskCpfPartial = (cpf?: string | null): string => {
  const digits = normalizeCpf(cpf);
  if (digits.length === 11) {
    return `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`;
  }
  return cpf ? String(cpf) : 'Não informado';
};

/**
 * Mascara parcialmente o Cartão SUS (CNS) para exibição segura (700••••••••0001).
 */
export const maskCnsPartial = (cns?: string | null): string => {
  const digits = normalizeCns(cns);
  if (digits.length === 15) {
    return `${digits.slice(0, 3)}••••••••${digits.slice(11)}`;
  }
  if (digits.length >= 8) {
    return `${digits.slice(0, 3)}••••${digits.slice(-4)}`;
  }
  return cns ? String(cns) : '';
};

export type CriterioPesquisaPacienteDetectado = 'cpf' | 'cns' | 'texto';

/**
 * Identifica automaticamente se o termo digitado corresponde a CPF (11 dígitos),
 * Cartão SUS/CNS (15 dígitos) ou pesquisa textual por Nome / Apelido.
 */
export const detectarCriterioPesquisaPaciente = (
  rawTerm?: string | null
): { criterion: CriterioPesquisaPacienteDetectado; digits: string; normalizedText: string } => {
  const raw = String(rawTerm || '').trim();
  const digits = raw.replace(/\D/g, '');
  const hasLetters = /[a-zA-ZÀ-ÿ]/.test(raw);
  const onlyNumericPunctuation = /^[\d.\-\s/]+$/.test(raw);

  if (!hasLetters && onlyNumericPunctuation) {
    if (digits.length === 11) {
      return { criterion: 'cpf', digits, normalizedText: removeAccents(raw) };
    }
    if (digits.length === 15) {
      return { criterion: 'cns', digits, normalizedText: removeAccents(raw) };
    }
  }

  return {
    criterion: 'texto',
    digits,
    normalizedText: removeAccents(raw)
  };
};

