import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
    X, 
    FileDown, 
    Filter, 
    RotateCcw, 
    Search, 
    BarChart3, 
    Users, 
    Calendar as CalendarIcon, 
    ChevronDown, 
    ChevronLeft, 
    ChevronRight, 
    AlertCircle, 
    Stethoscope,
    Layers
} from 'lucide-react';
import { ConsultaAgendamento, ConsultaProcedimento, ConsultaVaga, AppState, User } from '../../types';
import * as db from '../../services/consultasService';
import { normalizeSolicitationDate } from '../../services/consultasService';
import { ConsultasReportPdfGenerator } from './ConsultasReportPdfGenerator';

// Lista oficial dos 7 status disponíveis para seleção
const ALL_STATUS_OPTIONS = [
    { id: 'Aguardando Vaga', label: 'Aguardando Vaga' },
    { id: 'Definir Data', label: 'Definir Data' },
    { id: 'Agendado', label: 'Agendado' },
    { id: 'Realizado', label: 'Realizado' },
    { id: 'Retorno', label: 'Retorno' },
    { id: 'Pausada', label: 'Pausada' },
    { id: 'Cancelado', label: 'Cancelado' }
];

interface ConsultasReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialProcedures?: ConsultaProcedimento[];
    initialVagas?: ConsultaVaga[];
    state: AppState;
    currentUser: User;
}

