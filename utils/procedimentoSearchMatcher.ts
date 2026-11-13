// ==============================================================================
// UTILITÁRIO CENTRALIZADO: PESQUISA INTELIGENTE E FLEXÍVEL DE PROCEDIMENTOS
// Normalização semântica, equivalência de hífens e preposições (de, do, da, dos, das, com, em),
// pesquisa por código, preservação da ordem das palavras e distinção clínica.
// ==============================================================================

/**
 * Conectores em Língua Portuguesa equivalentes semânticos a hífen / traço em nomes de procedimentos.
 */
export const PROCEDIMENTO_CONNECTOR_WORDS = new Set([
    'de',
    'do',
    'da',
    'dos',
    'das',
    'com',
    'em',
    'no',
    'na',
    'nos',
    'nas',
    'e',
    'a',
    'ao',
    'aos'
]);

/**
 * Normaliza uma string de texto removendo acentuação, caracteres especiais e convertendo para minúsculas.
 * Hífens, traços e barras são convertidos em espaços.
 */
export function normalizeSearchString(text: string): string {
    if (!text || typeof text !== 'string') return '';
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // remove diacríticos / acentos
        .replace(/[-–—/\\,;:|]/g, ' ')   // hífens e pontuações viram espaços
        .replace(/\s+/g, ' ')            // remove múltiplos espaços internos
        .trim();
}

/**
 * Normaliza variações fonéticas e lexicais comuns em nomes de exames/consultas (ex: Ultrassom).
 */
export function normalizeProcedimentoWord(word: string): string {
    if (!word) return '';
    const w = word.toLowerCase().trim();

    // Variações de Ultrassom / Ultrassonografia / USG / US
    if (
        w === 'ultrassonografia' || 
        w === 'ultrasonografia' || 
        w === 'ultrassom' || 
        w === 'ultrasom' || 
        w === 'usg' || 
        w === 'us'
    ) {
        return 'ultrassom';
    }

    // Variações ortográficas anatômicas
    if (w === 'abdomem' || w === 'abdomen') {
        return 'abdomen';
    }
    if (w === 'tireoide' || w === 'tireoidea') {
        return 'tireoide';
    }
    if (w === 'obstetrica' || w === 'obstetrico') {
        return 'obstetrico';
    }
    if (w === 'morfologica' || w === 'morfologico') {
        return 'morfologico';
    }
    if (w === 'pelvica' || w === 'pelvico') {
        return 'pelvico';
    }
    if (w === 'terc' || w === 'terceirizado') {
        return 'terceirizado';
    }

    return w;
}

/**
 * Divide o texto em tokens significativos, removendo conectores / preposições equivalentes a hífen
 * e aplicando padronização de sinônimos/prefixos.
 */
export function tokenizeProcedimento(text: string, filterConnectors = true): string[] {
    const norm = normalizeSearchString(text);
    if (!norm) return [];

    const rawWords = norm.split(/\s+/).filter(Boolean);
    const tokens: string[] = [];

    for (const raw of rawWords) {
        const canonical = normalizeProcedimentoWord(raw);
        if (!canonical) continue;

        if (filterConnectors && PROCEDIMENTO_CONNECTOR_WORDS.has(canonical)) {
            continue; // Ignora conector/preposição para equivalência transparente com hífen
        }

        tokens.push(canonical);
    }

    return tokens;
}

/**
 * Extrai o código numérico e prefixos de busca por código (ex: "cod 0092", "codigo 092", "#123").
 */
export function extractCodeSearch(query: string): { isExplicitCode: boolean; codeClean: string; rawQuery: string } {
    const raw = (query || '').trim();
    const codePrefixMatch = raw.match(/^(c[oó]digo|cod\.?|c[oó]d\.?):?\s*(.+)$/i);
    if (codePrefixMatch) {
        const target = codePrefixMatch[2].trim().replace(/\D/g, '');
        return { isExplicitCode: true, codeClean: target, rawQuery: raw };
    }

    const cleanDigits = raw.replace(/\D/g, '');
    const isOnlyDigits = cleanDigits.length > 0 && /^[0-9.\-/ ]+$/.test(raw);

    return {
        isExplicitCode: isOnlyDigits,
        codeClean: cleanDigits,
        rawQuery: raw
    };
}

