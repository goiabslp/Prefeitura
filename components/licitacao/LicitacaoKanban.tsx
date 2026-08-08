import React, { useState, useMemo, useEffect } from 'react';
import { 
    ArrowLeft, Search, Filter, Calendar, AlertTriangle, CheckCircle2, 
    FileText, User as UserIcon, Building2, ChevronRight, ChevronLeft, 
    Sparkles, Gavel, ArrowRightLeft, Eye, Clock, ShieldAlert,
    Paperclip, Package, Tag, Scale, Landmark, Megaphone, CheckSquare,
    AlertCircle, Award, FileCheck, Layers, Tv, MoreHorizontal, MoreVertical,
    Zap, X, Maximize2, Radio, Check, RefreshCw
} from 'lucide-react';
import { User } from '../../types';
import { LicitacaoProcesso } from '../../types/licitacao';
import { useLicitacaoProcesses, useUpdateLicitacaoProcess } from '../../hooks/useLicitacaoModule';
import { LicitacaoWizard } from './LicitacaoWizard';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface LicitacaoKanbanProps {
    currentUser: User;
    onBack: () => void;
    isViewOnly?: boolean;
}

export interface PhaseConfig {
    id: string;
    label: string;
    description: string;
    badgeColor: string;
    borderTopColor: string;
    columnBg: string;
    icon: React.ElementType;
}

export const LICITACAO_PHASES: PhaseConfig[] = [
    {
        id: 'sem_fase',
        label: 'Em Triagem / Inicial',
        description: 'Processos recém-criados aguardando definição de fase',
        badgeColor: 'bg-slate-100 text-slate-700 border-slate-200',
        borderTopColor: 'border-t-slate-400',
        columnBg: 'bg-slate-50/70',
        icon: Layers
    },
    {
        id: 'preparatoria',
        label: 'Preparatória',
        description: 'Elaboração de TR, ETP, Pesquisa de Preços e Minuta de Edital',
        badgeColor: 'bg-indigo-100 text-indigo-700 border-indigo-200',
        borderTopColor: 'border-t-indigo-500',
        columnBg: 'bg-indigo-50/40',
        icon: FileText
    },
    {
        id: 'objeto_cotacao',
        label: 'Objeto e Cotação',
        description: 'Definição detalhada do objeto e cotação de preços',
        badgeColor: 'bg-purple-100 text-purple-700 border-purple-200',
        borderTopColor: 'border-t-purple-500',
        columnBg: 'bg-purple-50/40',
        icon: Tag
    },
    {
        id: 'autuacao_divulgacao',
        label: 'Autuação e Divulgação',
        description: 'Registro oficial do processo e publicação do edital',
        badgeColor: 'bg-blue-100 text-blue-700 border-blue-200',
        borderTopColor: 'border-t-blue-500',
        columnBg: 'bg-blue-50/40',
        icon: Megaphone
    },
    {
        id: 'propostas',
        label: 'Propostas / Lances',
        description: 'Recebimento de propostas e disputa de lances',
        badgeColor: 'bg-amber-100 text-amber-700 border-amber-200',
        borderTopColor: 'border-t-amber-500',
        columnBg: 'bg-amber-50/40',
        icon: Tag
    },
    {
        id: 'julgamento_habilitacao',
        label: 'Julgamento e Habilitação',
        description: 'Análise das propostas, lances e documentos de habilitação',
        badgeColor: 'bg-violet-100 text-violet-700 border-violet-200',
        borderTopColor: 'border-t-violet-500',
        columnBg: 'bg-violet-50/40',
        icon: Scale
    },
    {
        id: 'recursos',
        label: 'Recursos',
        description: 'Prazo recursal e análise de impugnações/recursos',
        badgeColor: 'bg-orange-100 text-orange-700 border-orange-200',
        borderTopColor: 'border-t-orange-500',
        columnBg: 'bg-orange-50/40',
        icon: AlertCircle
    },
    {
        id: 'homologacao_adjudicacao',
        label: 'Homologação e Adjudicação',
        description: 'Homologação do resultado e adjudicação do objeto',
        badgeColor: 'bg-teal-100 text-teal-700 border-teal-200',
        borderTopColor: 'border-t-teal-500',
        columnBg: 'bg-teal-50/40',
        icon: Award
    },
    {
        id: 'finalizado',
        label: 'Finalizado',
        description: 'Processo concluído e assinado',
        badgeColor: 'bg-emerald-100 text-emerald-700 border-emerald-200',
        borderTopColor: 'border-t-emerald-500',
        columnBg: 'bg-emerald-50/40',
        icon: CheckCircle2
    }
];

