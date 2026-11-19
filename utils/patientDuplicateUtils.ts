/**
 * Utilitários de Normalização e Detecção de Duplicidade de Pacientes
 * Garante consistência exata entre regras de frontend e banco de dados PostgreSQL.
 */

import { ConsultaPaciente } from '../types';
import { normalizeCpf, formatCpf, formatBirthDateBr } from './cpfUtils';

/**
 * Normaliza o nome do paciente para comparação e prevenção de duplicidades:
 * - Converte para minúsculas
 * - Remove todos os acentos e diacríticos (á->a, ç->c, etc.)
 * - Converte múltiplos espaços intermediários em um único espaço
 * - Remove espaços no início e no final (trim)
 * 
 * Exemplo: " JOÃO   DA  SILVA " -> "joao da silva"
 *          "Joao da Silva  "     -> "joao da silva"
 */
export const normalizePatientName = (name?: string | null): string => {
  if (!name) return '';
  return String(name)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
};

export type PatientConflictType = 'cpf' | 'name_and_birth_date';

export interface PatientDuplicateCheckResult {
  hasDuplicate: boolean;
  conflictType: PatientConflictType | null;
  existingPatient: ConsultaPaciente | null;
  message?: string;
}

/**
 * Normaliza a data de nascimento no formato YYYY-MM-DD.
 */
export const normalizeBirthDateIso = (dateStr?: string | null): string => {
  if (!dateStr) return '';
  const trimmed = String(dateStr).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed.slice(0, 10);
  }
  // Se for DD/MM/AAAA
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
    const [d, m, y] = trimmed.split('/');
    return `${y}-${m}-${d}`;
  }
  return trimmed;
};

/**
 * Compara dois pacientes na memória para verificar se colidem por:
 * 1. CPF (11 dígitos normalizados)
 * 2. Nome Normalizado + Data de Nascimento
 */
export const checkMemoryPatientDuplicate = (
  candidate: { name: string; cpf?: string | null; birth_date?: string | null; id?: string | null },
  existingList: ConsultaPaciente[],
  excludeId?: string | null
): PatientDuplicateCheckResult => {
  const candidateCpf = normalizeCpf(candidate.cpf);
  const candidateNameNorm = normalizePatientName(candidate.name);
  const candidateBirth = normalizeBirthDateIso(candidate.birth_date);
  const targetExcludeId = excludeId || candidate.id;

  for (const p of existingList) {
    if (targetExcludeId && p.id === targetExcludeId) {
      continue;
    }

    const pCpf = normalizeCpf(p.cpf);
    // 1. Verificação independente de CPF
    if (candidateCpf.length === 11 && pCpf.length === 11 && candidateCpf === pCpf) {
      return {
        hasDuplicate: true,
        conflictType: 'cpf',
        existingPatient: p,
        message: `Já existe um paciente cadastrado com este CPF (${formatCpf(pCpf)}) na base municipal.`
      };
    }

    // 2. Verificação independente de Nome Completo + Data de Nascimento
    const pNameNorm = normalizePatientName(p.name);
    const pBirth = normalizeBirthDateIso(p.birth_date);

    if (candidateNameNorm && pNameNorm && candidateBirth && pBirth) {
      if (candidateNameNorm === pNameNorm && candidateBirth === pBirth) {
        return {
          hasDuplicate: true,
          conflictType: 'name_and_birth_date',
          existingPatient: p,
          message: `Já existe um paciente cadastrado com o mesmo Nome Completo e Data de Nascimento (${formatBirthDateBr(pBirth)}) na base integrada.`
        };
      }
    }
  }

  return {
    hasDuplicate: false,
    conflictType: null,
    existingPatient: null
  };
};
