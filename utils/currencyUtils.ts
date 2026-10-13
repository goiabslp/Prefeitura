/**
 * Utilitários monetários e de conversão de valores para extenso em Português do Brasil (BRL).
 */

export const formatarMoedaBRL = (valor: number | string | undefined | null): string => {
  if (valor === undefined || valor === null || valor === '') return 'R$ 0,00';
  const num = typeof valor === 'string' 
    ? parseFloat(valor.replace(/[^\d,-]/g, '').replace(',', '.')) 
    : valor;
  
  if (isNaN(num)) return 'R$ 0,00';
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

export const parseMoedaBRL = (texto: string): number => {
  if (!texto) return 0;
  // Remove tudo que não for dígito, vírgula, ponto ou sinal negativo
  const limpo = texto.replace(/[^\d,-]/g, '').replace(',', '.');
  const num = parseFloat(limpo);
  return isNaN(num) ? 0 : Math.round(num * 100) / 100;
};

export const somarDespesas = (despesas: { valor: number | string }[]): number => {
  if (!Array.isArray(despesas)) return 0;
  const totalCentavos = despesas.reduce((acc, d) => {
    const val = typeof d.valor === 'number' ? d.valor : parseMoedaBRL(String(d.valor || ''));
    if (isNaN(val) || val <= 0) return acc;
    return acc + Math.round(val * 100);
  }, 0);
  return totalCentavos / 100;
};

const UNIDADES = [
  '', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove',
  'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'
];

const DEZENAS = [
  '', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'
];

const CENTENAS = [
  '', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'
];

function converterCentena(n: number): string {
  if (n === 0) return '';
  if (n === 100) return 'cem';
  
  const partes: string[] = [];
  const c = Math.floor(n / 100);
  const restoC = n % 100;
  
  if (c > 0) partes.push(CENTENAS[c]);
  
  if (restoC > 0) {
    if (restoC < 20) {
      partes.push(UNIDADES[restoC]);
    } else {
      const d = Math.floor(restoC / 10);
      const u = restoC % 10;
      partes.push(DEZENAS[d]);
      if (u > 0) partes.push(UNIDADES[u]);
    }
  }
  
  return partes.join(' e ');
}

/**
 * Converte um valor numérico para sua representação textual por extenso em Reais e Centavos.
 * Exemplo: 89.40 -> "oitenta e nove reais e quarenta centavos"
 */
export const numeroParaMoedaPorExtenso = (valorInput: number | string): string => {
  const valor = typeof valorInput === 'string' ? parseMoedaBRL(valorInput) : valorInput;
  if (!valor || isNaN(valor) || valor <= 0) return 'zero real';

  const inteiro = Math.floor(valor);
  const centavos = Math.round((valor - inteiro) * 100);

  const partesTexto: string[] = [];

  if (inteiro > 0) {
    // Milhões
    const milhoes = Math.floor(inteiro / 1000000);
    const restoMilhoes = inteiro % 1000000;
    
    // Milhares
    const milhares = Math.floor(restoMilhoes / 1000);
    const unidades = restoMilhoes % 1000;

    if (milhoes > 0) {
      const textoMilhoes = converterCentena(milhoes);
      partesTexto.push(milhoes === 1 ? 'um milhão' : `${textoMilhoes} milhões`);
    }

    if (milhares > 0) {
      if (milhares === 1) {
        partesTexto.push('mil');
      } else {
        partesTexto.push(`${converterCentena(milhares)} mil`);
      }
    }

    if (unidades > 0) {
      partesTexto.push(converterCentena(unidades));
    }

    const textoReais = partesTexto.join(' e ');
    const labelReal = inteiro === 1 ? 'real' : 'reais';
    partesTexto.length = 0;
    partesTexto.push(`${textoReais} ${labelReal}`);
  }

  if (centavos > 0) {
    const textoCentavos = converterCentena(centavos);
    const labelCentavo = centavos === 1 ? 'centavo' : 'centavos';
    if (partesTexto.length > 0) {
      partesTexto.push(`e ${textoCentavos} ${labelCentavo}`);
    } else {
      partesTexto.push(`${textoCentavos} ${labelCentavo}`);
    }
  }

  return partesTexto.join(' ');
};
