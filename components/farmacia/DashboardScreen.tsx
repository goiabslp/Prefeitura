import React, { useState, useEffect, useMemo } from 'react';
import { User, FarmaciaMedicamento, FarmaciaMovimentacao } from '../../types';
import * as db from '../../services/farmaciaService';
import {
    ArrowLeft, TrendingUp, TrendingDown, Users, Package, AlertTriangle, Activity, 
    Calendar, CheckCircle2, AlertCircle, ShoppingCart, Info, PieChart, FileDown,
    Plus, Search, X, MoreVertical
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    LineChart, Line, PieChart as RechartsPieChart, Pie, Cell
} from 'recharts';
import { startOfMonth, endOfMonth, subMonths, isWithinInterval, parseISO, format, formatDistanceToNow, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { FarmaciaPdfGenerator } from './FarmaciaPdfGenerator';
import { savePurchaseOrder } from '../../services/comprasService';
import { useNotification } from '../../contexts/NotificationContext';
import { PacientesTab } from '../common/PacientesTab';

interface DashboardScreenProps {
    currentUser?: User | null;
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

    // Alto Custo Form & Modal state
    const [isAltoCustoModalOpen, setIsAltoCustoModalOpen] = useState(false);
    const [altoCustoSearch, setAltoCustoSearch] = useState('');
    const [acNome, setAcNome] = useState('');
    const [acPrincipioAtivo, setAcPrincipioAtivo] = useState('');
    const [acTipo, setAcTipo] = useState('Comprimido');
    const [acDosagem, setAcDosagem] = useState('');
    const [acCategoria, setAcCategoria] = useState<'CBAF' | 'CESAF' | 'CEAF'>('CEAF');
    const [acLote, setAcLote] = useState('S/L');
    const [acValidade, setAcValidade] = useState('2099-12-31');
    const [acQuantidade, setAcQuantidade] = useState('0');
    const [acLimiteMinimo, setAcLimiteMinimo] = useState('10');
    const [acSaving, setAcSaving] = useState(false);

    // RENAME list search & filters
    const [renameSearch, setRenameSearch] = useState('');
    const [renameCategoryFilter, setRenameCategoryFilter] = useState<'TODOS' | 'CBAF' | 'CESAF' | 'CEAF'>('TODOS');
    const [renameStatusFilter, setRenameStatusFilter] = useState<'TODOS' | 'DISPONIVEL' | 'BAIXO' | 'ZERADO'>('TODOS');

    // Menu interativo (...) para cada item
    const [activeMenuMedId, setActiveMenuMedId] = useState<string | null>(null);

    // Operações tab filter states & PDF printer
    const [operacoesSearch, setOperacoesSearch] = useState('');
    const [operacoesTipoFilter, setOperacoesTipoFilter] = useState<'TODOS' | 'Saída' | 'Entrada' | 'Ajuste'>('TODOS');
    const [operacoesCategoriaFilter, setOperacoesCategoriaFilter] = useState<'TODOS' | 'CBAF' | 'CESAF' | 'CEAF'>('TODOS');
    const [printingMov, setPrintingMov] = useState<FarmaciaMovimentacao | null>(null);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

    const handlePrintMov = async (mov: FarmaciaMovimentacao) => {
        setIsGeneratingPdf(true);
        setPrintingMov(mov);
        await new Promise(resolve => setTimeout(resolve, 500));
        try {
            const container = document.getElementById('farmacia-pdf-content');
            if (container) {
                const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
                const canvas = await html2canvas(container, {
                    scale: 2,
                    useCORS: true,
                    allowTaint: true,
                    logging: false,
                    backgroundColor: '#ffffff',
                    width: container.offsetWidth,
                    height: container.offsetHeight
                });
                const imgData = canvas.toDataURL('image/jpeg', 0.98);
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
                pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
                const protocol = mov.id.substring(0, 8).toUpperCase();
                pdf.save(`Comprovante-Retirada-Farmacia-${protocol}.pdf`);
            }
        } catch (err) {
            console.error('Erro ao gerar PDF:', err);
        } finally {
            setIsGeneratingPdf(false);
            setPrintingMov(null);
        }
    };

    const operacoesFiltered = useMemo(() => {
        let list = [...movimentacoes];

        if (operacoesTipoFilter !== 'TODOS') {
            list = list.filter(m => m.tipo === operacoesTipoFilter);
        }

        if (operacoesCategoriaFilter !== 'TODOS') {
            list = list.filter(m => m.medicamento_categoria === operacoesCategoriaFilter);
        }

        if (operacoesSearch.trim()) {
            const query = operacoesSearch.toLowerCase().trim();
            const cleanQuery = query.replace(/\D/g, '');
            list = list.filter(m => 
                (m.paciente_nome || '').toLowerCase().includes(query) ||
                (m.paciente_cpf || '').includes(cleanQuery) ||
                m.medicamento_nome.toLowerCase().includes(query) ||
                (m.medicamento_dosagem || '').toLowerCase().includes(query) ||
                m.lote.toLowerCase().includes(query) ||
                (m.responsavel_nome || '').toLowerCase().includes(query)
            );
        }

        return list;
    }, [movimentacoes, operacoesTipoFilter, operacoesCategoriaFilter, operacoesSearch]);

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

        const handleRealtimeChange = () => loadData();

        window.addEventListener('farmacia-medicamentos-changed', handleRealtimeChange);
        window.addEventListener('farmacia-movimentacoes-changed', handleRealtimeChange);

        return () => {
            window.removeEventListener('farmacia-medicamentos-changed', handleRealtimeChange);
            window.removeEventListener('farmacia-movimentacoes-changed', handleRealtimeChange);
        };
    }, []);

    // --- DATA PROCESSING ---

    const now = useMemo(() => new Date(), []);
    const currentMonthStart = useMemo(() => startOfMonth(now), [now]);
    const currentMonthEnd = useMemo(() => endOfMonth(now), [now]);
    const lastMonthStart = useMemo(() => startOfMonth(subMonths(now, 1)), [now]);
    const lastMonthEnd = useMemo(() => endOfMonth(subMonths(now, 1)), [now]);
    const daysPassedThisMonth = useMemo(() => differenceInDays(now, currentMonthStart) || 1, [now, currentMonthStart]);
    const daysInCurrentMonth = useMemo(() => differenceInDays(currentMonthEnd, currentMonthStart) + 1, [currentMonthEnd, currentMonthStart]);

    // Parsing robusto de data para movimentações
    const parseMovimentacaoDate = (dateStr?: string): Date | null => {
        if (!dateStr) return null;
        try {
            let dateObj = parseISO(dateStr);
            if (!isNaN(dateObj.getTime())) return dateObj;

            dateObj = new Date(dateStr);
            if (!isNaN(dateObj.getTime())) return dateObj;

            if (typeof dateStr === 'string' && dateStr.includes('/')) {
                const parts = dateStr.split(' ')[0].split('/');
                if (parts.length === 3) {
                    const day = parseInt(parts[0], 10);
                    const month = parseInt(parts[1], 10) - 1;
                    const year = parseInt(parts[2], 10);
                    dateObj = new Date(year, month, day);
                    if (!isNaN(dateObj.getTime())) return dateObj;
                }
            }
            return null;
        } catch {
            return null;
        }
    };

    // Dispensações do mês atual e mês anterior
    const currentMonthDispenses = useMemo(() => {
        return movimentacoes.filter(m => {
            if (m.tipo !== 'Saída' || !m.data) return false;
            const dateObj = parseMovimentacaoDate(m.data);
            if (!dateObj) return false;
            return isWithinInterval(dateObj, { start: currentMonthStart, end: currentMonthEnd });
        });
    }, [movimentacoes, currentMonthStart, currentMonthEnd]);

    const lastMonthDispenses = useMemo(() => {
        return movimentacoes.filter(m => {
            if (m.tipo !== 'Saída' || !m.data) return false;
            const dateObj = parseMovimentacaoDate(m.data);
            if (!dateObj) return false;
            return isWithinInterval(dateObj, { start: lastMonthStart, end: lastMonthEnd });
        });
    }, [movimentacoes, lastMonthStart, lastMonthEnd]);

    // KPI 1: Total Medicamentos Entregues
    const totalMedsCurrentMonth = useMemo(() => {
        return currentMonthDispenses.reduce((acc, curr) => acc + (curr.quantidade || 0), 0);
    }, [currentMonthDispenses]);

    const totalMedsLastMonth = useMemo(() => {
        return lastMonthDispenses.reduce((acc, curr) => acc + (curr.quantidade || 0), 0);
    }, [lastMonthDispenses]);

    const varMeds = useMemo(() => {
        if (totalMedsLastMonth === 0) return null;
        return ((totalMedsCurrentMonth - totalMedsLastMonth) / totalMedsLastMonth) * 100;
    }, [totalMedsCurrentMonth, totalMedsLastMonth]);

    // KPI 2: Pacientes Atendidos (Unique CPFs or Names in 'Saída')
    const getUniquePatientsCount = (movs: FarmaciaMovimentacao[]) => {
        const unique = new Set(movs.filter(m => m.paciente_cpf || m.paciente_nome).map(m => m.paciente_cpf || m.paciente_nome));
        return unique.size;
    };

    const totalPatientsCurrentMonth = useMemo(() => {
        return getUniquePatientsCount(currentMonthDispenses);
    }, [currentMonthDispenses]);

    const totalPatientsLastMonth = useMemo(() => {
        return getUniquePatientsCount(lastMonthDispenses);
    }, [lastMonthDispenses]);

    const varPatients = useMemo(() => {
        if (totalPatientsLastMonth === 0) return null;
        return ((totalPatientsCurrentMonth - totalPatientsLastMonth) / totalPatientsLastMonth) * 100;
    }, [totalPatientsCurrentMonth, totalPatientsLastMonth]);

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

    const renameFilteredList = useMemo(() => {
        return medicamentos.filter(med => {
            const cat = med.categoria?.toUpperCase();
            if (!['CBAF', 'CESAF', 'CEAF'].includes(cat)) return false;

            if (renameCategoryFilter !== 'TODOS' && cat !== renameCategoryFilter) {
                return false;
            }

            if (renameStatusFilter === 'DISPONIVEL' && (med.quantidade <= med.limite_minimo || med.quantidade === 0)) return false;
            if (renameStatusFilter === 'BAIXO' && (med.quantidade === 0 || med.quantidade > med.limite_minimo)) return false;
            if (renameStatusFilter === 'ZERADO' && med.quantidade > 0) return false;

            if (!renameSearch.trim()) return true;
            const q = renameSearch.toLowerCase();
            return (
                med.nome?.toLowerCase().includes(q) ||
                med.principio_ativo?.toLowerCase().includes(q) ||
                med.lote?.toLowerCase().includes(q) ||
                med.categoria?.toLowerCase().includes(q) ||
                med.tipo?.toLowerCase().includes(q)
            );
        });
    }, [medicamentos, renameSearch, renameCategoryFilter, renameStatusFilter]);

    const altoCustoStats = useMemo(() => {
        const altoCustoMeds = medicamentos.filter(med => med.alto_custo === true);
        const total = altoCustoMeds.length;
        const disponivel = altoCustoMeds.filter(med => med.quantidade > 0).length;
        const zerados = altoCustoMeds.filter(med => med.quantidade === 0).length;

        const CBAF = { total: 0, disponivel: 0, items: [] as FarmaciaMedicamento[] };
        const CESAF = { total: 0, disponivel: 0, items: [] as FarmaciaMedicamento[] };
        const CEAF = { total: 0, disponivel: 0, items: [] as FarmaciaMedicamento[] };

        altoCustoMeds.forEach(med => {
            const cat = med.categoria?.toUpperCase();
            if (cat === 'CESAF') {
                CESAF.total += 1;
                if (med.quantidade > 0) CESAF.disponivel += 1;
                CESAF.items.push(med);
            } else if (cat === 'CEAF') {
                CEAF.total += 1;
                if (med.quantidade > 0) CEAF.disponivel += 1;
                CEAF.items.push(med);
            } else {
                CBAF.total += 1;
                if (med.quantidade > 0) CBAF.disponivel += 1;
                CBAF.items.push(med);
            }
        });

        return {
            total,
            disponivel,
            zerados,
            items: altoCustoMeds,
            byCat: { CBAF, CESAF, CEAF }
        };
    }, [medicamentos]);

    const altoCustoChartData = useMemo(() => {
        return [
            { name: 'Básico (CBAF)', value: altoCustoStats.byCat.CBAF.disponivel, total: altoCustoStats.byCat.CBAF.total, fill: '#ec4899' },
            { name: 'Estratégico (CESAF)', value: altoCustoStats.byCat.CESAF.disponivel, total: altoCustoStats.byCat.CESAF.total, fill: '#8b5cf6' },
            { name: 'Especializado (CEAF)', value: altoCustoStats.byCat.CEAF.disponivel, total: altoCustoStats.byCat.CEAF.total, fill: '#3b82f6' },
        ].filter(d => d.total > 0);
    }, [altoCustoStats]);

    const altoCustoFilteredList = useMemo(() => {
        return medicamentos.filter(med => {
            if (!med.alto_custo) return false;
            if (!altoCustoSearch.trim()) return true;
            const q = altoCustoSearch.toLowerCase();
            return (
                med.nome?.toLowerCase().includes(q) ||
                med.principio_ativo?.toLowerCase().includes(q) ||
                med.lote?.toLowerCase().includes(q) ||
                med.categoria?.toLowerCase().includes(q) ||
                med.tipo?.toLowerCase().includes(q)
            );
        });
    }, [medicamentos, altoCustoSearch]);

    const handleCreateAltoCusto = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!acNome.trim()) {
            addNotification('Aviso', 'Preencha o nome do medicamento.', 'error');
            return;
        }

        setAcSaving(true);
        try {
            const qtyNum = parseInt(acQuantidade, 10) || 0;
            const limitNum = parseInt(acLimiteMinimo, 10) || 10;

            const newMed = await db.createMedicamento({
                nome: acNome.toUpperCase(),
                categoria: acCategoria,
                quantidade: 0,
                unidade: 'Unidade',
                validade: acValidade || '2099-12-31',
                lote: (acLote || 'S/L').toUpperCase(),
                limite_minimo: limitNum,
                tipo: acTipo || 'Comprimido',
                dosagem: acDosagem || undefined,
                principio_ativo: acPrincipioAtivo ? acPrincipioAtivo.toUpperCase() : undefined,
                alto_custo: true
            });

            if (newMed && qtyNum > 0) {
                await db.registrarMovimentacao({
                    medicamento_id: newMed.id,
                    tipo: 'Entrada',
                    quantidade: qtyNum,
                    medicamento_nome: newMed.nome,
                    medicamento_categoria: newMed.categoria,
                    medicamento_tipo: newMed.tipo,
                    medicamento_dosagem: newMed.dosagem,
                    lote: newMed.lote,
                    validade: newMed.validade,
                    responsavel_nome: currentUser?.name || '',
                    responsavel_id: currentUser?.id || '',
                    data: new Date().toISOString(),
                    observacoes: 'Cadastro de Medicamento de Alto Custo'
                });
            }

            addNotification('Sucesso', 'Medicamento de Alto Custo cadastrado com sucesso!', 'success');
            setIsAltoCustoModalOpen(false);
            loadData();
        } catch (error: any) {
            addNotification('Erro', error.message || 'Erro ao cadastrar medicamento de alto custo.', 'error');
        } finally {
            setAcSaving(false);
        }
    };

    const handleMoveToAltoCusto = async (med: FarmaciaMedicamento) => {
        try {
            await db.updateMedicamento(med.id, { alto_custo: true });
            addNotification('Sucesso', `Medicamento "${med.nome}" movido para Alto Custo com sucesso!`, 'success');
            setActiveMenuMedId(null);
            await loadData();
            handleTabChange('alto-custo');
        } catch (error: any) {
            addNotification('Erro', error.message || 'Erro ao mover medicamento para Alto Custo.', 'error');
        }
    };

    const handleRemoveFromAltoCusto = async (med: FarmaciaMedicamento) => {
        try {
            await db.updateMedicamento(med.id, { alto_custo: false });
            addNotification('Sucesso', `Medicamento "${med.nome}" removido de Alto Custo!`, 'success');
            setActiveMenuMedId(null);
            await loadData();
        } catch (error: any) {
            addNotification('Erro', error.message || 'Erro ao remover medicamento de Alto Custo.', 'error');
        }
    };

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
        doc.text(`Solicitante: ${currentUser?.name || ''}`, 20, 40);
        
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
                userId: currentUser?.id || '',
                userName: currentUser?.name || '',
                blockType: 'compras',
                description: 'Reposição de medicamentos para a Farmácia Popular. Solicitamos prioridade para manter o estoque regularizado e garantir o atendimento à população.',
                documentSnapshot: {
                    content: {
                        requesterName: currentUser?.name || '',
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
                {['geral', 'medicamentos', 'pacientes', 'operacoes', 'relatorios', 'rename', 'alto-custo'].map(tab => (
                    <button
                        key={tab}
                        onClick={() => handleTabChange(tab)}
                        className={`px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
                            activeTab === tab
                                ? 'bg-pink-600 text-white shadow-md shadow-pink-500/20'
                                : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-200/60 hover:text-slate-900'
                        }`}
                    >
                        {tab === 'geral' ? 'Visão Geral' : tab === 'operacoes' ? 'Operações' : tab === 'relatorios' ? 'Relatórios' : tab === 'rename' ? 'RENAME' : tab === 'alto-custo' ? 'ALTO CUSTO' : tab.charAt(0).toUpperCase() + tab.slice(1)}
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
                    {varMeds !== null ? (
                        <div className={`flex items-center gap-1 text-xs font-bold ${varMeds >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {varMeds >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                            {Math.abs(varMeds).toFixed(1)}% {varMeds >= 0 ? 'a mais' : 'a menos'} que o mês passado
                        </div>
                    ) : (
                        <div className="text-xs font-bold text-slate-400">
                            Sem registros no mês anterior
                        </div>
                    )}
                </div>

                {/* KPI 2 */}
                <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-6 opacity-20 group-hover:opacity-10 transition-opacity group-hover:scale-110 duration-500">
                        <Users className="w-16 h-16 text-blue-500" />
                    </div>
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Pacientes Atendidos</h3>
                    <div className="text-3xl font-black text-slate-800 mb-2">{totalPatientsCurrentMonth} <span className="text-sm font-medium text-slate-400">pessoas</span></div>
                    {varPatients !== null ? (
                        <div className={`flex items-center gap-1 text-xs font-bold ${varPatients >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {varPatients >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                            {Math.abs(varPatients).toFixed(1)}% {varPatients >= 0 ? 'a mais' : 'a menos'} que o mês passado
                        </div>
                    ) : (
                        <div className="text-xs font-bold text-slate-400">
                            Sem registros no mês anterior
                        </div>
                    )}
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

            {activeTab === 'operacoes' && (
            <div className="space-y-6">
                {/* KPIs da aba Operações */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-6 opacity-20">
                            <Activity className="w-16 h-16 text-pink-500" />
                        </div>
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total de Operações</h3>
                        <div className="text-3xl font-black text-slate-800 mb-1">{operacoesFiltered.length}</div>
                        <p className="text-xs font-semibold text-slate-400">Registros de saídas, entradas e ajustes</p>
                    </div>

                    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-6 opacity-20">
                            <Package className="w-16 h-16 text-emerald-500" />
                        </div>
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Unidades Dispensadas</h3>
                        <div className="text-3xl font-black text-emerald-600 mb-1">
                            {operacoesFiltered.filter(m => m.tipo === 'Saída').reduce((acc, curr) => acc + (curr.quantidade || 0), 0)} <span className="text-sm font-medium text-slate-400">unids</span>
                        </div>
                        <p className="text-xs font-semibold text-slate-400">Somatório de itens entregues</p>
                    </div>

                    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-6 opacity-20">
                            <Users className="w-16 h-16 text-blue-500" />
                        </div>
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Pacientes Distintos</h3>
                        <div className="text-3xl font-black text-blue-600 mb-1">
                            {new Set(operacoesFiltered.filter(m => m.paciente_cpf || m.paciente_nome).map(m => m.paciente_cpf || m.paciente_nome)).size}
                        </div>
                        <p className="text-xs font-semibold text-slate-400">Beneficiários atendidos</p>
                    </div>
                </div>

                {/* Barra de Filtros */}
                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="relative w-full md:max-w-md">
                            <input
                                type="text"
                                placeholder="Buscar por Paciente, CPF, Medicamento, Lote ou Operador..."
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-10 py-2.5 text-xs font-semibold placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/10 transition-all text-slate-900 shadow-inner"
                                value={operacoesSearch}
                                onChange={(e) => setOperacoesSearch(e.target.value)}
                            />
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                            {operacoesSearch && (
                                <button
                                    onClick={() => setOperacoesSearch('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                            {/* Filtros Tipo */}
                            <div className="flex bg-slate-100 p-1 rounded-xl">
                                {(['TODOS', 'Saída', 'Entrada', 'Ajuste'] as const).map(tipo => (
                                    <button
                                        key={tipo}
                                        onClick={() => setOperacoesTipoFilter(tipo)}
                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                                            operacoesTipoFilter === tipo
                                                ? 'bg-white text-pink-600 shadow-sm'
                                                : 'text-slate-500 hover:text-slate-800'
                                        }`}
                                    >
                                        {tipo}
                                    </button>
                                ))}
                            </div>

                            {/* Filtros Categoria */}
                            <div className="flex bg-slate-100 p-1 rounded-xl">
                                {(['TODOS', 'CBAF', 'CESAF', 'CEAF'] as const).map(cat => (
                                    <button
                                        key={cat}
                                        onClick={() => setOperacoesCategoriaFilter(cat)}
                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                                            operacoesCategoriaFilter === cat
                                                ? 'bg-white text-slate-900 shadow-sm'
                                                : 'text-slate-500 hover:text-slate-800'
                                        }`}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tabela de Operações */}
                <div className="bg-white border border-slate-200/80 rounded-3xl overflow-hidden shadow-sm">
                    <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                        <h3 className="font-extrabold text-slate-800 uppercase text-xs tracking-wider flex items-center gap-2">
                            <Activity className="w-4 h-4 text-pink-600" />
                            Histórico de Operações de Retirada ({operacoesFiltered.length})
                        </h3>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">
                            Ordenado pelas mais recentes
                        </span>
                    </div>

                    {operacoesFiltered.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse min-w-[800px]">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-100 text-[9px] font-black text-slate-400 uppercase tracking-wider">
                                        <th className="p-4">Data / Hora</th>
                                        <th className="p-4">Tipo</th>
                                        <th className="p-4">Paciente / Beneficiário</th>
                                        <th className="p-4">Medicamento / Detalhes</th>
                                        <th className="p-4 text-center">Quantidade</th>
                                        <th className="p-4">Responsável</th>
                                        <th className="p-4 text-right">Comprovante</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                                    {operacoesFiltered.map(op => {
                                        const isSaida = op.tipo === 'Saída';
                                        const isEntrada = op.tipo === 'Entrada';
                                        const tipoColor = isSaida
                                            ? 'bg-pink-50 text-pink-700 border-pink-100'
                                            : isEntrada
                                                ? 'bg-blue-50 text-blue-700 border-blue-100'
                                                : 'bg-amber-50 text-amber-700 border-amber-100';

                                        return (
                                            <tr key={op.id} className="hover:bg-slate-50/40 transition-colors">
                                                <td className="p-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                                                    {op.data ? format(parseISO(op.data), 'dd/MM/yyyy HH:mm:ss') : '—'}
                                                </td>
                                                <td className="p-4 whitespace-nowrap">
                                                    <span className={`inline-block px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border ${tipoColor}`}>
                                                        {op.tipo}
                                                    </span>
                                                </td>
                                                <td className="p-4">
                                                    {op.paciente_nome ? (
                                                        <div>
                                                            <div className="font-extrabold text-slate-900 uppercase">
                                                                {op.paciente_nome}
                                                            </div>
                                                            {op.paciente_cpf && (
                                                                <div className="text-[10px] text-slate-400 font-mono font-bold mt-0.5">
                                                                    CPF: {op.paciente_cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-400 italic text-[11px]">N/A (Operação Interna)</span>
                                                    )}
                                                </td>
                                                <td className="p-4">
                                                    <div className="font-bold text-slate-900 uppercase">
                                                        {op.medicamento_nome} {op.medicamento_dosagem ? `(${op.medicamento_dosagem})` : ''}
                                                    </div>
                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                        <span className="px-1.5 py-0.5 text-[8px] font-bold uppercase rounded bg-pink-50 text-pink-600">
                                                            {op.medicamento_categoria}
                                                        </span>
                                                        {op.medicamento_tipo && (
                                                            <span className="px-1.5 py-0.5 text-[8px] font-bold uppercase rounded bg-slate-100 text-slate-500">
                                                                {op.medicamento_tipo}
                                                            </span>
                                                        )}
                                                        <span className="px-1.5 py-0.5 text-[8px] font-bold uppercase rounded bg-slate-50 border border-slate-200 text-slate-500 font-mono">
                                                            Lote: {op.lote}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="p-4 text-center font-black text-slate-900">
                                                    <span className={isSaida ? 'text-pink-600 font-extrabold' : isEntrada ? 'text-blue-600 font-extrabold' : 'text-slate-800'}>
                                                        {isSaida ? `-${op.quantidade}` : isEntrada ? `+${op.quantidade}` : op.quantidade}
                                                    </span>
                                                </td>
                                                <td className="p-4 font-semibold text-slate-600 whitespace-nowrap">
                                                    {op.responsavel_nome || '—'}
                                                </td>
                                                <td className="p-4 text-right whitespace-nowrap">
                                                    {isSaida ? (
                                                        <button
                                                            onClick={() => handlePrintMov(op)}
                                                            disabled={isGeneratingPdf}
                                                            className="px-3 py-1.5 bg-pink-50 hover:bg-pink-100 text-pink-700 font-extrabold text-[10px] uppercase tracking-wider rounded-xl transition-all border border-pink-200/50 flex items-center gap-1.5 ml-auto active:scale-95 cursor-pointer shadow-sm"
                                                            title="Baixar Comprovante PDF"
                                                        >
                                                            <FileDown className="w-3.5 h-3.5 text-pink-600" />
                                                            Comprovante
                                                        </button>
                                                    ) : (
                                                        <span className="text-slate-300 text-[10px] font-mono">—</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center">
                            <Activity className="w-12 h-12 mb-2 opacity-20 text-slate-500" />
                            <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">Nenhuma operação encontrada</h4>
                            <p className="text-[10px] text-slate-400 mt-1 font-medium max-w-sm">
                                Não encontramos registros de operações que correspondam aos filtros selecionados.
                            </p>
                        </div>
                    )}
                </div>
            </div>
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

                    {/* Listagem Completa de Medicamentos da RENAME abaixo das métricas */}
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden mt-6">
                        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div>
                                <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                                    <Package className="w-4 h-4 text-pink-600" />
                                    Listagem Geral de Medicamentos da RENAME (CBAF, CESAF, CEAF)
                                </h4>
                                <p className="text-[10px] font-bold uppercase text-slate-400 mt-0.5 tracking-wider">
                                    Exibindo {renameFilteredList.length} medicamentos cadastrados nas categorias essenciais
                                </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                                <div className="relative flex-1 md:w-64">
                                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                                    <input
                                        type="text"
                                        placeholder="Buscar medicamento ou princípio ativo..."
                                        value={renameSearch}
                                        onChange={e => setRenameSearch(e.target.value)}
                                        className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:border-pink-500 outline-none transition-all"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Filtros por Categoria e Status */}
                        <div className="p-4 bg-slate-50/30 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar">
                                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider mr-1">Categoria:</span>
                                {[
                                    { id: 'TODOS', label: 'Todas' },
                                    { id: 'CBAF', label: 'Básico (CBAF)' },
                                    { id: 'CESAF', label: 'Estratégico (CESAF)' },
                                    { id: 'CEAF', label: 'Especializado (CEAF)' }
                                ].map(cat => (
                                    <button
                                        key={cat.id}
                                        onClick={() => setRenameCategoryFilter(cat.id as any)}
                                        className={`px-3 py-1 rounded-lg text-[10px] font-extrabold uppercase transition-all cursor-pointer ${
                                            renameCategoryFilter === cat.id
                                                ? 'bg-slate-800 text-white shadow-sm'
                                                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                                        }`}
                                    >
                                        {cat.label}
                                    </button>
                                ))}
                            </div>

                            <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar">
                                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider mr-1">Status:</span>
                                {[
                                    { id: 'TODOS', label: 'Todos' },
                                    { id: 'DISPONIVEL', label: 'Disponível' },
                                    { id: 'BAIXO', label: 'Estoque Baixo' },
                                    { id: 'ZERADO', label: 'Zerado' }
                                ].map(st => (
                                    <button
                                        key={st.id}
                                        onClick={() => setRenameStatusFilter(st.id as any)}
                                        className={`px-3 py-1 rounded-lg text-[10px] font-extrabold uppercase transition-all cursor-pointer ${
                                            renameStatusFilter === st.id
                                                ? 'bg-pink-600 text-white shadow-sm'
                                                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                                        }`}
                                    >
                                        {st.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Tabela RENAME */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse min-w-[700px]">
                                <thead>
                                    <tr className="border-b border-slate-100 text-slate-400 text-[10px] font-black uppercase tracking-wider bg-slate-50/50">
                                        <th className="p-4">Medicamento</th>
                                        <th className="p-4">Princípio Ativo</th>
                                        <th className="p-4">Categoria / Componente</th>
                                        <th className="p-4 text-center">Lote / Validade</th>
                                        <th className="p-4 text-center">Estoque Atual</th>
                                        <th className="p-4 text-center">Status</th>
                                        <th className="p-4 text-center">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {renameFilteredList.length > 0 ? (
                                        renameFilteredList.map(med => (
                                            <tr key={med.id} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="p-4">
                                                    <div className="font-extrabold text-slate-800 text-xs uppercase">{med.nome}</div>
                                                    {med.dosagem && <div className="text-[10px] text-slate-400 font-semibold">{med.dosagem} {med.tipo ? `• ${med.tipo}` : ''}</div>}
                                                </td>
                                                <td className="p-4">
                                                    <span className="text-xs font-bold text-slate-600 uppercase">
                                                        {med.principio_ativo || '—'}
                                                    </span>
                                                </td>
                                                <td className="p-4">
                                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[9px] font-black uppercase border ${
                                                        med.categoria === 'CBAF'
                                                            ? 'bg-pink-50 text-pink-700 border-pink-200'
                                                            : med.categoria === 'CESAF'
                                                            ? 'bg-purple-50 text-purple-700 border-purple-200'
                                                            : 'bg-blue-50 text-blue-700 border-blue-200'
                                                    }`}>
                                                        {med.categoria === 'CBAF' && 'Componente Básico (CBAF)'}
                                                        {med.categoria === 'CESAF' && 'Componente Estratégico (CESAF)'}
                                                        {med.categoria === 'CEAF' && 'Componente Especializado (CEAF)'}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-center">
                                                    <div className="text-xs font-bold text-slate-700">{med.lote || 'S/L'}</div>
                                                    <div className="text-[10px] text-slate-400 font-semibold">{med.validade ? format(parseISO(med.validade), 'dd/MM/yyyy') : '—'}</div>
                                                </td>
                                                <td className="p-4 text-center">
                                                    <span className={`inline-flex items-center px-3 py-1 rounded-xl text-xs font-black ${
                                                        med.quantidade === 0 
                                                            ? 'bg-rose-100 text-rose-700 border border-rose-200' 
                                                            : med.quantidade <= med.limite_minimo 
                                                            ? 'bg-amber-100 text-amber-700 border border-amber-200' 
                                                            : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                                    }`}>
                                                        {med.quantidade} un
                                                    </span>
                                                </td>
                                                <td className="p-4 text-center">
                                                    {med.quantidade === 0 ? (
                                                        <span className="text-[9px] font-black uppercase tracking-wider text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-100">Zerado</span>
                                                    ) : med.quantidade <= med.limite_minimo ? (
                                                        <span className="text-[9px] font-black uppercase tracking-wider text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-100">Estoque Baixo</span>
                                                    ) : (
                                                        <span className="text-[9px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">Disponível</span>
                                                    )}
                                                </td>
                                                <td className="p-4 text-center relative">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setActiveMenuMedId(activeMenuMedId === med.id ? null : med.id);
                                                        }}
                                                        className="p-2 rounded-xl text-slate-400 hover:text-pink-600 hover:bg-pink-50 transition-all cursor-pointer font-bold border border-transparent hover:border-pink-100"
                                                        title="Opções do medicamento"
                                                    >
                                                        <MoreVertical className="w-4 h-4" />
                                                    </button>

                                                    {activeMenuMedId === med.id && (
                                                        <>
                                                            <div 
                                                                className="fixed inset-0 z-40" 
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setActiveMenuMedId(null);
                                                                }} 
                                                            />
                                                            <div className="absolute right-4 top-12 z-50 min-w-[210px] bg-white border border-slate-200 rounded-2xl shadow-xl p-1.5 animate-in fade-in slide-in-from-top-1 duration-100 text-left">
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleMoveToAltoCusto(med);
                                                                    }}
                                                                    className="w-full px-3.5 py-2.5 text-xs font-black text-slate-700 hover:bg-amber-50 hover:text-amber-700 rounded-xl flex items-center gap-2.5 transition-colors cursor-pointer"
                                                                >
                                                                    <Activity className="w-4 h-4 text-amber-500 shrink-0" />
                                                                    <span>Mover para ALTO CUSTO</span>
                                                                </button>
                                                            </div>
                                                        </>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={6} className="p-8 text-center text-slate-400 text-xs font-bold uppercase tracking-wider">
                                                Nenhum medicamento encontrado nos critérios selecionados.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'alto-custo' && (
                <div className="space-y-6">
                    {/* Header Card com botão de Inserir */}
                    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                                <Package className="w-6 h-6 text-pink-600" />
                                Medicamentos de Alto Custo
                            </h3>
                            <p className="text-slate-500 text-xs font-semibold mt-1">
                                Espaço exclusivo para cadastro, lançamento e gerenciamento da listagem de medicamentos de alto custo.
                            </p>
                        </div>
                        <button
                            onClick={() => {
                                setAcNome('');
                                setAcPrincipioAtivo('');
                                setAcTipo('Comprimido');
                                setAcDosagem('');
                                setAcCategoria('CEAF');
                                setAcLote('S/L');
                                setAcValidade('2099-12-31');
                                setAcQuantidade('0');
                                setAcLimiteMinimo('10');
                                setIsAltoCustoModalOpen(true);
                            }}
                            className="px-5 py-3 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg shadow-pink-500/20 transition-all flex items-center gap-2 shrink-0 active:scale-95 cursor-pointer"
                        >
                            <Plus className="w-4 h-4" />
                            Inserir Medicamento de Alto Custo
                        </button>
                    </div>

                    {/* Barra de Busca e Resumo */}
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                        <div className="relative w-full md:w-96">
                            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                            <input
                                type="text"
                                placeholder="Buscar por nome ou princípio ativo..."
                                value={altoCustoSearch}
                                onChange={e => setAltoCustoSearch(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-pink-500 outline-none transition-all"
                            />
                        </div>

                        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                            <span className="px-3 py-1.5 rounded-xl text-xs font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                                {altoCustoStats.disponivel} Em Estoque
                            </span>
                            <span className="px-3 py-1.5 rounded-xl text-xs font-black uppercase bg-rose-50 text-rose-700 border border-rose-200/60">
                                {altoCustoStats.zerados} Zerados
                            </span>
                            <span className="px-3 py-1.5 rounded-xl text-xs font-black uppercase bg-slate-100 text-slate-700 border border-slate-200">
                                Total: {altoCustoStats.total}
                            </span>
                        </div>
                    </div>

                    {/* Tabela de Listagem Completa de Medicamentos de Alto Custo */}
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                            <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider">
                                Listagem de Medicamentos de Alto Custo ({altoCustoFilteredList.length})
                            </h4>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse min-w-[700px]">
                                <thead>
                                    <tr className="border-b border-slate-100 text-slate-400 text-[10px] font-black uppercase tracking-wider bg-slate-50/50">
                                        <th className="p-4">Medicamento</th>
                                        <th className="p-4">Princípio Ativo</th>
                                        <th className="p-4">Categoria / Forma</th>
                                        <th className="p-4 text-center">Lote / Validade</th>
                                        <th className="p-4 text-center">Estoque Atual</th>
                                        <th className="p-4 text-center">Status</th>
                                        <th className="p-4 text-center">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {altoCustoFilteredList.length > 0 ? (
                                        altoCustoFilteredList.map(med => (
                                            <tr key={med.id} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="p-4">
                                                    <div className="font-extrabold text-slate-800 text-xs uppercase">{med.nome}</div>
                                                    {med.dosagem && <div className="text-[10px] text-slate-400 font-semibold">{med.dosagem}</div>}
                                                </td>
                                                <td className="p-4">
                                                    <span className="text-xs font-bold text-slate-600 uppercase">
                                                        {med.principio_ativo || '—'}
                                                    </span>
                                                </td>
                                                <td className="p-4">
                                                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[9px] font-black uppercase bg-pink-50 text-pink-700 border border-pink-100">
                                                        {med.categoria}
                                                    </span>
                                                    {med.tipo && <span className="text-xs text-slate-500 font-semibold ml-2">{med.tipo}</span>}
                                                </td>
                                                <td className="p-4 text-center">
                                                    <div className="text-xs font-bold text-slate-700">{med.lote || 'S/L'}</div>
                                                    <div className="text-[10px] text-slate-400 font-semibold">{med.validade ? format(parseISO(med.validade), 'dd/MM/yyyy') : '—'}</div>
                                                </td>
                                                <td className="p-4 text-center">
                                                    <span className={`inline-flex items-center px-3 py-1 rounded-xl text-xs font-black ${
                                                        med.quantidade === 0 
                                                            ? 'bg-rose-100 text-rose-700 border border-rose-200' 
                                                            : med.quantidade <= med.limite_minimo 
                                                            ? 'bg-amber-100 text-amber-700 border border-amber-200' 
                                                            : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                                    }`}>
                                                        {med.quantidade} un
                                                    </span>
                                                </td>
                                                <td className="p-4 text-center">
                                                    {med.quantidade === 0 ? (
                                                        <span className="text-[9px] font-black uppercase tracking-wider text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-100">Zerado</span>
                                                    ) : med.quantidade <= med.limite_minimo ? (
                                                        <span className="text-[9px] font-black uppercase tracking-wider text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-100">Estoque Baixo</span>
                                                    ) : (
                                                        <span className="text-[9px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">Disponível</span>
                                                    )}
                                                </td>
                                                <td className="p-4 text-center relative">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setActiveMenuMedId(activeMenuMedId === med.id ? null : med.id);
                                                        }}
                                                        className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all cursor-pointer font-bold border border-transparent hover:border-rose-100"
                                                        title="Opções do medicamento"
                                                    >
                                                        <MoreVertical className="w-4 h-4" />
                                                    </button>

                                                    {activeMenuMedId === med.id && (
                                                        <>
                                                            <div 
                                                                className="fixed inset-0 z-40" 
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setActiveMenuMedId(null);
                                                                }} 
                                                            />
                                                            <div className="absolute right-4 top-12 z-50 min-w-[210px] bg-white border border-slate-200 rounded-2xl shadow-xl p-1.5 animate-in fade-in slide-in-from-top-1 duration-100 text-left">
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleRemoveFromAltoCusto(med);
                                                                    }}
                                                                    className="w-full px-3.5 py-2.5 text-xs font-black text-slate-700 hover:bg-rose-50 hover:text-rose-700 rounded-xl flex items-center gap-2.5 transition-colors cursor-pointer"
                                                                >
                                                                    <X className="w-4 h-4 text-rose-500 shrink-0" />
                                                                    <span>Remover de ALTO CUSTO</span>
                                                                </button>
                                                            </div>
                                                        </>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={6} className="p-12 text-center">
                                                <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                                                    <div className="w-12 h-12 rounded-2xl bg-pink-50 text-pink-500 flex items-center justify-center mb-3">
                                                        <Package className="w-6 h-6" />
                                                    </div>
                                                    <h5 className="font-extrabold text-slate-800 text-sm uppercase mb-1">Nenhum Medicamento de Alto Custo Encontrado</h5>
                                                    <p className="text-slate-400 text-xs font-medium mb-4">
                                                        Cadastre medicamentos marcados como Alto Custo para visualizá-los e gerenciá-los nesta lista.
                                                    </p>
                                                    <button
                                                        onClick={() => {
                                                            setAcNome('');
                                                            setAcPrincipioAtivo('');
                                                            setAcTipo('Comprimido');
                                                            setAcDosagem('');
                                                            setAcCategoria('CEAF');
                                                            setAcLote('S/L');
                                                            setAcValidade('2099-12-31');
                                                            setAcQuantidade('0');
                                                            setAcLimiteMinimo('10');
                                                            setIsAltoCustoModalOpen(true);
                                                        }}
                                                        className="px-4 py-2.5 bg-pink-600 hover:bg-pink-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
                                                    >
                                                        <Plus className="w-4 h-4" />
                                                        Inserir Primeiro Medicamento de Alto Custo
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Cadastro de Medicamento de Alto Custo */}
            {isAltoCustoModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200/50 flex flex-col animate-in zoom-in-95 duration-200">
                        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <div>
                                <h3 className="font-black text-pink-600 uppercase text-lg tracking-wide flex items-center gap-2">
                                    <Plus className="w-5 h-5" />
                                    Cadastrar Medicamento de Alto Custo
                                </h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Preencha os dados do medicamento especial de alto custo</p>
                            </div>
                            <button onClick={() => setIsAltoCustoModalOpen(false)} className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        
                        <form onSubmit={handleCreateAltoCusto} className="p-6 space-y-4">
                            <div>
                                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Nome do Medicamento *</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="EX: ADALIMUMABE"
                                    value={acNome}
                                    onChange={e => setAcNome(e.target.value)}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 text-sm font-semibold text-slate-900 uppercase focus:bg-white focus:border-pink-500 outline-none transition-all"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Princípio Ativo</label>
                                    <input
                                        type="text"
                                        placeholder="EX: ADALIMUMABE 40MG"
                                        value={acPrincipioAtivo}
                                        onChange={e => setAcPrincipioAtivo(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 text-sm font-semibold text-slate-900 uppercase focus:bg-white focus:border-pink-500 outline-none transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Forma Farmacêutica *</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="EX: Solução Injetável, Comprimido..."
                                        value={acTipo}
                                        onChange={e => setAcTipo(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 text-sm font-semibold text-slate-900 focus:bg-white focus:border-pink-500 outline-none transition-all"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Dosagem (Ex: 40mg, 100mg/mL)</label>
                                    <input
                                        type="text"
                                        placeholder="EX: 40mg"
                                        value={acDosagem}
                                        onChange={e => setAcDosagem(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 text-sm font-semibold text-slate-900 focus:bg-white focus:border-pink-500 outline-none transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Categoria *</label>
                                    <select
                                        value={acCategoria}
                                        onChange={e => setAcCategoria(e.target.value as any)}
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 text-sm font-semibold text-slate-900 focus:bg-white focus:border-pink-500 outline-none transition-all cursor-pointer"
                                    >
                                        <option value="CEAF">Componente Especializado (CEAF)</option>
                                        <option value="CESAF">Componente Estratégico (CESAF)</option>
                                        <option value="CBAF">Componente Básico (CBAF)</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Lote</label>
                                    <input
                                        type="text"
                                        placeholder="EX: LOTE123"
                                        value={acLote}
                                        onChange={e => setAcLote(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 text-sm font-semibold text-slate-900 uppercase focus:bg-white focus:border-pink-500 outline-none transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Validade</label>
                                    <input
                                        type="date"
                                        value={acValidade}
                                        onChange={e => setAcValidade(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 text-sm font-semibold text-slate-900 focus:bg-white focus:border-pink-500 outline-none transition-all"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Quantidade Inicial em Estoque</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={acQuantidade}
                                        onChange={e => setAcQuantidade(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 text-sm font-semibold text-slate-900 focus:bg-white focus:border-pink-500 outline-none transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Limite Mínimo (Alerta)</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={acLimiteMinimo}
                                        onChange={e => setAcLimiteMinimo(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 text-sm font-semibold text-slate-900 focus:bg-white focus:border-pink-500 outline-none transition-all"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={acSaving}
                                className="w-full py-3.5 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-md active:scale-98 mt-2 cursor-pointer"
                            >
                                {acSaving ? 'Salvando...' : 'Cadastrar Medicamento de Alto Custo'}
                            </button>
                        </form>
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

            {printingMov && (
                <FarmaciaPdfGenerator
                    movimentacaoId={printingMov.id}
                    pacienteNome={printingMov.paciente_nome || 'N/I'}
                    pacienteCpf={printingMov.paciente_cpf || ''}
                    medicamentoNome={printingMov.medicamento_nome}
                    medicamentoCategoria={printingMov.medicamento_categoria}
                    medicamentoDosagem={printingMov.medicamento_dosagem}
                    medicamentoTipo={printingMov.medicamento_tipo}
                    lote={printingMov.lote}
                    quantidade={printingMov.quantidade}
                    unidade={
                        (() => {
                            const m = medicamentos.find(med => med.id === printingMov.medicamento_id);
                            return m?.unidade || 'Unidade';
                        })()
                    }
                    data={printingMov.data}
                    observacoes={printingMov.observacoes}
                    currentUser={currentUser}
                    state={{
                        branding: { title: 'Prefeitura Integrada' }
                    } as any}
                />
            )}
        </div>
    );
};
