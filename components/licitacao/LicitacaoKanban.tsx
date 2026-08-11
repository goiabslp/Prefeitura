import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
    ArrowLeft, Search, Filter, Calendar, AlertTriangle, CheckCircle2, 
    FileText, User as UserIcon, Building2, ChevronRight, ChevronLeft, 
    Sparkles, Gavel, ArrowRightLeft, Eye, Clock, ShieldAlert,
    Paperclip, Package, Tag, Scale, Landmark, Megaphone, CheckSquare,
    AlertCircle, Award, FileCheck, Layers, Tv, MoreHorizontal, MoreVertical,
    Zap, X, Maximize2, Radio, Check, RefreshCw, Flame
} from 'lucide-react';
import { User } from '../../types';
import { LicitacaoProcesso } from '../../types/licitacao';
import { useLicitacaoProcesses, useUpdateLicitacaoProcess } from '../../hooks/useLicitacaoModule';
import { fetchObjetoResumidoMap } from '../../services/licitacaoService';
import { LicitacaoWizard } from './LicitacaoWizard';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '../../services/supabaseClient';

interface LicitacaoKanbanProps {
    currentUser: User;
    onBack: () => void;
    isViewOnly?: boolean;
}

const ColumnScrollContainer: React.FC<{
    children: React.ReactNode;
    className?: string;
}> = ({ children, className }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const handleScroll = () => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }

        const el = containerRef.current;
        if (el && el.scrollTop > 5) {
            timerRef.current = setTimeout(() => {
                if (containerRef.current) {
                    containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
                }
            }, 15000); // 15 segundos
        }
    };

    useEffect(() => {
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, []);

    return (
        <div
            ref={containerRef}
            onScroll={handleScroll}
            className={className}
        >
            {children}
        </div>
    );
};

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
        id: 'pendente',
        label: 'Pendente',
        description: 'Processos em triagem ou aguardando análise inicial',
        badgeColor: 'bg-slate-100 text-slate-700 border-slate-200',
        borderTopColor: 'border-t-slate-400',
        columnBg: 'bg-slate-50/70',
        icon: Layers
    },
    {
        id: 'objeto_cotacao',
        label: 'Objeto e Cotação',
        description: 'Elaboração de TR, ETP, Pesquisa de Preços e Cotação',
        badgeColor: 'bg-indigo-100 text-indigo-700 border-indigo-200',
        borderTopColor: 'border-t-indigo-500',
        columnBg: 'bg-indigo-50/40',
        icon: Tag
    },
    {
        id: 'edital',
        label: 'Edital',
        description: 'Autuação oficial e publicação do edital',
        badgeColor: 'bg-blue-100 text-blue-700 border-blue-200',
        borderTopColor: 'border-t-blue-500',
        columnBg: 'bg-blue-50/40',
        icon: Megaphone
    },
    {
        id: 'sessao',
        label: 'Sessão',
        description: 'Propostas, Lances, Julgamento, Habilitação, Recursos e Homologação',
        badgeColor: 'bg-amber-100 text-amber-700 border-amber-200',
        borderTopColor: 'border-t-amber-500',
        columnBg: 'bg-amber-50/40',
        icon: Scale
    },
    {
        id: 'contrato_ata',
        label: 'Contrato / ATA',
        description: 'Processo concluído, contrato assinado ou ata registrada',
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

    const channelRef = useRef<any>(null);

    const [activePriority, setActivePriority] = useState<{ type: 'process' | 'phase'; processId?: string; phaseId?: string; timestamp: number } | null>(() => {
        try {
            const saved = localStorage.getItem('licitacao_prioridade_visual');
            return saved ? JSON.parse(saved) : null;
        } catch {
            return null;
        }
    });

    const [queuePriorityIds, setQueuePriorityIds] = useState<string[]>(() => {
        try {
            const saved = localStorage.getItem('licitacao_queue_priority_ids');
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    });

    const [removedQueuePriorityIds, setRemovedQueuePriorityIds] = useState<string[]>(() => {
        try {
            const saved = localStorage.getItem('licitacao_removed_queue_priority_ids');
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    });

    const checkIsQueuePriority = (process: LicitacaoProcesso) => {
        if (!process) return false;
        if (removedQueuePriorityIds.includes(process.id)) return false;
        return queuePriorityIds.includes(process.id) || process.prioridade === 'Urgente' || (process.prioridade as string) === 'Alta';
    };

    const [objetoResumidoMap, setObjetoResumidoMap] = useState<Record<string, string>>(() => {
        try {
            const saved = localStorage.getItem('licitacao_objeto_resumido_map');
            return saved ? JSON.parse(saved) : {};
        } catch {
            return {};
        }
    });

    useEffect(() => {
        const loadMap = async () => {
            const map = await fetchObjetoResumidoMap();
            setObjetoResumidoMap(prev => JSON.stringify(prev) === JSON.stringify(map) ? prev : map);
        };
        loadMap();
        const mapInterval = setInterval(loadMap, 3000);
        return () => clearInterval(mapInterval);
    }, []);

    useEffect(() => {
        const handleSync = (payloadData?: any) => {
            try {
                const saved = payloadData !== undefined 
                    ? payloadData 
                    : (localStorage.getItem('licitacao_prioridade_visual') ? JSON.parse(localStorage.getItem('licitacao_prioridade_visual')!) : null);
                
                setActivePriority(prev => {
                    if (JSON.stringify(prev) === JSON.stringify(saved)) return prev;
                    return saved;
                });
            } catch (e) {
                console.error('Erro ao sincronizar prioridade visual:', e);
            }
        };

        const handleQueueSync = (payloadData?: any) => {
            try {
                let queueData = payloadData?.queue !== undefined ? payloadData.queue : payloadData;
                let removedData = payloadData?.removed !== undefined ? payloadData.removed : undefined;

                if (queueData === undefined) {
                    const savedQ = localStorage.getItem('licitacao_queue_priority_ids');
                    queueData = savedQ ? JSON.parse(savedQ) : [];
                }
                if (removedData === undefined) {
                    const savedR = localStorage.getItem('licitacao_removed_queue_priority_ids');
                    removedData = savedR ? JSON.parse(savedR) : [];
                }

                setQueuePriorityIds(prev => JSON.stringify(prev) === JSON.stringify(queueData) ? prev : (queueData || []));
                setRemovedQueuePriorityIds(prev => JSON.stringify(prev) === JSON.stringify(removedData) ? prev : (removedData || []));
            } catch (e) {
                console.error('Erro ao sincronizar prioridade da fila:', e);
            }
        };

        const handleLocalEvent = () => handleSync();
        const handleQueueLocalEvent = () => handleQueueSync();

        window.addEventListener('storage', handleLocalEvent);
        window.addEventListener('licitacao-priority-updated', handleLocalEvent);
        window.addEventListener('storage', handleQueueLocalEvent);
        window.addEventListener('licitacao-queue-priority-updated', handleQueueLocalEvent);

        // 1. Busca prioridades iniciais do banco
        const fetchDbPriority = async () => {
            try {
                const { data } = await supabase
                    .from('organization_settings')
                    .select('ui_config')
                    .eq('id', 'global_config')
                    .single();
                if (data?.ui_config) {
                    if (data.ui_config.licitacao_prioridade_visual !== undefined) {
                        const dbPriority = data.ui_config.licitacao_prioridade_visual;
                        if (dbPriority) {
                            try { localStorage.setItem('licitacao_prioridade_visual', JSON.stringify(dbPriority)); } catch (e) {}
                        } else {
                            try { localStorage.removeItem('licitacao_prioridade_visual'); } catch (e) {}
                        }
                        setActivePriority(prev => {
                            if (JSON.stringify(prev) === JSON.stringify(dbPriority)) return prev;
                            return dbPriority;
                        });
                    }

                    if (data.ui_config.licitacao_queue_priority_ids !== undefined) {
                        const dbQueue = data.ui_config.licitacao_queue_priority_ids || [];
                        try { localStorage.setItem('licitacao_queue_priority_ids', JSON.stringify(dbQueue)); } catch (e) {}
                        setQueuePriorityIds(prev => {
                            if (JSON.stringify(prev) === JSON.stringify(dbQueue)) return prev;
                            return dbQueue;
                        });
                    }

                    if (data.ui_config.licitacao_removed_queue_priority_ids !== undefined) {
                        const dbRemoved = data.ui_config.licitacao_removed_queue_priority_ids || [];
                        try { localStorage.setItem('licitacao_removed_queue_priority_ids', JSON.stringify(dbRemoved)); } catch (e) {}
                        setRemovedQueuePriorityIds(prev => {
                            if (JSON.stringify(prev) === JSON.stringify(dbRemoved)) return prev;
                            return dbRemoved;
                        });
                    }
                }
            } catch (e) {
                console.warn('Erro ao carregar prioridade do banco:', e);
            }
        };
        fetchDbPriority();
        const pollInterval = setInterval(fetchDbPriority, 2500);

        // 2. Supabase Realtime Channel para Broadcast instantâneo e Postgres Changes
        const channel = supabase.channel('licitacao_kanban_priority')
            .on('broadcast', { event: 'licitacao-priority-updated' }, (data) => {
                if (data.payload !== undefined) {
                    try {
                        if (data.payload) {
                            localStorage.setItem('licitacao_prioridade_visual', JSON.stringify(data.payload));
                        } else {
                            localStorage.removeItem('licitacao_prioridade_visual');
                        }
                    } catch (e) {}
                    handleSync(data.payload);
                }
            })
            .on('broadcast', { event: 'licitacao-queue-priority-updated' }, (data) => {
                if (data.payload !== undefined) {
                    try {
                        const q = data.payload?.queue !== undefined ? data.payload.queue : data.payload;
                        const r = data.payload?.removed !== undefined ? data.payload.removed : [];
                        localStorage.setItem('licitacao_queue_priority_ids', JSON.stringify(q));
                        localStorage.setItem('licitacao_removed_queue_priority_ids', JSON.stringify(r));
                    } catch (e) {}
                    handleQueueSync(data.payload);
                }
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'organization_settings', filter: 'id=eq.global_config' }, (payload: any) => {
                const newUi = payload.new?.ui_config;
                if (newUi) {
                    if (newUi.licitacao_prioridade_visual !== undefined) {
                        const dbPriority = newUi.licitacao_prioridade_visual;
                        try {
                            if (dbPriority) localStorage.setItem('licitacao_prioridade_visual', JSON.stringify(dbPriority));
                            else localStorage.removeItem('licitacao_prioridade_visual');
                        } catch (e) {}
                        handleSync(dbPriority);
                    }
                    if (newUi.licitacao_queue_priority_ids !== undefined || newUi.licitacao_removed_queue_priority_ids !== undefined) {
                        const dbQueue = newUi.licitacao_queue_priority_ids || [];
                        const dbRemoved = newUi.licitacao_removed_queue_priority_ids || [];
                        try {
                            localStorage.setItem('licitacao_queue_priority_ids', JSON.stringify(dbQueue));
                            localStorage.setItem('licitacao_removed_queue_priority_ids', JSON.stringify(dbRemoved));
                        } catch (e) {}
                        handleQueueSync({ queue: dbQueue, removed: dbRemoved });
                    }
                }
            })
            .subscribe();

        channelRef.current = channel;

        return () => {
            clearInterval(pollInterval);
            window.removeEventListener('storage', handleLocalEvent);
            window.removeEventListener('licitacao-priority-updated', handleLocalEvent);
            window.removeEventListener('storage', handleQueueLocalEvent);
            window.removeEventListener('licitacao-queue-priority-updated', handleQueueLocalEvent);
            supabase.removeChannel(channel);
            channelRef.current = null;
        };
    }, []);

    const toggleQueuePriority = async (processId: string) => {
        const targetProcess = processes.find(p => p.id === processId);
        const isCurrentlyPriority = targetProcess 
            ? checkIsQueuePriority(targetProcess)
            : ((queuePriorityIds.includes(processId) || processes.find(p => p.id === processId)?.prioridade === 'Urgente') && !removedQueuePriorityIds.includes(processId));

        let updatedQueue: string[];
        let updatedRemoved: string[];

        if (isCurrentlyPriority) {
            updatedQueue = queuePriorityIds.filter(id => id !== processId);
            updatedRemoved = Array.from(new Set([...removedQueuePriorityIds, processId]));
        } else {
            updatedQueue = Array.from(new Set([...queuePriorityIds, processId]));
            updatedRemoved = removedQueuePriorityIds.filter(id => id !== processId);
        }

        setQueuePriorityIds(updatedQueue);
        setRemovedQueuePriorityIds(updatedRemoved);

        try {
            localStorage.setItem('licitacao_queue_priority_ids', JSON.stringify(updatedQueue));
            localStorage.setItem('licitacao_removed_queue_priority_ids', JSON.stringify(updatedRemoved));
        } catch (e) {}

        window.dispatchEvent(new CustomEvent('licitacao-queue-priority-updated'));
        setOpenCardMenu(null);

        if (channelRef.current) {
            channelRef.current.send({
                type: 'broadcast',
                event: 'licitacao-queue-priority-updated',
                payload: { queue: updatedQueue, removed: updatedRemoved }
            });
        }

        try {
            await updateMutation.mutateAsync({
                id: processId,
                updates: {
                    prioridade: isCurrentlyPriority ? 'Normal' : 'Urgente'
                }
            });
        } catch (err) {
            console.warn('Erro ao atualizar prioridade no processo:', err);
        }

        try {
            const { data: orgData } = await supabase
                .from('organization_settings')
                .select('ui_config')
                .eq('id', 'global_config')
                .single();
            const currentUiConfig = orgData?.ui_config || {};
            const updatedUiConfig = {
                ...currentUiConfig,
                licitacao_queue_priority_ids: updatedQueue,
                licitacao_removed_queue_priority_ids: updatedRemoved
            };
            await supabase
                .from('organization_settings')
                .update({ ui_config: updatedUiConfig, updated_at: new Date().toISOString() })
                .eq('id', 'global_config');
        } catch (e) {
            console.warn('Erro ao salvar prioridade da fila no Supabase:', e);
        }
    };

    const [showPriorityToast, setShowPriorityToast] = useState(false);

    const persistPriorityToDb = async (payload: any) => {
        try {
            const { data: orgData } = await supabase
                .from('organization_settings')
                .select('ui_config')
                .eq('id', 'global_config')
                .single();
            const currentUiConfig = orgData?.ui_config || {};
            const updatedUiConfig = {
                ...currentUiConfig,
                licitacao_prioridade_visual: payload
            };
            await supabase
                .from('organization_settings')
                .update({ ui_config: updatedUiConfig, updated_at: new Date().toISOString() })
                .eq('id', 'global_config');
        } catch (e) {
            console.warn('Erro ao persistir prioridade visual no Supabase:', e);
        }
    };

    const triggerVisualPriority = (type: 'process' | 'phase', id: string) => {
        const payload = {
            type,
            ...(type === 'process' ? { processId: id } : { phaseId: id }),
            timestamp: Date.now()
        };
        try {
            localStorage.setItem('licitacao_prioridade_visual', JSON.stringify(payload));
        } catch (e) {}

        setActivePriority(payload);
        window.dispatchEvent(new CustomEvent('licitacao-priority-updated'));
        setOpenPhaseMenu(null);
        setOpenCardMenu(null);

        // Dispara via canal ativo do Supabase Realtime
        if (channelRef.current) {
            channelRef.current.send({
                type: 'broadcast',
                event: 'licitacao-priority-updated',
                payload
            });
        }

        // Persiste no banco Supabase para qualquer TV que abrir via link direto
        persistPriorityToDb(payload);

        if (!isViewOnly) {
            setShowPriorityToast(true);
            setTimeout(() => setShowPriorityToast(false), 3500);
        }
    };

    const handleClearPriority = () => {
        try {
            localStorage.removeItem('licitacao_prioridade_visual');
        } catch (e) {}

        setActivePriority(null);
        window.dispatchEvent(new CustomEvent('licitacao-priority-updated'));
        setOpenPhaseMenu(null);
        setOpenCardMenu(null);

        if (channelRef.current) {
            channelRef.current.send({
                type: 'broadcast',
                event: 'licitacao-priority-updated',
                payload: null
            });
        }

        persistPriorityToDb(null);
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
            const st = (process.status || '').toString().trim().toLowerCase();
            const isEmAprovacaoOrRejeitadoOrFinalizado = 
                st === 'em aprovação' ||
                st === 'em aprovacao' ||
                st === 'rascunho' ||
                st === 'aguardando assinatura' ||
                st === 'pending' ||
                st === 'awaiting_approval' ||
                st === 'payment_account' ||
                st === 'awaiting_ficha' ||
                st === 'rejeitado' ||
                st === 'rejected' ||
                st === 'finalizado' ||
                st === 'finalized';

            // Processos com status "Em Aprovação", "Rejeitado" ou "Finalizado" NUNCA devem aparecer no Kanban nem na visão TV
            if (isEmAprovacaoOrRejeitadoOrFinalizado) {
                return false;
            }

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

            return matchesSearch && matchesPriority && matchesSector && hasPermission;
        });
    }, [processes, searchTerm, priorityFilter, sectorFilter, currentUser, isViewOnly]);

    const processesByPhase = useMemo(() => {
        const grouped: Record<string, LicitacaoProcesso[]> = {};
        LICITACAO_PHASES.forEach(phase => {
            grouped[phase.id] = [];
        });

        filteredProcesses.forEach(process => {
            const st = (process.status || '').toString().trim().toLowerCase();
            const isEmAprovacaoOrRejeitadoOrFinalizado = 
                st === 'em aprovação' ||
                st === 'em aprovacao' ||
                st === 'rascunho' ||
                st === 'aguardando assinatura' ||
                st === 'pending' ||
                st === 'awaiting_approval' ||
                st === 'payment_account' ||
                st === 'awaiting_ficha' ||
                st === 'rejeitado' ||
                st === 'rejected' ||
                st === 'finalizado' ||
                st === 'finalized';

            // Garante que NENHUM processo Em Aprovação, Rejeitado ou Finalizado seja alocado para qualquer coluna
            if (isEmAprovacaoOrRejeitadoOrFinalizado) {
                return;
            }

            const rawPhase = process.fase ? process.fase.toLowerCase().trim() : 'pendente';
            let targetPhase = 'pendente';

            if (rawPhase === 'pendente' || rawPhase === 'sem_fase' || rawPhase === 'inicial' || rawPhase === 'triagem') {
                targetPhase = 'pendente';
            } else if (rawPhase === 'preparatoria' || rawPhase === 'objeto_cotacao' || rawPhase === 'cotacao' || rawPhase === 'pesquisa_precos') {
                targetPhase = 'objeto_cotacao';
            } else if (rawPhase === 'autuacao_divulgacao' || rawPhase === 'autuacao' || rawPhase === 'divulgacao' || rawPhase === 'edital') {
                targetPhase = 'edital';
            } else if (
                rawPhase === 'propostas' || 
                rawPhase === 'julgamento_habilitacao' || 
                rawPhase === 'julgamento' || 
                rawPhase === 'habilitacao' || 
                rawPhase === 'recursos' || 
                rawPhase === 'homologacao_adjudicacao' || 
                rawPhase === 'homologacao' || 
                rawPhase === 'adjudicacao' || 
                rawPhase === 'sessao' || 
                rawPhase === 'lances'
            ) {
                targetPhase = 'sessao';
            } else if (rawPhase === 'contrato_ata' || rawPhase === 'finalizado' || rawPhase === 'concluido' || rawPhase === 'contrato' || rawPhase === 'ata') {
                targetPhase = 'contrato_ata';
            }

            if (grouped[targetPhase]) {
                grouped[targetPhase].push(process);
            }
        });

        Object.keys(grouped).forEach(phaseKey => {
            grouped[phaseKey].sort((a, b) => {
                const isPrioA = checkIsQueuePriority(a);
                const isPrioB = checkIsQueuePriority(b);
                if (isPrioA && !isPrioB) return -1;
                if (!isPrioA && isPrioB) return 1;
                return new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime();
            });
        });

        return grouped;
    }, [filteredProcesses, queuePriorityIds, removedQueuePriorityIds]);

    const stats = useMemo(() => {
        const total = filteredProcesses.length;
        const emAndamento = (processesByPhase['objeto_cotacao']?.length || 0) +
                            (processesByPhase['edital']?.length || 0) +
                            (processesByPhase['sessao']?.length || 0);
        const finalizados = processesByPhase['contrato_ata']?.length || 0;
        const urgentes = filteredProcesses.filter(p => p.prioridade === 'Urgente' || (p.prioridade as string) === 'Alta' || (p.prioridade as string) === 'Urgência').length;

        return { total, urgentes, emAndamento, finalizados };
    }, [filteredProcesses, processesByPhase]);

    const handleMovePhase = async (processId: string, newPhaseId: string) => {
        try {
            const phaseValue = newPhaseId;
            let statusUpdate: any = undefined;

            if (newPhaseId === 'contrato_ata' || newPhaseId === 'finalizado') {
                statusUpdate = 'Concluído';
            } else {
                statusUpdate = 'Em Análise';
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
            const processCount = phaseProcesses.length;

            let gridLayout = 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';
            let cardPadding = 'p-4 2xl:p-5';
            let titleSize = 'text-sm md:text-base xl:text-lg 2xl:text-xl';
            let cardGap = 'gap-3 md:gap-4';

            if (processCount > 12) {
                gridLayout = 'grid-cols-2 md:grid-cols-4 lg:grid-cols-5';
                cardPadding = 'p-2.5 2xl:p-3.5';
                titleSize = 'text-xs md:text-sm xl:text-base';
                cardGap = 'gap-2';
            } else if (processCount > 8) {
                gridLayout = 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4';
                cardPadding = 'p-3 2xl:p-4';
                titleSize = 'text-xs md:text-sm xl:text-base';
                cardGap = 'gap-2.5 md:gap-3';
            } else if (processCount > 4) {
                gridLayout = 'grid-cols-2 md:grid-cols-3';
                cardPadding = 'p-3.5 2xl:p-4.5';
                titleSize = 'text-sm md:text-base xl:text-lg';
                cardGap = 'gap-3 md:gap-4';
            } else if (processCount > 1) {
                gridLayout = 'grid-cols-1 md:grid-cols-2';
                cardPadding = 'p-5 2xl:p-6';
                titleSize = 'text-base md:text-lg xl:text-xl';
                cardGap = 'gap-4 md:gap-6';
            } else {
                gridLayout = 'grid-cols-1';
                cardPadding = 'p-6 2xl:p-8';
                titleSize = 'text-lg md:text-xl xl:text-2xl';
                cardGap = 'gap-6';
            }

            return (
                <div className={`flex-1 flex flex-col bg-[#F8FAFC] text-slate-900 h-full overflow-hidden relative z-30 transition-all duration-[2000ms] ease-in-out ${
                    isTransitioning ? 'opacity-0 scale-95 filter blur-sm' : 'opacity-100 scale-100 filter blur-0'
                }`}>
                    <header className="bg-white border-b border-slate-200 px-4 md:px-6 py-2.5 md:py-3 flex items-center justify-between shadow-xs shrink-0 z-20">
                        <div className="flex items-center gap-3">
                            <span className="px-3.5 py-1 rounded-full text-xs 2xl:text-sm font-black bg-amber-50 text-amber-800 border border-amber-300 flex items-center gap-2">
                                <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
                                FASE EM PRIORIDADE VISUAL DA SALA
                            </span>
                            <h2 className="text-base md:text-xl font-bold text-slate-800 flex items-center gap-2">
                                <PhaseIcon className="w-5 h-5 text-indigo-600" />
                                {phaseObj.label}
                            </h2>
                        </div>

                        <button
                            onClick={handleClearPriority}
                            className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-700 text-xs 2xl:text-sm font-bold flex items-center gap-2 border border-slate-200 transition-all cursor-pointer shadow-xs"
                        >
                            <X className="w-4 h-4 text-slate-500" />
                            Fechar Prioridade
                        </button>
                    </header>

                    <div className="flex-1 min-h-0 flex flex-col p-3 md:p-5 2xl:p-6 overflow-hidden w-full max-w-[1920px] mx-auto">
                        <p className="text-xs md:text-sm text-slate-500 font-semibold mb-2 md:mb-3 shrink-0">
                            Exibindo todos os <strong className="text-indigo-600 font-black">{phaseProcesses.length}</strong> processos em andamento nesta fase:
                        </p>

                        <div className={`grid ${gridLayout} ${cardGap} flex-1 min-h-0 h-full w-full items-stretch overflow-hidden`}>
                            {phaseProcesses.map(proc => (
                                <div key={proc.id} className={`bg-white border border-slate-200/90 rounded-2xl ${cardPadding} shadow-xs hover:shadow-md transition-all flex flex-col justify-between h-full min-h-0 overflow-hidden`}>
                                    <div className="flex flex-col gap-2 min-h-0">
                                        <div className="flex items-center justify-between gap-2 shrink-0">
                                            <span className="font-sans text-xs md:text-sm font-black text-blue-700 uppercase bg-blue-50 px-2.5 py-0.5 md:py-1 rounded-lg border border-blue-200/90 line-clamp-2 break-words leading-tight shadow-2xs" title={`Protocolo: #${proc.protocolo}`}>
                                                {objetoResumidoMap[proc.id] || proc.objeto_resumido || `#${proc.protocolo || proc.id.slice(0, 8)}`}
                                            </span>
                                            <span className="text-[11px] md:text-xs font-extrabold text-amber-800 bg-amber-50 px-2 py-0.5 md:py-1 rounded-lg border border-amber-200/80 flex items-center gap-1 shrink-0">
                                                <Clock className="w-3.5 h-3.5 text-amber-600" />
                                                {getDaysElapsed(proc.criado_em)}
                                            </span>
                                        </div>
                                        <h4 className={`font-black text-slate-900 ${titleSize} line-clamp-3 leading-snug`}>{proc.finalidade}</h4>
                                    </div>
                                    <div className="text-xs text-slate-500 border-t border-slate-100 pt-2 md:pt-2.5 flex justify-between items-center shrink-0 mt-2">
                                        <span className="font-bold text-slate-700 truncate mr-2">{proc.solicitante_nome}</span>
                                        <span className="text-indigo-600 font-semibold truncate shrink-0">{proc.solicitante_setor}</span>
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
                        <p className="text-[11px] text-slate-300">Exibindo agora na tela da sala (/Licitacao/Kanban/view)</p>
                    </div>
                </div>
            )}

            {!isViewOnly && (
                <header className="bg-white border-b border-slate-200 px-3 md:px-6 py-2.5 md:py-3.5 shadow-xs shrink-0 z-20">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 md:gap-3">
                        <div className="flex items-center gap-3 md:gap-4">
                            <button
                                onClick={onBack}
                                className="w-9 h-9 md:w-10 md:h-10 rounded-2xl bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 flex items-center justify-center text-slate-600 transition-all shadow-xs group cursor-pointer shrink-0"
                                title="Voltar ao menu"
                            >
                                <ArrowLeft className="w-4 h-4 md:w-5 md:h-5 group-hover:-translate-x-0.5 transition-transform" />
                            </button>
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h1 className="text-lg md:text-2xl 2xl:text-3xl 3xl:text-4xl font-black text-slate-800 tracking-tight truncate">Kanban de Licitações</h1>
                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] md:text-xs font-bold bg-indigo-100 text-indigo-700 border border-indigo-200 flex items-center gap-1 shrink-0">
                                        <Sparkles className="w-3 h-3 text-indigo-600" />
                                        Acompanhamento Visual
                                    </span>
                                </div>
                                <p className="text-[11px] md:text-xs 2xl:text-sm font-medium text-slate-500 mt-0.5 truncate">
                                    Gerencie e acompanhe a evolução dos processos pelas fases do edital
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 2xl:gap-3 overflow-x-auto pb-1 md:pb-0 shrink-0">
                            <div className="bg-slate-50 border border-slate-200/80 px-3 py-1 2xl:px-4 2xl:py-2 rounded-xl text-center min-w-[65px]">
                                <span className="text-[9px] 2xl:text-xs font-extrabold uppercase text-slate-400 block tracking-wider">Total</span>
                                <span className="text-sm 2xl:text-xl font-black text-slate-800">{stats.total}</span>
                            </div>
                            <div className="bg-amber-50 border border-amber-200/80 px-3 py-1 2xl:px-4 2xl:py-2 rounded-xl text-center min-w-[65px]">
                                <span className="text-[9px] 2xl:text-xs font-extrabold uppercase text-amber-600/80 block tracking-wider">Em Andamento</span>
                                <span className="text-sm 2xl:text-xl font-black text-amber-700">{stats.emAndamento}</span>
                            </div>
                            <div className="bg-rose-50 border border-rose-200/80 px-3 py-1 2xl:px-4 2xl:py-2 rounded-xl text-center min-w-[65px]">
                                <span className="text-[9px] 2xl:text-xs font-extrabold uppercase text-rose-600/80 block tracking-wider">Urgentes</span>
                                <span className="text-sm 2xl:text-xl font-black text-rose-700">{stats.urgentes}</span>
                            </div>
                            <div className="bg-emerald-50 border border-emerald-200/80 px-3 py-1 2xl:px-4 2xl:py-2 rounded-xl text-center min-w-[65px]">
                                <span className="text-[9px] 2xl:text-xs font-extrabold uppercase text-emerald-600/80 block tracking-wider">Finalizados</span>
                                <span className="text-sm 2xl:text-xl font-black text-emerald-700">{stats.finalizados}</span>
                            </div>
                        </div>
                    </div>
                </header>
            )}

            {activePriority && !isViewOnly && (
                <div className="bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-slate-950 px-4 py-2 border-b border-amber-300 shadow-xs flex items-center justify-between z-20 shrink-0 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center gap-2.5">
                        <span className="w-6 h-6 rounded-full bg-amber-950 text-amber-300 flex items-center justify-center shrink-0">
                            <Zap className="w-3.5 h-3.5 fill-amber-300" />
                        </span>
                        <div className="text-xs md:text-sm font-bold">
                            <span>Transmissão Visual em Tempo Real (TV) Ativa: </span>
                            <span className="font-black underline underline-offset-2">
                                {activePriority.type === 'process' ? `Processo em Destaque` : `Fase em Destaque`}
                            </span>
                        </div>
                    </div>
                    <button
                        onClick={handleClearPriority}
                        className="bg-slate-950 hover:bg-slate-900 text-amber-300 hover:text-white px-3 py-1 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95 shrink-0"
                        title="Desativar Transmissão e Voltar ao Kanban Geral na TV"
                    >
                        <X className="w-4 h-4 text-rose-400" />
                        Desativar Prioridade Visual
                    </button>
                </div>
            )}

            <div className={`flex-1 min-h-0 flex flex-col ${isViewOnly ? 'w-full h-full p-1.5 md:p-3 2xl:p-4 overflow-hidden' : 'overflow-x-auto p-4 md:p-6 scrollbar-thin scrollbar-thumb-slate-300'}`}>
                {isLoading ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3">
                        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                        <p className="font-bold text-sm">Carregando quadro Kanban...</p>
                    </div>
                ) : (
                    <div className={`h-full min-h-0 ${isViewOnly ? 'grid grid-cols-5 gap-2 md:gap-3 2xl:gap-4 w-full h-full items-stretch overflow-hidden min-w-0' : 'flex gap-4 min-w-max items-start'}`}>
                        {LICITACAO_PHASES.map((phase, idx) => {
                            const columnProcesses = processesByPhase[phase.id] || [];
                            const IconComponent = phase.icon;
                            const isOver = dragOverColumn === phase.id;
                            const isPriorityPhase = activePriority?.type === 'phase' && activePriority?.phaseId === phase.id;

                            return (
                                <div
                                    key={phase.id}
                                    onDragOver={(e) => handleDragOver(e, phase.id)}
                                    onDragLeave={handleDragLeave}
                                    onDrop={(e) => handleDrop(e, phase.id)}
                                    className={`flex flex-col h-full min-h-0 overflow-hidden rounded-2xl border transition-all duration-300 ${
                                        isPriorityPhase
                                            ? 'ring-4 ring-amber-400 border-amber-400 bg-amber-500/10 shadow-[0_0_30px_rgba(251,191,36,0.35)] scale-[1.01] z-20'
                                            : `${phase.columnBg} ${phase.borderTopColor} border-t-4 border-slate-200/90 shadow-xs`
                                    } ${
                                        isViewOnly ? 'w-full min-w-0 h-full max-h-full flex-1' : 'w-[320px] max-h-full'
                                    } ${isOver ? 'ring-2 ring-indigo-500 ring-offset-2 bg-indigo-50/50' : ''}`}
                                >
                                    <div className={`border-b rounded-t-xl flex items-center justify-between sticky top-0 z-10 text-white shadow-xs ${
                                        isPriorityPhase
                                            ? 'bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 border-amber-400'
                                            : 'bg-slate-900 border-slate-700/60'
                                    } ${
                                        isViewOnly ? 'min-h-[58px] xl:min-h-[64px] 2xl:min-h-[72px] py-1.5 px-2 xl:px-3' : 'h-[60px] min-h-[60px] px-3 md:px-4'
                                    }`}>
                                        <div className="flex items-center gap-1.5 xl:gap-2.5 min-w-0 flex-1 py-0.5">
                                            <div className={`p-1.5 xl:p-2 rounded-xl border shrink-0 ${isPriorityPhase ? 'bg-amber-400 text-amber-950 border-amber-300' : phase.badgeColor}`}>
                                                <IconComponent className="w-4 h-4 xl:w-5 xl:h-5 2xl:w-6 2xl:h-6" />
                                            </div>
                                            <div className="min-w-0 flex-1 flex flex-col justify-center">
                                                <div className="flex items-center gap-1">
                                                    <h3 className="font-black text-white text-xs sm:text-sm xl:text-base 2xl:text-lg 3xl:text-xl tracking-tight leading-tight whitespace-normal break-normal [word-break:normal] [overflow-wrap:normal] hyphens-none drop-shadow-sm">
                                                        {phase.label}
                                                    </h3>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-1.5 relative shrink-0">
                                            {isPriorityPhase && (
                                                <span className="px-2 py-0.5 rounded-full text-[9px] xl:text-[10px] 2xl:text-xs font-black bg-amber-300 text-amber-950 flex items-center gap-0.5 shadow-md animate-bounce">
                                                    <Zap className="w-3 h-3 fill-amber-950 text-amber-950" /> DESTAQUE
                                                </span>
                                            )}

                                            <span className="px-2 py-0.5 rounded-full text-xs xl:text-sm 2xl:text-base font-black bg-slate-800 text-slate-100 border border-slate-700 shadow-inner min-w-[24px] text-center">
                                                {columnProcesses.length}
                                            </span>

                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setOpenPhaseMenu(openPhaseMenu === phase.id ? null : phase.id);
                                                    setOpenCardMenu(null);
                                                }}
                                                className="w-6 h-6 xl:w-7 xl:h-7 rounded-lg hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
                                                title="Opções da Fase"
                                            >
                                                <MoreHorizontal className="w-3.5 h-3.5" />
                                            </button>

                                            {openPhaseMenu === phase.id && (
                                                <div className="absolute right-0 top-7 z-50 w-48 bg-white border border-slate-200 shadow-xl rounded-xl p-1 text-slate-800 animate-in fade-in zoom-in-95">
                                                    {isPriorityPhase ? (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleClearPriority();
                                                            }}
                                                            className="w-full text-left px-2.5 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-lg flex items-center gap-2 cursor-pointer transition-colors"
                                                        >
                                                            <X className="w-3.5 h-3.5" />
                                                            Remover Destaque TV
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                triggerVisualPriority('phase', phase.id);
                                                            }}
                                                            className="w-full text-left px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-amber-50 hover:text-amber-700 rounded-lg flex items-center gap-2 cursor-pointer transition-colors"
                                                        >
                                                            <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                                                            Prioridade Visual (TV)
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <ColumnScrollContainer className="p-1.5 md:p-2 2xl:p-3 flex-1 overflow-y-auto space-y-1.5 2xl:space-y-2.5 min-h-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                                        {columnProcesses.length === 0 ? (
                                            <div className="h-20 2xl:h-28 border-2 border-dashed border-slate-200/80 rounded-xl flex flex-col items-center justify-center text-slate-400 p-2 text-center">
                                                <p className="text-[10px] 2xl:text-xs font-medium">Nenhum processo</p>
                                            </div>
                                        ) : (
                                            columnProcesses
                                                .sort((a, b) => {
                                                    const aPrior = checkIsQueuePriority(a);
                                                    const bPrior = checkIsQueuePriority(b);
                                                    return aPrior === bPrior ? 0 : aPrior ? -1 : 1;
                                                })
                                                .map((process) => {
                                                    const isPriorityProcess = activePriority?.type === 'process' && activePriority?.processId === process.id;
                                                    const isQueuePriority = checkIsQueuePriority(process);

                                                    if (isViewOnly) {
                                                        let cardStyleClasses = 'bg-white border-slate-200/80 shadow-2xs';
                                                        if (isPriorityProcess) {
                                                            cardStyleClasses = 'ring-4 ring-amber-400 border-amber-400 bg-amber-50/90 shadow-[0_0_20px_rgba(251,191,36,0.4)] scale-[1.02] z-30';
                                                        } else if (isQueuePriority) {
                                                            cardStyleClasses = 'border-2 border-purple-500 bg-gradient-to-br from-purple-50/90 via-indigo-50/80 to-purple-50/90 animate-queue-pulse z-20';
                                                        }

                                                        return (
                                                            <div
                                                                key={process.id}
                                                                className={`group rounded-xl p-1.5 2xl:p-2 border transition-all duration-300 flex flex-col gap-1 2xl:gap-1.5 items-stretch cursor-default relative ${cardStyleClasses}`}
                                                            >
                                                                {isPriorityProcess && (
                                                                    <div className="bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 px-2 py-0.5 rounded-md text-[8px] 2xl:text-[9px] font-black flex items-center justify-center gap-1 shadow-xs uppercase tracking-wider animate-bounce">
                                                                        <Zap className="w-2.5 h-2.5 fill-slate-950 text-slate-950" /> Prioridade de Sala
                                                                    </div>
                                                                )}

                                                                <div className="flex items-center justify-between gap-1">
                                                                    <div className="flex items-center gap-1 flex-wrap">
                                                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] xl:text-[10px] 2xl:text-[11px] font-extrabold text-amber-800 bg-amber-50 border border-amber-200/80 rounded-md shrink-0 shadow-2xs">
                                                                            <Clock className="w-2.5 h-2.5 2xl:w-3 2xl:h-3 text-amber-600 shrink-0" />
                                                                            <span className="whitespace-nowrap">{getDaysElapsed(process.criado_em)}</span>
                                                                        </span>
                                                                        {isQueuePriority && !isPriorityProcess && (
                                                                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[8px] xl:text-[9px] 2xl:text-[10px] font-black text-purple-800 bg-purple-100/90 border border-purple-300/90 rounded-md shrink-0 uppercase tracking-wider shadow-2xs">
                                                                                <Flame className="w-2.5 h-2.5 text-purple-600 fill-purple-600 shrink-0" />
                                                                                Prioridade
                                                                            </span>
                                                                        )}
                                                                    </div>

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
                                                                        <div className="absolute right-1 top-7 z-50 w-48 bg-white border border-slate-200 shadow-xl rounded-xl p-1 text-slate-800 animate-in fade-in zoom-in-95">
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    toggleQueuePriority(process.id);
                                                                                }}
                                                                                className={`w-full text-left px-2.5 py-1.5 text-xs font-bold rounded-lg flex items-center gap-2 cursor-pointer transition-colors ${
                                                                                    isQueuePriority ? 'text-purple-700 bg-purple-50 hover:bg-purple-100' : 'text-slate-700 hover:bg-purple-50 hover:text-purple-700'
                                                                                }`}
                                                                            >
                                                                                <Flame className={`w-3.5 h-3.5 ${isQueuePriority ? 'text-purple-600 fill-purple-600' : 'text-purple-500'}`} />
                                                                                {isQueuePriority ? 'Remover Prioridade' : 'Prioridade'}
                                                                            </button>

                                                                            {isPriorityProcess ? (
                                                                                <button
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        handleClearPriority();
                                                                                    }}
                                                                                    className="w-full text-left px-2.5 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-lg flex items-center gap-2 cursor-pointer transition-colors mt-0.5"
                                                                                >
                                                                                    <X className="w-3.5 h-3.5" />
                                                                                    Remover Destaque TV
                                                                                </button>
                                                                            ) : (
                                                                                <button
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        triggerVisualPriority('process', process.id);
                                                                                    }}
                                                                                    className="w-full text-left px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-amber-50 hover:text-amber-700 rounded-lg flex items-center gap-2 cursor-pointer transition-colors mt-0.5"
                                                                                >
                                                                                    <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                                                                                    Prioridade Visual (TV)
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                <span className="font-sans text-[11px] xl:text-xs 2xl:text-sm font-black text-blue-700 uppercase bg-blue-50 px-1.5 py-1 2xl:px-2 rounded-md border border-blue-200/90 w-full text-center line-clamp-2 break-words leading-tight shadow-2xs" title={`Protocolo: #${process.protocolo}`}>
                                                                    {objetoResumidoMap[process.id] || process.objeto_resumido || `#${process.protocolo || process.id.slice(0, 8)}`}
                                                                </span>
                                                            </div>
                                                        );
                                                    }

                                                    let regularCardClasses = 'bg-white border-slate-200/80 shadow-2xs hover:shadow-md';
                                                    if (isPriorityProcess) {
                                                        regularCardClasses = 'ring-4 ring-amber-400 border-amber-400 bg-amber-50 shadow-[0_0_20px_rgba(251,191,36,0.4)] scale-[1.02] z-20';
                                                    } else if (isQueuePriority) {
                                                        regularCardClasses = 'border-2 border-purple-500 bg-gradient-to-br from-purple-50/90 via-indigo-50/80 to-purple-50/90 animate-queue-pulse z-10';
                                                    }

                                                    return (
                                                        <div
                                                            key={process.id}
                                                            draggable={isCanManage}
                                                            onDragStart={(e) => handleDragStart(e, process.id)}
                                                            onClick={() => setSelectedProcessForDetails(process)}
                                                            className={`group rounded-xl p-2.5 border transition-all duration-200 cursor-pointer relative overflow-hidden flex flex-col gap-1.5 active:scale-[0.99] ${regularCardClasses}`}
                                                        >
                                                            {isPriorityProcess && (
                                                                <div className="bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 px-2 py-1 rounded-lg text-[10px] font-black flex items-center justify-between shadow-xs uppercase tracking-wider">
                                                                    <span className="flex items-center gap-1">
                                                                        <Zap className="w-3.5 h-3.5 fill-slate-950 text-slate-950 shrink-0" />
                                                                        Na Sala (TV)
                                                                    </span>
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleClearPriority();
                                                                        }}
                                                                        className="bg-slate-950 hover:bg-slate-900 text-rose-400 hover:text-white px-2 py-0.5 rounded-md text-[10px] font-black flex items-center gap-1 transition-all cursor-pointer shadow-xs shrink-0 active:scale-95"
                                                                        title="Desativar Visualização na Sala"
                                                                    >
                                                                        <X className="w-3 h-3 text-rose-400" /> Desativar
                                                                    </button>
                                                                </div>
                                                            )}

                                                            {isQueuePriority && !isPriorityProcess && (
                                                                <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-2 py-0.5 rounded-md text-[9px] font-black flex items-center gap-1 shadow-2xs uppercase tracking-wider w-fit">
                                                                    <Flame className="w-3 h-3 fill-white text-white shrink-0" /> Prioridade
                                                                </div>
                                                            )}

                                                            <div className="flex items-center justify-between relative">
                                                                <span className="font-sans text-xs sm:text-sm font-black text-blue-700 uppercase bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200/90 line-clamp-2 break-words leading-tight shadow-2xs" title={`Protocolo: #${process.protocolo}`}>
                                                                    {objetoResumidoMap[process.id] || process.objeto_resumido || `#${process.protocolo || process.id.slice(0, 8)}`}
                                                                </span>

                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setOpenCardMenu(openCardMenu === process.id ? null : process.id);
                                                                        setOpenPhaseMenu(null);
                                                                    }}
                                                                    className="w-6 h-6 rounded-md hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors cursor-pointer shrink-0"
                                                                    title="Opções do Processo"
                                                                >
                                                                    <MoreHorizontal className="w-3.5 h-3.5" />
                                                                </button>

                                                                {openCardMenu === process.id && (
                                                                    <div className="absolute right-0 top-7 z-50 w-48 bg-white border border-slate-200 shadow-xl rounded-xl p-1 text-slate-800 animate-in fade-in zoom-in-95">
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                toggleQueuePriority(process.id);
                                                                            }}
                                                                            className={`w-full text-left px-2.5 py-1.5 text-xs font-bold rounded-lg flex items-center gap-2 cursor-pointer transition-colors ${
                                                                                isQueuePriority ? 'text-purple-700 bg-purple-50 hover:bg-purple-100' : 'text-slate-700 hover:bg-purple-50 hover:text-purple-700'
                                                                            }`}
                                                                        >
                                                                            <Flame className={`w-3.5 h-3.5 ${isQueuePriority ? 'text-purple-600 fill-purple-600' : 'text-purple-500'}`} />
                                                                            {isQueuePriority ? 'Remover Prioridade Fila' : 'Prioridade Fila'}
                                                                        </button>

                                                                        {isPriorityProcess ? (
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    handleClearPriority();
                                                                                }}
                                                                                className="w-full text-left px-2.5 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-lg flex items-center gap-2 cursor-pointer transition-colors mt-0.5"
                                                                            >
                                                                                <X className="w-3.5 h-3.5" />
                                                                                Remover Destaque TV
                                                                            </button>
                                                                        ) : (
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    triggerVisualPriority('process', process.id);
                                                                                }}
                                                                                className="w-full text-left px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-amber-50 hover:text-amber-700 rounded-lg flex items-center gap-2 cursor-pointer transition-colors mt-0.5"
                                                                            >
                                                                                <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                                                                                Prioridade Visual (TV)
                                                                            </button>
                                                                        )}
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
                                    </ColumnScrollContainer>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};
