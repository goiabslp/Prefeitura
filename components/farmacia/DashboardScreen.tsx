import React, { useState, useEffect, useMemo } from 'react';
import { User, FarmaciaMedicamento, FarmaciaMovimentacao } from '../../types';
import * as db from '../../services/farmaciaService';
import {
    ArrowLeft, TrendingUp, TrendingDown, Users, Package, AlertTriangle, Activity, 
    Calendar, CheckCircle2, AlertCircle, ShoppingCart, Info, PieChart, FileDown
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    LineChart, Line, PieChart as RechartsPieChart, Pie, Cell
} from 'recharts';
import { startOfMonth, endOfMonth, subMonths, isWithinInterval, parseISO, format, formatDistanceToNow, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { jsPDF } from 'jspdf';
import { savePurchaseOrder } from '../../services/comprasService';
import { useNotification } from '../../contexts/NotificationContext';
import { PacientesTab } from '../common/PacientesTab';

interface DashboardScreenProps {
    currentUser: User;
    onBack: () => void;
    onNavigate: (view: string) => void;
    subView?: string;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
    currentUser,
    onBack,
    onNavigate,
    subView
}) => {
    const initialTab = subView ? subView.replace('dashboard-', '').replace('dashboard', 'geral') : 'geral';
    const [activeTab, setActiveTab] = useState(initialTab === 'dashboard' ? 'geral' : initialTab);
    
    // Sincronizar activeTab quando o subView mudar
    useEffect(() => {
        if (subView && subView.startsWith('dashboard')) {
            const tab = subView.replace('dashboard-', '').replace('dashboard', 'geral');
            setActiveTab(tab === 'dashboard' ? 'geral' : tab);
        }
    }, [subView]);

    const handleTabChange = (tabId: string) => {
        setActiveTab(tabId);
        onNavigate(`farmacia:dashboard-${tabId}`);
    };
    const [medicamentos, setMedicamentos] = useState<FarmaciaMedicamento[]>([]);
    const [movimentacoes, setMovimentacoes] = useState<FarmaciaMovimentacao[]>([]);
    const [loading, setLoading] = useState(true);

    const [reportView, setReportView] = useState<'alertas' | 'compras'>('alertas');
    const [comprasSearch, setComprasSearch] = useState('');
    const [selectedCompras, setSelectedCompras] = useState<Record<string, { quantidade: number, nome: string, unidade: string, lote: string, dosagem?: string, tipo?: string }>>({});
    const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
    const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
    const { addNotification } = useNotification();

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

    const handleExportCSV = () => {
        const headers = ['Medicamento', 'Princípio Ativo', 'Categoria', 'Tipo', 'Dosagem', 'Lote', 'Validade', 'Fornecedor', 'Situação', 'Estoque', 'Unidade', 'Limite Mínimo'];
        
        const rows = lowStockAlerts.map(med => {
            const situacao = med.quantidade === 0 ? 'Zerado' : 'Estoque Baixo';
            return [
                `"${med.nome}"`,
                `"${med.principio_ativo || ''}"`,
                `"${med.categoria}"`,
                `"${med.tipo || ''}"`,
                `"${med.dosagem || ''}"`,
                `"${med.lote || ''}"`,
                `"${med.validade || ''}"`,
                `"${med.fornecedor || ''}"`,
                `"${situacao}"`,
                med.quantidade,
                `"${med.unidade || 'un'}"`,
                med.limite_minimo
            ].join(',');
        });

        const csvContent = [headers.join(','), ...rows].join('\n');
        const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `relatorio_estoque_critico_${format(new Date(), 'yyyy-MM-dd')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
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

    // ZERADO A PEDIDO DO USUÁRIO
    const currentMonthDispenses: FarmaciaMovimentacao[] = []; 
    const lastMonthDispenses: FarmaciaMovimentacao[] = [];

    // KPI 1: Total Medicamentos Entregues
    const totalMedsCurrentMonth = 0; // currentMonthDispenses.reduce((acc, curr) => acc + curr.quantidade, 0);
    const totalMedsLastMonth = 0; // lastMonthDispenses.reduce((acc, curr) => acc + curr.quantidade, 0);
    const varMeds = 0; // totalMedsLastMonth === 0 ? 100 : ((totalMedsCurrentMonth - totalMedsLastMonth) / totalMedsLastMonth) * 100;

    // KPI 2: Pacientes Atendidos (Unique CPFs or Names in 'Saída')
    const getUniquePatientsCount = (movs: FarmaciaMovimentacao[]) => {
        const unique = new Set(movs.filter(m => m.paciente_cpf || m.paciente_nome).map(m => m.paciente_cpf || m.paciente_nome));
        return unique.size;
    };
    const totalPatientsCurrentMonth = 0; // getUniquePatientsCount(currentMonthDispenses);
    const totalPatientsLastMonth = 0; // getUniquePatientsCount(lastMonthDispenses);
    const varPatients = 0; // totalPatientsLastMonth === 0 ? 100 : ((totalPatientsCurrentMonth - totalPatientsLastMonth) / totalPatientsLastMonth) * 100;

    // KPI 3: Estoque Crítico e Baixo
    const lowStockAlerts = useMemo(() => {
        // Simplified low stock calculation for dashboard (can be same logic as FarmaciaModule if needed)
        // Here we use a simpler threshold logic: if quantity < limit_minimo
        return medicamentos.filter(med => med.quantidade <= med.limite_minimo && !(med.quantidade === 0 && med.lote === 'LOTE-INICIAL'));
    }, [medicamentos]);

    const zeroStockAlerts = medicamentos.filter(med => med.quantidade === 0 && med.lote !== 'LOTE-INICIAL');

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

    const renameStats = useMemo(() => {
        const stats = {
            CBAF: { total: 0, disponivel: 0, items: [] as FarmaciaMedicamento[] },
            CESAF: { total: 0, disponivel: 0, items: [] as FarmaciaMedicamento[] },
            CEAF: { total: 0, disponivel: 0, items: [] as FarmaciaMedicamento[] },
            OUTROS: { total: 0, disponivel: 0, items: [] as FarmaciaMedicamento[] }
        };

        medicamentos.forEach(med => {
            const cat = med.categoria?.toUpperCase() || 'OUTROS';
            const group = stats[cat as keyof typeof stats] ? cat as keyof typeof stats : 'OUTROS';
            
            stats[group].total += 1;
            if (med.quantidade > 0) {
                stats[group].disponivel += 1;
            }
            stats[group].items.push(med);
        });

        return stats;
    }, [medicamentos]);

    const renameChartData = useMemo(() => {
        return [
            { name: 'CBAF', value: renameStats.CBAF.disponivel, total: renameStats.CBAF.total, fill: '#ec4899' }, // Pink
            { name: 'CESAF', value: renameStats.CESAF.disponivel, total: renameStats.CESAF.total, fill: '#8b5cf6' }, // Purple
            { name: 'CEAF', value: renameStats.CEAF.disponivel, total: renameStats.CEAF.total, fill: '#3b82f6' }, // Blue
        ].filter(d => d.total > 0);
    }, [renameStats]);

    const handleOpenOrderModal = () => {
        const itemIds = Object.keys(selectedCompras);
        if (itemIds.length === 0) {
            addNotification('Aviso', 'Selecione pelo menos um medicamento para o pedido', 'error');
            return;
        }
        setIsOrderModalOpen(true);
    };

    const handleDownloadPDF = () => {
        const itemIds = Object.keys(selectedCompras);
        if (itemIds.length === 0) return;

        const purchaseItems = itemIds.map(id => {
            const item = selectedCompras[id];
            const fullName = [item.nome, item.dosagem, item.tipo].filter(Boolean).join(' • ');
            
            return {
                id: crypto.randomUUID(),
                name: fullName,
                quantity: item.quantidade,
                unit: item.unidade,
                details: `Lote ref: ${item.lote || 'N/A'}`
            };
        });

        const doc = new jsPDF();
        doc.setFontSize(20);
        doc.text('Pedido de Compras - Farmácia Popular', 20, 20);
        doc.setFontSize(12);
        doc.text(`Data: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 20, 30);
        doc.text(`Solicitante: ${currentUser.name}`, 20, 40);
        
        doc.setFontSize(14);
        doc.text('Itens Solicitados:', 20, 60);
        
        let y = 70;
        doc.setFontSize(10);
        purchaseItems.forEach((item, index) => {
            doc.text(`${index + 1}. ${item.name} - Qtd: ${item.quantity} ${item.unit}`, 20, y);
            y += 10;
            if (y > 280) {
                doc.addPage();
                y = 20;
            }
        });
        
        doc.save(`pedido_compras_farmacia_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`);
    };

    const handleSendOrder = async () => {
        const itemIds = Object.keys(selectedCompras);
        if (itemIds.length === 0) return;

        setIsSubmittingOrder(true);
        try {
            const purchaseItems = itemIds.map(id => {
                const item = selectedCompras[id];
                const fullName = [item.nome, item.dosagem, item.tipo].filter(Boolean).join(' • ');

                return {
                    id: crypto.randomUUID(),
                    name: fullName,
                    quantity: item.quantidade,
                    unit: item.unidade,
                    details: `Lote ref: ${item.lote || 'N/A'}`,
                    category: 'Material de Uso',
                    isTendered: false
                };
            });

            const newOrder = {
                id: crypto.randomUUID(), // Gerar ID local para evitar null violation
                protocol: `FARM-${format(new Date(), 'yyyyMMdd')}-${Math.floor(Math.random() * 10000)}`,
                title: `Pedido de Reposição - Farmácia (${format(new Date(), 'dd/MM/yyyy')})`,
                status: 'pending',
                purchaseStatus: 'budgeting', // initial status
                createdAt: new Date().toISOString(),
                userId: currentUser.id,
                userName: currentUser.name,
                blockType: 'compras',
                description: 'Reposição de medicamentos para a Farmácia Popular. Solicitamos prioridade para manter o estoque regularizado e garantir o atendimento à população.',
                documentSnapshot: {
                    content: {
                        requesterName: currentUser.name,
                        requesterSector: 'Farmácia Popular',
                        description: 'Reposição de medicamentos essenciais da RENAME que atingiram limite mínimo ou estão zerados no sistema da Farmácia Popular.',
                        purchaseItems
                    }
                }
            };

            await savePurchaseOrder(newOrder as any);
            addNotification('Sucesso', 'Pedido enviado com sucesso para o setor de Compras!', 'success');
            setSelectedCompras({});
            setIsOrderModalOpen(false);
            setReportView('alertas');
        } catch (error: any) {
            console.error('Error closing order:', error);
            addNotification('Erro', error.message || 'Erro ao enviar pedido', 'error');
        } finally {
            setIsSubmittingOrder(false);
        }
    };

    const handleToggleItemSelection = (med: FarmaciaMedicamento) => {
        setSelectedCompras(prev => {
            const current = { ...prev };
            if (current[med.id]) {
                delete current[med.id];
            } else {
                current[med.id] = { 
                    quantidade: 1, 
                    nome: med.nome, 
                    unidade: med.unidade || 'un', 
                    lote: med.lote,
                    dosagem: med.dosagem,
                    tipo: med.tipo
                };
            }
            return current;
        });
    };

    const handleItemQuantityChange = (medId: string, quantity: number) => {
        setSelectedCompras(prev => {
            if (!prev[medId]) return prev;
            return {
                ...prev,
                [medId]: { ...prev[medId], quantidade: Math.max(1, quantity) }
            };
        });
    };

    const comprasFilteredMedicamentos = useMemo(() => {
        const term = comprasSearch.toLowerCase().trim();
        
        // Só deve trazer os resultados mediante pesquisa.
        // Se a busca estiver vazia, mostramos apenas os itens que o usuário JÁ selecionou
        // para que ele possa revisar o pedido antes de fechar.
        if (!term) {
            return medicamentos.filter(med => !!selectedCompras[med.id]);
        }
        
        return medicamentos.filter(med => {
            return med.nome.toLowerCase().startsWith(term) || med.principio_ativo?.toLowerCase().startsWith(term);
        });
    }, [medicamentos, comprasSearch, selectedCompras]);

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

            {/* Tabs */}
            <div className="flex overflow-x-auto gap-2 mb-6 pb-2 custom-scrollbar">
                {['geral', 'medicamentos', 'pacientes', 'relatorios', 'rename'].map(tab => (
                    <button
                        key={tab}
                        onClick={() => handleTabChange(tab)}
                        className={`px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
                            activeTab === tab
                                ? 'bg-pink-600 text-white shadow-md shadow-pink-500/20'
                                : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-200/60 hover:text-slate-900'
                        }`}
                    >
                        {tab === 'geral' ? 'Visão Geral' : tab === 'relatorios' ? 'Relatórios' : tab === 'rename' ? 'RENAME' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                ))}
            </div>

            {/* CONTEÚDO DAS ABAS */}
            
            {activeTab === 'geral' && (
                <>
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
            </>
            )}

            {activeTab === 'medicamentos' && (
            <>
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
            </div>
            </>
            )}

            {activeTab === 'pacientes' && (
            <>
            {/* Ultimos Pacientes Atendidos */}
            <div className="grid grid-cols-1 gap-6">
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
                
                {/* Unified Pacientes Registration List */}
                <div className="mt-6">
                    <PacientesTab />
                </div>
            </div>
            </>
            )}

            {activeTab === 'relatorios' && (
            <div className="space-y-6">
                <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                            <Activity className="w-5 h-5 text-pink-500" />
                            Relatórios Gerenciais
                        </h3>
                        <p className="text-slate-500 text-[10px] font-bold uppercase mt-1 tracking-widest">
                            {reportView === 'alertas' ? 'Medicamentos Zerados ou em Alerta' : 'Novo Pedido de Reposição'}
                        </p>
                    </div>
                    
                    <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
                        <button 
                            onClick={() => setReportView('alertas')}
                            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${reportView === 'alertas' ? 'bg-white text-pink-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Alertas de Estoque
                        </button>
                        <button 
                            onClick={() => setReportView('compras')}
                            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${reportView === 'compras' ? 'bg-white text-pink-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Pedido de Compras
                        </button>
                    </div>

                    {reportView === 'alertas' ? (
                        <button 
                            onClick={handleExportCSV}
                            className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-2"
                        >
                            <FileDown className="w-4 h-4" />
                            Baixar Relatório (CSV)
                        </button>
                    ) : (
                        <button 
                            onClick={handleOpenOrderModal}
                            disabled={isSubmittingOrder || Object.keys(selectedCompras).length === 0}
                            className={`px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-2 ${Object.keys(selectedCompras).length > 0 ? 'bg-pink-600 hover:bg-pink-700 text-white shadow-md' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                        >
                            {isSubmittingOrder ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <ShoppingCart className="w-4 h-4" />}
                            Fechar Pedido ({Object.keys(selectedCompras).length})
                        </button>
                    )}
                </div>

                {reportView === 'alertas' ? (
                <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-100">
                                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Medicamento</th>
                                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Lote & Validade</th>
                                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Situação</th>
                                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Estoque</th>
                                </tr>
                            </thead>
                            <tbody>
                                {lowStockAlerts.map(med => (
                                    <tr key={med.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                        <td className="p-4">
                                            <div className="font-extrabold text-slate-800 text-xs">{med.nome}</div>
                                            {med.principio_ativo && <div className="text-[10px] text-slate-500 font-medium">{med.principio_ativo}</div>}
                                            <div className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">
                                                {med.categoria} • {med.tipo} {med.dosagem ? `• ${med.dosagem}` : ''}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="text-xs font-bold text-slate-600">Lote: {med.lote}</div>
                                            {med.validade && <div className="text-[10px] text-slate-400 mt-0.5">Val: {med.validade}</div>}
                                            {med.fornecedor && <div className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">Forn: {med.fornecedor}</div>}
                                        </td>
                                        <td className="p-4 text-center">
                                            {med.quantidade === 0 ? (
                                                <span className="inline-flex items-center px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-wider bg-rose-100 text-rose-700">Zerado</span>
                                            ) : (
                                                <span className="inline-flex items-center px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-wider bg-amber-100 text-amber-700">Estoque Baixo</span>
                                            )}
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex items-end justify-end gap-1">
                                                <span className={`font-black text-sm ${med.quantidade === 0 ? 'text-rose-600' : 'text-amber-600'}`}>{med.quantidade}</span>
                                                <span className="text-[9px] font-bold text-slate-400 mb-0.5 lowercase">{med.unidade || 'un'}</span>
                                            </div>
                                            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Mín: {med.limite_minimo}</div>
                                        </td>
                                    </tr>
                                ))}
                                {lowStockAlerts.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="p-8 text-center text-slate-400 text-xs font-bold uppercase tracking-wider">Nenhum medicamento em estado crítico.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
                ) : (
                <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
                    <div className="mb-4">
                        <input
                            type="text"
                            placeholder="Buscar medicamentos para adicionar ao pedido..."
                            value={comprasSearch}
                            onChange={(e) => setComprasSearch(e.target.value)}
                            className="w-full pl-4 pr-4 py-3 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:outline-none focus:border-pink-500 bg-slate-50 focus:bg-white transition-all placeholder:text-slate-400"
                        />
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-100">
                                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-12">Sel</th>
                                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Medicamento</th>
                                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Situação</th>
                                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Quantidade Solicitada</th>
                                </tr>
                            </thead>
                            <tbody>
                                {comprasFilteredMedicamentos.slice(0, 100).map(med => (
                                    <tr key={med.id} className={`border-b border-slate-50 transition-colors ${selectedCompras[med.id] ? 'bg-pink-50/50' : 'hover:bg-slate-50/50'}`}>
                                        <td className="p-4">
                                            <input 
                                                type="checkbox" 
                                                checked={!!selectedCompras[med.id]}
                                                onChange={() => handleToggleItemSelection(med)}
                                                className="w-4 h-4 text-pink-600 rounded focus:ring-pink-500 border-slate-300"
                                            />
                                        </td>
                                        <td className="p-4">
                                            <div className="font-extrabold text-slate-800 text-xs">{med.nome}</div>
                                            {med.principio_ativo && <div className="text-[10px] text-slate-500 font-medium">{med.principio_ativo}</div>}
                                            <div className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">
                                                {med.categoria} • {med.tipo} {med.dosagem ? `• ${med.dosagem}` : ''}
                                            </div>
                                        </td>
                                        <td className="p-4 text-center">
                                            {med.quantidade === 0 ? (
                                                <span className="inline-flex items-center px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-wider bg-rose-100 text-rose-700">Zerado</span>
                                            ) : med.quantidade <= med.limite_minimo ? (
                                                <span className="inline-flex items-center px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-wider bg-amber-100 text-amber-700">Baixo</span>
                                            ) : (
                                                <span className="inline-flex items-center px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-700">OK</span>
                                            )}
                                            <div className="text-[9px] font-bold text-slate-400 mt-1">Estoque atual: {med.quantidade}</div>
                                        </td>
                                        <td className="p-4 text-right">
                                            {selectedCompras[med.id] ? (
                                                <div className="flex items-center justify-end gap-2">
                                                    <input 
                                                        type="number"
                                                        min="1"
                                                        value={selectedCompras[med.id].quantidade}
                                                        onChange={(e) => handleItemQuantityChange(med.id, parseInt(e.target.value) || 1)}
                                                        className="w-20 p-2 text-sm font-bold border border-slate-200 rounded-lg text-right focus:outline-none focus:border-pink-500"
                                                    />
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase">{med.unidade || 'un'}</span>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-slate-300 italic">Selecione para pedir</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {comprasFilteredMedicamentos.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="p-8 text-center text-slate-400 text-xs font-bold uppercase tracking-wider">Nenhum medicamento encontrado.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
                )}
            </div>
            )}
            {activeTab === 'rename' && (
                <div className="space-y-6">
                    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                                <Activity className="w-5 h-5 text-pink-500" />
                                Relação Nacional de Medicamentos Essenciais (RENAME)
                            </h3>
                            <p className="text-slate-500 text-[10px] font-bold uppercase mt-1 tracking-widest">
                                Visão Geral de Disponibilidade por Categoria
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        {/* Gráfico Donut */}
                        <div className="md:col-span-1 bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col justify-center items-center">
                            <h4 className="text-sm font-bold text-slate-700 uppercase mb-4 text-center">Disponibilidade Global</h4>
                            <div className="w-full h-48">
                                <ResponsiveContainer width="100%" height="100%">
                                    <RechartsPieChart>
                                        <Pie
                                            data={renameChartData}
                                            innerRadius={50}
                                            outerRadius={70}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {renameChartData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.fill} />
                                            ))}
                                        </Pie>
                                        <Tooltip formatter={(value: number, name: string, props: any) => [`${value} itens em estoque`, name]} />
                                    </RechartsPieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="flex flex-col gap-2 w-full mt-4">
                                {renameChartData.map((entry, index) => (
                                    <div key={index} className="flex justify-between items-center text-xs font-bold text-slate-600">
                                        <div className="flex items-center gap-1">
                                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.fill }}></div>
                                            {entry.name}
                                        </div>
                                        <span>{Math.round((entry.value / entry.total) * 100)}%</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Detalhamento CBAF, CESAF, CEAF */}
                        <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6">
                            {[
                                { title: 'Básico (CBAF)', id: 'CBAF', stats: renameStats.CBAF, color: 'text-pink-600', bg: 'bg-pink-100' },
                                { title: 'Estratégico (CESAF)', id: 'CESAF', stats: renameStats.CESAF, color: 'text-purple-600', bg: 'bg-purple-100' },
                                { title: 'Especializado (CEAF)', id: 'CEAF', stats: renameStats.CEAF, color: 'text-blue-600', bg: 'bg-blue-100' }
                            ].map(cat => (
                                <div key={cat.id} className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col h-full">
                                    <h4 className={`text-sm font-black uppercase tracking-wider mb-2 ${cat.color}`}>{cat.title}</h4>
                                    
                                    <div className="flex justify-between items-end mb-4">
                                        <div>
                                            <div className="text-3xl font-black text-slate-800">
                                                {cat.stats.total > 0 ? Math.round((cat.stats.disponivel / cat.stats.total) * 100) : 0}%
                                            </div>
                                            <div className="text-[10px] font-bold text-slate-400 uppercase">Em Estoque</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-sm font-bold text-slate-600">{cat.stats.disponivel} / {cat.stats.total}</div>
                                            <div className="text-[10px] font-bold text-slate-400 uppercase">Itens Disponíveis</div>
                                        </div>
                                    </div>

                                    {/* Lista de Medicamentos (mini) */}
                                    <div className="flex-1 bg-slate-50 rounded-xl p-3 overflow-y-auto max-h-64 custom-scrollbar">
                                        <div className="space-y-2">
                                            {cat.stats.items.map(med => (
                                                <div key={med.id} className="flex justify-between items-start gap-2 p-2 bg-white rounded-lg border border-slate-100">
                                                    <div className="flex-1">
                                                        <div className="text-[10px] font-bold text-slate-700 leading-tight" title={med.nome}>{med.nome}</div>
                                                    </div>
                                                    <div className="shrink-0">
                                                        {med.quantidade > 0 ? (
                                                            <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-emerald-100 text-emerald-700">OK</span>
                                                        ) : (
                                                            <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-rose-100 text-rose-700">Zero</span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                            {cat.stats.items.length === 0 && (
                                                <div className="text-xs text-slate-400 text-center py-4 font-semibold italic">Nenhum medicamento nesta categoria.</div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {isOrderModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                                <ShoppingCart className="w-5 h-5 text-pink-600" />
                                Resumo do Pedido de Compras
                            </h3>
                            <button onClick={() => setIsOrderModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold p-2">
                                X
                            </button>
                        </div>
                        <div className="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr>
                                        <th className="pb-3 text-xs font-black text-slate-400 uppercase tracking-wider border-b border-slate-100">Medicamento</th>
                                        <th className="pb-3 text-xs font-black text-slate-400 uppercase tracking-wider border-b border-slate-100 text-right">Qtd Solicitada</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {Object.values(selectedCompras).map((item, index) => (
                                        <tr key={index} className="border-b border-slate-50 last:border-0">
                                            <td className="py-3 text-sm font-bold text-slate-700">{item.nome}</td>
                                            <td className="py-3 text-sm font-bold text-slate-600 text-right">{item.quantidade} {item.unidade}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                            <button 
                                onClick={handleDownloadPDF}
                                className="px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-2"
                            >
                                <FileDown className="w-4 h-4 text-slate-500" />
                                Baixar PDF
                            </button>
                            <button 
                                onClick={handleSendOrder}
                                disabled={isSubmittingOrder}
                                className="px-5 py-2.5 bg-pink-600 hover:bg-pink-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-2 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSubmittingOrder ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <ShoppingCart className="w-4 h-4" />}
                                Enviar para o Compras
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};
