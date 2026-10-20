import React, { useState, useEffect, useMemo } from 'react';
import { User, ConsultaProcedimento, ConsultaAgendamento, ConsultaVaga, ConsultaEspecialista } from '../../types';
import { 
    ArrowLeft, Settings, Plus, Edit2, Search, Check, AlertTriangle, 
    Loader2, X, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Activity, Stethoscope, 
    Sparkles, Trash2, PauseCircle, PlayCircle, Calendar, Filter,
    CheckCircle2, Clock, Users, ShieldAlert, Layers, UserCheck, ToggleLeft, ToggleRight
} from 'lucide-react';
import * as db from '../../services/consultasService';
import { formatProcedimentoLabel } from '../../services/consultasService';
import { seedDefaultProcedures } from '../../services/procedimentosSeed';
import { formatPatientName } from '../common/PacientesTab';

interface ProcedimentosScreenProps {
    currentUser?: User | null;
    onBack?: () => void;
    onNavigate?: (view: string) => void;
    embedded?: boolean;
}

export const ProcedimentosScreen: React.FC<ProcedimentosScreenProps> = ({
    currentUser,
    onBack,
    onNavigate,
    embedded = false
}) => {
    const [gestorUserIds, setGestorUserIds] = useState<string[]>([]);

    useEffect(() => {
        const fetchGestores = async () => {
            try {
                const gestores = await db.getConsultasGestores();
                setGestorUserIds(gestores);
            } catch (err) {
                console.error('Error fetching gestores in ProcedimentosScreen:', err);
            }
        };
        fetchGestores();
    }, []);

    const isAdmin = currentUser?.role === 'admin';
    const isGestor = !!(currentUser && (
        gestorUserIds.includes(currentUser.id) || 
        currentUser.permissions?.includes('parent_consultas_gestor') || 
        currentUser.permissions?.includes('sub_consultas_gestor')
    ));
    const canAddRetroativo = isAdmin || isGestor;
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    // Procedures & Especialistas Data & Filter States
    const [procedures, setProcedures] = useState<ConsultaProcedimento[]>([]);
    const [especialistas, setEspecialistas] = useState<ConsultaEspecialista[]>([]);
    const [procSearch, setProcSearch] = useState('');
    const [selectedTypeFilter, setSelectedTypeFilter] = useState<'Todos' | 'Exame' | 'Consulta' | 'Cirurgia'>('Todos');
    const [selectedStatusFilter, setSelectedStatusFilter] = useState<'Todos' | 'Ativos' | 'Suspensos'>('Todos');

    // Procedure Modal State (Create / Edit)
    const [isProcModalOpen, setIsProcModalOpen] = useState(false);
    const [editingProc, setEditingProc] = useState<ConsultaProcedimento | null>(null);
    const [procName, setProcName] = useState('');
    const [procCode, setProcCode] = useState('');
    const [procType, setProcType] = useState<'Exame' | 'Consulta' | 'Cirurgia'>('Exame');
    const [procStatus, setProcStatus] = useState<'Ativo' | 'Inativo'>('Ativo');
    const [procRecurso, setProcRecurso] = useState<'Não Se Aplica' | 'FM' | 'PPI'>('Não Se Aplica');
    const [procError, setProcError] = useState('');

    // Modal Adicionar Especialista State
    const [isAddEspecialistaModalOpen, setIsAddEspecialistaModalOpen] = useState(false);
    const [selectedParentProcId, setSelectedParentProcId] = useState('');
    const [addEspSearchParent, setAddEspSearchParent] = useState('');
    const [isParentDropdownOpen, setIsParentDropdownOpen] = useState(false);
    const [selectedAddEspecialistaId, setSelectedAddEspecialistaId] = useState('');
    const [addEspSearchMedico, setAddEspSearchMedico] = useState('');
    const [isMedicoDropdownOpen, setIsMedicoDropdownOpen] = useState(false);
    const [addEspecialistaStatus, setAddEspecialistaStatus] = useState<'Ativo' | 'Inativo'>('Ativo');
    const [addEspecialistaError, setAddEspecialistaError] = useState('');

    // Accordion State: quais procedimentos principais estão expandidos na listagem
    const [expandedParentIds, setExpandedParentIds] = useState<Record<string, boolean>>({});

    const toggleExpandParent = (parentId: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setExpandedParentIds(prev => ({
            ...prev,
            [parentId]: !prev[parentId]
        }));
    };

    // Detail & Slots (Vagas) State
    const [selectedProc, setSelectedProc] = useState<ConsultaProcedimento | null>(null);
    const [vagas, setVagas] = useState<ConsultaVaga[]>([]);
    const [procBookings, setProcBookings] = useState<ConsultaAgendamento[]>([]);
    const [isAddVagasModalOpen, setIsAddVagasModalOpen] = useState(false);

    // Calendar Picker Modal States
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
    const [selectedTimes, setSelectedTimes] = useState<string[]>([]);
    const [customTime, setCustomTime] = useState('');

    // Notification / Toast Feedback
    const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

    const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
        setToastMessage({ type, text });
        setTimeout(() => setToastMessage(null), 3500);
    };

    const matchTime = (timeA: string, timeB: string) => {
        const cleanA = timeA.substring(0, 5);
        const cleanB = timeB.substring(0, 5);
        return cleanA === cleanB;
    };

    const formatDateToYYYYMMDD = (date: Date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDayIndex = new Date(year, month, 1).getDay();
        const totalDays = new Date(year, month + 1, 0).getDate();
        
        const days = [];
        for (let i = 0; i < firstDayIndex; i++) {
            days.push(null);
        }
        for (let i = 1; i <= totalDays; i++) {
            days.push(new Date(year, month, i));
        }
        return days;
    };

    // Slot assignments mapping for detail view
    const slotAssignments = useMemo(() => {
        const assignments = new Map<string, ConsultaAgendamento>();
        
        const slotsByDate: { [date: string]: ConsultaVaga[] } = {};
        vagas.forEach(v => {
            if (!slotsByDate[v.data]) {
                slotsByDate[v.data] = [];
            }
            slotsByDate[v.data].push(v);
        });

        const bookingsByDate: { [date: string]: ConsultaAgendamento[] } = {};
        procBookings.forEach(b => {
            if (b.status === 'Cancelado' || b.status === 'Não Realizado' || !b.appointment_date) return;
            if (!bookingsByDate[b.appointment_date]) {
                bookingsByDate[b.appointment_date] = [];
            }
            bookingsByDate[b.appointment_date].push(b);
        });

        Object.keys(slotsByDate).forEach(dateStr => {
            const slots = slotsByDate[dateStr];
            const bookings = bookingsByDate[dateStr] || [];
            
            const unmatchedBookings = [...bookings];
            const matchedBookingIds = new Set<string>();

            // 1st pass: exact times
            slots.forEach(slot => {
                const exactMatch = bookings.find(b => 
                    b.appointment_time && 
                    matchTime(b.appointment_time, slot.hora) &&
                    !matchedBookingIds.has(b.id)
                );
                if (exactMatch) {
                    assignments.set(slot.id, exactMatch);
                    matchedBookingIds.add(exactMatch.id);
                    const idx = unmatchedBookings.findIndex(b => b.id === exactMatch.id);
                    if (idx > -1) {
                        unmatchedBookings.splice(idx, 1);
                    }
                }
            });

            // 2nd pass: remaining unmatched slots
            slots.forEach(slot => {
                if (!assignments.has(slot.id) && unmatchedBookings.length > 0) {
                    const nextBooking = unmatchedBookings.shift()!;
                    assignments.set(slot.id, nextBooking);
                }
            });
        });

        return assignments;
    }, [vagas, procBookings]);

    // Load all procedures & especialistas
    const fetchProcedures = async () => {
        setLoading(true);
        try {
            const [procsData, espsData] = await Promise.all([
                db.getProcedimentos(),
                db.getEspecialistas()
            ]);
            setProcedures(procsData || []);
            setEspecialistas(espsData || []);
        } catch (error) {
            console.error('Erro ao carregar procedimentos:', error);
            showToast('Erro ao carregar lista de procedimentos.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const reloadVagas = async () => {
        if (!selectedProc) return;
        try {
            const [vagasData, bookingsData, procData, espsData] = await Promise.all([
                db.getVagas(selectedProc.id),
                db.getAgendamentos({ procedimentoId: selectedProc.id }),
                db.getProcedimentos(),
                db.getEspecialistas()
            ]);
            setVagas(vagasData);
            setProcBookings(bookingsData);
            setProcedures(procData);
            setEspecialistas(espsData || []);

            const updated = procData.find(p => p.id === selectedProc.id);
            if (updated) {
                setSelectedProc(updated);
            }
        } catch (err) {
            console.error('Erro ao recarregar vagas:', err);
        }
    };

    useEffect(() => {
        fetchProcedures();
    }, []);

    useEffect(() => {
        if (selectedProc) {
            const fetchDetail = async () => {
                setLoading(true);
                try {
                    const [vagasData, bookingsData] = await Promise.all([
                        db.getVagas(selectedProc.id),
                        db.getAgendamentos({ procedimentoId: selectedProc.id })
                    ]);
                    setVagas(vagasData);
                    setProcBookings(bookingsData);
                } catch (err) {
                    console.error('Erro ao carregar detalhes do procedimento:', err);
                } finally {
                    setLoading(false);
                }
            };
            fetchDetail();
        }
    }, [selectedProc]);

    // Sync with realtime events
    useEffect(() => {
        const handleSync = () => {
            fetchProcedures();
            if (selectedProc) {
                reloadVagas();
            }
        };

        window.addEventListener('consultas-procedimentos-changed', handleSync);
        window.addEventListener('consultas-especialistas-changed', handleSync);
        window.addEventListener('consultas-vagas-changed', handleSync);
        window.addEventListener('consultas-agendamentos-changed', handleSync);

        return () => {
            window.removeEventListener('consultas-procedimentos-changed', handleSync);
            window.removeEventListener('consultas-especialistas-changed', handleSync);
            window.removeEventListener('consultas-vagas-changed', handleSync);
            window.removeEventListener('consultas-agendamentos-changed', handleSync);
        };
    }, [selectedProc]);

    // Procedures Filtering
    const filteredProcedures = useMemo(() => {
        return procedures.filter(p => {
            const label = formatProcedimentoLabel(p, especialistas);
            // Text Search
            const matchesText = 
                label.toLowerCase().includes(procSearch.toLowerCase()) ||
                p.name.toLowerCase().includes(procSearch.toLowerCase()) ||
                (p.code && p.code.toLowerCase().includes(procSearch.toLowerCase())) ||
                p.type.toLowerCase().includes(procSearch.toLowerCase()) ||
                (p.recurso && p.recurso.toLowerCase().includes(procSearch.toLowerCase()));

            if (!matchesText) return false;

            // Type Filter
            if (selectedTypeFilter !== 'Todos' && p.type !== selectedTypeFilter) {
                return false;
            }

            // Status Filter
            if (selectedStatusFilter === 'Ativos' && p.status !== 'Ativo') {
                return false;
            }
            if (selectedStatusFilter === 'Suspensos' && p.status === 'Ativo') {
                return false;
            }

            return true;
        });
    }, [procedures, especialistas, procSearch, selectedTypeFilter, selectedStatusFilter]);

    // Procedimentos agrupados hierarquicamente: Pais (sem parent_id e sem especialista) e Filhos (vinculados a especialistas)
    const hierarchicalProcedures = useMemo(() => {
        // Procedimentos pais são aqueles que não possuem parent_id e não possuem especialista_id direto
        const parents = procedures.filter(p => !p.parent_id && !p.especialista_id);
        
        // Mapear filhos para cada pai
        const childrenByParent = new Map<string, ConsultaProcedimento[]>();
        
        // Filhos reais com parent_id ou que têm código derivado (ex: 0397-10) ou possuem especialista_id
        procedures.forEach(p => {
            if (p.parent_id) {
                const list = childrenByParent.get(p.parent_id) || [];
                list.push(p);
                childrenByParent.set(p.parent_id, list);
            } else if (p.code && p.code.includes('-')) {
                const parentCode = p.code.split('-')[0];
                const matchingParent = parents.find(parent => parent.code === parentCode);
                if (matchingParent) {
                    const list = childrenByParent.get(matchingParent.id) || [];
                    if (!list.some(existing => existing.id === p.id)) {
                        list.push(p);
                        childrenByParent.set(matchingParent.id, list);
                    }
                }
            } else if (p.especialista_id) {
                // Procedimento legado com especialista direto que não tem parent_id explícito
                // Se houver um pai com mesmo tipo ou prefixo, associa; senão, trata individualmente
                const matchingParent = parents.find(parent => p.name.toUpperCase().startsWith(parent.name.toUpperCase()) && parent.id !== p.id);
                if (matchingParent) {
                    const list = childrenByParent.get(matchingParent.id) || [];
                    if (!list.some(existing => existing.id === p.id)) {
                        list.push(p);
                        childrenByParent.set(matchingParent.id, list);
                    }
                }
            }
        });

        // Filtragem inteligente da lista
        const cleanSearch = procSearch.toLowerCase().trim();

        const filteredParents = parents.filter(parent => {
            const children = childrenByParent.get(parent.id) || [];

            // Tipo Filter
            if (selectedTypeFilter !== 'Todos' && parent.type !== selectedTypeFilter) {
                return false;
            }

            // Status Filter
            if (selectedStatusFilter === 'Ativos' && parent.status !== 'Ativo') {
                return false;
            }
            if (selectedStatusFilter === 'Suspensos' && parent.status === 'Ativo') {
                return false;
            }

            // Busca de texto: por código pai, nome do procedimento, código do filho ou nome do médico
            if (cleanSearch) {
                const parentMatches = 
                    (parent.code && parent.code.toLowerCase().includes(cleanSearch)) ||
                    parent.name.toLowerCase().includes(cleanSearch) ||
                    parent.type.toLowerCase().includes(cleanSearch);

                const childMatches = children.some(child => {
                    const espName = child.especialista?.nome || especialistas.find(e => e.id === child.especialista_id)?.nome || '';
                    return (
                        (child.code && child.code.toLowerCase().includes(cleanSearch)) ||
                        child.name.toLowerCase().includes(cleanSearch) ||
                        espName.toLowerCase().includes(cleanSearch)
                    );
                });

                return parentMatches || childMatches;
            }

            return true;
        });

        return {
            parents: filteredParents,
            allParents: parents,
            childrenByParent
        };
    }, [procedures, especialistas, procSearch, selectedTypeFilter, selectedStatusFilter]);

    // Metrics summary (apenas procedimentos principais contabilizados nas métricas de procedimentos)
    const metrics = useMemo(() => {
        const parents = procedures.filter(p => !p.parent_id && !p.especialista_id);
        const total = parents.length;
        const ativos = parents.filter(p => p.status === 'Ativo').length;
        const suspensos = parents.filter(p => p.status !== 'Ativo').length;
        const totalCotas = procedures.reduce((sum, p) => sum + Math.max(0, p.available_quantity || 0), 0);
        return { total, ativos, suspensos, totalCotas };
    }, [procedures]);

    // Modal Handlers: Novo Procedimento Principal
    const handleOpenProcModal = (proc: ConsultaProcedimento | null = null) => {
        setEditingProc(proc);
        if (proc) {
            setProcName(proc.name);
            setProcCode(proc.code || '');
            setProcType(proc.type);
            setProcStatus(proc.status);
            setProcRecurso(proc.recurso || 'Não Se Aplica');
        } else {
            setProcName('');
            // Auto-generate next 4-digit code para procedimento principal
            const nextNum = procedures.reduce((max, p) => {
                if (p.code && /^\d{4}$/.test(p.code)) {
                    const codeNum = parseInt(p.code, 10);
                    return isNaN(codeNum) ? max : Math.max(max, codeNum);
                }
                return max;
            }, 0) + 1;
            setProcCode(String(nextNum).padStart(4, '0'));
            setProcType(selectedTypeFilter !== 'Todos' ? selectedTypeFilter : 'Exame');
            setProcStatus('Ativo');
            setProcRecurso('Não Se Aplica');
        }
        setProcError('');
        setIsProcModalOpen(true);
    };

    const handleSaveProcedure = async (e: React.FormEvent) => {
        e.preventDefault();
        setProcError('');

        if (!procName.trim()) {
            setProcError('Nome do procedimento é obrigatório.');
            return;
        }

        // Garante código automático sequencial de 4 dígitos caso esteja vazio
        let finalCode = procCode;
        if (!finalCode || !/^\d{4}$/.test(finalCode)) {
            const nextNum = procedures.reduce((max, p) => {
                if (p.code && /^\d{4}$/.test(p.code)) {
                    const codeNum = parseInt(p.code, 10);
                    return isNaN(codeNum) ? max : Math.max(max, codeNum);
                }
                return max;
            }, 0) + 1;
            finalCode = String(nextNum).padStart(4, '0');
            setProcCode(finalCode);
        }

        // Check for duplicate name + type em procedimentos principais
        const isDuplicate = procedures.some(p => 
            !p.parent_id &&
            p.name.trim().toUpperCase() === procName.trim().toUpperCase() &&
            p.type === procType &&
            (!editingProc || p.id !== editingProc.id)
        );

        if (isDuplicate) {
            setProcError('Já existe um procedimento principal cadastrado com o mesmo nome e tipo.');
            return;
        }

        setActionLoading('save-proc');
        try {
            if (editingProc) {
                await db.updateProcedimento(editingProc.id, {
                    name: procName.trim().toUpperCase(),
                    code: finalCode,
                    type: procType,
                    status: procStatus,
                    recurso: procRecurso || 'Não Se Aplica'
                });
                showToast(`Procedimento atualizado com sucesso!`);
            } else {
                await db.createProcedimento({
                    name: procName.trim().toUpperCase(),
                    code: finalCode,
                    type: procType,
                    total_quantity: 0,
                    available_quantity: 0,
                    status: procStatus,
                    recurso: 'Não Se Aplica'
                });
                showToast(`Procedimento principal cadastrado com sucesso!`);
            }
            setIsProcModalOpen(false);
            fetchProcedures();
        } catch (err: any) {
            if (err.message && (err.message.includes('unique_procedimento_nome_tipo') || err.message.includes('unique constraint') || err.message.includes('duplicate key'))) {
                setProcError('Já existe um procedimento cadastrado com o mesmo nome e tipo.');
            } else {
                setProcError(err.message || 'Erro ao salvar procedimento.');
            }
        } finally {
            setActionLoading(null);
        }
    };

    // Modal Handlers: Adicionar Especialista
    const handleOpenAddEspecialistaModal = (defaultParentId?: string) => {
        setSelectedParentProcId(defaultParentId || '');
        setAddEspSearchParent('');
        setIsParentDropdownOpen(false);
        setSelectedAddEspecialistaId('');
        setAddEspSearchMedico('');
        setIsMedicoDropdownOpen(false);
        setAddEspecialistaStatus('Ativo');
        setAddEspecialistaError('');
        setIsAddEspecialistaModalOpen(true);
    };

    const handleSaveEspecialistaVinculo = async (e: React.FormEvent) => {
        e.preventDefault();
        setAddEspecialistaError('');

        if (!selectedParentProcId) {
            setAddEspecialistaError('Selecione o procedimento principal.');
            return;
        }
        if (!selectedAddEspecialistaId) {
            setAddEspecialistaError('Selecione o especialista responsável.');
            return;
        }

        setActionLoading('save-vinculo-esp');
        try {
            const novoVinculo = await db.vincularEspecialistaProcedimento({
                parentId: selectedParentProcId,
                especialistaId: selectedAddEspecialistaId,
                status: addEspecialistaStatus
            });

            // Expande automaticamente o pai na listagem para visualização imediata do novo especialista
            setExpandedParentIds(prev => ({
                ...prev,
                [selectedParentProcId]: true
            }));

            setIsAddEspecialistaModalOpen(false);
            showToast(`Especialista vinculado com sucesso! Código gerado: ${novoVinculo.code}`);
            await fetchProcedures();
        } catch (err: any) {
            setAddEspecialistaError(err.message || 'Erro ao vincular especialista ao procedimento.');
        } finally {
            setActionLoading(null);
        }
    };

    // Single-click Quick Suspend / Reativar
    const handleToggleSuspend = async (e: React.MouseEvent, proc: ConsultaProcedimento) => {
        e.stopPropagation();
        const nextStatus: 'Ativo' | 'Inativo' = proc.status === 'Ativo' ? 'Inativo' : 'Ativo';
        const actionLabel = nextStatus === 'Ativo' ? 'Reativar' : 'Suspender';

        setActionLoading(`suspend-${proc.id}`);
        try {
            await db.updateProcedimento(proc.id, { status: nextStatus });
            setProcedures(prev => prev.map(p => p.id === proc.id ? { ...p, status: nextStatus } : p));
            if (selectedProc && selectedProc.id === proc.id) {
                setSelectedProc(prev => prev ? { ...prev, status: nextStatus } : null);
            }
            showToast(
                nextStatus === 'Ativo'
                    ? `Procedimento "${proc.name}" reativado com sucesso!`
                    : `Procedimento "${proc.name}" suspenso temporariamente.`,
                nextStatus === 'Ativo' ? 'success' : 'info'
            );
        } catch (err: any) {
            console.error(`Erro ao ${actionLabel.toLowerCase()} procedimento:`, err);
            showToast(`Erro ao ${actionLabel.toLowerCase()} procedimento.`, 'error');
        } finally {
            setActionLoading(null);
        }
    };

    // Delete Procedure
    const handleDeleteProcedure = async (e: React.MouseEvent | null, procId: string, procName?: string) => {
        if (e) e.stopPropagation();
        const nameText = procName ? ` "${procName}"` : '';
        if (!window.confirm(`ATENÇÃO: Deseja realmente excluir o procedimento${nameText}? Esta ação não pode ser desfeita.`)) return;

        setActionLoading(`del-${procId}`);
        try {
            await db.deleteProcedimento(procId);
            showToast('Procedimento excluído com sucesso!');
            if (selectedProc && selectedProc.id === procId) {
                setSelectedProc(null);
            }
            fetchProcedures();
        } catch (err: any) {
            console.error('Erro ao excluir procedimento:', err);
            alert(err.message || 'Erro ao excluir procedimento.');
        } finally {
            setActionLoading(null);
        }
    };

    // Seed default procedures
    const handleSeedProcedures = async () => {
        setActionLoading('seed');
        try {
            const count = await seedDefaultProcedures();
            await fetchProcedures();
            showToast(`${count} procedimentos padrão cadastrados com sucesso!`);
        } catch (err: any) {
            console.error('Erro ao popular procedimentos:', err);
            showToast(err.message || 'Erro ao cadastrar procedimentos padrão.', 'error');
        } finally {
            setActionLoading(null);
        }
    };

    // Time slots helper
    const toggleTime = (time: string) => {
        if (selectedTimes.includes(time)) {
            setSelectedTimes(selectedTimes.filter(t => t !== time));
        } else {
            setSelectedTimes([...selectedTimes, time]);
        }
    };

    const addCustomTime = () => {
        if (!customTime) return;
        if (!selectedTimes.includes(customTime)) {
            setSelectedTimes([...selectedTimes, customTime]);
        }
        setCustomTime('');
    };

    const handleConfirmAddVagas = async () => {
        if (!selectedProc || !selectedDate || selectedTimes.length === 0) return;
        const formattedDate = formatDateToYYYYMMDD(selectedDate);
        
        setActionLoading('add-vagas');
        try {
            const newVagas = selectedTimes.map(hora => ({
                procedimento_id: selectedProc.id,
                data: formattedDate,
                hora: hora.length === 5 ? `${hora}:00` : hora,
                status: 'Disponível' as const
            }));

            await db.createVagas(newVagas);
            setSelectedTimes([]);
            setIsAddVagasModalOpen(false);
            await reloadVagas();
            showToast(`${newVagas.length} vaga(s) alocada(s) para ${selectedDate.toLocaleDateString('pt-BR')}!`);
        } catch (err) {
            console.error('Erro ao criar vagas:', err);
            showToast('Erro ao criar vagas.', 'error');
        } finally {
            setActionLoading(null);
        }
    };

    const handleDeleteSlot = async (slotId: string) => {
        if (!window.confirm('Deseja realmente excluir este horário de vaga?')) return;
        setActionLoading(`del-slot-${slotId}`);
        try {
            await db.deleteVaga(slotId);
            await reloadVagas();
            showToast('Vaga excluída com sucesso.');
        } catch (err) {
            console.error('Erro ao excluir vaga:', err);
            showToast('Erro ao excluir vaga.', 'error');
        } finally {
            setActionLoading(null);
        }
    };

    const handleTogglePauseSlot = async (slot: ConsultaVaga) => {
        setActionLoading(`toggle-slot-${slot.id}`);
        try {
            if (slot.status === 'Pausada') {
                await db.unpauseVaga(slot.id);
                showToast('Vaga reativada com sucesso.');
            } else {
                await db.pauseVaga(slot.id);
                showToast('Vaga pausada temporariamente.', 'info');
            }
            await reloadVagas();
        } catch (err: any) {
            console.error('Erro ao pausar/despausar vaga:', err);
            showToast('Erro ao alternar status da vaga.', 'error');
        } finally {
            setActionLoading(null);
        }
    };

    return (
        <div className={`w-full flex flex-col flex-1 h-full max-h-full min-h-0 bg-white rounded-3xl border border-slate-200/80 shadow-xl overflow-hidden relative ${embedded ? 'border-none shadow-none rounded-none' : 'max-w-[98%] 2xl:max-w-[1536px] mx-auto'}`}>
            
            {/* Top Toast Alert */}
            {toastMessage && (
                <div className={`fixed top-5 right-5 z-[9999] px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-2.5 text-xs font-bold animate-in fade-in slide-in-from-top-3 duration-300 ${
                    toastMessage.type === 'success' 
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200 shadow-emerald-500/10' 
                        : toastMessage.type === 'error'
                        ? 'bg-rose-50 text-rose-800 border-rose-200 shadow-rose-500/10'
                        : 'bg-amber-50 text-amber-800 border-amber-200 shadow-amber-500/10'
                }`}>
                    {toastMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                    {toastMessage.type === 'error' && <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />}
                    {toastMessage.type === 'info' && <PauseCircle className="w-4 h-4 text-amber-600 shrink-0" />}
                    <span>{toastMessage.text}</span>
                </div>
            )}

            {/* Header (apenas quando não embutido) */}
            {!embedded && (
                <div className="px-6 py-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-50/80 to-white shrink-0">
                    <div className="flex items-center gap-3">
                        {onBack && (
                            <button 
                                onClick={onBack} 
                                className="p-2 -ml-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                                title="Voltar ao Módulo de Consultas"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                        )}
                        <div>
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-sky-50 text-sky-600 border border-sky-100 rounded-lg">
                                    <Settings className="w-4 h-4" />
                                </div>
                                <h3 className="font-extrabold text-slate-900 tracking-tight text-lg uppercase">Gestão de Procedimentos</h3>
                            </div>
                            <p className="text-xs text-slate-500 font-medium mt-0.5">Cadastre, edite, suspenda ou configure vagas para exames, consultas e cirurgias</p>
                        </div>
                    </div>

                    {/* Quick Metrics Cards */}
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl shadow-xs">
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total</span>
                            <span className="text-xs font-black text-slate-800">{metrics.total}</span>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl shadow-xs">
                            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700">Ativos</span>
                            <span className="text-xs font-black text-emerald-800">{metrics.ativos}</span>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-xl shadow-xs">
                            <span className="text-[10px] font-black uppercase tracking-wider text-amber-700">Suspensos</span>
                            <span className="text-xs font-black text-amber-800">{metrics.suspensos}</span>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 border border-indigo-200 rounded-xl shadow-xs">
                            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700">Cotas</span>
                            <span className="text-xs font-black text-indigo-800">{metrics.totalCotas}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Content Area */}
            <div className="flex-1 overflow-auto bg-slate-50/20 p-4 md:p-6 min-h-0 custom-scrollbar">
                {selectedProc ? (
                    /* ======================================================= */
                    /* DETALHES DO PROCEDIMENTO SELECIONADO & VAGAS            */
                    /* ======================================================= */
                    (() => {
                        const groupedVagas: Record<string, ConsultaVaga[]> = {};
                        vagas.forEach(v => {
                            if (!groupedVagas[v.data]) {
                                groupedVagas[v.data] = [];
                            }
                            groupedVagas[v.data].push(v);
                        });

                        const sortedDates = Object.keys(groupedVagas).sort();
                        const busyVagas = vagas.filter(v => slotAssignments.has(v.id)).length;
                        const availableVagas = vagas.filter(v => !slotAssignments.has(v.id)).length;

                        return (
                            <div className="space-y-6">
                                {/* Detail Header */}
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200/80 gap-3">
                                    <div className="flex items-center gap-3">
                                        <button 
                                            onClick={() => setSelectedProc(null)} 
                                            className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                                            title="Voltar para Lista de Procedimentos"
                                        >
                                            <ArrowLeft className="w-5 h-5" />
                                        </button>
                                        <div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h4 className="font-black text-slate-900 text-base sm:text-lg uppercase">
                                                    {formatProcedimentoLabel(selectedProc, especialistas)}
                                                </h4>
                                                {selectedProc.code && (
                                                    <span className="text-[10px] text-slate-600 font-extrabold bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                                        CÓD. {selectedProc.code}
                                                    </span>
                                                )}
                                                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                                                    selectedProc.type === 'Exame' 
                                                        ? 'bg-sky-50 text-sky-600 border border-sky-100' 
                                                        : selectedProc.type === 'Consulta'
                                                        ? 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                                                        : 'bg-rose-50 text-rose-600 border border-rose-100'
                                                }`}>
                                                    {selectedProc.type}
                                                </span>
                                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide border ${
                                                    selectedProc.status === 'Ativo' 
                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                                        : 'bg-amber-50 text-amber-700 border-amber-200'
                                                }`}>
                                                    {selectedProc.status === 'Ativo' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                                                    {selectedProc.status === 'Ativo' ? 'Ativo' : 'Suspenso / Inativo'}
                                                </span>
                                            </div>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Gestão de Vagas por Horário e Agendamentos</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={(e) => handleToggleSuspend(e, selectedProc)}
                                            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5 border transition-all active:scale-95 shadow-xs cursor-pointer ${
                                                selectedProc.status === 'Ativo'
                                                    ? 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200'
                                                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                                            }`}
                                            title={selectedProc.status === 'Ativo' ? 'Suspender Procedimento' : 'Reativar Procedimento'}
                                        >
                                            {selectedProc.status === 'Ativo' ? (
                                                <>
                                                    <PauseCircle className="w-4 h-4 text-amber-600" />
                                                    <span>Suspender</span>
                                                </>
                                            ) : (
                                                <>
                                                    <PlayCircle className="w-4 h-4 text-emerald-600" />
                                                    <span>Reativar</span>
                                                </>
                                            )}
                                        </button>

                                        <button
                                            onClick={() => handleOpenProcModal(selectedProc)}
                                            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold rounded-xl text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                                        >
                                            <Edit2 className="w-3.5 h-3.5" />
                                            <span>Editar</span>
                                        </button>

                                        <button
                                            onClick={() => {
                                                setSelectedDate(new Date());
                                                setCurrentMonth(new Date());
                                                setSelectedTimes([]);
                                                setIsAddVagasModalOpen(true);
                                            }}
                                            className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-extrabold rounded-xl shadow-md hover:shadow-sky-500/10 active:scale-95 transition-all text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer"
                                        >
                                            <Plus className="w-4 h-4" />
                                            <span>Adicionar Vagas</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Stats grid */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div className="p-4 bg-slate-50 border border-slate-200/60 rounded-2xl shadow-xs flex flex-col justify-between">
                                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">Vagas Totais Cadastradas</span>
                                        <span className="text-2xl font-black text-slate-800">{vagas.length}</span>
                                    </div>
                                    <div className="p-4 bg-emerald-50 border border-emerald-100/60 rounded-2xl shadow-xs flex flex-col justify-between">
                                        <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600 block mb-1">Disponíveis para Agendamento</span>
                                        <span className="text-2xl font-black text-emerald-700">{availableVagas}</span>
                                    </div>
                                    <div className="p-4 bg-indigo-50 border border-indigo-100/60 rounded-2xl shadow-xs flex flex-col justify-between">
                                        <span className="text-[9px] font-black uppercase tracking-widest text-indigo-600 block mb-1">Agendadas (Ocupadas)</span>
                                        <span className="text-2xl font-black text-indigo-700">{busyVagas}</span>
                                    </div>
                                </div>

                                {/* Slots Grouped by Date */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h5 className="text-xs font-black uppercase text-slate-700 tracking-wider">Horários Alocados por Data</h5>
                                        <span className="text-[10px] font-bold text-slate-400">{sortedDates.length} data(s) com vagas</span>
                                    </div>
                                    
                                    {sortedDates.length > 0 ? (
                                        <div className="space-y-3">
                                            {sortedDates.map(dateStr => {
                                                const slots = groupedVagas[dateStr];
                                                const formattedDate = new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
                                                
                                                return (
                                                    <div key={dateStr} className="p-5 bg-white border border-slate-200/80 rounded-2xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                                        <div>
                                                            <span className="text-xs font-extrabold text-slate-800 block capitalize">{formattedDate}</span>
                                                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mt-0.5">{slots.length} vaga(s) cadastrada(s)</span>
                                                        </div>
                                                        
                                                        <div className="flex flex-wrap gap-2 items-center">
                                                            {slots.map(v => {
                                                                const activeBooking = slotAssignments.get(v.id);
                                                                const dynamicStatus = activeBooking ? activeBooking.status : (v.status === 'Pausada' ? 'Pausada' : 'Disponível');
                                                                const patientName = activeBooking?.paciente ? formatPatientName(activeBooking.paciente) : undefined;

                                                                const statusColors = (() => {
                                                                    switch (dynamicStatus) {
                                                                        case 'Solicitado':
                                                                            return {
                                                                                container: 'bg-sky-50 border-sky-100 text-sky-600',
                                                                                badge: 'bg-sky-100 text-sky-700'
                                                                            };
                                                                        case 'Agendado':
                                                                            return {
                                                                                container: 'bg-indigo-50 border-indigo-100 text-indigo-600',
                                                                                badge: 'bg-indigo-100 text-indigo-700'
                                                                            };
                                                                        case 'Realizado':
                                                                            return {
                                                                                container: 'bg-emerald-50 border-emerald-100 text-emerald-600',
                                                                                badge: 'bg-emerald-100 text-emerald-700'
                                                                            };
                                                                        case 'Retorno':
                                                                            return {
                                                                                container: 'bg-teal-50 border-teal-100 text-teal-600',
                                                                                badge: 'bg-teal-100 text-teal-700'
                                                                            };
                                                                        case 'Aguardando Data':
                                                                            return {
                                                                                container: 'bg-violet-50 border-violet-100 text-violet-600',
                                                                                badge: 'bg-violet-100 text-violet-700'
                                                                            };
                                                                        case 'Fila de espera':
                                                                            return {
                                                                                container: 'bg-amber-50 border-amber-100 text-amber-600',
                                                                                badge: 'bg-amber-100 text-amber-700'
                                                                            };
                                                                        case 'Pausada':
                                                                            return {
                                                                                container: 'bg-amber-50/70 border-amber-200 text-amber-800',
                                                                                badge: 'bg-amber-100 text-amber-700'
                                                                            };
                                                                        case 'Cancelado':
                                                                        case 'Não Realizado':
                                                                        case 'Disponível':
                                                                        default:
                                                                            return {
                                                                                container: 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:border-slate-300',
                                                                                badge: 'bg-emerald-100 text-emerald-700'
                                                                            };
                                                                    }
                                                                })();

                                                                return (
                                                                    <div 
                                                                        key={v.id} 
                                                                        className={`px-3 py-1.5 border rounded-xl flex items-center gap-2 text-xs font-bold shadow-xs transition-all ${statusColors.container}`}
                                                                        title={patientName ? `Paciente: ${patientName}` : undefined}
                                                                    >
                                                                        <span className="font-extrabold">{v.hora.slice(0, 5)}</span>
                                                                        {patientName && (
                                                                            <span className="text-[10px] opacity-75 font-bold max-w-[80px] truncate" title={patientName}>
                                                                                - {patientName.split(' ')[0]}
                                                                            </span>
                                                                        )}
                                                                        <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${statusColors.badge}`}>
                                                                            {dynamicStatus}
                                                                        </span>
                                                                        {!activeBooking && (
                                                                            <div className="flex items-center gap-0.5 ml-0.5">
                                                                                <button
                                                                                    onClick={() => handleTogglePauseSlot(v)}
                                                                                    className={`p-1 hover:bg-slate-200 rounded transition-colors ${v.status === 'Pausada' ? 'text-amber-600' : 'text-slate-400 hover:text-amber-600'}`}
                                                                                    title={v.status === 'Pausada' ? "Reativar Vaga" : "Pausar Vaga"}
                                                                                >
                                                                                    {v.status === 'Pausada' ? <PlayCircle className="w-3.5 h-3.5" /> : <PauseCircle className="w-3.5 h-3.5" />}
                                                                                </button>
                                                                                <button
                                                                                    onClick={() => handleDeleteSlot(v.id)}
                                                                                    className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-rose-600 transition-colors"
                                                                                    title="Excluir Vaga"
                                                                                >
                                                                                    <X className="w-3.5 h-3.5" />
                                                                                </button>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="p-8 bg-slate-50 border border-dashed border-slate-200 rounded-3xl text-center">
                                            <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                                            <span className="text-xs font-bold text-slate-400 block">Nenhuma vaga cadastrada por horário.</span>
                                            <span className="text-[10px] text-slate-400 block mt-1">Utilize o botão "Adicionar Vagas" para alocar horários neste procedimento.</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })()
                ) : (
                    /* ======================================================= */
                    /* LISTAGEM GERAL DE PROCEDIMENTOS                         */
                    /* ======================================================= */
                    <div className="space-y-4">
                        {/* Search & Filters Bar */}
                        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
                            <div className="flex flex-col sm:flex-row items-center gap-2 flex-1">
                                {/* Search input */}
                                <div className="relative w-full sm:w-80">
                                    <input
                                        type="text"
                                        placeholder="Buscar exame, consulta ou código..."
                                        className="w-full bg-white border border-slate-300 rounded-xl pl-10 pr-4 py-2.5 text-xs font-semibold placeholder:text-slate-400 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/15 transition-all text-slate-900 shadow-xs"
                                        value={procSearch}
                                        onChange={(e) => setProcSearch(e.target.value)}
                                    />
                                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                </div>

                                {/* Type selector pills */}
                                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-full sm:w-auto overflow-x-auto">
                                    {(['Todos', 'Exame', 'Consulta', 'Cirurgia'] as const).map(type => (
                                        <button
                                            key={type}
                                            onClick={() => setSelectedTypeFilter(type)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                                                selectedTypeFilter === type
                                                    ? 'bg-white text-slate-900 shadow-xs'
                                                    : 'text-slate-500 hover:text-slate-800'
                                            }`}
                                        >
                                            {type}
                                        </button>
                                    ))}
                                </div>

                                {/* Status filter pills */}
                                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-full sm:w-auto overflow-x-auto">
                                    {(['Todos', 'Ativos', 'Suspensos'] as const).map(st => (
                                        <button
                                            key={st}
                                            onClick={() => setSelectedStatusFilter(st)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                                                selectedStatusFilter === st
                                                    ? 'bg-white text-slate-900 shadow-xs'
                                                    : 'text-slate-500 hover:text-slate-800'
                                            }`}
                                        >
                                            {st}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-2 shrink-0">
                                {/* Novo Botão de Destaque: Adicionar Especialista */}
                                <button
                                    onClick={() => handleOpenAddEspecialistaModal()}
                                    className="px-3.5 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-extrabold rounded-xl shadow-md hover:shadow-indigo-500/20 active:scale-95 transition-all text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer border border-indigo-500/30"
                                    title="Vincular profissional especialista a um procedimento principal existente"
                                >
                                    <Stethoscope className="w-4 h-4 text-indigo-200" />
                                    <span>+ Adicionar Especialista</span>
                                </button>

                                <button
                                    onClick={() => handleOpenProcModal()}
                                    className="px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-extrabold rounded-xl shadow-md hover:shadow-sky-500/15 active:scale-95 transition-all text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer"
                                >
                                    <Plus className="w-4 h-4" />
                                    <span>Novo Procedimento</span>
                                </button>
                            </div>
                        </div>

                        {/* Loading Indicator */}
                        {loading && (
                            <div className="flex items-center justify-center py-10">
                                <Loader2 className="w-8 h-8 text-sky-600 animate-spin" />
                            </div>
                        )}

                        {/* Hierarchical Procedure List */}
                        {!loading && hierarchicalProcedures.parents.length > 0 ? (
                            <div className="space-y-3">
                                {hierarchicalProcedures.parents.map(parent => {
                                    const children = hierarchicalProcedures.childrenByParent.get(parent.id) || [];
                                    const isExpanded = !!expandedParentIds[parent.id];
                                    const isSuspended = parent.status !== 'Ativo';

                                    const typeConfig = (() => {
                                        switch (parent.type) {
                                            case 'Exame':
                                                return {
                                                    icon: Activity,
                                                    colorClass: 'text-sky-600 bg-sky-50 border-sky-100',
                                                    badgeClass: 'bg-sky-50 text-sky-700 border-sky-200'
                                                };
                                            case 'Consulta':
                                                return {
                                                    icon: Stethoscope,
                                                    colorClass: 'text-indigo-600 bg-indigo-50 border-indigo-100',
                                                    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                                };
                                            case 'Cirurgia':
                                            default:
                                                return {
                                                    icon: Sparkles,
                                                    colorClass: 'text-rose-600 bg-rose-50 border-rose-100',
                                                    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200'
                                                };
                                        }
                                    })();
                                    const IconComponent = typeConfig.icon;

                                    return (
                                        <div 
                                            key={parent.id} 
                                            className={`bg-white border rounded-2xl transition-all duration-200 shadow-xs overflow-hidden ${
                                                isSuspended 
                                                    ? 'border-amber-200/80 bg-amber-50/15' 
                                                    : 'border-slate-200/90 hover:border-sky-300'
                                            }`}
                                        >
                                            {/* Card do Procedimento Principal (Pai) */}
                                            <div 
                                                onClick={() => setSelectedProc(parent)}
                                                className="p-3.5 sm:px-4 sm:py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-slate-50/60 transition-colors"
                                            >
                                                {/* Esquerda: Ícone, Código Pai e Nome Principal */}
                                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                                    <div className={`p-2.5 rounded-xl ${typeConfig.colorClass} border shrink-0 shadow-xs`}>
                                                        <IconComponent className="w-4 h-4" />
                                                    </div>

                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex flex-wrap items-center gap-1.5 mb-1">
                                                            {/* Código Principal */}
                                                            <span className="text-[9px] font-black tracking-wider text-slate-700 bg-slate-100 border border-slate-200/80 px-2 py-0.5 rounded-lg uppercase">
                                                                Cód. {parent.code || '----'}
                                                            </span>

                                                            {/* Badge de Tipo */}
                                                            <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider ${typeConfig.badgeClass} border`}>
                                                                {parent.type}
                                                            </span>

                                                            {/* Badge Procedimento Principal */}
                                                            <span className="px-2 py-0.5 rounded-lg text-[8.5px] font-extrabold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">
                                                                Procedimento Principal
                                                            </span>

                                                            {/* Badge Contador de Especialistas */}
                                                            {children.length > 0 ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => toggleExpandParent(parent.id, e)}
                                                                    className="px-2 py-0.5 rounded-lg text-[8.5px] font-extrabold uppercase tracking-wider bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 flex items-center gap-1 transition-all cursor-pointer"
                                                                    title="Clique para expandir/recolher especialistas vinculados"
                                                                >
                                                                    <Stethoscope className="w-2.5 h-2.5" />
                                                                    <span>{children.length} especialista{children.length > 1 ? 's' : ''} vinculado{children.length > 1 ? 's' : ''}</span>
                                                                    {isExpanded ? <ChevronUp className="w-3 h-3 ml-0.5" /> : <ChevronDown className="w-3 h-3 ml-0.5" />}
                                                                </button>
                                                            ) : (
                                                                <span className="text-[8.5px] font-semibold text-slate-400">
                                                                    Sem especialistas vinculados
                                                                </span>
                                                            )}
                                                        </div>

                                                        <h4 className="font-extrabold text-slate-900 text-xs sm:text-[13px] leading-snug truncate uppercase">
                                                            {parent.name}
                                                        </h4>
                                                    </div>
                                                </div>

                                                {/* Direita: Status, Ações e Botão Adicionar Especialista Direto */}
                                                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 border-t border-slate-100 sm:border-t-0 pt-2 sm:pt-0">
                                                    {/* Status Badge */}
                                                    <div className="text-left sm:text-right">
                                                        <span className="text-[7.5px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Status</span>
                                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide border ${
                                                            !isSuspended 
                                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                                                : 'bg-amber-50 text-amber-700 border-amber-200'
                                                        }`}>
                                                            {!isSuspended && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                                                            {!isSuspended ? 'Ativo' : 'Suspenso'}
                                                        </span>
                                                    </div>

                                                    {/* Botão Rápido: + Especialista neste pai */}
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleOpenAddEspecialistaModal(parent.id);
                                                        }}
                                                        className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer shadow-2xs hover:scale-105 active:scale-95"
                                                        title={`Adicionar Especialista a ${parent.name}`}
                                                    >
                                                        <Plus className="w-3 h-3" />
                                                        <span>Especialista</span>
                                                    </button>

                                                    {/* Actions Area */}
                                                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                                        {/* Quick Suspend / Activate Button */}
                                                        <button
                                                            onClick={(e) => handleToggleSuspend(e, parent)}
                                                            disabled={actionLoading === `suspend-${parent.id}`}
                                                            className={`p-1.5 rounded-lg border transition-all cursor-pointer shadow-xs ${
                                                                !isSuspended
                                                                    ? 'text-amber-600 bg-amber-50/60 hover:bg-amber-100 border-amber-200'
                                                                    : 'text-emerald-600 bg-emerald-50/60 hover:bg-emerald-100 border-emerald-200'
                                                            }`}
                                                            title={!isSuspended ? 'Suspender Procedimento Principal' : 'Reativar Procedimento Principal'}
                                                        >
                                                            {actionLoading === `suspend-${parent.id}` ? (
                                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                            ) : !isSuspended ? (
                                                                <PauseCircle className="w-3.5 h-3.5" />
                                                            ) : (
                                                                <PlayCircle className="w-3.5 h-3.5" />
                                                            )}
                                                        </button>

                                                        {/* Edit Button */}
                                                        <button
                                                            onClick={() => handleOpenProcModal(parent)}
                                                            className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 border border-slate-200/80 rounded-lg transition-all cursor-pointer"
                                                            title="Editar Procedimento Principal"
                                                        >
                                                            <Edit2 className="w-3.5 h-3.5" />
                                                        </button>

                                                        {/* Delete Button */}
                                                        <button
                                                            onClick={(e) => handleDeleteProcedure(e, parent.id, parent.name)}
                                                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-200/80 rounded-lg transition-all cursor-pointer"
                                                            title="Excluir Procedimento Principal"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>

                                                        {/* Accordion Toggle Chevron */}
                                                        {children.length > 0 && (
                                                            <button
                                                                type="button"
                                                                onClick={(e) => toggleExpandParent(parent.id, e)}
                                                                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200/80 rounded-lg transition-all cursor-pointer"
                                                                title={isExpanded ? 'Recolher especialistas' : 'Expandir especialistas'}
                                                            >
                                                                {isExpanded ? (
                                                                    <ChevronUp className="w-3.5 h-3.5" />
                                                                ) : (
                                                                    <ChevronDown className="w-3.5 h-3.5" />
                                                                )}
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Sub-lista Hierárquica: Especialistas Vinculados (Filhos) */}
                                            {children.length > 0 && isExpanded && (
                                                <div className="bg-slate-50/70 border-t border-slate-200/70 px-4 py-3 pl-8 sm:pl-12 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                                    <div className="flex items-center justify-between pb-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
                                                        <span>Especialistas Vinculados a este Procedimento ({children.length})</span>
                                                        <span className="text-[9px] text-slate-400">Códigos derivados de {parent.code}</span>
                                                    </div>

                                                    <div className="space-y-1.5">
                                                        {children.map(child => {
                                                            const isChildSuspended = child.status !== 'Ativo';
                                                            const espObj = child.especialista || especialistas.find(e => e.id === child.especialista_id);
                                                            const espNome = espObj?.nome || 'Especialista';

                                                            return (
                                                                <div 
                                                                    key={child.id}
                                                                    onClick={() => setSelectedProc(child)}
                                                                    className={`p-2.5 sm:px-3 sm:py-2 bg-white rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-all cursor-pointer shadow-2xs hover:shadow-xs hover:border-indigo-300 ${
                                                                        isChildSuspended ? 'border-amber-200 bg-amber-50/20' : 'border-slate-200/80'
                                                                    }`}
                                                                >
                                                                    {/* Identificação do Especialista e Código Filho */}
                                                                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                                                        <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100 shrink-0">
                                                                            <Stethoscope className="w-3.5 h-3.5" />
                                                                        </div>
                                                                        <div className="min-w-0 flex-1">
                                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                                {/* Código do Especialista Filho (0397-10) */}
                                                                                <span className="px-2 py-0.5 rounded-md text-[9px] font-black tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200 font-mono">
                                                                                    {child.code || '----'}
                                                                                </span>
                                                                                <span className="text-[8.5px] font-bold uppercase tracking-wider text-slate-400">
                                                                                    Especialista Vinculado
                                                                                </span>
                                                                                {espObj?.especialidade && (
                                                                                    <span className="px-1.5 py-0.2 rounded text-[8px] font-semibold uppercase bg-slate-100 text-slate-600">
                                                                                        {espObj.especialidade}
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                            <h5 className="font-extrabold text-slate-800 text-xs truncate mt-0.5 uppercase">
                                                                                {child.name}
                                                                            </h5>
                                                                        </div>
                                                                    </div>

                                                                    {/* Status do Filho e Ações */}
                                                                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0" onClick={(e) => e.stopPropagation()}>
                                                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8.5px] font-black uppercase tracking-wide border ${
                                                                            !isChildSuspended 
                                                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                                                                : 'bg-amber-50 text-amber-700 border-amber-200'
                                                                        }`}>
                                                                            {!isChildSuspended ? 'Ativo' : 'Suspenso'}
                                                                        </span>

                                                                        {/* Ações do Especialista Vinculado */}
                                                                        <div className="flex items-center gap-1">
                                                                            <button
                                                                                onClick={(e) => handleToggleSuspend(e, child)}
                                                                                disabled={actionLoading === `suspend-${child.id}`}
                                                                                className={`p-1.5 rounded-lg border transition-all cursor-pointer shadow-xs ${
                                                                                    !isChildSuspended
                                                                                        ? 'text-amber-600 bg-amber-50/60 hover:bg-amber-100 border-amber-200'
                                                                                        : 'text-emerald-600 bg-emerald-50/60 hover:bg-emerald-100 border-emerald-200'
                                                                                }`}
                                                                                title={!isChildSuspended ? 'Suspender Especialista neste procedimento' : 'Reativar Especialista'}
                                                                            >
                                                                                {actionLoading === `suspend-${child.id}` ? (
                                                                                    <Loader2 className="w-3 h-3 animate-spin" />
                                                                                ) : !isChildSuspended ? (
                                                                                    <PauseCircle className="w-3 h-3" />
                                                                                ) : (
                                                                                    <PlayCircle className="w-3 h-3" />
                                                                                )}
                                                                            </button>

                                                                            <button
                                                                                onClick={(e) => handleDeleteProcedure(e, child.id, child.name)}
                                                                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-200/80 rounded-lg transition-all cursor-pointer"
                                                                                title="Remover Especialista Vinculado"
                                                                            >
                                                                                <Trash2 className="w-3 h-3" />
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ) : !loading && (
                            <div className="text-center py-12 p-8 bg-white border border-dashed border-slate-200 rounded-3xl space-y-4">
                                <Activity className="w-12 h-12 text-sky-500 mx-auto opacity-75" />
                                <div className="space-y-1">
                                    <h4 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">
                                        {procSearch || selectedTypeFilter !== 'Todos' || selectedStatusFilter !== 'Todos' 
                                            ? 'Nenhum procedimento encontrado para estes filtros' 
                                            : 'Nenhum procedimento cadastrado'}
                                    </h4>
                                    <p className="text-xs text-slate-500 max-w-md mx-auto">
                                        {procSearch || selectedTypeFilter !== 'Todos' || selectedStatusFilter !== 'Todos'
                                            ? 'Tente ajustar os termos de busca ou filtros selecionados acima.'
                                            : 'Você pode popular automaticamente a lista oficial com todos os 122 procedimentos padrão ou cadastrar individualmente.'}
                                    </p>
                                </div>
                                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                                    {procedures.length === 0 && (
                                        <button
                                            onClick={handleSeedProcedures}
                                            disabled={actionLoading === 'seed'}
                                            className="px-5 py-3 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-2xl shadow-lg shadow-sky-500/20 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
                                        >
                                            <Sparkles className="w-4 h-4 text-amber-300" />
                                            <span>Cadastrar Lista Padrão (122 Procedimentos)</span>
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handleOpenProcModal()}
                                        className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs uppercase tracking-wider rounded-2xl transition-all flex items-center gap-2 cursor-pointer"
                                    >
                                        <Plus className="w-4 h-4" />
                                        <span>Cadastrar Manualmente</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ======================================================= */}
            {/* MODAL: NOVO / EDITAR PROCEDIMENTO                        */}
            {/* ======================================================= */}
            {isProcModalOpen && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 flex flex-col scale-100">
                        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                                {editingProc ? 'Editar Procedimento' : 'Novo Procedimento'}
                            </h3>
                            <button onClick={() => setIsProcModalOpen(false)} className="p-1.5 hover:bg-slate-200 rounded-xl text-slate-400 hover:text-slate-700 transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <form onSubmit={handleSaveProcedure} className="p-6 space-y-4">
                            {procError && (
                                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-xs font-semibold">
                                    <AlertTriangle className="w-4 h-4 shrink-0" />
                                    <span>{procError}</span>
                                </div>
                            )}

                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1 ml-1">
                                    Nome do Procedimento *
                                </label>
                                <input
                                    type="text"
                                    placeholder="Ex: ECOCARDIOGRAMA COM DOPPLER"
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-900 focus:bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none transition-all text-xs font-semibold uppercase"
                                    value={procName}
                                    onChange={(e) => setProcName(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1 ml-1">
                                        Tipo
                                    </label>
                                    <select
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-900 focus:bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none transition-all text-xs font-semibold cursor-pointer"
                                        value={procType}
                                        onChange={(e) => setProcType(e.target.value as any)}
                                    >
                                        <option value="Exame">Exame</option>
                                        <option value="Consulta">Consulta</option>
                                        <option value="Cirurgia">Cirurgia</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1 ml-1 flex items-center justify-between">
                                        <span>Código (4 Dígitos)</span>
                                        <span className="text-[9px] text-slate-400 font-bold lowercase italic">(automático)</span>
                                    </label>
                                    <input
                                        type="text"
                                        maxLength={4}
                                        placeholder="0001"
                                        className="w-full rounded-xl border border-slate-200 bg-slate-100 p-3 text-slate-600 outline-none transition-all text-xs font-bold font-mono text-center cursor-not-allowed select-none"
                                        value={procCode}
                                        disabled
                                        readOnly
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5 ml-1">
                                    Status Operacional
                                </label>
                                <div className="flex items-center gap-6 p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
                                    {(['Ativo', 'Inativo'] as const).map(st => (
                                        <label key={st} className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 select-none">
                                            <input
                                                type="radio"
                                                name="procStatus"
                                                value={st}
                                                checked={procStatus === st}
                                                onChange={() => setProcStatus(st)}
                                                className="w-4 h-4 text-sky-600 border-slate-300 focus:ring-sky-500 cursor-pointer"
                                            />
                                            <span>{st === 'Ativo' ? 'Ativo' : 'Suspenso'}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>


                            <div className="pt-4 border-t border-slate-100 flex justify-end gap-3 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setIsProcModalOpen(false)}
                                    className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-extrabold rounded-xl text-xs uppercase tracking-wider cursor-pointer"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={actionLoading === 'save-proc'}
                                    className="px-6 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-extrabold rounded-xl shadow-md active:scale-95 transition-all text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
                                >
                                    {actionLoading === 'save-proc' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                    <span>Salvar</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ======================================================= */}
            {/* MODAL: ADICIONAR VAGAS POR CALENDÁRIO                    */}
            {/* ======================================================= */}
            {isAddVagasModalOpen && selectedProc && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[95vh]">
                        {/* Header */}
                        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
                            <div>
                                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Adicionar Vagas em Lote</h3>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">{selectedProc.name}</p>
                            </div>
                            <button onClick={() => { setIsAddVagasModalOpen(false); setSelectedTimes([]); }} className="p-1.5 hover:bg-slate-200 rounded-xl text-slate-400 hover:text-slate-700 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        
                        {/* Body */}
                        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 flex flex-col md:flex-row gap-6">
                            {/* Left side: Calendar */}
                            <div className="flex-1 space-y-4">
                                <div className="flex items-center justify-between px-1">
                                    <button 
                                        type="button"
                                        onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
                                        className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 cursor-pointer"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>
                                    <span className="text-xs font-black uppercase text-slate-800 tracking-wider">
                                        {currentMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                                    </span>
                                    <button 
                                        type="button"
                                        onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
                                        className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 cursor-pointer"
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                                
                                <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                    <span>Dom</span><span>Seg</span><span>Ter</span><span>Qua</span><span>Qui</span><span>Sex</span><span>Sáb</span>
                                </div>
                                
                                <div className="grid grid-cols-7 gap-1">
                                    {getDaysInMonth(currentMonth).map((day, idx) => {
                                        if (!day) return <div key={`empty-${idx}`} className="h-8"></div>;
                                        const isSelected = selectedDate && formatDateToYYYYMMDD(day) === formatDateToYYYYMMDD(selectedDate);
                                        const isToday = formatDateToYYYYMMDD(day) === formatDateToYYYYMMDD(new Date());
                                        const isPast = day.getTime() < new Date(new Date().setHours(0,0,0,0)).getTime();
                                        const isDisabled = isPast && !canAddRetroativo;
                                        
                                        return (
                                            <button
                                                key={day.toISOString()}
                                                type="button"
                                                onClick={() => setSelectedDate(day)}
                                                disabled={isDisabled}
                                                className={`h-8 w-full rounded-lg text-xs font-bold transition-all flex items-center justify-center cursor-pointer ${
                                                    isSelected 
                                                    ? 'bg-sky-600 text-white shadow-md shadow-sky-500/20' 
                                                    : isToday
                                                    ? 'border border-sky-500 text-sky-600 font-black'
                                                    : isPast
                                                    ? (canAddRetroativo
                                                        ? 'text-amber-800 bg-amber-50/70 hover:bg-amber-100/80 border border-amber-200/80 font-extrabold'
                                                        : 'text-slate-300 cursor-not-allowed')
                                                    : 'hover:bg-slate-100 text-slate-700'
                                                }`}
                                                title={isPast ? (canAddRetroativo ? 'Data retroativa liberada para Gestores e Administradores' : 'Data passada bloqueada') : undefined}
                                            >
                                                {day.getDate()}
                                            </button>
                                        );
                                    })}
                                </div>

                                {canAddRetroativo && (
                                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-50/80 border border-amber-200/70 rounded-xl text-[10px] font-bold text-amber-900 mt-2">
                                        <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                                        <span>Datas retroativas liberadas para Gestores e Administradores</span>
                                    </div>
                                )}
                            </div>
                            
                            {/* Right side: Time slots */}
                            <div className="w-full md:w-[260px] border-t md:border-t-0 md:border-l border-slate-100 pt-6 md:pt-0 md:pl-6 flex flex-col space-y-4">
                                <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">
                                    Horários da Vaga
                                </h4>
                                
                                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-center">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Dia Selecionado</span>
                                    <span className="text-xs font-bold text-slate-700 block">
                                        {selectedDate ? selectedDate.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }) : 'Nenhum'}
                                    </span>
                                    {selectedDate && selectedDate.getTime() < new Date(new Date().setHours(0,0,0,0)).getTime() && (
                                        <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-300 mt-1">
                                            ⚠️ Data Retroativa
                                        </span>
                                    )}
                                </div>
                                
                                <div className="grid grid-cols-3 gap-1.5 max-h-[160px] overflow-y-auto pr-1">
                                    {['07:00', '08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00'].map(t => {
                                        const isTimeSelected = selectedTimes.includes(t);
                                        return (
                                            <button
                                                key={t}
                                                type="button"
                                                onClick={() => toggleTime(t)}
                                                className={`py-1.5 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                                                    isTimeSelected
                                                    ? 'bg-indigo-50 border-indigo-300 text-indigo-600 shadow-xs'
                                                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                                }`}
                                            >
                                                {t}
                                            </button>
                                        );
                                    })}
                                </div>
                                
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Outro Horário</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="time"
                                            value={customTime}
                                            onChange={(e) => setCustomTime(e.target.value)}
                                            className="bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-xs font-bold outline-none focus:border-indigo-500 focus:bg-white text-slate-800 flex-1"
                                        />
                                        <button
                                            type="button"
                                            onClick={addCustomTime}
                                            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg text-[10px] uppercase tracking-wider transition-colors cursor-pointer"
                                        >
                                            Inserir
                                        </button>
                                    </div>
                                </div>
                                
                                {selectedTimes.length > 0 && (
                                    <div className="p-2.5 bg-indigo-50/50 rounded-xl border border-indigo-100/50 text-xs">
                                        <span className="font-extrabold text-indigo-700 block mb-1">Horários Marcados:</span>
                                        <div className="flex flex-wrap gap-1">
                                            {selectedTimes.sort().map(t => (
                                                <span key={t} className="px-1.5 py-0.5 bg-white border border-indigo-200 rounded text-[10px] font-bold text-indigo-600">
                                                    {t}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        {/* Footer */}
                        <div className="p-5 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3 shrink-0">
                            <button
                                type="button"
                                onClick={() => { setIsAddVagasModalOpen(false); setSelectedTimes([]); }}
                                className="px-4 py-2 border border-slate-200 hover:bg-slate-100 text-slate-500 font-bold rounded-xl text-xs uppercase tracking-wider transition-colors cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmAddVagas}
                                disabled={!selectedDate || selectedTimes.length === 0 || actionLoading === 'add-vagas'}
                                className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-extrabold rounded-xl shadow-md hover:shadow-sky-500/10 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                                {actionLoading === 'add-vagas' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Confirmar Vagas'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ======================================================= */}
            {/* MODAL: ADICIONAR ESPECIALISTA AO PROCEDIMENTO PRINCIPAL  */}
            {/* ======================================================= */}
            {isAddEspecialistaModalOpen && (() => {
                const parentObj = hierarchicalProcedures.allParents.find(p => p.id === selectedParentProcId);
                const espObj = especialistas.find(e => e.id === selectedAddEspecialistaId);

                // Geração automática do código filho (0397-10...)
                const existingChildren = parentObj 
                    ? (hierarchicalProcedures.childrenByParent.get(parentObj.id) || [])
                    : [];
                const childCodes = existingChildren.map(c => c.code || '');
                const autoGeneratedCode = parentObj 
                    ? db.getNextEspecialistaCode(parentObj.code || '0000', childCodes)
                    : '----';

                // Nome do procedimento vinculado gerado automaticamente
                const autoGeneratedName = (parentObj && espObj)
                    ? `${parentObj.name.trim().toUpperCase()} — ${espObj.nome.trim().toUpperCase()}`
                    : parentObj ? `${parentObj.name.trim().toUpperCase()} — (Selecione o Especialista)` : '----';

                // Filtragem do select de procedimento principal
                const filteredParentOptions = hierarchicalProcedures.allParents.filter(p => {
                    if (!addEspSearchParent.trim()) return true;
                    const query = addEspSearchParent.toLowerCase().trim();
                    return (
                        (p.code && p.code.toLowerCase().includes(query)) ||
                        p.name.toLowerCase().includes(query)
                    );
                });

                // Filtragem do select de especialista
                const filteredMedicoOptions = especialistas.filter(e => {
                    if (!addEspSearchMedico.trim()) return true;
                    const query = addEspSearchMedico.toLowerCase().trim();
                    return (
                        e.nome.toLowerCase().includes(query) ||
                        (e.especialidade && e.especialidade.toLowerCase().includes(query)) ||
                        (e.grupo && e.grupo.toLowerCase().includes(query))
                    );
                });

                return (
                    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
                        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 flex flex-col max-h-[92vh]">
                            {/* Modal Header */}
                            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-indigo-50/70 via-slate-50 to-white shrink-0">
                                <div className="flex items-center gap-2.5">
                                    <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-xs">
                                        <Stethoscope className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">
                                            Adicionar Especialista ao Procedimento
                                        </h3>
                                        <p className="text-[10px] text-slate-500 font-medium">
                                            Crie um procedimento vinculado com código próprio derivado
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setIsAddEspecialistaModalOpen(false)}
                                    className="p-1.5 hover:bg-slate-200/70 rounded-xl text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                                    title="Fechar"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Modal Body */}
                            <form onSubmit={handleSaveEspecialistaVinculo} className="p-6 overflow-y-auto custom-scrollbar space-y-4 flex-1">
                                {addEspecialistaError && (
                                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-700 flex items-center gap-2 animate-in fade-in">
                                        <AlertTriangle className="w-4 h-4 shrink-0" />
                                        <span>{addEspecialistaError}</span>
                                    </div>
                                )}

                                {/* Campo 1: Procedimento Principal (SELECT pesquisável) */}
                                <div className="space-y-1">
                                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 ml-1">
                                        1. Procedimento Principal *
                                    </label>
                                    <div className="relative">
                                        <div 
                                            onClick={() => setIsParentDropdownOpen(!isParentDropdownOpen)}
                                            className="w-full bg-slate-50/80 hover:bg-slate-50 border border-slate-200/90 rounded-xl p-3 text-xs font-semibold text-slate-800 flex items-center justify-between cursor-pointer transition-all focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20"
                                        >
                                            <span className="truncate">
                                                {parentObj 
                                                    ? `${parentObj.code} — ${parentObj.name}`
                                                    : '-- Selecione o procedimento principal --'}
                                            </span>
                                            <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 ml-2" />
                                        </div>

                                        {isParentDropdownOpen && (
                                            <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-56 animate-in fade-in duration-150">
                                                <div className="p-2 border-b border-slate-100 bg-slate-50/50">
                                                    <div className="relative">
                                                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                                                        <input
                                                            type="text"
                                                            autoFocus
                                                            placeholder="Buscar por código ou nome..."
                                                            value={addEspSearchParent}
                                                            onChange={(e) => setAddEspSearchParent(e.target.value)}
                                                            className="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-2 py-1.5 text-xs outline-none focus:border-indigo-500"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="overflow-y-auto custom-scrollbar flex-1 p-1">
                                                    {filteredParentOptions.length > 0 ? (
                                                        filteredParentOptions.map(p => (
                                                            <div
                                                                key={p.id}
                                                                onClick={() => {
                                                                    setSelectedParentProcId(p.id);
                                                                    setIsParentDropdownOpen(false);
                                                                    setAddEspSearchParent('');
                                                                }}
                                                                className={`px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-colors flex items-center justify-between ${
                                                                    selectedParentProcId === p.id 
                                                                        ? 'bg-indigo-50 text-indigo-700 font-bold' 
                                                                        : 'hover:bg-slate-100 text-slate-700'
                                                                }`}
                                                            >
                                                                <span className="truncate">
                                                                    <strong className="font-mono text-indigo-600 mr-2">{p.code}</strong>
                                                                    {p.name}
                                                                </span>
                                                                {selectedParentProcId === p.id && <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <div className="p-3 text-center text-xs text-slate-400">
                                                            Nenhum procedimento encontrado.
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Campo 2: Especialista Responsável (SELECT pesquisável) */}
                                <div className="space-y-1">
                                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 ml-1">
                                        2. Especialista Responsável *
                                    </label>
                                    <div className="relative">
                                        <div 
                                            onClick={() => setIsMedicoDropdownOpen(!isMedicoDropdownOpen)}
                                            className="w-full bg-slate-50/80 hover:bg-slate-50 border border-slate-200/90 rounded-xl p-3 text-xs font-semibold text-slate-800 flex items-center justify-between cursor-pointer transition-all focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20"
                                        >
                                            <span className="truncate">
                                                {espObj 
                                                    ? `${espObj.nome} — ${espObj.especialidade || 'MÉDICO'} (${espObj.grupo || 'MÉDICOS'})`
                                                    : '-- Selecione o especialista --'}
                                            </span>
                                            <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 ml-2" />
                                        </div>

                                        {isMedicoDropdownOpen && (
                                            <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-56 animate-in fade-in duration-150">
                                                <div className="p-2 border-b border-slate-100 bg-slate-50/50">
                                                    <div className="relative">
                                                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                                                        <input
                                                            type="text"
                                                            autoFocus
                                                            placeholder="Buscar por nome, especialidade ou grupo..."
                                                            value={addEspSearchMedico}
                                                            onChange={(e) => setAddEspSearchMedico(e.target.value)}
                                                            className="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-2 py-1.5 text-xs outline-none focus:border-indigo-500"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="overflow-y-auto custom-scrollbar flex-1 p-1">
                                                    {filteredMedicoOptions.length > 0 ? (
                                                        filteredMedicoOptions.map(e => (
                                                            <div
                                                                key={e.id}
                                                                onClick={() => {
                                                                    setSelectedAddEspecialistaId(e.id);
                                                                    setIsMedicoDropdownOpen(false);
                                                                    setAddEspSearchMedico('');
                                                                }}
                                                                className={`px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-colors flex items-center justify-between ${
                                                                    selectedAddEspecialistaId === e.id 
                                                                        ? 'bg-indigo-50 text-indigo-700 font-bold' 
                                                                        : 'hover:bg-slate-100 text-slate-700'
                                                                }`}
                                                            >
                                                                <div className="truncate">
                                                                    <span className="block font-bold text-slate-800">{e.nome}</span>
                                                                    <span className="text-[10px] text-slate-400">{e.especialidade || 'MÉDICO'} ({e.grupo || 'MÉDICOS'})</span>
                                                                </div>
                                                                {selectedAddEspecialistaId === e.id && <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <div className="p-3 text-center text-xs text-slate-400">
                                                            Nenhum especialista encontrado.
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Campo 3: Código do Especialista (Gerado automaticamente) */}
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1 ml-1 flex items-center justify-between">
                                        <span>3. Código do Especialista</span>
                                        <span className="text-[9px] text-indigo-600 font-bold lowercase italic">(automático derivado)</span>
                                    </label>
                                    <div className="p-3 bg-indigo-50/50 border border-indigo-200/70 rounded-xl flex items-center justify-between">
                                        <span className="text-xs font-mono font-black text-indigo-800 tracking-wider">
                                            {autoGeneratedCode}
                                        </span>
                                        <span className="text-[9px] font-bold text-indigo-600 uppercase tracking-widest bg-indigo-100/70 px-2 py-0.5 rounded">
                                            {parentObj ? `Prefixo: ${parentObj.code}` : 'Aguardando Pai'}
                                        </span>
                                    </div>
                                </div>

                                {/* Campo 4: Nome do Procedimento Vinculado (Gerado automaticamente) */}
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1 ml-1 flex items-center justify-between">
                                        <span>4. Nome do Procedimento Vinculado</span>
                                        <span className="text-[9px] text-slate-400 font-bold lowercase italic">(gerado automaticamente)</span>
                                    </label>
                                    <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-bold text-slate-800 uppercase leading-snug break-words">
                                        {autoGeneratedName}
                                    </div>
                                </div>

                                {/* Campo 5: Status Operacional */}
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5 ml-1">
                                        5. Status Operacional
                                    </label>
                                    <div className="flex items-center gap-6 p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
                                        {(['Ativo', 'Inativo'] as const).map(st => (
                                            <label key={st} className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 select-none">
                                                <input
                                                    type="radio"
                                                    name="addEspStatus"
                                                    value={st}
                                                    checked={addEspecialistaStatus === st}
                                                    onChange={() => setAddEspecialistaStatus(st)}
                                                    className="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer"
                                                />
                                                <span>{st === 'Ativo' ? 'Ativo' : 'Suspenso'}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                {/* Botões do Rodapé */}
                                <div className="pt-4 border-t border-slate-100 flex justify-end gap-3 shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => setIsAddEspecialistaModalOpen(false)}
                                        className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-extrabold rounded-xl text-xs uppercase tracking-wider cursor-pointer transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={actionLoading === 'save-vinculo-esp' || !selectedParentProcId || !selectedAddEspecialistaId}
                                        className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-extrabold rounded-xl shadow-md active:scale-95 transition-all text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
                                    >
                                        {actionLoading === 'save-vinculo-esp' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                        <span>Salvar Especialista</span>
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                );
            })()}

        </div>
    );
};
