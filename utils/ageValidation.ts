// =========================================================================
// UTILITÁRIO DE VALIDAÇÃO DE IDADE E ACOMPANHANTE OBRIGATÓRIO NA VIAGEM
// =========================================================================

/**
 * Converte data em vários formatos (YYYY-MM-DD, DD/MM/YYYY, ISO) para objeto Date
 */
export const parseDateSafe = (dateStr?: string | null): Date | null => {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const clean = dateStr.trim();
  if (!clean) return null;

  // Formato DD/MM/YYYY
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(clean)) {
    const [d, m, y] = clean.split('/').map(Number);
    const date = new Date(y, m - 1, d, 12, 0, 0);
    return isNaN(date.getTime()) ? null : date;
  }

  // Formato YYYY-MM-DD ou ISO
  if (clean.includes('-')) {
    const rawDatePart = clean.split('T')[0];
    const parts = rawDatePart.split('-').map(Number);
    if (parts.length === 3) {
      const [y, m, d] = parts;
      const date = new Date(y, m - 1, d, 12, 0, 0);
      return isNaN(date.getTime()) ? null : date;
    }
  }

  const d = new Date(clean);
  return isNaN(d.getTime()) ? null : d;
};

/**
 * Calcula a idade de uma pessoa considerando a DATA PREVISTA DA VIAGEM
 * (Regra obrigatória do sistema: a idade deve ser baseada na data da viagem, e não hoje)
 */
export const calcularIdadeNaDataViagem = (
  birthDateInput?: string | null,
  tripDateInput?: string | null | Date
): number | null => {
  const birthDate = parseDateSafe(birthDateInput);
  if (!birthDate) return null;

  let tripDate: Date;
  if (tripDateInput instanceof Date) {
    tripDate = tripDateInput;
  } else if (typeof tripDateInput === 'string') {
    tripDate = parseDateSafe(tripDateInput) || new Date();
  } else {
    tripDate = new Date();
  }

  let age = tripDate.getFullYear() - birthDate.getFullYear();
  const m = tripDate.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && tripDate.getDate() < birthDate.getDate())) {
    age--;
  }

  return Math.max(0, age);
};

/**
 * Verifica se o paciente terá menos de 18 anos na data da viagem
 */
export const isMenorDeIdadeNaViagem = (
  birthDateInput?: string | null,
  tripDateInput?: string | null | Date
): boolean => {
  const idade = calcularIdadeNaDataViagem(birthDateInput, tripDateInput);
  if (idade === null) return false;
  return idade < 18;
};

/**
 * Formata data de nascimento para exibição amigável: "DD/MM/AAAA (XX anos)"
 */
export const formatBirthDateComIdade = (
  birthDateInput?: string | null,
  tripDateInput?: string | null | Date
): string => {
  const birthDate = parseDateSafe(birthDateInput);
  if (!birthDate) return 'Data não informada';

  const dia = String(birthDate.getDate()).padStart(2, '0');
  const mes = String(birthDate.getMonth() + 1).padStart(2, '0');
  const ano = birthDate.getFullYear();
  const dataFormatada = `${dia}/${mes}/${ano}`;

  const idade = calcularIdadeNaDataViagem(birthDateInput, tripDateInput);
  if (idade !== null) {
    return `${dataFormatada} (${idade} ${idade === 1 ? 'ano' : 'anos'})`;
  }

  return dataFormatada;
};
