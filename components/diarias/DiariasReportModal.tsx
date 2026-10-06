import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, FileDown, Clock, Info,
    MapPin, Printer, ChevronUp,
    Check, Square, CheckSquare, Minus, Search
} from 'lucide-react';
import { Order } from '../../types';

interface DiariasReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    orders: Order[];
    onUpdatePaymentStatus?: (orderOrId: string | Order, status: 'pending' | 'contabilidade' | 'paid') => void;
}

/**
 * Modal para exportar relatório de diárias concluídas.
 * Filtra automaticamente todas as diárias com status concluído e, ao gerar o relatório,
 * atualiza seu status de pagamento para "CONTABILIDADE".
 */
export const DiariasReportModal: React.FC<DiariasReportModalProps> = ({
    isOpen,
    onClose,
    orders,
    onUpdatePaymentStatus
}) => {
    // Estado do fluxo: 'select' = selecionar itens, 'report' = visualizar relatório
    const [step, setStep] = useState<'select' | 'report'>('select');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const reportRef = useRef<HTMLDivElement>(null);

    // Resetar estado ao fechar
    const handleClose = () => {
        setStep('select');
        setSelectedIds(new Set());
        setFilteredOrders([]);
        setSearchTerm('');
        onClose();
    };

    // Obter data de saída de uma diária
    const getDepartureDate = (order: Order): string => {
        const content = order.documentSnapshot?.content;
        if (content?.departureDateTime) {
            return new Date(content.departureDateTime).toLocaleDateString('pt-BR');
        }
        return new Date(order.createdAt).toLocaleDateString('pt-BR');
    };

    // Obter data de saída como Date para ordenação
    const getDepartureDateObj = (order: Order): Date => {
        const content = order.documentSnapshot?.content;
        if (content?.departureDateTime) {
            return new Date(content.departureDateTime);
        }
        return new Date(order.createdAt);
    };

    // Ao abrir o modal, filtra diárias com status concluídos e não as pendentes
    useEffect(() => {
        if (isOpen) {
            const concluidos = orders.filter(order => {
                return order.status === 'completed' || (order.status as string) === 'concluido' || (order as any).eventoStatus === 'concluido';
            });
            // Ordenar por data de saída (mais recente primeiro)
            concluidos.sort((a, b) => getDepartureDateObj(b).getTime() - getDepartureDateObj(a).getTime());
            setFilteredOrders(concluidos);
            setSelectedIds(new Set());
            setSearchTerm('');
            setStep('select');
        }
    }, [isOpen, orders]);

    // Filtragem por termo de busca no modal
    const displayOrders = useMemo(() => {
        if (!searchTerm.trim()) return filteredOrders;
        const term = searchTerm.toLowerCase().trim();
        return filteredOrders.filter(order => {
            const content = order.documentSnapshot?.content;
            return (
                (order.protocol && order.protocol.toLowerCase().includes(term)) ||
                (content?.requesterName && content.requesterName.toLowerCase().includes(term)) ||
                (content?.destination && content.destination.toLowerCase().includes(term)) ||
                (content?.descriptionReason && content.descriptionReason.toLowerCase().includes(term))
            );
        });
    }, [filteredOrders, searchTerm]);

    // Status de exibição no relatório
    const getPaymentLabel = (status: Order['paymentStatus']) => {
        switch (status) {
            case 'paid': return { label: 'Pago', style: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
            case 'contabilidade': return { label: 'Contabilidade', style: 'bg-blue-50 text-blue-700 border-blue-200' };
            case 'pending':
            default: return { label: 'Concluído', style: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
        }
    };

    // Toggle seleção de item
    const toggleItem = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    // Selecionar/Deselecionar todos da listagem visível
    const toggleAll = () => {
        if (selectedIds.size === displayOrders.length && displayOrders.length > 0) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(displayOrders.map(o => o.id)));
        }
    };

    // Itens selecionados para o relatório
    const selectedOrders = useMemo(() => {
        return filteredOrders.filter(o => selectedIds.has(o.id));
    }, [filteredOrders, selectedIds]);

    // Gerar relatório e alterar status dos registros selecionados para CONTABILIDADE automaticamente
    const handleGenerateReport = async () => {
        if (selectedIds.size === 0) return;

        // Atualizar cada diária selecionada para 'contabilidade'
        for (const orderId of Array.from(selectedIds)) {
            const orderToUpdate = filteredOrders.find(o => o.id === orderId);
            if (orderToUpdate && onUpdatePaymentStatus) {
                await onUpdatePaymentStatus(orderToUpdate, 'contabilidade');
            }
        }

        setStep('report');
    };

    // Imprimir relatório
    const handlePrint = () => {
        const printContent = reportRef.current;
        if (!printContent) return;

        const printWindow = window.open('', '_blank', 'width=900,height=700');
        if (!printWindow) return;

        printWindow.document.write(`
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
                <meta charset="utf-8" />
                <title>Relatório de Diárias</title>
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
                    
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { 
                        font-family: 'Inter', sans-serif; 
                        color: #1e293b; 
                        padding: 20px;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        font-size: 11px;
                        color: #334155;
                    }
                    thead th {
                        padding: 8px 4px;
                        text-align: left;
                        font-weight: 800;
                        color: #475569;
                        font-size: 9px;
                        text-transform: uppercase;
                        border-bottom: 2px solid #cbd5e1;
                    }
                    
                    tbody tr { border-bottom: 1px solid #e2e8f0; }
                    tbody td { padding: 8px 4px; vertical-align: middle; }
                    
                    @media print {
                        body { padding: 10px; }
                    }
                </style>
            </head>
            <body>
                ${printContent.innerHTML}
            </body>
            </html>
        `);
        printWindow.document.close();
        setTimeout(() => {
            printWindow.print();
        }, 500);
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
                    onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 30 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 30 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                        className={`bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col ${step === 'report' ? 'w-full max-w-4xl max-h-[92vh]' : 'w-full max-w-6xl max-h-[92vh]'}`}
                    >
                        {/* Cabeçalho do Modal - Compacto */}
                        <div className="px-5 py-2.5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-gradient-to-r from-indigo-50/80 to-violet-50/80">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-md shadow-indigo-600/20 shrink-0">
                                    <FileDown className="w-4 h-4 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-slate-900 tracking-tight leading-tight">
                                        Exportar Relatório de Diárias Concluídas
                                    </h3>
                                    <p className="text-[11px] text-slate-500 font-medium leading-none mt-0.5">
                                        {step === 'select' && `${displayOrders.length} diária(s) concluída(s) encontrada(s) — Selecione os itens`}
                                        {step === 'report' && `Relatório gerado com ${selectedOrders.length} diária(s) concluída(s)`}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={handleClose}
                                className="p-1.5 hover:bg-slate-100 rounded-lg transition-all text-slate-400 hover:text-slate-600"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Indicador de Etapas - Compacto */}
                        <div className="px-5 py-1.5 bg-slate-50/80 border-b border-slate-100 shrink-0">
                            <div className="flex items-center gap-2">
                                {[
                                    { key: 'select', label: 'Selecionar Diárias', icon: CheckSquare },
                                    { key: 'report', label: 'Relatório Gerado', icon: Printer }
                                ].map((s, i) => {
                                    const StepIcon = s.icon;
                                    const isActive = step === s.key;
                                    const isDone = step === 'report' && i === 0;
                                    return (
                                        <React.Fragment key={s.key}>
                                            {i > 0 && (
                                                <div className={`flex-1 h-0.5 rounded ${isDone || isActive ? 'bg-indigo-500' : 'bg-slate-200'}`} />
                                            )}
                                            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${isActive ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20' : isDone ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                                                <StepIcon className="w-3 h-3" />
                                                <span className="hidden sm:inline">{s.label}</span>
                                            </div>
                                        </React.Fragment>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Conteúdo */}
                        <div className="flex-1 overflow-auto">
                            {/* STEP 1: Seleção de Itens */}
                            {step === 'select' && (
                                <div className="flex flex-col">
                                    {/* Barra de ações e busca rápida - Compacto */}
                                    <div className="px-4 py-2 bg-white border-b border-slate-100 flex flex-wrap items-center justify-between gap-2.5 sticky top-0 z-10 shadow-xs">
                                        <div className="flex items-center gap-2.5">
                                            <button
                                                onClick={toggleAll}
                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-600 hover:text-indigo-600 hover:border-indigo-200 transition-all font-bold text-[9px] uppercase tracking-wider active:scale-95"
                                            >
                                                {selectedIds.size === displayOrders.length && displayOrders.length > 0 ? (
                                                    <><CheckSquare className="w-3 h-3 text-indigo-600" /> Desmarcar Todos</>
                                                ) : selectedIds.size > 0 ? (
                                                    <><Minus className="w-3 h-3 text-indigo-600" /> {selectedIds.size} selecionado(s)</>
                                                ) : (
                                                    <><Square className="w-3 h-3" /> Selecionar Todos</>
                                                )}
                                            </button>

                                            <div className="relative">
                                                <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                                <input
                                                    type="text"
                                                    value={searchTerm}
                                                    onChange={(e) => setSearchTerm(e.target.value)}
                                                    placeholder="Filtrar solicitante, destino, código..."
                                                    className="pl-7 pr-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 w-56 sm:w-72 transition-all"
                                                />
                                            </div>
                                        </div>

                                        <div className="text-[9.5px] text-slate-400 font-semibold tracking-normal">
                                            Os itens selecionados mudarão para "Contabilidade" automaticamente ao gerar o relatório.
                                        </div>
                                    </div>

                                    {/* Lista de itens filtrados - Grid Compacto */}
                                    {displayOrders.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                                            <Clock className="w-10 h-10 mb-2 opacity-30 animate-pulse" />
                                            <p className="font-bold text-xs">
                                                {searchTerm ? 'Nenhuma diária concluída encontrada para este termo' : 'Nenhuma diária com status concluído encontrada'}
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="divide-y divide-slate-100/90 pb-4">
                                            {displayOrders.map(order => {
                                                const content = order.documentSnapshot?.content;
                                                const isSelected = selectedIds.has(order.id);
                                                const payment = getPaymentLabel(order.paymentStatus);

                                                return (
                                                    <button
                                                        key={order.id}
                                                        onClick={() => toggleItem(order.id)}
                                                        className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-slate-50/80 ${isSelected ? 'bg-indigo-50/50' : ''}`}
                                                    >
                                                        {/* Checkbox Compacto */}
                                                        <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all shrink-0 ${isSelected ? 'bg-indigo-600 border-indigo-600 shadow-sm shadow-indigo-600/30' : 'border-slate-300 bg-white hover:border-indigo-400'}`}>
                                                            {isSelected && <Check className="w-3 h-3 text-white" />}
                                                        </div>

                                                        {/* Protocolo */}
                                                        <div className="shrink-0 w-24">
                                                            <span className="font-mono text-[9px] font-bold text-indigo-600 bg-indigo-50/80 px-1.5 py-0.5 rounded border border-indigo-100">
                                                                {order.protocol}
                                                            </span>
                                                        </div>

                                                        {/* Nome + Destino */}
                                                        <div className="flex-1 min-w-0 pr-2">
                                                            <p className="text-xs font-bold text-slate-800 truncate leading-tight">
                                                                {content?.requesterName || '---'}
                                                            </p>
                                                            <p className="text-[10px] text-slate-500 font-medium flex items-center gap-1 truncate font-sans leading-none mt-0.5">
                                                                <MapPin className="w-2.5 h-2.5 shrink-0 text-slate-400" />
                                                                {content?.destination || 'Destino n/a'}
                                                            </p>
                                                        </div>

                                                        {/* Saída */}
                                                        <div className="shrink-0 text-right w-24">
                                                            <p className="text-[11px] font-bold text-slate-700 leading-tight">
                                                                {getDepartureDate(order)}
                                                            </p>
                                                            {content?.returnDateTime && (
                                                                <p className="text-[9px] text-slate-400 font-medium font-sans leading-none mt-0.5">
                                                                    Volta: {new Date(content.returnDateTime).toLocaleDateString('pt-BR')}
                                                                </p>
                                                            )}
                                                        </div>

                                                        {/* Status Pagamento */}
                                                        <div className="shrink-0 w-24 text-center">
                                                            <span className={`inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded-md border text-[8.5px] font-black uppercase tracking-wider ${payment.style}`}>
                                                                {payment.label}
                                                            </span>
                                                        </div>

                                                        {/* Ação: Motivo da Viagem */}
                                                        <div className="shrink-0 w-8 flex justify-center">
                                                            <div 
                                                                className="relative group/tooltip"
                                                                onClick={(e) => e.stopPropagation()}
                                                            >
                                                                <button
                                                                    type="button"
                                                                    className="p-1 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 rounded-md transition-all"
                                                                >
                                                                    <Info className="w-3.5 h-3.5" />
                                                                </button>
                                                                <div className="absolute right-full bottom-[-8px] mr-3 w-[360px] sm:w-[440px] p-3.5 bg-slate-900 text-white text-[11px] rounded-xl shadow-2xl opacity-0 pointer-events-none group-hover/tooltip:opacity-100 transition-opacity z-50 leading-relaxed text-left font-medium font-sans whitespace-normal break-words">
                                                                    <span className="block text-[8px] font-black text-indigo-400 uppercase tracking-wider mb-1">Motivo da Viagem</span>
                                                                    {content?.descriptionReason || 'Nenhuma justificativa informada.'}
                                                                    <div className="absolute left-full bottom-[10px] w-2.5 h-2.5 bg-slate-900 rotate-45 -ml-1.5" />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* STEP 2: Visualização do Relatório */}
                            {step === 'report' && (
                                <div className="p-6 bg-slate-50">
                                    {/* Conteúdo do relatório para impressão */}
                                    <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200" ref={reportRef}>
                                        {/* Cabeçalho do documento padrão com logo */}
                                        {(() => {
                                            const firstOrder = selectedOrders[0];
                                            const stateBranding = (firstOrder?.documentSnapshot?.branding || {}) as any;
                                            const logoUrl = stateBranding.logoUrl || '';
                                            const primaryColor = stateBranding.primaryColor || '#4f46e5';
                                            const docCity = firstOrder?.documentSnapshot?.document?.city || 'Prefeitura Municipal';
                                            const docSector = firstOrder?.documentSnapshot?.content?.requesterSector || firstOrder?.documentSnapshot?.content?.signatureSector || 'Prefeitura Municipal';

                                            return (
                                                <div className="relative pb-6 mb-6 border-b-2 border-slate-300 font-sans" style={{ minHeight: '120px' }}>
                                                    {/* Borda Superior Colorida */}
                                                    <div className="absolute top-[-32px] left-[-32px] right-[-32px] h-2" style={{ backgroundColor: primaryColor }} />
                                                    
                                                    <div className="flex justify-between items-start pt-2">
                                                        <div className="flex-1">
                                                            {logoUrl ? (
                                                                <img
                                                                    src={logoUrl}
                                                                    alt="Logo"
                                                                    className="object-contain max-h-[80px]"
                                                                    style={{ maxWidth: '180px' }}
                                                                />
                                                            ) : (
                                                                <div className="w-[120px] h-[50px] bg-slate-100 border border-slate-300 rounded flex items-center justify-center text-[10px] font-bold text-slate-400">
                                                                    LOGO
                                                                </div>
                                                            )}
                                                        </div>

                                                        <div className="text-right flex flex-col items-end">
                                                            <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">
                                                                {docSector}
                                                            </span>
                                                            <h2 className="text-sm font-extrabold tracking-widest uppercase text-slate-900 mt-1">
                                                                {docCity}
                                                            </h2>
                                                            <p className="text-[10px] text-slate-400 font-mono mt-1">
                                                                {new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <div className="text-center mt-6">
                                                        <h1 className="text-base font-black text-slate-800 uppercase tracking-widest">
                                                            Relatório de Diárias
                                                        </h1>
                                                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1">
                                                            Total de Diárias: {selectedOrders.length} {selectedOrders.length === 1 ? 'item' : 'itens'}
                                                        </p>
                                                    </div>
                                                </div>
                                            );
                                        })()}

                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', color: '#334155' }}>
                                            <thead>
                                                <tr style={{ borderBottom: '2px solid #cbd5e1' }}>
                                                    <th style={{ padding: '8px 4px', textAlign: 'left', fontWeight: 800, color: '#475569', fontSize: '9px', textTransform: 'uppercase' }}>#</th>
                                                    <th style={{ padding: '8px 4px', textAlign: 'left', fontWeight: 800, color: '#475569', fontSize: '9px', textTransform: 'uppercase' }}>Protocolo</th>
                                                    <th style={{ padding: '8px 4px', textAlign: 'left', fontWeight: 800, color: '#475569', fontSize: '9px', textTransform: 'uppercase' }}>Solicitante</th>
                                                    <th style={{ padding: '8px 4px', textAlign: 'left', fontWeight: 800, color: '#475569', fontSize: '9px', textTransform: 'uppercase' }}>Destino</th>
                                                    <th style={{ padding: '8px 4px', textAlign: 'center', fontWeight: 800, color: '#475569', fontSize: '9px', textTransform: 'uppercase' }}>Saída</th>
                                                    <th style={{ padding: '8px 4px', textAlign: 'center', fontWeight: 800, color: '#475569', fontSize: '9px', textTransform: 'uppercase' }}>Retorno</th>
                                                    <th style={{ padding: '8px 4px', textAlign: 'center', fontWeight: 800, color: '#475569', fontSize: '9px', textTransform: 'uppercase' }}>Pagamento</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {selectedOrders.map((order, idx) => {
                                                    const content = order.documentSnapshot?.content;

                                                    return (
                                                        <tr key={order.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                                            <td style={{ padding: '8px 4px', verticalAlign: 'middle', color: '#94a3b8' }}>{idx + 1}</td>
                                                            <td style={{ padding: '8px 4px', verticalAlign: 'middle', fontWeight: 700, fontFamily: 'monospace' }}>
                                                                {order.protocol}
                                                            </td>
                                                            <td style={{ padding: '8px 4px', verticalAlign: 'middle', fontWeight: 600 }}>
                                                                {content?.requesterName || '---'}
                                                            </td>
                                                            <td style={{ padding: '8px 4px', verticalAlign: 'middle', color: '#64748b' }}>
                                                                {content?.destination || '---'}
                                                            </td>
                                                            <td style={{ padding: '8px 4px', verticalAlign: 'middle', textAlign: 'center' }}>
                                                                {getDepartureDate(order)}
                                                            </td>
                                                            <td style={{ padding: '8px 4px', verticalAlign: 'middle', textAlign: 'center' }}>
                                                                {content?.returnDateTime ? new Date(content.returnDateTime).toLocaleDateString('pt-BR') : '---'}
                                                            </td>
                                                            <td style={{ padding: '8px 4px', verticalAlign: 'middle', textAlign: 'center' }}>
                                                                <span style={{ fontSize: '9px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                                                                    CONTABILIDADE
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>

                                        <div style={{ marginTop: '40px', paddingTop: '15px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div style={{ fontSize: '9px', color: '#94a3b8', fontWeight: 500 }}>
                                                Gerado em: {new Date().toLocaleString('pt-BR')}
                                            </div>
                                            <div style={{ fontSize: '9px', color: '#94a3b8', fontWeight: 600 }}>
                                                Documento Oficial
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Rodapé com ações - Compacto */}
                        <div className="px-5 py-2.5 border-t border-slate-100 bg-slate-50/80 shrink-0 flex items-center justify-between">
                            {step === 'select' ? (
                                <>
                                    <span className="text-[11px] text-slate-500 font-bold">
                                        {selectedIds.size} de {displayOrders.length} selecionado(s)
                                    </span>
                                    <button
                                        onClick={handleGenerateReport}
                                        disabled={selectedIds.size === 0}
                                        className="px-5 py-2 bg-indigo-600 text-white font-black text-[9.5px] uppercase tracking-[0.15em] rounded-xl hover:bg-indigo-700 active:scale-95 transition-all shadow-md shadow-indigo-600/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                                    >
                                        <FileDown className="w-3.5 h-3.5" />
                                        Gerar Relatório
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button
                                        onClick={() => setStep('select')}
                                        className="px-4 py-2 bg-white border border-slate-200 text-slate-600 font-black text-[9.5px] uppercase tracking-[0.15em] rounded-xl hover:bg-slate-100 active:scale-95 transition-all flex items-center gap-1.5"
                                    >
                                        <ChevronUp className="w-3.5 h-3.5" />
                                        Voltar à Seleção
                                    </button>
                                    <button
                                        onClick={handlePrint}
                                        className="px-5 py-2 bg-indigo-600 text-white font-black text-[9.5px] uppercase tracking-[0.15em] rounded-xl hover:bg-indigo-700 active:scale-95 transition-all shadow-md shadow-indigo-600/20 flex items-center gap-1.5"
                                    >
                                        <Printer className="w-3.5 h-3.5" />
                                        Imprimir Relatório
                                    </button>
                                </>
                            )}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
