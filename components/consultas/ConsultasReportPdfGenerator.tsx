import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { ConsultaAgendamento, ConsultaProcedimento, AppState, User } from '../../types';
import { PageWrapper } from '../PageWrapper';
import { FileType, Calendar, User as UserIcon, Clock } from 'lucide-react';

interface ConsultasReportPdfGeneratorProps {
    reportType: 'completo' | 'fila';
    bookings: ConsultaAgendamento[];
    procedures: ConsultaProcedimento[];
    queuePositions: Record<string, number>;
    state: AppState;
    currentUser: User;
    onClose: () => void;
}

type FlatItem =
    | { type: 'proc_header'; label: string }
    | { type: 'priority_header'; label: string }
    | { type: 'status_header'; label: string }
    | { type: 'booking'; data: ConsultaAgendamento };

export const ConsultasReportPdfGenerator: React.FC<ConsultasReportPdfGeneratorProps> = ({
    reportType,
    bookings,
    procedures,
    queuePositions,
    state,
    currentUser,
    onClose
}) => {
    const [isGenerating, setIsGenerating] = useState(false);
    const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
    const hasStartedRef = useRef(false);

    useEffect(() => {
        if (!hasStartedRef.current) {
            hasStartedRef.current = true;
            handleDownloadPdf();
        }
    }, []);

    const formatDateBr = (d: string) => {
        if (!d) return '';
        const parts = d.split('-');
        if (parts.length !== 3) return d;
        const [year, month, day] = parts;
        return `${day}/${month}/${year}`;
    };

    const handleDownloadPdf = async () => {
        setIsGenerating(true);
        setProgress({ current: 0, total: 1 });

        // Wait for React to render the layout with styles and fonts loaded
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
                await new Promise(resolve => setTimeout(resolve, 50));

                const canvas = await html2canvas(pageEl, {
                    scale: 2,
                    useCORS: true,
                    logging: false,
                    scrollY: 0,
                    scrollX: 0
                } as any);

                const imgData = canvas.toDataURL('image/jpeg', 0.95);
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

                if (i > 0) {
                    pdf.addPage();
                }

                pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
            }

            const prefix = reportType === 'completo' ? 'Relatorio_Completo_Agendamentos' : 'Relatorio_Fila_Espera';
            const timestamp = new Date().toISOString().split('T')[0];
            pdf.save(`${prefix}_${timestamp}.pdf`);
            onClose();
        } catch (error) {
            console.error('Error generating PDF:', error);
            alert("Erro ao gerar o relatório em PDF.");
            onClose();
        } finally {
            setIsGenerating(false);
            setProgress(null);
        }
    };

    // Prepare flattened list of items
    const displayItems: FlatItem[] = [];

    if (reportType === 'completo') {
        // Group by Procedure Type (Exame / Consulta)
        const byType: Record<string, ConsultaAgendamento[]> = {};
        bookings.forEach(b => {
            const t = b.procedimento?.type || 'NÃO DEFINIDO';
            if (!byType[t]) byType[t] = [];
            byType[t].push(b);
        });

        const sortedTypes = Object.keys(byType).sort();
        sortedTypes.forEach(t => {
            displayItems.push({ type: 'proc_header', label: t.toUpperCase() });

            // Group by Priority (Urgência / Retorno / Normal)
            const byPriority: Record<string, ConsultaAgendamento[]> = {
                'Urgência': [],
                'Retorno': [],
                'Normal': []
            };

            byType[t].forEach(b => {
                const p = b.priority === 'Urgência' ? 'Urgência' : b.is_retorno ? 'Retorno' : 'Normal';
                byPriority[p].push(b);
            });

            const priorities = ['Urgência', 'Retorno', 'Normal'];
            priorities.forEach(p => {
                const pBookings = byPriority[p];
                if (pBookings.length === 0) return;

                displayItems.push({ type: 'priority_header', label: `PRIORIDADE: ${p.toUpperCase()}` });

                // Group by Status
                const byStatus: Record<string, ConsultaAgendamento[]> = {};
                pBookings.forEach(b => {
                    const s = b.status || 'SOLICITADO';
                    if (!byStatus[s]) byStatus[s] = [];
                    byStatus[s].push(b);
                });

                const sortedStatuses = Object.keys(byStatus).sort();
                sortedStatuses.forEach(s => {
                    const sBookings = byStatus[s];
                    if (sBookings.length === 0) return;

                    displayItems.push({ type: 'status_header', label: `STATUS: ${s.toUpperCase()}` });

                    // Sort alphabetically by patient name
                    const sortedBookings = [...sBookings].sort((a, b) => {
                        const nameA = a.paciente?.name || '';
                        const nameB = b.paciente?.name || '';
                        return nameA.localeCompare(nameB);
                    });

                    sortedBookings.forEach(b => {
                        displayItems.push({ type: 'booking', data: b });
                    });
                });
            });
        });
    } else {
        // Waitlist Report: Group by Procedure Name
        const waitlistBookings = bookings.filter(b => b.status === 'Fila de espera');

        const byProcName: Record<string, ConsultaAgendamento[]> = {};
        waitlistBookings.forEach(b => {
            const name = b.procedimento?.name || 'PROCEDIMENTO INDEFINIDO';
            if (!byProcName[name]) byProcName[name] = [];
            byProcName[name].push(b);
        });

        const sortedProcNames = Object.keys(byProcName).sort();
        sortedProcNames.forEach(name => {
            displayItems.push({ type: 'proc_header', label: name.toUpperCase() });

            // Sort by position in queue
            const sortedList = [...byProcName[name]].sort((a, b) => {
                const posA = queuePositions[a.id] || 9999;
                const posB = queuePositions[b.id] || 9999;
                return posA - posB;
            });

            sortedList.forEach(b => {
                displayItems.push({ type: 'booking', data: b });
            });
        });
    }

    const ITEMS_PER_PAGE = 18;
    const totalPages = Math.max(1, Math.ceil(displayItems.length / ITEMS_PER_PAGE));

    const reportState = {
        ...state,
        branding: {
            ...state.branding,
            watermark: {
                ...state.branding?.watermark,
                enabled: false
            }
        },
        document: {
            ...state.document,
            showPageNumbers: true
        },
        content: {
            ...state.content,
            title: reportType === 'completo' ? 'RELATÓRIO COMPLETO DE AGENDAMENTOS' : 'RELATÓRIO DA FILA DE ESPERA',
            protocol: `REL-${reportType.toUpperCase()}`
        }
    };

    const renderPages = () => {
        const pages = [];
        for (let i = 0; i < displayItems.length; i += ITEMS_PER_PAGE) {
            const pageItems = displayItems.slice(i, i + ITEMS_PER_PAGE);
            const pageIndex = Math.floor(i / ITEMS_PER_PAGE);

            pages.push(
                <PageWrapper
                    key={`page-${pageIndex}`}
                    state={reportState}
                    pageIndex={pageIndex}
                    totalPages={totalPages}
                    isGenerating={isGenerating}
                >
                    <div className="flex flex-col gap-5 h-full pb-6">
                        {/* Custom PDF Header */}
                        <div className="flex flex-col border-b-2 border-slate-900 pb-3 mt-4">
                            <h1 className="text-[12pt] font-black uppercase tracking-tight text-slate-900 mb-1">
                                {reportType === 'completo' ? 'RELATÓRIO COMPLETO DE PROCEDIMENTOS' : 'RELATÓRIO DE PACIENTES NA FILA DE ESPERA'}
                            </h1>
                            <div className="flex items-center justify-between text-[8pt] font-bold text-slate-700">
                                <div className="flex items-center gap-6">
                                    <div>
                                        <span className="text-slate-400 font-semibold mr-1 uppercase text-[7pt]">Emissor:</span>
                                        <span className="text-slate-800">{currentUser.name}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 font-semibold mr-1 uppercase text-[7pt]">Total de Registros:</span>
                                        <span className="text-slate-800">{displayItems.filter(item => item.type === 'booking').length}</span>
                                    </div>
                                </div>
                                <div className="text-[7.5pt] font-mono bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-slate-600">
                                    Emissão: {new Date().toLocaleString('pt-BR')}
                                </div>
                            </div>
                        </div>

                        {/* Items Table */}
                        <div className="border border-slate-200 rounded-xl overflow-hidden flex flex-col mt-1">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-900 text-white">
                                    <tr className="text-[7.5pt] font-black uppercase tracking-wider">
                                        {reportType === 'completo' ? (
                                            <>
                                                <th className="px-4 py-2 w-[40%] border-r border-slate-700">Paciente</th>
                                                <th className="px-4 py-2 w-[35%] border-r border-slate-700">Procedimento/Exame</th>
                                                <th className="px-4 py-2 text-center w-[25%]">Data Agendada</th>
                                            </>
                                        ) : (
                                            <>
                                                <th className="px-4 py-2 text-center w-[12%] border-r border-slate-700">Posição</th>
                                                <th className="px-4 py-2 w-[45%] border-r border-slate-700">Paciente</th>
                                                <th className="px-4 py-2 text-center w-[20%] border-r border-slate-700">Prioridade</th>
                                                <th className="px-4 py-2 text-center w-[23%]">Registrado em</th>
                                            </>
                                        )}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 uppercase text-[7.5pt] font-semibold text-slate-700">
                                    {pageItems.map((item, idx) => {
                                        if (item.type === 'proc_header') {
                                            return (
                                                <tr key={`proc-${idx}`} className="bg-sky-50/70">
                                                    <td colSpan={reportType === 'completo' ? 3 : 4} className="px-4 py-1.5 text-[8pt] font-black text-sky-800 tracking-wider">
                                                        {item.label}
                                                    </td>
                                                </tr>
                                            );
                                        }
                                        if (item.type === 'priority_header') {
                                            return (
                                                <tr key={`prio-${idx}`} className="bg-slate-100/80">
                                                    <td colSpan={reportType === 'completo' ? 3 : 4} className="px-4 py-1 text-[7.5pt] font-extrabold text-slate-600 pl-6">
                                                        {item.label}
                                                    </td>
                                                </tr>
                                            );
                                        }
                                        if (item.type === 'status_header') {
                                            return (
                                                <tr key={`stat-${idx}`} className="bg-slate-50/50">
                                                    <td colSpan={reportType === 'completo' ? 3 : 4} className="px-4 py-0.5 text-[7pt] font-extrabold text-slate-400 pl-8">
                                                        {item.label}
                                                    </td>
                                                </tr>
                                            );
                                        }

                                        const b = item.data;
                                        const cpfFormatted = b.paciente?.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") || '';
                                        
                                        if (reportType === 'completo') {
                                            return (
                                                <tr key={`b-${b.id}`} className="hover:bg-slate-50/30">
                                                    <td className="px-4 py-1.5 font-bold border-r border-slate-100">
                                                        <div className="font-extrabold text-slate-900">{b.paciente?.name}</div>
                                                        <div className="text-[6.5pt] text-slate-400 font-medium">CPF: {cpfFormatted}</div>
                                                    </td>
                                                    <td className="px-4 py-1.5 border-r border-slate-100">
                                                        <div className="font-bold text-slate-800">{b.procedimento?.name}</div>
                                                    </td>
                                                    <td className="px-4 py-1.5 text-center font-mono text-slate-600">
                                                        {formatDateBr(b.appointment_date)}
                                                    </td>
                                                </tr>
                                            );
                                        } else {
                                            return (
                                                <tr key={`b-${b.id}`} className="hover:bg-slate-50/30">
                                                    <td className="px-4 py-1.5 text-center font-black border-r border-slate-100 text-amber-600">
                                                        {queuePositions[b.id]}º
                                                    </td>
                                                    <td className="px-4 py-1.5 font-bold border-r border-slate-100">
                                                        <div className="font-extrabold text-slate-900">{b.paciente?.name}</div>
                                                        <div className="text-[6.5pt] text-slate-400 font-medium">CPF: {cpfFormatted}</div>
                                                    </td>
                                                    <td className="px-4 py-1.5 text-center border-r border-slate-100">
                                                        <span className={`inline-block px-1.5 py-0.5 rounded text-[6.5pt] font-black text-white ${
                                                            b.priority === 'Urgência' ? 'bg-rose-500' : b.is_retorno ? 'bg-teal-500' : 'bg-slate-400'
                                                        }`}>
                                                            {b.priority === 'Urgência' ? 'URG' : b.is_retorno ? 'RET' : 'NOR'}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-1.5 text-center font-mono text-slate-500">
                                                        {b.created_at ? new Date(b.created_at).toLocaleDateString('pt-BR') : '-'}
                                                    </td>
                                                </tr>
                                            );
                                        }
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

    return createPortal(
        <div className={`fixed inset-0 z-[9999] bg-slate-900/40 backdrop-blur-xl animate-fade-in ${isGenerating ? 'bg-white' : ''}`}>
            {isGenerating && progress && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm pointer-events-none">
                    <div className="bg-white p-8 rounded-3xl flex flex-col items-center max-w-sm w-full shadow-2xl">
                        <FileType className="w-12 h-12 text-sky-600 mb-4 animate-pulse" />
                        <h3 className="text-lg font-black text-slate-900 mb-2 font-sans">Gerando PDF</h3>
                        <p className="text-sm font-bold text-slate-500 mb-6 font-sans">Página {progress.current} de {progress.total}</p>
                        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-sky-600 rounded-full transition-all duration-300"
                                style={{ width: `${Math.max(5, (progress.current / progress.total) * 100)}%` }}
                            />
                        </div>
                        <p className="text-[10px] text-slate-400 mt-4 text-center font-medium font-sans">Preparando documento para download. Aguarde um instante.</p>
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
