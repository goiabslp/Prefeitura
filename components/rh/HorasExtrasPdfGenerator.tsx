import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { RhHorasExtras, AppState } from '../../types';
import { PageWrapper } from '../PageWrapper';
import { FileType } from 'lucide-react';

interface HorasExtrasPdfGeneratorProps {
    record: RhHorasExtras;
    state: AppState;
    onClose: () => void;
}

export const HorasExtrasPdfGenerator: React.FC<HorasExtrasPdfGeneratorProps> = ({ record, state, onClose }) => {
    const [isGenerating, setIsGenerating] = useState(false);
    const [progress, setProgress] = useState<{ current: number, total: number } | null>(null);
    const hasStartedRef = useRef(false);

    // Auto-start generation when mounted
    useEffect(() => {
        if (!hasStartedRef.current) {
            hasStartedRef.current = true;
            handleDownloadPdf();
        }
    }, []);

    const handleDownloadPdf = async () => {
        setIsGenerating(true);
        setProgress({ current: 0, total: 1 });

        // Wait for React to render the layout with fonts loaded
        await new Promise(resolve => setTimeout(resolve, 800));

        try {
            const container = document.getElementById('report-pdf-content');
            if (!container) throw new Error("PDF container not found");

            const pages = Array.from(container.children) as HTMLElement[];
            if (pages.length === 0) throw new Error("No pages to render");

            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            for (let i = 0; i < pages.length; i++) {
                const pageEl = pages[i];
                setProgress({ current: i + 1, total: pages.length });
                await new Promise(resolve => setTimeout(resolve, 20));

                const canvas = await html2canvas(pageEl, {
                    scale: 2,
                    useCORS: true,
                    logging: false,
                    scrollY: 0,
                    scrollX: 0
                } as any); // Type cast as workaround for lint if needed, though html2canvas typically supports scale

                const imgData = canvas.toDataURL('image/jpeg', 0.98);
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

                if (i > 0) {
                    pdf.addPage();
                }

                pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
            }

            pdf.save(`HorasExtras_${record.sector.replace(/\s+/g, '_')}_${record.month.replace(/\s+/g, '_')}.pdf`);
            onClose();
        } catch (error) {
            console.error('Error generating PDF:', error);
            alert("Erro ao gerar o PDF de Horas Extras.");
            onClose();
        } finally {
            setIsGenerating(false);
            setProgress(null);
        }
    };

    const validEntries = (record.entries || []).filter(e => e.status !== 'Pendente');
    const sectorEntries = validEntries.filter(e => !e.isCedido).sort((a, b) => a.name.localeCompare(b.name));
    const cedidosEntries = validEntries.filter(e => e.isCedido).sort((a, b) => a.name.localeCompare(b.name));

    const displayItems: { type: 'header' | 'row', title?: string, data?: any }[] = [];
    
    if (sectorEntries.length > 0) {
        displayItems.push({ type: 'header', title: 'Colaboradores do Setor' });
        sectorEntries.forEach(e => displayItems.push({ type: 'row', data: e }));
    }
    
    if (cedidosEntries.length > 0) {
        displayItems.push({ type: 'header', title: 'Colaboradores Cedidos' });
        cedidosEntries.forEach(e => displayItems.push({ type: 'row', data: e }));
    }

    const ITEMS_PER_PAGE = 18;
    const totalPages = Math.ceil(displayItems.length / ITEMS_PER_PAGE);

    const reportState = {
        ...state,
        branding: {
            ...state.branding,
            watermark: {
                ...state.branding?.watermark,
                enabled: false
            }
        }
    };

    const renderPages = () => {
        const pages = [];
        for (let i = 0; i < displayItems.length; i += ITEMS_PER_PAGE) {
            const pageItems = displayItems.slice(i, i + ITEMS_PER_PAGE);
            const pageIndex = Math.floor(i / ITEMS_PER_PAGE) + 1;
            const isLastPage = pageIndex === totalPages;

            pages.push(
                <PageWrapper key={`page-${pageIndex}`} state={reportState} pageIndex={pageIndex} totalPages={totalPages} isGenerating={isGenerating}>
                    <div className="flex flex-col gap-6 h-full pb-8">
                        {/* Compact Header */}
                        <div className="flex flex-col border-b-2 border-slate-900 pb-3 mb-2 mt-4">
                            <h1 className="text-[13pt] font-black uppercase tracking-tight text-slate-900 mb-2">
                                RELATÓRIO DE HORAS EXTRAS
                            </h1>
                            <div className="flex items-center justify-between text-[9pt] font-bold text-slate-700">
                                <div className="flex items-center gap-6">
                                    <div><span className="text-slate-500 font-medium mr-1 uppercase tracking-wider text-[7pt]">Mês de Referência:</span><span className="text-[10pt]">{record.month}</span></div>
                                    <div><span className="text-slate-500 font-medium mr-1 uppercase tracking-wider text-[7pt]">Secretaria / Setor:</span><span className="text-[10pt]">{record.sector}</span></div>
                                </div>
                                <div className="text-[8pt] font-mono bg-slate-100 border border-slate-200 px-2.5 py-1 rounded text-slate-600">
                                    Emissão: {new Date().toLocaleDateString('pt-BR')}
                                </div>
                            </div>
                        </div>

                        {/* Table */}
                        <div>
                            <div className="border border-slate-200 rounded-lg overflow-hidden flex flex-col mt-0">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-slate-900 text-white">
                                        <tr className="text-[8pt] font-black uppercase tracking-widest">
                                            <th className="px-5 py-2 w-[40%] border-r border-slate-700">Colaborador</th>
                                            <th className="px-5 py-2 w-[30%] border-r border-slate-700">Cargo / Função</th>
                                            <th className="px-5 py-2 text-center w-[15%] border-r border-slate-700">Qtd. Horas</th>
                                            <th className="px-5 py-2 text-center w-[15%]">Adic. Noturno</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 uppercase">
                                        {pageItems.map((item, idx) => {
                                            if (item.type === 'header') {
                                                return (
                                                    <tr key={`header-${idx}`} className="bg-slate-200">
                                                        <td colSpan={3} className="px-5 py-2 text-[8pt] font-black text-slate-900 border-y border-slate-300 uppercase tracking-tighter">
                                                            {item.title}
                                                        </td>
                                                    </tr>
                                                );
                                            }
                                            const entry = item.data;
                                            return (
                                                <tr key={idx} className="text-[8pt] font-bold text-slate-700 hover:bg-slate-50/50">
                                                    <td className="px-5 py-1.5 font-black text-slate-900 border-r border-slate-100">{entry.name}</td>
                                                    <td className="px-5 py-1.5 font-medium border-r border-slate-100 text-slate-500">{entry.jobTitle}</td>
                                                    <td className="px-5 py-1.5 text-center font-mono text-fuchsia-700 border-r border-slate-100">{entry.hours ? `${entry.hours}h` : '-'}</td>
                                                    <td className="px-5 py-1.5 text-center font-mono text-indigo-700 bg-slate-50/50">{entry.adicionalNoturno ? `${entry.adicionalNoturno}h` : '-'}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Signature Block - Only on the last page */}
                        {isLastPage && (
                            <div className="mt-8 mb-6 pt-16 flex flex-col items-center text-center relative pointer-events-none">
                                <div className="absolute -top-6 z-0 opacity-90 mix-blend-multiply filter blur-[0.3px]">
                                    <div className="w-52 h-16 border-[2px] border-emerald-600/60 rounded-lg flex items-center justify-center p-1.5 rotate-[-2deg] relative ">
                                        {/* Inner Border */}
                                        <div className="absolute inset-0.5 border border-emerald-600/30 rounded-md"></div>

                                        {/* Content */}
                                        <div className="flex flex-col items-center justify-center pointer-events-none">
                                            <div className="flex items-center gap-1.5 mb-0.5">
                                                <div className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></div>
                                                <span className="text-[10px] font-[900] text-emerald-700 uppercase tracking-tighter font-serif">ASSINADO DIGITALMENTE</span>
                                            </div>
                                            <div className="text-[6px] font-bold text-emerald-800 uppercase tracking-widest flex flex-col items-center leading-tight">
                                                <span>Autenticado via Token 2FA</span>
                                                <span className="mt-0.5 font-mono text-[7px] text-emerald-900 bg-emerald-100/50 px-1 rounded">{record.created_at ? new Date(record.created_at).toLocaleString('pt-BR') : new Date().toLocaleString('pt-BR')}</span>
                                                <span className="text-[5px] text-emerald-600 mt-0.5">ID: {(record.id || 'N/A').substring(0, 18)}...</span>
                                            </div>
                                        </div>

                                        {/* Checkmark Background Watermark */}
                                        <svg className="absolute w-8 h-8 text-emerald-200/40 -z-10" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                                        </svg>
                                    </div>
                                </div>

                                {/* Signature Line Area */}
                                <div className="w-80 border-t border-slate-900 pt-3 flex flex-col gap-0.5 relative z-10 px-2 mt-2">
                                    <p className="font-bold uppercase text-[9pt] tracking-wide text-slate-900 whitespace-normal leading-tight">{record.signature_name}</p>
                                    <p className="text-[8pt] text-slate-600 font-medium whitespace-normal leading-tight">{record.signature_role}</p>
                                    <p className="text-[6pt] text-slate-400 uppercase tracking-[0.1em] whitespace-normal leading-tight">{record.signature_sector}</p>
                                </div>
                            </div>
                        )}
                    </div>
                </PageWrapper>
            );
        }
        return pages;
    };

    return createPortal(
        <div className={`fixed inset-0 z-[9999] bg-slate-900/40 backdrop-blur-xl animate-fade-in ${isGenerating ? 'bg-white' : ''}`}>
            {/* Generation Progress Overlay */}
            {isGenerating && progress && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm pointer-events-none">
                    <div className="bg-white p-8 rounded-3xl flex flex-col items-center max-w-sm w-full shadow-2xl">
                        <FileType className="w-12 h-12 text-indigo-600 mb-4 animate-pulse" />
                        <h3 className="text-lg font-black text-slate-900 mb-2">Gerando PDF</h3>
                        <p className="text-sm font-bold text-slate-500 mb-6">Página {progress.current} de {progress.total}</p>
                        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                                style={{ width: `${Math.max(5, (progress.current / progress.total) * 100)}%` }}
                            />
                        </div>
                        <p className="text-[10px] text-slate-400 mt-4 text-center font-medium">Preparando documento para download. Aguarde um instante.</p>
                    </div>
                </div>
            )}

            <div className={`${isGenerating ? 'absolute top-0 left-0 w-full bg-white z-[9999]' : 'fixed inset-0 overflow-y-auto w-full'} flex items-start justify-center p-4 md:p-8 ${isGenerating ? 'p-0' : ''}`}>
                <div id="report-pdf-content" className={`relative flex flex-col items-center py-12 ${isGenerating ? 'py-0 w-min origin-top-left items-start' : 'w-full max-w-5xl'}`}>
                    {renderPages()}
                </div>
            </div>
        </div>,
        document.body
    );
};
