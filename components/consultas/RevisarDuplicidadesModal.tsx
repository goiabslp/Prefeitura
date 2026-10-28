import React, { useState, useMemo, useEffect } from 'react';
import { 
    X, Sparkles, CheckCircle2, AlertTriangle, ArrowRight, Layers, 
    Search, Check, ShieldAlert, GitMerge, FileText, RefreshCw, 
    Info, Stethoscope, Calendar, Clock, ChevronRight, HelpCircle,
    ArrowUpDown, Filter, ShieldCheck, Eye, Database, AlertCircle, Loader2, ArrowLeftRight
} from 'lucide-react';
import { ConsultaProcedimento, User } from '../../types';
import { 
    analyzeProcedureEquivalences, 
    batchApplyStandardization, 
    unifyProceduresSafely, 
    getProcedureImpactSummary,
    ProcedimentoAnalysisItem,
    AnalysisCategory
} from '../../services/procedimentosStandardizer';

interface RevisarDuplicidadesModalProps {
    isOpen: boolean;
    onClose: () => void;
    procedures: ConsultaProcedimento[];
    currentUser?: User | null;
    onSuccessReload: () => Promise<void>;
}

export const RevisarDuplicidadesModal: React.FC<RevisarDuplicidadesModalProps> = ({
    isOpen,
    onClose,
    procedures,
    currentUser,
    onSuccessReload
}) => {
    // Busca e filtros do GRID
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('TODAS');
    const [selectedDiffOnly, setSelectedDiffOnly] = useState<boolean>(true);

    // Estados de Ação
    const [loadingAction, setLoadingAction] = useState<string | null>(null);
    const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

    // Modal Comparar Lado a Lado
    const [comparingItem, setComparingItem] = useState<{
        itemA: ProcedimentoAnalysisItem;
        itemB: ConsultaProcedimento;
    } | null>(null);

    // Modal Padronização em Lote (Prévia e Confirmação)
    const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
    const [selectedBatchIds, setSelectedBatchIds] = useState<Record<string, boolean>>({});

    // Modal de Unificação Segura (Confirmação de Impacto)
    const [unifyTarget, setUnifyTarget] = useState<{
        primary: ConsultaProcedimento;
        secondary: ConsultaProcedimento;
        impactPrimary?: { vagasCount: number; agendamentosCount: number; especialistasCount: number };
        impactSecondary?: { vagasCount: number; agendamentosCount: number; especialistasCount: number };
    } | null>(null);
    const [unifyJustification, setUnifyJustification] = useState('');
    const [loadingImpact, setLoadingImpact] = useState(false);

    // Exibir Toast
    const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
        setActionMessage({ type, text });
        setTimeout(() => setActionMessage(null), 4000);
    };

    // Analisar todos os procedimentos de ultrassom
    const analysisItems = useMemo(() => {
        return analyzeProcedureEquivalences(procedures);
    }, [procedures]);

    // Métricas para o Dashboard / Top Cards
    const metrics = useMemo(() => {
        const total = analysisItems.length;
        const toStandardize = analysisItems.filter(i => i.isChanged).length;
        const adminEquivalents = analysisItems.filter(i => i.category === 'EQUIVALENTE_ADMINISTRATIVO').length;
        const clinicalDiffs = analysisItems.filter(i => i.category === 'DIFERENCA_CLINICA').length;
        const duplicates = analysisItems.filter(i => i.category === 'DUPLICIDADE_IDENTICA').length;
        const alreadyDone = analysisItems.filter(i => !i.isChanged).length;

        return {
            total,
            toStandardize,
            adminEquivalents,
            clinicalDiffs,
            duplicates,
            alreadyDone
        };
    }, [analysisItems]);

    // Filtragem dos itens exibidos no GRID
    const filteredItems = useMemo(() => {
        const cleanQuery = searchTerm.toLowerCase().trim();

        return analysisItems.filter(item => {
            // Filtro de busca textual
            if (cleanQuery) {
                const codeMatch = item.procedimento.code?.toLowerCase().includes(cleanQuery);
                const originalMatch = item.procedimento.name.toLowerCase().includes(cleanQuery);
                const stdMatch = item.standardizedName.toLowerCase().includes(cleanQuery);
                const catMatch = item.categoryLabel.toLowerCase().includes(cleanQuery);
                if (!codeMatch && !originalMatch && !stdMatch && !catMatch) {
                    return false;
                }
            }

            // Filtro por categoria
            if (selectedCategory !== 'TODAS' && item.category !== selectedCategory) {
                return false;
            }

            // Filtro: apenas com alterações propostas
            if (selectedDiffOnly && !item.isChanged && item.category !== 'DUPLICIDADE_IDENTICA' && item.category !== 'EQUIVALENTE_ADMINISTRATIVO') {
                return false;
            }

            return true;
        });
    }, [analysisItems, searchTerm, selectedCategory, selectedDiffOnly]);

    // Inicializar seleção em lote com todos os que têm alteração
    const handleOpenBatchModal = () => {
        const initialSelection: Record<string, boolean> = {};
        analysisItems.forEach(item => {
            if (item.isChanged) {
                initialSelection[item.procedimento.id] = true;
            }
        });
        setSelectedBatchIds(initialSelection);
        setIsBatchModalOpen(true);
    };

    // Aplicar Padronização Individual
    const handleApplySingleStandardization = async (item: ProcedimentoAnalysisItem) => {
        setLoadingAction(`single-${item.procedimento.id}`);
        try {
            const res = await batchApplyStandardization([{
                id: item.procedimento.id,
                oldName: item.procedimento.name,
                newName: item.standardizedName,
                code: item.procedimento.code
            }], currentUser || null);

            if (res.success) {
                showToast(`Procedimento ${item.procedimento.code || ''} padronizado com sucesso!`);
                await onSuccessReload();
            } else {
                showToast(res.errors[0] || 'Erro ao padronizar procedimento.', 'error');
            }
        } catch (err: any) {
            console.error('Erro na padronização individual:', err);
            showToast(err.message || 'Falha ao salvar padronização.', 'error');
        } finally {
            setLoadingAction(null);
        }
    };

    // Confirmar Execução em Lote
    const handleConfirmBatch = async () => {
        const selectedItems = analysisItems.filter(i => selectedBatchIds[i.procedimento.id] && i.isChanged);
        if (selectedItems.length === 0) {
            showToast('Nenhum procedimento selecionado para padronização.', 'info');
            return;
        }

        setLoadingAction('batch-exec');
        try {
            const payload = selectedItems.map(i => ({
                id: i.procedimento.id,
                oldName: i.procedimento.name,
                newName: i.standardizedName,
                code: i.procedimento.code
            }));

            const res = await batchApplyStandardization(payload, currentUser || null);
            setIsBatchModalOpen(false);

            if (res.success) {
                showToast(`${res.count} procedimentos de ultrassom foram padronizados com sucesso!`);
            } else {
                showToast(`Padronizados ${res.count} procedimentos com ${res.errors.length} avisos.`, 'info');
            }

            await onSuccessReload();
        } catch (err: any) {
            console.error('Erro ao executar padronização em lote:', err);
            showToast(err.message || 'Falha ao processar lote.', 'error');
        } finally {
            setLoadingAction(null);
        }
    };

    // Gerador de justificativa padrão automática para unificação
    const generateDefaultUnifyJustification = (primary: ConsultaProcedimento, secondary: ConsultaProcedimento) => {
        return `Unificação administrativa: Procedimento ${secondary.code ? `Cód. ${secondary.code} (${secondary.name})` : secondary.name} consolidado no Procedimento Principal ${primary.code ? `Cód. ${primary.code} (${primary.name})` : primary.name}. Histórico, agendamentos e cotas preservados integralmente.`;
    };

    // Abrir modal de unificação segura com levantamento de impacto
    const handleOpenUnifyModal = async (primary: ConsultaProcedimento, secondary: ConsultaProcedimento) => {
        setUnifyTarget({ primary, secondary });
        setUnifyJustification(generateDefaultUnifyJustification(primary, secondary));
        setLoadingImpact(true);

        try {
            const [impactPrim, impactSec] = await Promise.all([
                getProcedureImpactSummary(primary.id),
                getProcedureImpactSummary(secondary.id)
            ]);
            setUnifyTarget(prev => {
                if (!prev) return null;
                return {
                    ...prev,
                    primary,
                    secondary,
                    impactPrimary: impactPrim,
                    impactSecondary: impactSec
                };
            });
        } catch (err) {
            console.error('Erro ao calcular impacto de unificação:', err);
        } finally {
            setLoadingImpact(false);
        }
    };

    // Alternar qual é o Principal e qual é o Secundário
    const handleSwapUnifyRoles = () => {
        if (!unifyTarget) return;
        const newPrimary = unifyTarget.secondary;
        const newSecondary = unifyTarget.primary;
        const newImpactPrimary = unifyTarget.impactSecondary;
        const newImpactSecondary = unifyTarget.impactPrimary;

        setUnifyTarget({
            primary: newPrimary,
            secondary: newSecondary,
            impactPrimary: newImpactPrimary,
            impactSecondary: newImpactSecondary
        });
        setUnifyJustification(generateDefaultUnifyJustification(newPrimary, newSecondary));
    };

    // Confirmar Unificação Segura
    const handleConfirmUnify = async () => {
        if (!unifyTarget) return;

        setLoadingAction('unify-exec');
        try {
            const finalJustification = unifyJustification.trim() || generateDefaultUnifyJustification(unifyTarget.primary, unifyTarget.secondary);
            const res = await unifyProceduresSafely(
                unifyTarget.primary.id,
                unifyTarget.secondary.id,
                finalJustification,
                currentUser || null
            );

            if (res.success) {
                showToast(`Procedimento ${unifyTarget.secondary.code ? `Cód. ${unifyTarget.secondary.code}` : ''} unificado com sucesso no Procedimento Principal ${unifyTarget.primary.code ? `Cód. ${unifyTarget.primary.code}` : ''}! Histórico e cotas preservados.`);
                setUnifyTarget(null);
                setComparingItem(null);
                await onSuccessReload();
            } else {
                showToast(res.error || 'Erro ao unificar procedimentos.', 'error');
            }
        } catch (err: any) {
            console.error('Erro ao unificar:', err);
            showToast(err.message || 'Falha na unificação.', 'error');
        } finally {
            setLoadingAction(null);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-2 sm:p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
            {/* Modal Container Principal - Máximo do Viewport */}
            <div className="w-full h-full max-w-[98vw] max-h-[96vh] md:max-w-[96vw] md:max-h-[94vh] flex flex-col bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden relative">
                
                {/* Toast de Notificação Interno */}
                {actionMessage && (
                    <div className={`fixed top-6 right-6 z-[1100] px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-2.5 text-xs font-bold animate-in slide-in-from-top-4 duration-300 ${
                        actionMessage.type === 'success'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200 shadow-emerald-500/10'
                            : actionMessage.type === 'error'
                            ? 'bg-rose-50 text-rose-800 border-rose-200 shadow-rose-500/10'
                            : 'bg-amber-50 text-amber-800 border-amber-200 shadow-amber-500/10'
                    }`}>
                        {actionMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                        {actionMessage.type === 'error' && <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />}
                        {actionMessage.type === 'info' && <Info className="w-4 h-4 text-amber-600 shrink-0" />}
                        <span>{actionMessage.text}</span>
                    </div>
                )}

                {/* HEADER SUPERIOR */}
                <div className="px-6 py-4 border-b border-slate-200/80 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-sky-500 rounded-2xl text-white shadow-lg shadow-indigo-500/30">
                            <Sparkles className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-lg font-black tracking-tight uppercase text-white">
                                    Revisão Inteligente de Ultrassom & Duplicidades
                                </h2>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-sky-500/20 text-sky-300 border border-sky-400/30">
                                    SUS / Regulação
                                </span>
                            </div>
                            <p className="text-xs text-slate-300 font-medium mt-0.5">
                                Padronização obrigatória com prefixo <strong className="text-white">ULTRASSOM</strong>, correção gramatical e análise inteligente de equivalências sem perda de dados.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                        {/* Botão de Destaque: Padronizar Nomenclaturas em Lote */}
                        <button
                            type="button"
                            onClick={handleOpenBatchModal}
                            disabled={metrics.toStandardize === 0}
                            className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer ${
                                metrics.toStandardize > 0
                                    ? 'bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white shadow-sky-500/20 border border-sky-400/40'
                                    : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                            }`}
                            title="Padronizar todas as nomenclaturas de ultrassom em lote com prévia"
                        >
                            <Sparkles className="w-4 h-4 text-amber-300" />
                            <span>Padronizar Nomenclaturas ({metrics.toStandardize})</span>
                        </button>

                        {/* Botão Fechar */}
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all cursor-pointer"
                            title="Fechar Janela"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* CARDS DE MÉTRICAS E STATUS */}
                <div className="px-6 py-3 bg-slate-50 border-b border-slate-200/80 shrink-0">
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
                        <div className="p-2.5 bg-white border border-slate-200 rounded-xl shadow-2xs">
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Total Analisados</span>
                            <span className="text-base font-black text-slate-900">{metrics.total} exames</span>
                        </div>

                        <div className="p-2.5 bg-sky-50/70 border border-sky-200 rounded-xl shadow-2xs">
                            <span className="text-[10px] font-black uppercase tracking-wider text-sky-700 block">A Padronizar</span>
                            <span className="text-base font-black text-sky-800">{metrics.toStandardize} pendentes</span>
                        </div>

                        <div className="p-2.5 bg-indigo-50/70 border border-indigo-200 rounded-xl shadow-2xs">
                            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 block">Terceirizados (TERC.)</span>
                            <span className="text-base font-black text-indigo-800">{metrics.adminEquivalents} exames</span>
                        </div>

                        <div className="p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-xl shadow-2xs">
                            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 block">Já Padronizados</span>
                            <span className="text-base font-black text-emerald-800">{metrics.alreadyDone} conformes</span>
                        </div>

                        <div className="p-2.5 bg-amber-50/70 border border-amber-200 rounded-xl shadow-2xs">
                            <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 block">Diferença Clínica</span>
                            <span className="text-base font-black text-amber-800">{metrics.clinicalDiffs} preservados</span>
                        </div>

                        <div className="p-2.5 bg-purple-50/70 border border-purple-200 rounded-xl shadow-2xs">
                            <span className="text-[10px] font-black uppercase tracking-wider text-purple-700 block">Duplicidades Reais</span>
                            <span className="text-base font-black text-purple-800">{metrics.duplicates} idênticos</span>
                        </div>
                    </div>
                </div>

                {/* BARRA DE FILTROS E BUSCA */}
                <div className="px-6 py-3 border-b border-slate-200 bg-white shrink-0 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                    <div className="flex flex-col sm:flex-row items-center gap-2 flex-1">
                        <div className="relative w-full sm:w-80">
                            <input
                                type="text"
                                placeholder="Buscar por código ou nome de ultrassom..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
                            />
                            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            {searchTerm && (
                                <button
                                    onClick={() => setSearchTerm('')}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>

                        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-full sm:w-auto overflow-x-auto text-[11px] font-extrabold">
                            <button
                                onClick={() => setSelectedCategory('TODAS')}
                                className={`px-2.5 py-1.5 rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                                    selectedCategory === 'TODAS'
                                        ? 'bg-white text-slate-900 shadow-2xs'
                                        : 'text-slate-500 hover:text-slate-800'
                                }`}
                            >
                                Todas Categorias ({analysisItems.length})
                            </button>
                            <button
                                onClick={() => setSelectedCategory('PADRONIZACAO_ORTOGRAFICA')}
                                className={`px-2.5 py-1.5 rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                                    selectedCategory === 'PADRONIZACAO_ORTOGRAFICA'
                                        ? 'bg-white text-sky-700 shadow-2xs'
                                        : 'text-slate-500 hover:text-slate-800'
                                }`}
                            >
                                Ortografia ({metrics.toStandardize})
                            </button>
                            <button
                                onClick={() => setSelectedCategory('EQUIVALENTE_ADMINISTRATIVO')}
                                className={`px-2.5 py-1.5 rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                                    selectedCategory === 'EQUIVALENTE_ADMINISTRATIVO'
                                        ? 'bg-white text-indigo-700 shadow-2xs'
                                        : 'text-slate-500 hover:text-slate-800'
                                }`}
                            >
                                Terceirizados ({metrics.adminEquivalents})
                            </button>
                            <button
                                onClick={() => setSelectedCategory('DIFERENCA_CLINICA')}
                                className={`px-2.5 py-1.5 rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                                    selectedCategory === 'DIFERENCA_CLINICA'
                                        ? 'bg-white text-amber-700 shadow-2xs'
                                        : 'text-slate-500 hover:text-slate-800'
                                }`}
                            >
                                Diferenças Clínicas ({metrics.clinicalDiffs})
                            </button>
                            <button
                                onClick={() => setSelectedCategory('DUPLICIDADE_IDENTICA')}
                                className={`px-2.5 py-1.5 rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                                    selectedCategory === 'DUPLICIDADE_IDENTICA'
                                        ? 'bg-white text-purple-700 shadow-2xs'
                                        : 'text-slate-500 hover:text-slate-800'
                                }`}
                            >
                                Duplicidades ({metrics.duplicates})
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={selectedDiffOnly}
                                onChange={(e) => setSelectedDiffOnly(e.target.checked)}
                                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
                            />
                            <span>Apenas com alterações recomendadas</span>
                        </label>
                    </div>
                </div>

                {/* GRID / TABELA PRINCIPAL DE PROCEDIMENTOS */}
                <div className="flex-1 overflow-auto p-4 md:p-6 bg-slate-50/40">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-100/80 border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-500">
                                    <th className="py-3 px-4 w-24">Código</th>
                                    <th className="py-3 px-4 w-1/3">Procedimento Atual</th>
                                    <th className="py-3 px-4 w-1/3">Nome Padronizado</th>
                                    <th className="py-3 px-4 w-1/5">Análise Inteligente</th>
                                    <th className="py-3 px-4 text-right w-44">Ação</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs font-medium">
                                {filteredItems.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="py-12 text-center text-slate-400">
                                            <div className="flex flex-col items-center justify-center gap-2">
                                                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                                                <p className="font-extrabold text-slate-700 text-sm">Nenhum procedimento pendente encontrado com os filtros atuais.</p>
                                                <p className="text-xs text-slate-400">Todos os exames correspondentes estão organizados ou conformes.</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredItems.map(item => {
                                        const isBusy = loadingAction === `single-${item.procedimento.id}`;
                                        
                                        // Visual do badge de categoria
                                        const categoryBadge = (() => {
                                            switch (item.category) {
                                                case 'PADRONIZACAO_ORTOGRAFICA':
                                                    return {
                                                        label: 'Padronização Ortográfica',
                                                        className: 'bg-sky-50 text-sky-700 border-sky-200',
                                                        icon: Sparkles
                                                    };
                                                case 'EQUIVALENTE_ADMINISTRATIVO':
                                                    return {
                                                        label: 'Equivalente (Terceirizado)',
                                                        className: 'bg-indigo-50 text-indigo-700 border-indigo-200',
                                                        icon: Layers
                                                    };
                                                case 'DIFERENCA_CLINICA':
                                                    return {
                                                        label: 'Diferença Clínica Preservada',
                                                        className: 'bg-amber-50 text-amber-700 border-amber-200',
                                                        icon: ShieldCheck
                                                    };
                                                case 'DUPLICIDADE_IDENTICA':
                                                    return {
                                                        label: 'Duplicidade Idêntica Real',
                                                        className: 'bg-purple-50 text-purple-700 border-purple-200',
                                                        icon: GitMerge
                                                    };
                                                case 'JA_PADRONIZADO':
                                                default:
                                                    return {
                                                        label: 'Conforme / Padronizado',
                                                        className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                                                        icon: Check
                                                    };
                                            }
                                        })();
                                        const CategoryIcon = categoryBadge.icon;

                                        return (
                                            <tr 
                                                key={item.procedimento.id}
                                                className={`hover:bg-slate-50/70 transition-colors ${
                                                    item.isChanged ? 'bg-sky-50/15' : ''
                                                }`}
                                            >
                                                {/* Código */}
                                                <td className="py-3 px-4 font-black text-slate-700">
                                                    <span className="px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-lg text-xs font-mono font-bold">
                                                        {item.procedimento.code || '----'}
                                                    </span>
                                                </td>

                                                {/* Procedimento Atual */}
                                                <td className="py-3 px-4 font-bold text-slate-800">
                                                    <div className="flex flex-col gap-1">
                                                        <span className="text-[12px] leading-snug">
                                                            {item.procedimento.name}
                                                        </span>
                                                        {item.corrections.length > 0 && (
                                                            <div className="flex flex-wrap gap-1 mt-0.5">
                                                                {item.corrections.map((corr, idx) => (
                                                                    <span 
                                                                        key={idx}
                                                                        className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200"
                                                                    >
                                                                        {corr}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Nome Padronizado */}
                                                <td className="py-3 px-4">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-[12px] font-extrabold leading-snug ${
                                                            item.isChanged ? 'text-indigo-900' : 'text-slate-700'
                                                        }`}>
                                                            {item.standardizedName}
                                                        </span>
                                                        {item.isChanged && (
                                                            <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 text-[8.5px] font-black uppercase rounded shrink-0">
                                                                Proposta
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Análise Inteligente */}
                                                <td className="py-3 px-4">
                                                    <div className="flex flex-col gap-1">
                                                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-extrabold border w-fit ${categoryBadge.className}`}>
                                                            <CategoryIcon className="w-3 h-3 shrink-0" />
                                                            <span>{categoryBadge.label}</span>
                                                        </span>
                                                        {item.clinicalDifferenceReason && (
                                                            <span className="text-[10px] text-slate-500 font-medium leading-tight line-clamp-2">
                                                                {item.clinicalDifferenceReason}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Ações */}
                                                <td className="py-3 px-4 text-right">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        {/* Botão Comparar (se houver procedimento equivalente/semelhante) */}
                                                        {item.equivalentTo && (
                                                            <button
                                                                type="button"
                                                                onClick={() => setComparingItem({ itemA: item, itemB: item.equivalentTo! })}
                                                                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10.5px] font-extrabold transition-all cursor-pointer border border-slate-200 shrink-0"
                                                                title="Comparar lado a lado com exame equivalente"
                                                            >
                                                                <Eye className="w-3.5 h-3.5" />
                                                            </button>
                                                        )}

                                                        {/* Botão Aplicar Padronização Individual */}
                                                        {item.isChanged ? (
                                                            <button
                                                                type="button"
                                                                disabled={isBusy}
                                                                onClick={() => handleApplySingleStandardization(item)}
                                                                className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 active:scale-95 text-white rounded-lg text-[11px] font-extrabold transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
                                                                title="Aplicar padronização neste procedimento"
                                                            >
                                                                {isBusy ? (
                                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                                ) : (
                                                                    <Check className="w-3.5 h-3.5" />
                                                                )}
                                                                <span>Aplicar</span>
                                                            </button>
                                                        ) : (
                                                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                                                                Padronizado
                                                            </span>
                                                        )}

                                                        {/* Botão Unificar (apenas se for duplicidade idêntica ou equivalente e estiver ativo) */}
                                                        {item.procedimento.status === 'Ativo' && item.equivalentTo && (item.category === 'DUPLICIDADE_IDENTICA' || item.category === 'EQUIVALENTE_ADMINISTRATIVO') && (() => {
                                                            const isItemTerceirizado = item.procedimento.name.toUpperCase().includes('TERCEIRIZADO') || item.procedimento.name.toUpperCase().includes('TERC');
                                                            const isEqTerceirizado = item.equivalentTo?.name.toUpperCase().includes('TERCEIRIZADO') || item.equivalentTo?.name.toUpperCase().includes('TERC');
                                                            const defaultPrimary = (isItemTerceirizado && !isEqTerceirizado) ? item.equivalentTo! : item.procedimento;
                                                            const defaultSecondary = (isItemTerceirizado && !isEqTerceirizado) ? item.procedimento : item.equivalentTo!;

                                                            return (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleOpenUnifyModal(defaultPrimary, defaultSecondary)}
                                                                    className="px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 active:scale-95 text-purple-700 rounded-lg text-[10.5px] font-extrabold transition-all cursor-pointer border border-purple-200 shrink-0 flex items-center gap-1 shadow-2xs hover:border-purple-300"
                                                                    title="Unificar este procedimento com seu equivalente"
                                                                >
                                                                    <GitMerge className="w-3.5 h-3.5" />
                                                                    <span>Unificar</span>
                                                                </button>
                                                            );
                                                        })()}

                                                        {item.procedimento.status === 'Inativo' && (
                                                            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-lg">
                                                                Inativo / Unificado
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* FOOTER INFORMATIVO */}
                <div className="px-6 py-3 border-t border-slate-200 bg-white shrink-0 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 font-medium">
                    <div className="flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 text-indigo-600 shrink-0" />
                        <span>
                            <strong>Regra de Integridade:</strong> Nenhum código, agendamento, fila ou especialista vinculado é excluído. Registros históricos são preservados com auditoria.
                        </span>
                    </div>

                    <div className="flex items-center gap-3">
                        <span className="text-[11px] font-bold text-slate-400">
                            Exibindo {filteredItems.length} de {analysisItems.length} ultrassons
                        </span>
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold rounded-xl transition-all cursor-pointer text-xs"
                        >
                            Fechar
                        </button>
                    </div>
                </div>

            </div>

            {/* ========================================================================= */}
            {/* SUB-MODAL 1: COMPARADOR LADO A LADO                                       */}
            {/* ========================================================================= */}
            {comparingItem && (
                <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
                    <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-2">
                                <Layers className="w-5 h-5 text-indigo-400" />
                                <h3 className="font-extrabold text-sm uppercase tracking-wider">Comparação Detalhada de Procedimentos</h3>
                            </div>
                            <button
                                onClick={() => setComparingItem(null)}
                                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1 space-y-6">
                            {/* Alerta de Recomendação da IA / Sistema */}
                            <div className={`p-4 rounded-2xl border flex items-start gap-3 ${
                                comparingItem.itemA.category === 'EQUIVALENTE_ADMINISTRATIVO'
                                    ? 'bg-indigo-50 border-indigo-200 text-indigo-900'
                                    : comparingItem.itemA.category === 'DIFERENCA_CLINICA'
                                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                                    : 'bg-purple-50 border-purple-200 text-purple-900'
                            }`}>
                                <Info className="w-5 h-5 shrink-0 mt-0.5" />
                                <div className="text-xs">
                                    <strong className="block text-sm font-black mb-1">
                                        Diagnóstico do Sistema: {comparingItem.itemA.categoryLabel}
                                    </strong>
                                    <p className="leading-relaxed">
                                        {comparingItem.itemA.clinicalDifferenceReason}
                                    </p>
                                </div>
                            </div>

                            {/* Grid Comparativo dos Dois Procedimentos */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Procedimento A */}
                                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Procedimento A</span>
                                        <span className="px-2 py-0.5 bg-slate-200 rounded font-mono text-xs font-bold text-slate-800">
                                            Cód. {comparingItem.itemA.procedimento.code || '----'}
                                        </span>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase">Nome Atual</label>
                                        <p className="text-sm font-black text-slate-900 leading-snug">{comparingItem.itemA.procedimento.name}</p>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase">Nome Padronizado</label>
                                        <p className="text-xs font-black text-indigo-900">{comparingItem.itemA.standardizedName}</p>
                                    </div>
                                    <div className="pt-2 border-t border-slate-200 text-xs space-y-1.5 text-slate-600 font-semibold">
                                        <div className="flex justify-between">
                                            <span>Modalidade:</span>
                                            <span className="font-bold text-slate-800">{comparingItem.itemA.isTerceirizado ? 'Terceirizado' : 'Próprio'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Status:</span>
                                            <span className="font-bold text-emerald-700">{comparingItem.itemA.procedimento.status}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Procedimento B */}
                                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Procedimento B (Equivalente)</span>
                                        <span className="px-2 py-0.5 bg-slate-200 rounded font-mono text-xs font-bold text-slate-800">
                                            Cód. {comparingItem.itemB.code || '----'}
                                        </span>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase">Nome Atual</label>
                                        <p className="text-sm font-black text-slate-900 leading-snug">{comparingItem.itemB.name}</p>
                                    </div>
                                    <div className="pt-2 border-t border-slate-200 text-xs space-y-1.5 text-slate-600 font-semibold">
                                        <div className="flex justify-between">
                                            <span>Tipo:</span>
                                            <span className="font-bold text-slate-800">{comparingItem.itemB.type}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Status:</span>
                                            <span className="font-bold text-emerald-700">{comparingItem.itemB.status}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="px-6 py-3 bg-slate-100 border-t border-slate-200 flex items-center justify-between shrink-0">
                            <span className="text-xs text-slate-500 font-semibold">
                                {comparingItem.itemA.category === 'EQUIVALENTE_ADMINISTRATIVO' 
                                    ? 'A indicação Terceirizado é mantida em registro separado.' 
                                    : 'Diferenças clínicas relevantes devem ser preservadas.'}
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setComparingItem(null)}
                                    className="px-4 py-2 bg-white hover:bg-slate-200 border border-slate-300 rounded-xl text-xs font-bold text-slate-700"
                                >
                                    Manter Procedimentos Separados
                                </button>
                                {(comparingItem.itemA.category === 'DUPLICIDADE_IDENTICA' || comparingItem.itemA.category === 'EQUIVALENTE_ADMINISTRATIVO') && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const isATerc = comparingItem.itemA.procedimento.name.toUpperCase().includes('TERC');
                                            const isBTerc = comparingItem.itemB.name.toUpperCase().includes('TERC');
                                            const prim = (isATerc && !isBTerc) ? comparingItem.itemB : comparingItem.itemA.procedimento;
                                            const sec = (isATerc && !isBTerc) ? comparingItem.itemA.procedimento : comparingItem.itemB;
                                            handleOpenUnifyModal(prim, sec);
                                        }}
                                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 active:scale-95 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-md cursor-pointer transition-all"
                                    >
                                        <GitMerge className="w-4 h-4" />
                                        <span>Prosseguir para Unificação</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* SUB-MODAL 2: PRÉVIA E CONFIRMAÇÃO DE PADRONIZAÇÃO EM LOTE                 */}
            {/* ========================================================================= */}
            {isBatchModalOpen && (
                <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
                    <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
                        <div className="px-6 py-4 bg-gradient-to-r from-sky-600 to-indigo-700 text-white flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-2">
                                <Sparkles className="w-5 h-5 text-amber-300" />
                                <h3 className="font-extrabold text-sm uppercase tracking-wider">Prévia da Padronização em Lote</h3>
                            </div>
                            <button
                                onClick={() => setIsBatchModalOpen(false)}
                                className="p-1.5 text-sky-200 hover:text-white rounded-lg hover:bg-white/10"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1 space-y-4">
                            <div className="p-4 bg-sky-50 border border-sky-200 rounded-2xl text-xs text-sky-900 leading-relaxed">
                                <strong className="block font-bold text-sky-950 mb-1">Confirmação de Padronização Ortográfica e Nomenclatura</strong>
                                Serão atualizados apenas os procedimentos de ultrassom selecionados abaixo. Nenhum código de procedimento, cota de vaga, agendamento de paciente ou vínculo de especialista será modificado ou perdido.
                            </div>

                            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                                <span className="text-xs font-extrabold text-slate-700 uppercase">
                                    Procedimentos Selecionados ({Object.values(selectedBatchIds).filter(Boolean).length})
                                </span>
                                <div className="flex items-center gap-2 text-xs font-bold text-indigo-600">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const allSel: Record<string, boolean> = {};
                                            analysisItems.forEach(i => { if (i.isChanged) allSel[i.procedimento.id] = true; });
                                            setSelectedBatchIds(allSel);
                                        }}
                                        className="hover:underline cursor-pointer"
                                    >
                                        Marcar Todos
                                    </button>
                                    <span>•</span>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedBatchIds({})}
                                        className="hover:underline cursor-pointer"
                                    >
                                        Desmarcar Todos
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                                {analysisItems.filter(i => i.isChanged).map(item => {
                                    const isChecked = !!selectedBatchIds[item.procedimento.id];
                                    return (
                                        <label 
                                            key={item.procedimento.id}
                                            className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-colors ${
                                                isChecked ? 'bg-sky-50/40 border-sky-300' : 'bg-slate-50 border-slate-200 opacity-60'
                                            }`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={isChecked}
                                                onChange={(e) => {
                                                    const checked = e.target.checked;
                                                    setSelectedBatchIds(prev => ({ ...prev, [item.procedimento.id]: checked }));
                                                }}
                                                className="w-4 h-4 mt-0.5 rounded text-sky-600 focus:ring-sky-500 border-slate-300 cursor-pointer"
                                            />
                                            <div className="flex-1 text-xs">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <span className="font-mono font-bold text-slate-700 bg-white px-1.5 py-0.5 rounded border border-slate-200 text-[10px]">
                                                        {item.procedimento.code || '----'}
                                                    </span>
                                                    <span className="text-slate-400 line-through font-semibold">{item.procedimento.name}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <ArrowRight className="w-3 h-3 text-sky-600 shrink-0" />
                                                    <span className="font-extrabold text-slate-900">{item.standardizedName}</span>
                                                </div>
                                            </div>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="px-6 py-4 bg-slate-100 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
                            <button
                                type="button"
                                onClick={() => setIsBatchModalOpen(false)}
                                className="px-4 py-2 bg-white hover:bg-slate-200 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                disabled={loadingAction === 'batch-exec' || Object.values(selectedBatchIds).filter(Boolean).length === 0}
                                onClick={handleConfirmBatch}
                                className="px-5 py-2.5 bg-gradient-to-r from-sky-600 to-indigo-700 hover:from-sky-700 hover:to-indigo-800 text-white rounded-xl text-xs font-extrabold uppercase tracking-wider flex items-center gap-2 shadow-md cursor-pointer disabled:opacity-50"
                            >
                                {loadingAction === 'batch-exec' ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span>Aplicando Padronização...</span>
                                    </>
                                ) : (
                                    <>
                                        <Check className="w-4 h-4" />
                                        <span>Confirmar Padronização ({Object.values(selectedBatchIds).filter(Boolean).length})</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* SUB-MODAL 3: UNIFICAÇÃO SEGURA COM VERIFICAÇÃO DE IMPACTO                  */}
            {/* ========================================================================= */}
            {unifyTarget && (
                <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
                    <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="px-6 py-4 bg-purple-900 text-white flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-2">
                                <GitMerge className="w-5 h-5 text-purple-300" />
                                <h3 className="font-extrabold text-sm uppercase tracking-wider">Unificação Segura de Procedimento</h3>
                            </div>
                            <button
                                onClick={() => setUnifyTarget(null)}
                                className="p-1.5 text-purple-300 hover:text-white rounded-lg hover:bg-white/10"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1 space-y-4">
                            <div className="p-3.5 bg-purple-50 border border-purple-200 rounded-2xl text-xs text-purple-900 leading-relaxed">
                                <strong className="block font-bold text-purple-950 mb-1">Atenção Administrativa</strong>
                                O procedimento secundário será consolidado no procedimento principal. O código histórico permanecerá registrado para consultas e auditoria, sem exclusão física de dados.
                            </div>

                            {/* Controles de Inversão de Papel */}
                            <div className="flex items-center justify-between pt-1">
                                <span className="text-xs font-black uppercase tracking-wider text-slate-600">
                                    Definição dos Papéis da Unificação:
                                </span>
                                <button
                                    type="button"
                                    onClick={handleSwapUnifyRoles}
                                    className="px-3 py-1.5 bg-purple-100 hover:bg-purple-200 active:scale-95 text-purple-800 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer border border-purple-300 shadow-2xs"
                                    title="Inverter qual procedimento será mantido como Principal e qual será unificado como Secundário"
                                >
                                    <ArrowLeftRight className="w-3.5 h-3.5 text-purple-700" />
                                    <span>Inverter Principal / Secundário</span>
                                </button>
                            </div>

                            {/* Resumo dos Procedimentos */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="p-4 bg-emerald-50/80 border-2 border-emerald-400/80 rounded-2xl text-xs space-y-1.5 relative shadow-xs">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 bg-emerald-200/70 px-2 py-0.5 rounded-md">
                                            ✓ Procedimento Principal (Permanece Ativo)
                                        </span>
                                    </div>
                                    <span className="font-black text-slate-900 block text-sm leading-tight pt-1">{unifyTarget.primary.name}</span>
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-[11px] text-emerald-800 font-bold bg-white px-2 py-0.5 rounded border border-emerald-200">
                                            Cód. {unifyTarget.primary.code || '----'}
                                        </span>
                                        <span className="text-[10px] font-bold text-emerald-700">Tipo: {unifyTarget.primary.type}</span>
                                    </div>
                                    {unifyTarget.impactPrimary && (
                                        <div className="text-[11px] text-slate-600 pt-2 border-t border-emerald-200/60 font-semibold space-y-0.5">
                                            <div>Vagas Ativas: <strong className="text-slate-900">{unifyTarget.impactPrimary.vagasCount}</strong></div>
                                            <div>Agendamentos: <strong className="text-slate-900">{unifyTarget.impactPrimary.agendamentosCount}</strong></div>
                                            <div>Especialistas: <strong className="text-slate-900">{unifyTarget.impactPrimary.especialistasCount}</strong></div>
                                        </div>
                                    )}
                                </div>

                                <div className="p-4 bg-purple-50/80 border-2 border-purple-400/80 rounded-2xl text-xs space-y-1.5 relative shadow-xs">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-black uppercase tracking-wider text-purple-800 bg-purple-200/70 px-2 py-0.5 rounded-md">
                                            ⚡ Procedimento Secundário (Será Inativado)
                                        </span>
                                    </div>
                                    <span className="font-black text-slate-900 block text-sm leading-tight pt-1">{unifyTarget.secondary.name}</span>
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-[11px] text-purple-800 font-bold bg-white px-2 py-0.5 rounded border border-purple-200">
                                            Cód. {unifyTarget.secondary.code || '----'}
                                        </span>
                                        <span className="text-[10px] font-bold text-purple-700">Tipo: {unifyTarget.secondary.type}</span>
                                    </div>
                                    {unifyTarget.impactSecondary && (
                                        <div className="text-[11px] text-slate-600 pt-2 border-t border-purple-200/60 font-semibold space-y-0.5">
                                            <div>Vagas a Migrar: <strong className="text-purple-900">{unifyTarget.impactSecondary.vagasCount}</strong></div>
                                            <div>Agendamentos a Migrar: <strong className="text-purple-900">{unifyTarget.impactSecondary.agendamentosCount}</strong></div>
                                            <div>Especialistas Vinculados: <strong className="text-purple-900">{unifyTarget.impactSecondary.especialistasCount}</strong></div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Campo de Justificativa */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                                    Justificativa da Unificação (Pré-preenchida para Auditoria):
                                </label>
                                <textarea
                                    rows={3}
                                    value={unifyJustification}
                                    onChange={(e) => setUnifyJustification(e.target.value)}
                                    placeholder="Justificativa da unificação..."
                                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs font-semibold text-slate-800 focus:outline-none focus:border-purple-500 focus:bg-white transition-all shadow-inner"
                                />
                                <span className="text-[10px] text-slate-400 block mt-1">
                                    Esta justificativa ficará salva no histórico de auditoria do sistema.
                                </span>
                            </div>
                        </div>

                        <div className="px-6 py-4 bg-slate-100 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
                            <button
                                type="button"
                                onClick={() => setUnifyTarget(null)}
                                className="px-4 py-2 bg-white hover:bg-slate-200 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 cursor-pointer transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                disabled={loadingAction === 'unify-exec'}
                                onClick={handleConfirmUnify}
                                className="px-5 py-2.5 bg-purple-700 hover:bg-purple-800 active:scale-95 text-white rounded-xl text-xs font-extrabold uppercase tracking-wider flex items-center gap-2 shadow-md cursor-pointer disabled:opacity-50 transition-all"
                            >
                                {loadingAction === 'unify-exec' ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span>Unificando com Segurança...</span>
                                    </>
                                ) : (
                                    <>
                                        <GitMerge className="w-4 h-4" />
                                        <span>Confirmar Unificação</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
