// ==============================================================================
// SERVIÇO DE PADRONIZAÇÃO E UNIFICAÇÃO INTELIGENTE DE PROCEDIMENTOS
// Especializado em Exames de ULTRASSOM (SUS / Regulação Municipal)
// ==============================================================================

import { ConsultaProcedimento, User } from '../types';
import { supabase } from './supabaseClient';
import { auditLogService } from './auditLogService';
import { updateProcedimento, getProcedimentos, getAgendamentos, getVagas } from './consultasService';

export interface StandardizeResult {
    originalName: string;
    standardizedName: string;
    isChanged: boolean;
    isUltrasound: boolean;
    isTerceirizado: boolean;
    corrections: string[];
}

export type AnalysisCategory = 
    | 'PADRONIZACAO_ORTOGRAFICA'
    | 'EQUIVALENTE_ADMINISTRATIVO'
    | 'DIFERENCA_CLINICA'
    | 'DUPLICIDADE_IDENTICA'
    | 'JA_PADRONIZADO';

export interface ProcedimentoAnalysisItem {
    procedimento: ConsultaProcedimento;
    standardizedName: string;
    isChanged: boolean;
    isUltrasound: boolean;
    isTerceirizado: boolean;
    category: AnalysisCategory;
    categoryLabel: string;
    corrections: string[];
    equivalentTo?: ConsultaProcedimento | null;
    clinicalDifferenceReason?: string;
    impactSummary?: {
        vagasCount: number;
        agendamentosCount: number;
        especialistasCount: number;
    };
}

/**
 * Normaliza e padroniza a nomenclatura de procedimentos de ULTRASSOM.
 * Aplica regras estritas gramaticais, ortográficas e concordância de gênero.
 */
