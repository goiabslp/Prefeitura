import React, { useState, useEffect, useMemo } from 'react';
import { User, FarmaciaMedicamento, FarmaciaMovimentacao } from '../../types';
import * as db from '../../services/farmaciaService';
import {
    ArrowLeft, TrendingUp, TrendingDown, Users, Package, AlertTriangle, Activity, 
    Calendar, CheckCircle2, AlertCircle, ShoppingCart, Info, PieChart, FileDown,
    Plus, Search, X, MoreVertical, Settings, Sparkles, Brain, Clock, Flame, Thermometer, Zap
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    LineChart, Line, PieChart as RechartsPieChart, Pie, Cell
} from 'recharts';
import { startOfMonth, endOfMonth, subMonths, isWithinInterval, parseISO, format, formatDistanceToNow, differenceInDays, startOfWeek, endOfWeek, startOfDay, endOfDay } from 'date-fns';
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
    const [globalAlertPercentage, setGlobalAlertPercentage] = useState<number>(20);
    const [savingConfig, setSavingConfig] = useState(false);
    const [configSearch, setConfigSearch] = useState('');
    const [loading, setLoading] = useState(true);

    // Estado para filtro de período do Horário de Pico (Temperatura de Atendimento)
    const [peakHoursPeriod, setPeakHoursPeriod] = useState<'today' | 'current_week' | '30_days' | 'current_month' | 'all'>('30_days');
    const [hoveredPeakCell, setHoveredPeakCell] = useState<{ dayLabel: string; hour: number; count: number } | null>(null);

    // Estados para o Modal de IA Preditiva de Estoque
    const [selectedIAMed, setSelectedIAMed] = useState<any | null>(null);
    const [isIAModalOpen, setIsIAModalOpen] = useState(false);

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
            const [medData, movData, alertPct] = await Promise.all([
                db.getMedicamentos(),
                db.getMovimentacoes(),
                db.getGlobalAlertPercentage()
            ]);
            setMedicamentos(medData);
            setMovimentacoes(movData);
            setGlobalAlertPercentage(alertPct);
        } catch (error) {
            console.error('Erro ao carregar dados do dashboard:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveConfig = async () => {
        setSavingConfig(true);
        try {
            const success = await db.saveGlobalAlertPercentage(globalAlertPercentage);
            if (success) {
                addNotification('Sucesso', `Porcentagem de alerta atualizada para ${globalAlertPercentage}%.`, 'success');
            } else {
                addNotification('Aviso', 'Configuração salva localmente.', 'info');
            }
        } catch (error) {
            console.error('Erro ao salvar porcentagem de alerta:', error);
            addNotification('Erro', 'Falha ao salvar configuração.', 'error');
        } finally {
            setSavingConfig(false);
        }
    };

    const configPreviewList = useMemo(() => {
        // Agrupamento de medicamentos por Nome + Dosagem + Tipo
        const groups: Record<string, {
            id: string;
            nome: string;
            dosagem?: string;
            tipo?: string;
            categoria: string;
            unidade: string;
            quantidadeTotal: number;
            limite_minimo: number;
            medIds: Set<string>;
        }> = {};

        medicamentos.forEach(med => {
            const groupKey = `${(med.nome || '').trim().toUpperCase()}_${(med.dosagem || '').trim().toUpperCase()}_${(med.tipo || '').trim().toUpperCase()}`;
            if (!groups[groupKey]) {
                groups[groupKey] = {
                    id: med.id,
                    nome: med.nome,
                    dosagem: med.dosagem,
                    tipo: med.tipo,
                    categoria: med.categoria,
                    unidade: med.unidade || 'un',
                    quantidadeTotal: 0,
                    limite_minimo: med.limite_minimo || 0,
                    medIds: new Set()
                };
            }
            groups[groupKey].quantidadeTotal += (med.quantidade || 0);
            groups[groupKey].medIds.add(med.id);
            if (med.limite_minimo && med.limite_minimo > groups[groupKey].limite_minimo) {
                groups[groupKey].limite_minimo = med.limite_minimo;
            }
        });

        // Determina a data limite do dia 05 do ciclo ativo
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        const day = now.getDate();
        const refMonth = day >= 5 ? month : month - 1;
        const targetDay5 = new Date(year, refMonth, 5, 23, 59, 59, 999);

        return Object.values(groups).map(group => {
            const groupMovs = movimentacoes.filter(m => 
                group.medIds.has(m.medicamento_id) || 
                (m.medicamento_nome && m.medicamento_nome.toLowerCase().trim() === group.nome.toLowerCase().trim())
            );

            // Rebobina movimentações que ocorreram APÓS o dia 05 às 23:59:59
            const movsAfterDay5 = groupMovs.filter(m => {
                if (!m.data) return false;
                const d = new Date(m.data);
                return !isNaN(d.getTime()) && d > targetDay5;
            });

            let calculatedDay5Stock = group.quantidadeTotal;
            for (const mov of movsAfterDay5) {
                if (mov.tipo === 'Entrada') {
                    calculatedDay5Stock -= mov.quantidade;
                } else if (mov.tipo === 'Saída') {
                    calculatedDay5Stock += mov.quantidade;
                }
            }

            const estoqueDia05 = calculatedDay5Stock > 0 ? calculatedDay5Stock : Math.max(0, group.quantidadeTotal);

            const thresholdLow = Math.round(estoqueDia05 * (globalAlertPercentage / 100));
            const thresholdCritical = Math.round(thresholdLow / 2);

            // --- CÁLCULO DE INTELIGÊNCIA ARTIFICIAL (IA) ---
            // A IA analisa APENAS medicamentos que contenham estoque > 0. Medicamentos com estoque zerado são ignorados.
            const isEstoqueAtivo = group.quantidadeTotal > 0;

            let consumoDiarioMedio = 0;
            let demandaMensal = 0;
            let estoqueIdealIA = 0;
            let sugestaoCompra = 0;
            let diasCobertura = 999;
            let statusIA: 'SEM_ESTOQUE_CADASTRADO' | 'ANALISANDO' | 'RISCO_DESABASTECIMENTO' | 'RISCO_VENCIMENTO' | 'SUPERESTOCAGEM' | 'EQUILIBRADO' = 'SEM_ESTOQUE_CADASTRADO';
            let parecerIA = '';

            if (!isEstoqueAtivo) {
                statusIA = 'SEM_ESTOQUE_CADASTRADO';
                parecerIA = 'Medicamento sem estoque cadastrado no sistema (saldo 0). A análise por IA será iniciada automaticamente assim que for adicionado novo estoque.';
            } else {
                // Verifica a data da primeira movimentação/entrada para contar o período de 3 meses
                let primeiraMovData: Date | null = null;
                if (groupMovs.length > 0) {
                    const dates = groupMovs.map(m => new Date(m.data).getTime()).filter(t => !isNaN(t));
                    if (dates.length > 1) {
                        primeiraMovData = new Date(Math.min(...dates));
                    }
                }

                let diasDecorridos = 0;
                let mesesDecorridos = 0;
                if (primeiraMovData) {
                    const diffMs = now.getTime() - primeiraMovData.getTime();
                    diasDecorridos = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
                    mesesDecorridos = Math.floor(diasDecorridos / 30);
                }

                const emAnalise3Meses = mesesDecorridos < 3;

                if (emAnalise3Meses) {
                    const mesAtualAnalise = Math.min(3, mesesDecorridos + 1);
                    statusIA = 'ANALISANDO';
                    parecerIA = `Em período inicial de aprendizado da IA (Mês ${mesAtualAnalise} de 3). O algoritmo está acumulando o histórico de retiradas entre o dia 01 e o último dia do mês. O Estoque Ideal IA será liberado após o término dos 3 meses.`;
                } else {
                    // Após 3 meses concluídos: calcula o consumo médio trimestral e atualiza mensalmente
                    const saidaMovs = groupMovs.filter(m => m.tipo === 'Saída');
                    const totalSaidas = saidaMovs.reduce((acc, m) => acc + (m.quantidade || 0), 0);

                    let periodoDias = 90; // Janela trimestral de aprendizado concluída
                    if (saidaMovs.length > 1) {
                        const dates = saidaMovs.map(m => new Date(m.data).getTime()).filter(t => !isNaN(t));
                        if (dates.length > 1) {
                            const minDate = Math.min(...dates);
                            const maxDate = Math.max(...dates);
                            const diffDays = Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24));
                            periodoDias = Math.max(90, diffDays);
                        }
                    }

                    consumoDiarioMedio = totalSaidas > 0 ? (totalSaidas / periodoDias) : 0;
                    demandaMensal = Math.round(consumoDiarioMedio * 30);

                    // Estoque Mensal Ideal IA (Demanda Mensal + 20% Margem de Segurança)
                    if (demandaMensal > 0) {
                        estoqueIdealIA = Math.round(demandaMensal * 1.20);
                    } else {
                        estoqueIdealIA = Math.max(group.quantidadeTotal, group.limite_minimo ? group.limite_minimo * 2 : 10);
                    }

                    sugestaoCompra = Math.max(0, estoqueIdealIA - group.quantidadeTotal);
                    diasCobertura = consumoDiarioMedio > 0 ? Math.round(group.quantidadeTotal / consumoDiarioMedio) : 999;

                    // Análise de Vencimento dos Lotes
                    const lotesDoMed = medicamentos.filter(med => 
                        (med.nome || '').trim().toUpperCase() === group.nome.toUpperCase() &&
                        (med.dosagem || '').trim().toUpperCase() === (group.dosagem || '').toUpperCase()
                    );

                    let menorValidade: Date | null = null;
                    lotesDoMed.forEach(l => {
                        if (l.validade && l.quantidade > 0) {
                            const valDate = new Date(l.validade);
                            if (!isNaN(valDate.getTime())) {
                                if (!menorValidade || valDate < menorValidade) {
                                    menorValidade = valDate;
                                }
                            }
                        }
                    });

                    let diasAteVencer = 999;
                    let temRiscoVencimento = false;
                    let unidadesEmRiscoVencimento = 0;

                    if (menorValidade) {
                        diasAteVencer = Math.max(0, Math.ceil((menorValidade.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
                        if (diasAteVencer <= 90 && consumoDiarioMedio > 0) {
                            const consumoAteVencer = Math.round(consumoDiarioMedio * diasAteVencer);
                            if (group.quantidadeTotal > consumoAteVencer) {
                                temRiscoVencimento = true;
                                unidadesEmRiscoVencimento = group.quantidadeTotal - consumoAteVencer;
                            }
                        }
                    }

                    if (diasCobertura < 10 && consumoDiarioMedio > 0) {
                        statusIA = 'RISCO_DESABASTECIMENTO';
                        parecerIA = `Atenção Crítica: Estoque atual cobre aproximadamente ${diasCobertura} dias de uso. Recomenda-se comprar ${sugestaoCompra} ${group.unidade}.`;
                    } else if (temRiscoVencimento) {
                        statusIA = 'RISCO_VENCIMENTO';
                        parecerIA = `Alerta de Validade: Aproximadamente ${unidadesEmRiscoVencimento} ${group.unidade} correm risco de vencer em ${diasAteVencer} dias antes de serem dispensadas no ritmo atual.`;
                    } else if (group.quantidadeTotal > estoqueIdealIA * 2 && group.quantidadeTotal > 50) {
                        statusIA = 'SUPERESTOCAGEM';
                        parecerIA = `Superestocagem: O saldo atual cobre cerca de ${diasCobertura} dias de uso. Pausar compras para evitar imobilização de recursos.`;
                    } else {
                        statusIA = 'EQUILIBRADO';
                        parecerIA = `Estoque Equilibrado: O saldo atual de ${group.quantidadeTotal} ${group.unidade} atende com segurança a demanda estimada do mês.`;
                    }
                }
            }

            return {
                id: group.id,
                nome: group.nome,
                dosagem: group.dosagem,
                tipo: group.tipo,
                categoria: group.categoria,
                unidade: group.unidade,
                quantidade: group.quantidadeTotal,
                estoqueDia05,
                thresholdLow,
                thresholdCritical,
                consumoDiarioMedio,
                demandaMensal,
                estoqueIdealIA,
                sugestaoCompra,
                diasCobertura,
                statusIA,
                parecerIA,
                isEstoqueAtivo
            };
        }).filter(med => {
            // Oculta da tela medicamentos sem análise (estoque === 0)
            if (!med.isEstoqueAtivo) return false;

            if (!configSearch.trim()) return true;
            const q = configSearch.toLowerCase().trim();
            return (
                med.nome?.toLowerCase().includes(q) ||
                med.categoria?.toLowerCase().includes(q) ||
                med.dosagem?.toLowerCase().includes(q) ||
                (med.tipo && med.tipo.toLowerCase().includes(q))
            );
        }).sort((a, b) => a.nome.localeCompare(b.nome));
    }, [medicamentos, movimentacoes, globalAlertPercentage, configSearch]);

    // Resumo Preditivo KPI da IA (analisa APENAS medicamentos que contenham estoque > 0)
    const iaKpiSummary = useMemo(() => {
        let totalSugestaoCompra = 0;
        let qtdRiscoDesabastecimento = 0;
        let qtdRiscoVencimento = 0;
        let qtdEquilibrados = 0;

        configPreviewList.forEach(item => {
            if (item.quantidade > 0) {
                totalSugestaoCompra += item.sugestaoCompra;
                if (item.statusIA === 'RISCO_DESABASTECIMENTO') {
                    qtdRiscoDesabastecimento++;
                } else if (item.statusIA === 'RISCO_VENCIMENTO') {
                    qtdRiscoVencimento++;
                } else if (item.statusIA === 'EQUILIBRADO') {
                    qtdEquilibrados++;
                }
            }
        });

        return {
            totalSugestaoCompra,
            qtdRiscoDesabastecimento,
            qtdRiscoVencimento,
            qtdEquilibrados
        };
    }, [configPreviewList]);

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
        const handleConfigChange = () => {
            db.getGlobalAlertPercentage().then(pct => setGlobalAlertPercentage(pct));
        };

        window.addEventListener('farmacia-medicamentos-changed', handleRealtimeChange);
        window.addEventListener('farmacia-movimentacoes-changed', handleRealtimeChange);
        window.addEventListener('farmacia-config-changed', handleConfigChange);

        return () => {
            window.removeEventListener('farmacia-medicamentos-changed', handleRealtimeChange);
            window.removeEventListener('farmacia-movimentacoes-changed', handleRealtimeChange);
            window.removeEventListener('farmacia-config-changed', handleConfigChange);
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

    // Helper para identificar movimentações de Saída com flexibilidade de caracteres
    const isSaidaTipo = (tipoStr?: string) => {
        if (!tipoStr) return false;
        const normalized = tipoStr.trim().toLowerCase();
        return normalized === 'saída' || normalized === 'saida';
    };

    // Parsing robusto de data para movimentações e medicamentos (priorizando formato brasileiro DD/MM/YYYY, ISO e variações)
    const parseMovimentacaoDate = (dateStr?: string | Date | null): Date | null => {
        if (!dateStr) return null;
        if (dateStr instanceof Date) return isNaN(dateStr.getTime()) ? null : dateStr;
        try {
            const str = String(dateStr).trim();
            if (!str) return null;

            // Prioridade 1: Formato brasileiro com barras (DD/MM/YYYY ou DD/MM/YYYY HH:mm:ss)
            if (str.includes('/')) {
                const parts = str.split(' ');
                const dateParts = parts[0].split('/');
                if (dateParts.length === 3) {
                    const day = parseInt(dateParts[0], 10);
                    const month = parseInt(dateParts[1], 10) - 1; // Mês 0-indexed
                    const year = parseInt(dateParts[2], 10);
                    let hours = 0, minutes = 0, seconds = 0;
                    if (parts[1]) {
                        const timeParts = parts[1].split(':');
                        hours = parseInt(timeParts[0], 10) || 0;
                        minutes = parseInt(timeParts[1], 10) || 0;
                        seconds = parseInt(timeParts[2], 10) || 0;
                    }
                    const parsedDate = new Date(year, month, day, hours, minutes, seconds);
                    if (!isNaN(parsedDate.getTime())) return parsedDate;
                } else if (dateParts.length === 2) {
                    // MM/YYYY
                    const month = parseInt(dateParts[0], 10) - 1;
                    const year = parseInt(dateParts[1], 10);
                    const parsedDate = new Date(year, month, 1);
                    if (!isNaN(parsedDate.getTime())) return parsedDate;
                }
            }

            // Prioridade 2: Formato YYYY-MM
            if (/^\d{4}-\d{2}$/.test(str)) {
                const parts = str.split('-');
                const parsedDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, 1);
                if (!isNaN(parsedDate.getTime())) return parsedDate;
            }

            // Prioridade 3: Formato ISO (YYYY-MM-DD ou YYYY-MM-DDTHH:mm:ss)
            const isoParsed = parseISO(str);
            if (!isNaN(isoParsed.getTime())) return isoParsed;

            // Prioridade 4: Instanciação direta
            const directDate = new Date(str);
            if (!isNaN(directDate.getTime())) return directDate;

            return null;
        } catch {
            return null;
        }
    };

    // Formatação de data 100% resiliente contra RangeError: Invalid time value
    const formatSafeDate = (dateVal?: string | Date | null, formatStr: string = 'dd/MM/yyyy'): string => {
        if (!dateVal) return '—';
        try {
            const parsed = parseMovimentacaoDate(dateVal);
            if (!parsed || isNaN(parsed.getTime())) {
                const str = String(dateVal).trim();
                return str.length > 0 && str.length <= 25 ? str : '—';
            }
            return format(parsed, formatStr);
        } catch {
            const str = String(dateVal).trim();
            return str.length > 0 && str.length <= 25 ? str : '—';
        }
    };

    const formatSafeDistanceToNow = (dateVal?: string | Date | null): string => {
        if (!dateVal) return '';
        try {
            const parsed = parseMovimentacaoDate(dateVal);
            if (!parsed || isNaN(parsed.getTime())) return '';
            return formatDistanceToNow(parsed, { addSuffix: true, locale: ptBR });
        } catch {
            return '';
        }
    };

    // Todas as movimentações de Saída
    const allSaidaMovimentacoes = useMemo(() => {
        return movimentacoes.filter(m => isSaidaTipo(m.tipo));
    }, [movimentacoes]);

    // Dispensações do mês atual e mês anterior
    const currentMonthDispenses = useMemo(() => {
        return movimentacoes.filter(m => {
            if (!isSaidaTipo(m.tipo) || !m.data) return false;
            const dateObj = parseMovimentacaoDate(m.data);
            if (!dateObj) return false;
            return isWithinInterval(dateObj, { start: currentMonthStart, end: currentMonthEnd });
        });
    }, [movimentacoes, currentMonthStart, currentMonthEnd]);

    const lastMonthDispenses = useMemo(() => {
        return movimentacoes.filter(m => {
            if (!isSaidaTipo(m.tipo) || !m.data) return false;
            const dateObj = parseMovimentacaoDate(m.data);
            if (!dateObj) return false;
            return isWithinInterval(dateObj, { start: lastMonthStart, end: lastMonthEnd });
        });
    }, [movimentacoes, lastMonthStart, lastMonthEnd]);

    // KPI 1: Total Medicamentos Entregues
    const totalMedsCurrentMonth = useMemo(() => {
        return currentMonthDispenses.reduce((acc, curr) => acc + (curr.quantidade || 0), 0);
    }, [currentMonthDispenses]);

    const totalMedsAllTime = useMemo(() => {
        return allSaidaMovimentacoes.reduce((acc, curr) => acc + (curr.quantidade || 0), 0);
    }, [allSaidaMovimentacoes]);

    const totalMedsLastMonth = useMemo(() => {
        return lastMonthDispenses.reduce((acc, curr) => acc + (curr.quantidade || 0), 0);
    }, [lastMonthDispenses]);

    const varMeds = useMemo(() => {
        if (totalMedsLastMonth === 0) return null;
        return ((totalMedsCurrentMonth - totalMedsLastMonth) / totalMedsLastMonth) * 100;
    }, [totalMedsCurrentMonth, totalMedsLastMonth]);

    // KPI 2: Pacientes Atendidos (Unique CPFs or Names in 'Saída')
    const getUniquePatientsCount = (movs: FarmaciaMovimentacao[]) => {
        const unique = new Set(movs.filter(m => m.paciente_cpf || m.paciente_nome).map(m => (m.paciente_cpf || m.paciente_nome || '').trim().toLowerCase()).filter(Boolean));
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

    // KPI 3: Estoque Crítico e Baixo (baseado no estoque do dia 05 do mês)
    const lowStockAlerts = useMemo(() => {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        const day = now.getDate();
        const refMonth = day >= 5 ? month : month - 1;
        const targetDay5 = new Date(year, refMonth, 5, 23, 59, 59, 999);

        return medicamentos.filter(med => {
            if (med.quantidade === 0 && med.lote === 'LOTE-INICIAL') return false;

            const medMovs = movimentacoes.filter(m => m.medicamento_id === med.id);
            const movsAfterDay5 = medMovs.filter(m => {
                if (!m.data) return false;
                const d = new Date(m.data);
                return !isNaN(d.getTime()) && d > targetDay5;
            });

            let calculatedDay5Stock = med.quantidade;
            for (const mov of movsAfterDay5) {
                if (mov.tipo === 'Entrada') {
                    calculatedDay5Stock -= mov.quantidade;
                } else if (mov.tipo === 'Saída') {
                    calculatedDay5Stock += mov.quantidade;
                }
            }

            const estoqueDia05 = calculatedDay5Stock > 0 ? calculatedDay5Stock : Math.max(0, med.quantidade);
            const thresholdLow = Math.round(estoqueDia05 * (globalAlertPercentage / 100));
            return med.quantidade <= thresholdLow;
        });
    }, [medicamentos, movimentacoes, globalAlertPercentage]);

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

    // Métrica: Horário de Pico (Temperatura de Atendimento) - Matriz 7x24 (Dias da Semana x 24h)
    const peakHoursData = useMemo(() => {
        const matrix: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
        
        let filteredMovs = movimentacoes.filter(m => isSaidaTipo(m.tipo) && m.data);

        const nowDate = new Date();
        if (peakHoursPeriod === 'today') {
            const todayStart = startOfDay(nowDate);
            const todayEnd = endOfDay(nowDate);
            filteredMovs = filteredMovs.filter(m => {
                const d = parseMovimentacaoDate(m.data);
                return d && isWithinInterval(d, { start: todayStart, end: todayEnd });
            });
        } else if (peakHoursPeriod === 'current_week') {
            const weekStart = startOfWeek(nowDate, { weekStartsOn: 0 });
            const weekEnd = endOfWeek(nowDate, { weekStartsOn: 0 });
            filteredMovs = filteredMovs.filter(m => {
                const d = parseMovimentacaoDate(m.data);
                return d && isWithinInterval(d, { start: weekStart, end: weekEnd });
            });
        } else if (peakHoursPeriod === 'current_month') {
            filteredMovs = currentMonthDispenses;
        } else if (peakHoursPeriod === '30_days') {
            const thirtyDaysAgo = subMonths(nowDate, 1);
            filteredMovs = filteredMovs.filter(m => {
                const d = parseMovimentacaoDate(m.data);
                return d && d >= thirtyDaysAgo;
            });
        }

        let maxCount = 0;
        let totalDispenseEvents = 0;
        let peakSlot = { dayIndex: 1, hour: 10, count: 0 };
        const dayTotals = Array(7).fill(0);
        const hourTotals = Array(24).fill(0);

        filteredMovs.forEach(m => {
            const d = parseMovimentacaoDate(m.data);
            if (!d) return;
            const day = d.getDay(); // 0=Dom, 1=Seg...
            const hour = d.getHours(); // 0..23

            matrix[day][hour] += 1;
            dayTotals[day] += 1;
            hourTotals[hour] += 1;
            totalDispenseEvents += 1;

            if (matrix[day][hour] > maxCount) {
                maxCount = matrix[day][hour];
                peakSlot = { dayIndex: day, hour, count: matrix[day][hour] };
            }
        });

        const daysConfig = [
            { index: 1, label: 'Segunda-feira', short: 'Seg' },
            { index: 2, label: 'Terça-feira', short: 'Ter' },
            { index: 3, label: 'Quarta-feira', short: 'Qua' },
            { index: 4, label: 'Quinta-feira', short: 'Qui' },
            { index: 5, label: 'Sexta-feira', short: 'Sex' },
            { index: 6, label: 'Sábado', short: 'Sáb' },
            { index: 0, label: 'Domingo', short: 'Dom' },
        ];

        const maxDayTotalIndex = dayTotals.indexOf(Math.max(...dayTotals));
        const peakDayObj = daysConfig.find(d => d.index === maxDayTotalIndex) || daysConfig[0];
        const maxHourTotalIndex = hourTotals.indexOf(Math.max(...hourTotals));

        return {
            matrix,
            maxCount,
            totalDispenseEvents,
            peakSlot,
            peakDayName: daysConfig.find(d => d.index === peakSlot.dayIndex)?.label || 'Segunda-feira',
            peakDayTotalName: peakDayObj.label,
            peakDayTotalCount: dayTotals[maxDayTotalIndex] || 0,
            peakHourGlobal: maxHourTotalIndex,
            daysConfig,
            dayTotals,
            hourTotals
        };
    }, [movimentacoes, peakHoursPeriod, currentMonthDispenses]);

    // PREDITIVA: Previsão de Demanda e Necessidade de Compra
    const purchaseRecommendations = useMemo(() => {
        const recommendations = [];

        for (const med of medicamentos) {
            // Find all dispenses for this med in the last 30 days to get a daily average
            const thirtyDaysAgo = subMonths(now, 1);
            const recentDispenses = movimentacoes.filter(m => {
                if (m.medicamento_id !== med.id || m.tipo !== 'Saída' || !m.data) return false;
                const mDate = parseMovimentacaoDate(m.data);
                return mDate ? mDate >= thirtyDaysAgo : false;
            });

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
                {['geral', 'medicamentos', 'pacientes', 'operacoes', 'relatorios', 'rename', 'alto-custo', 'configuracao'].map(tab => (
                    <button
                        key={tab}
                        onClick={() => handleTabChange(tab)}
                        className={`px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
                            activeTab === tab
                                ? 'bg-pink-600 text-white shadow-md shadow-pink-500/20'
                                : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-200/60 hover:text-slate-900'
                        }`}
                    >
                        {tab === 'geral' ? 'Visão Geral' : tab === 'operacoes' ? 'Operações' : tab === 'relatorios' ? 'Relatórios' : tab === 'rename' ? 'RENAME' : tab === 'alto-custo' ? 'ALTO CUSTO' : tab === 'configuracao' ? 'Configuração' : tab.charAt(0).toUpperCase() + tab.slice(1)}
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
                    <div className="text-3xl font-black text-slate-800 mb-2">
                        {totalMedsCurrentMonth.toLocaleString('pt-BR')} <span className="text-sm font-medium text-slate-400">unidades</span>
                    </div>
                    {varMeds !== null ? (
                        <div className={`flex items-center gap-1 text-xs font-bold ${varMeds >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {varMeds >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                            {Math.abs(varMeds).toFixed(1)}% {varMeds >= 0 ? 'a mais' : 'a menos'} que o mês passado
                        </div>
                    ) : (
                        <div className="text-xs font-bold text-slate-400">
                            {totalMedsAllTime > 0 ? `Total acumulado: ${totalMedsAllTime.toLocaleString('pt-BR')} un` : 'Sem registros no mês anterior'}
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
                    <div className="h-64 w-full min-w-0">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
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
                    <div className="h-64 w-full min-w-0">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
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

            {/* Quadro de Horário de Pico / Temperatura de Atendimento */}
            <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm mb-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
                    <div>
                        <h3 className="text-base font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                            <Flame className="w-5 h-5 text-rose-500 animate-pulse" />
                            Horário de Pico (Temperatura de Atendimento)
                        </h3>
                        <p className="text-xs text-slate-500 font-semibold mt-1">
                            Mapa de calor interativo registrando a intensidade de atendimentos por dia da semana e 24 horas do dia.
                        </p>
                    </div>

                    {/* Filtros de período */}
                    <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-2xl shrink-0 self-start sm:self-auto">
                        <button
                            onClick={() => setPeakHoursPeriod('today')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                peakHoursPeriod === 'today'
                                ? 'bg-white text-slate-900 shadow-sm'
                                : 'text-slate-500 hover:text-slate-800'
                            }`}
                        >
                            Hoje
                        </button>
                        <button
                            onClick={() => setPeakHoursPeriod('current_week')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                peakHoursPeriod === 'current_week'
                                ? 'bg-white text-slate-900 shadow-sm'
                                : 'text-slate-500 hover:text-slate-800'
                            }`}
                        >
                            Semana Atual
                        </button>
                        <button
                            onClick={() => setPeakHoursPeriod('30_days')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                peakHoursPeriod === '30_days'
                                ? 'bg-white text-slate-900 shadow-sm'
                                : 'text-slate-500 hover:text-slate-800'
                            }`}
                        >
                            Últimos 30 Dias
                        </button>
                        <button
                            onClick={() => setPeakHoursPeriod('current_month')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                peakHoursPeriod === 'current_month'
                                ? 'bg-white text-slate-900 shadow-sm'
                                : 'text-slate-500 hover:text-slate-800'
                            }`}
                        >
                            Mês Atual
                        </button>
                        <button
                            onClick={() => setPeakHoursPeriod('all')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                peakHoursPeriod === 'all'
                                ? 'bg-white text-slate-900 shadow-sm'
                                : 'text-slate-500 hover:text-slate-800'
                            }`}
                        >
                            Geral (Histórico)
                        </button>
                    </div>
                </div>

                {/* Cards de Destaque do Horário de Pico */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                    <div className="bg-gradient-to-br from-rose-50 to-pink-50/50 p-4 rounded-2xl border border-rose-100 flex items-center gap-3">
                        <div className="p-3 bg-rose-500 text-white rounded-xl shadow-md shadow-rose-200">
                            <Flame className="w-5 h-5" />
                        </div>
                        <div>
                            <span className="text-[10px] font-black uppercase text-rose-400 block tracking-wider">Pico Máximo de Atendimento</span>
                            <span className="text-sm font-black text-rose-950 block">
                                {peakHoursData.peakSlot.count > 0 
                                    ? `${peakHoursData.peakDayName} às ${String(peakHoursData.peakSlot.hour).padStart(2, '0')}:00h` 
                                    : 'Sem dados no período'}
                            </span>
                            <span className="text-[10px] font-extrabold text-rose-600">
                                {peakHoursData.peakSlot.count > 0 ? `${peakHoursData.peakSlot.count} atendimentos registrados` : '-'}
                            </span>
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-amber-50 to-orange-50/50 p-4 rounded-2xl border border-amber-100 flex items-center gap-3">
                        <div className="p-3 bg-amber-500 text-white rounded-xl shadow-md shadow-amber-200">
                            <Clock className="w-5 h-5" />
                        </div>
                        <div>
                            <span className="text-[10px] font-black uppercase text-amber-500 block tracking-wider">Faixa Horária Crítica</span>
                            <span className="text-sm font-black text-amber-950 block">
                                {peakHoursData.totalDispenseEvents > 0 
                                    ? `${String(peakHoursData.peakHourGlobal).padStart(2, '0')}:00h - ${String(peakHoursData.peakHourGlobal + 1).padStart(2, '0')}:00h`
                                    : '08:00h - 11:00h'}
                            </span>
                            <span className="text-[10px] font-extrabold text-amber-700">
                                Maior concentração de público
                            </span>
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50/50 p-4 rounded-2xl border border-blue-100 flex items-center gap-3">
                        <div className="p-3 bg-blue-500 text-white rounded-xl shadow-md shadow-blue-200">
                            <Calendar className="w-5 h-5" />
                        </div>
                        <div>
                            <span className="text-[10px] font-black uppercase text-blue-400 block tracking-wider">Dia com Maior Movimento</span>
                            <span className="text-sm font-black text-blue-950 block">
                                {peakHoursData.peakDayTotalName}
                            </span>
                            <span className="text-[10px] font-extrabold text-blue-700">
                                {peakHoursData.peakDayTotalCount} atendimentos no período
                            </span>
                        </div>
                    </div>
                </div>

                {/* Heatmap Grid 24h x Dias da Semana */}
                <div className="overflow-x-auto custom-scrollbar pb-2">
                    <div className="min-w-[820px]">
                        {/* Cabeçalho de Horas (00h até 23h) */}
                        <div className="grid grid-cols-[90px_repeat(24,1fr)] gap-1 mb-2 text-center">
                            <div className="text-[10px] font-black text-slate-400 uppercase flex items-center justify-start pl-1">
                                Dia / Hora
                            </div>
                            {Array.from({ length: 24 }).map((_, h) => (
                                <div 
                                    key={h} 
                                    className={`text-[9px] font-extrabold py-1 rounded-md transition-colors ${
                                        h >= 7 && h <= 17 
                                        ? 'text-slate-800 bg-slate-100/80 font-black' 
                                        : 'text-slate-400'
                                    }`}
                                >
                                    {String(h).padStart(2, '0')}h
                                </div>
                            ))}
                        </div>

                        {/* Linhas dos Dias da Semana */}
                        <div className="space-y-1.5">
                            {peakHoursData.daysConfig.map((dayObj) => {
                                const dayMatrix = peakHoursData.matrix[dayObj.index];
                                return (
                                    <div key={dayObj.index} className="grid grid-cols-[90px_repeat(24,1fr)] gap-1 items-center">
                                        {/* Label do Dia */}
                                        <div className="text-xs font-black text-slate-700 flex items-center justify-between pr-2">
                                            <span>{dayObj.short}</span>
                                            <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">
                                                {peakHoursData.dayTotals[dayObj.index]}
                                            </span>
                                        </div>

                                        {/* Células de Horas (00-23h) */}
                                        {Array.from({ length: 24 }).map((_, hour) => {
                                            const count = dayMatrix[hour];
                                            const max = peakHoursData.maxCount;
                                            const ratio = max > 0 ? count / max : 0;
                                            const isPeakSlot = peakHoursData.peakSlot.dayIndex === dayObj.index && peakHoursData.peakSlot.hour === hour && count > 0;

                                            let cellBg = 'bg-slate-50/80 text-slate-300 border-slate-100/60';
                                            if (count > 0) {
                                                if (ratio <= 0.25) {
                                                    cellBg = 'bg-emerald-100 text-emerald-900 border-emerald-200/80 font-bold';
                                                } else if (ratio <= 0.50) {
                                                    cellBg = 'bg-amber-100 text-amber-950 border-amber-200 font-extrabold';
                                                } else if (ratio <= 0.75) {
                                                    cellBg = 'bg-orange-200 text-orange-950 border-orange-300 font-extrabold';
                                                } else {
                                                    cellBg = 'bg-rose-500 text-white border-rose-600 font-black shadow-md shadow-rose-200';
                                                }
                                            }

                                            return (
                                                <div
                                                    key={hour}
                                                    onMouseEnter={() => setHoveredPeakCell({ dayLabel: dayObj.label, hour, count })}
                                                    onMouseLeave={() => setHoveredPeakCell(null)}
                                                    className={`h-9 rounded-lg border flex items-center justify-center text-[10px] transition-all cursor-pointer relative group ${cellBg} ${
                                                        isPeakSlot ? 'ring-2 ring-rose-400 ring-offset-1 scale-105 z-10' : 'hover:scale-105 hover:z-10'
                                                    }`}
                                                >
                                                    {count > 0 ? count : ''}

                                                    {/* Tooltip Hover */}
                                                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block z-30 pointer-events-none">
                                                        <div className="bg-slate-900 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-xl shadow-xl whitespace-nowrap border border-slate-700">
                                                            <div className="font-extrabold text-amber-400">{dayObj.label} às {String(hour).padStart(2, '0')}:00h</div>
                                                            <div className="text-slate-200">{count} atendimento{count !== 1 ? 's' : ''}</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Legenda de Temperatura */}
                <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4 text-xs">
                    <div className="flex items-center gap-1.5 text-slate-500 font-bold">
                        <Thermometer className="w-4 h-4 text-slate-400" />
                        <span>Temperatura de Atendimento:</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-[11px] font-bold">
                        <div className="flex items-center gap-1.5">
                            <span className="w-3.5 h-3.5 rounded bg-slate-50 border border-slate-200"></span>
                            <span className="text-slate-400">Sem movimento (0)</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="w-3.5 h-3.5 rounded bg-emerald-100 border border-emerald-200"></span>
                            <span className="text-emerald-800">Baixo (Frio 🥶)</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="w-3.5 h-3.5 rounded bg-amber-100 border border-amber-200"></span>
                            <span className="text-amber-900">Moderado (Morno ⚡)</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="w-3.5 h-3.5 rounded bg-orange-200 border border-orange-300"></span>
                            <span className="text-orange-950">Alto (Quente 🔥)</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="w-3.5 h-3.5 rounded bg-rose-500 border border-rose-600"></span>
                            <span className="text-rose-700 font-black">Pico (🔴)</span>
                        </div>
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
                                    {formatSafeDistanceToNow(m.data)}
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
                                                    {formatSafeDate(op.data, 'dd/MM/yyyy HH:mm:ss')}
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
                                                    <div className="text-[10px] text-slate-400 font-semibold">{formatSafeDate(med.validade, 'dd/MM/yyyy')}</div>
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
                                                    <div className="text-[10px] text-slate-400 font-semibold">{formatSafeDate(med.validade, 'dd/MM/yyyy')}</div>
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
            {activeTab === 'configuracao' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    {/* Banner de Topo com Destaque de IA */}
                    <div className="bg-gradient-to-r from-slate-900 via-purple-950 to-slate-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
                        <div className="absolute right-0 top-0 translate-x-1/4 -translate-y-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>
                        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div className="space-y-2 max-w-3xl">
                                <div className="inline-flex items-center gap-2 px-3 py-1 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-full text-[10px] font-black uppercase tracking-widest">
                                    <Sparkles className="w-3.5 h-3.5 text-purple-300 animate-pulse" />
                                    Motor de Inteligência Preditiva de Estoque (IA)
                                </div>
                                <h3 className="text-2xl font-black uppercase tracking-tight text-white flex items-center gap-3">
                                    Configuração & Inteligência de Compras por IA
                                </h3>
                                <p className="text-slate-300 text-xs font-medium leading-relaxed">
                                    Nossa Inteligência Artificial analisa em tempo real a velocidade de retiradas, validade dos lotes e cobertura do estoque para sugerir o <strong className="text-purple-300">estoque mensal ideal a comprar</strong>, evitando falta de remédios ou perdas por vencimento.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Cards de Resumo Preditivo da IA */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        <div className="bg-white rounded-3xl p-5 border border-purple-100 shadow-sm flex items-center gap-4">
                            <div className="p-3.5 bg-purple-50 text-purple-600 rounded-2xl shrink-0">
                                <ShoppingCart className="w-6 h-6" />
                            </div>
                            <div>
                                <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Sugestão de Compras IA</span>
                                <div className="text-xl font-black text-slate-900 mt-0.5">
                                    {iaKpiSummary.totalSugestaoCompra.toLocaleString('pt-BR')} <span className="text-xs font-bold text-slate-400">unidades</span>
                                </div>
                                <p className="text-[10px] font-medium text-purple-600 mt-0.5">Sugerido para manter a farmácia abastecida no mês</p>
                            </div>
                        </div>

                        <div className="bg-white rounded-3xl p-5 border border-rose-100 shadow-sm flex items-center gap-4">
                            <div className="p-3.5 bg-rose-50 text-rose-600 rounded-2xl shrink-0">
                                <AlertTriangle className="w-6 h-6" />
                            </div>
                            <div>
                                <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Risco de Desabastecimento</span>
                                <div className="text-xl font-black text-rose-600 mt-0.5">
                                    {iaKpiSummary.qtdRiscoDesabastecimento} <span className="text-xs font-bold text-rose-400">medicamentos</span>
                                </div>
                                <p className="text-[10px] font-medium text-rose-600 mt-0.5">Estoque atual cobre menos de 10 dias de consumo</p>
                            </div>
                        </div>

                        <div className="bg-white rounded-3xl p-5 border border-amber-100 shadow-sm flex items-center gap-4">
                            <div className="p-3.5 bg-amber-50 text-amber-600 rounded-2xl shrink-0">
                                <Calendar className="w-6 h-6" />
                            </div>
                            <div>
                                <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Risco de Vencimento</span>
                                <div className="text-xl font-black text-amber-600 mt-0.5">
                                    {iaKpiSummary.qtdRiscoVencimento} <span className="text-xs font-bold text-amber-500">medicamentos</span>
                                </div>
                                <p className="text-[10px] font-medium text-amber-700 mt-0.5">Lotes com validade próxima vs. consumo estimado</p>
                            </div>
                        </div>
                    </div>

                    {/* Card de Formulário de Configuração */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Formulário Principal */}
                        <div className="lg:col-span-1 bg-white rounded-3xl p-6 border border-slate-200/60 shadow-sm flex flex-col justify-between space-y-6">
                            <div>
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="p-3 rounded-2xl bg-pink-50 text-pink-600">
                                        <AlertTriangle className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h4 className="font-extrabold text-slate-800 text-base uppercase tracking-tight">Porcentagem Global de Alerta</h4>
                                        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Aplica-se sobre o estoque do dia 05</p>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-2">
                                            Valor da Porcentagem (%)
                                        </label>
                                        <div className="relative flex items-center">
                                            <input
                                                type="number"
                                                min="1"
                                                max="100"
                                                value={globalAlertPercentage}
                                                onChange={e => {
                                                    const val = Math.min(100, Math.max(1, parseInt(e.target.value, 10) || 1));
                                                    setGlobalAlertPercentage(val);
                                                }}
                                                className="w-full text-2xl font-black text-slate-900 bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 focus:bg-white focus:border-pink-500 outline-none transition-all pr-12"
                                            />
                                            <span className="absolute right-4 font-black text-slate-400 text-lg">%</span>
                                        </div>
                                    </div>

                                    {/* Slider */}
                                    <div>
                                        <input
                                            type="range"
                                            min="5"
                                            max="50"
                                            step="1"
                                            value={globalAlertPercentage}
                                            onChange={e => setGlobalAlertPercentage(Number(e.target.value))}
                                            className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-pink-600"
                                        />
                                        <div className="flex justify-between text-[10px] font-bold text-slate-400 mt-1">
                                            <span>5% (Mais restritivo)</span>
                                            <span>20% (Recomendado)</span>
                                            <span>50% (Mais amplo)</span>
                                        </div>
                                    </div>

                                    {/* Botões de Preset Rápido */}
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">
                                            Valores Rápidos
                                        </label>
                                        <div className="grid grid-cols-4 gap-2">
                                            {[10, 15, 20, 25, 30, 40, 50].map(pct => (
                                                <button
                                                    key={pct}
                                                    type="button"
                                                    onClick={() => setGlobalAlertPercentage(pct)}
                                                    className={`py-2 rounded-xl text-xs font-black transition-all ${
                                                        globalAlertPercentage === pct
                                                            ? 'bg-pink-600 text-white shadow-md shadow-pink-500/30 scale-105'
                                                            : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/60'
                                                    }`}
                                                >
                                                    {pct}%
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={handleSaveConfig}
                                disabled={savingConfig}
                                className="w-full py-4 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white font-black text-xs uppercase tracking-widest rounded-2xl transition-all shadow-lg shadow-pink-600/20 active:scale-95 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                            >
                                {savingConfig ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        <span>Salvando...</span>
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 className="w-4 h-4" />
                                        <span>Salvar Configuração Global</span>
                                    </>
                                )}
                            </button>
                        </div>

                        {/* Card Ilustrativo com Exemplo Prático */}
                        <div className="lg:col-span-2 bg-gradient-to-br from-purple-50/70 via-slate-50 to-white rounded-3xl p-6 border border-purple-100/60 shadow-sm flex flex-col justify-between space-y-6">
                            <div>
                                <div className="inline-flex items-center gap-2 px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-[10px] font-black uppercase tracking-wider mb-4">
                                    <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                                    Como a IA calcula a sugestão de compras?
                                </div>

                                <h4 className="text-lg font-black text-slate-800 uppercase tracking-tight mb-2">
                                    Inteligência Artificial de Previsão Mensal
                                </h4>

                                <p className="text-slate-600 text-xs font-medium leading-relaxed mb-6">
                                    O algoritmo cruza o <strong>histórico real de saídas</strong> dos últimos meses, calcula a média diária de consumo, adiciona 20% de margem de segurança antidesabastecimento e previne compras excessivas em itens com risco de vencer.
                                </p>

                                {/* Simulação Visual de Exemplo */}
                                <div className="bg-white rounded-2xl p-5 border border-purple-100 shadow-sm space-y-4">
                                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                        <span className="text-xs font-black text-slate-700 uppercase">Medicamento Exemplo:</span>
                                        <span className="text-xs font-black text-purple-600 uppercase bg-purple-50 px-2.5 py-1 rounded-lg">DIPIRONA 500MG</span>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                            <span className="block text-[10px] font-bold text-slate-400 uppercase">Consumo Médio Estimado</span>
                                            <span className="text-lg font-black text-slate-800">1.000 <span className="text-xs text-slate-500">un/mês</span></span>
                                        </div>
                                        <div className="bg-purple-50 p-3 rounded-xl border border-purple-100">
                                            <span className="block text-[10px] font-bold text-purple-600 uppercase">Estoque Mensal Ideal (IA)</span>
                                            <span className="text-lg font-black text-purple-700">1.200 <span className="text-xs text-purple-500">un</span></span>
                                        </div>
                                        <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                                            <span className="block text-[10px] font-bold text-emerald-600 uppercase">Sugestão de Compra</span>
                                            <span className="text-lg font-black text-emerald-700">
                                                + 800 <span className="text-xs text-emerald-600">un</span>
                                            </span>
                                        </div>
                                    </div>

                                    <div className="p-3 bg-purple-500/10 border border-purple-200/60 rounded-xl flex items-start gap-3">
                                        <Sparkles className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
                                        <p className="text-xs text-purple-950 font-semibold leading-relaxed">
                                            Com estoque atual de 400 un e consumo de 1.000 un/mês, a IA sugere comprar <strong>800 unidades</strong> para alcançar o Estoque Ideal de 1.200 un com margem de segurança.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Tabela de Pré-visualização com Colunas Inteligentes da IA */}
                    <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-purple-50 text-purple-600 rounded-2xl">
                                    <Brain className="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 className="font-extrabold text-slate-800 text-sm uppercase tracking-tight flex items-center gap-2">
                                        Tabela de Configuração & Inteligência Preditiva por IA
                                    </h4>
                                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-0.5">
                                        Análise em tempo real de estoque ideal, sugestão de compra e risco de vencimento
                                    </p>
                                </div>
                            </div>

                            <div className="relative w-full md:w-72">
                                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    placeholder="Buscar medicamento..."
                                    value={configSearch}
                                    onChange={e => setConfigSearch(e.target.value)}
                                    className="w-full bg-white border border-slate-200 rounded-xl py-2 pl-9 pr-4 text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:border-purple-500 outline-none transition-all shadow-sm"
                                />
                            </div>
                        </div>

                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full text-left border-collapse min-w-[1050px]">
                                <thead>
                                    <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-500 text-[10px] font-black uppercase tracking-wider">
                                        <th className="py-4 px-6 text-left w-[26%]">Medicamento</th>
                                        <th className="py-4 px-3 text-center w-[10%]">Estoque Atual</th>
                                        <th className="py-4 px-3 text-center w-[11%]">Estoque Dia 05</th>
                                        <th className="py-4 px-3 text-center w-[14%] bg-purple-50/50 text-purple-900">Estoque Ideal IA</th>
                                        <th className="py-4 px-3 text-center w-[13%] bg-purple-50/50 text-purple-900">Sugestão Compra</th>
                                        <th className="py-4 px-6 text-center w-[23%]">Diagnóstico IA & Parecer</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {configPreviewList.length > 0 ? (
                                        configPreviewList.map(med => {
                                            const isCritical = med.quantidade <= med.thresholdCritical && med.quantidade > 0;
                                            const isLow = med.quantidade <= med.thresholdLow && med.quantidade > med.thresholdCritical;
                                            const isZero = med.quantidade === 0;

                                            return (
                                                <tr key={med.id} className="hover:bg-purple-50/20 transition-colors text-xs text-slate-700">
                                                    <td className="py-4 px-6">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <span className="font-black text-slate-900 uppercase">
                                                                {med.nome}
                                                            </span>
                                                            {med.categoria && (
                                                                <span className="text-[9px] font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md uppercase tracking-wider">
                                                                    {med.categoria}
                                                                </span>
                                                            )}
                                                            {med.tipo && (
                                                                <span className="text-[9px] font-bold px-2 py-0.5 bg-pink-50 text-pink-600 rounded-md uppercase tracking-wider">
                                                                    {med.tipo}
                                                                </span>
                                                            )}
                                                            {med.dosagem && (
                                                                <span className="text-[10px] font-medium text-slate-400">
                                                                    {med.dosagem}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>

                                                    {/* Estoque Atual */}
                                                    <td className="py-4 px-3 text-center">
                                                        <span className={`inline-flex items-center justify-center px-3 py-1 rounded-xl text-xs font-black ${
                                                            isZero || isCritical
                                                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                                                : isLow
                                                                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                                                : 'bg-slate-100 text-slate-900'
                                                        }`}>
                                                            {med.quantidade.toLocaleString('pt-BR')} <span className="text-[10px] font-bold opacity-75 ml-1">{med.unidade}</span>
                                                        </span>
                                                    </td>

                                                    {/* Estoque no Dia 05 */}
                                                    <td className="py-4 px-3 text-center">
                                                        <span className="inline-flex items-center justify-center px-3 py-1 bg-slate-100/80 text-slate-800 font-extrabold rounded-xl text-xs">
                                                            {med.estoqueDia05.toLocaleString('pt-BR')} <span className="text-[10px] font-bold text-slate-400 ml-1">{med.unidade}</span>
                                                        </span>
                                                    </td>

                                                    {/* Estoque Mensal Ideal IA */}
                                                    <td className="py-4 px-3 text-center bg-purple-50/30 font-black">
                                                        {!med.isEstoqueAtivo ? (
                                                            <span className="text-slate-400 font-bold text-xs">-</span>
                                                        ) : med.statusIA === 'ANALISANDO' ? (
                                                            <span className="inline-flex items-center justify-center px-3 py-1 bg-purple-50 text-purple-700 rounded-xl text-xs font-bold border border-purple-200">
                                                                <Sparkles className="w-3 h-3 mr-1 text-purple-600 animate-spin" /> Analisando
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center justify-center px-3 py-1 bg-purple-100/80 text-purple-900 rounded-xl text-xs border border-purple-200/60 font-black">
                                                                {med.estoqueIdealIA.toLocaleString('pt-BR')} <span className="text-[10px] font-bold text-purple-600 ml-1">{med.unidade}</span>
                                                            </span>
                                                        )}
                                                    </td>

                                                    {/* Sugestão de Compra IA */}
                                                    <td className="py-4 px-3 text-center bg-purple-50/30">
                                                        {!med.isEstoqueAtivo ? (
                                                            <span className="inline-flex items-center justify-center px-3 py-1 bg-slate-100 text-slate-400 rounded-xl text-xs font-semibold">
                                                                Sem Análise
                                                            </span>
                                                        ) : med.statusIA === 'ANALISANDO' ? (
                                                            <span className="inline-flex items-center justify-center px-3 py-1 bg-slate-100 text-slate-500 rounded-xl text-xs font-bold">
                                                                Analisando
                                                            </span>
                                                        ) : med.sugestaoCompra > 0 ? (
                                                            <span className="inline-flex items-center justify-center px-3 py-1 bg-emerald-100 text-emerald-800 rounded-xl text-xs font-black border border-emerald-200">
                                                                + {med.sugestaoCompra.toLocaleString('pt-BR')} <span className="text-[10px] font-bold text-emerald-600 ml-1">{med.unidade}</span>
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center justify-center px-3 py-1 bg-slate-100 text-slate-500 rounded-xl text-xs font-bold">
                                                                Não Comprar
                                                            </span>
                                                        )}
                                                    </td>

                                                    {/* Diagnóstico IA & Parecer */}
                                                    <td className="py-4 px-6 text-center">
                                                        <div className="flex items-center justify-center gap-2">
                                                            {!med.isEstoqueAtivo ? (
                                                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500 border border-slate-200">
                                                                    Sem Análise
                                                                </span>
                                                            ) : med.statusIA === 'ANALISANDO' ? (
                                                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-purple-100 text-purple-800 border border-purple-200 shadow-xs">
                                                                    <Sparkles className="w-3 h-3 mr-1 text-purple-600 animate-pulse" /> Analisando
                                                                </span>
                                                            ) : med.statusIA === 'RISCO_DESABASTECIMENTO' ? (
                                                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-red-100 text-red-800 border border-red-200 animate-pulse">
                                                                    Comprar Urgente
                                                                </span>
                                                            ) : med.statusIA === 'RISCO_VENCIMENTO' ? (
                                                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
                                                                    Risco Vencimento
                                                                </span>
                                                            ) : med.statusIA === 'SUPERESTOCAGEM' ? (
                                                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-purple-100 text-purple-800 border border-purple-200">
                                                                    Superestocado
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
                                                                    Ideal
                                                                </span>
                                                            )}

                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setSelectedIAMed(med);
                                                                    setIsIAModalOpen(true);
                                                                }}
                                                                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-purple-100 text-slate-600 hover:text-purple-800 text-[10px] font-extrabold transition-all flex items-center gap-1 cursor-pointer"
                                                                title="Ver Parecer Detalhado da IA"
                                                            >
                                                                <Sparkles className="w-3 h-3 text-purple-600" />
                                                                <span>Parecer IA</span>
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    ) : (
                                        <tr>
                                            <td colSpan={6} className="p-8 text-center text-slate-400 font-bold text-xs uppercase">
                                                Nenhum medicamento encontrado.
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

            {/* Modal de Parecer Detalhado da IA */}
            {isIAModalOpen && selectedIAMed && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-6">
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-600 text-white rounded-2xl shadow-md">
                                    <Sparkles className="w-6 h-6 animate-pulse" />
                                </div>
                                <div>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-purple-600">Inteligência Artificial Preditiva</span>
                                    <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">{selectedIAMed.nome}</h3>
                                    <p className="text-xs font-semibold text-slate-400">{selectedIAMed.dosagem} • {selectedIAMed.categoria} ({selectedIAMed.tipo || 'Geral'})</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsIAModalOpen(false)}
                                className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Métricas da IA */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                                <span className="block text-[10px] font-bold text-slate-400 uppercase">Estoque Atual</span>
                                <span className="text-base font-black text-slate-800">{selectedIAMed.quantidade.toLocaleString('pt-BR')} {selectedIAMed.unidade}</span>
                            </div>
                            <div className="bg-purple-50 p-3.5 rounded-2xl border border-purple-100">
                                <span className="block text-[10px] font-bold text-purple-600 uppercase">Estoque Ideal IA / Mês</span>
                                <span className="text-base font-black text-purple-700">{selectedIAMed.estoqueIdealIA.toLocaleString('pt-BR')} {selectedIAMed.unidade}</span>
                            </div>
                            <div className="bg-amber-50 p-3.5 rounded-2xl border border-amber-100">
                                <span className="block text-[10px] font-bold text-amber-700 uppercase">Consumo Mensal Estimado</span>
                                <span className="text-base font-black text-amber-800">{selectedIAMed.demandaMensal.toLocaleString('pt-BR')} {selectedIAMed.unidade}/mês</span>
                            </div>
                            <div className="bg-emerald-50 p-3.5 rounded-2xl border border-emerald-100">
                                <span className="block text-[10px] font-bold text-emerald-700 uppercase">Sugestão de Compra</span>
                                <span className="text-base font-black text-emerald-800">{selectedIAMed.sugestaoCompra.toLocaleString('pt-BR')} {selectedIAMed.unidade}</span>
                            </div>
                        </div>

                        {/* Parecer IA */}
                        <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-100 rounded-2xl space-y-2">
                            <div className="flex items-center gap-2 text-xs font-black text-purple-900 uppercase">
                                <Sparkles className="w-4 h-4 text-purple-600" />
                                <span>Parecer Preditivo do Algoritmo IA</span>
                            </div>
                            <p className="text-xs font-semibold text-slate-700 leading-relaxed">
                                {selectedIAMed.parecerIA}
                            </p>
                        </div>

                        <button
                            onClick={() => setIsIAModalOpen(false)}
                            className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-colors cursor-pointer"
                        >
                            Fechar Diagnóstico
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