/**
 * Pontua a relevância de correspondência entre um procedimento e o termo pesquisado.
 * Retorna score > 0 se houver correspondência, ou 0 se não houver.
 * 
 * Ordem de Prioridade:
 * 1. Correspondência exata do código (1000 pts) ou prefixo do código (850-900 pts).
 * 2. Correspondência exata do nome original ou normalizado (900-950 pts).
 * 3. Correspondência normalizada com equivalência de hífens e preposições (750-850 pts).
 * 4. Correspondência por prefixos e palavras relevantes em ordem (500-700 pts).
 */
export function scoreProcedimentoMatch(
    targetNameOrLabel: string,
    searchQuery: string,
    targetCode?: string
): number {
    const rawSearch = (searchQuery || '').trim();
    if (!rawSearch) return 1; // Query vazia aceita tudo

    const rawTarget = (targetNameOrLabel || '').trim();
    const normTarget = normalizeSearchString(rawTarget);
    const normSearch = normalizeSearchString(rawSearch);

    // -------------------------------------------------------------------------
    // 1. CORRESPONDÊNCIA POR CÓDIGO
    // -------------------------------------------------------------------------
    const codeSearch = extractCodeSearch(rawSearch);
    if (targetCode) {
        const cleanTargetCode = targetCode.replace(/\D/g, '');
        const normTargetCode = normalizeSearchString(targetCode);

        // Busca explícita por código (ex: "cod 0092")
        if (codeSearch.isExplicitCode && codeSearch.codeClean) {
            if (cleanTargetCode === codeSearch.codeClean || normTargetCode === codeSearch.rawQuery.toLowerCase()) {
                return 1000;
            }
            if (cleanTargetCode.replace(/^0+/, '') === codeSearch.codeClean.replace(/^0+/, '')) {
                return 980;
            }
            if (cleanTargetCode.startsWith(codeSearch.codeClean) || cleanTargetCode.endsWith(codeSearch.codeClean)) {
                return 880;
            }
            if (cleanTargetCode.includes(codeSearch.codeClean)) {
                return 820;
            }
        }

        // Se a query numérica bate diretamente no código
        if (codeSearch.codeClean && cleanTargetCode) {
            if (cleanTargetCode === codeSearch.codeClean) {
                return 950;
            }
            if (cleanTargetCode.replace(/^0+/, '') === codeSearch.codeClean.replace(/^0+/, '')) {
                return 920;
            }
            if (cleanTargetCode.startsWith(codeSearch.codeClean)) {
                return 850;
            }
        }
    }

    // -------------------------------------------------------------------------
    // 2. CORRESPONDÊNCIA EXATA / DIRETA DE TEXTO
    // -------------------------------------------------------------------------
    if (normTarget && normSearch && normTarget === normSearch) {
        return 900;
    }
    if (normTarget && normSearch && normTarget.startsWith(normSearch)) {
        return 850;
    }
    if (normTarget && normSearch && normTarget.includes(normSearch)) {
        return 800;
    }

    // -------------------------------------------------------------------------
    // 3. NORMALIZAÇÃO INTELIGENTE: EQUIVALÊNCIA ENTRE HÍFENS E PREPOSIÇÕES
    // -------------------------------------------------------------------------
    const targetTokens = tokenizeProcedimento(rawTarget, true);
    const searchTokens = tokenizeProcedimento(rawSearch, true);

    if (searchTokens.length === 0) {
        // Se a busca só continha preposições ou espaços vazios
        return normTarget.includes(normSearch) ? 500 : 0;
    }

    // Comparações de sequência semântica completa
    const searchTokensStr = searchTokens.join(' ');
    const targetTokensStr = targetTokens.join(' ');

    if (searchTokensStr === targetTokensStr) {
        // Ex: "Ultrassom do abdominal" <=> "ULTRASSOM - ABDOMINAL"
        return 870;
    }

    if (targetTokensStr.startsWith(searchTokensStr)) {
        // Ex: "ultrassom do abdomen" <=> "ULTRASSOM - ABDÔMEN TOTAL"
        return 820;
    }

    if (targetTokensStr.includes(searchTokensStr)) {
        return 780;
    }

    // -------------------------------------------------------------------------
    // 4. CORRESPONDÊNCIA TERMO A TERMO PRESERVANDO A ORDEM DAS PALAVRAS RELEVANTES
    // -------------------------------------------------------------------------
    // Cada palavra da query deve bater com um token do procedimento em sequência ordenada
    let targetIdx = 0;
    let matchedCount = 0;

    for (const sToken of searchTokens) {
        let found = false;
        while (targetIdx < targetTokens.length) {
            const tToken = targetTokens[targetIdx];
            targetIdx++;

            // Correspondência exata da palavra ou prefixo
            if (tToken === sToken) {
                found = true;
                matchedCount++;
                break;
            }
            // Aceita se a palavra no procedimento começa com o termo digitado (ex: "abdom" bate em "abdominal" ou "abdomen")
            if (tToken.startsWith(sToken) && sToken.length >= 3) {
                found = true;
                matchedCount++;
                break;
            }
        }

        // Se uma palavra essencial da pesquisa não foi encontrada na ordem, a correspondência falha.
        // Isso preserva rigorosamente a distinção clínica (ex: "superior" não baterá em "total").
        if (!found) {
            return 0;
        }
    }

    // Se todos os tokens da busca foram encontrados na ordem correta
    if (matchedCount === searchTokens.length) {
        // Dá pontuação mais alta se a busca cobrir a maior parte do nome
        const coverageRatio = matchedCount / Math.max(targetTokens.length, 1);
        return 650 + Math.round(coverageRatio * 100);
    }

    return 0;
}

