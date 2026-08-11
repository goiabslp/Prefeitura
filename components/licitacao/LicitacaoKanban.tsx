import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
    ArrowLeft, Search, Filter, Calendar, AlertTriangle, CheckCircle2, 
    FileText, User as UserIcon, Building2, ChevronRight, ChevronLeft, 
    Sparkles, Gavel, ArrowRightLeft, Eye, Clock, ShieldAlert,
    Paperclip, Package, Tag, Scale, Landmark, Megaphone, CheckSquare,
    AlertCircle, Award, FileCheck, Layers, Tv, MoreHorizontal, MoreVertical,
    Zap, X, Maximize2, Radio, Check, RefreshCw, Flame, Volume2, Music, Upload
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
    users?: User[];
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

export const LicitacaoKanban: React.FC<LicitacaoKanbanProps> = ({ currentUser, users: usersProp = [], onBack, isViewOnly = false }) => {
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

    const [activePriority, setActivePriority] = useState<{ type: 'process' | 'phase'; processId?: string; phaseId?: string; timestamp: number } | null>(null);
    const [showPriorityToast, setShowPriorityToast] = useState(false);
    const [priorityToastText, setPriorityToastText] = useState('');

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

    const [processAssignments, setProcessAssignments] = useState<Record<string, { userId: string; userName: string }>>(() => {
        try {
            const saved = localStorage.getItem('licitacao_process_assignments');
            return saved ? JSON.parse(saved) : {};
        } catch {
            return {};
        }
    });

    const [allUsers, setAllUsers] = useState<User[]>([]);

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const { data } = await supabase.from('users').select('*');
                if (data && data.length > 0) {
                    setAllUsers(data as User[]);
                }
            } catch (e) {
                console.warn('Erro ao carregar usuários:', e);
            }
        };
        fetchUsers();
    }, []);

    const licitacaoUsers = useMemo(() => {
        const combinedMap = new Map<string, User>();
        if (usersProp) {
            usersProp.forEach(u => { if (u && u.name) combinedMap.set(u.id || u.name, u); });
        }
        if (allUsers) {
            allUsers.forEach(u => { if (u && u.name) combinedMap.set(u.id || u.name, u); });
        }
        if (currentUser && currentUser.id && currentUser.name) {
            combinedMap.set(currentUser.id, currentUser);
        }
        const list = Array.from(combinedMap.values());
        return list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }, [allUsers, usersProp, currentUser]);

    const handleAssignUser = async (processId: string, userId: string, userName: string) => {
        const updated = {
            ...processAssignments,
            [processId]: { userId, userName }
        };
        setProcessAssignments(updated);
        try {
            localStorage.setItem('licitacao_process_assignments', JSON.stringify(updated));
        } catch (e) {}

        if (channelRef.current) {
            channelRef.current.send({
                type: 'broadcast',
                event: 'licitacao-assignment-updated',
                payload: updated
            });
        }

        try {
            const { data: orgData } = await supabase
                .from('organization_settings')
                .select('ui_config')
                .eq('id', 'global_config')
                .single();
            const currentUi = orgData?.ui_config || {};
            await supabase
                .from('organization_settings')
                .update({
                    ui_config: { ...currentUi, licitacao_process_assignments: updated },
                    updated_at: new Date().toISOString()
                })
                .eq('id', 'global_config');
        } catch (e) {
            console.warn('Erro ao persistir atribuição:', e);
        }
    };

    const [selectedProcessId, setSelectedProcessId] = useState<string | null>(() => {
        if (typeof window !== 'undefined') {
            const path = window.location.pathname;
            const match = path.match(/\/Licitacao\/Kanban\/([^\/]+)/i);
            if (match && match[1] && match[1].toLowerCase() !== 'view') {
                return match[1];
            }
        }
        return null;
    });

    useEffect(() => {
        const handlePopState = () => {
            if (typeof window !== 'undefined') {
                const path = window.location.pathname;
                const match = path.match(/\/Licitacao\/Kanban\/([^\/]+)/i);
                if (match && match[1] && match[1].toLowerCase() !== 'view') {
                    setSelectedProcessId(match[1]);
                } else {
                    setSelectedProcessId(null);
                }
            }
        };
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    const handleOpenProcessItemPage = (processId: string) => {
        setSelectedProcessId(processId);
        if (typeof window !== 'undefined') {
            window.history.pushState({}, '', `/Licitacao/Kanban/${processId}`);
        }
    };

    const handleCloseProcessItemPage = () => {
        setSelectedProcessId(null);
        if (typeof window !== 'undefined') {
            window.history.pushState({}, '', '/Licitacao/Kanban');
        }
    };

    const [newApprovedModalProcess, setNewApprovedModalProcess] = useState<{
        id: string;
        protocolo: string;
        solicitante_nome: string;
        solicitante_setor: string;
        objeto_resumido: string;
        aprovado_em?: string;
    } | null>(null);

    const [announcedProcessIds, setAnnouncedProcessIds] = useState<string[]>(() => {
        try {
            const saved = localStorage.getItem('licitacao_announced_process_ids');
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    });

    const loadedTimestampRef = useRef<number>(Date.now());
    const lastProcessedApprovalTimeRef = useRef<number>(Date.now());
    const sessionDismissedRef = useRef<Set<string>>(new Set());
    const activeModalProcessIdRef = useRef<string | null>(null);

    const triggerModalForProcess = (procData: any) => {
        if (!procData || !procData.id) return;
        const procId = procData.id;

        if (!procData.aprovado_em) return;

        const approvedTime = new Date(procData.aprovado_em).getTime();
        const now = Date.now();
        const ageInMs = now - approvedTime;

        // Se a aprovação foi há mais de 30 segundos ou no futuro descalibrado, ignora
        if (ageInMs > 30000 || ageInMs < -10000) {
            return;
        }

        // Se esta tela foi carregada DEPOIS que o processo já estava aprovado (tolerância 3s), ignora para não rodar no F5
        if (approvedTime < loadedTimestampRef.current - 3000) {
            return;
        }

        // Se já está exibindo este modal ou se já foi dispensado nesta sessão/dispositivo, ignora 100%
        if (activeModalProcessIdRef.current === procId) return;
        if (sessionDismissedRef.current.has(procId)) return;
        if (announcedProcessIds.includes(procId)) return;
        try {
            if (sessionStorage.getItem(`licitacao_dismissed_${procId}`)) return;
        } catch (e) {}

        // Trava imediatamente contra múltiplos disparos simultâneos neste dispositivo
        activeModalProcessIdRef.current = procId;

        // Toca o som exatamente UMA VEZ no momento da ativacao
        playNotificationChimeSound();

        setModalStage('intro');
        setNewApprovedModalProcess({
            id: procId,
            protocolo: procData.protocolo || procId.slice(0, 8),
            solicitante_nome: procData.solicitante_nome || 'Não informado',
            solicitante_setor: procData.solicitante_setor || 'Não informado',
            objeto_resumido: procData.objeto_resumido || procData.finalidade || 'Processo de Licitação',
            aprovado_em: procData.aprovado_em || procData.criado_em
        });
    };

    const handleDismissNewProcessModal = async () => {
        if (!newApprovedModalProcess) return;
        const processId = newApprovedModalProcess.id;
        
        sessionDismissedRef.current.add(processId);
        activeModalProcessIdRef.current = null;

        const updated = Array.from(new Set([...announcedProcessIds, processId]));
        setAnnouncedProcessIds(updated);
        try {
            localStorage.setItem('licitacao_announced_process_ids', JSON.stringify(updated));
            sessionStorage.setItem(`licitacao_dismissed_${processId}`, 'true');
        } catch (e) {}

        setNewApprovedModalProcess(null);

        try {
            await updateMutation.mutateAsync({
                id: processId,
                updates: { apresentado_animacao: true }
            });
        } catch (err) {}
    };

    const playWebAudioChime = () => {
        try {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioContextClass) return;
            const ctx = new AudioContextClass();
            const now = ctx.currentTime;

            const osc1 = ctx.createOscillator();
            const gain1 = ctx.createGain();
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(523.25, now);
            gain1.gain.setValueAtTime(0.2, now);
            gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
            osc1.connect(gain1);
            gain1.connect(ctx.destination);

            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(659.25, now + 0.12);
            gain2.gain.setValueAtTime(0.25, now + 0.12);
            gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
            osc2.connect(gain2);
            gain2.connect(ctx.destination);

            const osc3 = ctx.createOscillator();
            const gain3 = ctx.createGain();
            osc3.type = 'sine';
            osc3.frequency.setValueAtTime(783.99, now + 0.24);
            gain3.gain.setValueAtTime(0.3, now + 0.24);
            gain3.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
            osc3.connect(gain3);
            gain3.connect(ctx.destination);

            osc1.start(now);
            osc1.stop(now + 0.8);
            osc2.start(now + 0.12);
            osc2.stop(now + 1.2);
            osc3.start(now + 0.24);
            osc3.stop(now + 1.5);
        } catch (e) {
            console.warn('Erro no sintetizador de áudio:', e);
        }
    };

    const [customSoundUrl, setCustomSoundUrl] = useState<string | null>(() => {
        try {
            return localStorage.getItem('licitacao_custom_sound_mp3');
        } catch {
            return null;
        }
    });

    const audioFileInputRef = useRef<HTMLInputElement>(null);

    const handleAudioFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.includes('audio') && !file.name.endsWith('.mp3')) {
            alert('Por favor, selecione um arquivo de áudio no formato MP3.');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const dataUrl = event.target?.result as string;
            if (dataUrl) {
                setCustomSoundUrl(dataUrl);
                try {
                    localStorage.setItem('licitacao_custom_sound_mp3', dataUrl);
                } catch (err) {
                    console.warn('Arquivo MP3 grande demais para localStorage local:', err);
                }

                // Reproduzir amostra de teste imediatamente
                try {
                    const sampleAudio = new Audio(dataUrl);
                    sampleAudio.volume = 0.8;
                    sampleAudio.play();
                } catch (e) {}

                // Persistir no organization_settings do Supabase para reproduzir em todos os monitores e telas
                try {
                    supabase
                        .from('organization_settings')
                        .select('ui_config')
                        .eq('id', 'global_config')
                        .single()
                        .then(({ data }) => {
                            const cur = data?.ui_config || {};
                            supabase
                                .from('organization_settings')
                                .update({
                                    ui_config: { ...cur, licitacao_custom_sound_mp3: dataUrl },
                                    updated_at: new Date().toISOString()
                                })
                                .eq('id', 'global_config');
                        });
                } catch (e) {}
            }
        };
        reader.readAsDataURL(file);
    };

    const playNotificationChimeSound = () => {
        try {
            const soundSource = customSoundUrl || '/sounds/novo_processo.mp3';
            const audio = new Audio(soundSource);
            audio.volume = 0.8;
            audio.play().catch(() => {
                const fallbackAudio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
                fallbackAudio.volume = 0.7;
                fallbackAudio.play().catch(() => {
                    playWebAudioChime();
                });
            });
        } catch {
            playWebAudioChime();
        }
    };

    const [modalStage, setModalStage] = useState<'intro' | 'details'>('intro');
    const modalId = newApprovedModalProcess?.id;

    useEffect(() => {
        if (!modalId) return;

        // Estágio 1 (Transição de Anúncio / Surgimento Impactante): 5.0s
        const stage1Timer = setTimeout(() => {
            setModalStage('details');
        }, 5000);

        // Estágio 2 (Exibição dos Detalhes): Encerra o ciclo e finda o modal aos 15.0s totais
        const closeTimer = setTimeout(() => {
            handleDismissNewProcessModal();
        }, 15000);

        return () => {
            clearTimeout(stage1Timer);
            clearTimeout(closeTimer);
        };
    }, [modalId]);

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
        const handleNewApprovedLocalEvent = (e: any) => {
            if (e.detail && e.detail.id) {
                triggerModalForProcess(e.detail);
            }
        };

        window.addEventListener('storage', handleLocalEvent);
        window.addEventListener('licitacao-priority-updated', handleLocalEvent);
        window.addEventListener('storage', handleQueueLocalEvent);
        window.addEventListener('licitacao-queue-priority-updated', handleQueueLocalEvent);
        window.addEventListener('licitacao-new-process-approved', handleNewApprovedLocalEvent);

        // 1. Busca prioridades de fila iniciais do banco
        const fetchDbPriority = async () => {
            try {
                const { data } = await supabase
                    .from('organization_settings')
                    .select('ui_config')
                    .eq('id', 'global_config')
                    .single();
                if (data?.ui_config) {
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

                    if (data.ui_config.licitacao_process_assignments !== undefined) {
                        const dbAssign = data.ui_config.licitacao_process_assignments || {};
                        try { localStorage.setItem('licitacao_process_assignments', JSON.stringify(dbAssign)); } catch (e) {}
                        setProcessAssignments(prev => {
                            if (JSON.stringify(prev) === JSON.stringify(dbAssign)) return prev;
                            return dbAssign;
                        });
                    }
                }
            } catch (e) {
                console.warn('Erro ao carregar prioridade do banco:', e);
            }
        };
        fetchDbPriority();

        // 2. Supabase Realtime Channel para Broadcast instantâneo e Postgres Changes (self: true para escutar própria aba)
        const channel = supabase.channel('licitacao_kanban_priority', { config: { broadcast: { self: true } } })
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
            .on('broadcast', { event: 'licitacao-assignment-updated' }, (data) => {
                if (data.payload !== undefined) {
                    try { localStorage.setItem('licitacao_process_assignments', JSON.stringify(data.payload)); } catch (e) {}
                    setProcessAssignments(data.payload);
                }
            })
            .on('broadcast', { event: 'new-licitacao-process-approved' }, (data) => {
                if (data.payload && data.payload.id) {
                    triggerModalForProcess(data.payload);
                }
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'licitacao_processos' }, (payload: any) => {
                const updated = payload.new;
                if (updated && updated.aprovado_em) {
                    triggerModalForProcess(updated);
                }
            })
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'licitacao_processos' }, (payload: any) => {
                const inserted = payload.new;
                if (inserted && inserted.aprovado_em) {
                    triggerModalForProcess(inserted);
                }
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'organization_settings', filter: 'id=eq.global_config' }, (payload: any) => {
                const newUi = payload.new?.ui_config;
                if (newUi) {
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

        // Native BroadcastChannel para disparo instantâneo inter-abas
        let bc: BroadcastChannel | null = null;
        try {
            bc = new BroadcastChannel('licitacao_kanban_channel');
            bc.onmessage = (event) => {
                if (event.data?.type === 'new-licitacao-process-approved' && event.data?.payload) {
                    triggerModalForProcess(event.data.payload);
                }
            };
        } catch (e) {}

        channelRef.current = channel;

        return () => {
            if (bc) {
                try { bc.close(); } catch (e) {}
            }
            window.removeEventListener('storage', handleLocalEvent);
            window.removeEventListener('licitacao-priority-updated', handleLocalEvent);
            window.removeEventListener('storage', handleQueueLocalEvent);
            window.removeEventListener('licitacao-queue-priority-updated', handleQueueLocalEvent);
            window.removeEventListener('licitacao-new-process-approved', handleNewApprovedLocalEvent);
            supabase.removeChannel(channel);
            channelRef.current = null;
        };
    }, []);

    // Monitora constantemente atualizações da lista de processos para disparar a vinheta em tempo real em todas as telas
    useEffect(() => {
        if (processes && processes.length > 0) {
            processes.forEach(proc => {
                if (proc.aprovado_em) {
                    triggerModalForProcess(proc);
                }
            });
        }
    }, [processes]);

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
            const isApproved = st === 'aprovado' || st === 'approved' || !!process.aprovado_em;

            // Processos NÃO aprovados (Em Aprovação, Em Análise, Rascunho, Rejeitado, Finalizado) NUNCA devem aparecer no Kanban nem na visão TV
            if (!isApproved || st === 'rejeitado' || st === 'rejected' || st === 'finalizado' || st === 'finalized' || st === 'rascunho') {
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
            const isApproved = st === 'aprovado' || st === 'approved' || !!process.aprovado_em;

            if (!isApproved || st === 'rejeitado' || st === 'rejected' || st === 'finalizado' || st === 'finalized' || st === 'rascunho') {
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
        if (!createdAtStr) return '0 DIAS';
        const createdDate = new Date(createdAtStr);
        if (isNaN(createdDate.getTime())) return '0 DIAS';
        
        const now = new Date();
        const cDate = new Date(createdDate.getFullYear(), createdDate.getMonth(), createdDate.getDate());
        const tDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        const diffTime = Math.max(0, tDate.getTime() - cDate.getTime());
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) return '1 DIA';
        return `${diffDays} DIAS`;
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

    if (selectedProcessId) {
        const selectedProcess = processes.find(p => p.id === selectedProcessId);
        if (!selectedProcess) {
            return (
                <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#F8FAFC] h-full">
                    <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-3"></div>
                    <p className="font-bold text-slate-600 text-sm">Carregando detalhes do processo...</p>
                    <button
                        onClick={handleCloseProcessItemPage}
                        className="mt-4 px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs"
                    >
                        Voltar ao Kanban
                    </button>
                </div>
            );
        }

        const assigned = processAssignments[selectedProcess.id];
        const currentPhaseObj = LICITACAO_PHASES.find(p => p.id === (selectedProcess.fase || 'pendente')) || LICITACAO_PHASES[0];
        const PhaseIcon = currentPhaseObj.icon;

        return (
            <div className="flex-1 flex flex-col font-sans bg-[#F8FAFC] h-full overflow-hidden relative z-10 animate-fade-in">
                {/* Header da Página do Item (/Licitacao/Kanban/[id]) */}
                <header className="bg-white border-b border-slate-200 px-4 md:px-8 py-3.5 shadow-xs shrink-0 z-20">
                    <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={handleCloseProcessItemPage}
                                className="w-10 h-10 rounded-2xl bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 flex items-center justify-center text-slate-600 transition-all shadow-xs group cursor-pointer shrink-0"
                                title="Voltar ao Kanban"
                            >
                                <ArrowLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
                            </button>
                            <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-black uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
                                        Protocolo #{selectedProcess.protocolo || selectedProcess.id.slice(0, 8)}
                                    </span>
                                    <span className="text-xs font-extrabold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                                        <Clock className="w-3 h-3 inline mr-1" />
                                        {getDaysElapsed(selectedProcess.criado_em)}
                                    </span>
                                </div>
                                <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight mt-1">
                                    Detalhes da Demanda no Kanban
                                </h1>
                            </div>
                        </div>

                        <button
                            onClick={() => setSelectedProcessForDetails(selectedProcess)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-sm active:scale-95 shrink-0"
                        >
                            <Eye className="w-4 h-4" />
                            Ver Documento Completo
                        </button>
                    </div>
                </header>

                {/* Conteúdo Principal da Página do Item */}
                <div className="flex-1 overflow-y-auto p-4 md:p-8">
                    <div className="max-w-6xl mx-auto space-y-6">
                        
                        {/* CARD 1: TÍTULO RESUMIDO E STATUS ATUAL */}
                        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm space-y-4">
                            <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
                                <span className="text-xs font-black uppercase text-slate-400 tracking-wider">
                                    Título Resumido do Processo
                                </span>
                                <div className="flex items-center gap-2">
                                    <div className={`p-1.5 px-3 rounded-xl border ${currentPhaseObj.badgeColor} flex items-center gap-2 text-xs font-black shadow-2xs`}>
                                        <PhaseIcon className="w-4 h-4" />
                                        <span>Status Atual: {currentPhaseObj.label}</span>
                                    </div>
                                </div>
                            </div>

                            <h2 className="text-xl md:text-2xl font-black text-blue-700 uppercase leading-snug bg-blue-50/70 p-4.5 rounded-xl border border-blue-200/90 shadow-2xs">
                                {objetoResumidoMap[selectedProcess.id] || selectedProcess.objeto_resumido || `#${selectedProcess.protocolo || selectedProcess.id.slice(0, 8)}`}
                            </h2>
                        </div>

                        {/* CARD 2: DEFINIR USUÁRIO RESPONSÁVEL COM SELECT MODERNO E BONITO */}
                        <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-indigo-950 text-white rounded-2xl p-6 shadow-lg border border-indigo-500/40 relative overflow-hidden">
                            <div className="relative z-10 space-y-4">
                                <div className="flex items-center gap-3 border-b border-indigo-500/30 pb-3">
                                    <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center border border-indigo-400/30">
                                        <UserIcon className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-black text-white">
                                            Definir Usuário Responsável (Com a Demanda)
                                        </h3>
                                        <p className="text-xs text-indigo-200/80">
                                            Selecione o membro da equipe de Licitação atribuído para conduzir este processo.
                                        </p>
                                    </div>
                                </div>

                                {/* SELECT MODERNO PARA USUÁRIOS DO TIPO LICITAÇÃO */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center pt-2">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-black uppercase text-indigo-300 tracking-wider block">
                                            Selecione o Usuário (Licitação)
                                        </label>
                                        <div className="relative">
                                            <select
                                                value={assigned?.userId || ''}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    if (!val) {
                                                        handleAssignUser(selectedProcess.id, '', '');
                                                    } else {
                                                        const targetU = licitacaoUsers.find(u => u.id === val);
                                                        if (targetU) {
                                                            handleAssignUser(selectedProcess.id, targetU.id, targetU.name);
                                                        }
                                                    }
                                                }}
                                                className="w-full bg-slate-950/90 border-2 border-indigo-400/50 hover:border-indigo-400 focus:border-amber-400 text-white rounded-xl px-4 py-3 text-sm font-bold shadow-inner outline-none transition-all cursor-pointer appearance-none pr-10"
                                            >
                                                <option value="" className="bg-slate-900 text-slate-400">-- Nenhum usuário atribuído --</option>
                                                {licitacaoUsers.map(u => (
                                                    <option key={u.id} value={u.id} className="bg-slate-900 text-white font-medium py-1">
                                                        {u.name} ({u.jobTitle || u.role || 'Licitação'})
                                                    </option>
                                                ))}
                                            </select>
                                            <ChevronRight className="w-5 h-5 text-indigo-400 absolute right-3 top-1/2 -translate-y-1/2 rotate-90 pointer-events-none" />
                                        </div>
                                    </div>

                                    {/* STATUS DE ATRIBUIÇÃO ATUAL */}
                                    <div className="bg-slate-950/60 border border-indigo-500/30 rounded-xl p-3.5 flex items-center gap-3">
                                        {assigned?.userName ? (
                                            <>
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-black flex items-center justify-center text-sm shadow-md shrink-0 uppercase">
                                                    {assigned.userName.trim().slice(0, 2)}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <span className="text-[10px] font-black uppercase text-emerald-400 tracking-wider block">
                                                        Demanda Atribuída a
                                                    </span>
                                                    <span className="text-sm font-black text-white block truncate">
                                                        {assigned.userName}
                                                    </span>
                                                </div>
                                                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2.5 py-1 rounded-full text-xs font-black shrink-0">
                                                    Ativo
                                                </span>
                                            </>
                                        ) : (
                                            <div className="text-slate-400 text-xs font-medium flex items-center gap-2">
                                                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                                                <span>Nenhum usuário definido com esta demanda ainda.</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* CARD 3: OBJETO COMPLETO, SOLICITANTE E SETOR */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* OBJETO COMPLETO */}
                            <div className="md:col-span-2 bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm space-y-3">
                                <div className="flex items-center gap-2 text-slate-500 border-b border-slate-100 pb-3">
                                    <FileText className="w-4 h-4 text-indigo-600" />
                                    <span className="text-xs font-black uppercase tracking-wider text-slate-700">Objeto Detalhado / Finalidade</span>
                                </div>
                                <p className="text-slate-800 text-sm md:text-base font-medium leading-relaxed whitespace-pre-line">
                                    {selectedProcess.finalidade || 'Nenhuma finalidade descrita.'}
                                </p>
                            </div>

                            {/* SOLICITANTE & SETOR */}
                            <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm space-y-4">
                                <div className="flex items-center gap-2 text-slate-500 border-b border-slate-100 pb-3">
                                    <Landmark className="w-4 h-4 text-indigo-600" />
                                    <span className="text-xs font-black uppercase tracking-wider text-slate-700">Solicitante & Setor</span>
                                </div>

                                <div className="space-y-3">
                                    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">Solicitante</span>
                                        <span className="text-sm font-black text-slate-800 block mt-0.5">{selectedProcess.solicitante_nome}</span>
                                        {selectedProcess.solicitante_cargo && (
                                            <span className="text-xs font-medium text-slate-500 block mt-0.5">{selectedProcess.solicitante_cargo}</span>
                                        )}
                                    </div>

                                    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">Setor Solicitante</span>
                                        <span className="text-sm font-black text-indigo-700 block mt-0.5">{selectedProcess.solicitante_setor}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        );
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

                            <button
                                onClick={() => audioFileInputRef.current?.click()}
                                className="bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 px-3 py-1.5 2xl:px-4 2xl:py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs shrink-0"
                                title="Enviar ou alterar arquivo de áudio MP3 personalizado"
                            >
                                <Volume2 className="w-4 h-4 text-indigo-600 shrink-0" />
                                <span className="hidden sm:inline">{customSoundUrl ? 'Toque MP3 Ativo' : 'Enviar MP3'}</span>
                            </button>
                            <input
                                type="file"
                                ref={audioFileInputRef}
                                accept="audio/mp3,audio/*"
                                onChange={handleAudioFileUpload}
                                className="hidden"
                            />
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

            <div className="flex-1 min-h-0 flex flex-col w-full h-full p-1.5 md:p-2 xl:p-2.5 2xl:p-3 overflow-hidden">
                {isLoading ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3">
                        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                        <p className="font-bold text-sm">Carregando quadro Kanban...</p>
                    </div>
                ) : (
                    <div className="h-full min-h-0 grid grid-cols-5 gap-1.5 md:gap-2 xl:gap-2.5 2xl:gap-3 w-full h-full items-stretch overflow-hidden min-w-0 flex-1">
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
                                    className={`flex flex-col h-full min-h-0 overflow-hidden rounded-xl xl:rounded-2xl border transition-all duration-300 w-full min-w-0 flex-1 max-h-full ${
                                        isPriorityPhase
                                            ? 'ring-4 ring-amber-400 border-amber-400 bg-amber-500/10 shadow-[0_0_30px_rgba(251,191,36,0.35)] scale-[1.01] z-20'
                                            : `${phase.columnBg} ${phase.borderTopColor} border-t-4 border-slate-200/90 shadow-xs`
                                    } ${isOver ? 'ring-2 ring-indigo-500 ring-offset-2 bg-indigo-50/50' : ''}`}
                                >
                                    <div className={`border-b rounded-t-xl flex items-center justify-between sticky top-0 z-10 text-white shadow-xs min-h-[42px] md:min-h-[46px] xl:min-h-[50px] 2xl:min-h-[56px] py-1 px-2 xl:px-2.5 ${
                                        isPriorityPhase
                                            ? 'bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 border-amber-400'
                                            : 'bg-slate-900 border-slate-700/60'
                                    }`}>
                                        <div className="flex items-center gap-1.5 xl:gap-2 min-w-0 flex-1 py-0.5">
                                            <div className={`p-1 xl:p-1.5 2xl:p-2 rounded-lg border shrink-0 ${isPriorityPhase ? 'bg-amber-400 text-amber-950 border-amber-300' : phase.badgeColor}`}>
                                                <IconComponent className="w-3.5 h-3.5 xl:w-4 xl:h-4 2xl:w-5 2xl:h-5" />
                                            </div>
                                            <div className="min-w-0 flex-1 flex flex-col justify-center">
                                                <div className="flex items-center gap-1">
                                                    <h3 className="font-black text-white text-xs xl:text-sm 2xl:text-base tracking-tight leading-tight whitespace-normal break-normal [word-break:normal] [overflow-wrap:normal] hyphens-none drop-shadow-sm">
                                                        {phase.label}
                                                    </h3>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-1 xl:gap-1.5 relative shrink-0">
                                            {isPriorityPhase && (
                                                <span className="px-1.5 py-0.5 rounded-full text-[8px] xl:text-[9px] 2xl:text-xs font-black bg-amber-300 text-amber-950 flex items-center gap-0.5 shadow-md animate-bounce">
                                                    <Zap className="w-2.5 h-2.5 xl:w-3 xl:h-3 fill-amber-950 text-amber-950" /> DESTAQUE
                                                </span>
                                            )}

                                            <span className="px-1.5 py-0.5 xl:px-2 xl:py-0.5 rounded-full text-xs xl:text-sm font-black bg-slate-800 text-slate-100 border border-slate-700 shadow-inner min-w-[20px] xl:min-w-[24px] text-center">
                                                {columnProcesses.length}
                                            </span>

                                            {!isViewOnly && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setOpenPhaseMenu(openPhaseMenu === phase.id ? null : phase.id);
                                                        setOpenCardMenu(null);
                                                    }}
                                                    className="w-5 h-5 xl:w-6 xl:h-6 rounded-md hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
                                                    title="Opções da Fase"
                                                >
                                                    <MoreHorizontal className="w-3.5 h-3.5" />
                                                </button>
                                            )}

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
                                    <ColumnScrollContainer className="p-1 md:p-1.5 xl:p-2 2xl:p-2.5 flex-1 overflow-y-auto space-y-1 md:space-y-1.5 xl:space-y-2 2xl:space-y-2.5 min-h-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                                        {columnProcesses.length === 0 ? (
                                            <div className="h-full min-h-[100px] flex flex-col items-center justify-center text-slate-400 p-3 border-2 border-dashed border-slate-200/60 rounded-xl bg-white/40">
                                                <Layers className="w-6 h-6 opacity-30 mb-1 stroke-[1.5]" />
                                                <span className="text-[11px] font-bold text-slate-400">Nenhum processo</span>
                                                <span className="text-[9px] text-slate-400">nesta etapa</span>
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

                                                    let regularCardClasses = 'bg-white border-slate-200/80 shadow-2xs hover:shadow-md';
                                                    if (isPriorityProcess) {
                                                        regularCardClasses = 'ring-4 ring-amber-400 border-amber-400 bg-amber-50 shadow-[0_0_20px_rgba(251,191,36,0.4)] scale-[1.01] z-20';
                                                    } else if (isQueuePriority) {
                                                        regularCardClasses = 'border-2 border-red-500 bg-gradient-to-br from-red-500/10 via-amber-500/10 to-rose-500/10 ring-2 ring-red-500/30 shadow-[0_0_20px_rgba(239,68,68,0.3)] animate-queue-pulse z-10';
                                                    }

                                                    return (
                                                        <div
                                                            key={process.id}
                                                            draggable={isCanManage}
                                                            onDragStart={(e) => handleDragStart(e, process.id)}
                                                            onClick={() => handleOpenProcessItemPage(process.id)}
                                                            className={`group rounded-xl p-2 xl:p-2.5 2xl:p-3 border transition-all duration-200 cursor-pointer relative overflow-hidden flex flex-col gap-1 xl:gap-1.5 active:scale-[0.99] ${regularCardClasses}`}
                                                        >
                                                            {isPriorityProcess && (
                                                                <div className="bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 px-1.5 py-0.5 rounded-md text-[9px] xl:text-[10px] font-black flex items-center justify-between shadow-xs uppercase tracking-wider">
                                                                    <span className="flex items-center gap-1">
                                                                        <Zap className="w-3 h-3 fill-slate-950 text-slate-950 shrink-0" />
                                                                        Na Sala (TV)
                                                                    </span>
                                                                    {!isViewOnly && (
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                handleClearPriority();
                                                                            }}
                                                                            className="bg-slate-950 hover:bg-slate-900 text-rose-400 hover:text-white px-1.5 py-0.5 rounded text-[9px] font-black flex items-center gap-0.5 transition-all cursor-pointer shadow-xs shrink-0 active:scale-95"
                                                                            title="Desativar Visualização na Sala"
                                                                        >
                                                                            <X className="w-2.5 h-2.5 text-rose-400" /> Desativar
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            )}

                                                            <div className="flex items-center gap-1 xl:gap-1.5 flex-wrap">
                                                                {isQueuePriority && !isPriorityProcess && (
                                                                    <div className="bg-gradient-to-r from-red-600 via-rose-600 to-amber-500 text-white px-1.5 py-0.5 rounded text-[8px] xl:text-[9px] 2xl:text-xs font-black flex items-center gap-1 shadow-md shadow-red-500/30 uppercase tracking-wider w-fit border border-red-400/40 animate-pulse">
                                                                        <Flame className="w-2.5 h-2.5 xl:w-3 xl:h-3 fill-yellow-300 text-yellow-300 shrink-0 animate-bounce" /> PRIORIDADE
                                                                    </div>
                                                                )}
                                                                <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-1.5 py-0.5 rounded text-[8px] xl:text-[9px] 2xl:text-xs font-black flex items-center gap-1 shadow-2xs uppercase tracking-wider w-fit" title="Dias corridos desde a criação">
                                                                    <Clock className="w-2.5 h-2.5 xl:w-3 xl:h-3 text-white shrink-0" />
                                                                    <span>{getDaysElapsed(process.criado_em)}</span>
                                                                </div>
                                                                {(() => {
                                                                    const assignedUser = processAssignments[process.id];
                                                                    const firstName = assignedUser?.userName ? assignedUser.userName.trim().split(' ')[0] : '';
                                                                    if (!firstName) return null;
                                                                    return (
                                                                        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-1.5 py-0.5 rounded text-[8px] xl:text-[9px] 2xl:text-xs font-black flex items-center gap-1 shadow-2xs uppercase tracking-wider w-fit" title={`Demanda com: ${assignedUser.userName}`}>
                                                                            <UserIcon className="w-2.5 h-2.5 xl:w-3 xl:h-3 text-white shrink-0" />
                                                                            <span>{firstName}</span>
                                                                        </div>
                                                                    );
                                                                })()}
                                                            </div>

                                                            <div className="flex items-start justify-between gap-1 relative w-full">
                                                                <span className="font-sans text-[11px] sm:text-xs xl:text-sm 2xl:text-base font-black text-blue-700 uppercase bg-blue-50 px-2 py-0.5 xl:px-2.5 xl:py-1 rounded-md border border-blue-200/90 line-clamp-2 break-normal [word-break:normal] [overflow-wrap:normal] leading-tight shadow-2xs flex-1" title={`Protocolo: #${process.protocolo}`}>
                                                                    {objetoResumidoMap[process.id] || process.objeto_resumido || `#${process.protocolo || process.id.slice(0, 8)}`}
                                                                </span>

                                                                {!isViewOnly && (
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setOpenCardMenu(openCardMenu === process.id ? null : process.id);
                                                                            setOpenPhaseMenu(null);
                                                                        }}
                                                                        className="w-5 h-5 xl:w-6 xl:h-6 rounded-md hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors cursor-pointer shrink-0 mt-0.5"
                                                                        title="Opções do Processo"
                                                                    >
                                                                        <MoreHorizontal className="w-3.5 h-3.5" />
                                                                    </button>
                                                                )}

                                                                {openCardMenu === process.id && !isViewOnly && (
                                                                    <div className="absolute right-0 top-7 z-50 w-48 bg-white border border-slate-200 shadow-xl rounded-xl p-1 text-slate-800 animate-in fade-in zoom-in-95">
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                toggleQueuePriority(process.id);
                                                                            }}
                                                                            className={`w-full text-left px-2.5 py-1.5 text-xs font-bold rounded-lg flex items-center gap-2 cursor-pointer transition-colors ${
                                                                                isQueuePriority ? 'text-red-700 bg-red-50 hover:bg-red-100' : 'text-slate-700 hover:bg-red-50 hover:text-red-700'
                                                                            }`}
                                                                        >
                                                                            <Flame className={`w-3.5 h-3.5 ${isQueuePriority ? 'text-red-600 fill-red-600' : 'text-red-500'}`} />
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

                                                            <div className="flex items-start gap-1 xl:gap-1.5 text-xs text-slate-600 bg-slate-50/80 p-1 xl:p-1.5 rounded-md border border-slate-100 mt-0.5">
                                                                <UserIcon className="w-3 h-3 xl:w-3.5 xl:h-3.5 text-slate-400 shrink-0 mt-0.5" />
                                                                <div className="min-w-0 flex-1 text-[10px] xl:text-[11px] 2xl:text-xs">
                                                                    <span className="font-bold text-slate-800 block break-words leading-tight">{process.solicitante_nome}</span>
                                                                    <span className="text-slate-500 font-medium block break-words text-[9px] xl:text-[10px] 2xl:text-[11px] leading-tight mt-0.5">{process.solicitante_setor}</span>
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
            {/* Modal de Animação em Etapas para Novo Processo Aprovado */}
            {newApprovedModalProcess && (
                <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 sm:p-8 bg-slate-950/98 backdrop-blur-3xl animate-in fade-in duration-500">
                    <style>{`
                        @keyframes stageShrink {
                            from { width: 100%; }
                            to { width: 0%; }
                        }
                    `}</style>
                    <div className="bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 border-2 border-indigo-500/80 rounded-3xl p-6 sm:p-10 max-w-4xl w-full relative overflow-hidden text-white shadow-2xl animate-pop-scale animate-glow-pulse-modal">
                        
                        {/* Efeitos de Luz de Fundo */}
                        <div className="absolute -right-24 -top-24 w-80 h-80 bg-indigo-500/25 rounded-full blur-3xl pointer-events-none animate-pulse" />
                        <div className="absolute -left-24 -bottom-24 w-80 h-80 bg-amber-500/25 rounded-full blur-3xl pointer-events-none" />
                        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-500/15 rounded-full blur-3xl pointer-events-none" />

                        {/* ETAPA 1: ANÚNCIO DE SURGIMENTO IMPACTANTE */}
                        {modalStage === 'intro' ? (
                            <div className="flex flex-col items-center text-center py-6 sm:py-10 space-y-6 animate-in zoom-in-95 fade-in duration-500 relative z-10">
                                {/* Ícone Gigante com Anéis Reluzentes */}
                                <div className="relative">
                                    <div className="absolute inset-0 rounded-3xl bg-amber-400/30 blur-xl animate-ping" />
                                    <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-gradient-to-tr from-amber-500 via-amber-300 to-amber-200 text-amber-950 flex items-center justify-center shadow-[0_0_50px_rgba(245,158,11,0.6)] border-4 border-amber-300 relative z-10 animate-bounce">
                                        <Sparkles className="w-12 h-12 sm:w-14 sm:h-14 fill-amber-950 text-amber-950" />
                                    </div>
                                </div>

                                <div className="space-y-2 max-w-2xl">
                                    <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs sm:text-sm font-black bg-indigo-500/30 text-indigo-300 border border-indigo-400/40 uppercase tracking-widest shadow-inner">
                                        <Radio className="w-4 h-4 text-indigo-400 animate-pulse" />
                                        TRANSMISSÃO EM TEMPO REAL
                                    </span>
                                    <h2 className="text-3xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-amber-200 to-indigo-200 tracking-tight leading-none pt-2">
                                        🎉 NOVO PROCESSO CADASTRADO!
                                    </h2>
                                    <p className="text-slate-300 text-sm sm:text-lg font-medium pt-3 leading-relaxed">
                                        Um novo processo foi aprovado e adicionado automaticamente à fila do Kanban.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            /* ETAPA 2: EXIBIÇÃO COMPLETA DAS INFORMAÇÕES DO PROCESSO */
                            <div className="space-y-6 sm:space-y-8 animate-in fade-in zoom-in-95 duration-500 relative z-10">
                                {/* Cabeçalho da Etapa 2 */}
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-indigo-500/30 pb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-2xl bg-indigo-600/40 border border-indigo-400/50 flex items-center justify-center text-indigo-300 shadow-inner">
                                            <FileText className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <span className="text-[11px] font-black uppercase text-indigo-300 tracking-widest block">
                                                Etapa 2/2 • Detalhes do Processo
                                            </span>
                                            <h3 className="text-xl sm:text-2xl font-black text-white leading-tight">
                                                Processo Adicionado ao Kanban
                                            </h3>
                                        </div>
                                    </div>

                                    {/* Destaque do Protocolo */}
                                    <div className="bg-gradient-to-r from-amber-500/20 via-indigo-500/20 to-amber-500/20 border-2 border-amber-400/60 rounded-2xl px-5 py-2 flex items-center gap-3 shadow-[0_0_30px_rgba(245,158,11,0.2)]">
                                        <Tag className="w-5 h-5 text-amber-400" />
                                        <div>
                                            <span className="text-[10px] font-black text-amber-300 uppercase tracking-widest block">Protocolo</span>
                                            <span className="text-lg sm:text-2xl font-black text-white font-mono">
                                                #{newApprovedModalProcess.protocolo}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Grade Grande de Informações em Destaque (Estilo TV) */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                                    {/* Card Setor Solicitante */}
                                    <div className="bg-slate-900/80 border-2 border-indigo-500/40 rounded-2xl p-5 shadow-lg backdrop-blur-md relative overflow-hidden group hover:border-indigo-400 transition-all">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center border border-indigo-400/30">
                                                <Landmark className="w-5 h-5" />
                                            </div>
                                            <span className="text-xs font-black uppercase tracking-wider text-indigo-300">
                                                Setor Solicitante
                                            </span>
                                        </div>
                                        <p className="text-lg sm:text-xl font-black text-white truncate pl-1">
                                            {newApprovedModalProcess.solicitante_setor || 'Não informado'}
                                        </p>
                                    </div>

                                    {/* Card Responsável */}
                                    <div className="bg-slate-900/80 border-2 border-indigo-500/40 rounded-2xl p-5 shadow-lg backdrop-blur-md relative overflow-hidden group hover:border-indigo-400 transition-all">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center border border-indigo-400/30">
                                                <UserIcon className="w-5 h-5" />
                                            </div>
                                            <span className="text-xs font-black uppercase tracking-wider text-indigo-300">
                                                Responsável
                                            </span>
                                        </div>
                                        <p className="text-lg sm:text-xl font-black text-white truncate pl-1">
                                            {newApprovedModalProcess.solicitante_nome || 'Não informado'}
                                        </p>
                                    </div>

                                    {/* Card Objeto / Finalidade (Full Width) */}
                                    <div className="sm:col-span-2 bg-slate-900/80 border-2 border-indigo-500/40 rounded-2xl p-5 sm:p-6 shadow-lg backdrop-blur-md relative overflow-hidden group hover:border-indigo-400 transition-all">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center border border-amber-400/30">
                                                <FileText className="w-5 h-5" />
                                            </div>
                                            <span className="text-xs font-black uppercase tracking-wider text-amber-300">
                                                Objeto / Finalidade do Processo
                                            </span>
                                        </div>
                                        <p className="text-base sm:text-xl font-extrabold text-amber-100 line-clamp-3 leading-relaxed pl-1">
                                            {objetoResumidoMap[newApprovedModalProcess.id] || newApprovedModalProcess.objeto_resumido}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
            </div>
        </div>
    );
};
