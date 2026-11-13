import { ConsultaEspecialista, ConsultaProcedimento } from '../types';
import { procedureMatchesSearch } from '../services/procedimentosStandardizer';

export interface ProcedimentosHierarchyFilters {
    search: string;
    typeFilter: 'Todos' | 'Exame' | 'Consulta' | 'Cirurgia';
    statusFilter: 'Todos' | 'Ativos' | 'Suspensos';
    solicitacoesFilter?: 'Todos' | 'Com Solicitações' | 'Sem Solicitações';
    solicitacoesCounts?: Record<string, number>;
}

export interface ProcedimentosHierarchyResult {
    /** Lista filtrada exibida no nível principal da tela (pais + vinculados órfãos sem pai). */
    parents: ConsultaProcedimento[];
    /** Procedimentos principais reais disponíveis como pai no modal "+ Adicionar Especialista". */
    allParents: ConsultaProcedimento[];
    /** Todos os itens visíveis no nível raiz antes dos filtros de busca/tipo/status. */
    allVisibleRoots: ConsultaProcedimento[];
    /** IDs dos itens em allVisibleRoots que são vinculados a especialista/parent_id órfão (sem pai associado). */
    orphanRootIds: Set<string>;
    /** Mapa de filhos agrupados por ID do procedimento pai visível. */
    childrenByParent: Map<string, ConsultaProcedimento[]>;
    /** Resumo quantitativo garantindo cobertura total dos procedimentos carregados. */
    counts: {
        strictParentsCount: number;
        orphanCount: number;
        visibleRootsCount: number;
        groupedChildrenCount: number;
        totalRegisteredCount: number;
        totalSolicitacoesCount: number;
    };
}

/**
 * Identifica se o procedimento é um procedimento principal real (sem pai nem especialista direto).
 */
export const isStrictPrincipalProcedimento = (proc: ConsultaProcedimento): boolean => {
    return !proc.parent_id && !proc.especialista_id;
};

/**
 * Normaliza strings para comparação anti-duplicação segura (sem acentos, maiúsculas, sem prefixos dr/dra)
 */
export const cleanForComparison = (str?: string | null): string => {
    if (!str) return '';
    return str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/\b(DR|DRA|DOUTOR|DOUTORA)\b\.?/g, '')
        .replace(/[^A-Z0-9]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
};

/**
 * Formata a exibição de um procedimento na camada de apresentação:
 * Quando for um procedimento filho vinculado a especialista (ou tiver especialista associado):
 * Formato obrigatório: NOME DO PROCEDIMENTO - NOME COMPLETO DO ESPECIALISTA
 * 1. Preserva o nome original do procedimento pai quando filho.
 * 2. Busca o nome completo do especialista diretamente no cadastro existente.
 * 3. Não duplica o nome do especialista caso ele já esteja presente na descrição.
 * 4. Caso não exista especialista associado, mantém somente o nome original.
 */
export const formatProcedimentoDisplay = (
    proc?: Partial<ConsultaProcedimento> | null,
    parentOrName?: Partial<ConsultaProcedimento> | string | null,
    especialistas?: ConsultaEspecialista[] | Map<string, ConsultaEspecialista>
): string => {
    if (!proc || !proc.name) return '';

    // 1. Resolve o nome do especialista de múltiplas propriedades possíveis
    let espNome = proc.especialista?.nome?.trim()
        || (proc.especialista as any)?.name?.trim()
        || (proc.especialista as any)?.nome_completo?.trim()
        || (typeof proc.especialista === 'string' ? (proc.especialista as string).trim() : '')
        || (proc as any)?.especialista_nome?.trim()
        || (proc as any)?.especialista_vinculado?.trim()
        || (proc as any)?.medico?.trim()
        || '';

    let espId = proc.especialista_id;
    if (!espId && proc.id && typeof window !== 'undefined') {
        try {
            const raw = localStorage.getItem('consultas_proc_especialistas');
            const map = raw ? JSON.parse(raw) : {};
            espId = map[proc.id] || null;
        } catch {}
    }

    if (!espNome && espId && especialistas) {
        let foundEsp: any = null;
        if (especialistas instanceof Map) {
            foundEsp = especialistas.get(espId);
        } else if (Array.isArray(especialistas)) {
            foundEsp = especialistas.find(e => e.id === espId || (e as any).codigo === espId);
        }
        if (foundEsp) {
            espNome = foundEsp.nome?.trim() || foundEsp.name?.trim() || foundEsp.nome_completo?.trim() || '';
        }
    }

    // Caso não exista especialista associado, manter somente o nome original
    if (!espNome) {
        return proc.name.trim().toUpperCase();
    }

    const cleanEsp = espNome.toUpperCase();

    // 2. Base do nome: pai (se fornecido / resolvido) ou nome próprio do procedimento
    let rawBase = '';
    if (typeof parentOrName === 'string' && parentOrName.trim()) {
        rawBase = parentOrName.trim();
    } else if (parentOrName && typeof parentOrName === 'object' && parentOrName.name) {
        rawBase = parentOrName.name.trim();
    } else if (proc.parent_name && proc.parent_name.trim()) {
        rawBase = proc.parent_name.trim();
    } else {
        rawBase = proc.name.trim();
    }

    // 3. Regra anti-duplicação:
    // Se a base do nome já contém o nome do especialista (ex: "CONSULTA EM UROLOGIA — LEONARDO REIS COTTA")
    const normBase = cleanForComparison(rawBase);
    const normEsp = cleanForComparison(cleanEsp);

    if (normBase && normEsp && normBase.includes(normEsp)) {
        return rawBase
            .replace(/\s*[—–-]\s*/g, ' - ')
            .replace(/\s+/g, ' ')
            .trim()
            .toUpperCase();
    }

    // Remove eventuais hífens / travessões na cauda da base
    const cleanBase = rawBase.replace(/[\s—–-]+$/, '').trim().toUpperCase();
    return `${cleanBase} - ${cleanEsp}`;
};

