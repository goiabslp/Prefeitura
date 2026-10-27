import React, { useState, useMemo } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
    X, 
    FileDown, 
    Check, 
    AlertTriangle, 
    ShieldAlert, 
    Clock, 
    PackageCheck, 
    CheckCircle2, 
    Sparkles, 
    Filter, 
    Loader2,
    Calendar,
    Search
} from 'lucide-react';
import { User } from '../../types';

export type DiagnosticoStatusKey = 'RISCO_DESABASTECIMENTO' | 'RISCO_VENCIMENTO' | 'SUPERESTOCAGEM' | 'EQUILIBRADO';

export interface FarmaciaConfigRelatorioItem {
    id: string;
    nome: string;
    dosagem?: string;
    tipo?: string;
    categoria: string;
    unidade: string;
    quantidade: number;
    estoqueDia05: number;
    estoqueIdealIA: number;
    sugestaoCompra: number;
    diasCobertura: number;
    statusIA: 'SEM_ESTOQUE_CADASTRADO' | 'ANALISANDO' | 'RISCO_DESABASTECIMENTO' | 'RISCO_VENCIMENTO' | 'SUPERESTOCAGEM' | 'EQUILIBRADO';
    parecerIA: string;
    isEstoqueAtivo: boolean;
}

interface FarmaciaConfigRelatorioModalProps {
    isOpen: boolean;
    onClose: () => void;
    allItems: FarmaciaConfigRelatorioItem[];
    currentUser?: User | null;
    initialDiagnosticoFilter?: string; // 'TODOS' ou chave específica
}

