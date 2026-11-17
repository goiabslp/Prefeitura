// =========================================================================
// REGRAS DE NEGÓCIO — LISTA LIVE DE MEDICAMENTOS (FARMÁCIA POPULAR)
// =========================================================================

import type { FarmaciaMedicamento } from '../types';

export interface MedicamentoListaLiveItem {
  key: string;
  nome: string;
  apresentacao: string;
  dosagem: string;
  tipo: string;
  unidade: string;
  categoria: string;
  estoque: number;
  lotesValidosCount: number;
}

/**
 * Normaliza texto para comparação e pesquisa (sem acentos, minúsculo e espaços padronizados).
 */
export const normalizeListaLiveText = (text?: string | null): string => {
  if (!text) return '';
  return String(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Retorna a data atual no formato YYYY-MM-DD utilizando o fuso horário oficial de Brasília (America/Sao_Paulo).
 */
export const getHojeBrasilFarmaciaISO = (customDate?: Date): string => {
  const d = customDate || new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(d);
};

/**
 * Verifica se um registro/lote de medicamento está realmente disponível para dispensação na Lista Live:
 * - Quantidade estritamente maior que zero (rejeita 0, negativos e NaN).
 * - Não pode estar vencido (compara validade YYYY-MM-DD com a data atual em America/Sao_Paulo).
 * - Não pode estar bloqueado, inativo ou indisponível.
 * - Deve possuir nome válido.
 */
export const isLoteDisponivelListaLive = (
  med: FarmaciaMedicamento,
  hojeBrasilISO?: string
): boolean => {
  if (!med || typeof med !== 'object') return false;

  const nome = (med.nome || '').trim();
  if (!nome) return false;

  // Saldo numérico deve ser estritamente maior que zero
  const qtd = Number(med.quantidade);
  if (!Number.isFinite(qtd) || qtd <= 0) return false;

  // Verificar flags opcionais de bloqueio/inatividade que possam existir no banco
  const raw = med as any;
  if (raw.bloqueado === true || raw.ativo === false || raw.disponivel === false || raw.is_deleted === true) {
    return false;
  }
  const statusStr = normalizeListaLiveText(raw.status);
  if (
    statusStr === 'bloqueado' ||
    statusStr === 'inativo' ||
    statusStr === 'indisponivel' ||
    statusStr === 'vencido' ||
    statusStr === 'excluido' ||
    statusStr === 'descartado'
  ) {
    return false;
  }

  // Verificar validade (não contabilizar lotes vencidos)
  const validadeRaw = (med.validade || '').trim();
  if (validadeRaw) {
    const validadeDate = validadeRaw.includes('T') ? validadeRaw.split('T')[0].trim() : validadeRaw;
    if (/^\d{4}-\d{2}-\d{2}$/.test(validadeDate)) {
      const hoje = hojeBrasilISO || getHojeBrasilFarmaciaISO();
      // Se a validade for anterior à data atual em Brasília, o lote está vencido
      if (validadeDate < hoje) {
        return false;
      }
    }
  }

  return true;
};

/**
 * Formata a apresentação do medicamento exatamente conforme cadastrada no estoque.
 * Exemplos: "500 mg — Cápsula", "50 mg — Comprimido", "20 mg/mL — Suspensão Oral".
 */
export const formatApresentacaoListaLive = (med: Pick<FarmaciaMedicamento, 'dosagem' | 'tipo' | 'unidade'>): string => {
  const dosagem = (med.dosagem || '').trim();
  const tipo = (med.tipo || '').trim();
  const unidade = (med.unidade || '').trim();

  if (dosagem && tipo) {
    const normDosagem = normalizeListaLiveText(dosagem);
    const normTipo = normalizeListaLiveText(tipo);
    if (normDosagem === normTipo || normDosagem.includes(normTipo)) {
      return dosagem;
    }
    return `${dosagem} — ${tipo}`;
  }

  if (dosagem) return dosagem;
  if (tipo) return tipo;
  if (unidade) return unidade;

  return 'Não informada';
};

/**
 * Consolida os lotes reais do estoque da Farmácia Popular para exibição na Lista Live:
 * - Respeita categorias CBAF, CESAF e CEAF.
 * - Descarta lotes zerados, negativos, vencidos, bloqueados ou indisponíveis.
 * - Consolida saldos de lotes diferentes que possuem o mesmo medicamento e mesma apresentação.
 * - Mantém registros separados para o mesmo medicamento com apresentações diferentes.
 * - Filtra estritamente itens com saldo final > 0.
 * - Ordena alfabeticamente (A-Z) pelo nome do medicamento e, em empate, pela apresentação.
 */
export const consolidarMedicamentosListaLive = (
  medicamentos: FarmaciaMedicamento[],
  hojeBrasilISO?: string
): MedicamentoListaLiveItem[] => {
  if (!Array.isArray(medicamentos) || medicamentos.length === 0) return [];

  const hoje = hojeBrasilISO || getHojeBrasilFarmaciaISO();
  const grupos = new Map<string, MedicamentoListaLiveItem>();

  medicamentos.forEach((med) => {
    if (!isLoteDisponivelListaLive(med, hoje)) return;

    const nomeLimpo = (med.nome || '').trim();
    const dosagemLimpa = (med.dosagem || '').trim();
    const tipoLimpo = (med.tipo || '').trim();
    const apresentacao = formatApresentacaoListaLive(med);

    // Chave de consolidação por medicamento + apresentação (independe de lote para não duplicar)
    const key = `${normalizeListaLiveText(nomeLimpo)}__${normalizeListaLiveText(apresentacao)}`;

    const existente = grupos.get(key);
    const qtd = Number(med.quantidade) || 0;

    if (!existente) {
      grupos.set(key, {
        key,
        nome: nomeLimpo,
        apresentacao,
        dosagem: dosagemLimpa,
        tipo: tipoLimpo,
        unidade: (med.unidade || 'un').trim(),
        categoria: med.categoria || 'CBAF',
        estoque: qtd,
        lotesValidosCount: 1
      });
    } else {
      existente.estoque += qtd;
      existente.lotesValidosCount += 1;
    }
  });

  // Garante estoque > 0 e ordenação alfabética estrita A-Z (pt-BR)
  return Array.from(grupos.values())
    .filter((item) => item.estoque > 0)
    .sort((a, b) => {
      const compNome = a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' });
      if (compNome !== 0) return compNome;
      return a.apresentacao.localeCompare(b.apresentacao, 'pt-BR', { sensitivity: 'base' });
    });
};

/**
 * Filtra os itens consolidados da Lista Live por pesquisa dinâmica em nome ou apresentação,
 * ignorando acentos e maiúsculas/minúsculas, preservando a ordem alfabética (A-Z) e disponibilidade.
 */
export const filtrarListaLive = (
  itens: MedicamentoListaLiveItem[],
  searchTerm: string
): MedicamentoListaLiveItem[] => {
  const termoNorm = normalizeListaLiveText(searchTerm);
  if (!termoNorm) {
    return itens.filter((item) => item.estoque > 0);
  }

  // Suporta múltiplos termos digitados (ex.: "amox 500" busca em nome + apresentação combinados)
  const tokens = termoNorm.split(' ').filter(Boolean);

  return itens.filter((item) => {
    if (item.estoque <= 0) return false;
    const textoCombinado = `${normalizeListaLiveText(item.nome)} ${normalizeListaLiveText(item.apresentacao)}`;
    return tokens.every((token) => textoCombinado.includes(token));
  });
};
