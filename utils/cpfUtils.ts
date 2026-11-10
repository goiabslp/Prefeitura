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
 * Calcula idade em anos completos a partir da data de nascimento YYYY-MM-DD.
 */
export const calculateAgeYears = (dateStr?: string | null): number | null => {
  if (!dateStr) return null;
  const cleanPart = String(dateStr).split('T')[0].trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(cleanPart);
  if (!match) return null;

  const birthYear = Number(match[1]);
  const birthMonth = Number(match[2]) - 1;
  const birthDay = Number(match[3]);
  const today = new Date();

  let age = today.getFullYear() - birthYear;
  const mDiff = today.getMonth() - birthMonth;
  if (mDiff < 0 || (mDiff === 0 && today.getDate() < birthDay)) {
    age--;
  }
  return age >= 0 ? age : null;
};