export const ConsultasReportModal: React.FC<ConsultasReportModalProps> = ({
    isOpen,
    onClose,
    initialProcedures = [],
    initialVagas = [],
    state: appState,
    currentUser
}) => {
    // Dados carregados de origem real
    const [loading, setLoading] = useState(false);
    const [allBookings, setAllBookings] = useState<ConsultaAgendamento[]>([]);
    const [procedures, setProcedures] = useState<ConsultaProcedimento[]>(initialProcedures);
    const [allVagas, setAllVagas] = useState<ConsultaVaga[]>(initialVagas);
    const [queuePositions, setQueuePositions] = useState<Record<string, number>>({});

    // Modo ativo no cabeçalho: Simplificado vs Completo
    const [reportType, setReportType] = useState<'simplificado' | 'completo'>('simplificado');

    // --- FILTRO 1: PERÍODO ---
    const [periodoTipo, setPeriodoTipo] = useState<'solicitacao' | 'agendamento'>('solicitacao');
    const [dataInicio, setDataInicio] = useState<string>(''); // YYYY-MM-DD
    const [dataFim, setDataFim] = useState<string>(''); // YYYY-MM-DD
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);
    const [calendarPlacement, setCalendarPlacement] = useState<'bottom' | 'top'>('bottom');
    const [calendarViewDate, setCalendarViewDate] = useState<Date>(new Date());
    const [calendarSelecting, setCalendarSelecting] = useState<'start' | 'end'>('start');
    const [hoverDate, setHoverDate] = useState<string | null>(null);
    const calendarCardRef = useRef<HTMLDivElement>(null);

    // --- FILTRO 2: PROCEDIMENTO ---
    const [selectedProcIds, setSelectedProcIds] = useState<string[]>([]);
    const [isProcDropdownOpen, setIsProcDropdownOpen] = useState(false);
    const [procDropdownPlacement, setProcDropdownPlacement] = useState<'bottom' | 'top'>('bottom');
    const [procSearch, setProcSearch] = useState('');
    const procCardRef = useRef<HTMLDivElement>(null);

    // --- FILTRO 3: STATUS ---
    const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
    const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
    const [statusDropdownPlacement, setStatusDropdownPlacement] = useState<'bottom' | 'top'>('bottom');
    const [statusSearch, setStatusSearch] = useState('');
    const statusCardRef = useRef<HTMLDivElement>(null);

    // --- ESTADO CONFIRMADO (APLICADO) ---
    const [appliedFilters, setAppliedFilters] = useState<{
        periodoTipo: 'solicitacao' | 'agendamento';
        dataInicio: string;
        dataFim: string;
        selectedProcIds: string[];
        selectedStatuses: string[];
    }>({
        periodoTipo: 'solicitacao',
        dataInicio: '',
        dataFim: '',
        selectedProcIds: [],
        selectedStatuses: []
    });

    // Modal de Alerta Customizado (substitui alert nativo)
    const [alertMessage, setAlertMessage] = useState<string | null>(null);

    // Controle de Geração de PDF
    const [isPrintingReport, setIsPrintingReport] = useState(false);
    const [pdfMode, setPdfMode] = useState<'simplificado' | 'completo'>('simplificado');

    // Carregar dados reais ao abrir o modal
    const loadFreshData = async () => {
        setLoading(true);
        try {
            const [freshBookings, freshProcs, freshVagas] = await Promise.all([
                db.getAgendamentos(),
                db.getProcedimentos(),
                db.getVagas()
            ]);

            setAllBookings(freshBookings || []);
            setProcedures(freshProcs || []);
            setAllVagas(freshVagas || []);

            // Calcular posições oficiais da fila
            const isWaitlistItem = (b: ConsultaAgendamento) => 
                !b.status || 
                b.status === 'Fila de espera' || 
                b.status === 'Aguardando Data' || 
                b.status === 'Solicitado' || 
                b.status === 'Retorno' ||
                b.status.toLowerCase().includes('fila') ||
                b.status.toLowerCase().includes('aguard');

            const allWaitlist = (freshBookings || []).filter(isWaitlistItem);
            const waitlistByProc: Record<string, ConsultaAgendamento[]> = {};

            allWaitlist.forEach(b => {
                const procKey = b.procedimento_id || (b.procedimento ? b.procedimento.id : null) || (b.procedimento ? b.procedimento.name : null) || 'geral';
                if (!waitlistByProc[procKey]) {
                    waitlistByProc[procKey] = [];
                }
                waitlistByProc[procKey].push(b);
            });

            const positionMap: Record<string, number> = {};
            Object.keys(waitlistByProc).forEach(procKey => {
                const procList = waitlistByProc[procKey];
                const orderedList = db.orderConsultasQueue(procList);
                orderedList.forEach((b, index) => {
                    positionMap[b.id] = index + 1;
                });
            });

            setQueuePositions(positionMap);
        } catch (error) {
            console.error('[ConsultasReportModal] Erro ao carregar agendamentos:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            loadFreshData();
        }
    }, [isOpen]);

    // Fechar dropdowns ao clicar fora
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (calendarCardRef.current && !calendarCardRef.current.contains(event.target as Node)) {
                setIsCalendarOpen(false);
            }
            if (procCardRef.current && !procCardRef.current.contains(event.target as Node)) {
                setIsProcDropdownOpen(false);
            }
            if (statusCardRef.current && !statusCardRef.current.contains(event.target as Node)) {
                setIsStatusDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Controle inteligente de posicionamento vertical (abre para cima ou para baixo conforme espaço)
    const toggleCalendarPopover = (selectingMode: 'start' | 'end') => {
        if (!isCalendarOpen && calendarCardRef.current) {
            const rect = calendarCardRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            if (spaceBelow < 380 && rect.top > 380) {
                setCalendarPlacement('top');
            } else {
                setCalendarPlacement('bottom');
            }
        }
        setCalendarSelecting(selectingMode);
        setIsCalendarOpen(!isCalendarOpen);
        setIsProcDropdownOpen(false);
        setIsStatusDropdownOpen(false);
    };

    const toggleProcDropdown = () => {
        if (!isProcDropdownOpen && procCardRef.current) {
            const rect = procCardRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            // Se o espaço abaixo for menor que 520px e houver mais espaço acima, abre para cima
            if (spaceBelow < 520 && rect.top > 520) {
                setProcDropdownPlacement('top');
            } else {
                setProcDropdownPlacement('bottom');
            }
        }
        setIsProcDropdownOpen(!isProcDropdownOpen);
        setIsCalendarOpen(false);
        setIsStatusDropdownOpen(false);
    };

    const toggleStatusDropdown = () => {
        if (!isStatusDropdownOpen && statusCardRef.current) {
            const rect = statusCardRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            if (spaceBelow < 380 && rect.top > 380) {
                setStatusDropdownPlacement('top');
            } else {
                setStatusDropdownPlacement('bottom');
            }
        }
        setIsStatusDropdownOpen(!isStatusDropdownOpen);
        setIsCalendarOpen(false);
        setIsProcDropdownOpen(false);
    };

    // Mapa de elegibilidade para 'Definir Data' / Vaga Livre
    const eligibilityMap = useMemo(() => {
        return db.getQueueEligibilityMap(allBookings, allVagas);
    }, [allBookings, allVagas]);

    // Formatadores de data
    const formatBrDate = (isoStr: string) => {
        if (!isoStr) return '';
        const parts = isoStr.split('-');
        if (parts.length === 3) {
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        return isoStr;
    };

    // Confirmação explícita dos critérios aplicados
    const handleApplyFilters = () => {
        setAppliedFilters({
            periodoTipo,
            dataInicio,
            dataFim,
            selectedProcIds: [...selectedProcIds],
            selectedStatuses: [...selectedStatuses]
        });
        setIsCalendarOpen(false);
        setIsProcDropdownOpen(false);
        setIsStatusDropdownOpen(false);
    };

    // Limpar todos os filtros
    const handleClearFilters = () => {
        setDataInicio('');
        setDataFim('');
        setSelectedProcIds([]);
        setSelectedStatuses([]);
        setAppliedFilters({
            periodoTipo,
            dataInicio: '',
            dataFim: '',
            selectedProcIds: [],
            selectedStatuses: []
        });
        setIsCalendarOpen(false);
        setIsProcDropdownOpen(false);
        setIsStatusDropdownOpen(false);
    };

    // Procedimentos ordenados alfabeticamente e filtrados pela busca
    const filteredProcList = useMemo(() => {
        const sorted = [...procedures].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        if (!procSearch.trim()) return sorted;
        const s = procSearch.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return sorted.filter(p => {
            const nameNorm = (p.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            const codeNorm = (p.code || '').toLowerCase();
            return nameNorm.includes(s) || codeNorm.includes(s);
        });
    }, [procedures, procSearch]);

    // Resumo descritivo dos filtros ativos (para barra inferior e PDF)
    const appliedFiltersText = useMemo(() => {
        const parts: string[] = [];

        // Período
        if (appliedFilters.dataInicio || appliedFilters.dataFim) {
            const label = appliedFilters.periodoTipo === 'solicitacao' ? 'Solicitação' : 'Agendamento';
            const ini = formatBrDate(appliedFilters.dataInicio) || 'Início';
            const fim = formatBrDate(appliedFilters.dataFim) || 'Fim';
            parts.push(`${label}: ${ini} a ${fim}`);
        } else {
            parts.push(`${appliedFilters.periodoTipo === 'solicitacao' ? 'Solicitação' : 'Agendamento'}: Todo o histórico`);
        }

        // Procedimentos
        if (appliedFilters.selectedProcIds.length === 0) {
            parts.push('Todos os procedimentos');
        } else if (appliedFilters.selectedProcIds.length === 1) {
            const p = procedures.find(item => item.id === appliedFilters.selectedProcIds[0]);
            parts.push(`1 procedimento (${p?.code ? `${p.code} - ${p.name}` : p?.name || 'Selecionado'})`);
        } else {
            parts.push(`${appliedFilters.selectedProcIds.length} procedimentos selecionados`);
        }

        // Status
        if (appliedFilters.selectedStatuses.length === 0) {
            parts.push('Todos os status');
        } else if (appliedFilters.selectedStatuses.length === 1) {
            parts.push(`Status: ${appliedFilters.selectedStatuses[0]}`);
        } else {
            parts.push(`${appliedFilters.selectedStatuses.length} status selecionados`);
        }

        return parts.join(' • ');
    }, [appliedFilters, procedures]);

    // Disparar Exportação aplicando rigorosamente: OU dentro de cada filtro, E entre filtros diferentes
    const handleTriggerExport = (mode: 'simplificado' | 'completo') => {
        // Assegurar aplicação prévia dos critérios atuais caso o usuário clique direto no botão de exportar
        const currentCriteria = {
            periodoTipo,
            dataInicio,
            dataFim,
            selectedProcIds: [...selectedProcIds],
            selectedStatuses: [...selectedStatuses]
        };
        setAppliedFilters(currentCriteria);

        const filtered = allBookings.filter(b => {
            // 1. FILTRO PERÍODO (E)
            if (currentCriteria.periodoTipo === 'solicitacao') {
                const solDate = normalizeSolicitationDate(b);
                if (currentCriteria.dataInicio && (!solDate || solDate < currentCriteria.dataInicio)) return false;
                if (currentCriteria.dataFim && (!solDate || solDate > currentCriteria.dataFim)) return false;
            } else {
                const appDate = b.appointment_date ? b.appointment_date.split('T')[0] : '';
                if (currentCriteria.dataInicio || currentCriteria.dataFim) {
                    if (!appDate) return false;
                    if (currentCriteria.dataInicio && appDate < currentCriteria.dataInicio) return false;
                    if (currentCriteria.dataFim && appDate > currentCriteria.dataFim) return false;
                }
            }

            // 2. FILTRO PROCEDIMENTO (OU dentro de procedimentos selecionados)
            if (currentCriteria.selectedProcIds.length > 0) {
                const pId = b.procedimento_id || b.procedimento?.id;
                if (!pId || !currentCriteria.selectedProcIds.includes(pId)) return false;
            }

            // 3. FILTRO STATUS (OU dentro de status selecionados)
            if (currentCriteria.selectedStatuses.length > 0) {
                const matches = currentCriteria.selectedStatuses.some(st => {
                    if (st === 'Aguardando Vaga') {
                        return b.status === 'Fila de espera' || b.status === 'Aguardando Data' || b.status === 'Solicitado';
                    }
                    if (st === 'Definir Data') {
                        const isWait = (b.status === 'Fila de espera' || b.status === 'Aguardando Data' || b.status === 'Solicitado') && !b.is_paused;
                        const isEligible = eligibilityMap.get(b.id)?.isEligible;
                        return isWait && isEligible;
                    }
                    if (st === 'Pausada') {
                        return b.status === 'Pausada' || b.is_paused;
                    }
                    if (st === 'Cancelado') {
                        return b.status === 'Cancelado' || (b.status as string) === 'Cancelada' || !!b.canceled_at;
                    }
                    return b.status === st;
                });
                if (!matches) return false;
            }
            return true;
        });

        if (filtered.length === 0) {
            setAlertMessage('Nenhum registro encontrado para os filtros selecionados. Experimente ajustar o período, procedimentos ou status para exportar.');
            return;
        }

        setPdfMode(mode);
        setIsPrintingReport(true);
    };

    // --- LÓGICA DO CALENDÁRIO POPOVER ---
    const handleDayClick = (dateStr: string) => {
        if (!dataInicio || (dataInicio && dataFim)) {
            // Primeiro clique: define data inicial
            setDataInicio(dateStr);
            setDataFim('');
            setCalendarSelecting('end');
        } else if (dataInicio && !dataFim) {
            // Segundo clique: define data final
            if (dateStr < dataInicio) {
                // Inverte de forma inteligente se o usuário clicou numa data anterior
                setDataFim(dataInicio);
                setDataInicio(dateStr);
            } else {
                setDataFim(dateStr);
            }
            setCalendarSelecting('start');
            setIsCalendarOpen(false);
        }
    };

    // Geração dos dias do mês para o calendário
    const calendarDays = useMemo(() => {
        const year = calendarViewDate.getFullYear();
        const month = calendarViewDate.getMonth();
        const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 (Dom) a 6 (Sáb)
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        const days: Array<{ dateStr: string; dayNum: number; isCurrentMonth: boolean }> = [];

        // Dias do mês anterior para preencher a primeira semana
        const daysInPrevMonth = new Date(year, month, 0).getDate();
        for (let i = firstDayOfMonth - 1; i >= 0; i--) {
            const d = daysInPrevMonth - i;
            const prevMonthDate = new Date(year, month - 1, d);
            const dateStr = prevMonthDate.toISOString().split('T')[0];
            days.push({ dateStr, dayNum: d, isCurrentMonth: false });
        }

        // Dias do mês atual
        for (let d = 1; d <= daysInMonth; d++) {
            const m = String(month + 1).padStart(2, '0');
            const dayStr = String(d).padStart(2, '0');
            const dateStr = `${year}-${m}-${dayStr}`;
            days.push({ dateStr, dayNum: d, isCurrentMonth: true });
        }

        // Completar a grade até 35 ou 42 células
        const remaining = 42 - days.length;
        for (let d = 1; d <= remaining && days.length < 35; d++) {
            const nextMonthDate = new Date(year, month + 1, d);
            const dateStr = nextMonthDate.toISOString().split('T')[0];
            days.push({ dateStr, dayNum: d, isCurrentMonth: false });
        }

        return days;
    }, [calendarViewDate]);

    const monthNames = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200 font-sans overflow-x-hidden">
            {/* MODAL PRINCIPAL: 90% DA VIEWPORT, MÁXIMO 1700px, ALTURA MÁXIMA 95vh */}
            <div className="bg-white rounded-3xl shadow-2xl w-[90vw] max-w-[1700px] max-h-[95vh] overflow-visible border border-slate-100 flex flex-col transform transition-all animate-in zoom-in-95 duration-200 my-auto">

                {/* 1. CABEÇALHO INSTITUCIONAL */}
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0 rounded-t-3xl">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-sky-600 text-white rounded-2xl shadow-sm">
                            <FileDown className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                                Relatórios de Regulação e Atendimentos
                            </h3>
                            <p className="text-xs text-slate-500 font-semibold">
                                Configure o período, os procedimentos e o status para gerar relatórios consolidados em PDF.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Seletor rápido de tipo de relatório */}
                        <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200">
                            <button
                                type="button"
                                onClick={() => setReportType('simplificado')}
                                className={`px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
                                    reportType === 'simplificado'
                                    ? 'bg-sky-600 text-white shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                <BarChart3 className="w-3.5 h-3.5" />
                                <span>Simplificado</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setReportType('completo')}
                                className={`px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
                                    reportType === 'completo'
                                    ? 'bg-sky-600 text-white shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                <Users className="w-3.5 h-3.5" />
                                <span>Completo</span>
                            </button>
                        </div>

                        {/* Botão Fechar */}
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                            title="Fechar modal"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* 2. CORPO DO MODAL — DISTRIBUIÇÃO HORIZONTAL: PERÍODO (28%), PROCEDIMENTO (47%), STATUS (25%) */}
                <div className="p-6 bg-slate-50/50 space-y-5">
                    <div className="grid grid-cols-1 lg:grid-cols-[28%_47%_25%] gap-4 items-start">

                        {/* CARD 1 — PERÍODO (28%) */}
                        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3 relative" ref={calendarCardRef}>
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                                    <CalendarIcon className="w-4 h-4 text-sky-600" />
                                    <span>Período</span>
                                </label>
                            </div>

                            {/* Toggle Pill: Solicitação vs Agendamento */}
                            <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl border border-slate-200/80 text-xs font-bold">
                                <button
                                    type="button"
                                    onClick={() => setPeriodoTipo('solicitacao')}
                                    className={`py-1.5 rounded-lg transition-all text-center cursor-pointer ${
                                        periodoTipo === 'solicitacao'
                                            ? 'bg-sky-600 text-white shadow-xs font-black'
                                            : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                >
                                    Solicitação
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPeriodoTipo('agendamento')}
                                    className={`py-1.5 rounded-lg transition-all text-center cursor-pointer ${
                                        periodoTipo === 'agendamento'
                                            ? 'bg-sky-600 text-white shadow-xs font-black'
                                            : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                >
                                    Agendamento
                                </button>
                            </div>

                            {/* Campos De: e Até: com Popover */}
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <span className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">De:</span>
                                    <button
                                        type="button"
                                        onClick={() => toggleCalendarPopover('start')}
                                        className="w-full flex items-center gap-2 px-2.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:border-sky-500 text-xs font-bold text-slate-800 transition-all text-left shadow-2xs cursor-pointer h-11"
                                    >
                                        <CalendarIcon className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                                        <span className="truncate">{formatBrDate(dataInicio) || 'DD/MM/AAAA'}</span>
                                    </button>
                                </div>

                                <div>
                                    <span className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">Até:</span>
                                    <button
                                        type="button"
                                        onClick={() => toggleCalendarPopover('end')}
                                        className="w-full flex items-center gap-2 px-2.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:border-sky-500 text-xs font-bold text-slate-800 transition-all text-left shadow-2xs cursor-pointer h-11"
                                    >
                                        <CalendarIcon className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                                        <span className="truncate">{formatBrDate(dataFim) || 'DD/MM/AAAA'}</span>
                                    </button>
                                </div>
                            </div>

                            {/* Subtexto auxiliar de período */}
                            <span className="block text-[11px] font-bold text-slate-500">
                                {dataInicio || dataFim
                                    ? `Intervalo selecionado (${formatBrDate(dataInicio) || 'Início'} até ${formatBrDate(dataFim) || 'Fim'})`
                                    : 'Todo o histórico de registros'}
                            </span>

                            {/* Popover de Calendário com Seleção de Intervalo (Abertura Inteligente) */}
                            {isCalendarOpen && (
                                <div 
                                    className={`absolute left-0 z-50 bg-white rounded-2xl shadow-2xl border border-slate-200 p-3.5 w-76 animate-in fade-in zoom-in-95 duration-150 ${
                                        calendarPlacement === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
                                    }`}
                                >
                                    {/* Header do Calendário: Mês e Navegação */}
                                    <div className="flex items-center justify-between mb-2">
                                        <button
                                            type="button"
                                            onClick={() => setCalendarViewDate(new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() - 1, 1))}
                                            className="p-1 hover:bg-slate-100 rounded-lg text-slate-600 cursor-pointer"
                                        >
                                            <ChevronLeft className="w-4 h-4" />
                                        </button>
                                        <span className="text-xs font-black uppercase text-slate-800">
                                            {monthNames[calendarViewDate.getMonth()]} {calendarViewDate.getFullYear()}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => setCalendarViewDate(new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() + 1, 1))}
                                            className="p-1 hover:bg-slate-100 rounded-lg text-slate-600 cursor-pointer"
                                        >
                                            <ChevronRight className="w-4 h-4" />
                                        </button>
                                    </div>

                                    {/* Dias da semana */}
                                    <div className="grid grid-cols-7 text-center text-[10px] font-black uppercase text-slate-400 mb-1">
                                        <span>D</span>
                                        <span>S</span>
                                        <span>T</span>
                                        <span>Q</span>
                                        <span>Q</span>
                                        <span>S</span>
                                        <span>S</span>
                                    </div>

                                    {/* Grade de dias com destaque do intervalo */}
                                    <div className="grid grid-cols-7 gap-y-1 text-xs">
                                        {calendarDays.map((d, idx) => {
                                            const isStart = dataInicio === d.dateStr;
                                            const isEnd = dataFim === d.dateStr;
                                            const inRange = dataInicio && dataFim && d.dateStr > dataInicio && d.dateStr < dataFim;
                                            const inHoverRange = dataInicio && !dataFim && hoverDate && d.dateStr > dataInicio && d.dateStr <= hoverDate;

                                            return (
                                                <button
                                                    key={idx}
                                                    type="button"
                                                    onMouseEnter={() => setHoverDate(d.dateStr)}
                                                    onClick={() => handleDayClick(d.dateStr)}
                                                    className={`py-1 text-center font-bold text-xs transition-all relative cursor-pointer ${
                                                        !d.isCurrentMonth ? 'text-slate-300' : 'text-slate-700'
                                                    } ${
                                                        isStart || isEnd
                                                            ? 'bg-sky-600 text-white rounded-lg font-black shadow-xs'
                                                            : inRange || inHoverRange
                                                            ? 'bg-sky-50 text-sky-800 font-extrabold'
                                                            : 'hover:bg-slate-100 rounded-lg'
                                                    }`}
                                                >
                                                    {d.dayNum}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {/* Ações rápidas do Calendário */}
                                    <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setDataInicio('');
                                                setDataFim('');
                                            }}
                                            className="text-rose-600 hover:underline cursor-pointer"
                                        >
                                            Limpar
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setIsCalendarOpen(false)}
                                            className="text-sky-700 font-extrabold hover:underline cursor-pointer"
                                        >
                                            Concluir
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* CARD 2 — PROCEDIMENTO (47% — MAIOR LARGURA PARA DESCRIÇÕES EXTENSAS) */}
                        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3 relative" ref={procCardRef}>
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                                    <Stethoscope className="w-4 h-4 text-sky-600" />
                                    <span>Procedimento</span>
                                </label>
                                {selectedProcIds.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedProcIds([]);
                                        }}
                                        className="text-[10px] font-bold text-rose-600 hover:underline cursor-pointer"
                                    >
                                        Limpar seleção
                                    </button>
                                )}
                            </div>

                            {/* REGRA OBRIGATÓRIA DA SEÇÃO 5:
                                O CAMPO PRINCIPAL APRESENTA APENAS UM RESUMO FIXO E COMPACTO:
                                - Nenhuma seleção: "Todos os procedimentos"
                                - Uma seleção: "1 procedimento selecionado"
                                - Múltiplas seleções: "X procedimentos selecionados"
                                Isso impede que o campo aumente de altura quando muitos forem selecionados! */}
                            <div 
                                onClick={toggleProcDropdown}
                                className="h-11 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:border-sky-500 transition-all cursor-pointer flex items-center justify-between shadow-2xs group"
                            >
                                <div className="flex items-center gap-2 overflow-hidden">
                                    {selectedProcIds.length === 0 ? (
                                        <span className="text-xs text-slate-500 font-semibold truncate">
                                            Todos os procedimentos
                                        </span>
                                    ) : selectedProcIds.length === 1 ? (
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-black bg-sky-50 text-sky-800 border border-sky-200/90 truncate">
                                            1 procedimento selecionado
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-black bg-sky-50 text-sky-800 border border-sky-200/90 truncate">
                                            {selectedProcIds.length} procedimentos selecionados
                                        </span>
                                    )}
                                </div>
                                <ChevronDown className={`w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-transform shrink-0 ml-2 ${isProcDropdownOpen ? 'rotate-180' : ''}`} />
                            </div>

                            {/* Subtexto com contador dinâmico */}
                            <span className="block text-[11px] font-bold text-slate-500">
                                {selectedProcIds.length === 0
                                    ? `Todos os procedimentos (${procedures.length} disponíveis)`
                                    : `${selectedProcIds.length} de ${procedures.length} procedimentos selecionados`}
                            </span>

                            {/* DROPDOWN DE PROCEDIMENTOS:
                                - Altura de aproximadamente 500px no desktop (h-[500px])
                                - Abertura automática para cima ou para baixo
                                - Pesquisa fixa no topo
                                - Contador fixo no rodapé
                                - Rolagem vertical exclusiva da lista
                                - Nomes completos SEM RETICÊNCIAS (sem truncate), com quebra de linha */}
                            {isProcDropdownOpen && (
                                <div 
                                    className={`absolute left-0 right-0 z-50 bg-white rounded-2xl shadow-2xl border border-slate-200 p-3.5 flex flex-col animate-in fade-in zoom-in-95 duration-150 h-[500px] max-h-[75vh] ${
                                        procDropdownPlacement === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
                                    }`}
                                >
                                    {/* 1. Campo de Busca Fixo na parte superior */}
                                    <div className="relative mb-2 shrink-0">
                                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                        <input
                                            type="text"
                                            placeholder="Buscar procedimento por código ou nome..."
                                            value={procSearch}
                                            onChange={e => setProcSearch(e.target.value)}
                                            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 outline-none focus:border-sky-500 bg-slate-50 focus:bg-white text-slate-800 font-medium"
                                            autoFocus
                                        />
                                    </div>

                                    {/* 2. Controles de Selecionar Todos / Limpar Seleção (Fixo) */}
                                    <div className="flex items-center justify-between py-1.5 px-2 mb-1 border-b border-slate-100 text-xs font-bold shrink-0 bg-slate-50/70 rounded-lg">
                                        <label className="flex items-center gap-2 cursor-pointer text-slate-700 hover:text-slate-900 select-none">
                                            <input
                                                type="checkbox"
                                                checked={procedures.length > 0 && selectedProcIds.length === procedures.length}
                                                onChange={e => {
                                                    if (e.target.checked) {
                                                        setSelectedProcIds(procedures.map(p => p.id));
                                                    } else {
                                                        setSelectedProcIds([]);
                                                    }
                                                }}
                                                className="rounded text-sky-600 focus:ring-sky-500 w-4 h-4 cursor-pointer"
                                            />
                                            <span>Selecionar todos</span>
                                        </label>

                                        <button
                                            type="button"
                                            onClick={() => setSelectedProcIds([])}
                                            className="text-sky-700 hover:underline cursor-pointer"
                                        >
                                            Limpar seleção
                                        </button>
                                    </div>

                                    {/* 3. Lista de Procedimentos com ROLAGEM VERTICAL EXCLUSIVA
                                        EXIBIÇÃO INTEGRAL: SEM TRUNCATE, QUEBRA AUTOMÁTICA DE LINHA */}
                                    <div className="overflow-y-auto flex-1 divide-y divide-slate-100 pr-1 text-xs">
                                        {filteredProcList.length === 0 ? (
                                            <div className="text-center py-10 text-slate-400 text-xs font-medium">
                                                Nenhum procedimento encontrado com o termo informado.
                                            </div>
                                        ) : (
                                            filteredProcList.map(proc => {
                                                const isChecked = selectedProcIds.includes(proc.id);
                                                return (
                                                    <label
                                                        key={proc.id}
                                                        className={`flex items-start gap-3 p-2.5 hover:bg-slate-50 cursor-pointer rounded-xl transition-colors select-none ${
                                                            isChecked ? 'bg-sky-50/60' : ''
                                                        }`}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={isChecked}
                                                            onChange={() => {
                                                                if (isChecked) {
                                                                    setSelectedProcIds(selectedProcIds.filter(id => id !== proc.id));
                                                                } else {
                                                                    setSelectedProcIds([...selectedProcIds, proc.id]);
                                                                }
                                                            }}
                                                            className="rounded text-sky-600 focus:ring-sky-500 w-4 h-4 mt-0.5 shrink-0 cursor-pointer"
                                                        />
                                                        {/* Nome e Código Completos com quebra de linha sem reticências */}
                                                        <div className="flex-1 whitespace-normal break-words leading-relaxed">
                                                            {proc.code && (
                                                                <span className="font-mono font-black text-slate-900 mr-1.5">
                                                                    {proc.code} —
                                                                </span>
                                                            )}
                                                            <span className="font-bold text-slate-800 uppercase">
                                                                {proc.name}
                                                            </span>
                                                        </div>
                                                    </label>
                                                );
                                            })
                                        )}
                                    </div>

                                    {/* 4. Contador de Selecionados Fixo na parte inferior */}
                                    <div className="mt-2 pt-2 border-t border-slate-100 shrink-0">
                                        <div className="p-2 rounded-xl bg-sky-50 text-sky-800 text-xs font-black text-center border border-sky-100">
                                            {selectedProcIds.length} de {procedures.length} procedimentos selecionados
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* CARD 3 — STATUS (25%) */}
                        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3 relative" ref={statusCardRef}>
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                                    <Layers className="w-4 h-4 text-sky-600" />
                                    <span>Status</span>
                                </label>
                                {selectedStatuses.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedStatuses([]);
                                        }}
                                        className="text-[10px] font-bold text-rose-600 hover:underline cursor-pointer"
                                    >
                                        Limpar
                                    </button>
                                )}
                            </div>

                            {/* Campo Principal compacto para o Status */}
                            <div 
                                onClick={toggleStatusDropdown}
                                className="h-11 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:border-sky-500 transition-all cursor-pointer flex items-center justify-between shadow-2xs group"
                            >
                                <div className="flex items-center gap-2 overflow-hidden">
                                    {selectedStatuses.length === 0 ? (
                                        <span className="text-xs text-slate-500 font-semibold truncate">
                                            Todos os status
                                        </span>
                                    ) : selectedStatuses.length === 1 ? (
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-black bg-sky-50 text-sky-800 border border-sky-200/90 truncate">
                                            {selectedStatuses[0]}
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-black bg-sky-50 text-sky-800 border border-sky-200/90 truncate">
                                            {selectedStatuses.length} status selecionados
                                        </span>
                                    )}
                                </div>
                                <ChevronDown className={`w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-transform shrink-0 ml-2 ${isStatusDropdownOpen ? 'rotate-180' : ''}`} />
                            </div>

                            {/* Subtexto com contador */}
                            <span className="block text-[11px] font-bold text-slate-500">
                                {selectedStatuses.length === 0
                                    ? `Todos os status selecionados (${ALL_STATUS_OPTIONS.length})`
                                    : `${selectedStatuses.length} de ${ALL_STATUS_OPTIONS.length} status selecionados`}
                            </span>

                            {/* Popover Dropdown Múltiplo de Status */}
                            {isStatusDropdownOpen && (
                                <div 
                                    className={`absolute left-0 right-0 z-50 bg-white rounded-2xl shadow-2xl border border-slate-200 p-3.5 max-h-80 flex flex-col animate-in fade-in zoom-in-95 duration-150 ${
                                        statusDropdownPlacement === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
                                    }`}
                                >
                                    {/* Controles de Selecionar Todos / Limpar */}
                                    <div className="flex items-center justify-between py-1.5 px-2 mb-2 border-b border-slate-100 text-xs font-bold bg-slate-50/70 rounded-lg shrink-0">
                                        <label className="flex items-center gap-2 cursor-pointer text-slate-700 hover:text-slate-900 select-none">
                                            <input
                                                type="checkbox"
                                                checked={selectedStatuses.length === ALL_STATUS_OPTIONS.length}
                                                onChange={e => {
                                                    if (e.target.checked) {
                                                        setSelectedStatuses(ALL_STATUS_OPTIONS.map(s => s.id));
                                                    } else {
                                                        setSelectedStatuses([]);
                                                    }
                                                }}
                                                className="rounded text-sky-600 focus:ring-sky-500 w-4 h-4 cursor-pointer"
                                            />
                                            <span>Selecionar todos</span>
                                        </label>

                                        <button
                                            type="button"
                                            onClick={() => setSelectedStatuses([])}
                                            className="text-sky-700 hover:underline cursor-pointer"
                                        >
                                            Limpar seleção
                                        </button>
                                    </div>

                                    {/* Lista de Status com Checkboxes */}
                                    <div className="overflow-y-auto flex-1 divide-y divide-slate-100 text-xs">
                                        {ALL_STATUS_OPTIONS.map(st => {
                                            const isChecked = selectedStatuses.includes(st.id);
                                            return (
                                                <label
                                                    key={st.id}
                                                    className={`flex items-center gap-2.5 p-2 hover:bg-slate-50 cursor-pointer rounded-lg transition-colors select-none ${
                                                        isChecked ? 'bg-sky-50/60' : ''
                                                    }`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={isChecked}
                                                        onChange={() => {
                                                            if (isChecked) {
                                                                setSelectedStatuses(selectedStatuses.filter(id => id !== st.id));
                                                            } else {
                                                                setSelectedStatuses([...selectedStatuses, st.id]);
                                                            }
                                                        }}
                                                        className="rounded text-sky-600 focus:ring-sky-500 w-4 h-4 cursor-pointer"
                                                    />
                                                    <span className="font-bold text-slate-800">
                                                        {st.label}
                                                    </span>
                                                </label>
                                            );
                                        })}
                                    </div>

                                    {/* Rodapé do Dropdown */}
                                    <div className="mt-2 pt-2 border-t border-slate-100 shrink-0">
                                        <div className="p-1.5 rounded-xl bg-sky-50 text-sky-800 text-[11px] font-black text-center border border-sky-100">
                                            {selectedStatuses.length} de {ALL_STATUS_OPTIONS.length} status selecionados
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                    </div>

                    {/* 3. ÁREA DE RESUMO REORGANIZADA COM QUEBRA DE LINHA DINÂMICA E BOTÕES DE AÇÃO */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
                        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600 max-w-4xl">
                            <span className="font-extrabold text-slate-800 shrink-0">Filtros aplicados:</span>
                            <div className="inline-flex flex-wrap items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200/80 text-slate-800 font-bold leading-relaxed">
                                <CalendarIcon className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                                <span>{appliedFiltersText}</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                            <button
                                type="button"
                                onClick={handleClearFilters}
                                className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-extrabold rounded-xl text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
                            >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>Limpar Filtros</span>
                            </button>

                            <button
                                type="button"
                                onClick={handleApplyFilters}
                                className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-extrabold rounded-xl text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shadow-sm shadow-sky-600/20 active:scale-95"
                            >
                                <Filter className="w-3.5 h-3.5" />
                                <span>Aplicar Filtros</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* 4. RODAPÉ INSTITUCIONAL (EXPORTAÇÃO DIRETA) */}
                <div className="px-6 py-4 bg-white border-t border-slate-100 flex items-center justify-between rounded-b-3xl shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-extrabold rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer shadow-2xs"
                    >
                        Fechar
                    </button>

                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => handleTriggerExport('simplificado')}
                            className="px-4 py-2.5 bg-white hover:bg-sky-50 text-sky-700 border border-sky-300 font-extrabold rounded-xl text-xs uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-2xs active:scale-95"
                        >
                            <FileDown className="w-4 h-4 text-sky-600" />
                            <span>Exportar Simplificado</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => handleTriggerExport('completo')}
                            className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-extrabold rounded-xl text-xs uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-md shadow-sky-600/20 active:scale-95"
                        >
                            <FileDown className="w-4 h-4 text-white" />
                            <span>Exportar Completo</span>
                        </button>
                    </div>
                </div>

            </div>

            {/* MODAL DE ALERTA CUSTOMIZADO (SEM ALERT NATIVO) */}
            {alertMessage && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
                    <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-5 max-w-md w-full space-y-4 animate-in zoom-in-95 duration-150">
                        <div className="flex items-start gap-3">
                            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                                <AlertCircle className="w-5 h-5" />
                            </div>
                            <div className="flex-1">
                                <h4 className="text-sm font-extrabold text-slate-900">Aviso sobre o Relatório</h4>
                                <p className="text-xs text-slate-600 mt-1 font-medium leading-relaxed">{alertMessage}</p>
                            </div>
                        </div>
                        <div className="flex justify-end">
                            <button
                                type="button"
                                onClick={() => setAlertMessage(null)}
                                className="px-4 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold uppercase transition-all"
                            >
                                Entendido
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* GERADOR DE PDF REAL PRESERVADO */}
            {isPrintingReport && (
                <ConsultasReportPdfGenerator
                    reportType={pdfMode}
                    bookings={allBookings.filter(b => {
                        // Período
                        if (appliedFilters.periodoTipo === 'solicitacao') {
                            const solDate = normalizeSolicitationDate(b);
                            if (appliedFilters.dataInicio && (!solDate || solDate < appliedFilters.dataInicio)) return false;
                            if (appliedFilters.dataFim && (!solDate || solDate > appliedFilters.dataFim)) return false;
                        } else {
                            const appDate = b.appointment_date ? b.appointment_date.split('T')[0] : '';
                            if (appliedFilters.dataInicio || appliedFilters.dataFim) {
                                if (!appDate) return false;
                                if (appliedFilters.dataInicio && appDate < appliedFilters.dataInicio) return false;
                                if (appliedFilters.dataFim && appDate > appliedFilters.dataFim) return false;
                            }
                        }

                        // Procedimento
                        if (appliedFilters.selectedProcIds.length > 0) {
                            const pId = b.procedimento_id || b.procedimento?.id;
                            if (!pId || !appliedFilters.selectedProcIds.includes(pId)) return false;
                        }

                        // Status
                        if (appliedFilters.selectedStatuses.length > 0) {
                            const matches = appliedFilters.selectedStatuses.some(st => {
                                if (st === 'Aguardando Vaga') {
                                    return b.status === 'Fila de espera' || b.status === 'Aguardando Data' || b.status === 'Solicitado';
                                }
                                if (st === 'Definir Data') {
                                    const isWait = (b.status === 'Fila de espera' || b.status === 'Aguardando Data' || b.status === 'Solicitado') && !b.is_paused;
                                    const isEligible = eligibilityMap.get(b.id)?.isEligible;
                                    return isWait && isEligible;
                                }
                                if (st === 'Pausada') {
                                    return b.status === 'Pausada' || b.is_paused;
                                }
                                if (st === 'Cancelado') {
                                    return b.status === 'Cancelado' || (b.status as string) === 'Cancelada' || !!b.canceled_at;
                                }
                                return b.status === st;
                            });
                            if (!matches) return false;
                        }
                        return true;
                    })}
                    procedures={procedures}
                    queuePositions={queuePositions}
                    state={appState}
                    currentUser={currentUser}
                    appliedFiltersDescription={appliedFiltersText}
                    onClose={() => setIsPrintingReport(false)}
                />
            )}
        </div>,
        document.body
    );
};
