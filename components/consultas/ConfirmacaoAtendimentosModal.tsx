import React, { useState, useMemo } from 'react';
import { ConsultaAgendamento, User } from '../../types';
import { 
    Check, 
    X, 
    Search, 
    Calendar, 
    Clock, 
    User as UserIcon, 
    Stethoscope, 
    ChevronDown, 
    ChevronRight, 
    CheckCircle2, 
    AlertCircle, 
    Loader2, 
    Sparkles, 
    Filter,
    ArrowUpDown
} from 'lucide-react';
import { formatProcedimentoLabel } from '../../services/consultasService';

interface ConfirmacaoAtendimentosModalProps {
    isOpen: boolean;
    onClose: () => void;
    pendencias: ConsultaAgendamento[];
    currentUser: User;
    onConfirmar: (id: string, situacao: 'Realizado' | 'Não Realizado') => Promise<void>;
}

type PeriodFilterType = 'todas' | 'ontem' | '7dias' | 'personalizado';
type SortFieldType = 'data' | 'horario' | 'paciente' | 'especialidade';

export const ConfirmacaoAtendimentosModal: React.FC<ConfirmacaoAtendimentosModalProps> = ({
    isOpen,
    onClose,
    pendencias,
    currentUser,
    onConfirmar
}) => {
    // Estados dos Filtros
    const [searchTerm, setSearchTerm] = useState('');
    const [periodFilter, setPeriodFilter] = useState<PeriodFilterType>('todas');
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');
    const [selectedEspecialidade, setSelectedEspecialidade] = useState('');
    const [sortField, setSortField] = useState<SortFieldType>('data');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    
    // Controle de Linhas em Processamento (loading individual por linha)
    const [processingIds, setProcessingIds] = useState<Record<string, 'Realizado' | 'Não Realizado' | undefined>>({});
    const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

    // Grupos recolhidos (por data)
    const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

    // Toggle grupo expandido/recolhido
    const toggleGroup = (dateKey: string) => {
        setCollapsedGroups(prev => ({
            ...prev,
            [dateKey]: !prev[dateKey]
        }));
    };

    // Extrair lista única de especialidades/procedimentos disponíveis
    const especialidadesDisponiveis = useMemo(() => {
        const set = new Set<string>();
        pendencias.forEach(p => {
            const esp = p.procedimento?.especialista?.especialidade || p.procedimento?.type || p.procedimento?.name;
            if (esp) set.add(esp);
        });
        return Array.from(set).sort();
    }, [pendencias]);

    // Calcular data de ontem e limites
    const { ontemStr, seteDiasStr } = useMemo(() => {
        const now = new Date();
        const ontem = new Date(now);
        ontem.setDate(ontem.getDate() - 1);
        const seteDias = new Date(now);
        seteDias.setDate(seteDias.getDate() - 7);

        return {
            ontemStr: ontem.toISOString().split('T')[0],
            seteDiasStr: seteDias.toISOString().split('T')[0]
        };
    }, []);

    // Normalização para busca
    const normalizeStr = (str: string) => {
        return (str || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim();
    };

    // Filtragem dos agendamentos
    const filteredList = useMemo(() => {
        let result = [...pendencias];

        // 1. Filtro de Período
        if (periodFilter === 'ontem') {
            result = result.filter(item => item.appointment_date === ontemStr);
        } else if (periodFilter === '7dias') {
            result = result.filter(item => {
                if (!item.appointment_date) return false;
                return item.appointment_date >= seteDiasStr;
            });
        } else if (periodFilter === 'personalizado') {
            if (customStartDate) {
                result = result.filter(item => (item.appointment_date || '') >= customStartDate);
            }
            if (customEndDate) {
                result = result.filter(item => (item.appointment_date || '') <= customEndDate);
            }
        }

        // 2. Filtro por Especialidade / Procedimento
        if (selectedEspecialidade) {
            result = result.filter(item => {
                const esp = item.procedimento?.especialista?.especialidade || item.procedimento?.type || item.procedimento?.name;
                return esp === selectedEspecialidade;
            });
        }

        // 3. Pesquisa Dinâmica (Paciente, Procedimento, Especialidade, Responsável/Profissional)
        const q = normalizeStr(searchTerm);
        if (q) {
            const qWords = q.split(/\s+/).filter(Boolean);

            result = result.filter(item => {
                const pacNome = normalizeStr(item.paciente?.name || '');
                const procNome = normalizeStr(item.procedimento?.name || '');
                const espNome = normalizeStr(item.procedimento?.especialista?.nome || '');
                const espEspec = normalizeStr(item.procedimento?.especialista?.especialidade || '');
                const respNome = normalizeStr(item.responsavel?.name || '');

                const targetTexts = [pacNome, procNome, espNome, espEspec, respNome];

                // Exige correspondência por início de palavra
                return qWords.every(word => {
                    return targetTexts.some(text => {
                        const words = text.split(/\s+/);
                        return words.some(w => w.startsWith(word));
                    });
                });
            });
        }

        // 4. Ordenação
        result.sort((a, b) => {
            let comp = 0;
            if (sortField === 'data') {
                const dateA = a.appointment_date || '';
                const dateB = b.appointment_date || '';
                comp = dateA.localeCompare(dateB);
                if (comp === 0) {
                    const timeA = a.appointment_time || '';
                    const timeB = b.appointment_time || '';
                    comp = timeA.localeCompare(timeB);
                }
            } else if (sortField === 'horario') {
                const timeA = a.appointment_time || '';
                const timeB = b.appointment_time || '';
                comp = timeA.localeCompare(timeB);
                if (comp === 0) {
                    const dateA = a.appointment_date || '';
                    const dateB = b.appointment_date || '';
                    comp = dateA.localeCompare(dateB);
                }
            } else if (sortField === 'paciente') {
                const nameA = a.paciente?.name || '';
                const nameB = b.paciente?.name || '';
                comp = nameA.localeCompare(nameB);
            } else if (sortField === 'especialidade') {
                const espA = a.procedimento?.especialista?.especialidade || a.procedimento?.name || '';
                const espB = b.procedimento?.especialista?.especialidade || b.procedimento?.name || '';
                comp = espA.localeCompare(espB);
            }

            return sortDirection === 'asc' ? comp : -comp;
        });

        return result;
    }, [pendencias, periodFilter, ontemStr, seteDiasStr, customStartDate, customEndDate, selectedEspecialidade, searchTerm, sortField, sortDirection]);

    // Agrupamento por Data
    const groupedByDate = useMemo(() => {
        const groups: { dateKey: string; formattedDate: string; items: ConsultaAgendamento[] }[] = [];
        const map = new Map<string, ConsultaAgendamento[]>();

        filteredList.forEach(item => {
            const dKey = item.appointment_date || 'Sem data';
            if (!map.has(dKey)) {
                map.set(dKey, []);
            }
            map.get(dKey)!.push(item);
        });

        map.forEach((items, dateKey) => {
            let formattedDate = dateKey;
            if (dateKey !== 'Sem data') {
                try {
                    const [y, m, d] = dateKey.split('-');
                    formattedDate = `${d}/${m}/${y}`;
                } catch {}
            }
            groups.push({ dateKey, formattedDate, items });
        });

        return groups;
    }, [filteredList]);

    // Executar ação de confirmação individual
    const handleAction = async (id: string, situacao: 'Realizado' | 'Não Realizado') => {
        if (processingIds[id]) return;

        setProcessingIds(prev => ({ ...prev, [id]: situacao }));
        setRowErrors(prev => {
            const next = { ...prev };
            delete next[id];
            return next;
        });

        try {
            await onConfirmar(id, situacao);
        } catch (err: any) {
            console.error('Erro ao confirmar atendimento:', err);
            setRowErrors(prev => ({
                ...prev,
                [id]: err.message || 'Falha na confirmação. Tente novamente.'
            }));
        } finally {
            setProcessingIds(prev => {
                const next = { ...prev };
                delete next[id];
                return next;
            });
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/70 backdrop-blur-md p-1 sm:p-2 md:p-3 overflow-hidden select-none animate-in fade-in duration-200">
            {/* Container Responsivo com aproveitamento máximo do viewport: 96vw/94dvh no Desktop, 98vw/96dvh no Tablet, 100vw/100dvh no Mobile */}
            <div className="w-full h-full md:w-[98vw] md:h-[96dvh] lg:w-[96vw] lg:h-[94dvh] bg-white rounded-2xl md:rounded-3xl shadow-2xl border border-slate-200/90 flex flex-col overflow-hidden">
                
                {/* 1. CABEÇALHO COMPACTO FIXO */}
                <header className="bg-white border-b border-slate-200/90 px-3.5 py-2.5 sm:px-5 sm:py-3 shrink-0 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-md shadow-emerald-500/20 shrink-0">
                            <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-xs sm:text-sm md:text-base font-black text-slate-900 tracking-tight uppercase leading-tight truncate">
                                Confirmação de Atendimentos
                            </h2>
                            <p className="text-[10px] sm:text-xs font-semibold text-slate-500 truncate leading-tight">
                                Existem atendimentos anteriores aguardando confirmação.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        {/* Contador Dinâmico de Pendências */}
                        <div className="px-2.5 py-1 sm:px-3 sm:py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[11px] sm:text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-2xs">
                            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                            <span>{pendencias.length} pendentes</span>
                        </div>

                        {/* Botão Fechar / Resolver Depois */}
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1 sm:p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                            title="Fechar (Resolver Depois)"
                        >
                            <X className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>
                    </div>
                </header>

                {/* 2. BARRA DE FERRAMENTAS COMPACTA */}
                <div className="bg-slate-50/80 border-b border-slate-200/90 px-3 py-2 sm:px-5 sm:py-2.5 shrink-0 flex flex-wrap items-center justify-between gap-2">
                    {/* Campo de Pesquisa Dinâmica */}
                    <div className="relative flex-1 min-w-[180px] max-w-md">
                        <input
                            type="text"
                            placeholder="Pesquisar paciente ou procedimento..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-white border border-slate-200/90 focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 rounded-xl pl-8 pr-7 py-1.5 text-xs font-semibold text-slate-900 placeholder:text-slate-400 shadow-2xs transition-all"
                        />
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        {searchTerm && (
                            <button
                                type="button"
                                onClick={() => setSearchTerm('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-0.5 rounded-full"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        )}
                    </div>

                    {/* Filtros em linha */}
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        {/* Filtro de Data */}
                        <select
                            value={periodFilter}
                            onChange={(e) => setPeriodFilter(e.target.value as PeriodFilterType)}
                            className="bg-white border border-slate-200/90 rounded-xl px-2.5 py-1.5 text-[11px] sm:text-xs font-bold text-slate-700 shadow-2xs hover:border-slate-300 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/10 cursor-pointer"
                        >
                            <option value="todas">Todas as pendências</option>
                            <option value="ontem">Ontem</option>
                            <option value="7dias">Últimos 7 dias</option>
                            <option value="personalizado">Período personalizado</option>
                        </select>

                        {/* Campos de Período Personalizado */}
                        {periodFilter === 'personalizado' && (
                            <div className="flex items-center gap-1 bg-white border border-slate-200/90 rounded-xl px-2 py-1 shadow-2xs">
                                <input
                                    type="date"
                                    value={customStartDate}
                                    onChange={(e) => setCustomStartDate(e.target.value)}
                                    className="text-[10px] sm:text-xs font-semibold text-slate-700 border-none bg-transparent p-0 focus:ring-0"
                                />
                                <span className="text-[10px] text-slate-400">até</span>
                                <input
                                    type="date"
                                    value={customEndDate}
                                    onChange={(e) => setCustomEndDate(e.target.value)}
                                    className="text-[10px] sm:text-xs font-semibold text-slate-700 border-none bg-transparent p-0 focus:ring-0"
                                />
                            </div>
                        )}

                        {/* Filtro por Especialidade */}
                        {especialidadesDisponiveis.length > 0 && (
                            <select
                                value={selectedEspecialidade}
                                onChange={(e) => setSelectedEspecialidade(e.target.value)}
                                className="bg-white border border-slate-200/90 rounded-xl px-2.5 py-1.5 text-[11px] sm:text-xs font-bold text-slate-700 shadow-2xs hover:border-slate-300 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/10 max-w-[160px] truncate cursor-pointer"
                            >
                                <option value="">Todas Especialidades</option>
                                {especialidadesDisponiveis.map(esp => (
                                    <option key={esp} value={esp}>{esp}</option>
                                ))}
                            </select>
                        )}

                        {/* Ordenação */}
                        <div className="flex items-center gap-1 bg-white border border-slate-200/90 rounded-xl px-2 py-1 shadow-2xs">
                            <span className="text-[10px] font-black uppercase text-slate-400 hidden xl:inline">Ordem:</span>
                            <select
                                value={sortField}
                                onChange={(e) => setSortField(e.target.value as SortFieldType)}
                                className="text-[11px] sm:text-xs font-bold text-slate-700 bg-transparent border-none p-0 focus:ring-0 cursor-pointer"
                            >
                                <option value="data">Data</option>
                                <option value="horario">Horário</option>
                                <option value="paciente">Paciente</option>
                                <option value="especialidade">Especialidade</option>
                            </select>
                            <button
                                type="button"
                                onClick={() => setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')}
                                className="p-1 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
                                title={sortDirection === 'asc' ? 'Crescente' : 'Decrescente'}
                            >
                                <ArrowUpDown className="w-3 h-3" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* 3. GRID OPERACIONAL CENTRAL COM ROLAGEM VERTICAL EXCLUSIVA */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 bg-slate-50/30 custom-scrollbar p-2 sm:p-3 md:p-4">
                    {pendencias.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center p-8 text-center">
                            <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/10 mb-3">
                                <Sparkles className="w-7 h-7" />
                            </div>
                            <h3 className="text-sm sm:text-base font-black text-slate-800 uppercase tracking-tight">
                                Atendimentos em Dia!
                            </h3>
                            <p className="text-xs text-slate-500 font-semibold max-w-sm mt-1">
                                Não existem agendamentos anteriores aguardando confirmação no momento.
                            </p>
                        </div>
                    ) : filteredList.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400">
                            <AlertCircle className="w-10 h-10 mb-2 opacity-30 text-slate-500" />
                            <h4 className="text-xs sm:text-sm font-bold text-slate-700">Nenhum atendimento corresponde aos filtros</h4>
                            <p className="text-[11px] text-slate-500 mt-0.5">Tente limpar a pesquisa ou selecionar outro período.</p>
                        </div>
                    ) : (
                        <div className="space-y-3 w-full">
                            {groupedByDate.map((group) => {
                                const isCollapsed = !!collapsedGroups[group.dateKey];

                                return (
                                    <div 
                                        key={group.dateKey} 
                                        className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden transition-all"
                                    >
                                        {/* Cabeçalho do Grupo de Data Expansível / Recolhível */}
                                        <button
                                            type="button"
                                            onClick={() => toggleGroup(group.dateKey)}
                                            className="w-full bg-slate-100/70 hover:bg-slate-100 px-3.5 py-2 flex items-center justify-between border-b border-slate-200/80 transition-colors text-left cursor-pointer"
                                        >
                                            <div className="flex items-center gap-2">
                                                {isCollapsed ? (
                                                    <ChevronRight className="w-4 h-4 text-slate-500" />
                                                ) : (
                                                    <ChevronDown className="w-4 h-4 text-slate-500" />
                                                )}
                                                <Calendar className="w-3.5 h-3.5 text-sky-600" />
                                                <span className="text-xs sm:text-sm font-black text-slate-800 tracking-tight">
                                                    {group.formattedDate}
                                                </span>
                                            </div>

                                            <span className="px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600 font-extrabold text-[10px] sm:text-[11px] uppercase tracking-wider shadow-2xs">
                                                {group.items.length} {group.items.length === 1 ? 'pendente' : 'pendentes'}
                                            </span>
                                        </button>

                                        {/* Listagem do Grupo */}
                                        {!isCollapsed && (
                                            <div className="divide-y divide-slate-100">
                                                {/* Cabeçalho de Colunas (visível em telas médias e desktop) */}
                                                <div className="hidden md:grid md:grid-cols-12 gap-2 px-3.5 py-1.5 bg-slate-50/80 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                                                    <div className="col-span-4">Paciente</div>
                                                    <div className="col-span-4">Especialidade / Procedimento</div>
                                                    <div className="col-span-2 text-center">Data / Horário</div>
                                                    <div className="col-span-2 text-right pr-2">Situação</div>
                                                </div>

                                                {group.items.map((booking) => {
                                                    const isProcessing = !!processingIds[booking.id];
                                                    const currentAction = processingIds[booking.id];
                                                    const errorMsg = rowErrors[booking.id];

                                                    const procLabel = formatProcedimentoLabel(booking.procedimento);
                                                    const especialidade = booking.procedimento?.especialista?.especialidade || booking.procedimento?.type || 'Consulta';
                                                    const especialistaNome = booking.procedimento?.especialista?.nome;
                                                    const prestadorInfo = booking.prestador;

                                                    return (
                                                        <div 
                                                            key={booking.id}
                                                            className={`px-3 py-2 sm:px-3.5 sm:py-2.5 transition-colors hover:bg-sky-50/30 flex flex-col md:grid md:grid-cols-12 md:items-center gap-2 min-h-[46px] ${
                                                                isProcessing ? 'opacity-60 pointer-events-none bg-slate-50' : ''
                                                            }`}
                                                        >
                                                            {/* Coluna 1: Paciente */}
                                                            <div className="md:col-span-4 flex items-center gap-2 min-w-0">
                                                                <div className="w-6 h-6 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center shrink-0 border border-sky-200/60 font-black text-[10px]">
                                                                    <UserIcon className="w-3.5 h-3.5" />
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <div className="text-xs sm:text-[13px] font-black text-slate-900 truncate" title={booking.paciente?.name}>
                                                                        {booking.paciente?.name || 'Paciente Não Identificado'}
                                                                    </div>
                                                                    <div className="text-[10px] font-semibold text-slate-400 truncate">
                                                                        CPF: {booking.paciente?.cpf || 'Não informado'}
                                                                        {booking.paciente?.sus_number && ` • SUS: ${booking.paciente.sus_number}`}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Coluna 2: Procedimento / Especialidade */}
                                                            <div className="md:col-span-4 min-w-0">
                                                                <div className="text-xs font-bold text-slate-800 truncate" title={procLabel}>
                                                                    {procLabel}
                                                                </div>
                                                                <div className="text-[10px] font-medium text-slate-500 truncate">
                                                                    <span className="font-semibold text-sky-700">{especialidade}</span>
                                                                    {especialistaNome && ` • Dr(a). ${especialistaNome}`}
                                                                    {prestadorInfo && ` • ${prestadorInfo}`}
                                                                </div>
                                                            </div>

                                                            {/* Coluna 3: Data e Horário */}
                                                            <div className="md:col-span-2 flex items-center justify-between md:justify-center gap-2 text-xs font-bold text-slate-700">
                                                                <span className="md:hidden text-[10px] font-black uppercase text-slate-400">Agendado:</span>
                                                                <div className="flex items-center gap-1.5">
                                                                    <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                                                                    <span className="text-slate-800">
                                                                        {booking.appointment_time || '08:00'}
                                                                    </span>
                                                                </div>
                                                            </div>

                                                            {/* Coluna 4: Botões de Ação Operacional (Realizado / Faltou) */}
                                                            <div className="md:col-span-2 flex items-center justify-end gap-1.5 shrink-0 pt-1 md:pt-0">
                                                                {/* Botão Realizado */}
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleAction(booking.id, 'Realizado')}
                                                                    disabled={isProcessing}
                                                                    className="flex-1 md:flex-initial px-2.5 py-1.5 sm:px-3 sm:py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-extrabold text-[11px] sm:text-xs rounded-xl shadow-xs shadow-emerald-600/20 transition-all flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                                                                    title="Confirmar comparecimento do paciente (Realizado)"
                                                                >
                                                                    {isProcessing && currentAction === 'Realizado' ? (
                                                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                                    ) : (
                                                                        <Check className="w-3.5 h-3.5" />
                                                                    )}
                                                                    <span>REALIZADO</span>
                                                                </button>

                                                                {/* Botão Faltou */}
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleAction(booking.id, 'Não Realizado')}
                                                                    disabled={isProcessing}
                                                                    className="flex-1 md:flex-initial px-2.5 py-1.5 sm:px-3 sm:py-1.5 bg-rose-50 hover:bg-rose-100 hover:border-rose-300 active:scale-95 text-rose-700 font-extrabold text-[11px] sm:text-xs rounded-xl border border-rose-200 transition-all flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                                                                    title="Registrar ausência do paciente (Faltou)"
                                                                >
                                                                    {isProcessing && currentAction === 'Não Realizado' ? (
                                                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                                    ) : (
                                                                        <X className="w-3.5 h-3.5" />
                                                                    )}
                                                                    <span>FALTOU</span>
                                                                </button>
                                                            </div>

                                                            {/* Mensagem discreta de erro, se houver falha na linha */}
                                                            {errorMsg && (
                                                                <div className="col-span-12 text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-200 rounded-lg p-1.5 mt-1 flex items-center gap-1.5">
                                                                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                                                    <span>{errorMsg}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* 4. RODAPÉ FIXO */}
                <footer className="bg-white border-t border-slate-200/90 px-3.5 py-2.5 sm:px-5 sm:py-3 shrink-0 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                        <span>Total pendente: <strong className="text-slate-900 font-black">{pendencias.length}</strong></span>
                        <span className="text-slate-300">•</span>
                        <span>Exibidos: <strong className="text-sky-700 font-black">{filteredList.length}</strong></span>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-1.5 sm:px-5 sm:py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl transition-all active:scale-95 cursor-pointer shadow-2xs uppercase tracking-wider"
                    >
                        Resolver Depois
                    </button>
                </footer>
            </div>
        </div>
    );
};
