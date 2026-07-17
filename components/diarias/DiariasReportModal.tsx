import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, FileDown, Clock, Info,
    MapPin, Printer, ChevronUp,
    Check, Square, CheckSquare, Minus
} from 'lucide-react';
import { Order } from '../../types';

interface DiariasReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    orders: Order[];
    onUpdatePaymentStatus?: (orderOrId: string | Order, status: 'pending' | 'contabilidade' | 'paid') => void;
}

/**
 * Modal para exportar relatório de diárias pendentes.
 * Filtra automaticamente todas as diárias pendentes e, ao gerar o relatório,
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
    const reportRef = useRef<HTMLDivElement>(null);

    // Resetar estado ao fechar
    const handleClose = () => {
        setStep('select');
        setSelectedIds(new Set());
        setFilteredOrders([]);
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

    // Ao abrir o modal, filtra diárias pendentes (paymentStatus === 'pending' ou !paymentStatus)
    useEffect(() => {
        if (isOpen) {
            const pendentes = orders.filter(order => {
                const status = order.paymentStatus;
                return !status || status === 'pending';
            });
            // Ordenar por data de saída (mais antiga primeiro)
            pendentes.sort((a, b) => getDepartureDateObj(a).getTime() - getDepartureDateObj(b).getTime());
            setFilteredOrders(pendentes);
            setSelectedIds(new Set());
            setStep('select');
        }
    }, [isOpen, orders]);

    // Status de pagamento
    const getPaymentLabel = (status: Order['paymentStatus']) => {
        switch (status) {
            case 'paid': return { label: 'Pago', style: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
            case 'contabilidade': return { label: 'Contabilidade', style: 'bg-blue-50 text-blue-700 border-blue-200' };
            case 'pending':
            default: return { label: 'Pendente', style: 'bg-amber-50 text-amber-700 border-amber-200' };
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

    // Selecionar/Deselecionar todos
    const toggleAll = () => {
        if (selectedIds.size === filteredOrders.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredOrders.map(o => o.id)));
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
                        className={`bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col ${step === 'report' ? 'w-full max-w-4xl max-h-[90vh]' : 'w-full max-w-5xl max-h-[85vh]'}`}
                    >
                        {/* Cabeçalho do Modal */}
                        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-gradient-to-r from-indigo-50 to-violet-50">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/30">
                                    <FileDown className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-extrabold text-slate-900 tracking-tight">
                                        Exportar Relatório de Diárias Pendentes
                                    </h3>
                                    <p className="text-xs text-slate-500 font-medium">
                                        {step === 'select' && `${filteredOrders.length} item(s) pendente(s) encontrado(s) — Selecione os itens`}
                                        {step === 'report' && `Relatório gerado com ${selectedOrders.length} item(s)`}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={handleClose}
                                className="p-2 hover:bg-slate-100 rounded-xl transition-all text-slate-400 hover:text-slate-600"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Indicador de Etapas */}
                        <div className="px-6 py-3 bg-slate-50 border-b border-slate-100 shrink-0">
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
                                            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isActive ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : isDone ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                                                <StepIcon className="w-3.5 h-3.5" />
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
                                    {/* Barra de ações */}
                                    <div className="px-6 py-3 bg-white border-b border-slate-100 flex items-center justify-between sticky top-0 z-10">
                                        <button
                                            onClick={toggleAll}
                                            className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 hover:text-indigo-600 hover:border-indigo-200 transition-all font-bold text-[10px] uppercase tracking-widest active:scale-95"
                                        >
                                            {selectedIds.size === filteredOrders.length ? (
                                                <><CheckSquare className="w-3.5 h-3.5 text-indigo-600" /> Desmarcar Todos</>
                                            ) : selectedIds.size > 0 ? (
                                                <><Minus className="w-3.5 h-3.5 text-indigo-600" /> {selectedIds.size} selecionado(s)</>
                                            ) : (
                                                <><Square className="w-3.5 h-3.5" /> Selecionar Todos</>
                                            )}
                                        </button>
                                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                            Os itens selecionados mudarão para "Contabilidade" automaticamente ao gerar o relatório.
                                        </div>
                                    </div>

                                    {/* Lista de itens filtrados */}
                                    {filteredOrders.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                                            <Clock className="w-12 h-12 mb-3 opacity-30 animate-pulse" />
                                            <p className="font-bold text-sm">Nenhuma diária pendente de pagamento encontrada</p>
                                        </div>
                                    ) : (
                                        <div className="divide-y divide-slate-100 pb-44">
                                            {filteredOrders.map(order => {
                                                const content = order.documentSnapshot?.content;
                                                const isSelected = selectedIds.has(order.id);
                                                const payment = getPaymentLabel(order.paymentStatus);

                                                return (
                                                    <button
                                                        key={order.id}
                                                        onClick={() => toggleItem(order.id)}
                                                        className={`w-full flex items-center gap-4 px-6 py-4 text-left transition-all hover:bg-slate-50 ${isSelected ? 'bg-indigo-50/40' : ''}`}
                                                    >
                                                        {/* Checkbox */}
                                                        <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all shrink-0 ${isSelected ? 'bg-indigo-600 border-indigo-600 shadow-lg shadow-indigo-600/20' : 'border-slate-300 bg-white hover:border-indigo-400'}`}>
                                                            {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                                                        </div>

                                                        {/* Protocolo */}
                                                        <div className="shrink-0 w-28">
                                                            <span className="font-mono text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded border border-indigo-100">
                                                                {order.protocol}
                                                            </span>
                                                        </div>

                                                        {/* Nome + Destino */}
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-bold text-slate-800 truncate">
                                                                {content?.requesterName || '---'}
                                                            </p>
                                                            <p className="text-[10px] text-slate-500 font-medium flex items-center gap-1 truncate font-sans">
                                                                <MapPin className="w-3 h-3 shrink-0" />
                                                                {content?.destination || 'Destino n/a'}
                                                            </p>
                                                        </div>

                                                        {/* Saída */}
                                                        <div className="shrink-0 text-right w-24">
                                                            <p className="text-xs font-bold text-slate-700">
                                                                {getDepartureDate(order)}
                                                            </p>
                                                            {content?.returnDateTime && (
                                                                <p className="text-[9px] text-slate-400 font-medium font-sans">
                                                                    Volta: {new Date(content.returnDateTime).toLocaleDateString('pt-BR')}
                                                                </p>
                                                            )}
                                                        </div>

                                                        {/* Status Pagamento */}
                                                        <div className="shrink-0 w-28">
                                                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[9px] font-black uppercase tracking-wider ${payment.style}`}>
                                                                {payment.label}
                                                            </span>
                                                        </div>

                                                        {/* Ação: Motivo da Viagem */}
                                                        <div className="shrink-0 w-12 flex justify-center">
                                                            <div 
                                                                className="relative group/tooltip"
                                                                onClick={(e) => e.stopPropagation()}
                                                            >
                                                                <button
                                                                    type="button"
                                                                    className="p-1.5 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 rounded-lg transition-all"
                                                                >
                                                                    <Info className="w-4 h-4" />
                                                                </button>
                                                                <div className="absolute right-full bottom-[-8px] mr-3 w-[420px] sm:w-[480px] md:w-[500px] p-4 bg-slate-900 text-white text-[11px] rounded-2xl shadow-2xl opacity-0 pointer-events-none group-hover/tooltip:opacity-100 transition-opacity z-50 leading-relaxed text-left font-medium font-sans whitespace-normal break-words">
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

                        {/* Rodapé com ações */}
                        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 shrink-0 flex items-center justify-between">
                            {step === 'select' ? (
                                <>
                                    <span className="text-xs text-slate-500 font-bold">
                                        {selectedIds.size} de {filteredOrders.length} selecionado(s)
                                    </span>
                                    <button
                                        onClick={handleGenerateReport}
                                        disabled={selectedIds.size === 0}
                                        className="px-6 py-2.5 bg-indigo-600 text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-xl hover:bg-indigo-700 active:scale-95 transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                                    >
                                        <FileDown className="w-4 h-4" />
                                        Gerar Relatório
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button
                                        onClick={() => setStep('select')}
                                        className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 font-black text-[10px] uppercase tracking-[0.2em] rounded-xl hover:bg-slate-100 active:scale-95 transition-all flex items-center gap-2"
                                    >
                                        <ChevronUp className="w-4 h-4" />
                                        Voltar à Seleção
                                    </button>
                                    <button
                                        onClick={handlePrint}
                                        className="px-6 py-2.5 bg-indigo-600 text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-xl hover:bg-indigo-700 active:scale-95 transition-all shadow-lg shadow-indigo-600/20 flex items-center gap-2"
                                    >
                                        <Printer className="w-4 h-4" />
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
