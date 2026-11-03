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
    Calendar, 
    Check, 
    ChevronDown, 
    ChevronUp, 
    AlertCircle, 
    CheckCircle2, 
    Clock, 
    Building2, 
    Car, 
    Sparkles,
    Loader2,
    FileQuestion,
    ListFilter,
    Stethoscope
} from 'lucide-react';
import { ConsultaAgendamento, ConsultaProcedimento, ConsultaVaga, AppState, User } from '../../types';
import * as db from '../../services/consultasService';
import { formatProcedimentoLabel, normalizeSolicitationDate } from '../../services/consultasService';
import { ConsultasReportPdfGenerator } from './ConsultasReportPdfGenerator';

export interface ReportFiltersState {
    periodoTipo: 'solicitacao' | 'agendamento';
    dataInicio: string;
    dataFim: string;
    procedimentoIds: string[];
    tipoProcedimento: 'TODOS' | 'Consulta' | 'Exame' | 'Cirurgia';
    demanda: 'TODAS' | 'INTERNO' | 'EXTERNO';
    prioridade: 'TODAS' | 'Normal' | 'Urgente' | 'Especial';
    status: 'TODOS' | 'Aguardando Vaga' | 'Definir Data' | 'Agendado' | 'Realizado' | 'Pausada' | 'Retorno' | 'Cancelado';
    situacaoFila: 'TODAS' | 'VAGA_LIVRE' | 'AGUARDANDO_FILA' | 'TOP_1' | 'TOP_3' | 'TOP_5' | 'TOP_10';
    pacienteSearch: string;
}

