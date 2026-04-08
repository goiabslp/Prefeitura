import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { AppState } from '../../types';
import { AbastecimentoRecord } from '../../services/abastecimentoService';
import { PageWrapper } from '../PageWrapper';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { Printer, X, FileSpreadsheet, Fuel, Building2, Calendar, LayoutDashboard, Car } from 'lucide-react';
import { formatLocalDate, formatLocalDateTime } from '../../utils/dateUtils';

interface AbastecimentoReportPDFProps {
    data: {
        records: (AbastecimentoRecord & { derivedSector: string; derivedPlate: string })[];
        totalLitersByFuel: Record<string, number>;
        totalValueBySector: Record<string, number>;
        totalValueByFuel: Record<string, number>;
        sectorFuelBreakdown: Record<string, {
            dieselLiters: number;
            dieselValue: number;
            gasolinaLiters: number;
            gasolinaValue: number;
            otherLiters: number;
            otherValue: number;
            totalValue: number;
        }>;
        plateFuelSummary: Record<string, {
            plate: string;
            sector: string;
            fuelType: string;
            totalLiters: number;
            totalValue: number;
        }>;
        grandTotalLiters: number;
        grandTotalValue: number;
    };
    filters: {
        startDate: string;
        endDate: string;
        station: string;
        sector: string;
        vehicle: string;
        fuelType: string;
    };
    state: AppState;
    onClose: () => void;
    mode: 'simplified' | 'complete' | 'listagem' | 'empenhado';
}

