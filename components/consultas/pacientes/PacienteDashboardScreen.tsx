import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ConsultaPaciente, ConsultaAgendamento, FarmaciaMovimentacao, User } from '../../../types';
import {
    getSolicitacoesDoPaciente,
    getDispensacoesDoPaciente,
    calcularIndicadoresConsolidados,
    construirLinhaDoTempo,
    gerarAlertasGestor,
    IndicadoresPaciente,
    ItemLinhaDoTempo,
    AlertaGestor,
    normalizarNumeros,
    calcularDiasEntre
} from '../../../services/pacienteHistoricoService';
import * as db from '../../../services/consultasService';
import { PacienteSolicitacoesTab } from './PacienteSolicitacoesTab';
import { PacienteMedicamentosTab } from './PacienteMedicamentosTab';
import { PacienteLinhaDoTempoTab } from './PacienteLinhaDoTempoTab';
import { PacienteAnaliseTab } from './PacienteAnaliseTab';
import { PacienteRelatorioModal } from './PacienteRelatorioModal';
import { PacienteFormModal } from './PacienteFormModal';
import {
    ArrowLeft,
    FileText,
    Edit3,
    AlertTriangle,
    Clock,
    Calendar,
    Pill,
    Activity,
    CheckCircle2,
    PauseCircle,
    XCircle,
    User as UserIcon,
    Phone,
    MapPin,
    Hash,
    Sparkles,
    ShieldAlert,
    ExternalLink,
    TrendingUp,
    BarChart2,
    CalendarCheck,
    Layers,
    Stethoscope,
    Loader2,
    ChevronDown,
    ChevronUp
} from 'lucide-react';

export type AbaPaciente = 'visao-geral' | 'solicitacoes' | 'medicamentos' | 'linha-do-tempo' | 'analise';

interface PacienteDashboardScreenProps {
    pacienteId: string;
    onBack: () => void;
    currentUser?: User | null;
    initialAba?: AbaPaciente;
    baseRoute?: string;
}

