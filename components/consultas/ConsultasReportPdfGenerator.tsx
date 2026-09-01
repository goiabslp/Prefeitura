import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { ConsultaAgendamento, ConsultaProcedimento, AppState, User } from '../../types';
import { PageWrapper } from '../PageWrapper';
import { FileType } from 'lucide-react';

interface ConsultasReportPdfGeneratorProps {
    reportType: 'simplificado' | 'completo' | 'fila';
    bookings: ConsultaAgendamento[];
    procedures: ConsultaProcedimento[];
    queuePositions: Record<string, number>;
    state: AppState;
    currentUser: User;
    onClose: () => void;
}

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

    const formatDateBr = (d?: string | null) => {
        if (!d) return '-';
        const raw = d.includes('T') ? d.split('T')[0] : d;
        const parts = raw.split('-');
        if (parts.length !== 3) return d;
        const [year, month, day] = parts;
        return `${day}/${month}/${year}`;
    };

    const formatPatientName = (name?: string, nickname?: string) => {
        if (!name) return 'PACIENTE NÃO INFORMADO';
        return nickname ? `${name} (${nickname})` : name;
    };

    const formatCpf = (cpf?: string) => {
        if (!cpf) return 'NÃO INFORMADO';
        const clean = cpf.replace(/\D/g, '');
        if (clean.length === 11) {
            return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
        }
        return cpf;
    };

    // 1. QUANTITATIVO POR PROCEDIMENTO (Apenas procedimentos que tenham >= 1 agendamento)
    const procedureQuantities = useMemo(() => {
        const map: Record<string, {
            id: string;
            name: string;
            type: string;
            code?: string;
            quantity: number;
            solicitados: number;
            agendados: number;
            fila: number;
            realizados: number;
        }> = {};

        const filteredBookings = reportType === 'fila' 
            ? bookings.filter(b => b.status === 'Fila de espera')
            : bookings;

        filteredBookings.forEach(b => {
            const pId = b.procedimento_id || b.procedimento?.id;
            const pName = b.procedimento?.name || 'OUTRO PROCEDIMENTO';
            const key = pId ? pId : `name_${pName}`;

            if (!map[key]) {
                map[key] = {
                    id: key,
                    name: pName,
                    type: b.procedimento?.type || 'Consulta',
                    code: b.procedimento?.code,
                    quantity: 0,
                    solicitados: 0,
                    agendados: 0,
                    fila: 0,
                    realizados: 0
                };
            }

            const itemQty = b.quantity || 1;
            map[key].quantity += itemQty;

            if (b.status === 'Solicitado') map[key].solicitados += itemQty;
            else if (b.status === 'Agendado') map[key].agendados += itemQty;
            else if (b.status === 'Fila de espera') map[key].fila += itemQty;
            else if (b.status === 'Realizado') map[key].realizados += itemQty;
        });

        // Filtrar APENAS procedimentos que tenham pelo menos 1 agendamento (quantity >= 1)
        return Object.values(map)
            .filter(item => item.quantity >= 1)
            .sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name));
    }, [bookings, reportType]);

    const totalQuantityCount = useMemo(() => {
        return procedureQuantities.reduce((acc, curr) => acc + curr.quantity, 0);
    }, [procedureQuantities]);

    // 2. LISTA PACIENTE X PROCEDIMENTO (Ordem Alfabética de Pacientes)
    const sortedBookingsList = useMemo(() => {
        if (reportType === 'simplificado') {
            return [];
        }

        const list = reportType === 'fila'
            ? bookings.filter(b => b.status === 'Fila de espera')
            : [...bookings];

        return list.sort((a, b) => {
            const nameA = a.paciente?.name || '';
            const nameB = b.paciente?.name || '';
            const nameComparison = nameA.localeCompare(nameB, 'pt-BR', { sensitivity: 'base' });
            if (nameComparison !== 0) return nameComparison;

            const dateA = a.solicitation_date ? new Date(a.solicitation_date + 'T00:00:00').getTime() : (a.created_at ? new Date(a.created_at).getTime() : 0);
            const dateB = b.solicitation_date ? new Date(b.solicitation_date + 'T00:00:00').getTime() : (b.created_at ? new Date(b.created_at).getTime() : 0);
            return dateB - dateA;
        });
    }, [bookings, reportType]);

    // Paginação para PDF A4
    const SUMMARY_ITEMS_PER_PAGE = 18;
    const summaryPagesCount = Math.max(1, Math.ceil(procedureQuantities.length / SUMMARY_ITEMS_PER_PAGE));

    const DETAIL_ITEMS_PER_PAGE = 13;
    const detailPagesCount = reportType === 'simplificado' ? 0 : Math.ceil(sortedBookingsList.length / DETAIL_ITEMS_PER_PAGE);

    const totalPages = summaryPagesCount + (detailPagesCount > 0 ? detailPagesCount : (reportType === 'simplificado' ? 0 : 1));

    // Configuração oficial de cabeçalho e rodapé do sistema
    const protocolCode = `REL-${reportType.toUpperCase()}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;

    const reportTitle = reportType === 'simplificado'
        ? 'RELATÓRIO SIMPLIFICADO - QUANTITATIVO POR PROCEDIMENTO'
        : reportType === 'fila'
        ? 'RELATÓRIO DA FILA DE ESPERA'
        : 'RELATÓRIO COMPLETO - PROCEDIMENTOS E PACIENTES';

    const reportState: AppState = {
        ...state,
        branding: {
            ...state.branding,
            primaryColor: state.branding?.primaryColor || '#0284c7',
            secondaryColor: state.branding?.secondaryColor || '#334155',
            watermark: {
                ...state.branding?.watermark,
                enabled: false
            }
        },
        document: {
            ...state.document,
            city: state.document?.city || 'São José do Goiabal',
            footerText: state.document?.footerText || 'Secretaria Municipal de Saúde • Sistema Integrado de Regulação Municipal',
            showPageNumbers: true
        },
        content: {
            ...state.content,
            requesterSector: 'Secretaria Municipal de Saúde',
            signatureSector: 'Setor de Regulação e Agendamentos',
            title: reportTitle,
            protocol: protocolCode,
            protocolId: protocolCode
        }
    };

    const handleDownloadPdf = async () => {
        setIsGenerating(true);
        setProgress({ current: 0, total: 1 });

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
                await new Promise(resolve => setTimeout(resolve, 60));

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

            const prefix = reportType === 'simplificado'
                ? 'Relatorio_Simplificado_Quantitativo'
                : reportType === 'fila'
                ? 'Relatorio_Fila_Espera'
                : 'Relatorio_Completo_Procedimentos_Pacientes';

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

    const renderPages = () => {
        const pages = [];
        let currentPageNum = 1;

        // --- PÁGINAS DE QUANTITATIVO POR PROCEDIMENTO ---
        for (let i = 0; i < summaryPagesCount; i++) {
            const chunk = procedureQuantities.slice(i * SUMMARY_ITEMS_PER_PAGE, (i + 1) * SUMMARY_ITEMS_PER_PAGE);
            const isFirstSummary = i === 0;
            const isLastSummary = i === summaryPagesCount - 1;

            pages.push(
                <PageWrapper
                    key={`page-summary-${i}`}
                    state={reportState}
                    pageIndex={currentPageNum - 1}
                    totalPages={totalPages}
                    isGenerating={isGenerating}
                >
                    <div className="flex flex-col gap-3.5 h-full">
                        {/* Título da Seção */}
                        <div className="flex flex-col border-b-2 border-slate-900 pb-2.5">
                            <div className="flex items-center justify-between">
                                <h1 className="text-[11pt] font-black uppercase tracking-tight text-slate-900 leading-normal">
                                    {reportType === 'simplificado' ? 'RELATÓRIO SIMPLIFICADO - QUANTITATIVO POR PROCEDIMENTO' : 'QUANTITATIVO POR PROCEDIMENTO'}
                                </h1>
                                <div className="inline-flex items-center justify-center px-3 py-1 rounded bg-sky-100 text-sky-950 border border-sky-300">
                                    <span className="text-[7.5pt] font-black uppercase leading-none">
                                        TOTAL DE ATENDIMENTOS: {totalQuantityCount}
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center justify-between text-[7.5pt] font-semibold text-slate-600 mt-1.5">
                                <span>Emissor: <strong className="text-slate-900 uppercase">{currentUser.name}</strong></span>
                                <span>Procedimentos com Atendimento: <strong className="text-slate-900">{procedureQuantities.length}</strong></span>
                            </div>
                        </div>

                        {/* Cards Resumo no primeiro topo */}
                        {isFirstSummary && (
                            <div className="grid grid-cols-4 gap-2">
                                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex flex-col justify-between">
                                    <span className="text-[6.5pt] font-black text-slate-500 uppercase tracking-wider block leading-tight">Total Solicitações</span>
                                    <span className="text-[12pt] font-black text-slate-900 leading-none mt-1">{totalQuantityCount}</span>
                                </div>
                                <div className="p-2.5 bg-sky-50/70 border border-sky-200 rounded-lg flex flex-col justify-between">
                                    <span className="text-[6.5pt] font-black text-sky-700 uppercase tracking-wider block leading-tight">Solicitados</span>
                                    <span className="text-[12pt] font-black text-sky-800 leading-none mt-1">
                                        {procedureQuantities.reduce((acc, c) => acc + c.solicitados, 0)}
                                    </span>
                                </div>
                                <div className="p-2.5 bg-indigo-50/70 border border-indigo-200 rounded-lg flex flex-col justify-between">
                                    <span className="text-[6.5pt] font-black text-indigo-700 uppercase tracking-wider block leading-tight">Agendados</span>
                                    <span className="text-[12pt] font-black text-indigo-800 leading-none mt-1">
                                        {procedureQuantities.reduce((acc, c) => acc + c.agendados, 0)}
                                    </span>
                                </div>
                                <div className="p-2.5 bg-amber-50/70 border border-amber-200 rounded-lg flex flex-col justify-between">
                                    <span className="text-[6.5pt] font-black text-amber-700 uppercase tracking-wider block leading-tight">Em Fila</span>
                                    <span className="text-[12pt] font-black text-amber-800 leading-none mt-1">
                                        {procedureQuantities.reduce((acc, c) => acc + c.fila, 0)}
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Tabela Quantitativo por Procedimento */}
                        <div className="border border-slate-200 rounded-lg overflow-hidden flex flex-col bg-white flex-1">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-900 text-white">
                                    <tr className="text-[7pt] font-black uppercase tracking-wider">
                                        <th className="px-3 py-2 w-[55%] border-r border-slate-700">Procedimento</th>
                                        <th className="px-3 py-2 text-center w-[20%] border-r border-slate-700">Tipo</th>
                                        <th className="px-3 py-2 text-center w-[25%]">Quantidade</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 uppercase text-[7pt] font-semibold text-slate-700">
                                    {chunk.length === 0 ? (
                                        <tr>
                                            <td colSpan={3} className="px-4 py-8 text-center text-slate-400 font-bold">
                                                Nenhum procedimento com agendamentos registrado.
                                            </td>
                                        </tr>
                                    ) : (
                                        chunk.map((item, idx) => (
                                            <tr key={item.id || idx} className="hover:bg-slate-50/50">
                                                <td className="px-3 py-2 font-bold border-r border-slate-100 text-slate-900 align-middle">
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className="leading-snug">{item.name}</span>
                                                        {item.code && (
                                                            <span className="text-[6pt] text-slate-500 font-mono font-bold leading-none">
                                                                CÓD: {item.code}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-2 text-center border-r border-slate-100 align-middle">
                                                    <div className="flex items-center justify-center">
                                                        <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-[6.5pt] font-black uppercase leading-normal tracking-wide min-w-[56px] border ${
                                                            item.type === 'Exame'
                                                                ? 'bg-sky-50 text-sky-800 border-sky-300'
                                                                : item.type === 'Consulta'
                                                                ? 'bg-indigo-50 text-indigo-800 border-indigo-300'
                                                                : 'bg-rose-50 text-rose-800 border-rose-300'
                                                        }`}>
                                                            {item.type}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-2 text-center font-mono font-black text-slate-900 text-[8pt] align-middle">
                                                    {item.quantity}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                                {isLastSummary && (
                                    <tfoot className="bg-slate-100 border-t-2 border-slate-300 font-black text-slate-900 text-[7.5pt]">
                                        <tr>
                                            <td colSpan={2} className="px-3 py-2 text-right uppercase tracking-wider border-r border-slate-200 align-middle">
                                                Total Geral de Solicitações:
                                            </td>
                                            <td className="px-3 py-2 text-center font-mono font-black text-[9pt] text-sky-900 align-middle">
                                                {totalQuantityCount}
                                            </td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    </div>
                </PageWrapper>
            );
            currentPageNum++;
        }

        // --- PÁGINAS DE LISTA PACIENTE X PROCEDIMENTO ---
        if (reportType !== 'simplificado') {
            if (sortedBookingsList.length === 0) {
                pages.push(
                    <PageWrapper
                        key="page-detail-empty"
                        state={reportState}
                        pageIndex={currentPageNum - 1}
                        totalPages={totalPages}
                        isGenerating={isGenerating}
                    >
                        <div className="flex flex-col gap-4 h-full">
                            <div className="flex flex-col border-b-2 border-slate-900 pb-2">
                                <h1 className="text-[11pt] font-black uppercase tracking-tight text-slate-900">
                                    LISTA PACIENTE X PROCEDIMENTO
                                </h1>
                            </div>
                            <div className="flex-1 flex items-center justify-center border border-slate-200 rounded-lg bg-white text-slate-400 font-bold uppercase text-xs">
                                Nenhum registro de agendamento encontrado para este relatório.
                            </div>
                        </div>
                    </PageWrapper>
                );
            } else {
                for (let i = 0; i < sortedBookingsList.length; i += DETAIL_ITEMS_PER_PAGE) {
                    const chunk = sortedBookingsList.slice(i, i + DETAIL_ITEMS_PER_PAGE);

                    pages.push(
                        <PageWrapper
                            key={`page-detail-${i}`}
                            state={reportState}
                            pageIndex={currentPageNum - 1}
                            totalPages={totalPages}
                            isGenerating={isGenerating}
                        >
                            <div className="flex flex-col gap-3.5 h-full">
                                {/* Header da Lista */}
                                <div className="flex flex-col border-b-2 border-slate-900 pb-2">
                                    <div className="flex items-center justify-between">
                                        <h1 className="text-[11pt] font-black uppercase tracking-tight text-slate-900">
                                            LISTA PACIENTE X PROCEDIMENTO
                                        </h1>
                                        <div className="inline-flex items-center justify-center px-2.5 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                                            <span className="text-[7pt] font-black uppercase leading-none">
                                                Total: {sortedBookingsList.length} Registros
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between text-[7.5pt] font-semibold text-slate-600 mt-1">
                                        <span>Emissor: <strong className="text-slate-900 uppercase">{currentUser.name}</strong></span>
                                        <span>Exibindo: <strong>{i + 1} a {Math.min(i + DETAIL_ITEMS_PER_PAGE, sortedBookingsList.length)}</strong></span>
                                    </div>
                                </div>

                                {/* Tabela com as 6 colunas exatas */}
                                <div className="border border-slate-200 rounded-lg overflow-hidden flex flex-col bg-white flex-1">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="bg-slate-900 text-white">
                                            <tr className="text-[6.5pt] font-black uppercase tracking-wider">
                                                <th className="px-2 py-2 text-center w-[8%] border-r border-slate-700">Posição</th>
                                                <th className="px-2 py-2 text-center w-[12%] border-r border-slate-700">Solicitado</th>
                                                <th className="px-3 py-2 w-[30%] border-r border-slate-700">Paciente / CPF</th>
                                                <th className="px-3 py-2 w-[25%] border-r border-slate-700">Procedimento</th>
                                                <th className="px-2 py-2 text-center w-[13%] border-r border-slate-700">Data Agendada</th>
                                                <th className="px-2 py-2 text-center w-[12%]">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 uppercase text-[7pt] font-semibold text-slate-700">
                                            {chunk.map((b, idx) => {
                                                const globalIdx = i + idx + 1;
                                                const queuePos = queuePositions[b.id];
                                                const isWaitlist = b.status === 'Fila de espera';

                                                return (
                                                    <tr key={b.id || idx} className="hover:bg-slate-50/50">
                                                        {/* 1. Posição */}
                                                        <td className="px-2 py-2 text-center font-black border-r border-slate-100 align-middle">
                                                            <div className="flex items-center justify-center">
                                                                {isWaitlist && queuePos ? (
                                                                    <span className="inline-flex items-center justify-center px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 text-[6.5pt] font-black leading-normal min-w-[26px]">
                                                                        {queuePos}º
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-slate-400 font-mono text-[6.5pt]">
                                                                        #{globalIdx}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>

                                                        {/* 2. Solicitado */}
                                                        <td className="px-2 py-2 text-center font-mono border-r border-slate-100 text-slate-600 text-[6.5pt] align-middle">
                                                            {formatDateBr(b.solicitation_date || (b.created_at ? b.created_at.split('T')[0] : null))}
                                                        </td>

                                                        {/* 3. Paciente / CPF */}
                                                        <td className="px-3 py-2 border-r border-slate-100 align-middle">
                                                            <div className="flex flex-col gap-0.5">
                                                                <div className="font-extrabold text-slate-900 leading-snug break-words">
                                                                    {formatPatientName(b.paciente?.name, b.paciente?.nickname)}
                                                                </div>
                                                                <div className="text-[6pt] text-slate-500 font-mono leading-none">
                                                                    CPF: {formatCpf(b.paciente?.cpf)}
                                                                </div>
                                                            </div>
                                                        </td>

                                                        {/* 4. Procedimento */}
                                                        <td className="px-3 py-2 border-r border-slate-100 align-middle">
                                                            <div className="flex flex-col gap-0.5">
                                                                <div className="font-bold text-slate-900 leading-snug break-words">
                                                                    {b.procedimento?.name || 'Procedimento não informado'}
                                                                </div>
                                                                {b.procedimento?.code && (
                                                                    <div className="text-[6pt] font-mono font-bold text-slate-500 leading-none">
                                                                        CÓD: {b.procedimento.code}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </td>

                                                        {/* 5. Data Agendada */}
                                                        <td className="px-2 py-2 text-center font-mono border-r border-slate-100 text-[6.5pt] align-middle">
                                                            <div className="flex items-center justify-center">
                                                                {b.status !== 'Fila de espera' && b.status !== 'Aguardando Data' && b.appointment_date ? (
                                                                    <span className="font-bold text-slate-900 leading-tight">
                                                                        {formatDateBr(b.appointment_date)}
                                                                        {b.appointment_time ? ` ${b.appointment_time.substring(0, 5)}` : ''}
                                                                    </span>
                                                                ) : (
                                                                    <span className="inline-flex items-center justify-center px-2 py-0.5 rounded text-[6pt] font-black uppercase text-amber-900 bg-amber-100 border border-amber-300 leading-normal min-w-[76px]">
                                                                        Aguardando Vaga
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>

                                                        {/* 6. Status */}
                                                        <td className="px-2 py-2 text-center align-middle">
                                                            <div className="flex items-center justify-center">
                                                                <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-[6pt] font-black uppercase tracking-tight leading-normal min-w-[70px] border ${
                                                                    b.status === 'Solicitado'
                                                                        ? 'bg-sky-50 text-sky-800 border-sky-300'
                                                                        : b.status === 'Agendado'
                                                                        ? 'bg-indigo-50 text-indigo-800 border-indigo-300'
                                                                        : b.status === 'Realizado'
                                                                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                                                        : b.status === 'Fila de espera'
                                                                        ? 'bg-amber-100 text-amber-900 border-amber-300'
                                                                        : b.status === 'Aguardando Data'
                                                                        ? 'bg-violet-50 text-violet-800 border-violet-300'
                                                                        : b.status === 'Retorno'
                                                                        ? 'bg-teal-50 text-teal-800 border-teal-300'
                                                                        : 'bg-rose-50 text-rose-800 border-rose-300'
                                                                }`}>
                                                                    {b.status}
                                                                </span>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </PageWrapper>
                    );
                    currentPageNum++;
                }
            }
        }

        return pages;
    };

    return createPortal(
        <div className={`fixed inset-0 z-[9999] bg-slate-900/40 backdrop-blur-xl animate-fade-in ${isGenerating ? 'bg-white' : ''}`}>
            {isGenerating && progress && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm pointer-events-none">
                    <div className="bg-white p-8 rounded-3xl flex flex-col items-center max-w-sm w-full shadow-2xl">
                        <FileType className="w-12 h-12 text-sky-600 mb-4 animate-pulse" />
                        <h3 className="text-lg font-black text-slate-900 mb-2 font-sans">
                            {reportType === 'simplificado' ? 'Gerando Relatório Simplificado' : 'Gerando Relatório Completo'}
                        </h3>
                        <p className="text-sm font-bold text-slate-500 mb-6 font-sans">Página {progress.current} de {progress.total}</p>
                        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-sky-600 rounded-full transition-all duration-300"
                                style={{ width: `${Math.max(5, (progress.current / progress.total) * 100)}%` }}
                            />
                        </div>
                        <p className="text-[10px] text-slate-400 mt-4 text-center font-medium font-sans">Preparando arquivo em PDF perfeitamente formatado.</p>
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
