import React, { useMemo } from 'react';
import { ConsultaAgendamento, FarmaciaMovimentacao } from '../../../types';
import { IndicadoresPaciente, IndicadorTempoEspera, calcularIndicadorTempoEspera } from '../../../services/pacienteHistoricoService';
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { TrendingUp, BarChart3, PieChart as PieChartIcon, Activity, Clock, Pill, Calendar } from 'lucide-react';

interface PacienteAnaliseTabProps {
    solicitacoes: ConsultaAgendamento[];
    medicamentos: FarmaciaMovimentacao[];
    indicadores: IndicadoresPaciente;
}

const COLORS = ['#0284c7', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];

export const PacienteAnaliseTab: React.FC<PacienteAnaliseTabProps> = ({
    solicitacoes,
    medicamentos,
    indicadores
}) => {
    // 1. Solicitações por Especialidade / Tipo de Procedimento
    const dadosPorEspecialidade = useMemo(() => {
        const counts: Record<string, number> = {};
        solicitacoes.forEach(s => {
            const esp = s.procedimento?.type || 'Consulta / Exame';
            counts[esp] = (counts[esp] || 0) + 1;
        });
        return Object.entries(counts).map(([name, value]) => ({ name, value }));
    }, [solicitacoes]);

    // 2. Situação de Procedimentos (Concluídos x Pendentes x Cancelados x Pausados)
    const dadosStatus = useMemo(() => {
        return [
            { name: 'Concluídos', value: indicadores.realizadas, color: '#10b981' },
            { name: 'Agendados', value: indicadores.agendadas, color: '#6366f1' },
            { name: 'Aguardando Fila', value: indicadores.aguardandoVaga, color: '#0284c7' },
            { name: 'Pausados', value: indicadores.pausadas, color: '#f59e0b' },
            { name: 'Cancelados', value: indicadores.canceladas, color: '#ef4444' }
        ].filter(item => item.value > 0);
    }, [indicadores]);

    // 3. Frequência de Medicamentos Mais Dispensados
    const dadosTopMedicamentos = useMemo(() => {
        return indicadores.medicamentosMaisRetirados.slice(0, 5).map(m => ({
            name: m.nome.length > 18 ? `${m.nome.substring(0, 18)}...` : m.nome,
            retiradas: m.retiradas,
            quantidade: m.quantidadeFisica
        }));
    }, [indicadores.medicamentosMaisRetirados]);

    // 4. Evolução Temporal (Agrupado por Mês/Ano)
    const dadosEvolucaoMensal = useMemo(() => {
        const meses: Record<string, { mes: string; solicitacoes: number; medicamentos: number }> = {};

        solicitacoes.forEach(s => {
            const dt = s.solicitation_date || s.created_at;
            if (dt) {
                const d = new Date(dt);
                const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                const label = `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(-2)}`;
                if (!meses[chave]) meses[chave] = { mes: label, solicitacoes: 0, medicamentos: 0 };
                meses[chave].solicitacoes += 1;
            }
        });

        medicamentos.forEach(m => {
            const dt = m.data || m.criado_em;
            if (dt) {
                const d = new Date(dt);
                const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                const label = `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(-2)}`;
                if (!meses[chave]) meses[chave] = { mes: label, solicitacoes: 0, medicamentos: 0 };
                meses[chave].medicamentos += 1;
            }
        });

        return Object.keys(meses)
            .sort()
            .slice(-6)
            .map(k => meses[k]);
    }, [solicitacoes, medicamentos]);

    return (
        <div className="space-y-4">
            {/* Grid Superior de Análise Gerencial */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Gráfico 1: Evolução Temporal por Mês */}
                <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/90 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="p-2 rounded-xl bg-sky-50 text-sky-600">
                                <TrendingUp className="w-4 h-4" />
                            </div>
                            <h3 className="text-xs sm:text-sm font-black uppercase text-slate-800 tracking-tight">
                                Evolução Mensal de Movimentações
                            </h3>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Últimos meses</span>
                    </div>

                    <div className="h-56 sm:h-64 w-full">
                        {dadosEvolucaoMensal.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-xs text-slate-400">
                                Sem dados suficientes para gráfico temporal
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={dadosEvolucaoMensal} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <XAxis dataKey="mes" tick={{ fontSize: 10, fill: '#64748b' }} />
                                    <YAxis tick={{ fontSize: 10, fill: '#64748b' }} allowDecimals={false} />
                                    <Tooltip contentStyle={{ borderRadius: '1rem', border: '1px solid #e2e8f0', fontSize: '11px', fontWeight: 'bold' }} />
                                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                                    <Bar dataKey="solicitacoes" name="Solicitações" fill="#0284c7" radius={[6, 6, 0, 0]} />
                                    <Bar dataKey="medicamentos" name="Retiradas Farmácia" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>

                {/* Gráfico 2: Status das Solicitações */}
                <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/90 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                                <PieChartIcon className="w-4 h-4" />
                            </div>
                            <h3 className="text-xs sm:text-sm font-black uppercase text-slate-800 tracking-tight">
                                Distribuição por Situação
                            </h3>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Geral</span>
                    </div>

                    <div className="h-56 sm:h-64 w-full">
                        {dadosStatus.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-xs text-slate-400">
                                Nenhuma solicitação para distribuição
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={dadosStatus}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={45}
                                        outerRadius={75}
                                        paddingAngle={4}
                                        dataKey="value"
                                        label={({ name, percent }: any) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`}
                                    >
                                        {dadosStatus.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={{ borderRadius: '1rem', border: '1px solid #e2e8f0', fontSize: '11px', fontWeight: 'bold' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>
            </div>

            {/* Grid Inferior: Medicamentos Mais Retirados e Solicitações por Tipo */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Gráfico 3: Medicamentos Mais Frequentes */}
                <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/90 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
                                <Pill className="w-4 h-4" />
                            </div>
                            <h3 className="text-xs sm:text-sm font-black uppercase text-slate-800 tracking-tight">
                                Medicamentos Mais Retirados
                            </h3>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Top 5</span>
                    </div>

                    <div className="h-56 sm:h-64 w-full">
                        {dadosTopMedicamentos.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-xs text-slate-400">
                                Sem retiradas de medicamentos registradas
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={dadosTopMedicamentos} layout="vertical" margin={{ top: 10, right: 20, left: 20, bottom: 0 }}>
                                    <XAxis type="number" tick={{ fontSize: 10, fill: '#64748b' }} allowDecimals={false} />
                                    <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: '#334155' }} width={110} />
                                    <Tooltip contentStyle={{ borderRadius: '1rem', border: '1px solid #e2e8f0', fontSize: '11px', fontWeight: 'bold' }} />
                                    <Bar dataKey="retiradas" name="Nº Retiradas" fill="#8b5cf6" radius={[0, 6, 6, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>

                {/* Gráfico 4: Tipos de Procedimentos */}
                <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/90 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                                <BarChart3 className="w-4 h-4" />
                            </div>
                            <h3 className="text-xs sm:text-sm font-black uppercase text-slate-800 tracking-tight">
                                Procedimentos por Tipo
                            </h3>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Proporção</span>
                    </div>

                    <div className="h-56 sm:h-64 w-full">
                        {dadosPorEspecialidade.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-xs text-slate-400">
                                Sem procedimentos para análise
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={dadosPorEspecialidade} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} />
                                    <YAxis tick={{ fontSize: 10, fill: '#64748b' }} allowDecimals={false} />
                                    <Tooltip contentStyle={{ borderRadius: '1rem', border: '1px solid #e2e8f0', fontSize: '11px', fontWeight: 'bold' }} />
                                    <Bar dataKey="value" name="Solicitações" fill="#4f46e5" radius={[6, 6, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