export const PacienteDashboardScreen: React.FC<PacienteDashboardScreenProps> = ({
    pacienteId,
    onBack,
    currentUser,
    initialAba = 'visao-geral',
    baseRoute
}) => {
    // Rota base canônica ativa (/FarmaciaPopular/Pacientes ou /Regulacao/Pacientes)
    const resolvedBaseRoute = useMemo(() => {
        if (baseRoute) return baseRoute;
        if (typeof window !== 'undefined') {
            const raw = window.location.pathname.toLowerCase();
            if (raw.startsWith('/farmaciapopular')) {
                return '/FarmaciaPopular/Pacientes';
            }
        }
        return '/Regulacao/Pacientes';
    }, [baseRoute]);

    const [paciente, setPaciente] = useState<ConsultaPaciente | null>(null);
    const [solicitacoes, setSolicitacoes] = useState<ConsultaAgendamento[]>([]);
    const [medicamentos, setMedicamentos] = useState<FarmaciaMovimentacao[]>([]);
    const [loading, setLoading] = useState(true);

    // Estado da Aba Ativa sincronizada com a URL
    const [abaAtiva, setAbaAtiva] = useState<AbaPaciente>(initialAba);

    // Filtro de Período Global
    const [periodoFiltro, setPeriodoFiltro] = useState<'hoje' | '7dias' | '30dias' | '90dias' | '1ano' | 'tudo'>('tudo');

    // Modais
    const [isRelatorioOpen, setIsRelatorioOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [alertasOpen, setAlertasOpen] = useState(false);

    // Carrega dados completos do paciente
    const carregarDados = useCallback(async () => {
        setLoading(true);
        try {
            const p = await db.getPacienteById(pacienteId);
            setPaciente(p);

            if (p) {
                const [sols, meds] = await Promise.all([
                    getSolicitacoesDoPaciente(p.id),
                    getDispensacoesDoPaciente(p.cpf, p.name)
                ]);
                setSolicitacoes(sols);
                setMedicamentos(meds);
            }
        } catch (err) {
            console.error('[PacienteDashboard] Erro ao carregar dados do paciente:', err);
        } finally {
            setLoading(false);
        }
    }, [pacienteId]);

    useEffect(() => {
        carregarDados();
    }, [carregarDados]);

    // Sincronização imediata em tempo real: qualquer alteração de cadastro,
    // solicitação na regulação ou dispensação de medicamento na farmácia atualiza o dashboard
    useEffect(() => {
        const handleSync = () => carregarDados();
        window.addEventListener('consultas-pacientes-changed', handleSync);
        window.addEventListener('paciente-alterado', handleSync);
        window.addEventListener('consultas-agendamentos-changed', handleSync);
        window.addEventListener('farmacia-movimentacoes-changed', handleSync);

        return () => {
            window.removeEventListener('consultas-pacientes-changed', handleSync);
            window.removeEventListener('paciente-alterado', handleSync);
            window.removeEventListener('consultas-agendamentos-changed', handleSync);
            window.removeEventListener('farmacia-movimentacoes-changed', handleSync);
        };
    }, [carregarDados]);

    // Sincronização da Rota URL ao mudar de aba preservando a rota de origem
    const handleMudarAba = (novaAba: AbaPaciente) => {
        setAbaAtiva(novaAba);
        if (typeof window !== 'undefined') {
            const subPath = novaAba === 'visao-geral' ? '' : `/${novaAba}`;
            const targetUrl = `${resolvedBaseRoute}/${pacienteId}${subPath}`;
            if (window.location.pathname !== targetUrl) {
                window.history.pushState({}, '', targetUrl);
                window.dispatchEvent(new Event('popstate'));
            }
        }
    };

    // Escuta popstate para suportar botões de Voltar / Avançar
    useEffect(() => {
        const handlePopState = () => {
            const path = window.location.pathname.toLowerCase();
            if (path.includes('/solicitacoes')) setAbaAtiva('solicitacoes');
            else if (path.includes('/medicamentos')) setAbaAtiva('medicamentos');
            else if (path.includes('/linha-do-tempo')) setAbaAtiva('linha-do-tempo');
            else if (path.includes('/analise')) setAbaAtiva('analise');
            else setAbaAtiva('visao-geral');
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    // Aplica o filtro de período nas coleções para alimentar indicadores e abas
    const solicitacoesFiltradasPorPeriodo = useMemo(() => {
        if (periodoFiltro === 'tudo') return solicitacoes;
        const agora = Date.now();
        let limiteMs = 30 * 24 * 60 * 60 * 1000;
        if (periodoFiltro === 'hoje') limiteMs = 1 * 24 * 60 * 60 * 1000;
        if (periodoFiltro === '7dias') limiteMs = 7 * 24 * 60 * 60 * 1000;
        if (periodoFiltro === '90dias') limiteMs = 90 * 24 * 60 * 60 * 1000;
        if (periodoFiltro === '1ano') limiteMs = 365 * 24 * 60 * 60 * 1000;

        return solicitacoes.filter(s => {
            const dt = s.solicitation_date || s.created_at;
            if (!dt) return false;
            const t = new Date(dt).getTime();
            return !isNaN(t) && (agora - t) <= limiteMs;
        });
    }, [solicitacoes, periodoFiltro]);

    const medicamentosFiltradosPorPeriodo = useMemo(() => {
        if (periodoFiltro === 'tudo') return medicamentos;
        const agora = Date.now();
        let limiteMs = 30 * 24 * 60 * 60 * 1000;
        if (periodoFiltro === 'hoje') limiteMs = 1 * 24 * 60 * 60 * 1000;
        if (periodoFiltro === '7dias') limiteMs = 7 * 24 * 60 * 60 * 1000;
        if (periodoFiltro === '90dias') limiteMs = 90 * 24 * 60 * 60 * 1000;
        if (periodoFiltro === '1ano') limiteMs = 365 * 24 * 60 * 60 * 1000;

        return medicamentos.filter(m => {
            const dt = m.data || m.criado_em;
            if (!dt) return false;
            const t = new Date(dt).getTime();
            return !isNaN(t) && (agora - t) <= limiteMs;
        });
    }, [medicamentos, periodoFiltro]);

    // Indicadores consolidados
    const indicadores: IndicadoresPaciente = useMemo(() => {
        return calcularIndicadoresConsolidados(solicitacoesFiltradasPorPeriodo, medicamentosFiltradosPorPeriodo);
    }, [solicitacoesFiltradasPorPeriodo, medicamentosFiltradosPorPeriodo]);

    // Linha do Tempo
    const linhaDoTempo: ItemLinhaDoTempo[] = useMemo(() => {
        return construirLinhaDoTempo(solicitacoesFiltradasPorPeriodo, medicamentosFiltradosPorPeriodo);
    }, [solicitacoesFiltradasPorPeriodo, medicamentosFiltradosPorPeriodo]);

    // Alertas do Gestor
    const alertas: AlertaGestor[] = useMemo(() => {
        if (!paciente) return [];
        return gerarAlertasGestor(paciente, solicitacoes);
    }, [paciente, solicitacoes]);

    // Idade calculada
    const idade = useMemo(() => {
        if (!paciente?.birth_date) return null;
        try {
            const nascimento = new Date(paciente.birth_date);
            if (isNaN(nascimento.getTime())) return null;
            const hoje = new Date();
            let anos = hoje.getFullYear() - nascimento.getFullYear();
            const m = hoje.getMonth() - nascimento.getMonth();
            if (m < 0 || (m === 0 && hoje.getDate() < nascimento.getDate())) {
                anos--;
            }
            return Math.max(0, anos);
        } catch {
            return null;
        }
    }, [paciente?.birth_date]);

    // CPF formatado
    const cpfFormatado = useMemo(() => {
        if (!paciente?.cpf) return 'Não informado';
        const c = normalizarNumeros(paciente.cpf);
        if (c.length === 11) return c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
        return paciente.cpf;
    }, [paciente?.cpf]);

    const isCadastroCompleto = paciente?.cpf && paciente?.sus_number && paciente?.phone && paciente?.birth_date;

    if (loading) {
        return (
            <div className="flex-1 w-full h-full flex flex-col items-center justify-center gap-3 text-slate-500">
                <Loader2 className="w-9 h-9 animate-spin text-sky-600" />
                <span className="text-sm font-bold">Carregando prontuário integrado do paciente...</span>
            </div>
        );
    }

    if (!paciente) {
        return (
            <div className="flex-1 w-full h-full flex flex-col items-center justify-center p-6 text-center space-y-3">
                <AlertTriangle className="w-12 h-12 text-rose-500" />
                <h3 className="text-base font-black text-slate-800 uppercase">Paciente Não Encontrado</h3>
                <p className="text-xs text-slate-500">O cadastro do paciente solicitado não existe ou foi removido.</p>
                <button
                    onClick={onBack}
                    className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-black uppercase cursor-pointer"
                >
                    Voltar para a Busca
                </button>
            </div>
        );
    }

    return (
        <div className="flex-1 w-full h-full flex flex-col p-2 sm:p-3 overflow-hidden gap-2 min-h-0 bg-[#f8fafc]">
            {/* 1. CABEÇALHO ULTRACOMPACTO DO PACIENTE */}
            <div className="bg-white rounded-xl py-1.5 px-2.5 sm:px-3 border border-slate-200/90 shadow-2xs shrink-0 flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                    {/* Botão Voltar + Avatar + Nome + Tag */}
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <button
                            type="button"
                            onClick={onBack}
                            className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all cursor-pointer shrink-0"
                            title="Voltar à lista de pacientes"
                        >
                            <ArrowLeft className="w-3.5 h-3.5" />
                        </button>

                        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-sky-500 to-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0 font-black text-[11px] uppercase">
                            {paciente.name.charAt(0)}
                        </div>

                        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                            <h1 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-tight truncate leading-none">
                                {paciente.name}
                            </h1>
                            {paciente.nickname && (
                                <span className="text-[10px] font-bold text-slate-400 truncate">
                                    ({paciente.nickname})
                                </span>
                            )}
                            {isCadastroCompleto ? (
                                <span className="px-1.5 py-0.2 rounded text-[8px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    Completo
                                </span>
                            ) : (
                                <span className="px-1.5 py-0.2 rounded text-[8px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
                                    Dados Pendentes
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Ações Rápidas no Cabeçalho */}
                    <div className="flex items-center gap-1 shrink-0">
                        <button
                            type="button"
                            onClick={() => setIsEditModalOpen(true)}
                            className="px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer"
                            title="Editar Dados Cadastrais"
                        >
                            <Edit3 className="w-2.5 h-2.5" /> <span>Editar</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setIsRelatorioOpen(true)}
                            className="px-2.5 py-0.5 rounded-lg bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white text-[10px] font-black uppercase tracking-wider shadow-xs active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
                        >
                            <FileText className="w-2.5 h-2.5" /> <span>Relatório</span>
                        </button>
                    </div>
                </div>

                {/* Linha única contínua de Metadados e Localização */}
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-slate-500 font-medium leading-none pt-0.5 border-t border-slate-100/90">
                    <span className="font-mono text-slate-700 font-bold">CPF: {cpfFormatado}</span>
                    <span className="text-slate-300">•</span>
                    <span className="font-mono text-slate-700 font-bold">SUS: {paciente.sus_number || 'Sem Cartão'}</span>
                    <span className="text-slate-300">•</span>
                    <span>
                        {paciente.birth_date ? new Date(paciente.birth_date).toLocaleDateString('pt-BR') : 'Sem data'}
                        {idade !== null ? ` (${idade}a)` : ''}
                    </span>
                    <span className="text-slate-300">•</span>
                    <span>Tel: {paciente.phone || 'Sem tel'}</span>
                    {paciente.agente_saude && (
                        <>
                            <span className="text-slate-300">•</span>
                            <span className="text-sky-700 font-bold">ACS: {paciente.agente_saude}</span>
                        </>
                    )}
                    <span className="text-slate-300">•</span>
                    <span className="flex items-center gap-0.5 truncate text-slate-400">
                        <MapPin className="w-2.5 h-2.5 text-slate-300 shrink-0" />
                        {paciente.street ? `${paciente.street}, ` : ''}{paciente.neighborhood || 'Bairro N/I'} • {paciente.city || 'SÃO JOSÉ DO GOIABAL - MG'}
                    </span>
                </div>
            </div>

            {/* 2. BARRA DE NAVEGAÇÃO POR ABAS COM ROTA URL E FILTRO DE PERÍODO */}
            <div className="bg-white rounded-lg py-1 px-1.5 sm:px-2 border border-slate-200/90 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-1 shrink-0">
                {/* Abas Principais */}
                <div className="flex items-center gap-0.5 overflow-x-auto no-scrollbar">
                    {[
                        { key: 'visao-geral', label: 'Visão Geral', icon: Layers },
                        { key: 'solicitacoes', label: `Solicitações (${indicadores.totalSolicitacoes})`, icon: Clock },
                        { key: 'medicamentos', label: `Medicamentos (${indicadores.totalRetiradasMedicamentos})`, icon: Pill },
                        { key: 'linha-do-tempo', label: 'Linha do Tempo', icon: Activity },
                        { key: 'analise', label: 'Análise', icon: BarChart2 }
                    ].map(tab => {
                        const Icon = tab.icon;
                        const isAtiva = abaAtiva === tab.key;
                        return (
                            <button
                                key={tab.key}
                                type="button"
                                onClick={() => handleMudarAba(tab.key as AbaPaciente)}
                                className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 whitespace-nowrap cursor-pointer ${
                                    isAtiva
                                        ? 'bg-slate-900 text-white shadow-2xs'
                                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                                }`}
                            >
                                <Icon className={`w-2.5 h-2.5 ${isAtiva ? 'text-sky-400' : 'text-slate-400'}`} />
                                <span>{tab.label}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Filtro de Períodos Rápidos */}
                <div className="flex items-center gap-0.5 self-start md:self-auto bg-slate-100 p-0.5 rounded-md overflow-x-auto no-scrollbar">
                    {[
                        { key: 'hoje', label: 'Hoje' },
                        { key: '7dias', label: '7d' },
                        { key: '30dias', label: '30d' },
                        { key: '90dias', label: '90d' },
                        { key: '1ano', label: '1a' },
                        { key: 'tudo', label: 'Tudo' }
                    ].map(p => (
                        <button
                            key={p.key}
                            type="button"
                            onClick={() => setPeriodoFiltro(p.key as any)}
                            className={`px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase transition-all cursor-pointer whitespace-nowrap ${
                                periodoFiltro === p.key
                                    ? 'bg-white text-sky-800 shadow-2xs'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* 3. CONTEÚDO PRINCIPAL DA ABA SELECIONADA */}
            <div className="flex-1 overflow-y-auto no-scrollbar min-h-0 space-y-2">
                {abaAtiva === 'visao-geral' && (
                    <div className="space-y-2 animate-in fade-in duration-150">
                        {/* Seção Alertas do Gestor Compacta / Retrátil */}
                        {alertas.length > 0 && (
                            <div className="bg-amber-50/90 rounded-lg p-1.5 sm:px-2.5 border border-amber-200/90 shadow-2xs transition-all">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                        <div className="w-4 h-4 rounded bg-amber-500 text-white flex items-center justify-center shrink-0">
                                            <ShieldAlert className="w-2.5 h-2.5" />
                                        </div>
                                        <span className="text-[10px] font-black uppercase text-amber-950 shrink-0">
                                            Atenção ({alertas.length}):
                                        </span>
                                        <div className="flex items-center gap-1 overflow-hidden text-[10px] text-amber-900 truncate">
                                            {alertas.slice(0, 3).map(al => (
                                                <span key={al.id} className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-white/80 border border-amber-200/70 text-[9px] font-bold text-amber-900 truncate">
                                                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${al.severidade === 'alta' ? 'bg-rose-500' : 'bg-amber-500'}`} />
                                                    <span className="truncate">{al.titulo}</span>
                                                </span>
                                            ))}
                                            {alertas.length > 3 && (
                                                <span className="text-[9px] font-bold text-amber-800 shrink-0">
                                                    +{alertas.length - 3} mais
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => setAlertasOpen(!alertasOpen)}
                                        className="px-1.5 py-0.5 rounded bg-amber-100 hover:bg-amber-200 text-amber-900 text-[9px] font-black uppercase tracking-wider flex items-center gap-1 transition-colors shrink-0 cursor-pointer"
                                    >
                                        <span>{alertasOpen ? 'Ocultar' : 'Detalhes'}</span>
                                        {alertasOpen ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
                                    </button>
                                </div>

                                {alertasOpen && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1.5 pt-1.5 mt-1.5 border-t border-amber-200/60 animate-in fade-in duration-150">
                                        {alertas.map(al => (
                                            <div
                                                key={al.id}
                                                className="bg-white rounded-lg p-1.5 border border-amber-200/80 flex items-start gap-1.5 text-xs text-slate-700 shadow-2xs"
                                            >
                                                <span className={`w-1.5 h-1.5 rounded-full mt-1 shrink-0 ${
                                                    al.severidade === 'alta' ? 'bg-rose-500' : al.severidade === 'media' ? 'bg-amber-500' : 'bg-blue-500'
                                                }`} />
                                                <div className="flex-1 min-w-0">
                                                    <strong className="block text-slate-900 text-[10px] leading-snug">{al.titulo}</strong>
                                                    <p className="text-[9px] text-slate-600 mt-0.5 leading-tight">{al.descricao}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Régua de Indicadores Consolidados (Ultra Compacta) */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5">
                            <div className="bg-white rounded-lg py-1.5 px-2 border border-slate-200/90 shadow-2xs flex flex-col justify-between">
                                <span className="text-[8px] font-black uppercase tracking-wider text-slate-400 block truncate">Total Solicitações</span>
                                <div className="flex items-baseline justify-between mt-0.5">
                                    <span className="text-base font-black text-slate-900">{indicadores.totalSolicitacoes}</span>
                                    <span className="text-[8px] text-sky-600 font-bold truncate">Exames e consult.</span>
                                </div>
                            </div>

                            <div className="bg-white rounded-lg py-1.5 px-2 border border-slate-200/90 shadow-2xs flex flex-col justify-between">
                                <span className="text-[8px] font-black uppercase tracking-wider text-slate-400 block truncate">Aguardando Vaga</span>
                                <div className="flex items-baseline justify-between mt-0.5">
                                    <span className="text-base font-black text-sky-700">{indicadores.aguardandoVaga}</span>
                                    <span className="text-[8px] text-slate-500 font-bold truncate">Fila de espera</span>
                                </div>
                            </div>

                            <div className="bg-white rounded-lg py-1.5 px-2 border border-slate-200/90 shadow-2xs flex flex-col justify-between">
                                <span className="text-[8px] font-black uppercase tracking-wider text-slate-400 block truncate">Agendadas</span>
                                <div className="flex items-baseline justify-between mt-0.5">
                                    <span className="text-base font-black text-indigo-700">{indicadores.agendadas}</span>
                                    <span className="text-[8px] text-slate-500 font-bold truncate">Com data</span>
                                </div>
                            </div>

                            <div className="bg-white rounded-lg py-1.5 px-2 border border-slate-200/90 shadow-2xs flex flex-col justify-between">
                                <span className="text-[8px] font-black uppercase tracking-wider text-slate-400 block truncate">Realizadas</span>
                                <div className="flex items-baseline justify-between mt-0.5">
                                    <span className="text-base font-black text-emerald-700">{indicadores.realizadas}</span>
                                    <span className="text-[8px] text-emerald-600 font-bold truncate">Atendimentos</span>
                                </div>
                            </div>

                            <div className="bg-white rounded-lg py-1.5 px-2 border border-slate-200/90 shadow-2xs flex flex-col justify-between">
                                <span className="text-[8px] font-black uppercase tracking-wider text-slate-400 block truncate">Pausadas / Cancel.</span>
                                <div className="flex items-baseline justify-between mt-0.5">
                                    <span className="text-base font-black text-amber-700">{indicadores.pausadas + indicadores.canceladas}</span>
                                    <span className="text-[8px] text-slate-500 font-bold truncate">{indicadores.pausadas} p. • {indicadores.canceladas} c.</span>
                                </div>
                            </div>

                            <div className="bg-white rounded-lg py-1.5 px-2 border border-slate-200/90 shadow-2xs flex flex-col justify-between">
                                <span className="text-[8px] font-black uppercase tracking-wider text-slate-400 block truncate">Média Espera</span>
                                <div className="flex items-baseline justify-between mt-0.5">
                                    <span className="text-base font-black text-slate-900">{indicadores.tempoMedioEsperaDias}d</span>
                                    <span className="text-[8px] text-slate-500 font-bold truncate">Dias corridos</span>
                                </div>
                            </div>
                        </div>

                        {/* Bloco de Atendimento Integrado e Prazos */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-2.5">
                            {/* Card Visão de Atendimento Integrado */}
                            <div className="bg-white rounded-2xl p-3 sm:p-3.5 border border-slate-200/90 shadow-2xs space-y-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-6 h-6 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
                                            <Activity className="w-3.5 h-3.5" />
                                        </div>
                                        <div>
                                            <h3 className="text-xs font-black uppercase text-slate-900 leading-tight">
                                                Visão de Atendimento Integrado
                                            </h3>
                                            <p className="text-[9px] font-bold text-slate-400 uppercase leading-none">
                                                Regulação + Consultas + Farmácia Popular
                                            </p>
                                        </div>
                                    </div>
                                    <span className="text-[9px] font-black uppercase text-sky-600 bg-sky-50 px-1.5 py-0.5 rounded">Tempo Real</span>
                                </div>

                                <div className="space-y-1.5 text-[11px]">
                                    <div className="p-2 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-between">
                                        <span className="text-slate-600 font-medium">Solicitação mais antiga em aberto:</span>
                                        <strong className="text-slate-900 font-black">
                                            {indicadores.solicitacaoMaisAntigaPendente
                                                ? `${indicadores.solicitacaoMaisAntigaPendente.procedimento} (${indicadores.solicitacaoMaisAntigaPendente.dias} dias)`
                                                : 'Nenhuma pendente'}
                                        </strong>
                                    </div>

                                    <div className="p-2 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-between">
                                        <span className="text-slate-600 font-medium">Data do último atendimento:</span>
                                        <strong className="text-slate-900 font-black">
                                            {indicadores.dataUltimoAtendimento
                                                ? new Date(indicadores.dataUltimoAtendimento).toLocaleDateString('pt-BR')
                                                : 'Sem registro prévio'}
                                        </strong>
                                    </div>

                                    <div className="p-2 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-between">
                                        <span className="text-slate-600 font-medium">Última movimentação no município:</span>
                                        <strong className="text-slate-900 font-black">
                                            {indicadores.dataUltimaMovimentacao
                                                ? new Date(indicadores.dataUltimaMovimentacao).toLocaleDateString('pt-BR')
                                                : 'Sem movimentação'}
                                        </strong>
                                    </div>

                                    <div className="p-2 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-between">
                                        <span className="text-slate-600 font-medium">Total de dispensações na Farmácia:</span>
                                        <strong className="text-purple-900 font-black">
                                            {indicadores.totalRetiradasMedicamentos} retiradas ({indicadores.totalQuantidadeFisicaEntregue} un entregues)
                                        </strong>
                                    </div>
                                </div>
                            </div>

                            {/* Card Resumo das Últimas Movimentações */}
                            <div className="bg-white rounded-2xl p-3 sm:p-3.5 border border-slate-200/90 shadow-2xs space-y-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-6 h-6 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                                            <Clock className="w-3.5 h-3.5" />
                                        </div>
                                        <div>
                                            <h3 className="text-xs font-black uppercase text-slate-900 leading-tight">
                                                Últimas Movimentações
                                            </h3>
                                            <p className="text-[9px] font-bold text-slate-400 uppercase leading-none">
                                                Linha do tempo recente
                                            </p>
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => handleMudarAba('linha-do-tempo')}
                                        className="text-[10px] font-black uppercase text-sky-600 hover:text-sky-800 cursor-pointer"
                                    >
                                        Ver Todas →
                                    </button>
                                </div>

                                <div className="space-y-1.5">
                                    {linhaDoTempo.slice(0, 4).map(it => (
                                        <div
                                            key={it.id}
                                            className="p-2 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-between gap-2 text-[11px]"
                                        >
                                            <div className="min-w-0 flex-1">
                                                <strong className="block text-slate-800 truncate">{it.titulo}</strong>
                                                <span className="text-[10px] text-slate-500 block truncate">{it.subtitulo}</span>
                                            </div>
                                            <span className="text-[10px] text-slate-400 shrink-0 font-extrabold">
                                                {it.dataHora ? new Date(it.dataHora).toLocaleDateString('pt-BR') : '-'}
                                            </span>
                                        </div>
                                    ))}

                                    {linhaDoTempo.length === 0 && (
                                        <div className="text-center py-6 text-xs text-slate-400 font-medium">
                                            Nenhuma movimentação registrada até o momento.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {abaAtiva === 'solicitacoes' && (
                    <div className="animate-in fade-in duration-150">
                        <PacienteSolicitacoesTab
                            solicitacoes={solicitacoesFiltradasPorPeriodo}
                            periodoFiltro={periodoFiltro}
                        />
                    </div>
                )}

                {abaAtiva === 'medicamentos' && (
                    <div className="animate-in fade-in duration-150">
                        <PacienteMedicamentosTab
                            medicamentos={medicamentosFiltradosPorPeriodo}
                            indicadores={indicadores}
                            periodoFiltro={periodoFiltro}
                        />
                    </div>
                )}

                {abaAtiva === 'linha-do-tempo' && (
                    <div className="animate-in fade-in duration-150">
                        <PacienteLinhaDoTempoTab
                            linhaDoTempo={linhaDoTempo}
                            periodoFiltro={periodoFiltro}
                        />
                    </div>
                )}

                {abaAtiva === 'analise' && (
                    <div className="animate-in fade-in duration-150">
                        <PacienteAnaliseTab
                            solicitacoes={solicitacoesFiltradasPorPeriodo}
                            medicamentos={medicamentosFiltradosPorPeriodo}
                            indicadores={indicadores}
                        />
                    </div>
                )}
            </div>

            {/* Modal de Relatório em PDF */}
            {isRelatorioOpen && (
                <PacienteRelatorioModal
                    isOpen={isRelatorioOpen}
                    onClose={() => setIsRelatorioOpen(false)}
                    paciente={paciente}
                    solicitacoes={solicitacoes}
                    medicamentos={medicamentos}
                    indicadores={indicadores}
                    linhaDoTempo={linhaDoTempo}
                    currentUser={currentUser}
                />
            )}

            {/* Modal de Edição Rápida de Cadastro */}
            {isEditModalOpen && (
                <PacienteFormModal
                    isOpen={isEditModalOpen}
                    onClose={() => setIsEditModalOpen(false)}
                    editingPatient={paciente}
                    onSuccess={(pAtualizado) => {
                        setPaciente(pAtualizado);
                        carregarDados();
                    }}
                />
            )}
        </div>
    );
};

// Exporta alias unificado conforme convenção de componente reutilizável
export const PacienteDashboard = PacienteDashboardScreen;