const DEFAULT_FILTERS: ReportFiltersState = {
    periodoTipo: 'solicitacao',
    dataInicio: '',
    dataFim: '',
    procedimentoIds: [],
    tipoProcedimento: 'TODOS',
    demanda: 'TODAS',
    prioridade: 'TODAS',
    status: 'TODOS',
    situacaoFila: 'TODAS',
    pacienteSearch: ''
};

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
    // Estado de dados puros carregados diretamente do banco de dados (origem real)
    const [loading, setLoading] = useState(true);
    const [allBookings, setAllBookings] = useState<ConsultaAgendamento[]>([]);
    const [procedures, setProcedures] = useState<ConsultaProcedimento[]>(initialProcedures);
    const [allVagas, setAllVagas] = useState<ConsultaVaga[]>(initialVagas);
    const [queuePositions, setQueuePositions] = useState<Record<string, number>>({});

    // Modo de visualização: Simplificado ou Completo
    const [reportType, setReportType] = useState<'simplificado' | 'completo'>('simplificado');
    
    // Controle de expansão do painel de filtros
    const [isFiltersPanelOpen, setIsFiltersPanelOpen] = useState(true);

    // Estado dos filtros
    const [filters, setFilters] = useState<ReportFiltersState>({ ...DEFAULT_FILTERS });

    // Pesquisa interna no dropdown de procedimentos
    const [procDropdownSearch, setProcDropdownSearch] = useState('');
    const [isProcDropdownOpen, setIsProcDropdownOpen] = useState(false);
    const procDropdownRef = useRef<HTMLDivElement>(null);

    // Controle do gerador de PDF
    const [isPrintingReport, setIsPrintingReport] = useState(false);
    const [pdfExportMode, setPdfExportMode] = useState<'simplificado' | 'completo'>('simplificado');

    // Fechar dropdown de procedimentos ao clicar fora
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (procDropdownRef.current && !procDropdownRef.current.contains(event.target as Node)) {
                setIsProcDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Carregar dados frescos diretamente do banco de dados
    const fetchFreshData = async () => {
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

            // Calcular posições da fila por procedimento conforme regra oficial
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
            console.error('[ConsultasReportModal] Erro ao carregar dados do banco:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchFreshData();
        }
    }, [isOpen]);

    // Mapa de elegibilidade de vaga livre
    const eligibilityMap = useMemo(() => {
        return db.getQueueEligibilityMap(allBookings, allVagas);
    }, [allBookings, allVagas]);

    // Contagem de filtros ativos
    const activeFiltersCount = useMemo(() => {
        let count = 0;
        if (filters.dataInicio || filters.dataFim) count++;
        if (filters.procedimentoIds.length > 0) count++;
        if (filters.tipoProcedimento !== 'TODOS') count++;
        if (filters.demanda !== 'TODAS') count++;
        if (filters.prioridade !== 'TODAS') count++;
        if (filters.status !== 'TODOS') count++;
        if (filters.situacaoFila !== 'TODAS') count++;
        if (filters.pacienteSearch.trim()) count++;
        return count;
    }, [filters]);

    // Resetar filtros
    const handleResetFilters = () => {
        setFilters({ ...DEFAULT_FILTERS });
        setProcDropdownSearch('');
    };

    // Aplicar filtros diretamente sobre o conjunto total de agendamentos
    const filteredBookings = useMemo(() => {
        return allBookings.filter(b => {
            // 1. Filtro por Período
            if (filters.periodoTipo === 'solicitacao') {
                const solDate = normalizeSolicitationDate(b);
                if (filters.dataInicio && (!solDate || solDate < filters.dataInicio)) return false;
                if (filters.dataFim && (!solDate || solDate > filters.dataFim)) return false;
            } else if (filters.periodoTipo === 'agendamento') {
                const appDate = b.appointment_date ? b.appointment_date.split('T')[0] : '';
                if (filters.dataInicio || filters.dataFim) {
                    if (!appDate) return false;
                    if (filters.dataInicio && appDate < filters.dataInicio) return false;
                    if (filters.dataFim && appDate > filters.dataFim) return false;
                }
            }

            // 2. Filtro por Procedimento
            if (filters.procedimentoIds.length > 0) {
                const pId = b.procedimento_id || b.procedimento?.id;
                if (!pId || !filters.procedimentoIds.includes(pId)) return false;
            }

            // 3. Filtro por Tipo de Procedimento (Consulta / Exame / Cirurgia)
            if (filters.tipoProcedimento !== 'TODOS') {
                const pType = b.procedimento?.type;
                if (!pType || pType.toLowerCase() !== filters.tipoProcedimento.toLowerCase()) return false;
            }

            // 4. Filtro por Demanda (Geral / Interna / Externa)
            if (filters.demanda !== 'TODAS') {
                const tipoAtendimento = b.tipo_atendimento || 'INTERNO';
                if (filters.demanda === 'INTERNO' && tipoAtendimento !== 'INTERNO') return false;
                if (filters.demanda === 'EXTERNO' && tipoAtendimento !== 'EXTERNO') return false;
            }

            // 5. Filtro por Prioridade (Normal / Urgente / Especial)
            if (filters.prioridade !== 'TODAS') {
                const pNormal = (b.priority || 'Normal').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                const targetNormal = filters.prioridade.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                if (!pNormal.includes(targetNormal)) return false;
            }

            // 6. Filtro por Status
            if (filters.status !== 'TODOS') {
                if (filters.status === 'Aguardando Vaga') {
                    const isQueue = b.status === 'Fila de espera' || b.status === 'Aguardando Data' || b.status === 'Solicitado';
                    if (!isQueue) return false;
                } else if (filters.status === 'Definir Data') {
                    const isQueue = (b.status === 'Fila de espera' || b.status === 'Aguardando Data' || b.status === 'Solicitado') && !b.is_paused;
                    const isEligible = eligibilityMap.get(b.id)?.isEligible;
                    if (!isQueue || !isEligible) return false;
                } else if (filters.status === 'Pausada') {
                    if (b.status !== 'Pausada' && !b.is_paused) return false;
                } else if (filters.status === 'Cancelado') {
                    const isCanceled = b.status === 'Cancelado' || b.status === 'Cancelada' || !!b.canceled_at;
                    if (!isCanceled) return false;
                } else {
                    if (b.status !== filters.status) return false;
                }
            }

            // 7. Filtro por Situação na Fila
            if (filters.situacaoFila !== 'TODAS') {
                const isWaitlist = b.status === 'Fila de espera' || b.status === 'Aguardando Data' || b.status === 'Solicitado';
                const pos = queuePositions[b.id] ?? b.queue_position;

                if (filters.situacaoFila === 'VAGA_LIVRE') {
                    const isEligible = eligibilityMap.get(b.id)?.isEligible;
                    if (!isWaitlist || !isEligible) return false;
                } else if (filters.situacaoFila === 'AGUARDANDO_FILA') {
                    if (!isWaitlist) return false;
                } else if (filters.situacaoFila === 'TOP_1') {
                    if (!isWaitlist || pos !== 1) return false;
                } else if (filters.situacaoFila === 'TOP_3') {
                    if (!isWaitlist || !pos || pos > 3) return false;
                } else if (filters.situacaoFila === 'TOP_5') {
                    if (!isWaitlist || !pos || pos > 5) return false;
                } else if (filters.situacaoFila === 'TOP_10') {
                    if (!isWaitlist || !pos || pos > 10) return false;
                }
            }

            // 8. Filtro por Paciente (Nome ou CPF)
            if (filters.pacienteSearch.trim()) {
                const term = filters.pacienteSearch.toLowerCase().trim();
                const cleanTermCpf = term.replace(/\D/g, '');
                
                const patName = (b.paciente?.name || '').toLowerCase();
                const patCpf = (b.paciente?.cpf || '').replace(/\D/g, '');
                const patSus = (b.paciente?.sus_number || '').replace(/\D/g, '');

                const matchesName = patName.includes(term);
                const matchesCpf = cleanTermCpf ? patCpf.includes(cleanTermCpf) : false;
                const matchesSus = cleanTermCpf ? patSus.includes(cleanTermCpf) : false;

                if (!matchesName && !matchesCpf && !matchesSus) return false;
            }

            return true;
        });
    }, [allBookings, filters, eligibilityMap, queuePositions]);

    // Agrupamento dos resultados por procedimento
    const groupedProcedures = useMemo(() => {
        const map: Record<string, {
            id: string;
            code?: string;
            name: string;
            type: string;
            totalQty: number;
            solicitados: number;
            agendados: number;
            fila: number;
            realizados: number;
            pausados: number;
            bookings: ConsultaAgendamento[];
        }> = {};

        filteredBookings.forEach(b => {
            const pId = b.procedimento_id || b.procedimento?.id || 'SEM_ID';
            const pName = formatProcedimentoLabel(b.procedimento) || 'OUTRO PROCEDIMENTO';
            const key = pId !== 'SEM_ID' ? pId : `name_${pName}`;

            if (!map[key]) {
                map[key] = {
                    id: key,
                    code: b.procedimento?.code,
                    name: pName,
                    type: b.procedimento?.type || 'Consulta',
                    totalQty: 0,
                    solicitados: 0,
                    agendados: 0,
                    fila: 0,
                    realizados: 0,
                    pausados: 0,
                    bookings: []
                };
            }

            const qty = b.quantity || 1;
            map[key].totalQty += qty;
            map[key].bookings.push(b);

            if (b.status === 'Solicitado') map[key].solicitados += qty;
            else if (b.status === 'Agendado') map[key].agendados += qty;
            else if (b.status === 'Realizado') map[key].realizados += qty;
            else if (b.status === 'Pausada' || b.is_paused) map[key].pausados += qty;
            else if (b.status === 'Fila de espera' || b.status === 'Aguardando Data') map[key].fila += qty;
        });

        // Ordenar os procedimentos por maior quantidade total e depois por ordem alfabética
        return Object.values(map).sort((a, b) => b.totalQty - a.totalQty || a.name.localeCompare(b.name));
    }, [filteredBookings]);

    // Total de solicitações encontradas
    const totalSolicitacoes = useMemo(() => {
        return filteredBookings.reduce((acc, b) => acc + (b.quantity || 1), 0);
    }, [filteredBookings]);

    // Descrição textual dos filtros aplicados para exibição e para o PDF
    const appliedFiltersDescription = useMemo(() => {
        const parts: string[] = [];

        // Período
        if (filters.dataInicio || filters.dataFim) {
            const tipoLabel = filters.periodoTipo === 'solicitacao' ? 'Solicitação' : 'Agendamento';
            const inicio = filters.dataInicio ? filters.dataInicio.split('-').reverse().join('/') : 'Início';
            const fim = filters.dataFim ? filters.dataFim.split('-').reverse().join('/') : 'Fim';
            parts.push(`Período (${tipoLabel}): ${inicio} até ${fim}`);
        }

        // Procedimentos
        if (filters.procedimentoIds.length > 0) {
            if (filters.procedimentoIds.length === 1) {
                const found = procedures.find(p => p.id === filters.procedimentoIds[0]);
                parts.push(`Procedimento: ${found ? (found.code ? `[${found.code}] ${found.name}` : found.name) : 'Selecionado'}`);
            } else {
                parts.push(`Procedimentos: ${filters.procedimentoIds.length} selecionados`);
            }
        } else {
            parts.push('Procedimento: Todos');
        }

        // Tipo
        if (filters.tipoProcedimento !== 'TODOS') {
            parts.push(`Tipo: ${filters.tipoProcedimento}`);
        }

        // Demanda
        if (filters.demanda !== 'TODAS') {
            parts.push(`Demanda: ${filters.demanda === 'INTERNO' ? 'Interna (Municipal)' : 'Externa (Fora)'}`);
        }

        // Prioridade
        if (filters.prioridade !== 'TODAS') {
            parts.push(`Prioridade: ${filters.prioridade}`);
        }

        // Status
        if (filters.status !== 'TODOS') {
            parts.push(`Status: ${filters.status}`);
        }

        // Situação na fila
        if (filters.situacaoFila !== 'TODAS') {
            const sitMap: Record<string, string> = {
                'VAGA_LIVRE': 'Vaga Livre (Elegível)',
                'AGUARDANDO_FILA': 'Aguardando na Fila',
                'TOP_1': '1º Lugar da Fila',
                'TOP_3': 'Top 3 (1º ao 3º)',
                'TOP_5': 'Top 5 (1º ao 5º)',
                'TOP_10': 'Top 10 (1º ao 10º)'
            };
            parts.push(`Fila: ${sitMap[filters.situacaoFila] || filters.situacaoFila}`);
        }

        // Paciente
        if (filters.pacienteSearch.trim()) {
            parts.push(`Paciente/CPF: "${filters.pacienteSearch.trim()}"`);
        }

        return parts.join(' • ');
    }, [filters, procedures]);

    // Formatação de data brasileira
    const formatDateBr = (d?: string | null) => {
        if (!d) return '-';
        const raw = d.includes('T') ? d.split('T')[0] : d;
        const parts = raw.split('-');
        if (parts.length !== 3) return d;
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    };

    // Formatação de CPF
    const formatCpf = (cpf?: string) => {
        if (!cpf) return 'Não informado';
        const clean = cpf.replace(/\D/g, '');
        if (clean.length === 11) {
            return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
        }
        return cpf;
    };

    // Disparar exportação PDF
    const handleExportPdf = (mode: 'simplificado' | 'completo') => {
        setPdfExportMode(mode);
        setIsPrintingReport(true);
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in font-sans">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-6xl max-h-[94vh] overflow-hidden border border-slate-100 flex flex-col transform transition-all animate-scale-in">
                
                {/* 1. HEADER DO MODAL */}
                <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-gradient-to-r from-slate-50 via-white to-sky-50/30 shrink-0">
                    <div>
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-sky-600 text-white rounded-xl shadow-sm">
                                <FileDown className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                                    Relatórios de Regulação e Atendimentos
                                </h3>
                                <p className="text-xs text-slate-500 font-semibold">
                                    Configure filtros combináveis, pré-visualize o quantitativo e exporte relatórios consolidados em PDF.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                        {/* Seletor de Modo Simplificado vs Completo */}
                        <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
                            <button
                                type="button"
                                onClick={() => setReportType('simplificado')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
                                    reportType === 'simplificado'
                                    ? 'bg-sky-600 text-white shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                                }`}
                            >
                                <BarChart3 className="w-3.5 h-3.5" />
                                <span>Simplificado</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setReportType('completo')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
                                    reportType === 'completo'
                                    ? 'bg-sky-600 text-white shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                                }`}
                            >
                                <Users className="w-3.5 h-3.5" />
                                <span>Completo</span>
                            </button>
                        </div>

                        {/* Botão fechar */}
                        <button 
                            type="button"
                            onClick={onClose} 
                            className="p-2 hover:bg-slate-200/80 rounded-xl text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                            title="Fechar modal"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* 2. PAINEL DE FILTROS COMBINÁVEIS */}
                <div className="border-b border-slate-200 bg-slate-50/70 shrink-0">
                    <div className="px-6 py-2.5 flex items-center justify-between border-b border-slate-200/60 bg-white">
                        <div className="flex items-center gap-2">
                            <ListFilter className="w-4 h-4 text-sky-600" />
                            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
                                Filtros Personalizados
                            </span>
                            {activeFiltersCount > 0 ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-sky-100 text-sky-800 border border-sky-200">
                                    {activeFiltersCount} {activeFiltersCount === 1 ? 'filtro ativo' : 'filtros ativos'}
                                </span>
                            ) : (
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                    (Exibindo todos os registros)
                                </span>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={handleResetFilters}
                                className="px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                                title="Limpar todos os filtros"
                            >
                                <RotateCcw className="w-3 h-3" />
                                <span>Limpar Filtros</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setIsFiltersPanelOpen(!isFiltersPanelOpen)}
                                className="px-2.5 py-1 text-[11px] font-bold text-sky-700 hover:bg-sky-50 rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                            >
                                {isFiltersPanelOpen ? (
                                    <>
                                        <span>Recolher</span>
                                        <ChevronUp className="w-3.5 h-3.5" />
                                    </>
                                ) : (
                                    <>
                                        <span>Expandir Filtros</span>
                                        <ChevronDown className="w-3.5 h-3.5" />
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {isFiltersPanelOpen && (
                        <div className="p-4 sm:p-5 space-y-3.5 animate-in fade-in duration-150">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                
                                {/* FILTRO 1: PERÍODO COM BASE EM SOLICITAÇÃO OU AGENDAMENTO */}
                                <div className="bg-white p-3 rounded-2xl border border-slate-200/90 shadow-2xs space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                            <Calendar className="w-3.5 h-3.5 text-sky-600" />
                                            <span>Período</span>
                                        </label>
                                        <div className="flex items-center gap-1 text-[9px] font-extrabold uppercase">
                                            <button
                                                type="button"
                                                onClick={() => setFilters({ ...filters, periodoTipo: 'solicitacao' })}
                                                className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                                                    filters.periodoTipo === 'solicitacao' 
                                                        ? 'bg-sky-600 text-white' 
                                                        : 'text-slate-500 hover:bg-slate-100'
                                                }`}
                                            >
                                                Solicitação
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setFilters({ ...filters, periodoTipo: 'agendamento' })}
                                                className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                                                    filters.periodoTipo === 'agendamento' 
                                                        ? 'bg-sky-600 text-white' 
                                                        : 'text-slate-500 hover:bg-slate-100'
                                                }`}
                                            >
                                                Agendamento
                                            </button>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <span className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">De:</span>
                                            <input
                                                type="date"
                                                value={filters.dataInicio}
                                                onChange={e => setFilters({ ...filters, dataInicio: e.target.value })}
                                                className="w-full text-xs font-semibold px-2 py-1.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-sky-500 outline-none text-slate-800"
                                            />
                                        </div>
                                        <div>
                                            <span className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Até:</span>
                                            <input
                                                type="date"
                                                value={filters.dataFim}
                                                onChange={e => setFilters({ ...filters, dataFim: e.target.value })}
                                                className="w-full text-xs font-semibold px-2 py-1.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-sky-500 outline-none text-slate-800"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* FILTRO 2: PROCEDIMENTO (TODOS OU MÚLTIPLOS COM DROPDOWN DE BUSCA) */}
                                <div className="bg-white p-3 rounded-2xl border border-slate-200/90 shadow-2xs space-y-2 relative" ref={procDropdownRef}>
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                            <Stethoscope className="w-3.5 h-3.5 text-indigo-600" />
                                            <span>Procedimento</span>
                                        </label>
                                        {filters.procedimentoIds.length > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => setFilters({ ...filters, procedimentoIds: [] })}
                                                className="text-[9px] font-bold text-rose-600 hover:underline cursor-pointer"
                                            >
                                                Limpar ({filters.procedimentoIds.length})
                                            </button>
                                        )}
                                    </div>

                                    {/* Botão de seleção múltipla */}
                                    <button
                                        type="button"
                                        onClick={() => setIsProcDropdownOpen(!isProcDropdownOpen)}
                                        className="w-full flex items-center justify-between px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white text-xs font-semibold text-slate-800 transition-all cursor-pointer"
                                    >
                                        <span className="truncate">
                                            {filters.procedimentoIds.length === 0
                                                ? 'Todos os procedimentos'
                                                : `${filters.procedimentoIds.length} selecionado(s)`}
                                        </span>
                                        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isProcDropdownOpen ? 'rotate-180' : ''}`} />
                                    </button>

                                    {/* Dropdown de procedimentos com busca */}
                                    {isProcDropdownOpen && (
                                        <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-white rounded-2xl shadow-xl border border-slate-200 p-2.5 max-h-60 flex flex-col animate-in fade-in zoom-in-95 duration-150">
                                            <div className="relative mb-2">
                                                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                                                <input
                                                    type="text"
                                                    placeholder="Buscar por nome ou código..."
                                                    value={procDropdownSearch}
                                                    onChange={e => setProcDropdownSearch(e.target.value)}
                                                    className="w-full pl-8 pr-2 py-1 text-xs rounded-lg border border-slate-200 outline-none focus:border-sky-500 bg-slate-50"
                                                    autoFocus
                                                />
                                            </div>

                                            <div className="overflow-y-auto flex-1 divide-y divide-slate-100 text-xs">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setFilters({ ...filters, procedimentoIds: [] });
                                                        setIsProcDropdownOpen(false);
                                                    }}
                                                    className={`w-full text-left px-2 py-1.5 rounded-lg flex items-center justify-between transition-colors ${
                                                        filters.procedimentoIds.length === 0 ? 'bg-sky-50 text-sky-700 font-extrabold' : 'hover:bg-slate-50 text-slate-700'
                                                    }`}
                                                >
                                                    <span>Todos os procedimentos</span>
                                                    {filters.procedimentoIds.length === 0 && <Check className="w-3.5 h-3.5" />}
                                                </button>

                                                {procedures
                                                    .filter(p => {
                                                        if (!procDropdownSearch.trim()) return true;
                                                        const s = procDropdownSearch.toLowerCase();
                                                        return (p.name || '').toLowerCase().includes(s) || (p.code || '').toLowerCase().includes(s);
                                                    })
                                                    .slice(0, 100)
                                                    .map(proc => {
                                                        const isSelected = filters.procedimentoIds.includes(proc.id);
                                                        return (
                                                            <button
                                                                key={proc.id}
                                                                type="button"
                                                                onClick={() => {
                                                                    const exists = filters.procedimentoIds.includes(proc.id);
                                                                    const updated = exists 
                                                                        ? filters.procedimentoIds.filter(id => id !== proc.id)
                                                                        : [...filters.procedimentoIds, proc.id];
                                                                    setFilters({ ...filters, procedimentoIds: updated });
                                                                }}
                                                                className={`w-full text-left px-2 py-1.5 rounded-lg flex items-center justify-between transition-colors ${
                                                                    isSelected ? 'bg-sky-50 text-sky-800 font-bold' : 'hover:bg-slate-50 text-slate-700'
                                                                }`}
                                                            >
                                                                <div className="truncate pr-2">
                                                                    <span className="block truncate leading-tight">{formatProcedimentoLabel(proc)}</span>
                                                                    {proc.code && (
                                                                        <span className="text-[9px] font-mono text-slate-400">{proc.code}</span>
                                                                    )}
                                                                </div>
                                                                {isSelected && <Check className="w-3.5 h-3.5 text-sky-600 shrink-0" />}
                                                            </button>
                                                        );
                                                    })}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* FILTRO 3: TIPO E DEMANDA */}
                                <div className="bg-white p-3 rounded-2xl border border-slate-200/90 shadow-2xs space-y-2">
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="text-[10px] font-black uppercase tracking-wider text-slate-700 block mb-1">
                                                Tipo
                                            </label>
                                            <select
                                                value={filters.tipoProcedimento}
                                                onChange={e => setFilters({ ...filters, tipoProcedimento: e.target.value as any })}
                                                className="w-full text-xs font-semibold px-2 py-1.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-sky-500 outline-none text-slate-800"
                                            >
                                                <option value="TODOS">Todos</option>
                                                <option value="Consulta">Consulta</option>
                                                <option value="Exame">Exame</option>
                                                <option value="Cirurgia">Cirurgia</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="text-[10px] font-black uppercase tracking-wider text-slate-700 block mb-1">
                                                Demanda
                                            </label>
                                            <select
                                                value={filters.demanda}
                                                onChange={e => setFilters({ ...filters, demanda: e.target.value as any })}
                                                className="w-full text-xs font-semibold px-2 py-1.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-sky-500 outline-none text-slate-800"
                                            >
                                                <option value="TODAS">Geral (Todas)</option>
                                                <option value="INTERNO">Interna</option>
                                                <option value="EXTERNO">Externa</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* Sub-linha com prioridade */}
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-700 block mb-1">
                                            Prioridade
                                        </label>
                                        <div className="grid grid-cols-4 gap-1">
                                            {(['TODAS', 'Normal', 'Urgente', 'Especial'] as const).map(p => (
                                                <button
                                                    key={p}
                                                    type="button"
                                                    onClick={() => setFilters({ ...filters, prioridade: p })}
                                                    className={`py-1 text-[10px] font-extrabold uppercase rounded-lg border transition-all cursor-pointer text-center ${
                                                        filters.prioridade === p
                                                            ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                                                            : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'
                                                    }`}
                                                >
                                                    {p === 'TODAS' ? 'Todas' : p}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* FILTRO 4: STATUS E SITUAÇÃO NA FILA */}
                                <div className="bg-white p-3 rounded-2xl border border-slate-200/90 shadow-2xs space-y-2">
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="text-[10px] font-black uppercase tracking-wider text-slate-700 block mb-1">
                                                Status
                                            </label>
                                            <select
                                                value={filters.status}
                                                onChange={e => setFilters({ ...filters, status: e.target.value as any })}
                                                className="w-full text-xs font-semibold px-2 py-1.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-sky-500 outline-none text-slate-800"
                                            >
                                                <option value="TODOS">Todos os Status</option>
                                                <option value="Aguardando Vaga">Aguardando Vaga</option>
                                                <option value="Definir Data">Definir Data (Vaga Livre)</option>
                                                <option value="Agendado">Agendado</option>
                                                <option value="Realizado">Realizado</option>
                                                <option value="Retorno">Retorno</option>
                                                <option value="Pausada">Pausada</option>
                                                <option value="Cancelado">Cancelado</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="text-[10px] font-black uppercase tracking-wider text-slate-700 block mb-1">
                                                Situação na Fila
                                            </label>
                                            <select
                                                value={filters.situacaoFila}
                                                onChange={e => setFilters({ ...filters, situacaoFila: e.target.value as any })}
                                                className="w-full text-xs font-semibold px-2 py-1.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-sky-500 outline-none text-slate-800"
                                            >
                                                <option value="TODAS">Todas as situações</option>
                                                <option value="VAGA_LIVRE">Vaga Livre (1º Elegível)</option>
                                                <option value="AGUARDANDO_FILA">Aguardando na Fila</option>
                                                <option value="TOP_1">1º Lugar da Fila</option>
                                                <option value="TOP_3">Top 3 (1º ao 3º)</option>
                                                <option value="TOP_5">Top 5 (1º ao 5º)</option>
                                                <option value="TOP_10">Top 10 (1º ao 10º)</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* Busca Paciente por Nome ou CPF */}
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-700 block mb-1">
                                            Paciente (Nome ou CPF)
                                        </label>
                                        <div className="relative">
                                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                                            <input
                                                type="text"
                                                placeholder="Nome do paciente ou CPF..."
                                                value={filters.pacienteSearch}
                                                onChange={e => setFilters({ ...filters, pacienteSearch: e.target.value })}
                                                className="w-full pl-8 pr-2 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-sky-500 outline-none text-slate-800"
                                            />
                                            {filters.pacienteSearch && (
                                                <button
                                                    type="button"
                                                    onClick={() => setFilters({ ...filters, pacienteSearch: '' })}
                                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Barra de Ações de Filtros */}
                            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/80">
                                <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-2">
                                    <span>Filtros aplicados:</span>
                                    <span className="font-extrabold text-slate-800 line-clamp-1 max-w-xl">
                                        {appliedFiltersDescription || 'Nenhum filtro específico aplicado.'}
                                    </span>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={handleResetFilters}
                                        className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 font-extrabold rounded-xl text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                                    >
                                        <RotateCcw className="w-3.5 h-3.5" />
                                        <span>Limpar Filtros</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={fetchFreshData}
                                        className="px-4 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-extrabold rounded-xl text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shadow-sm shadow-sky-600/20 active:scale-95"
                                    >
                                        <Filter className="w-3.5 h-3.5" />
                                        <span>Aplicar Filtros</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* 3. RESUMO RÁPIDO DE QUANTITATIVOS E RESULTADOS */}
                <div className="px-6 py-3 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                            <BarChart3 className="w-4 h-4 text-sky-400" />
                            <span className="text-xs font-black uppercase tracking-wider">
                                {reportType === 'simplificado' ? 'Pré-visualização Simplificada' : 'Pré-visualização Completa com Pacientes'}
                            </span>
                        </div>
                        <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-slate-800 text-sky-300 border border-slate-700">
                            {groupedProcedures.length} {groupedProcedures.length === 1 ? 'Procedimento' : 'Procedimentos'}
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-300">Total Encontrado:</span>
                        <span className="text-sm font-black text-sky-300 bg-sky-950/80 px-3 py-0.5 rounded-lg border border-sky-800 font-mono">
                            {totalSolicitacoes} {totalSolicitacoes === 1 ? 'Solicitação' : 'Solicitações'}
                        </span>
                    </div>
                </div>

                {/* 4. MODAL BODY (PRÉ-VISUALIZAÇÃO DINÂMICA) */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 min-h-0 bg-slate-50/40">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 space-y-3">
                            <Loader2 className="w-10 h-10 text-sky-600 animate-spin" />
                            <p className="text-xs font-extrabold uppercase text-slate-500 tracking-wider">
                                Consultando dados em tempo real no banco de dados...
                            </p>
                        </div>
                    ) : filteredBookings.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 px-4 bg-white rounded-3xl border border-dashed border-slate-300 text-center space-y-3 shadow-2xs">
                            <div className="p-4 bg-slate-100 rounded-full text-slate-400">
                                <FileQuestion className="w-10 h-10" />
                            </div>
                            <h4 className="text-base font-black text-slate-800">
                                Nenhum registro encontrado para os filtros selecionados
                            </h4>
                            <p className="text-xs text-slate-500 max-w-md font-medium">
                                Experimente alterar o período de busca, limpar filtros de paciente ou selecionar outros procedimentos para visualizar os quantitativos.
                            </p>
                            <button
                                type="button"
                                onClick={handleResetFilters}
                                className="mt-2 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                            >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>Restaurar Filtros Padrão</span>
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* MODO SIMPLIFICADO: TABELA QUANTITATIVA CONSOLIDADA POR PROCEDIMENTO */}
                            {reportType === 'simplificado' && (
                                <div className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-sm">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-slate-100 text-[10px] font-black uppercase text-slate-600 border-b border-slate-200">
                                                    <th className="px-4 py-3">Código</th>
                                                    <th className="px-4 py-3">Procedimento</th>
                                                    <th className="px-4 py-3 text-center w-28">Tipo</th>
                                                    <th className="px-4 py-3 text-center w-28">Em Fila</th>
                                                    <th className="px-4 py-3 text-center w-28">Agendados</th>
                                                    <th className="px-4 py-3 text-center w-28">Realizados</th>
                                                    <th className="px-4 py-3 text-center w-36 bg-slate-200/60">Total</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                                                {groupedProcedures.map(group => (
                                                    <tr key={group.id} className="hover:bg-slate-50/80 transition-colors">
                                                        <td className="px-4 py-2.5 font-mono text-[11px] font-bold text-slate-500">
                                                            {group.code ? (
                                                                <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                                                    {group.code}
                                                                </span>
                                                            ) : '-'}
                                                        </td>
                                                        <td className="px-4 py-2.5">
                                                            <div className="font-extrabold text-slate-900 uppercase">
                                                                {group.name}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-2.5 text-center">
                                                            <span className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-black uppercase border ${
                                                                group.type === 'Exame'
                                                                    ? 'bg-sky-50 text-sky-800 border-sky-200'
                                                                    : group.type === 'Consulta'
                                                                    ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                                                                    : 'bg-rose-50 text-rose-800 border-rose-200'
                                                            }`}>
                                                                {group.type}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-2.5 text-center font-mono font-bold text-amber-700">
                                                            {group.fila + group.solicitados}
                                                        </td>
                                                        <td className="px-4 py-2.5 text-center font-mono font-bold text-indigo-700">
                                                            {group.agendados}
                                                        </td>
                                                        <td className="px-4 py-2.5 text-center font-mono font-bold text-emerald-700">
                                                            {group.realizados}
                                                        </td>
                                                        <td className="px-4 py-2.5 text-center font-mono font-black text-slate-900 text-sm bg-slate-50/50">
                                                            {group.totalQty}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                            <tfoot className="bg-slate-100 border-t-2 border-slate-300 text-xs font-black text-slate-900">
                                                <tr>
                                                    <td colSpan={3} className="px-4 py-3 uppercase text-right tracking-wider">
                                                        Total Geral Consolidado:
                                                    </td>
                                                    <td className="px-4 py-3 text-center font-mono font-black text-amber-800">
                                                        {groupedProcedures.reduce((acc, g) => acc + g.fila + g.solicitados, 0)}
                                                    </td>
                                                    <td className="px-4 py-3 text-center font-mono font-black text-indigo-800">
                                                        {groupedProcedures.reduce((acc, g) => acc + g.agendados, 0)}
                                                    </td>
                                                    <td className="px-4 py-3 text-center font-mono font-black text-emerald-800">
                                                        {groupedProcedures.reduce((acc, g) => acc + g.realizados, 0)}
                                                    </td>
                                                    <td className="px-4 py-3 text-center font-mono font-black text-sky-950 text-base bg-slate-200/70">
                                                        {totalSolicitacoes}
                                                    </td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* MODO COMPLETO: AGRUPAMENTO POR PROCEDIMENTO COM LISTAGEM DOS PACIENTES VINCULADOS */}
                            {reportType === 'completo' && (
                                <div className="space-y-5 animate-in fade-in duration-150">
                                    {groupedProcedures.map((group, groupIdx) => (
                                        <div key={group.id} className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-sm">
                                            {/* Cabeçalho do Procedimento */}
                                            <div className="p-4 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                                <div className="flex items-center gap-2.5">
                                                    <span className="w-6 h-6 rounded-lg bg-sky-600 text-white text-[10px] font-black flex items-center justify-center shrink-0">
                                                        #{groupIdx + 1}
                                                    </span>
                                                    <div>
                                                        <h4 className="text-sm font-extrabold uppercase tracking-tight flex items-center gap-2">
                                                            <span>{group.name}</span>
                                                            {group.code && (
                                                                <span className="text-[10px] font-mono text-sky-300 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                                                                    CÓD: {group.code}
                                                                </span>
                                                            )}
                                                        </h4>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2 self-end sm:self-center">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border ${
                                                        group.type === 'Exame'
                                                            ? 'bg-sky-950 text-sky-300 border-sky-800'
                                                            : group.type === 'Consulta'
                                                            ? 'bg-indigo-950 text-indigo-300 border-indigo-800'
                                                            : 'bg-rose-950 text-rose-300 border-rose-800'
                                                    }`}>
                                                        {group.type}
                                                    </span>
                                                    <span className="text-xs font-black uppercase px-2.5 py-0.5 rounded-full bg-slate-800 text-sky-200 border border-slate-700 font-mono">
                                                        {group.totalQty} {group.totalQty === 1 ? 'Paciente' : 'Pacientes'}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Tabela de Pacientes Vinculados a este Procedimento */}
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-left border-collapse">
                                                    <thead>
                                                        <tr className="bg-slate-100 text-[10px] font-black uppercase text-slate-600 border-b border-slate-200">
                                                            <th className="px-3 py-2 text-center w-16">Posição</th>
                                                            <th className="px-3 py-2 text-center w-28">Solicitado</th>
                                                            <th className="px-4 py-2">Paciente / CPF / Cartão SUS</th>
                                                            <th className="px-3 py-2 text-center w-36">Data Agendada</th>
                                                            <th className="px-3 py-2 text-center w-28">Demanda</th>
                                                            <th className="px-3 py-2 text-center w-28">Prioridade</th>
                                                            <th className="px-3 py-2 text-center w-28">Status</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700 uppercase">
                                                        {group.bookings
                                                            .sort((a, b) => {
                                                                const posA = queuePositions[a.id] || 999999;
                                                                const posB = queuePositions[b.id] || 999999;
                                                                if (posA !== posB) return posA - posB;
                                                                const nameA = a.paciente?.name || '';
                                                                const nameB = b.paciente?.name || '';
                                                                return nameA.localeCompare(nameB);
                                                            })
                                                            .map((booking, idx) => {
                                                                const isWaitlist = booking.status === 'Fila de espera' || booking.status === 'Aguardando Data' || booking.status === 'Solicitado';
                                                                const queuePos = queuePositions[booking.id] ?? booking.queue_position;

                                                                return (
                                                                    <tr key={booking.id} className="hover:bg-slate-50/70 transition-colors">
                                                                        <td className="px-3 py-2 text-center font-black">
                                                                            {isWaitlist && queuePos ? (
                                                                                <span className="inline-block px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-300 text-[10px] font-black">
                                                                                    {queuePos}º
                                                                                </span>
                                                                            ) : (
                                                                                <span className="text-slate-400 font-mono text-xs">
                                                                                    #{idx + 1}
                                                                                </span>
                                                                            )}
                                                                        </td>
                                                                        <td className="px-3 py-2 text-center font-mono text-slate-600 text-[11px]">
                                                                            {formatDateBr(booking.solicitation_date || (booking.created_at ? booking.created_at.split('T')[0] : null))}
                                                                        </td>
                                                                        <td className="px-4 py-2">
                                                                            <div className="font-extrabold text-slate-900 leading-tight">
                                                                                {booking.paciente?.name || 'PACIENTE NÃO INFORMADO'}
                                                                            </div>
                                                                            <div className="text-[10px] text-slate-500 font-mono flex items-center gap-2 mt-0.5">
                                                                                <span>CPF: {formatCpf(booking.paciente?.cpf)}</span>
                                                                                {booking.paciente?.sus_number && (
                                                                                    <span>• SUS: {booking.paciente.sus_number}</span>
                                                                                )}
                                                                            </div>
                                                                        </td>
                                                                        <td className="px-3 py-2 text-center font-mono text-[11px]">
                                                                            {booking.appointment_date ? (
                                                                                <span className="font-bold text-slate-800">
                                                                                    {formatDateBr(booking.appointment_date)}
                                                                                    {booking.appointment_time ? ` às ${booking.appointment_time.substring(0, 5)}` : ''}
                                                                                </span>
                                                                            ) : (
                                                                                <span className="inline-block px-2 py-0.5 rounded text-[9px] font-black uppercase text-amber-800 bg-amber-50 border border-amber-200">
                                                                                    Aguardando Vaga
                                                                                </span>
                                                                            )}
                                                                        </td>
                                                                        <td className="px-3 py-2 text-center">
                                                                            <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-black uppercase border ${
                                                                                (booking.tipo_atendimento || 'INTERNO') === 'INTERNO'
                                                                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                                                                    : 'bg-purple-50 text-purple-800 border-purple-200'
                                                                            }`}>
                                                                                {(booking.tipo_atendimento || 'INTERNO') === 'INTERNO' ? 'INTERNO' : 'EXTERNO'}
                                                                            </span>
                                                                        </td>
                                                                        <td className="px-3 py-2 text-center">
                                                                            <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-black uppercase border ${
                                                                                booking.priority === 'Especial'
                                                                                    ? 'bg-purple-50 text-purple-800 border-purple-200'
                                                                                    : booking.priority === 'Urgente'
                                                                                    ? 'bg-rose-50 text-rose-800 border-rose-200'
                                                                                    : 'bg-slate-50 text-slate-700 border-slate-200'
                                                                            }`}>
                                                                                {booking.priority || 'Normal'}
                                                                            </span>
                                                                        </td>
                                                                        <td className="px-3 py-2 text-center">
                                                                            <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                                                                                booking.status === 'Solicitado'
                                                                                    ? 'bg-sky-50 text-sky-800 border-sky-200'
                                                                                    : booking.status === 'Agendado'
                                                                                    ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                                                                                    : booking.status === 'Realizado'
                                                                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                                                                    : booking.status === 'Pausada' || booking.is_paused
                                                                                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                                                                                    : booking.status === 'Cancelado' || booking.status === 'Cancelada'
                                                                                    ? 'bg-rose-50 text-rose-800 border-rose-200'
                                                                                    : 'bg-amber-50 text-amber-800 border-amber-200'
                                                                            }`}>
                                                                                {booking.is_paused ? 'Pausada' : booking.status}
                                                                            </span>
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* 5. FOOTER DE EXPORTAÇÃO */}
                <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-full sm:w-auto px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 font-extrabold rounded-xl text-xs uppercase tracking-wider active:scale-95 transition-all cursor-pointer shadow-2xs"
                    >
                        Fechar
                    </button>

                    <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto justify-end">
                        <button
                            type="button"
                            disabled={loading || filteredBookings.length === 0}
                            onClick={() => handleExportPdf('simplificado')}
                            className={`w-full sm:w-auto px-4 py-2.5 font-extrabold rounded-xl text-xs uppercase tracking-wider active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm ${
                                loading || filteredBookings.length === 0
                                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-200'
                                    : 'bg-white hover:bg-sky-50 text-sky-800 border border-sky-300 hover:border-sky-400'
                            }`}
                        >
                            <FileDown className="w-4 h-4 text-sky-600" />
                            <span>Exportar Simplificado ({groupedProcedures.length} Procedimentos)</span>
                        </button>

                        <button
                            type="button"
                            disabled={loading || filteredBookings.length === 0}
                            onClick={() => handleExportPdf('completo')}
                            className={`w-full sm:w-auto px-5 py-2.5 font-extrabold rounded-xl text-xs uppercase tracking-wider active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md ${
                                loading || filteredBookings.length === 0
                                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                                    : 'bg-sky-600 hover:bg-sky-700 text-white shadow-sky-600/20'
                            }`}
                        >
                            <FileDown className="w-4 h-4 text-white" />
                            <span>Exportar Completo ({totalSolicitacoes} Pacientes)</span>
                        </button>
                    </div>
                </div>

            </div>

            {/* GERADOR DE PDF REAL */}
            {isPrintingReport && (
                <ConsultasReportPdfGenerator
                    reportType={pdfExportMode}
                    demandaFilter={filters.demanda}
                    bookings={filteredBookings}
                    procedures={procedures}
                    queuePositions={queuePositions}
                    state={appState}
                    currentUser={currentUser}
                    appliedFiltersDescription={appliedFiltersDescription}
                    onClose={() => setIsPrintingReport(false)}
                />
            )}
        </div>,
        document.body
    );
};