export function standardizeProcedureName(rawName: string): StandardizeResult {
    if (!rawName || typeof rawName !== 'string') {
        return {
            originalName: rawName || '',
            standardizedName: rawName || '',
            isChanged: false,
            isUltrasound: false,
            isTerceirizado: false,
            corrections: []
        };
    }

    const original = rawName.trim();
    let name = original;
    const corrections: string[] = [];

    // 1. Identificar se é procedimento de Ultrassom
    const ultrasoundPrefixRegex = /^(ULTRA[\s-]?SONOGRAFIA|ULTRASSONOGRAFIA|ULTRASOM|ULTRASSOM)\b/i;
    const usgPrefixRegex = /^(USG|US)\b/i;

    const isUltrasound = ultrasoundPrefixRegex.test(name) || usgPrefixRegex.test(name);

    if (!isUltrasound) {
        return {
            originalName: original,
            standardizedName: original,
            isChanged: false,
            isUltrasound: false,
            isTerceirizado: false,
            corrections: []
        };
    }

    // Identificar prefixo anterior para auditoria de correção
    const matchPrefix = name.match(ultrasoundPrefixRegex) || name.match(usgPrefixRegex);
    if (matchPrefix && matchPrefix[0].toUpperCase() !== 'ULTRASSOM') {
        corrections.push(`Prefixo "${matchPrefix[0]}" padronizado para "ULTRASSOM"`);
    }

    // 2. Detectar e marcar modalidade Terceirizado (TERC, TERC., - TERC, etc.)
    let isTerceirizado = false;
    if (/\bTERC(\.|\b)/i.test(name) || /\bTERCEIRIZAD[OA]\b/i.test(name)) {
        isTerceirizado = true;
        corrections.push('Modalidade administrativa "TERC." padronizada para "— TERCEIRIZADO"');
        // Limpar marcadores de terceirizado e pontuações vizinhas
        name = name.replace(/[-–—/]?\s*\bTERC(\.|\b)\s*/gi, ' ');
        name = name.replace(/[-–—/]?\s*\bTERCEIRIZAD[OA]\b\s*/gi, ' ');
    }

    // 3. Substituir o prefixo por "ULTRASSOM"
    name = name.replace(ultrasoundPrefixRegex, 'ULTRASSOM');
    name = name.replace(usgPrefixRegex, 'ULTRASSOM');

    // 4. Correções gramaticais e ortográficas específicas
    if (/\bA\s+PAREDE\s+ABDOMINAL\b/i.test(name)) {
        name = name.replace(/\bA\s+PAREDE\s+ABDOMINAL\b/gi, 'DA PAREDE ABDOMINAL');
        corrections.push('Correção gramatical: "A PAREDE" -> "DA PAREDE"');
    }

    if (/\bULTRASSOM\s+ABDOMEN\s+SUPERIOR\b/i.test(name)) {
        name = name.replace(/\bULTRASSOM\s+ABDOMEN\s+SUPERIOR\b/gi, 'ULTRASSOM DE ABDÔMEN SUPERIOR');
        corrections.push('Ajuste de preposição: "DE ABDÔMEN SUPERIOR"');
    }

    // Erros ortográficos clássicos
    if (/\bABDOMEM\b/i.test(name) || /\bABDOMEN\b/i.test(name)) {
        name = name.replace(/\b(ABDOMEM|ABDOMEN)\b/gi, 'ABDÔMEN');
        corrections.push('Acentuação e grafia correta: "ABDÔMEN"');
    }

    if (/\bREGIAO\b/i.test(name)) {
        name = name.replace(/\bREGIAO\b/gi, 'REGIÃO');
        corrections.push('Acentuação gráfica: "REGIÃO"');
    }

    if (/\bMAMARIA\b/i.test(name)) {
        name = name.replace(/\bMAMARIA\b/gi, 'MAMÁRIA');
        corrections.push('Acentuação gráfica: "MAMÁRIA"');
    }

    if (/\bPROSTATA\b/i.test(name)) {
        name = name.replace(/\bPROSTATA\b/gi, 'PRÓSTATA');
        corrections.push('Acentuação gráfica: "PRÓSTATA"');
    }

    if (/\bTIREÓIDE\b/i.test(name)) {
        name = name.replace(/\bTIREÓIDE\b/gi, 'TIREOIDE');
        corrections.push('Novo Acordo Ortográfico: "TIREOIDE"');
    }

    if (/\bBIOPSIA\b/i.test(name)) {
        name = name.replace(/\bBIOPSIA\b/gi, 'BIÓPSIA');
        corrections.push('Acentuação gráfica: "BIÓPSIA"');
    }

    // Concordância masculina ao redor do exame de ULTRASSOM
    if (/\b(OBSTÉTRICA|OBSTETRICA)\b/i.test(name)) {
        name = name.replace(/\b(OBSTÉTRICA|OBSTETRICA)\b/gi, 'OBSTÉTRICO');
        corrections.push('Concordância de gênero: "OBSTÉTRICO"');
    }

    if (/\b(PÉLVICA|PELVICA)\b/i.test(name)) {
        name = name.replace(/\b(PÉLVICA|PELVICA)\b/gi, 'PÉLVICO');
        corrections.push('Concordância de gênero: "PÉLVICO"');
    }

    if (/\b(GINECOLÓGICA|GINECOLOGICA)\b/i.test(name)) {
        name = name.replace(/\b(GINECOLÓGICA|GINECOLOGICA)\b/gi, 'GINECOLÓGICO');
        corrections.push('Concordância de gênero: "(GINECOLÓGICO)"');
    }

    if (/\b(MORFOLÓGICA|MORFOLOGICA)\b/i.test(name)) {
        name = name.replace(/\b(MORFOLÓGICA|MORFOLOGICA)\b/gi, 'MORFOLÓGICO');
        corrections.push('Concordância de gênero: "MORFOLÓGICO"');
    }

    // 5. Ajustes finos de pontuação e espaçamentos
    name = name.replace(/\.+$/g, '').trim();
    name = name.replace(/\s*\/\s*/g, ' / ');
    name = name.replace(/\(\s+/g, '(');
    name = name.replace(/\s+\)/g, ')');
    name = name.replace(/\s+/g, ' ').trim();

    // 6. Formatar com sufixo padronizado de terceirização
    if (isTerceirizado) {
        name = `${name} — TERCEIRIZADO`;
    }

    name = name.toUpperCase().trim();
    const isChanged = name !== original;

    return {
        originalName: original,
        standardizedName: name,
        isChanged,
        isUltrasound: true,
        isTerceirizado,
        corrections
    };
}

/**
 * Extrai características clínicas anatômicas e técnicas do procedimento.
 */