/**
 * Função principal centralizada que verifica se o procedimento corresponde ao termo de busca.
 * Trata hífens e preposições (de, do, da, dos, das, com, em) como equivalentes bilaterais.
 */
export function procedureMatchesSearch(
    targetNameOrLabel: string,
    searchQuery: string,
    targetCode?: string
): boolean {
    if (!searchQuery || !searchQuery.trim()) return true;
    const score = scoreProcedimentoMatch(targetNameOrLabel, searchQuery, targetCode);
    return score > 0;
}

/**
 * Ordena uma lista de procedimentos por relevância da pesquisa inteligente.
 */
export function sortProcedimentosByRelevance<T extends { name: string; code?: string }>(
    items: T[],
    searchQuery: string,
    getLabel?: (item: T) => string
): T[] {
    const raw = (searchQuery || '').trim();
    if (!raw) return items;

    return [...items].sort((a, b) => {
        const labelA = getLabel ? getLabel(a) : a.name;
        const labelB = getLabel ? getLabel(b) : b.name;

        const scoreA = scoreProcedimentoMatch(labelA, raw, a.code);
        const scoreB = scoreProcedimentoMatch(labelB, raw, b.code);

        if (scoreB !== scoreA) {
            return scoreB - scoreA;
        }

        return (a.name || '').localeCompare(b.name || '');
    });
}

/**
 * Gera alternativas e padrões de busca SQL otimizados para consultas ao Supabase / Postgres.
 * Transforma termos como "ultrassom do abdomen" em padrões "%ultrassom%abdomen%"
 * que casam com "ULTRASSOM - ABDÔMEN TOTAL", "ULTRASSOM DE ABDOME", etc.
 */
export function generateSupabaseProcedureSearchPatterns(searchQuery: string): string[] {
    const raw = (searchQuery || '').trim();
    if (!raw || raw.length < 2) return [];

    const patterns: string[] = [];
    const cleanRaw = raw.replace(/[%_]/g, '');

    // 1. Termo direto sem pontuações arriscadas
    patterns.push(`%${cleanRaw}%`);

    const noAccents = cleanRaw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (noAccents.toLowerCase() !== cleanRaw.toLowerCase()) {
        patterns.push(`%${noAccents}%`);
    }

    // 2. Termos significativos (sem conectores de, do, da, dos, das, com)
    const tokens = tokenizeProcedimento(raw, true);
    if (tokens.length >= 2) {
        // Padrão SQL subsequencial: %token1%token2%...%
        // No Postgres, isso aceita qualquer separador entre eles (espaço, hífen, "de", "do", etc.)
        const joinedPattern = `%${tokens.join('%')}%`;
        if (!patterns.includes(joinedPattern)) {
            patterns.push(joinedPattern);
        }
    } else if (tokens.length === 1) {
        const single = `%${tokens[0]}%`;
        if (!patterns.includes(single)) {
            patterns.push(single);
        }
    }

    return patterns;
}

