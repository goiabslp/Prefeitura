import React, { useState, useEffect, useMemo } from 'react';
import { User, FarmaciaMedicamento, FarmaciaMovimentacao } from '../../types';
import * as db from '../../services/farmaciaService';
import {
    ArrowLeft, TrendingUp, TrendingDown, Users, Package, AlertTriangle, Activity, 
    Calendar, CheckCircle2, AlertCircle, ShoppingCart, Info, PieChart
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    LineChart, Line
} from 'recharts';
import { startOfMonth, endOfMonth, subMonths, isWithinInterval, parseISO, format, formatDistanceToNow, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DashboardScreenProps {
    currentUser: User;
    onBack: () => void;
    onNavigate: (view: string) => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
    currentUser,
    onBack,
    onNavigate
}) => {
    const [medicamentos, setMedicamentos] = useState<FarmaciaMedicamento[]>([]);
    const [movimentacoes, setMovimentacoes] = useState<FarmaciaMovimentacao[]>([]);
    const [loading, setLoading] = useState(true);

    const loadData = async () => {
        try {
            setLoading(true);
            const [medData, movData] = await Promise.all([
                db.getMedicamentos(),
                db.getMovimentacoes()
            ]);
            setMedicamentos(medData);
            setMovimentacoes(movData);
        } catch (error) {
            console.error('Erro ao carregar dados do dashboard:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    // --- DATA PROCESSING ---

    const now = new Date();
    const currentMonthStart = startOfMonth(now);
    const currentMonthEnd = endOfMonth(now);
    const lastMonthStart = startOfMonth(subMonths(now, 1));
    const lastMonthEnd = endOfMonth(subMonths(now, 1));
    const daysPassedThisMonth = differenceInDays(now, currentMonthStart) || 1; // avoid divide by zero
    const daysInCurrentMonth = differenceInDays(currentMonthEnd, currentMonthStart) + 1;

    // Filters for current and last month (Saídas = Dispensações)
    const currentMonthDispenses = movimentacoes.filter(m => 
        m.tipo === 'Saída' && m.data && isWithinInterval(parseISO(m.data), { start: currentMonthStart, end: currentMonthEnd })
    );

    const lastMonthDispenses = movimentacoes.filter(m => 
        m.tipo === 'Saída' && m.data && isWithinInterval(parseISO(m.data), { start: lastMonthStart, end: lastMonthEnd })
    );

    // KPI 1: Total Medicamentos Entregues
    const totalMedsCurrentMonth = currentMonthDispenses.reduce((acc, curr) => acc + curr.quantidade, 0);
    const totalMedsLastMonth = lastMonthDispenses.reduce((acc, curr) => acc + curr.quantidade, 0);
    const varMeds = totalMedsLastMonth === 0 ? 100 : ((totalMedsCurrentMonth - totalMedsLastMonth) / totalMedsLastMonth) * 100;

    // KPI 2: Pacientes Atendidos (Unique CPFs or Names in 'Saída')
    const getUniquePatientsCount = (movs: FarmaciaMovimentacao[]) => {
        const unique = new Set(movs.filter(m => m.paciente_cpf || m.paciente_nome).map(m => m.paciente_cpf || m.paciente_nome));
        return unique.size;
    };
    const totalPatientsCurrentMonth = getUniquePatientsCount(currentMonthDispenses);
    const totalPatientsLastMonth = getUniquePatientsCount(lastMonthDispenses);
    const varPatients = totalPatientsLastMonth === 0 ? 100 : ((totalPatientsCurrentMonth - totalPatientsLastMonth) / totalPatientsLastMonth) * 100;

    // KPI 3: Estoque Crítico e Baixo
    const lowStockAlerts = useMemo(() => {
        // Simplified low stock calculation for dashboard (can be same logic as FarmaciaModule if needed)
        // Here we use a simpler threshold logic: if quantity < limit_minimo
        return medicamentos.filter(med => med.quantidade <= med.limite_minimo);
    }, [medicamentos]);

    const zeroStockAlerts = medicamentos.filter(med => med.quantidade === 0);

    // CHart 1: Fluxo de Dispensação por Categoria no mês atual
    const dispensesByCategory = useMemo(() => {
        const categories = { 'CBAF': 0, 'CESAF': 0, 'CEAF': 0 };
        currentMonthDispenses.forEach(m => {
            if (categories[m.medicamento_categoria as keyof typeof categories] !== undefined) {
                categories[m.medicamento_categoria as keyof typeof categories] += m.quantidade;
            }
        });
        return Object.keys(categories).map(key => ({
            name: key,
            quantidade: categories[key as keyof typeof categories]
        }));
    }, [currentMonthDispenses]);

    // Chart 2: Top 5 Medicamentos mais retirados
    const topMedicines = useMemo(() => {
        const medCounts: Record<string, number> = {};
        currentMonthDispenses.forEach(m => {
            medCounts[m.medicamento_nome] = (medCounts[m.medicamento_nome] || 0) + m.quantidade;
        });
        return Object.entries(medCounts)
            .map(([name, qtd]) => ({ name: name.substring(0, 15) + (name.length > 15 ? '...' : ''), quantidade: qtd }))
            .sort((a, b) => b.quantidade - a.quantidade)
            .slice(0, 5);
    }, [currentMonthDispenses]);

    // PREDITIVA: Previsão de Demanda e Necessidade de Compra
    const purchaseRecommendations = useMemo(() => {
        const recommendations = [];

        for (const med of medicamentos) {
            // Find all dispenses for this med in the last 30 days to get a daily average
            const thirtyDaysAgo = subMonths(now, 1);
            const recentDispenses = movimentacoes.filter(m => 
                m.medicamento_id === med.id && 
                m.tipo === 'Saída' && 
                m.data && 
                parseISO(m.data) >= thirtyDaysAgo
            );

            const totalDispensed30d = recentDispenses.reduce((acc, curr) => acc + curr.quantidade, 0);
            const dailyAverage = totalDispensed30d / 30;

            // How many days left in the current month?
            const daysLeft = daysInCurrentMonth - daysPassedThisMonth;

            // Estimated demand for the rest of the month
            const estimatedDemandRestOfMonth = dailyAverage * daysLeft;

            // Total estimated demand for a full 30 day cycle (safety stock)
            const safetyStock = dailyAverage * 15; // 15 days of safety

            const requiredStock = estimatedDemandRestOfMonth + safetyStock;

            if (med.quantidade < requiredStock && dailyAverage > 0) {
                const toBuy = Math.ceil(requiredStock - med.quantidade);
                recommendations.push({
                    ...med,
                    dailyAverage: dailyAverage.toFixed(1),
                    estimatedDemand: Math.ceil(estimatedDemandRestOfMonth),
                    toBuy
                });
            }
        }
        return recommendations.sort((a, b) => b.toBuy - a.toBuy);
    }, [medicamentos, movimentacoes, now, daysInCurrentMonth, daysPassedThisMonth]);


    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-full space-y-4">
                <div className="w-10 h-10 border-4 border-pink-200 border-t-pink-600 rounded-full animate-spin"></div>
                <p className="text-slate-500 font-medium animate-pulse">Analisando dados e gerando relatórios...</p>
            </div>
        );
    }

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto w-full pb-20">
            {/* Cabecalho */}
            <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                        <Activity className="w-6 h-6 text-pink-600" />
                        Dashboard Analítico
                    </h2>
                    <p className="text-slate-500 text-sm font-medium mt-1">
                        Visão gerencial e inteligência de dados da Farmácia Municipal.
                    </p>
                </div>
                <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-200/60">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                        {format(currentMonthStart, "MMMM 'de' yyyy", { locale: ptBR })}
                    </span>
                </div>
            </div>

            {/* KPIs Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {/* KPI 1 */}
                <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-6 opacity-20 group-hover:opacity-10 transition-opacity group-hover:scale-110 duration-500">
                        <Package className="w-16 h-16 text-pink-500" />
                    </div>
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Medicamentos Entregues</h3>
                    <div className="text-3xl font-black text-slate-800 mb-2">{totalMedsCurrentMonth} <span className="text-sm font-medium text-slate-400">unids</span></div>
                    <div className={`flex items-center gap-1 text-xs font-bold ${varMeds >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {varMeds >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                        {Math.abs(varMeds).toFixed(1)}% {varMeds >= 0 ? 'a mais' : 'a menos'} que o mês passado
                    </div>
                </div>

                {/* KPI 2 */}
                <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-6 opacity-20 group-hover:opacity-10 transition-opacity group-hover:scale-110 duration-500">
                        <Users className="w-16 h-16 text-blue-500" />
                    </div>
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Pacientes Atendidos</h3>
                    <div className="text-3xl font-black text-slate-800 mb-2">{totalPatientsCurrentMonth} <span className="text-sm font-medium text-slate-400">pessoas</span></div>
                    <div className={`flex items-center gap-1 text-xs font-bold ${varPatients >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {varPatients >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                        {Math.abs(varPatients).toFixed(1)}% {varPatients >= 0 ? 'a mais' : 'a menos'} que o mês passado
                    </div>
                </div>

                {/* KPI 3 */}
                <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-6 opacity-20 group-hover:opacity-10 transition-opacity group-hover:scale-110 duration-500">
                        <AlertTriangle className="w-16 h-16 text-rose-500" />
                    </div>
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Status do Estoque</h3>
                    <div className="flex gap-4 mb-2">
                        <div>
                            <div className="text-2xl font-black text-rose-600">{zeroStockAlerts.length}</div>
                            <div className="text-[9px] font-bold text-slate-400 uppercase">Zerados</div>
                        </div>
                        <div className="w-px bg-slate-100"></div>
                        <div>
                            <div className="text-2xl font-black text-amber-500">{lowStockAlerts.length - zeroStockAlerts.length}</div>
                            <div className="text-[9px] font-bold text-slate-400 uppercase">Baixo</div>
                        </div>
                    </div>
                    <div className="text-xs font-bold text-slate-500 mt-1">
                        Atenção aos itens com estoque crítico.
                    </div>
                </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* Top 5 */}
                <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight mb-6 flex items-center gap-2">
                        <PieChart className="w-4 h-4 text-pink-500" />
                        Top 5 Medicamentos (Demanda)
                    </h3>
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={topMedicines} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                                <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 10, fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                                <Tooltip 
                                    cursor={{fill: '#f8fafc'}}
                                    contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Bar dataKey="quantidade" fill="#ec4899" radius={[0, 4, 4, 0]} barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Categorias */}
                <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight mb-6 flex items-center gap-2">
                        <Activity className="w-4 h-4 text-blue-500" />
                        Dispensação por Categoria
                    </h3>
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={dispensesByCategory} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                                <Tooltip 
                                    cursor={{fill: '#f8fafc'}}
                                    contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Bar dataKey="quantidade" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Predictive Analysis Section */}
            <div className="bg-gradient-to-br from-indigo-50 to-white rounded-3xl p-6 border border-indigo-100 shadow-sm mb-8">
                <div className="flex items-start justify-between mb-6">
                    <div>
                        <h3 className="text-lg font-black text-indigo-900 uppercase tracking-tight flex items-center gap-2 mb-1">
                            <ShoppingCart className="w-5 h-5 text-indigo-600" />
                            Previsão de Demanda e Compras Sugeridas
                        </h3>
                        <p className="text-indigo-600/70 text-xs font-semibold">
                            Cálculo preditivo baseado na média de saídas diárias dos últimos 30 dias para garantir estoque de segurança.
                        </p>
                    </div>
                    <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl hidden md:block">
                        <Info className="w-5 h-5" />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[600px]">
                        <thead>
                            <tr className="border-b border-indigo-200/50 text-indigo-800/60 text-[10px] font-black uppercase tracking-wider">
                                <th className="p-3">Medicamento</th>
                                <th className="p-3 text-center">Média de Saída/Dia</th>
                                <th className="p-3 text-center">Estoque Atual</th>
                                <th className="p-3 text-center">Necessidade Sugerida</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-indigo-50/50">
                            {purchaseRecommendations.length > 0 ? (
                                purchaseRecommendations.slice(0, 10).map((med, idx) => (
                                    <tr key={idx} className="hover:bg-white/50 transition-colors">
                                        <td className="p-3">
                                            <div className="font-extrabold text-indigo-950 text-xs">{med.nome}</div>
                                            <div className="text-[10px] text-indigo-900/50 uppercase font-semibold">{med.categoria} {med.tipo ? `• ${med.tipo}` : ''}</div>
                                        </td>
                                        <td className="p-3 text-center font-bold text-indigo-700 text-xs">
                                            {med.dailyAverage} un/dia
                                        </td>
                                        <td className="p-3 text-center">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-black ${med.quantidade === 0 ? 'bg-rose-100 text-rose-700' : 'bg-indigo-100 text-indigo-700'}`}>
                                                {med.quantidade}
                                            </span>
                                        </td>
                                        <td className="p-3 text-center">
                                            <span className="inline-flex items-center px-3 py-1 rounded-xl text-xs font-black bg-pink-100 text-pink-700 border border-pink-200">
                                                Comprar +{med.toBuy}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={4} className="p-6 text-center text-indigo-400 font-medium text-sm">
                                        Nenhuma compra sugerida no momento. O estoque está suprindo a demanda prevista.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                    {purchaseRecommendations.length > 10 && (
                        <div className="text-center mt-4 text-xs font-bold text-indigo-400">
                            + {purchaseRecommendations.length - 10} medicamentos necessitam de reposição. Acesse o relatório completo em 'Dados'.
                        </div>
                    )}
                </div>
            </div>

            {/* Listas Críticas Resumidas */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Medicamentos Zerados */}
                <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
                    <h3 className="text-sm font-black text-rose-600 uppercase tracking-tight mb-4 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        Estoque Zerado ({zeroStockAlerts.length})
                    </h3>
                    <div className="space-y-3 max-h-64 overflow-y-auto custom-scrollbar pr-2">
                        {zeroStockAlerts.length > 0 ? (
                            zeroStockAlerts.map(med => (
                                <div key={med.id} className="flex justify-between items-center p-3 rounded-2xl bg-rose-50/50 border border-rose-100">
                                    <div>
                                        <div className="font-extrabold text-slate-800 text-xs">{med.nome}</div>
                                        <div className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">{med.categoria} • Lote: {med.lote}</div>
                                    </div>
                                    <div className="text-rose-600 font-black text-xs px-2 py-1 bg-rose-100 rounded-lg">ZERADO</div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-6 text-slate-400 text-xs font-semibold">
                                Nenhum medicamento com estoque zerado!
                            </div>
                        )}
                    </div>
                </div>

                {/* Ultimos Pacientes Atendidos */}
                <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight mb-4 flex items-center gap-2">
                        <Users className="w-4 h-4 text-emerald-500" />
                        Últimos Pacientes Atendidos
                    </h3>
                    <div className="space-y-3 max-h-64 overflow-y-auto custom-scrollbar pr-2">
                        {currentMonthDispenses.slice(-10).reverse().map((m, i) => (
                            <div key={i} className="flex justify-between items-center p-3 rounded-2xl bg-slate-50 border border-slate-100">
                                <div>
                                    <div className="font-extrabold text-slate-800 text-xs">{m.paciente_nome || 'Paciente não identificado'}</div>
                                    <div className="text-[10px] font-bold text-slate-400 mt-0.5">{m.medicamento_nome} • {m.quantidade} un</div>
                                </div>
                                <div className="text-slate-400 font-bold text-[9px] uppercase">
                                    {m.data ? formatDistanceToNow(parseISO(m.data), { addSuffix: true, locale: ptBR }) : ''}
                                </div>
                            </div>
                        ))}
                        {currentMonthDispenses.length === 0 && (
                            <div className="text-center py-6 text-slate-400 text-xs font-semibold">
                                Nenhuma retirada registrada neste mês.
                            </div>
                        )}
                    </div>
                </div>
            </div>

        </div>
    );
};
