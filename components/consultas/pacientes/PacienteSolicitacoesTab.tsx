import React, { useState, useMemo } from 'react';
import { ConsultaAgendamento } from '../../../types';
import { calcularIndicadorTempoEspera, IndicadorTempoEspera } from '../../../services/pacienteHistoricoService';
import { Clock, AlertCircle, CheckCircle2, PauseCircle, Calendar, Filter, Search, ArrowUpDown, ChevronDown, ChevronUp, History, ShieldAlert, Sparkles, Building2, MapPin } from 'lucide-react';

interface PacienteSolicitacoesTabProps {
    solicitacoes: ConsultaAgendamento[];
    periodoFiltro: string;
}

export const PacienteSolicitacoesTab: React.FC<PacienteSolicitacoesTabProps> = ({
    solicitacoes,
    periodoFiltro
}) => {
    const [filtroTexto, setFiltroTexto] = useState('');
    const [filtroStatus, setFiltroStatus] = useState<string>('todos');
    const [filtroPrioridade, setFiltroPrioridade] = useState<string>('todas');
    const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

    // Filtros
    const solicitacoesFiltradas = useMemo(() => {
        return solicitacoes.filter(s => {
            // Filtro por texto
            if (filtroTexto.trim()) {
                const search = filtroTexto.toLowerCase().trim();
                const nomeProc = (s.procedimento?.name || '').toLowerCase();
                const tipoProc = (s.procedimento?.type || '').toLowerCase();
                const prestador = (s.prestador || '').toLowerCase();
                if (!nomeProc.includes(search) && !tipoProc.includes(search) && !prestador.includes(search)) {
                    return false;
                }
            }

            // Filtro por status
            if (filtroStatus !== 'todos') {
                const st = (s.status || '').toLowerCase();
                if (filtroStatus === 'fila' && !st.includes('fila') && !st.includes('aguardando')) return false;
                if (filtroStatus === 'agendado' && !st.includes('agendad')) return false;
                if (filtroStatus === 'realizado' && !st.includes('realizad')) return false;
                if (filtroStatus === 'pausada' && !s.is_paused && !st.includes('pausad')) return false;
                if (filtroStatus === 'cancelado' && !st.includes('cancel') && !st.includes('não')) return false;
            }

            // Filtro por prioridade
            if (filtroPrioridade !== 'todas') {
                if (s.priority !== filtroPrioridade) return false;
            }

            return true;
        });
    }, [solicitacoes, filtroTexto, filtroStatus, filtroPrioridade]);

    const getStatusBadge = (status?: string, isPaused?: boolean) => {
        if (isPaused || (status || '').toLowerCase() === 'pausada') {
            return (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
                    <PauseCircle className="w-3 h-3 text-amber-600" /> Pausada
                </span>
            );
        }
        const st = (status || '').toLowerCase();
        if (st.includes('realizad')) {
            return (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Realizado
                </span>
            );
        }
        if (st.includes('agendad')) {
            return (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
                    <Calendar className="w-3 h-3 text-indigo-600" /> Agendado
                </span>
            );
        }
        if (st.includes('cancel') || st.includes('não')) {
            return (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200">
                    <AlertCircle className="w-3 h-3 text-rose-600" /> Cancelado
                </span>
            );
        }
        return (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-sky-50 text-sky-700 border border-sky-200">
                <Clock className="w-3 h-3 text-sky-600" /> Fila de Espera
            </span>
        );
    };

    const getIndicadorVisualBadge = (indicador: IndicadorTempoEspera) => {
        if (indicador.classificacao === 'Dentro do prazo') {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Dentro do Prazo
                </span>
            );
        }
        if (indicador.classificacao === 'Atenção') {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Atenção
                </span>
            );
        }
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-extrabold bg-rose-100 text-rose-800 border border-rose-300">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span> Espera Prolongada
            </span>
        );
    };

    return (
        <div className="space-y-2">
            {/* Barra de Filtros e Busca Rápida */}
            <div className="bg-white rounded-xl p-2 sm:px-3 border border-slate-200/90 shadow-2xs space-y-1.5">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-1.5">
                    {/* Campo de Busca */}
                    <div className="relative flex-1">
                        <input
                            type="text"
                            placeholder="Filtrar por procedimento, especialidade ou prestador..."
                            value={filtroTexto}
                            onChange={(e) => setFiltroTexto(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-sky-500 focus:ring-1 focus:ring-sky-500/20 transition-all"
                        />
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    </div>

                    {/* Filtros em Pílulas */}
                    <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-0.5 sm:pb-0">
                        <select
                            value={filtroStatus}
                            onChange={(e) => setFiltroStatus(e.target.value)}
                            aria-label="Filtrar por situação do atendimento"
                            className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-[11px] font-bold text-slate-700 focus:bg-white focus:border-sky-500 transition-all cursor-pointer"
                        >
                            <option value="todos">Todas as Situações</option>
                            <option value="fila">Aguardando Vaga / Fila</option>
                            <option value="agendado">Agendados</option>
                            <option value="realizado">Realizados</option>
                            <option value="pausada">Pausadas</option>
                            <option value="cancelado">Cancelados</option>
                        </select>

                        <select
                            value={filtroPrioridade}
                            onChange={(e) => setFiltroPrioridade(e.target.value)}
                            aria-label="Filtrar por prioridade"
                            className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-[11px] font-bold text-slate-700 focus:bg-white focus:border-sky-500 transition-all cursor-pointer"
                        >
                            <option value="todas">Todas as Prioridades</option>
                            <option value="Normal">Normal</option>
                            <option value="Urgência">Urgência</option>
                            <option value="Especial">Especial</option>
                        </select>
                    </div>
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-500 font-bold px-0.5">
                    <span>{solicitacoesFiltradas.length} solicitação(ões) encontrada(s)</span>
                    <span className="text-sky-700 font-extrabold flex items-center gap-1">
                        <Sparkles className="w-2.5 h-2.5 text-sky-500" /> Indicador Inteligente Ativo
                    </span>
                </div>
            </div>

            {/* Listagem de Solicitações (Cards Mobile First de Alta Densidade) */}
            {solicitacoesFiltradas.length === 0 ? (
                <div className="bg-white rounded-2xl p-6 border border-slate-200/90 text-center space-y-1.5">
                    <Clock className="w-8 h-8 text-slate-300 mx-auto" />
                    <h4 className="text-xs font-black uppercase text-slate-700">Nenhuma solicitação encontrada</h4>
                    <p className="text-[11px] text-slate-400">Tente ajustar os filtros ou o período selecionado.</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {solicitacoesFiltradas.map((sol) => {
                        const indicador = calcularIndicadorTempoEspera(sol);
                        const isExpanded = expandedItemId === sol.id;
                        const dtSolicitacao = sol.solicitation_date || sol.created_at;

                        return (
                            <div
                                key={sol.id}
                                className="bg-white rounded-xl border border-slate-200/90 hover:border-sky-200 shadow-2xs hover:shadow-xs transition-all overflow-hidden"
                            >
                                {/* Topo do Card */}
                                <div className="p-2.5 sm:p-3">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-1 mb-0.5">
                                                {getStatusBadge(sol.status, sol.is_paused)}
                                                {getIndicadorVisualBadge(indicador)}
                                                <span className={`px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase ${
                                                    sol.priority === 'Urgência'
                                                        ? 'bg-rose-100 text-rose-800'
                                                        : sol.priority === 'Especial'
                                                        ? 'bg-amber-100 text-amber-800'
                                                        : 'bg-slate-100 text-slate-700'
                                                }`}>
                                                    {sol.priority || 'Normal'}
                                                </span>
                                                {sol.tipo_atendimento && (
                                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600 uppercase">
                                                        {sol.tipo_atendimento}
                                                    </span>
                                                )}
                                                {sol.queue_position ? (
                                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-blue-50 text-blue-700 border border-blue-200">
                                                        #{sol.queue_position}º na Fila
                                                    </span>
                                                ) : null}
                                            </div>

                                            <h3 className="text-sm sm:text-base font-black text-slate-900 tracking-tight leading-snug">
                                                {sol.procedimento?.name || 'Procedimento não identificado'}
                                            </h3>

                                            <p className="text-xs text-slate-500 font-medium mt-0.5">
                                                {sol.procedimento?.type || 'Consulta / Exame'}
                                                {sol.prestador ? ` • ${sol.prestador}` : ''}
                                                {sol.municipio ? ` (${sol.municipio})` : ''}
                                            </p>
                                        </div>

                                        {/* Bloco de Métricas de Espera (Mobile First) */}
                                        <div className="flex items-center gap-2 sm:gap-3 bg-slate-50/80 rounded-xl p-2 sm:p-2.5 border border-slate-200/60 shrink-0">
                                            <div className="text-center px-2">
                                                <span className="text-[10px] uppercase font-bold text-slate-400 block leading-none">
                                                    {indicador.concluido ? 'Tempo Total' : 'Dias Corridos'}
                                                </span>
                                                <span className="text-sm font-black text-slate-800 mt-0.5 block leading-none">
                                                    {indicador.diasCorridos} dias
                                                </span>
                                            </div>

                                            <div className="w-px h-6 bg-slate-200"></div>

                                            <div className="text-center px-2">
                                                <span className="text-[10px] uppercase font-bold text-slate-400 block leading-none">
                                                    Tempo Efetivo
                                                </span>
                                                <span className="text-sm font-black text-sky-700 mt-0.5 block leading-none">
                                                    {indicador.tempoEfetivoFila} dias
                                                </span>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => setExpandedItemId(isExpanded ? null : sol.id)}
                                                className="p-1.5 rounded-lg text-slate-400 hover:text-sky-600 hover:bg-slate-200/50 transition-colors cursor-pointer ml-1"
                                                title={isExpanded ? 'Recolher detalhes' : 'Ver mais detalhes'}
                                            >
                                                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Linha Resumo Rápido */}
                                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                                        <span className="flex items-center gap-1 font-medium">
                                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                            Solicitado em: <strong className="text-slate-700">{dtSolicitacao ? new Date(dtSolicitacao).toLocaleDateString('pt-BR') : '-'}</strong>
                                        </span>

                                        {sol.appointment_date && (
                                            <span className="flex items-center gap-1 font-medium">
                                                <Clock className="w-3.5 h-3.5 text-indigo-500" />
                                                {indicador.concluido ? 'Realizado em:' : 'Agendado para:'}{' '}
                                                <strong className="text-indigo-800">
                                                    {new Date(sol.appointment_date).toLocaleDateString('pt-BR')} {sol.appointment_time || ''}
                                                </strong>
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Seção Expansível com Histórico de Movimentações e Detalhes da Solicitação */}
                                {isExpanded && (
                                    <div className="bg-slate-50/70 border-t border-slate-200/70 p-3.5 sm:p-4 space-y-3 animate-in fade-in duration-150">
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                                            <div className="bg-white p-2.5 rounded-xl border border-slate-200/70">
                                                <span className="text-[10px] uppercase font-bold text-slate-400 block">Tempo Pausado</span>
                                                <span className="font-extrabold text-slate-800">{indicador.diasPausados} dias descontados</span>
                                            </div>

                                            <div className="bg-white p-2.5 rounded-xl border border-slate-200/70">
                                                <span className="text-[10px] uppercase font-bold text-slate-400 block">Média da Especialidade</span>
                                                <span className="font-extrabold text-slate-800">~{indicador.tempoMedioEspecialidade} dias de referência</span>
                                            </div>

                                            <div className="bg-white p-2.5 rounded-xl border border-slate-200/70">
                                                <span className="text-[10px] uppercase font-bold text-slate-400 block">Identificador Oficial</span>
                                                <span className="font-mono text-[10px] text-slate-600 truncate block">{sol.id}</span>
                                            </div>
                                        </div>

                                        {/* Histórico de Pausas / Motivos */}
                                        {sol.pause_reason && (
                                            <div className="bg-amber-50/80 rounded-xl p-3 border border-amber-200 text-xs text-amber-900">
                                                <strong className="block font-black uppercase text-[10px] text-amber-800 mb-0.5">Motivo da Pausa Atual:</strong>
                                                <span>{sol.pause_reason}</span>
                                                {sol.paused_by_name && (
                                                    <span className="block text-[10px] text-amber-700 mt-1">Registrado por: {sol.paused_by_name}</span>
                                                )}
                                            </div>
                                        )}

                                        {sol.cancellation_reason && (
                                            <div className="bg-rose-50/80 rounded-xl p-3 border border-rose-200 text-xs text-rose-900">
                                                <strong className="block font-black uppercase text-[10px] text-rose-800 mb-0.5">Motivo do Cancelamento:</strong>
                                                <span>{sol.cancellation_reason}</span>
                                                {sol.canceled_by_name && (
                                                    <span className="block text-[10px] text-rose-700 mt-1">Cancelado por: {sol.canceled_by_name}</span>
                                                )}
                                            </div>
                                        )}

                                        {/* Histórico Cronológico de Alterações da Solicitação */}
                                        {sol.pause_history && sol.pause_history.length > 0 && (
                                            <div className="space-y-1.5 pt-1">
                                                <span className="text-[10px] uppercase font-black text-slate-500 tracking-wider flex items-center gap-1">
                                                    <History className="w-3 h-3 text-slate-400" /> Registro de Pausas e Retomadas
                                                </span>
                                                <div className="space-y-1">
                                                    {sol.pause_history.map((ph, idx) => (
                                                        <div key={idx} className="bg-white p-2 rounded-lg border border-slate-200/60 text-[11px] flex items-center justify-between gap-2">
                                                            <div>
                                                                <strong className={ph.action === 'pause' ? 'text-amber-700' : 'text-teal-700'}>
                                                                    {ph.action === 'pause' ? 'Pausa registrada' : 'Retomada para a fila'}
                                                                </strong>
                                                                {ph.reason && <span className="text-slate-600 block text-[10px]">"{ph.reason}"</span>}
                                                            </div>
                                                            <span className="text-[10px] text-slate-400 shrink-0">
                                                                {new Date(ph.timestamp).toLocaleString('pt-BR')}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