export const LicitacaoKanban: React.FC<LicitacaoKanbanProps> = ({ currentUser, onBack, isViewOnly = false }) => {
    const { data: processes = [], isLoading } = useLicitacaoProcesses();
    const updateMutation = useUpdateLicitacaoProcess();

    const [searchTerm, setSearchTerm] = useState('');
    const [priorityFilter, setPriorityFilter] = useState<string>('Todas');
    const [sectorFilter, setSectorFilter] = useState<string>('Todos');

    const [draggedId, setDraggedId] = useState<string | null>(null);
    const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
    const [selectedProcessForDetails, setSelectedProcessForDetails] = useState<LicitacaoProcesso | null>(null);

    const [openPhaseMenu, setOpenPhaseMenu] = useState<string | null>(null);
    const [openCardMenu, setOpenCardMenu] = useState<string | null>(null);
    const [isTransitioning, setIsTransitioning] = useState(false);

    const [activePriority, setActivePriority] = useState<{ type: 'process' | 'phase'; processId?: string; phaseId?: string; timestamp: number } | null>(() => {
        try {
            const saved = localStorage.getItem('licitacao_prioridade_visual');
            return saved ? JSON.parse(saved) : null;
        } catch {
            return null;
        }
    });

    useEffect(() => {
        const handleSync = () => {
            try {
                const saved = localStorage.getItem('licitacao_prioridade_visual');
                const parsed = saved ? JSON.parse(saved) : null;
                setIsTransitioning(true);
                setActivePriority(parsed);
                setTimeout(() => setIsTransitioning(false), 2000);
            } catch (e) {
                console.error('Erro ao sincronizar prioridade visual:', e);
            }
        };

        window.addEventListener('storage', handleSync);
        window.addEventListener('licitacao-priority-updated', handleSync);

        return () => {
            window.removeEventListener('storage', handleSync);
            window.removeEventListener('licitacao-priority-updated', handleSync);
        };
    }, []);

    const [showPriorityToast, setShowPriorityToast] = useState(false);

    const triggerVisualPriority = (type: 'process' | 'phase', id: string) => {
        const payload = {
            type,
            ...(type === 'process' ? { processId: id } : { phaseId: id }),
            timestamp: Date.now()
        };
        localStorage.setItem('licitacao_prioridade_visual', JSON.stringify(payload));
        window.dispatchEvent(new CustomEvent('licitacao-priority-updated'));
        setOpenPhaseMenu(null);
        setOpenCardMenu(null);

        if (!isViewOnly) {
            setShowPriorityToast(true);
            setTimeout(() => setShowPriorityToast(false), 3500);
        }
    };

    const handleClearPriority = () => {
        localStorage.removeItem('licitacao_prioridade_visual');
        window.dispatchEvent(new CustomEvent('licitacao-priority-updated'));
    };

    const availableSectors = useMemo(() => {
        const set = new Set<string>();
        processes.forEach(p => {
            if (p.solicitante_setor) set.add(p.solicitante_setor);
        });
        return Array.from(set).sort();
    }, [processes]);

    const filteredProcesses = useMemo(() => {
        return processes.filter(process => {
            const term = searchTerm.toLowerCase().trim();
            const matchesSearch = !term || 
                process.finalidade?.toLowerCase().includes(term) ||
                process.protocolo?.toLowerCase().includes(term) ||
                process.solicitante_nome?.toLowerCase().includes(term) ||
                process.solicitante_setor?.toLowerCase().includes(term);

            const matchesPriority = priorityFilter === 'Todas' || process.prioridade === priorityFilter;
            const matchesSector = sectorFilter === 'Todos' || process.solicitante_setor === sectorFilter;

            const isCreator = process.criado_por === currentUser.id;
            const orderSector = process.solicitante_setor || '';
            const userSector = currentUser.sector || '';
            const isSameSector = userSector !== '' && orderSector.trim().toLowerCase() === userSector.trim().toLowerCase();
            const isLicitacaoUser = currentUser.role === 'licitacao';
            const isAdmin = currentUser.role === 'admin';

            let hasPermission = isViewOnly || isAdmin || isLicitacaoUser || isCreator || isSameSector;
            if (!isViewOnly && isLicitacaoUser && !isAdmin && !isCreator && !isSameSector) {
                if (process.status !== 'Concluído') {
                    hasPermission = false;
                }
            }

            return matchesSearch && matchesPriority && matchesSector && hasPermission;
        });
    }, [processes, searchTerm, priorityFilter, sectorFilter, currentUser, isViewOnly]);

    const processesByPhase = useMemo(() => {
        const grouped: Record<string, LicitacaoProcesso[]> = {};
        LICITACAO_PHASES.forEach(phase => {
            grouped[phase.id] = [];
        });

        filteredProcesses.forEach(process => {
            let currentPhase = process.fase ? process.fase.toLowerCase() : 'sem_fase';
            if (currentPhase === 'autuacao' || currentPhase === 'divulgacao') {
                currentPhase = 'autuacao_divulgacao';
            } else if (currentPhase === 'julgamento' || currentPhase === 'habilitacao') {
                currentPhase = 'julgamento_habilitacao';
            } else if (currentPhase === 'homologacao' || currentPhase === 'adjudicacao') {
                currentPhase = 'homologacao_adjudicacao';
            }
            if (grouped[currentPhase]) {
                grouped[currentPhase].push(process);
            } else {
                grouped['sem_fase'].push(process);
            }
        });

        return grouped;
    }, [filteredProcesses]);

    const stats = useMemo(() => {
        const total = filteredProcesses.length;
        const urgentes = filteredProcesses.filter(p => p.prioridade === 'Urgente').length;
        const finalizados = filteredProcesses.filter(p => p.fase === 'finalizado' || p.status === 'Concluído').length;
        const emAndamento = total - finalizados;
        return { total, urgentes, emAndamento, finalizados };
    }, [filteredProcesses]);

    const handleMovePhase = async (processId: string, newPhaseId: string) => {
        try {
            const phaseValue = newPhaseId === 'sem_fase' ? null : newPhaseId;
            let statusUpdate: any = undefined;

            if (newPhaseId === 'finalizado') {
                statusUpdate = 'Concluído';
            }

            await updateMutation.mutateAsync({
                id: processId,
                updates: {
                    fase: phaseValue as any,
                    ...(statusUpdate ? { status: statusUpdate } : {})
                }
            });
        } catch (error) {
            console.error('Erro ao atualizar fase da licitação:', error);
        }
    };

    const handleDragStart = (e: React.DragEvent, id: string) => {
        e.dataTransfer.setData('text/plain', id);
        setDraggedId(id);
    };

    const handleDragOver = (e: React.DragEvent, phaseId: string) => {
        e.preventDefault();
        if (dragOverColumn !== phaseId) {
            setDragOverColumn(phaseId);
        }
    };

    const handleDragLeave = () => {
        setDragOverColumn(null);
    };

    const handleDrop = async (e: React.DragEvent, targetPhaseId: string) => {
        e.preventDefault();
        setDragOverColumn(null);
        const processId = e.dataTransfer.getData('text/plain') || draggedId;
        if (processId) {
            await handleMovePhase(processId, targetPhaseId);
        }
        setDraggedId(null);
    };

    const isCanManage = !isViewOnly && (currentUser.role === 'admin' || currentUser.role === 'licitacao' || currentUser.permissions?.includes('parent_licitacao_processos'));

    const getDaysElapsed = (createdAtStr?: string) => {
        if (!createdAtStr) return '0 dias';
        const createdDate = new Date(createdAtStr);
        if (isNaN(createdDate.getTime())) return '0 dias';
        const now = new Date();
        const diffTime = Math.max(0, now.getTime() - createdDate.getTime());
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays === 0) return 'Hoje';
        if (diffDays === 1) return '1 dia';
        return `${diffDays} dias`;
    };

    if (isViewOnly && activePriority) {
        if (activePriority.type === 'process' && activePriority.processId) {
            const priorityProcess = processes.find(p => p.id === activePriority.processId);
            if (priorityProcess) {
                const daysElapsed = getDaysElapsed(priorityProcess.criado_em);
                const currentPhaseObj = LICITACAO_PHASES.find(p => p.id === (priorityProcess.fase || 'sem_fase')) || LICITACAO_PHASES[0];
                const PhaseIcon = currentPhaseObj.icon;

                return (
                    <div className={`flex-1 flex flex-col bg-[#F8FAFC] text-slate-900 h-full overflow-hidden relative z-30 transition-all duration-[2000ms] ease-in-out ${
                        isTransitioning ? 'opacity-0 scale-95 filter blur-sm' : 'opacity-100 scale-100 filter blur-0'
                    }`}>
                        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-xs shrink-0 z-20">
                            <div className="flex items-center gap-3">
                                <span className="px-4 py-1.5 rounded-full text-xs 2xl:text-sm font-black bg-amber-50 text-amber-800 border border-amber-300 flex items-center gap-2 animate-pulse shadow-xs">
                                    <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
                                    MODO PRIORIDADE VISUAL DA SALA
                                </span>
                                <span className="text-xs text-slate-500 font-medium hidden md:inline">
                                    Transmissão Contínua em Tempo Real
                                </span>
                            </div>

                            <button
                                onClick={handleClearPriority}
                                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-700 text-xs 2xl:text-sm font-bold flex items-center gap-2 border border-slate-200 transition-all cursor-pointer shadow-xs"
                                title="Voltar ao Kanban Geral da Sala"
                            >
                                <X className="w-4 h-4 text-slate-500 hover:text-rose-600" />
                                Fechar Prioridade
                            </button>
                        </header>

                        <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-6 2xl:space-y-8 max-w-7xl mx-auto w-full">
                            <div className="bg-white border border-slate-200/90 rounded-3xl p-6 md:p-8 shadow-xl relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                                <div className="space-y-3.5 z-10 flex-1">
                                    <div className="flex flex-wrap items-center gap-3">
                                        <span className="font-mono text-xl md:text-2xl 2xl:text-3xl font-black text-indigo-700 bg-indigo-50 px-4 py-1.5 rounded-2xl border border-indigo-200/80 tracking-wider">
                                            #{priorityProcess.protocolo || priorityProcess.id.slice(0, 8)}
                                        </span>
                                        <span className={`px-4 py-1.5 rounded-xl text-xs md:text-sm font-bold border flex items-center gap-2 ${currentPhaseObj.badgeColor}`}>
                                            <PhaseIcon className="w-4 h-4" />
                                            {currentPhaseObj.label}
                                        </span>
                                        <span className="px-4 py-1.5 rounded-xl text-xs md:text-sm font-black bg-amber-50 text-amber-800 border border-amber-200/80 flex items-center gap-1.5">
                                            <Clock className="w-4 h-4 text-amber-600" />
                                            {daysElapsed} decorridos
                                        </span>
                                    </div>

                                    <h1 className="text-2xl md:text-3xl 2xl:text-4xl font-black text-slate-900 leading-tight">
                                        {priorityProcess.finalidade}
                                    </h1>
                                </div>

                                <div className="bg-slate-50 border border-slate-200 p-4 2xl:p-5 rounded-2xl flex items-center gap-4 shrink-0 shadow-xs min-w-[260px]">
                                    <div className="w-12 h-12 rounded-2xl bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-600">
                                        <UserIcon className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 block">Responsável</span>
                                        <h4 className="font-bold text-slate-800 text-sm md:text-base">{priorityProcess.solicitante_nome}</h4>
                                        <span className="text-xs text-indigo-600 font-medium block mt-0.5">{priorityProcess.solicitante_setor}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="md:col-span-2 space-y-6">
                                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-md space-y-3">
                                        <h3 className="text-xs 2xl:text-sm font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                            <FileText className="w-4 h-4 text-indigo-600" />
                                            Objeto e Finalidade Detalhada
                                        </h3>
                                        <p className="text-sm md:text-base 2xl:text-lg text-slate-700 leading-relaxed font-medium">
                                            {priorityProcess.finalidade || 'Sem descrição detalhada cadastrada.'}
                                        </p>
                                    </div>

                                    {priorityProcess.justificativa?.texto && (
                                        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-md space-y-3">
                                            <h3 className="text-xs 2xl:text-sm font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                                <AlertCircle className="w-4 h-4 text-amber-600" />
                                                Justificativa da Solicitação
                                            </h3>
                                            <p className="text-sm md:text-base text-slate-600 leading-relaxed whitespace-pre-line font-medium">
                                                {priorityProcess.justificativa.texto}
                                            </p>
                                        </div>
                                    )}

                                    {priorityProcess.documentos && priorityProcess.documentos.length > 0 && (
                                        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-md space-y-4">
                                            <h3 className="text-xs 2xl:text-sm font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                                <Paperclip className="w-4 h-4 text-emerald-600" />
                                                Documentos Anexados ({priorityProcess.documentos.length})
                                            </h3>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                {priorityProcess.documentos.map((doc, idx) => (
                                                    <div key={idx} className="bg-slate-50 border border-slate-200 p-3 rounded-xl flex items-center gap-3 text-xs text-slate-700">
                                                        <FileText className="w-4 h-4 text-indigo-600 shrink-0" />
                                                        <span className="truncate font-medium">{doc.nome_documento || (doc as any).name || `Documento ${idx + 1}`}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-6">
                                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-md space-y-4">
                                        <h3 className="text-xs 2xl:text-sm font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                            <Tag className="w-4 h-4 text-indigo-600" />
                                            Informações do Processo
                                        </h3>

                                        <div className="space-y-3 divide-y divide-slate-100">
                                            <div className="pt-2 flex justify-between items-center text-xs md:text-sm">
                                                <span className="text-slate-500 font-medium">Prioridade</span>
                                                <span className="font-bold text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded border border-rose-200">
                                                    {priorityProcess.prioridade || 'Normal'}
                                                </span>
                                            </div>
                                            <div className="pt-3 flex justify-between items-center text-xs md:text-sm">
                                                <span className="text-slate-500 font-medium">Data de Criação</span>
                                                <span className="font-semibold text-slate-800">
                                                    {priorityProcess.criado_em ? format(new Date(priorityProcess.criado_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : '-'}
                                                </span>
                                            </div>
                                            {priorityProcess.ficha_orcamentaria && (
                                                <div className="pt-3 flex justify-between items-center text-xs md:text-sm">
                                                    <span className="text-slate-500 font-medium">Ficha Orçamentária</span>
                                                    <span className="font-mono text-emerald-700 font-bold">{priorityProcess.ficha_orcamentaria}</span>
                                                </div>
                                            )}
                                            {priorityProcess.resolucao_numero && (
                                                <div className="pt-3 flex justify-between items-center text-xs md:text-sm">
                                                    <span className="text-slate-500 font-medium">Resolução</span>
                                                    <span className="font-mono text-indigo-700 font-bold">{priorityProcess.resolucao_numero}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            }
        } else if (activePriority.type === 'phase' && activePriority.phaseId) {
            const phaseObj = LICITACAO_PHASES.find(p => p.id === activePriority.phaseId) || LICITACAO_PHASES[0];
            const phaseProcesses = processesByPhase[phaseObj.id] || [];
            const PhaseIcon = phaseObj.icon;

            return (
                <div className={`flex-1 flex flex-col bg-[#F8FAFC] text-slate-900 h-full overflow-hidden relative z-30 transition-all duration-[2000ms] ease-in-out ${
                    isTransitioning ? 'opacity-0 scale-95 filter blur-sm' : 'opacity-100 scale-100 filter blur-0'
                }`}>
                    <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-xs shrink-0 z-20">
                        <div className="flex items-center gap-3">
                            <span className="px-4 py-1.5 rounded-full text-xs 2xl:text-sm font-black bg-amber-50 text-amber-800 border border-amber-300 flex items-center gap-2 animate-pulse">
                                <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
                                FASE EM PRIORIDADE VISUAL DA SALA
                            </span>
                            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <PhaseIcon className="w-5 h-5 text-indigo-600" />
                                {phaseObj.label}
                            </h2>
                        </div>

                        <button
                            onClick={handleClearPriority}
                            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-700 text-xs 2xl:text-sm font-bold flex items-center gap-2 border border-slate-200 transition-all cursor-pointer shadow-xs"
                        >
                            <X className="w-4 h-4 text-slate-500" />
                            Fechar Prioridade
                        </button>
                    </header>

                    <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-4 max-w-7xl mx-auto w-full">
                        <p className="text-sm text-slate-500 font-medium">
                            Exibindo todos os <strong>{phaseProcesses.length}</strong> processos em andamento nesta fase:
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {phaseProcesses.map(proc => (
                                <div key={proc.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-md flex flex-col gap-3">
                                    <div className="flex items-center justify-between">
                                        <span className="font-mono text-sm font-bold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-200">
                                            #{proc.protocolo || proc.id.slice(0, 8)}
                                        </span>
                                        <span className="text-xs font-bold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 flex items-center gap-1">
                                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                                            {getDaysElapsed(proc.criado_em)}
                                        </span>
                                    </div>
                                    <h4 className="font-bold text-slate-900 text-base line-clamp-2">{proc.finalidade}</h4>
                                    <div className="text-xs text-slate-500 border-t border-slate-100 pt-3 flex justify-between items-center">
                                        <span className="font-semibold text-slate-700">{proc.solicitante_nome}</span>
                                        <span className="text-indigo-600 font-medium">{proc.solicitante_setor}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            );
        }
    }

    if (selectedProcessForDetails) {
        return (
            <LicitacaoWizard
                currentUser={currentUser}
                initialData={{
                    id: selectedProcessForDetails.id,
                    protocol: selectedProcessForDetails.protocolo,
                    title: selectedProcessForDetails.finalidade,
                    status: selectedProcessForDetails.status,
                    createdAt: selectedProcessForDetails.criado_em,
                    userId: selectedProcessForDetails.criado_por,
                    userName: selectedProcessForDetails.solicitante_nome,
                    blockType: 'licitacao',
                    documentos: selectedProcessForDetails.documentos || [],
                    documentSnapshot: {
                        content: {
                            objeto: selectedProcessForDetails.finalidade,
                            prioridade: selectedProcessForDetails.prioridade,
                            requesterName: selectedProcessForDetails.solicitante_nome,
                            requesterRole: selectedProcessForDetails.solicitante_cargo,
                            requesterSector: selectedProcessForDetails.solicitante_setor,
                            justificativa: selectedProcessForDetails.justificativa?.texto,
                            itens: selectedProcessForDetails.itens,
                            fase: selectedProcessForDetails.fase,
                            checkin_finalizado: selectedProcessForDetails.checkin_finalizado,
                            resolucaoDescricao: selectedProcessForDetails.resolucao_descricao,
                            resolucaoNumero: selectedProcessForDetails.resolucao_numero,
                            fichaOrcamentaria: selectedProcessForDetails.ficha_orcamentaria
                        }
                    }
                } as any}
                readOnly={true}
                onBack={() => setSelectedProcessForDetails(null)}
            />
        );
    }

    return (
        <div className="flex-1 flex flex-col font-sans bg-[#F8FAFC] h-full overflow-hidden relative z-10 animate-fade-in">
            {showPriorityToast && (
                <div className="fixed top-5 right-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
                    <Zap className="w-5 h-5 text-amber-400 fill-amber-400 animate-bounce shrink-0" />
                    <div>
                        <h5 className="font-bold text-xs">Prioridade Visual Transmitida!</h5>
                        <p className="text-[11px] text-slate-300">Exibindo agora na tela da sala (/Licitação/Kanban/view)</p>
                    </div>
                </div>
            )}

            <header className="bg-white border-b border-slate-200 px-6 py-3.5 shadow-xs shrink-0 z-20">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={onBack}
                            className="w-10 h-10 rounded-2xl bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 flex items-center justify-center text-slate-600 transition-all shadow-xs group cursor-pointer"
                            title="Voltar ao menu"
                        >
                            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
                        </button>
                        <div>
                            <div className="flex items-center gap-2.5">
                                <h1 className="text-2xl 2xl:text-3xl 3xl:text-4xl font-black text-slate-800 tracking-tight">Kanban de Licitações</h1>
                                {isViewOnly ? (
                                    <span className="px-3 py-1 2xl:px-4 2xl:py-1.5 rounded-full text-xs 2xl:text-sm 3xl:text-base font-black bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1.5 animate-pulse">
                                        <Tv className="w-3.5 h-3.5 2xl:w-4.5 2xl:h-4.5 text-emerald-600" />
                                        MODO VIEW (SALA)
                                    </span>
                                ) : (
                                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700 border border-indigo-200 flex items-center gap-1">
                                        <Sparkles className="w-3 h-3 text-indigo-600" />
                                        Acompanhamento Visual
                                    </span>
                                )}
                            </div>
                            <p className="text-xs 2xl:text-sm 3xl:text-base font-medium text-slate-500 mt-0.5">
                                {isViewOnly ? 'Exibição contínua em tempo real para telas e monitores de sala' : 'Gerencie e acompanhe a evolução dos processos pelas fases do edital'}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 2xl:gap-3 overflow-x-auto pb-1 md:pb-0 shrink-0">
                        <div className="bg-slate-50 border border-slate-200/80 px-3.5 py-1.5 2xl:px-4 2xl:py-2 rounded-xl text-center">
                            <span className="text-[10px] 2xl:text-xs 3xl:text-sm font-extrabold uppercase text-slate-400 block tracking-wider">Total</span>
                            <span className="text-base 2xl:text-xl 3xl:text-2xl font-black text-slate-800">{stats.total}</span>
                        </div>
                        <div className="bg-amber-50 border border-amber-200/80 px-3.5 py-1.5 2xl:px-4 2xl:py-2 rounded-xl text-center">
                            <span className="text-[10px] 2xl:text-xs 3xl:text-sm font-extrabold uppercase text-amber-600/80 block tracking-wider">Em Andamento</span>
                            <span className="text-base 2xl:text-xl 3xl:text-2xl font-black text-amber-700">{stats.emAndamento}</span>
                        </div>
                        <div className="bg-rose-50 border border-rose-200/80 px-3.5 py-1.5 2xl:px-4 2xl:py-2 rounded-xl text-center">
                            <span className="text-[10px] 2xl:text-xs 3xl:text-sm font-extrabold uppercase text-rose-600/80 block tracking-wider">Urgentes</span>
                            <span className="text-base 2xl:text-xl 3xl:text-2xl font-black text-rose-700">{stats.urgentes}</span>
                        </div>
                        <div className="bg-emerald-50 border border-emerald-200/80 px-3.5 py-1.5 2xl:px-4 2xl:py-2 rounded-xl text-center">
                            <span className="text-[10px] 2xl:text-xs 3xl:text-sm font-extrabold uppercase text-emerald-600/80 block tracking-wider">Finalizados</span>
                            <span className="text-base 2xl:text-xl 3xl:text-2xl font-black text-emerald-700">{stats.finalizados}</span>
                        </div>
                    </div>
                </div>
            </header>

            <div className={`flex-1 min-h-0 flex flex-col ${isViewOnly ? 'w-full h-full p-2 md:p-3 2xl:p-4 overflow-hidden' : 'overflow-x-auto p-4 md:p-6 scrollbar-thin scrollbar-thumb-slate-300'}`}>
                {isLoading ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3">
                        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                        <p className="font-bold text-sm">Carregando quadro Kanban...</p>
                    </div>
                ) : (
                    <div className={`h-full min-h-0 ${isViewOnly ? 'grid grid-cols-9 gap-2 2xl:gap-3.5 w-full items-stretch overflow-hidden' : 'flex gap-4 min-w-max items-start'}`}>
                        {LICITACAO_PHASES.map((phase, idx) => {
                            const columnProcesses = processesByPhase[phase.id] || [];
                            const IconComponent = phase.icon;
                            const isOver = dragOverColumn === phase.id;

                            return (
                                <div
                                    key={phase.id}
                                    onDragOver={(e) => handleDragOver(e, phase.id)}
                                    onDragLeave={handleDragLeave}
                                    onDrop={(e) => handleDrop(e, phase.id)}
                                    className={`flex flex-col h-full min-h-0 overflow-hidden rounded-2xl border border-slate-200/90 shadow-xs transition-all duration-200 ${phase.columnBg} ${phase.borderTopColor} border-t-4 ${
                                        isViewOnly ? 'w-full min-w-0' : 'w-[320px] max-h-full'
                                    } ${isOver ? 'ring-2 ring-indigo-500 ring-offset-2 bg-indigo-50/50' : ''}`}
                                >
                                    <div className={`border-b border-slate-700/60 bg-slate-900 backdrop-blur-md rounded-t-xl flex items-center justify-between sticky top-0 z-10 text-white shadow-xs ${
                                        isViewOnly ? 'h-[54px] min-h-[54px] 2xl:h-[62px] 2xl:min-h-[62px] px-1.5 2xl:px-2.5' : 'h-[58px] min-h-[58px] px-2.5 md:px-3'
                                    }`}>
                                        <div className="flex items-center gap-1 2xl:gap-1.5 min-w-0 flex-1 h-full py-1">
                                            <div className={`p-1 rounded-lg border shrink-0 ${phase.badgeColor}`}>
                                                <IconComponent className="w-3 h-3 2xl:w-4 2xl:h-4" />
                                            </div>
                                            <div className="min-w-0 flex-1 flex flex-col justify-center">
                                                <h3 className="font-extrabold text-white text-[10px] xl:text-[11px] 2xl:text-xs tracking-tight leading-[1.15] whitespace-normal break-words drop-shadow-xs">
                                                    {phase.label}
                                                </h3>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-1 relative shrink-0">
                                            <span className="px-1.5 py-0.5 2xl:px-2 rounded-full text-[10px] 2xl:text-[11px] font-black bg-slate-800 text-slate-100 border border-slate-700 shadow-inner">
                                                {columnProcesses.length}
                                            </span>

                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setOpenPhaseMenu(openPhaseMenu === phase.id ? null : phase.id);
                                                    setOpenCardMenu(null);
                                                }}
                                                className="w-6 h-6 rounded-md hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
                                                title="Opções da Fase"
                                            >
                                                <MoreHorizontal className="w-3.5 h-3.5" />
                                            </button>

                                            {openPhaseMenu === phase.id && (
                                                <div className="absolute right-0 top-7 z-50 w-44 bg-white border border-slate-200 shadow-xl rounded-xl p-1 text-slate-800 animate-in fade-in zoom-in-95">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            triggerVisualPriority('phase', phase.id);
                                                        }}
                                                        className="w-full text-left px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg flex items-center gap-2 cursor-pointer transition-colors"
                                                    >
                                                        <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                                                        Prioridade Visual
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="p-1.5 md:p-2 2xl:p-3 flex-1 overflow-y-auto space-y-1.5 2xl:space-y-2.5 min-h-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                                        {columnProcesses.length === 0 ? (
                                            <div className="h-20 2xl:h-28 border-2 border-dashed border-slate-200/80 rounded-xl flex flex-col items-center justify-center text-slate-400 p-2 text-center">
                                                <p className="text-[10px] 2xl:text-xs font-medium">Nenhum processo</p>
                                            </div>
                                        ) : (
                                            columnProcesses.map((process) => {
                                                if (isViewOnly) {
                                                    return (
                                                        <div
                                                            key={process.id}
                                                            className="group bg-white rounded-xl p-1.5 2xl:p-2.5 border border-slate-200/80 shadow-2xs transition-all duration-200 flex flex-col gap-1 2xl:gap-1.5 items-stretch cursor-default relative"
                                                        >
                                                            <div className="flex items-center justify-between gap-1">
                                                                <span className="font-mono text-[10px] xl:text-[11px] 2xl:text-xs font-extrabold text-indigo-700 bg-indigo-50 px-1 py-0.5 2xl:px-2 2xl:py-1 rounded-md border border-indigo-100/80 flex-1 text-center whitespace-nowrap overflow-visible">
                                                                    #{process.protocolo || process.id.slice(0, 8)}
                                                                </span>

                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setOpenCardMenu(openCardMenu === process.id ? null : process.id);
                                                                        setOpenPhaseMenu(null);
                                                                    }}
                                                                    className="w-5 h-5 rounded hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors cursor-pointer shrink-0"
                                                                    title="Opções do Card"
                                                                >
                                                                    <MoreHorizontal className="w-3 h-3" />
                                                                </button>

                                                                {openCardMenu === process.id && (
                                                                    <div className="absolute right-1 top-7 z-50 w-44 bg-white border border-slate-200 shadow-xl rounded-xl p-1 text-slate-800 animate-in fade-in zoom-in-95">
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                triggerVisualPriority('process', process.id);
                                                                            }}
                                                                            className="w-full text-left px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg flex items-center gap-2 cursor-pointer transition-colors"
                                                                        >
                                                                            <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                                                                            Prioridade Visual
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            <div className="flex items-center justify-center gap-1 text-[10px] xl:text-[11px] 2xl:text-xs font-extrabold text-slate-700 bg-amber-50/80 px-1 py-0.5 2xl:px-2 2xl:py-1 rounded-md border border-amber-200/70">
                                                                <Clock className="w-3 h-3 2xl:w-3.5 2xl:h-3.5 text-amber-600 shrink-0" />
                                                                <span className="whitespace-nowrap">{getDaysElapsed(process.criado_em)}</span>
                                                            </div>
                                                        </div>
                                                    );
                                                }

                                                return (
                                                    <div
                                                        key={process.id}
                                                        draggable={isCanManage}
                                                        onDragStart={(e) => handleDragStart(e, process.id)}
                                                        onClick={() => setSelectedProcessForDetails(process)}
                                                        className="group bg-white rounded-xl p-2.5 border border-slate-200/80 shadow-2xs hover:shadow-md transition-all duration-200 cursor-pointer relative overflow-hidden flex flex-col gap-1.5 active:scale-[0.99]"
                                                    >
                                                        <div className="flex items-center justify-between relative">
                                                            <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100/80 truncate">
                                                                #{process.protocolo || process.id.slice(0, 8)}
                                                            </span>

                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setOpenCardMenu(openCardMenu === process.id ? null : process.id);
                                                                    setOpenPhaseMenu(null);
                                                                }}
                                                                className="w-6 h-6 rounded-md hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                                                                title="Opções do Processo"
                                                            >
                                                                <MoreHorizontal className="w-3.5 h-3.5" />
                                                            </button>

                                                            {openCardMenu === process.id && (
                                                                <div className="absolute right-0 top-7 z-50 w-44 bg-white border border-slate-200 shadow-xl rounded-xl p-1 text-slate-800 animate-in fade-in zoom-in-95">
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            triggerVisualPriority('process', process.id);
                                                                        }}
                                                                        className="w-full text-left px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg flex items-center gap-2 cursor-pointer transition-colors"
                                                                    >
                                                                        <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                                                                        Prioridade Visual
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>

                                                        <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50/80 p-1.5 rounded-lg border border-slate-100">
                                                            <UserIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                            <div className="truncate text-[11px]">
                                                                <span className="font-bold text-slate-800 block truncate leading-tight">{process.solicitante_nome}</span>
                                                                <span className="text-slate-500 font-medium block truncate text-[10px] leading-tight mt-0.5">{process.solicitante_setor}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};