/**
 * Resolve o nome do especialista vinculado ao procedimento, usando o objeto hidratado ou a lista carregada.
 */
export const resolveEspecialistaNome = (
    proc: ConsultaProcedimento,
    especialistasMap: Map<string, ConsultaEspecialista>
): string => {
    if (proc.especialista?.nome) return proc.especialista.nome;
    if (proc.especialista_id) {
        return especialistasMap.get(proc.especialista_id)?.nome || '';
    }
    return '';
};

/**
 * Agrupa procedimentos em hierarquia pai/filho e garante que procedimentos vinculados a especialistas
 * sem procedimento pai associado ("órfãos") permaneçam visíveis no nível raiz sem perda de registros.
 */
export const buildProcedimentosHierarchy = (
    procedures: ConsultaProcedimento[],
    especialistas: ConsultaEspecialista[],
    filters: ProcedimentosHierarchyFilters
): ProcedimentosHierarchyResult => {
    const strictParents = procedures.filter(isStrictPrincipalProcedimento);
    const strictParentIds = new Set(strictParents.map(p => p.id));

    const strictParentByCode = new Map<string, ConsultaProcedimento>();
    strictParents.forEach(p => {
        if (p.code && !strictParentByCode.has(p.code)) {
            strictParentByCode.set(p.code, p);
        }
    });

    // Ordena por tamanho de nome decrescente para evitar casar um prefixo curto antes de um mais específico
    const strictParentsByNameLength = [...strictParents].sort(
        (a, b) => b.name.trim().length - a.name.trim().length
    );

    const especialistasMap = new Map<string, ConsultaEspecialista>(
        especialistas.map(e => [e.id, e])
    );

    const childrenByParent = new Map<string, ConsultaProcedimento[]>();
    const appendChild = (parentId: string, child: ConsultaProcedimento, parentName?: string) => {
        const list = childrenByParent.get(parentId) || [];
        if (!list.some(existing => existing.id === child.id)) {
            const enrichedChild: ConsultaProcedimento = parentName
                ? { ...child, parent_name: parentName }
                : child;
            list.push(enrichedChild);
            childrenByParent.set(parentId, list);
        }
    };

    // Passe 1: tenta associar cada procedimento vinculado a um procedimento principal real
    const unmatched: ConsultaProcedimento[] = [];

    procedures.forEach(proc => {
        if (strictParentIds.has(proc.id)) return;

        if (proc.parent_id && strictParentIds.has(proc.parent_id)) {
            const matchingParent = strictParents.find(p => p.id === proc.parent_id);
            appendChild(proc.parent_id, proc, matchingParent?.name);
            return;
        }

        if (proc.code && proc.code.includes('-')) {
            const parentCode = proc.code.split('-')[0];
            const matchingParent = strictParentByCode.get(parentCode);
            if (matchingParent) {
                appendChild(matchingParent.id, proc, matchingParent.name);
                return;
            }
        }

        if (proc.especialista_id) {
            const upperChildName = proc.name.trim().toUpperCase();
            const matchingParent = strictParentsByNameLength.find(parent => {
                const upperParentName = parent.name.trim().toUpperCase();
                return parent.id !== proc.id && upperParentName.length > 0 && upperChildName.startsWith(upperParentName);
            });
            if (matchingParent) {
                appendChild(matchingParent.id, proc, matchingParent.name);
                return;
            }
        }

        unmatched.push(proc);
    });

    // Passe 2: define quais registros sem pai entram como cards raiz órfãos
    // e garante que eventuais sub-filhos com parent_id válido em outro órfão raiz não sumam da árvore.
    const orphanCandidatesById = new Map(unmatched.map(p => [p.id, p]));
    const orphanRootIds = new Set<string>();

    const isDirectChildOfOrphanRoot = (proc: ConsultaProcedimento): boolean => {
        if (!proc.parent_id || proc.parent_id === proc.id) return false;
        const targetParent = orphanCandidatesById.get(proc.parent_id);
        if (!targetParent) return false;
        return !targetParent.parent_id || !orphanCandidatesById.has(targetParent.parent_id);
    };

    unmatched.forEach(proc => {
        if (proc.parent_id && isDirectChildOfOrphanRoot(proc)) {
            const parentProc = orphanCandidatesById.get(proc.parent_id);
            appendChild(proc.parent_id, proc, parentProc?.name);
        } else {
            orphanRootIds.add(proc.id);
        }
    });

    // Mantém a ordenação original de `procedures` para os cards exibidos no nível raiz
    const allVisibleRoots = procedures.filter(
        p => strictParentIds.has(p.id) || orphanRootIds.has(p.id)
    );

    const cleanSearch = filters.search.toLowerCase().trim();

    const filteredParents = allVisibleRoots.filter(root => {
        const children = childrenByParent.get(root.id) || [];

        if (filters.typeFilter !== 'Todos' && root.type !== filters.typeFilter) {
            return false;
        }

        if (filters.statusFilter === 'Ativos' && root.status !== 'Ativo') {
            return false;
        }
        if (filters.statusFilter === 'Suspensos' && root.status === 'Ativo') {
            return false;
        }

        // Filtro Adicional: Com Solicitações vs. Sem Solicitações
        if (filters.solicitacoesFilter && filters.solicitacoesFilter !== 'Todos' && filters.solicitacoesCounts) {
            const rootDirect = (filters.solicitacoesCounts[root.id] || 0) + (root.code && root.code !== root.id ? (filters.solicitacoesCounts[root.code] || 0) : 0);
            const childrenTotal = children.reduce((sum, c) => {
                const cCount = (filters.solicitacoesCounts?.[c.id] || 0) + (c.code && c.code !== c.id ? (filters.solicitacoesCounts?.[c.code] || 0) : 0);
                return sum + cCount;
            }, 0);
            const groupTotal = rootDirect + childrenTotal;

            if (filters.solicitacoesFilter === 'Com Solicitações' && groupTotal === 0) {
                return false;
            }
            if (filters.solicitacoesFilter === 'Sem Solicitações' && groupTotal > 0) {
                return false;
            }
        }

        if (cleanSearch) {
            const rootEspNome = resolveEspecialistaNome(root, especialistasMap);
            const rootMatches =
                procedureMatchesSearch(root.name, cleanSearch, root.code) ||
                root.type.toLowerCase().includes(cleanSearch) ||
                (rootEspNome ? procedureMatchesSearch(rootEspNome, cleanSearch) : false);

            const childMatches = children.some(child => {
                const childEspNome = resolveEspecialistaNome(child, especialistasMap);
                const childDisplayLabel = formatProcedimentoDisplay(child, root.name, especialistasMap);
                return (
                    procedureMatchesSearch(child.name, cleanSearch, child.code) ||
                    procedureMatchesSearch(childDisplayLabel, cleanSearch, child.code) ||
                    (childEspNome ? procedureMatchesSearch(childEspNome, cleanSearch) : false)
                );
            });

            return rootMatches || childMatches;
        }

        return true;
    });

    let groupedChildrenCount = 0;
    childrenByParent.forEach(list => {
        groupedChildrenCount += list.length;
    });

    let totalSolicitacoesCount = 0;
    if (filters.solicitacoesCounts) {
        const countedIds = new Set<string>();
        procedures.forEach(p => {
            if (!countedIds.has(p.id)) {
                countedIds.add(p.id);
                totalSolicitacoesCount += (filters.solicitacoesCounts?.[p.id] || 0);
            }
        });
    }

    return {
        parents: filteredParents,
        allParents: strictParents,
        allVisibleRoots,
        orphanRootIds,
        childrenByParent,
        counts: {
            strictParentsCount: strictParents.length,
            orphanCount: orphanRootIds.size,
            visibleRootsCount: allVisibleRoots.length,
            groupedChildrenCount,
            totalRegisteredCount: procedures.length,
            totalSolicitacoesCount
        }
    };
};
