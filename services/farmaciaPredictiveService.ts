// ==============================================================================
// SERVIÇO DE INTELIGÊNCIA PREDITIVA DE ESTOQUE & DATA ESTIMADA DE REPOSIÇÃO
// Farmácia Popular Municipal / SUS
// ==============================================================================

import { FarmaciaMedicamento, FarmaciaMovimentacao } from '../types';
import { getFarmaciaConfig, saveFarmaciaConfig } from './farmaciaService';

export type SituacaoOperacionalReposicao = 
    | 'NO_PRAZO'
    | 'PLANEJAR_COMPRA'
    | 'INICIAR_REPOSICAO'
    | 'RISCO_DESABASTECIMENTO'
    | 'DADOS_INSUFICIENTES';

export interface IndicadorReposicaoIA {
    // Médias de consumo em janelas históricas
    consumo7dTotal: number;
    consumo7dDiario: number;
    consumo30dTotal: number;
    consumo30dDiario: number;
    consumo90dTotal: number;
    consumo90dDiario: number;
    
    // Consumo diário consolidado projetado
    consumoDiarioProjetado: number;
    demandaMensalProjetada: number;

    // Estoque Real
    estoqueTotal: number;
    estoqueVencido: number;
    estoqueUtilizavel: number;
    diasCobertura: number | null; // null se consumo = 0 ou dados insuficientes

    // Parâmetros Administrativos
    prazoReposicaoDias: number; // Lead time do processo de compra e entrega (ex: 30 dias)
    margemSegurancaDias: number; // Estoque de segurança preventiva (ex: 15 dias)
    
    // Datas e Contagens Preditivas
    dataReferencia: Date;
    dataEstimadaEsgotamento: Date | null;
    dataEstimadaEsgotamentoStr: string; // "DD/MM/AAAA" ou "Dados insuficientes"
    dataRecomendadaCompra: Date | null;
    dataRecomendadaCompraStr: string; // "DD/MM/AAAA" ou "Imediata"
    diasAteCompraRecomendada: number | null; // contagem regressiva em dias para iniciar compra

    // Quantidade sugerida de aquisição
    quantidadeSugerida: number;

    // Situação Operacional Padronizada
    situacaoOperacional: SituacaoOperacionalReposicao;
    situacaoOperacionalLabel: string; // "NO PRAZO", "PLANEJAR COMPRA", "INICIAR REPOSIÇÃO", "RISCO DE DESABASTECIMENTO", "DADOS INSUFICIENTES"
    situacaoColorClass: {
        badge: string;
        text: string;
        border: string;
        bg: string;
    };

    // Transparência e Justificativa Auditável
    explicacaoObjetiva: string;
    parametrosUtilizados: {
        formulaCobertura: string;
        formulaDataCompra: string;
        leadTimeUtilizado: number;
        margemSegurancaUtilizada: number;
        confiabilidadeHistorico: 'ALTA' | 'MEDIA' | 'INSUFICIENTE';
    };
}

export interface ReposicaoConfigParams {
    leadTimeDias: number;
    margemSegurancaDias: number;
}

const DEFAULT_LEAD_TIME_DIAS = 30;
const DEFAULT_MARGEM_SEGURANCA_DIAS = 15;

/**
 * Obtém os parâmetros configurados de prazo de reposição e margem de segurança.
 */
export async function getReposicaoConfig(): Promise<ReposicaoConfigParams> {
    try {
        const stored = await getFarmaciaConfig('farmacia_reposicao_params');
        if (stored && typeof stored === 'object') {
            return {
                leadTimeDias: Number(stored.leadTimeDias) || DEFAULT_LEAD_TIME_DIAS,
                margemSegurancaDias: Number(stored.margemSegurancaDias) || DEFAULT_MARGEM_SEGURANCA_DIAS
            };
        }
    } catch (e) {
        console.warn('Aviso ao carregar parâmetros de reposição:', e);
    }

    return {
        leadTimeDias: DEFAULT_LEAD_TIME_DIAS,
        margemSegurancaDias: DEFAULT_MARGEM_SEGURANCA_DIAS
    };
}

/**
 * Salva novos parâmetros de prazo de reposição e margem de segurança.
 */