export const FarmaciaConfigRelatorioModal: React.FC<FarmaciaConfigRelatorioModalProps> = ({
    isOpen,
    onClose,
    allItems,
    currentUser,
    initialDiagnosticoFilter
}) => {
    // Configurações de filtros para o PDF
    const [selectedStatuses, setSelectedStatuses] = useState<Record<DiagnosticoStatusKey, boolean>>(() => {
        if (initialDiagnosticoFilter && initialDiagnosticoFilter !== 'TODOS') {
            return {
                RISCO_DESABASTECIMENTO: initialDiagnosticoFilter === 'RISCO_DESABASTECIMENTO',
                RISCO_VENCIMENTO: initialDiagnosticoFilter === 'RISCO_VENCIMENTO',
                SUPERESTOCAGEM: initialDiagnosticoFilter === 'SUPERESTOCAGEM',
                EQUILIBRADO: initialDiagnosticoFilter === 'EQUILIBRADO'
            };
        }
        return {
            RISCO_DESABASTECIMENTO: true,
            RISCO_VENCIMENTO: true,
            SUPERESTOCAGEM: true,
            EQUILIBRADO: true
        };
    });

    const [searchTerm, setSearchTerm] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    // Contagem de itens por diagnóstico no universo completo de estoque ativo
    const statusCounts = useMemo(() => {
        const counts: Record<DiagnosticoStatusKey, number> = {
            RISCO_DESABASTECIMENTO: 0,
            RISCO_VENCIMENTO: 0,
            SUPERESTOCAGEM: 0,
            EQUILIBRADO: 0
        };

        allItems.forEach(item => {
            if (item.isEstoqueAtivo && item.statusIA in counts) {
                counts[item.statusIA as DiagnosticoStatusKey]++;
            }
        });

        return counts;
    }, [allItems]);

    // Medicamentos filtrados para o relatório
    const filteredForReport = useMemo(() => {
        return allItems.filter(item => {
            if (!item.isEstoqueAtivo) return false;
            if (!(item.statusIA in selectedStatuses)) return false;
            if (!selectedStatuses[item.statusIA as DiagnosticoStatusKey]) return false;

            if (searchTerm.trim()) {
                const q = searchTerm.toLowerCase().trim();
                const matches = (
                    item.nome?.toLowerCase().includes(q) ||
                    item.categoria?.toLowerCase().includes(q) ||
                    item.dosagem?.toLowerCase().includes(q) ||
                    (item.tipo && item.tipo.toLowerCase().includes(q))
                );
                if (!matches) return false;
            }

            return true;
        });
    }, [allItems, selectedStatuses, searchTerm]);

    const toggleStatus = (key: DiagnosticoStatusKey) => {
        setSelectedStatuses(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    };

    const handleSelectAll = (select: boolean) => {
        setSelectedStatuses({
            RISCO_DESABASTECIMENTO: select,
            RISCO_VENCIMENTO: select,
            SUPERESTOCAGEM: select,
            EQUILIBRADO: select
        });
    };

    // Geração do relatório em PDF
    const handleGeneratePdf = async () => {
        if (filteredForReport.length === 0) return;

        setIsGenerating(true);
        try {
            // Pequeno delay para atualizar UI
            await new Promise(r => setTimeout(r, 100));

            const doc = new jsPDF('landscape', 'pt', 'a4');
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            let currentY = 35;

            // 1. Cabeçalho Institucional
            doc.setFillColor(107, 33, 168); // Roxo / Purple 800
            doc.rect(40, currentY, pageWidth - 80, 5, 'F');
            currentY += 18;

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(13);
            doc.setTextColor(30, 41, 59);
            doc.text('PREFEITURA MUNICIPAL DE SÃO JOSÉ DO GOIABAL — SECRETARIA MUNICIPAL DE SAÚDE', 40, currentY);

            currentY += 14;
            doc.setFontSize(11);
            doc.setTextColor(107, 33, 168);
            doc.text('FARMÁCIA POPULAR • RELATÓRIO DE INTELIGÊNCIA PREDITIVA & DIAGNÓSTICO DE ESTOQUE', 40, currentY);

            currentY += 12;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8.5);
            doc.setTextColor(100, 116, 139);

            const dataEmissao = new Date().toLocaleString('pt-BR');
            const emissor = currentUser?.name || 'Administrador / Gestor Autorizado';
            
            const activeLabels: string[] = [];
            if (selectedStatuses.RISCO_DESABASTECIMENTO) activeLabels.push('Comprar Urgente');
            if (selectedStatuses.RISCO_VENCIMENTO) activeLabels.push('Risco Vencimento');
            if (selectedStatuses.SUPERESTOCAGEM) activeLabels.push('Superestocado');
            if (selectedStatuses.EQUILIBRADO) activeLabels.push('Ideal');

            doc.text(`Emissão: ${dataEmissao} | Responsável: ${emissor} | Filtros Aplicados: ${activeLabels.join(', ') || 'Nenhum'}`, 40, currentY);

            currentY += 16;

            // 2. Banner de KPIs Resumo
            const totalComprarUrgente = filteredForReport.filter(i => i.statusIA === 'RISCO_DESABASTECIMENTO').length;
            const totalRiscoVencimento = filteredForReport.filter(i => i.statusIA === 'RISCO_VENCIMENTO').length;
            const totalSuperestocado = filteredForReport.filter(i => i.statusIA === 'SUPERESTOCAGEM').length;
            const totalIdeal = filteredForReport.filter(i => i.statusIA === 'EQUILIBRADO').length;
            const totalSugestaoCompra = filteredForReport.reduce((acc, i) => acc + (i.sugestaoCompra || 0), 0);

            const kpiItems = [
                { label: 'Total Listado', val: `${filteredForReport.length}`, color: [71, 85, 105] },
                { label: 'Comprar Urgente', val: `${totalComprarUrgente}`, color: [220, 38, 38] },
                { label: 'Risco Vencimento', val: `${totalRiscoVencimento}`, color: [217, 119, 6] },
                { label: 'Superestocado', val: `${totalSuperestocado}`, color: [147, 51, 234] },
                { label: 'Estoque Ideal', val: `${totalIdeal}`, color: [16, 185, 129] },
                { label: 'Sugestão Compra', val: `+${totalSugestaoCompra.toLocaleString('pt-BR')} un`, color: [30, 41, 59] }
            ];

            const kpiWidth = (pageWidth - 80 - (kpiItems.length - 1) * 8) / kpiItems.length;
            kpiItems.forEach((kpi, idx) => {
                const kpiX = 40 + idx * (kpiWidth + 8);
                doc.setFillColor(248, 250, 252);
                doc.setDrawColor(226, 232, 240);
                doc.roundedRect(kpiX, currentY, kpiWidth, 32, 4, 4, 'FD');

                doc.setFont('helvetica', 'normal');
                doc.setFontSize(7);
                doc.setTextColor(100, 116, 139);
                doc.text(kpi.label.toUpperCase(), kpiX + 6, currentY + 11);

                doc.setFont('helvetica', 'bold');
                doc.setFontSize(10.5);
                doc.setTextColor(kpi.color[0], kpi.color[1], kpi.color[2]);
                doc.text(kpi.val, kpiX + 6, currentY + 25);
            });

            currentY += 42;

            // 3. Ordem Fixa e Rigorosa dos Grupos:
            // 1º Comprar Urgente, 2º Risco Vencimento, 3º Superestocado, 4º Ideal
            const DIAGNOSTICO_SECTIONS: {
                key: DiagnosticoStatusKey;
                title: string;
                subtitle: string;
                headerColor: [number, number, number];
                badgeText: string;
            }[] = [
                {
                    key: 'RISCO_DESABASTECIMENTO',
                    title: '1. COMPRAR URGENTE — RISCO DE DESABASTECIMENTO',
                    subtitle: 'Medicamentos com estoque abaixo do limite crítico e cobertura inferior a 10 dias de dispensação.',
                    headerColor: [220, 38, 38], // Vermelho
                    badgeText: 'COMPRAR URGENTE'
                },
                {
                    key: 'RISCO_VENCIMENTO',
                    title: '2. RISCO DE VENCIMENTO — ALERTA DE VALIDADE PRÓXIMA',
                    subtitle: 'Medicamentos com lotes a vencer em até 90 dias que superam o ritmo de dispensação previsto.',
                    headerColor: [217, 119, 6], // Âmbar
                    badgeText: 'RISCO VENCIMENTO'
                },
                {
                    key: 'SUPERESTOCAGEM',
                    title: '3. SUPERESTOCADO — ESTOQUE ACIMA DA DEMANDA MENSAL',
                    subtitle: 'Medicamentos com saldo superior ao dobro do consumo mensal ideal. Recomenda-se pausar compras.',
                    headerColor: [147, 51, 234], // Roxo
                    badgeText: 'SUPERESTOCADO'
                },
                {
                    key: 'EQUILIBRADO',
                    title: '4. IDEAL — ESTOQUE REGULAR E EQUILIBRADO',
                    subtitle: 'Medicamentos com saldo alinhado com a demanda média mensal e margem de segurança da IA.',
                    headerColor: [16, 185, 129], // Verde Esmeralda
                    badgeText: 'IDEAL'
                }
            ];

            let sectionCount = 0;

            for (const section of DIAGNOSTICO_SECTIONS) {
                if (!selectedStatuses[section.key]) continue;

                // Filtra e ordena estritamente por ordem alfabética do nome
                const itemsInSection = filteredForReport
                    .filter(item => item.statusIA === section.key)
                    .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

                if (itemsInSection.length === 0) continue;

                sectionCount++;

                // Verificar espaço antes do banner do grupo (se < 80pt, cria nova página)
                if (currentY > pageHeight - 80) {
                    doc.addPage();
                    currentY = 40;
                }

                // Banner do Grupo
                doc.setFillColor(section.headerColor[0], section.headerColor[1], section.headerColor[2]);
                doc.rect(40, currentY, pageWidth - 80, 22, 'F');

                doc.setFont('helvetica', 'bold');
                doc.setFontSize(9.5);
                doc.setTextColor(255, 255, 255);
                doc.text(`${section.title} (${itemsInSection.length} ${itemsInSection.length === 1 ? 'medicamento' : 'medicamentos'})`, 48, currentY + 14);

                currentY += 24;

                // Tabela de Itens com autoTable
                const tableBody = itemsInSection.map((med, index) => {
                    const fullName = [med.nome, med.categoria, med.tipo, med.dosagem].filter(Boolean).join(' • ');
                    const estoqueAtual = `${med.quantidade.toLocaleString('pt-BR')} ${med.unidade}`;
                    const estoqueDia05 = `${med.estoqueDia05.toLocaleString('pt-BR')} ${med.unidade}`;
                    const estoqueIdeal = `${med.estoqueIdealIA.toLocaleString('pt-BR')} ${med.unidade}`;
                    const sugestaoCompra = med.sugestaoCompra > 0 
                        ? `+ ${med.sugestaoCompra.toLocaleString('pt-BR')} ${med.unidade}` 
                        : 'Não Comprar';
                    const diasCob = med.diasCobertura >= 999 ? 'Ampla' : `${med.diasCobertura} dias`;

                    return [
                        `${index + 1}`,
                        fullName,
                        estoqueAtual,
                        estoqueDia05,
                        estoqueIdeal,
                        sugestaoCompra,
                        diasCob,
                        section.badgeText,
                        med.parecerIA || '-'
                    ];
                });

                autoTable(doc, {
                    startY: currentY,
                    head: [[
                        '#',
                        'Medicamento / Detalhes',
                        'Estoque Atual',
                        'Estoque Dia 05',
                        'Estoque Ideal IA',
                        'Sugestão Compra',
                        'Cobertura',
                        'Diagnóstico',
                        'Parecer Inteligente da IA'
                    ]],
                    body: tableBody,
                    theme: 'striped',
                    styles: {
                        fontSize: 7.5,
                        font: 'helvetica',
                        cellPadding: 3.5,
                        valign: 'middle'
                    },
                    headStyles: {
                        fillColor: [30, 41, 59], // Slate 800
                        textColor: [255, 255, 255],
                        fontStyle: 'bold',
                        fontSize: 7.5,
                        halign: 'center'
                    },
                    columnStyles: {
                        0: { cellWidth: 20, halign: 'center', fontStyle: 'bold' },
                        1: { cellWidth: 165, fontStyle: 'bold' },
                        2: { cellWidth: 65, halign: 'center', fontStyle: 'bold' },
                        3: { cellWidth: 65, halign: 'center' },
                        4: { cellWidth: 65, halign: 'center', fontStyle: 'bold' },
                        5: { cellWidth: 65, halign: 'center', fontStyle: 'bold' },
                        6: { cellWidth: 45, halign: 'center' },
                        7: { cellWidth: 70, halign: 'center', fontStyle: 'bold' },
                        8: { cellWidth: 200, fontSize: 7 }
                    },
                    margin: { left: 40, right: 40 },
                    didParseCell: (data) => {
                        // Cores especiais para colunas de destaque
                        if (data.section === 'body') {
                            if (data.column.index === 5) {
                                const val = data.cell.text[0] || '';
                                if (val.startsWith('+')) {
                                    data.cell.styles.textColor = [16, 185, 129]; // Verde
                                }
                            }
                            if (data.column.index === 7) {
                                data.cell.styles.textColor = section.headerColor;
                            }
                        }
                    }
                });

                currentY = (doc as any).lastAutoTable.finalY + 16;
            }

            // 4. Rodapé em todas as páginas com numeração
            const totalPages = doc.getNumberOfPages();
            for (let i = 1; i <= totalPages; i++) {
                doc.setPage(i);
                doc.setDrawColor(226, 232, 240);
                doc.line(40, pageHeight - 25, pageWidth - 40, pageHeight - 25);

                doc.setFont('helvetica', 'normal');
                doc.setFontSize(7.5);
                doc.setTextColor(148, 163, 184);
                doc.text(
                    `Prefeitura Municipal de São José do Goiabal • Farmácia Popular — Emitido em: ${dataEmissao}`,
                    40,
                    pageHeight - 14
                );

                const pageText = `Página ${i} de ${totalPages}`;
                doc.text(pageText, pageWidth - 40 - doc.getTextWidth(pageText), pageHeight - 14);
            }

            const fileName = `relatorio_diagnostico_farmacia_${new Date().toISOString().slice(0, 10)}.pdf`;
            doc.save(fileName);
            onClose();
        } catch (err) {
            console.error('Erro ao gerar relatório PDF:', err);
            alert('Falha ao gerar o arquivo PDF. Tente novamente.');
        } finally {
            setIsGenerating(false);
        }
    };

    if (!isOpen) return null;

    const totalSelected = filteredForReport.length;

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs select-none animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[92vh]">
                
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-purple-50/70 via-slate-50 to-white shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-purple-600 text-white rounded-2xl shadow-xs">
                            <FileDown className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">
                                Emitir Relatório em PDF
                            </h3>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                                Inteligência Preditiva & Diagnóstico de Estoque
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-slate-200/70 rounded-xl text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                        title="Fechar"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto custom-scrollbar space-y-5 flex-1">
                    
                    {/* Seção 1: Filtros de Diagnóstico */}
                    <div>
                        <div className="flex items-center justify-between mb-2.5">
                            <label className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                <Filter className="w-3.5 h-3.5 text-purple-600" />
                                <span>Filtrar por Diagnóstico:</span>
                            </label>

                            <div className="flex items-center gap-1 text-[11px] font-bold">
                                <button
                                    type="button"
                                    onClick={() => handleSelectAll(true)}
                                    className="px-2 py-0.5 text-purple-700 hover:bg-purple-50 rounded-md transition-colors cursor-pointer"
                                >
                                    Marcar Todos
                                </button>
                                <span className="text-slate-300">|</span>
                                <button
                                    type="button"
                                    onClick={() => handleSelectAll(false)}
                                    className="px-2 py-0.5 text-slate-500 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                                >
                                    Desmarcar Todos
                                </button>
                            </div>
                        </div>

                        {/* Cards de Diagnóstico Selecionáveis */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            
                            {/* 1. Comprar Urgente */}
                            <div 
                                onClick={() => toggleStatus('RISCO_DESABASTECIMENTO')}
                                className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                                    selectedStatuses.RISCO_DESABASTECIMENTO 
                                        ? 'bg-red-50/70 border-red-300 shadow-2xs ring-2 ring-red-500/10' 
                                        : 'bg-slate-50/50 border-slate-200 hover:border-slate-300 opacity-60'
                                }`}
                            >
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                                        selectedStatuses.RISCO_DESABASTECIMENTO ? 'bg-red-600 text-white' : 'bg-slate-200 text-slate-500'
                                    }`}>
                                        <ShieldAlert className="w-4 h-4" />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-xs font-black text-slate-900 uppercase">
                                            Comprar Urgente
                                        </div>
                                        <div className="text-[10px] text-slate-500 font-medium truncate">
                                            Risco de desabastecimento
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right shrink-0 ml-2">
                                    <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-800 text-[10px] font-black">
                                        {statusCounts.RISCO_DESABASTECIMENTO} itens
                                    </span>
                                </div>
                            </div>

                            {/* 2. Risco Vencimento */}
                            <div 
                                onClick={() => toggleStatus('RISCO_VENCIMENTO')}
                                className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                                    selectedStatuses.RISCO_VENCIMENTO 
                                        ? 'bg-amber-50/70 border-amber-300 shadow-2xs ring-2 ring-amber-500/10' 
                                        : 'bg-slate-50/50 border-slate-200 hover:border-slate-300 opacity-60'
                                }`}
                            >
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                                        selectedStatuses.RISCO_VENCIMENTO ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-500'
                                    }`}>
                                        <Clock className="w-4 h-4" />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-xs font-black text-slate-900 uppercase">
                                            Risco Vencimento
                                        </div>
                                        <div className="text-[10px] text-slate-500 font-medium truncate">
                                            Lotes a expirar em breve
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right shrink-0 ml-2">
                                    <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black">
                                        {statusCounts.RISCO_VENCIMENTO} itens
                                    </span>
                                </div>
                            </div>

                            {/* 3. Superestocado */}
                            <div 
                                onClick={() => toggleStatus('SUPERESTOCAGEM')}
                                className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                                    selectedStatuses.SUPERESTOCAGEM 
                                        ? 'bg-purple-50/70 border-purple-300 shadow-2xs ring-2 ring-purple-500/10' 
                                        : 'bg-slate-50/50 border-slate-200 hover:border-slate-300 opacity-60'
                                }`}
                            >
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                                        selectedStatuses.SUPERESTOCAGEM ? 'bg-purple-600 text-white' : 'bg-slate-200 text-slate-500'
                                    }`}>
                                        <AlertTriangle className="w-4 h-4" />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-xs font-black text-slate-900 uppercase">
                                            Superestocado
                                        </div>
                                        <div className="text-[10px] text-slate-500 font-medium truncate">
                                            Estoque acima do ideal
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right shrink-0 ml-2">
                                    <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[10px] font-black">
                                        {statusCounts.SUPERESTOCAGEM} itens
                                    </span>
                                </div>
                            </div>

                            {/* 4. Ideal */}
                            <div 
                                onClick={() => toggleStatus('EQUILIBRADO')}
                                className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                                    selectedStatuses.EQUILIBRADO 
                                        ? 'bg-emerald-50/70 border-emerald-300 shadow-2xs ring-2 ring-emerald-500/10' 
                                        : 'bg-slate-50/50 border-slate-200 hover:border-slate-300 opacity-60'
                                }`}
                            >
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                                        selectedStatuses.EQUILIBRADO ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'
                                    }`}>
                                        <PackageCheck className="w-4 h-4" />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-xs font-black text-slate-900 uppercase">
                                            Ideal
                                        </div>
                                        <div className="text-[10px] text-slate-500 font-medium truncate">
                                            Estoque equilibrado
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right shrink-0 ml-2">
                                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black">
                                        {statusCounts.EQUILIBRADO} itens
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Filtro Opcional de Busca Textual */}
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1 block">
                            Filtrar por nome de medicamento (Opcional):
                        </label>
                        <div className="relative">
                            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                placeholder="Digite para filtrar ainda mais no relatório..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-slate-50/70 border border-slate-200 rounded-xl py-2 pl-9 pr-4 text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:border-purple-500 outline-none transition-all"
                            />
                            {searchTerm && (
                                <button
                                    type="button"
                                    onClick={() => setSearchTerm('')}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Nota de Organização do PDF */}
                    <div className="p-3.5 bg-purple-50/60 border border-purple-200/80 rounded-2xl text-xs text-purple-900 flex items-start gap-2.5">
                        <Sparkles className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                        <div>
                            <span className="font-extrabold uppercase text-[10px] tracking-wider block text-purple-950">
                                Organização Automática do Relatório:
                            </span>
                            <p className="text-[11px] font-medium leading-relaxed mt-0.5">
                                O documento será ordenado por <strong>Tipo de Diagnóstico</strong> (Comprar Urgente → Risco Vencimento → Superestocado → Ideal) e, dentro de cada grupo, em <strong>ordem alfabética</strong> de A a Z.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-3 bg-slate-50/50 shrink-0">
                    <div className="text-xs font-bold text-slate-600">
                        Total para o PDF: <strong className="text-purple-700 font-black">{totalSelected}</strong> {totalSelected === 1 ? 'item' : 'itens'}
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 bg-slate-200/80 hover:bg-slate-300 text-slate-700 font-extrabold text-xs rounded-xl transition-all cursor-pointer uppercase tracking-wider"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            onClick={handleGeneratePdf}
                            disabled={isGenerating || totalSelected === 0}
                            className="px-5 py-2 bg-purple-600 hover:bg-purple-700 active:scale-95 text-white font-extrabold text-xs rounded-xl transition-all flex items-center gap-2 shadow-md shadow-purple-600/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider"
                        >
                            {isGenerating ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>Gerando PDF...</span>
                                </>
                            ) : (
                                <>
                                    <FileDown className="w-4 h-4" />
                                    <span>Baixar Relatório PDF</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