export const AbastecimentoReportPDF: React.FC<AbastecimentoReportPDFProps> = ({
    data,
    filters,
    state,
    onClose,
    mode
}) => {
    const [isGenerating, setIsGenerating] = useState(false);
    const [progress, setProgress] = useState<{ current: number, total: number } | null>(null);

    const handleDownloadPdf = async () => {
        setIsGenerating(true);
        setProgress({ current: 0, total: 1 });

        // Wrap timeout in a Promise to properly await React rendering changes
        await new Promise(resolve => setTimeout(resolve, 800));

        try {
            const container = document.getElementById('report-pdf-content');
            if (!container) {
                console.error("PDF container not found");
                return;
            }

            const pages = Array.from(container.children) as HTMLElement[];
            if (pages.length === 0) return;

            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            // Iterate over each page wrapper to avoid browser canvas max-height limits
            for (let i = 0; i < pages.length; i++) {
                const pageEl = pages[i];

                setProgress({ current: i + 1, total: pages.length });
                // Yield to event loop to update progress UI and prevent browser hang
                await new Promise(resolve => setTimeout(resolve, 20));

                const reportScale = pages.length > 20 ? 1.5 : 2;

                const canvas = await html2canvas(pageEl, {
                    scale: reportScale,
                    useCORS: true,
                    logging: false,
                    scrollY: 0,
                    scrollX: 0
                });

                const imgData = canvas.toDataURL('image/jpeg', 0.98);
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

                if (i > 0) {
                    pdf.addPage();
                }

                pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
            }

            pdf.save(`Relatorio-Abastecimento-${new Date().getTime()}.pdf`);
        } catch (error) {
            console.error('Error generating PDF:', error);
        } finally {
            setIsGenerating(false);
            setProgress(null);
        }
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(value);
    };

    const formatNumber = (value: number, decimals: number = 2) => {
        return new Intl.NumberFormat('pt-BR', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        }).format(value);
    };

    // Pagination Logic
    const ITEMS_PER_PAGE = 14;

    // 1. Prepare Detailed Items (Records + Headers + Summaries)
    const sortedRecords = [...data.records].sort((a, b) => {
        if (a.vehicle < b.vehicle) return -1;
        if (a.vehicle > b.vehicle) return 1;
        return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    const detailedItems: Array<any> = [];
    let currentV = '';
    let vLiters = 0;
    let vCost = 0;

    sortedRecords.forEach((r, index) => {
        if (r.vehicle !== currentV) {
            if (currentV !== '') {
                detailedItems.push({ type: 'summary', vehicle: currentV, liters: vLiters, cost: vCost });
                detailedItems.push({ type: 'spacer' });
                detailedItems.push({ type: 'header' });
            }
            currentV = r.vehicle;
            vLiters = 0;
            vCost = 0;
        }
        vLiters += r.liters;
        vCost += r.cost;
        detailedItems.push({ type: 'record', ...r });
        if (index === sortedRecords.length - 1) {
            detailedItems.push({ type: 'summary', vehicle: currentV, liters: vLiters, cost: vCost });
        }
    });

    // 2. Prepare Plate Summary Items (Grouped by Sector)
    const rawPlateItems = (Object.entries(data.plateFuelSummary || {}) as [string, any][])
        .map(([_, v]) => v)
        .sort((a, b) => {
            if (a.sector < b.sector) return -1;
            if (a.sector > b.sector) return 1;
            return a.plate.localeCompare(b.plate);
        });

    const PLATE_ITEMS_PER_PAGE = 22;
    const plateSummaryItems: Array<any> = [];
    let currentS = '';

    rawPlateItems.forEach((item) => {
        if (item.sector !== currentS) {
            if (currentS !== '') plateSummaryItems.push({ type: 'spacer' });
            currentS = item.sector;
            plateSummaryItems.push({ type: 'sectorHeader', sector: currentS });
        }
        plateSummaryItems.push({ type: 'item', ...item });
    });

    const totalPlatePages = (mode === 'listagem' || mode === 'empenhado') ? 0 : (Math.ceil(plateSummaryItems.length / PLATE_ITEMS_PER_PAGE) || 1);
    const totalDetailPages = mode === 'complete' ? (Math.ceil(detailedItems.length / ITEMS_PER_PAGE) || 1) : 0;

    // 3. Prepare Consolidated Items
    const CONSOLIDATED_ITEMS_PER_PAGE = 26;
    const consolidatedItems = [...data.records].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const totalConsolidatedPages = mode === 'complete' ? (Math.ceil(consolidatedItems.length / CONSOLIDATED_ITEMS_PER_PAGE) || 1) : 0;

    // 4. Prepare Listagem Items (Grouped by Sector)
    const listagemRecords = [...data.records].sort((a, b) => {
        if (a.derivedSector < b.derivedSector) return -1;
        if (a.derivedSector > b.derivedSector) return 1;
        if (a.vehicle < b.vehicle) return -1;
        if (a.vehicle > b.vehicle) return 1;
        return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    const LISTAGEM_ITEMS_PER_PAGE = 18;
    const listagemPages: Array<Array<any>> = [];
    let currentListagemPage: Array<any> = [];

    let lSector = '';
    let lSectorLiters = 0;
    let lSectorCost = 0;
    let sectorPageCount = 1;

    listagemRecords.forEach((r, index) => {
        const isNewSector = r.derivedSector !== lSector;

        if (isNewSector) {
            // Close previous sector
            if (lSector !== '') {
                currentListagemPage.push({ type: 'sectorSummary', sector: lSector, liters: lSectorLiters, cost: lSectorCost });
                listagemPages.push([...currentListagemPage]);
                currentListagemPage = [];
            }
            lSector = r.derivedSector;
            lSectorLiters = 0;
            lSectorCost = 0;
            sectorPageCount = 1;

            currentListagemPage.push({ type: 'sectorHeader', sector: lSector, sectorPage: sectorPageCount });
            currentListagemPage.push({ type: 'tableHeader' });
        } else if (currentListagemPage.length >= LISTAGEM_ITEMS_PER_PAGE) {
            // Overflow within the same sector, force a new page
            listagemPages.push([...currentListagemPage]);
            currentListagemPage = [];
            sectorPageCount++;
            // Re-add headers for continuity
            currentListagemPage.push({ type: 'sectorHeader', sector: lSector, sectorPage: sectorPageCount });
            currentListagemPage.push({ type: 'tableHeader' });
        }

        lSectorLiters += r.liters;
        lSectorCost += r.cost;

        currentListagemPage.push({ type: 'record', ...r });

        if (index === listagemRecords.length - 1) {
            currentListagemPage.push({ type: 'sectorSummary', sector: lSector, liters: lSectorLiters, cost: lSectorCost });
            listagemPages.push([...currentListagemPage]);
        }
    });

    // Second pass: Update sectorHeader items with total pages for that sector
    const sectorTotalPagesMap = new Map<string, number>();
    listagemPages.forEach(page => {
        page.forEach(item => {
            if (item.type === 'sectorHeader') {
                sectorTotalPagesMap.set(item.sector, Math.max(sectorTotalPagesMap.get(item.sector) || 0, item.sectorPage));
            }
        });
    });

    listagemPages.forEach(page => {
        page.forEach(item => {
            if (item.type === 'sectorHeader') {
                item.sectorTotalPages = sectorTotalPagesMap.get(item.sector) || 1;
            }
        });
    });

    const totalListagemPages = (mode === 'listagem' || mode === 'empenhado') ? (listagemPages.length || 1) : 0;
    const totalSectorBreakdownPages = 1;

    const globalTotalPages = 1 + totalSectorBreakdownPages + totalPlatePages + totalDetailPages + totalListagemPages + totalConsolidatedPages;

    // Create a state copy without watermark for the report
    const reportState = {
        ...state,
        branding: {
            ...state.branding,
            watermark: {
                ...state.branding.watermark,
                enabled: false
            }
        }
    };

    const renderSummaryPage = () => (
        <PageWrapper state={reportState} pageIndex={0} totalPages={globalTotalPages} isGenerating={isGenerating}>
            <div className="flex flex-col gap-6">
                {/* Main Header */}
                <div className="flex items-center justify-between border-b-2 border-slate-900 pb-4">
                    <div>
                        <h1 className="text-[18pt] font-black uppercase tracking-tight text-slate-900">Relatório de Abastecimentos</h1>
                        <p className="text-[10pt] font-bold text-slate-500 uppercase tracking-widest mt-1">Consolidação de Consumo e Custos</p>
                    </div>
                    <div className="text-right">
                        <div className="bg-slate-900 text-white px-4 py-2 rounded-lg">
                            <p className="text-[7pt] font-black uppercase opacity-60">Data de Emissão</p>
                            <p className="text-[11pt] font-mono font-bold">{new Date().toLocaleDateString('pt-BR')}</p>
                        </div>
                    </div>
                </div>

                {/* Filters Summary */}
                <div className="grid grid-cols-3 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <div className="col-span-3 pb-2 border-b border-slate-200 mb-2">
                        <h3 className="text-[8pt] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                            <Calendar className="w-3 h-3" /> Parâmetros do Relatório
                        </h3>
                    </div>
                    <div>
                        <p className="text-[9pt] font-bold text-slate-700">
                            {filters.startDate ? formatLocalDate(filters.startDate) : 'Início'}
                            <span className="mx-2 opacity-30">até</span>
                            {filters.endDate ? formatLocalDate(filters.endDate) : 'Hoje'}
                        </p>
                    </div>
                    <div>
                        <p className="text-[7pt] font-black text-slate-400 uppercase">Posto / Combustível</p>
                        <p className="text-[9pt] font-bold text-slate-700 capitalize">
                            {filters.station === 'all' ? 'Todos os Postos' : filters.station}
                            <span className="mx-1 opacity-30">|</span>
                            {filters.fuelType === 'all' ? 'Todos' : filters.fuelType}
                        </p>
                    </div>
                    <div>
                        <p className="text-[7pt] font-black text-slate-400 uppercase">Setor / Veículo</p>
                        <p className="text-[9pt] font-bold text-slate-700">
                            {filters.sector === 'all' ? 'Todos os Setores' : filters.sector}
                            <span className="mx-1 opacity-30">|</span>
                            {filters.vehicle === 'all' ? 'Todos' : filters.vehicle}
                        </p>
                    </div>
                </div>

                {/* Grand Totals */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-900 p-6 rounded-[2rem] text-white flex items-center justify-between overflow-hidden relative">
                        <FileSpreadsheet className="absolute right-[-10%] top-[-20%] w-32 h-32 opacity-10" />
                        <div className="relative z-10">
                            <p className="text-[8pt] font-black uppercase tracking-[0.2em] text-indigo-400 mb-2">Volume Total (L)</p>
                            <p className="text-4xl font-black tracking-tighter">{formatNumber(data.grandTotalLiters)} <span className="text-xl text-slate-500">L</span></p>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-[2rem] border-2 border-slate-900 flex items-center justify-between overflow-hidden relative">
                        <LayoutDashboard className="absolute right-[-10%] top-[-20%] w-32 h-32 opacity-5 text-slate-900" />
                        <div className="relative z-10">
                            <p className="text-[8pt] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Investimento Total</p>
                            <p className="text-4xl font-black tracking-tighter text-slate-900">{formatCurrency(data.grandTotalValue)}</p>
                        </div>
                    </div>
                </div>

                {/* Breakdown Grid - Fuel Summary Only */}
                <div className="flex flex-col gap-8">
                    {/* Fuel Breakdown - Top Small Table */}
                    <div className="space-y-4">
                        <h3 className="text-[10pt] font-black uppercase tracking-[0.15em] text-slate-900 flex items-center gap-2">
                            <Fuel className="w-4 h-4 text-indigo-600" /> Resumo por Combustível
                        </h3>
                        <div className="border border-slate-200 rounded-2xl overflow-hidden max-w-2xl">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr className="text-[7pt] font-black uppercase tracking-widest text-slate-500">
                                        <th className="px-6 py-2">Tipo</th>
                                        <th className="px-6 py-2 text-right">Volume (L)</th>
                                        <th className="px-6 py-2 text-right">Valor (R$)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {Object.entries(data.totalLitersByFuel).map(([fuel, liters]) => (
                                        <tr key={fuel} className="text-[8pt] font-bold text-slate-700">
                                            <td className="px-6 py-3 uppercase">{fuel}</td>
                                            <td className="px-6 py-3 text-right whitespace-nowrap">{formatNumber(liters as number)}</td>
                                            <td className="px-6 py-3 text-right whitespace-nowrap">{formatCurrency(data.totalValueByFuel[fuel] as number)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

            </div>
        </PageWrapper>
    );

    const renderSectorBreakdownPage = () => (
        <PageWrapper state={reportState} pageIndex={1} totalPages={globalTotalPages} isGenerating={isGenerating}>
            <div className="flex flex-col gap-6">
                <div className="flex items-center justify-between border-b-2 border-slate-900 pb-4">
                    <h2 className="text-[14pt] font-black uppercase tracking-tighter text-slate-900 flex items-center gap-3">
                        <Building2 className="w-6 h-6 text-indigo-600" /> Detalhamento por Secretaria / Setor
                    </h2>
                    <p className="text-[8pt] text-slate-500 font-bold uppercase tracking-widest leading-none">Página 2 de {globalTotalPages}</p>
                </div>

                <div className="space-y-4">
                    <h3 className="text-[10pt] font-black uppercase tracking-[0.15em] text-slate-900 flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-indigo-600" /> Por Secretaria / Setor (Detalhamento de Combustível)
                    </h3>
                    <div className="border border-slate-200 rounded-2xl overflow-hidden">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-50 border-b border-slate-200 text-[6pt] font-black uppercase tracking-widest text-slate-500">
                                <tr>
                                    <th className="px-3 py-3 border-r border-slate-100" rowSpan={2}>Secretaria / Setor</th>
                                    <th className="px-3 py-1 text-center border-r border-indigo-200 bg-indigo-900 text-white" colSpan={2}>Diesel</th>
                                    <th className="px-3 py-1 text-center border-r border-sky-100 bg-sky-50 text-sky-900" colSpan={2}>Gasolina</th>
                                    <th className="px-3 py-3 text-right" rowSpan={2}>Gasto Total</th>
                                </tr>
                                <tr className="text-[5pt]">
                                    <th className="px-2 py-1 text-right border-r border-indigo-50 bg-indigo-50/30 text-indigo-900">L (Litros)</th>
                                    <th className="px-2 py-1 text-right border-r border-indigo-50 bg-indigo-50/30 text-indigo-900">R$ (Valor)</th>
                                    <th className="px-2 py-1 text-right border-r border-sky-50 bg-sky-50/50 text-sky-700">L (Litros)</th>
                                    <th className="px-2 py-1 text-right border-r border-sky-50 bg-sky-50/50 text-sky-700">R$ (Valor)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {(Object.entries(data.sectorFuelBreakdown || {}) as [string, any][])
                                    .sort((a, b) => b[1].totalValue - a[1].totalValue)
                                    .map(([sector, details]) => (
                                        <tr key={sector} className="text-[7pt] font-bold text-slate-700">
                                            <td className="px-3 py-2 uppercase border-r border-slate-50 font-black text-slate-900 whitespace-nowrap">{sector}</td>
                                            <td className="px-2 py-2 text-right border-r border-indigo-50 bg-indigo-50/20 text-indigo-950 whitespace-nowrap">{formatNumber(details.dieselLiters)}</td>
                                            <td className="px-2 py-2 text-right border-r border-indigo-50 bg-indigo-50/20 text-indigo-950 whitespace-nowrap">{formatCurrency(details.dieselValue)}</td>
                                            <td className="px-2 py-2 text-right border-r border-sky-50 bg-sky-50/20 text-sky-600 whitespace-nowrap">{formatNumber(details.gasolinaLiters)}</td>
                                            <td className="px-2 py-2 text-right border-r border-sky-50 bg-sky-50/20 text-sky-600 whitespace-nowrap">{formatCurrency(details.gasolinaValue)}</td>
                                            <td className="px-3 py-2 text-right font-black text-slate-900 bg-slate-100/50 whitespace-nowrap">{formatCurrency(details.totalValue)}</td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </PageWrapper>
    );

    const renderPlateSummaryPages = () => {
        const pages = [];
        for (let i = 0; i < plateSummaryItems.length; i += PLATE_ITEMS_PER_PAGE) {
            const pageItems = plateSummaryItems.slice(i, i + PLATE_ITEMS_PER_PAGE);
            const pageIndex = Math.floor(i / PLATE_ITEMS_PER_PAGE) + 1 + totalSectorBreakdownPages;

            pages.push(
                <PageWrapper key={`plate-${pageIndex}`} state={reportState} pageIndex={pageIndex} totalPages={globalTotalPages} isGenerating={isGenerating}>
                    <div className="flex flex-col gap-6 h-full">
                        <div className="flex items-center justify-between border-b-2 border-slate-900 pb-4">
                            <h2 className="text-[14pt] font-black uppercase tracking-tighter text-slate-900 flex items-center gap-3">
                                <Building2 className="w-6 h-6 text-indigo-600" /> Resumo por Secretaria / Setor
                            </h2>
                            <p className="text-[8pt] text-slate-500 font-bold uppercase tracking-widest leading-none">Página {pageIndex + 1} de {globalTotalPages}</p>
                        </div>

                        <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm flex flex-col">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-900 text-white">
                                    <tr className="text-[7pt] font-black uppercase tracking-widest">
                                        <th className="px-6 py-4 w-[30%]">Placa / Veículo</th>
                                        <th className="px-6 py-4 w-[25%]">Combustível</th>
                                        <th className="px-6 py-4 text-right w-[20%]">Volume (L)</th>
                                        <th className="px-6 py-4 text-right w-[25%]">Valor Total (R$)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {pageItems.map((item, idx) => {
                                        if (item.type === 'spacer') {
                                            return <tr key={`sp-${idx}`} className="h-2 bg-slate-50/50" />;
                                        }
                                        if (item.type === 'sectorHeader') {
                                            return (
                                                <tr key={`sh-${idx}`} className="bg-slate-100 border-y-2 border-slate-900">
                                                    <td colSpan={4} className="px-5 py-1.5 text-[8pt] font-black text-slate-900 uppercase tracking-widest flex items-center gap-2 whitespace-nowrap overflow-hidden">
                                                        <span className="w-1.5 h-4 bg-slate-900 rounded-full" />
                                                        {item.sector}
                                                    </td>
                                                </tr>
                                            );
                                        }
                                        return (
                                            <tr key={`it-${idx}`} className="text-[7.5pt] font-bold text-slate-700 hover:bg-slate-50/50">
                                                <td className="px-5 py-1.5 font-black text-slate-900 uppercase">{item.plate}</td>
                                                <td className="px-5 py-1.5 uppercase text-slate-400 font-mono text-[7pt]">{item.fuelType}</td>
                                                <td className="px-5 py-1.5 text-right text-indigo-700 whitespace-nowrap">{formatNumber(item.totalLiters)} L</td>
                                                <td className="px-5 py-1.5 text-right font-black text-slate-900 bg-slate-50/30 border-l border-slate-100 whitespace-nowrap">{formatCurrency(item.totalValue)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </PageWrapper>
            );
        }
        return pages;
    };

    const renderRecordPages = () => {
        const pages = [];

        for (let i = 0; i < detailedItems.length; i += ITEMS_PER_PAGE) {
            const pageItems = detailedItems.slice(i, i + ITEMS_PER_PAGE);
            const pageIndex = Math.floor(i / ITEMS_PER_PAGE) + 1 + totalSectorBreakdownPages + totalPlatePages;

            pages.push(
                <PageWrapper key={`rec-${pageIndex}`} state={reportState} pageIndex={pageIndex} totalPages={globalTotalPages} isGenerating={isGenerating}>
                    <div className="flex flex-col h-full">
                        <div className="pb-4 border-b border-slate-200 mb-6">
                            <h2 className="text-[12pt] font-black uppercase text-slate-900">Listagem de Abastecimentos</h2>
                            <p className="text-[8pt] text-slate-500 font-bold uppercase tracking-widest leading-none">Página {pageIndex}</p>
                        </div>

                        <table className="w-full border-collapse">
                            <thead className="bg-slate-50 border-y border-slate-200">
                                <tr className="text-[7pt] font-black uppercase tracking-widest text-slate-500">
                                    <th className="px-3 py-2 text-left w-[12%]">Data</th>
                                    <th className="px-3 py-2 text-left w-[15%]">Nº Nota</th>
                                    <th className="px-3 py-2 text-left w-[25%]">Veículo</th>
                                    <th className="px-3 py-2 text-left w-[25%]">Setor</th>
                                    <th className="px-3 py-2 text-left w-[8%]">Litros</th>
                                    <th className="px-3 py-2 text-left w-[15%] whitespace-nowrap">Custo (R$)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {pageItems.map((item, idx) => {
                                    if (item.type === 'spacer') {
                                        return (
                                            <tr key={`spc-${idx}`} className="h-6 border-none bg-transparent">
                                                <td colSpan={6}></td>
                                            </tr>
                                        );
                                    }
                                    if (item.type === 'header') {
                                        if (idx === 0) return null;
                                        return (
                                            <tr key={`hdr-${idx}`} className="bg-slate-200/50 border-y border-slate-300">
                                                <th className="px-3 py-2 text-left w-[12%] text-[7pt] font-black uppercase tracking-widest text-slate-600">Data</th>
                                                <th className="px-3 py-2 text-left w-[15%] text-[7pt] font-black uppercase tracking-widest text-slate-600">Nº Nota</th>
                                                <th className="px-3 py-2 text-left w-[25%] text-[7pt] font-black uppercase tracking-widest text-slate-600">Veículo</th>
                                                <th className="px-3 py-2 text-left w-[25%] text-[7pt] font-black uppercase tracking-widest text-slate-600">Setor</th>
                                                <th className="px-3 py-2 text-left w-[8%] text-[7pt] font-black uppercase tracking-widest text-slate-600">Litros</th>
                                                <th className="px-3 py-2 text-left w-[15%] text-[7pt] font-black uppercase tracking-widest text-slate-600 whitespace-nowrap">Custo (R$)</th>
                                            </tr>
                                        );
                                    }
                                    if (item.type === 'summary') {
                                        return (
                                            <tr key={`sum-${idx}`} className="bg-slate-100/80 border-t-2 border-slate-200">
                                                <td colSpan={4} className="px-3 py-3 text-right text-[8pt] font-black text-slate-900 uppercase tracking-wide">
                                                    TOTAL
                                                </td>
                                                <td className="px-3 py-3 text-[8pt] font-black text-slate-900">
                                                    {formatNumber(item.liters)} L
                                                </td>
                                                <td className="px-3 py-3 text-[8pt] font-black text-slate-900 whitespace-nowrap">
                                                    {formatCurrency(item.cost)}
                                                </td>
                                            </tr>
                                        );
                                    }
                                    const r = item;
                                    return (
                                        <tr key={idx} className="text-[7.5pt] font-medium text-slate-700">
                                            <td className="px-3 py-2">{formatLocalDate(r.date)}</td>
                                            <td className="px-3 py-2 uppercase truncate font-mono text-[9px]">{r.invoiceNumber || '-'}</td>
                                            <td className="px-3 py-2 uppercase">
                                                <p className="font-bold leading-none">{r.vehicle}</p>
                                                <p className="text-[5.5pt] text-slate-400 font-bold mt-0.5">{r.derivedPlate}</p>
                                            </td>
                                            <td className="px-3 py-2 uppercase whitespace-nowrap text-[7pt] font-bold text-slate-500 leading-tight">{r.derivedSector}</td>
                                            <td className="px-3 py-2 px-3 py-2 whitespace-nowrap">{formatNumber(r.liters)} L</td>
                                            <td className="px-3 py-2 font-bold text-slate-900 whitespace-nowrap">{formatCurrency(r.cost)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </PageWrapper>
            );
        }
        return pages;
    };

    const renderListagemPages = () => {
        if (listagemPages.length === 0) return [];
        return listagemPages.map((pageItems, idx) => {
            const pageIndex = idx + 1 + totalSectorBreakdownPages + totalPlatePages + totalDetailPages;

            return (
                <PageWrapper key={`list-${pageIndex}`} state={reportState} pageIndex={pageIndex} totalPages={globalTotalPages} isGenerating={isGenerating}>
                    <div className="flex flex-col h-full">
                        <div className="pb-4 border-b border-slate-200 mb-6">
                            <h2 className="text-[12pt] font-black uppercase text-slate-900">Listagem Agrupada por Setor</h2>
                            <p className="text-[8pt] text-slate-500 font-bold uppercase tracking-widest leading-none">Página {pageIndex}</p>
                        </div>

                        <table className="w-full border-collapse table-fixed">
                            <colgroup>
                                <col className="w-[7%]" />
                                <col className="w-[12%]" />
                                <col className="w-[28%]" />
                                <col className="w-[23%]" />
                                <col className="w-[15%]" />
                                <col className="w-[15%]" />
                            </colgroup>
                            <tbody className="divide-y divide-slate-100">
                                {pageItems.map((item, idx) => {
                                    if (item.type === 'spacer') {
                                        return <tr key={`spc-${idx}`} className="h-4 border-none bg-transparent"><td colSpan={6}></td></tr>;
                                    }
                                    if (item.type === 'sectorHeader') {
                                        const paginationText = item.sectorTotalPages > 1 ? ` - Pág ${item.sectorPage} de ${item.sectorTotalPages}` : '';
                                        return (
                                            <tr key={`sh-${idx}`} className="bg-slate-100 border-y-2 border-slate-200">
                                                <td colSpan={6} className="px-4 py-3 text-[10pt] font-black text-slate-900 uppercase tracking-widest flex items-center gap-3 whitespace-nowrap">
                                                    <Building2 className="w-4 h-4 text-slate-500 shrink-0" />
                                                    {item.sector}{paginationText}
                                                </td>
                                            </tr>
                                        );
                                    }
                                    if (item.type === 'tableHeader') {
                                        return (
                                            <tr key={`th-${idx}`} className="bg-slate-50 border-b border-slate-200 text-[5.5pt] font-black uppercase tracking-widest text-slate-500">
                                                <th className="px-2 py-2 text-center w-[7%]">Nº Nota</th>
                                                <th className="px-2 py-2 text-center w-[12%]">Data</th>
                                                <th className="px-2 py-2 text-left w-[28%]">Veículo/Motorista</th>
                                                <th className="px-2 py-2 text-left w-[23%]">Combustível</th>
                                                <th className="px-2 py-2 text-right w-[15%]">Vol (L)</th>
                                                <th className="px-2 py-2 text-right w-[15%]">Valor (R$)</th>
                                            </tr>
                                        );
                                    }
                                    if (item.type === 'sectorSummary') {
                                        return (
                                            <tr key={`ss-${idx}`} className="bg-slate-800 border-t-2 border-slate-900">
                                                <td colSpan={4} className="px-3 py-3 text-right text-[7pt] font-black text-white uppercase">Total do Setor</td>
                                                <td className="px-3 py-3 text-right text-[7.5pt] font-black text-white whitespace-nowrap">{formatNumber(item.liters)}</td>
                                                <td className="px-3 py-3 text-right text-[7.5pt] font-black text-white whitespace-nowrap">{formatCurrency(item.cost)}</td>
                                            </tr>
                                        );
                                    }

                                    const formatDriver = (name: string) => {
                                        if (!name) return '-';
                                        const parts = name.trim().split(' ');
                                        return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1]}` : parts[0];
                                    };

                                    return (
                                        <tr key={idx} className="text-[7pt] font-medium text-slate-700">
                                            <td className="px-2 py-2 font-mono text-[8.5px] text-center whitespace-nowrap">{item.invoiceNumber || '-'}</td>
                                            <td className="px-2 py-2 whitespace-nowrap text-center text-[6.5pt]">{new Date(item.date).toLocaleDateString('pt-BR')}</td>
                                            <td className="px-2 py-2 uppercase">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-slate-900 leading-none truncate max-w-[130px]" title={item.vehicle}>{item.vehicle}</span>
                                                    <span className="text-[6pt] text-slate-500 font-bold mt-0.5 truncate max-w-[130px]">{formatDriver(item.driver)}</span>
                                                </div>
                                            </td>
                                            <td className="px-2 py-2 uppercase text-[6pt] text-slate-500 font-bold max-w-[90px] break-words" title={item.fuelType}>{item.fuelType}</td>
                                            <td className="px-2 py-2 text-right font-bold whitespace-nowrap text-[7.5pt]">{formatNumber(item.liters)}</td>
                                            <td className="px-2 py-2 text-right font-black text-slate-900 whitespace-nowrap text-[7.5pt]">{formatCurrency(item.cost)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </PageWrapper>
            );
        });
    };

    const renderConsolidatedPages = () => {
        const pages = [];
        for (let i = 0; i < consolidatedItems.length; i += CONSOLIDATED_ITEMS_PER_PAGE) {
            const pageItems = consolidatedItems.slice(i, i + CONSOLIDATED_ITEMS_PER_PAGE);
            const pageIndex = Math.floor(i / CONSOLIDATED_ITEMS_PER_PAGE) + 1 + totalSectorBreakdownPages + totalPlatePages + totalDetailPages;

            pages.push(
                <PageWrapper key={`cons-${pageIndex}`} state={reportState} pageIndex={pageIndex} totalPages={globalTotalPages} isGenerating={isGenerating}>
                    <div className="flex flex-col h-full">
                        <div className="pb-4 border-b border-slate-200 mb-6">
                            <h2 className="text-[12pt] font-black uppercase text-slate-900">Consolidado Geral</h2>
                            <p className="text-[8pt] text-slate-500 font-bold uppercase tracking-widest leading-none">Página {pageIndex}</p>
                        </div>

                        <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm flex flex-col">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr className="text-[7pt] font-black uppercase tracking-widest text-slate-500">
                                        <th className="px-4 py-3 w-[20%]">Data / Nota</th>
                                        <th className="px-4 py-3 w-[40%]">Veículo / Placa</th>
                                        <th className="px-4 py-3 text-right w-[15%]">Litros</th>
                                        <th className="px-4 py-3 text-right w-[25%]">Valor Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {pageItems.map((r, idx) => (
                                        <tr key={idx} className="text-[7.5pt] font-medium text-slate-700 hover:bg-slate-50/50">
                                            <td className="px-4 py-2">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-slate-900">{new Date(r.date).toLocaleDateString('pt-BR')}</span>
                                                    <span className="text-[9px] font-mono text-slate-400 uppercase">{r.invoiceNumber || '-'}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-2 uppercase">
                                                <span className="font-bold text-slate-800">{r.vehicle}</span>
                                                <span className="block text-[6pt] text-slate-400 font-bold tracking-wider">{r.derivedPlate}</span>
                                            </td>
                                            <td className="px-4 py-2 text-right text-indigo-700 font-bold whitespace-nowrap">{formatNumber(r.liters)} L</td>
                                            <td className="px-4 py-2 text-right font-black text-slate-900 whitespace-nowrap">{formatCurrency(r.cost)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </PageWrapper>
            );
        }
        return pages;
    };

    return createPortal(
        <div className={`fixed inset-0 z-[9999] bg-slate-900/40 backdrop-blur-xl animate-fade-in ${isGenerating ? 'bg-white' : ''}`}>
            {/* Action Bar */}
            {!isGenerating && (
                <div className="fixed top-4 left-4 right-4 md:top-8 md:left-8 md:right-8 flex items-center justify-between z-[100] pointer-events-none">
                    <div className="pointer-events-auto">
                        <button
                            onClick={handleDownloadPdf}
                            disabled={isGenerating}
                            className="group px-4 py-3 md:px-6 md:py-4 bg-slate-900 hover:bg-black text-white font-black uppercase tracking-widest text-[9px] md:text-[11px] rounded-xl md:rounded-2xl transition-all shadow-2xl active:scale-95 flex items-center gap-2 md:gap-3 border border-white/10 disabled:opacity-50"
                        >
                            <Printer className="w-4 h-4 md:w-5 md:h-5 group-hover:scale-110 transition-transform" />
                            <span>{isGenerating ? 'Gerando...' : 'Baixar PDF'}</span>
                        </button>
                    </div>

                    <div className="pointer-events-auto">
                        <button
                            onClick={onClose}
                            className="group px-4 py-3 md:px-6 md:py-4 bg-white hover:bg-rose-50 text-slate-500 hover:text-rose-600 font-black uppercase tracking-widest text-[9px] md:text-[11px] rounded-xl md:rounded-2xl transition-all shadow-2xl border border-slate-200 active:scale-95 flex items-center gap-2 md:gap-3"
                        >
                            <X className="w-4 h-4 md:w-5 md:h-5 group-hover:rotate-90 transition-transform" />
                            <span>Fechar</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Generation Progress Overlay */}
            {isGenerating && progress && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm pointer-events-none">
                    <div className="bg-white p-8 rounded-3xl flex flex-col items-center max-w-sm w-full shadow-2xl">
                        <Printer className="w-12 h-12 text-indigo-600 mb-4 animate-pulse" />
                        <h3 className="text-lg font-black text-slate-900 mb-2">Gerando PDF</h3>
                        <p className="text-sm font-bold text-slate-500 mb-6">Página {progress.current} de {progress.total}</p>
                        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                                style={{ width: `${Math.max(5, (progress.current / progress.total) * 100)}%` }}
                            />
                        </div>
                        <p className="text-[10px] text-slate-400 mt-4 text-center font-medium">Isso pode levar alguns minutos em relatórios completos dependendo do volume de dados.</p>
                    </div>
                </div>
            )}

            <div className={`${isGenerating ? 'absolute top-0 left-0 w-full bg-white z-[9999]' : 'fixed inset-0 overflow-y-auto w-full'} flex items-start justify-center p-4 md:p-8 ${isGenerating ? 'p-0' : ''}`}>
                <div id="report-pdf-content" className={`relative flex flex-col items-center py-12 ${isGenerating ? 'py-0 w-min origin-top-left items-start' : 'w-full max-w-5xl'}`}>
                    {renderSummaryPage()}
                    {renderSectorBreakdownPage()}
                    {mode !== 'listagem' && mode !== 'empenhado' && renderPlateSummaryPages()}
                    {mode === 'complete' && renderRecordPages()}
                    {(mode === 'listagem' || mode === 'empenhado') && renderListagemPages()}
                    {mode === 'complete' && renderConsolidatedPages()}
                </div>
            </div>
        </div>,
        document.body
    );
};