export function extractClinicalFeatures(name: string) {
    const upper = (name || '').toUpperCase();
    const hasDoppler = upper.includes('DOPPLER');
    const hasBiopsia = upper.includes('BIÓPSIA') || upper.includes('BIOPSIA');
    const hasSedacao = upper.includes('COM SEDAÇÃO') || upper.includes('COM SEDACAO');
    const isSemSedacao = upper.includes('SEM SEDAÇÃO') || upper.includes('SEM SEDACAO');
    const isTerceirizado = upper.includes('TERCEIRIZADO') || upper.includes('TERC');

    // Base clínica limpa (sem terceirizado, sem pontuações)
    const clinicalBase = upper
        .replace(/\s*[-–—/]?\s*TERCEIRIZADO\b/gi, '')
        .replace(/\s*[-–—/]?\s*TERC\.?\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim();

    return {
        hasDoppler,
        hasBiopsia,
        hasSedacao,
        isSemSedacao,
        isTerceirizado,
        clinicalBase
    };
}

/**
 * Normaliza termos de pesquisa para reconhecimento inteligente de variações de Ultrassom.
 * Preserva ordem e prefixos.
 */
export function normalizeProcedureSearchQuery(input: string): string {
    if (!input) return '';
    let q = input.trim().toLowerCase();

    // Normaliza variações de Ultrassom para o termo padronizado
    q = q.replace(/^ultra[\s-]?sonografia\b/g, 'ultrassom');
    q = q.replace(/^ultrassonografia\b/g, 'ultrassom');
    q = q.replace(/^ultrasom\b/g, 'ultrassom');
    q = q.replace(/^usg\b/g, 'ultrassom');
    q = q.replace(/^us\b/g, 'ultrassom');

    // Variações comuns
    q = q.replace(/\babdomen\b/g, 'abdômen');
    q = q.replace(/\babdomem\b/g, 'abdômen');
    q = q.replace(/\btireoide\b/g, 'tireóide'); // flexibilidade em acentuação
    q = q.replace(/\bobstetrica\b/g, 'obstétrico');
    q = q.replace(/\bobstétrica\b/g, 'obstétrico');
    q = q.replace(/\bpelvica\b/g, 'pélvico');
    q = q.replace(/\bpélvica\b/g, 'pélvico');
    q = q.replace(/\bmorfologica\b/g, 'morfológico');
    q = q.replace(/\bmorfológica\b/g, 'morfológico');
    q = q.replace(/\bterc\.?\b/g, 'terceirizado');

    return q;
}

/**
 * Verifica se o nome ou código de um procedimento corresponde ao termo pesquisado,
 * aplicando reconhecimento fonético/lexical inteligente de Ultrassom sem fuzzy indiscriminado.
 */
export function procedureMatchesSearch(procLabelOrName: string, searchQuery: string, procCode?: string): boolean {
    if (!searchQuery || !searchQuery.trim()) return true;

    const rawTarget = (procLabelOrName || '').toLowerCase();
    const rawSearch = searchQuery.toLowerCase().trim();

    // Correspondência direta
    if (rawTarget.includes(rawSearch)) return true;
    if (procCode && procCode.toLowerCase().includes(rawSearch)) return true;

    // Correspondência via query normalizada
    const normTarget = normalizeProcedureSearchQuery(rawTarget);
    const normSearch = normalizeProcedureSearchQuery(rawSearch);

    if (normTarget.includes(normSearch)) return true;

    // Correspondência termo a termo preservando ordem
    const searchTerms = normSearch.split(/\s+/).filter(Boolean);
    let lastIdx = 0;
    for (const term of searchTerms) {
        const foundIdx = normTarget.indexOf(term, lastIdx);
        if (foundIdx === -1) {
            return false;
        }
        lastIdx = foundIdx + term.length;
    }

    return true;
}

/**
 * Analisa a lista completa de procedimentos cadastrados, detectando procedimentos de ultrassom,
 * padronizações ortográficas necessárias, possíveis equivalências clínicas e duplicidades reais.
 */
export function analyzeProcedureEquivalences(procedures: ConsultaProcedimento[]): ProcedimentoAnalysisItem[] {
    // 1. Filtrar e padronizar procedimentos principais (sem parent_id)
    const parents = procedures.filter(p => !p.parent_id);

    // Mapear cada procedimento com seu nome padronizado preliminar
    const standardizedList = parents.map(proc => {
        const std = standardizeProcedureName(proc.name);
        const feat = extractClinicalFeatures(std.standardizedName);
        return {
            proc,
            std,
            feat
        };
    });

    // 2. Analisar equivalências e categorias
    const results: ProcedimentoAnalysisItem[] = [];

    standardizedList.forEach(({ proc, std, feat }) => {
        // Ignora procedimentos que não são ultrassom na análise de ultrassom
        if (!std.isUltrasound) {
            return;
        }

        // Buscar outros procedimentos com mesma base clínica
        const candidates = standardizedList.filter(other => 
            other.proc.id !== proc.id && 
            other.feat.clinicalBase === feat.clinicalBase
        );

        let category: AnalysisCategory = 'PADRONIZACAO_ORTOGRAFICA';
        let categoryLabel = 'Padronização Ortográfica';
        let equivalentTo: ConsultaProcedimento | null = null;
        let clinicalDifferenceReason: string | undefined = undefined;

        if (candidates.length > 0) {
            // Verificar cada candidato
            for (const cand of candidates) {
                const sameDoppler = feat.hasDoppler === cand.feat.hasDoppler;
                const sameBiopsia = feat.hasBiopsia === cand.feat.hasBiopsia;
                const sameSedacao = feat.hasSedacao === cand.feat.hasSedacao && feat.isSemSedacao === cand.feat.isSemSedacao;
                const sameAdmin = feat.isTerceirizado === cand.feat.isTerceirizado;

                if (sameDoppler && sameBiopsia && sameSedacao) {
                    if (!sameAdmin) {
                        // Equivalência clínica com distinção administrativa (Próprio vs Terceirizado)
                        category = 'EQUIVALENTE_ADMINISTRATIVO';
                        categoryLabel = 'Equivalente Clínico (Diferença Administrativa: Terceirizado)';
                        equivalentTo = cand.proc;
                        clinicalDifferenceReason = `Mesma indicação clínica do Cód. ${cand.proc.code || '----'}, diferenciando-se pela execução ${feat.isTerceirizado ? 'Terceirizada' : 'Própria'}. Preservar registros separados para controle de cotas e prestadores.`;
                        break;
                    } else {
                        // Duplicidade idêntica real
                        category = 'DUPLICIDADE_IDENTICA';
                        categoryLabel = 'Duplicidade Idêntica Real';
                        equivalentTo = cand.proc;
                        clinicalDifferenceReason = `Procedimentos com mesma descrição clínica e mesma modalidade operacional do Cód. ${cand.proc.code || '----'}. Candidato à unificação após validação.`;
                        break;
                    }
                } else {
                    // Diferença clínica relevante preservada
                    category = 'DIFERENCA_CLINICA';
                    categoryLabel = 'Diferença Clínica Preservada';
                    equivalentTo = cand.proc;
                    const diffs = [];
                    if (!sameDoppler) diffs.push(feat.hasDoppler ? 'Com Doppler' : 'Sem Doppler');
                    if (!sameBiopsia) diffs.push(feat.hasBiopsia ? 'Com Biópsia' : 'Sem Biópsia');
                    if (!sameSedacao) diffs.push(feat.hasSedacao ? 'Com Sedação' : 'Sem Sedação');
                    clinicalDifferenceReason = `Especificidades clínicas distintas (${diffs.join(', ')}). Não unificar automaticamente.`;
                }
            }
        } else {
            // Sem nenhum procedimento similar
            if (std.isChanged) {
                category = 'PADRONIZACAO_ORTOGRAFICA';
                categoryLabel = 'Padronização Ortográfica / Nomenclatura';
            } else {
                category = 'JA_PADRONIZADO';
                categoryLabel = 'Já Padronizado';
            }
        }

        results.push({
            procedimento: proc,
            standardizedName: std.standardizedName,
            isChanged: std.isChanged,
            isUltrasound: true,
            isTerceirizado: std.isTerceirizado,
            category,
            categoryLabel,
            corrections: std.corrections,
            equivalentTo,
            clinicalDifferenceReason
        });
    });

    return results;
}

/**
 * Aplica padronização de nomenclaturas em lote com auditoria completa.
 */
export async function batchApplyStandardization(
    itemsToUpdate: { id: string; oldName: string; newName: string; code?: string }[],
    currentUser: User | null
): Promise<{ success: boolean; count: number; errors: string[] }> {
    const errors: string[] = [];
    let count = 0;

    for (const item of itemsToUpdate) {
        try {
            await updateProcedimento(item.id, {
                name: item.newName.trim().toUpperCase()
            });

            // Registrar auditoria detalhada
            await auditLogService.logAction({
                action_type: 'PADRONIZAR_PROCEDIMENTO_ULTRASSOM',
                module: 'Regulação / Procedimentos',
                description: `Procedimento ${item.code || ''} padronizado de "${item.oldName}" para "${item.newName}"`,
                details: {
                    procedimento_id: item.id,
                    codigo: item.code,
                    nome_anterior: item.oldName,
                    nome_novo: item.newName,
                    tipo: 'ULTRASSOM',
                    data_hora: new Date().toISOString()
                },
                user: currentUser ? {
                    id: currentUser.id,
                    name: currentUser.name,
                    email: currentUser.email
                } : null
            });

            count++;
        } catch (err: any) {
            console.error(`Erro ao atualizar procedimento ${item.id}:`, err);
            errors.push(`Erro no procedimento Cód. ${item.code || item.id}: ${err.message || 'Falha ao salvar'}`);
        }
    }

    return {
        success: errors.length === 0,
        count,
        errors
    };
}

/**
 * Consulta o resumo de impacto de um procedimento (quantas vagas, agendamentos e especialistas vinculados possui).
 */
export async function getProcedureImpactSummary(procId: string) {
    try {
        const [vagas, agendamentos, procs] = await Promise.all([
            getVagas(procId),
            getAgendamentos({ procedimentoId: procId }),
            getProcedimentos()
        ]);

        const especialistasCount = procs.filter(p => p.parent_id === procId).length;

        return {
            vagasCount: vagas.length,
            agendamentosCount: agendamentos.length,
            especialistasCount
        };
    } catch (err) {
        console.error('Erro ao obter impacto do procedimento:', err);
        return {
            vagasCount: 0,
            agendamentosCount: 0,
            especialistasCount: 0
        };
    }
}

/**
 * Realiza unificação segura de dois procedimentos após validação administrativa explícita.
 * Preserva códigos históricos como identificadores/alias, migra agendamentos e vagas sem perda de histórico.
 */
export async function unifyProceduresSafely(
    primaryProcId: string,
    secondaryProcId: string,
    justification: string,
    currentUser: User | null
): Promise<{ success: boolean; error?: string }> {
    try {
        if (!primaryProcId || !secondaryProcId) {
            throw new Error('IDs dos procedimentos principal e secundário são obrigatórios.');
        }

        if (primaryProcId === secondaryProcId) {
            throw new Error('O procedimento principal e secundário não podem ser o mesmo.');
        }

        // Buscar dados de ambos
        const procs = await getProcedimentos();
        const primary = procs.find(p => p.id === primaryProcId);
        const secondary = procs.find(p => p.id === secondaryProcId);

        if (!primary || !secondary) {
            throw new Error('Procedimentos não encontrados no sistema.');
        }

        // 1. Migrar agendamentos do secundário para o principal (preservando data, horário, prioridade e status)
        const { error: agendamentosErr } = await supabase
            .from('consultas_agendamentos')
            .update({ procedimento_id: primaryProcId })
            .eq('procedimento_id', secondaryProcId);

        if (agendamentosErr) {
            console.warn('Aviso ao migrar agendamentos na unificação:', agendamentosErr);
        }

        // 2. Migrar vagas do secundário para o principal
        const { error: vagasErr } = await supabase
            .from('consultas_vagas')
            .update({ procedimento_id: primaryProcId })
            .eq('procedimento_id', secondaryProcId);

        if (vagasErr) {
            console.warn('Aviso ao migrar vagas na unificação:', vagasErr);
        }

        // 3. Migrar especialistas vinculados como filhos
        const { error: childrenErr } = await supabase
            .from('consultas_procedimentos')
            .update({ parent_id: primaryProcId })
            .eq('parent_id', secondaryProcId);

        if (childrenErr) {
            console.warn('Aviso ao migrar especialistas filhos:', childrenErr);
        }

        // 4. Marcar o procedimento secundário como "Inativo (Unificado)" preservando o código para histórico
        const aliasNote = `UNIFICADO COM CÓD. ${primary.code || '----'} (${primary.name})`;
        await updateProcedimento(secondaryProcId, {
            status: 'Inativo',
            recurso: 'Não Se Aplica'
        });

        // 5. Registrar log de auditoria completo
        await auditLogService.logAction({
            action_type: 'UNIFICAR_PROCEDIMENTOS_ULTRASSOM',
            module: 'Regulação / Procedimentos',
            description: `Unificação do procedimento secundário "${secondary.name}" (Cód. ${secondary.code}) no procedimento principal "${primary.name}" (Cód. ${primary.code})`,
            details: {
                primary_proc: {
                    id: primary.id,
                    code: primary.code,
                    name: primary.name
                },
                secondary_proc: {
                    id: secondary.id,
                    code: secondary.code,
                    name: secondary.name
                },
                justificativa: justification || 'Unificação de procedimentos idênticos / equivalentes aprovada pelo administrador.',
                alias_historico: aliasNote,
                data_hora: new Date().toISOString()
            },
            user: currentUser ? {
                id: currentUser.id,
                name: currentUser.name,
                email: currentUser.email
            } : null
        });

        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('consultas-procedimentos-changed'));
            window.dispatchEvent(new CustomEvent('consultas-agendamentos-changed'));
            window.dispatchEvent(new CustomEvent('consultas-vagas-changed'));
        }

        return { success: true };
    } catch (err: any) {
        console.error('Erro na unificação segura de procedimentos:', err);
        return { success: false, error: err.message || 'Falha ao unificar procedimentos.' };
    }
}