export async function saveReposicaoConfig(params: ReposicaoConfigParams): Promise<boolean> {
    try {
        const ok = await saveFarmaciaConfig('farmacia_reposicao_params', {
            leadTimeDias: Math.max(1, params.leadTimeDias),
            margemSegurancaDias: Math.max(0, params.margemSegurancaDias),
            updated_at: new Date().toISOString()
        });
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('farmacia-config-changed'));
        }
        return ok;
    } catch (e) {
        console.error('Erro ao salvar parâmetros de reposição:', e);
        return false;
    }
}

/**
 * Formata data no formato brasileiro DD/MM/AAAA.
 */
function formatDateBR(date: Date | null): string {
    if (!date || isNaN(date.getTime())) return 'Dados insuficientes';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

/**
 * Calcula os indicadores completos de Data Estimada de Necessidade de Reposição por medicamento.
 */
export function calculateMedicamentoReposicaoIA({
    medNome,
    estoqueTotal,
    lotes = [],
    movimentacoesSaida = [],
    now = new Date(),
    leadTimeDias = DEFAULT_LEAD_TIME_DIAS,
    margemSegurancaDias = DEFAULT_MARGEM_SEGURANCA_DIAS,
    limiteMinimo = 10,
    unidade = 'un'
}: {
    medNome: string;
    estoqueTotal: number;
    lotes?: FarmaciaMedicamento[];
    movimentacoesSaida?: FarmaciaMovimentacao[];
    now?: Date;
    leadTimeDias?: number;
    margemSegurancaDias?: number;
    limiteMinimo?: number;
    unidade?: string;
}): IndicadorReposicaoIA {
    // 1. Estoque Utilizável (dedução rigorosa de lotes com data de validade expirada)
    let estoqueVencido = 0;
    lotes.forEach(l => {
        if (l.validade) {
            const valDate = new Date(l.validade);
            if (!isNaN(valDate.getTime()) && valDate < now) {
                estoqueVencido += Math.max(0, l.quantidade || 0);
            }
        }
    });

    const estoqueUtilizavel = Math.max(0, estoqueTotal - estoqueVencido);

    // 2. Análise de saídas históricas nas janelas de 7, 30 e 90 dias
    const msDay = 1000 * 60 * 60 * 24;
    const date7d = new Date(now.getTime() - 7 * msDay);
    const date30d = new Date(now.getTime() - 30 * msDay);
    const date90d = new Date(now.getTime() - 90 * msDay);

    let consumo7dTotal = 0;
    let consumo30dTotal = 0;
    let consumo90dTotal = 0;

    movimentacoesSaida.forEach(m => {
        if (!m.data) return;
        const d = new Date(m.data);
        if (isNaN(d.getTime())) return;
        const qtd = Math.max(0, m.quantidade || 0);

        if (d >= date7d) consumo7dTotal += qtd;
        if (d >= date30d) consumo30dTotal += qtd;
        if (d >= date90d) consumo90dTotal += qtd;
    });

    const consumo7dDiario = consumo7dTotal / 7;
    const consumo30dDiario = consumo30dTotal / 30;
    const consumo90dDiario = consumo90dTotal / 90;

    // 3. Projeção de Consumo Diário Consolidado
    let consumoDiarioProjetado = 0;
    let confiabilidade: 'ALTA' | 'MEDIA' | 'INSUFICIENTE' = 'INSUFICIENTE';

    if (consumo90dTotal > 0 && consumo30dTotal > 0) {
        // Amplo histórico trimestral: ponderação de 50% no mês atual (30d), 30% na última semana (7d) e 20% no trimestre (90d)
        consumoDiarioProjetado = (consumo30dDiario * 0.5) + (consumo7dDiario * 0.3) + (consumo90dDiario * 0.2);
        confiabilidade = 'ALTA';
    } else if (consumo30dTotal > 0) {
        consumoDiarioProjetado = (consumo30dDiario * 0.7) + (consumo7dDiario * 0.3);
        confiabilidade = 'MEDIA';
    } else if (consumo7dTotal > 0) {
        consumoDiarioProjetado = consumo7dDiario;
        confiabilidade = 'MEDIA';
    } else {
        consumoDiarioProjetado = 0;
        confiabilidade = 'INSUFICIENTE';
    }

    const demandaMensalProjetada = Math.round(consumoDiarioProjetado * 30);

    // 4. Cobertura e Datas Preditivas
    let diasCobertura: number | null = null;
    let dataEstimadaEsgotamento: Date | null = null;
    let dataRecomendadaCompra: Date | null = null;
    let diasAteCompraRecomendada: number | null = null;

    let situacaoOperacional: SituacaoOperacionalReposicao = 'DADOS_INSUFICIENTES';
    let situacaoOperacionalLabel = 'DADOS INSUFICIENTES';
    let situacaoColorClass = {
        badge: 'bg-slate-100 text-slate-600 border-slate-200',
        text: 'text-slate-600',
        border: 'border-slate-200',
        bg: 'bg-slate-50'
    };

    let explicacaoObjetiva = '';

    if (consumoDiarioProjetado > 0 && estoqueUtilizavel > 0) {
        diasCobertura = Math.floor(estoqueUtilizavel / consumoDiarioProjetado);
        dataEstimadaEsgotamento = new Date(now.getTime() + diasCobertura * msDay);

        const diasAntecedenciaNecessarios = leadTimeDias + margemSegurancaDias;
        diasAteCompraRecomendada = diasCobertura - diasAntecedenciaNecessarios;

        if (diasAteCompraRecomendada > 0) {
            dataRecomendadaCompra = new Date(now.getTime() + diasAteCompraRecomendada * msDay);
        } else {
            // Se já atingiu ou ultrapassou a data recomendada, é recomendação imediata
            dataRecomendadaCompra = new Date(now.getTime());
        }

        // 5. Avaliação da Situação Operacional
        if (diasCobertura < leadTimeDias) {
            situacaoOperacional = 'RISCO_DESABASTECIMENTO';
            situacaoOperacionalLabel = 'RISCO DE DESABASTECIMENTO';
            situacaoColorClass = {
                badge: 'bg-rose-100 text-rose-800 border-rose-300 animate-pulse',
                text: 'text-rose-700',
                border: 'border-rose-300',
                bg: 'bg-rose-50/80'
            };
            explicacaoObjetiva = `Atenção Crítica: O estoque utilizável atual (${estoqueUtilizavel.toLocaleString('pt-BR')} ${unidade}) cobre apenas ${diasCobertura} dias de demanda. Este prazo é inferior ao prazo total de reposição (${leadTimeDias} dias). Há risco iminente de desabastecimento antes da entrega.`;
        } else if (diasAteCompraRecomendada <= 0) {
            situacaoOperacional = 'INICIAR_REPOSICAO';
            situacaoOperacionalLabel = 'INICIAR REPOSIÇÃO';
            situacaoColorClass = {
                badge: 'bg-purple-100 text-purple-900 border-purple-300 font-black',
                text: 'text-purple-800',
                border: 'border-purple-300',
                bg: 'bg-purple-50/80'
            };
            explicacaoObjetiva = `Chegou o momento recomendado para iniciar o processo de aquisição. O saldo de estoque atual cobre ${diasCobertura} dias de consumo, prazo suficiente para absorver os ${leadTimeDias} dias de tramitação/entrega e resguardar a margem de segurança de ${margemSegurancaDias} dias.`;
        } else if (diasAteCompraRecomendada <= 15) {
            situacaoOperacional = 'PLANEJAR_COMPRA';
            situacaoOperacionalLabel = 'PLANEJAR COMPRA';
            situacaoColorClass = {
                badge: 'bg-amber-100 text-amber-800 border-amber-300',
                text: 'text-amber-700',
                border: 'border-amber-300',
                bg: 'bg-amber-50/80'
            };
            explicacaoObjetiva = `Aproximação da data recomendada de aquisição. Faltam ${diasAteCompraRecomendada} dias para iniciar a compra formal. Recomenda-se preparar cotações ou termos de referência.`;
        } else {
            situacaoOperacional = 'NO_PRAZO';
            situacaoOperacionalLabel = 'NO PRAZO';
            situacaoColorClass = {
                badge: 'bg-emerald-100 text-emerald-800 border-emerald-300',
                text: 'text-emerald-700',
                border: 'border-emerald-300',
                bg: 'bg-emerald-50/80'
            };
            explicacaoObjetiva = `Estoque em situação confortável. O estoque utilizável cobre ${diasCobertura} dias de consumo projetado. O processo de compra só precisará ser iniciado em ${formatDateBR(dataRecomendadaCompra)} (daqui a ${diasAteCompraRecomendada} dias).`;
        }
    } else if (estoqueUtilizavel === 0 && consumoDiarioProjetado > 0) {
        diasCobertura = 0;
        dataEstimadaEsgotamento = new Date(now.getTime());
        dataRecomendadaCompra = new Date(now.getTime());
        diasAteCompraRecomendada = -leadTimeDias;
        situacaoOperacional = 'RISCO_DESABASTECIMENTO';
        situacaoOperacionalLabel = 'RISCO DE DESABASTECIMENTO';
        situacaoColorClass = {
            badge: 'bg-rose-100 text-rose-800 border-rose-300 animate-pulse',
            text: 'text-rose-700',
            border: 'border-rose-300',
            bg: 'bg-rose-50/80'
        };
        explicacaoObjetiva = `Estoque zerado no almoxarifado. Necessidade urgente de entrada ou remanejamento de medicamentos.`;
    } else {
        diasCobertura = null;
        dataEstimadaEsgotamento = null;
        dataRecomendadaCompra = null;
        diasAteCompraRecomendada = null;
        situacaoOperacional = 'DADOS_INSUFICIENTES';
        situacaoOperacionalLabel = 'DADOS INSUFICIENTES';
        situacaoColorClass = {
            badge: 'bg-slate-100 text-slate-500 border-slate-200',
            text: 'text-slate-500',
            border: 'border-slate-200',
            bg: 'bg-slate-50'
        };
        explicacaoObjetiva = `Não há saídas registradas nos últimos 90 dias para projetar o consumo diário com precisão. O sistema não apresenta estimativas artificiais sem histórico de dispensação.`;
    }

    // 6. Quantidade Sugerida de Compra (Cobrindo um ciclo de 30 dias + margem de segurança de 15 dias)
    let quantidadeSugerida = 0;
    if (consumoDiarioProjetado > 0) {
        const cicloDiasNecessarios = 30 + margemSegurancaDias;
        const estoqueAlvoIdeal = Math.ceil(consumoDiarioProjetado * cicloDiasNecessarios);
        quantidadeSugerida = Math.max(0, estoqueAlvoIdeal - estoqueUtilizavel);
    } else if (estoqueTotal <= limiteMinimo) {
        quantidadeSugerida = Math.max(0, limiteMinimo * 2 - estoqueTotal);
    }

    return {
        consumo7dTotal,
        consumo7dDiario: Number(consumo7dDiario.toFixed(2)),
        consumo30dTotal,
        consumo30dDiario: Number(consumo30dDiario.toFixed(2)),
        consumo90dTotal,
        consumo90dDiario: Number(consumo90dDiario.toFixed(2)),
        consumoDiarioProjetado: Number(consumoDiarioProjetado.toFixed(2)),
        demandaMensalProjetada,
        estoqueTotal,
        estoqueVencido,
        estoqueUtilizavel,
        diasCobertura,
        prazoReposicaoDias: leadTimeDias,
        margemSegurancaDias,
        dataReferencia: now,
        dataEstimadaEsgotamento,
        dataEstimadaEsgotamentoStr: formatDateBR(dataEstimadaEsgotamento),
        dataRecomendadaCompra,
        dataRecomendadaCompraStr: formatDateBR(dataRecomendadaCompra),
        diasAteCompraRecomendada,
        quantidadeSugerida,
        situacaoOperacional,
        situacaoOperacionalLabel,
        situacaoColorClass,
        explicacaoObjetiva,
        parametrosUtilizados: {
            formulaCobertura: 'Dias de Cobertura = Estoque Utilizável / Consumo Diário Projetado',
            formulaDataCompra: 'Data Compra = Data Hoje + (Dias Cobertura - [Prazo Reposição + Margem Segurança])',
            leadTimeUtilizado: leadTimeDias,
            margemSegurancaUtilizada: margemSegurancaDias,
            confiabilidadeHistorico: confiabilidade
        }
    };
}
