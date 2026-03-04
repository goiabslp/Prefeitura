import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
    ArrowLeft, Search, PackageX, FileText, Clock, Trash2,
    FileDown, Calendar, Edit3, TrendingUp, Loader2,
    CheckCircle2, AlertCircle, CalendarCheck, Check, RotateCcw, AlignJustify,
    Paperclip, PackageCheck, FileSearch, Scale, Landmark, ShoppingCart, CheckCircle, XCircle,
    Eye, History, X, Lock, User, MessageCircle, Sparkles, Plus, Upload, Download, AlertTriangle, ShieldAlert, Zap, Info, Network, Trash, ArrowRight
} from 'lucide-react';
import { User as UserType, Order, AppState, BlockType, Attachment } from '../types';
import { DocumentPreview } from './DocumentPreview';
import { uploadFile } from '../services/storageService';
import { formatLocalDate, formatLocalDateTime } from '../utils/dateUtils';

const HashIcon = ({ className }: { className?: string }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="4" y1="9" x2="20" y2="9"></line>
        <line x1="4" y1="15" x2="20" y2="15"></line>
        <line x1="10" y1="3" x2="8" y2="21"></line>
        <line x1="16" x2="14" y2="21"></line>
    </svg>
);

interface TrackingScreenProps {
    onBack: () => void;
    currentUser: UserType;
    activeBlock: BlockType | null;
    orders: Order[];
    onDownloadPdf: (snapshot: AppState, blockType?: BlockType) => void;
    onClearAll: () => void;
    onEditOrder: (order: Order) => void;
    onDeleteOrder: (id: string) => void;
    onUpdateAttachments?: (orderId: string, attachments: Attachment[]) => void;
    totalCounter: number;
    onUpdatePaymentStatus?: (orderId: string, status: 'pending' | 'contabilidade' | 'paid') => void;
    onUpdateOrderStatus?: (orderId: string, status: Order['status']) => Promise<void>;
    showAllProcesses?: boolean;
}

export const TrackingScreen: React.FC<TrackingScreenProps> = ({
    onBack,
    currentUser,
    activeBlock,
    orders,
    onDownloadPdf,
    onClearAll,
    onEditOrder,
    onDeleteOrder,
    onUpdateAttachments,
    totalCounter,
    onUpdatePaymentStatus,
    onUpdateOrderStatus,
    showAllProcesses = false
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [downloadingId, setDownloadingId] = useState<string | null>(null);
    const [previewOrder, setPreviewOrder] = useState<Order | null>(null);
    const [historyOrder, setHistoryOrder] = useState<Order | null>(null);
    const [attachmentManagerOrder, setAttachmentManagerOrder] = useState<Order | null>(null);
    const [priorityJustificationOrder, setPriorityJustificationOrder] = useState<Order | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean, title: string, message: string, onConfirm: () => void, type: 'danger' | 'warning' }>({
        isOpen: false, title: '', message: '', onConfirm: () => { }, type: 'warning'
    });

    const extractOficioNumber = (text: string | undefined) => {
        if (!text) return '---';
        // Match standard format XXX/YYYY with flexible prefix (nº, n°, no, or just spaced)
        const match = text.match(/(?:(?:n[º°o]|\W|^)\s*)(\d+\s*\/\s*\d{4})/i);
        return match ? match[1] : '---';
    };

    const genericAttachmentRef = useRef<HTMLInputElement>(null);

    const isAdmin = currentUser.role === 'admin';
    const isDiarias = activeBlock === 'diarias';
    const isCompras = activeBlock === 'compras';
    const isLicitacao = activeBlock === 'licitacao';
    const isOficio = activeBlock === 'oficio';

    const filteredOrders = orders.filter(order => {
        const matchesBlock = order.blockType === activeBlock;
        if (!matchesBlock) return false;

        let hasPermission = false;
        const isPurchasingManager = currentUser.role === 'admin' || currentUser.role === 'compras';

        if (isCompras) {
            if (isPurchasingManager) {
                hasPermission = true;
            } else {
                const orderSector = order.documentSnapshot?.content.requesterSector || '';
                const userSector = currentUser.sector || '';
                hasPermission = userSector !== '' && orderSector.trim().toLowerCase() === userSector.trim().toLowerCase();
            }
        } else {
            hasPermission = isAdmin || currentUser.role === 'licitacao' || order.userId === currentUser.id;
        }

        if (!hasPermission && !showAllProcesses) return false;

        // LICITACAO: Filter Logic for "Processos" (showAllProcesses=true)
        if (isLicitacao && showAllProcesses) {
            // Only show Approved, In Progress, Finishing, Completed
            const allowed = ['approved', 'in_progress', 'finishing', 'completed'];
            if (!allowed.includes(order.status)) return false;
        }

        const matchesSearch = (order.protocol || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (order.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (order.userName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (order.documentSnapshot?.content.requesterSector || '').toLowerCase().includes(searchTerm.toLowerCase());

        return matchesSearch;
    });

    const handleDownload = (order: Order) => {
        setDownloadingId(order.id);
        let snapshotToDownload = order.documentSnapshot;

        if (order.blockType === 'licitacao' && snapshotToDownload) {
            const content = snapshotToDownload.content;
            const stages = content.licitacaoStages || [];
            const currentIdx = content.currentStageIndex || 0;

            // Determine 'Início' (Stage 0) data
            let inicioData;

            if (currentIdx === 0) {
                inicioData = {
                    body: content.body,
                    signatureName: content.signatureName,
                    signatureRole: content.signatureRole,
                    signatureSector: content.signatureSector,
                    signatures: content.signatures
                };
            } else {
                const historicStage0 = stages[0];
                inicioData = {
                    body: historicStage0?.body || '',
                    signatureName: historicStage0?.signatureName,
                    signatureRole: historicStage0?.signatureRole,
                    signatureSector: historicStage0?.signatureSector,
                    signatures: historicStage0?.signatures
                };
            }

            snapshotToDownload = {
                ...snapshotToDownload,
                content: {
                    ...content,
                    currentStageIndex: 0,
                    viewingStageIndex: 0,
                    body: inicioData.body,
                    signatureName: inicioData.signatureName || '',
                    signatureRole: inicioData.signatureRole || '',
                    signatureSector: inicioData.signatureSector || '',
                    signatures: inicioData.signatures,
                    licitacaoStages: [
                        {
                            id: 'stage-0',
                            title: 'Início',
                            body: inicioData.body,
                        }
                    ]
                }
            };
        }

        onDownloadPdf(snapshotToDownload!, order.blockType);
        setTimeout(() => setDownloadingId(null), 2000);
    };

    const getDepartureDate = (order: Order) => {
        return formatLocalDate(order.documentSnapshot?.content?.departureDateTime);
    };

    const handleGenericAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && attachmentManagerOrder) {
            setIsUploading(true);
            try {
                const publicUrl = await uploadFile(file, 'attachments', `user_upload_${attachmentManagerOrder.id}_${Date.now()}_${file.name}`);

                if (publicUrl) {
                    const newAttachment: Attachment = {
                        id: Date.now().toString(),
                        name: file.name,
                        url: publicUrl,
                        type: file.type,
                        date: new Date().toISOString()
                    };
                    const updatedList = [...(attachmentManagerOrder.attachments || []), newAttachment];
                    onUpdateAttachments?.(attachmentManagerOrder.id, updatedList);
                    setAttachmentManagerOrder({ ...attachmentManagerOrder, attachments: updatedList });
                } else {
                    alert('Erro ao fazer upload do arquivo.');
                }
            } catch (error) {
                console.error("Upload error:", error);
                alert("Erro ao enviar arquivo.");
            } finally {
                setIsUploading(false);
            }
        }
    };

    const removeAttachment = (attachmentId: string) => {
        if (attachmentManagerOrder) {
            const updatedList = (attachmentManagerOrder.attachments || []).filter(a => a.id !== attachmentId);
            onUpdateAttachments?.(attachmentManagerOrder.id, updatedList);
            setAttachmentManagerOrder({ ...attachmentManagerOrder, attachments: updatedList });
        }
    };

    const purchaseStatusMap = {
        recebido: { label: 'Pedido Recebido', icon: PackageCheck, color: 'text-indigo-600 bg-indigo-50 border-indigo-100' },
        coletando_orcamento: { label: 'Orçamento', icon: FileSearch, color: 'text-amber-600 bg-amber-50 border-amber-100' },
        aprovacao_orcamento: { label: 'Aprovação', icon: Scale, color: 'text-purple-600 bg-purple-50 border-purple-100' },
        coletando_dotacao: { label: 'Dotação', icon: Landmark, color: 'text-blue-600 bg-blue-50 border-blue-100' },
        realizado: { label: 'Pedido Realizado', icon: ShoppingCart, color: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
        concluido: { label: 'Concluído', icon: CheckCircle, color: 'text-slate-600 bg-slate-50 border-slate-100' },
        cancelado: { label: 'Cancelado', icon: XCircle, color: 'text-rose-600 bg-rose-50 border-rose-100' },
    };

    const priorityStyles = {
        'Normal': { icon: Info, color: 'text-slate-500 bg-slate-50 border-slate-200' },
        'Média': { icon: Zap, color: 'text-indigo-600 bg-indigo-50 border-indigo-100' },
        'Alta': { icon: AlertTriangle, color: 'text-amber-600 bg-amber-50 border-amber-200' },
        'Urgência': { icon: ShieldAlert, color: 'text-rose-600 bg-rose-50 border-rose-200' },
    };

    return (
        <>
            <div className="min-h-screen w-full bg-slate-100/50 backdrop-blur-sm font-sans flex items-center justify-center p-4 md:p-8 overflow-hidden animate-fade-in">
                <div className="w-full max-w-6xl bg-white rounded-[2.5rem] shadow-[0_25px_70px_-15px_rgba(0,0,0,0.15)] border border-slate-200 overflow-hidden animate-slide-up flex flex-col h-full max-h-[90vh]">

                    <div className="p-8 border-b border-slate-100 shrink-0 bg-white">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div>
                                <button
                                    onClick={() => {
                                        if (activeBlock === 'oficio' && onBack) {
                                            onBack();
                                        } else {
                                            onBack();
                                        }
                                    }}
                                    className="flex items-center gap-2 text-slate-400 hover:text-indigo-600 transition-colors text-xs font-bold uppercase tracking-widest mb-4 group"
                                >
                                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                                    {activeBlock === 'oficio' ? 'Voltar para Oficios' : 'Voltar ao Menu'}
                                </button>
                                <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
                                    <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/30">
                                        <FileText className="w-6 h-6 text-white" />
                                    </div>
                                    {activeBlock === 'oficio' ? 'Histórico de Ofícios' : `Histórico: ${activeBlock?.toUpperCase()}`}
                                </h2>
                                <p className="text-slate-500 text-sm mt-1 font-medium">
                                    {isAdmin ? 'Gerenciamento global de registros.' : isCompras ? 'Pedidos de compra autorizados para seu setor.' : 'Seus documentos gerados neste módulo.'}
                                </p>
                            </div>
                        </div>

                        <div className="mt-8 flex items-center gap-3 w-full">
                            <div className="relative flex-1 group">
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Buscar por Setor, Solicitante, Protocolo..."
                                    className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                                />
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            </div>
                            {isAdmin && filteredOrders.length > 0 && (
                                <button
                                    onClick={() => setConfirmModal({
                                        isOpen: true,
                                        title: "Limpar Histórico",
                                        message: "Deseja realmente apagar TODOS os registros deste bloco? Esta ação removerá os dados permanentemente.",
                                        type: 'danger',
                                        onConfirm: () => {
                                            onClearAll();
                                            setConfirmModal({ ...confirmModal, isOpen: false });
                                        }
                                    })}
                                    className="p-3.5 bg-red-50 text-red-500 border border-red-100 rounded-2xl hover:bg-red-500 hover:text-white transition-all shadow-sm flex items-center gap-2 font-bold text-xs uppercase"
                                >
                                    <Trash2 className="w-5 h-5" />
                                    <span className="hidden lg:inline">Limpar Bloco</span>
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto custom-scrollbar">
                        {
                            // DEBUG: Check what data is actually coming in for Oficios
                            (() => {
                                if (activeBlock === 'oficio' && filteredOrders.length > 0) {
                                    console.log('DEBUG: TrackingList Oficio Orders:', filteredOrders);
                                }
                                return null;
                            })()
                        }
                        {filteredOrders.length > 0 ? (
                            <div className={`min-w-full ${isLicitacao ? 'px-8 py-4 space-y-4' : ''}`}>
                                {!isLicitacao && (
                                    <div className="border-b border-slate-100 bg-slate-50/50 hidden md:grid md:grid-cols-12 gap-4 px-8 py-4 sticky top-0 z-10">
                                        {isCompras && (
                                            <div className="md:col-span-1 text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-center gap-2 whitespace-nowrap">
                                                <Calendar className="w-3 h-3" /> Pedido
                                            </div>
                                        )}
                                        {isCompras && (
                                            <div className="md:col-span-1 text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-center gap-2 whitespace-nowrap">
                                                Prioridade
                                            </div>
                                        )}
                                        <div className={`${isCompras ? 'md:col-span-1' : 'md:col-span-2'} text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center ${isCompras ? 'justify-center' : 'gap-2'} whitespace-nowrap`}>
                                            <HashIcon className="w-3 h-3" /> {isCompras ? 'ID' : (isOficio ? 'Número do Ofício' : 'Protocolo')}
                                        </div>
                                        <div className={`${isDiarias ? 'md:col-span-4' : isCompras ? 'md:col-span-3 text-center' : 'md:col-span-3'} text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center ${isCompras ? 'justify-center' : 'gap-2'} whitespace-nowrap`}>
                                            {isDiarias ? <><FileText className="w-3 h-3" /> Solicitante + Destino</> : isCompras ? <><Network className="w-3 h-3" /> Setor / Solicitante</> : <><FileText className="w-3 h-3" /> Solicitante</>}
                                        </div>
                                        {!isDiarias && !isCompras && (
                                            <div className="md:col-span-3 text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 whitespace-nowrap">
                                                <AlignJustify className="w-3 h-3" /> Descrição
                                            </div>
                                        )}
                                        {isDiarias && (
                                            <div className="md:col-span-2 text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 whitespace-nowrap">
                                                <CalendarCheck className="w-3 h-3" /> Saída
                                            </div>
                                        )}
                                        {isCompras && (
                                            <>
                                                <div className="md:col-span-1 text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-center gap-2 whitespace-nowrap">
                                                    <Clock className="w-3 h-3" /> Previsão
                                                </div>
                                                <div className="md:col-span-2 text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-center gap-2 whitespace-nowrap">
                                                    <RotateCcw className="w-3 h-3" /> Status
                                                </div>
                                            </>
                                        )}
                                        {!isCompras && (
                                            <div className="md:col-span-2 text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 whitespace-nowrap">
                                                {isDiarias ? <><RotateCcw className="w-3 h-3" /> Pagamento</> : <><Calendar className="w-3 h-3" /> Criação</>}
                                            </div>
                                        )}
                                        <div className={`${isCompras ? 'md:col-span-3' : 'md:col-span-2'} text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-center whitespace-nowrap`}>Ações</div>
                                    </div>
                                )}

                                <div className={`${isLicitacao ? 'space-y-4' : 'divide-y divide-slate-100'}`}>
                                    {filteredOrders.map((order) => {
                                        const content = order.documentSnapshot?.content;
                                        const isPaid = order.paymentStatus === 'paid';
                                        const purchaseStatus = order.purchaseStatus || (order.status === 'approved' ? 'recebido' : undefined);
                                        // Standard pStatus for Compras
                                        let pStatus = purchaseStatus ? purchaseStatusMap[purchaseStatus as keyof typeof purchaseStatusMap] : null;

                                        // Licitacao Logic OVERRIDE
                                        if (isLicitacao) {
                                            const statusConfig = {
                                                pending: { label: 'Em Elaboração', class: 'bg-slate-100 text-slate-600 border-slate-200' },
                                                completed: { label: 'Concluído', class: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
                                                awaiting_approval: { label: 'Em Aprovação', class: 'bg-amber-50 text-amber-700 border-amber-100' },
                                                approved: { label: 'Aprovado', class: 'bg-indigo-50 text-indigo-700 border-indigo-100' },
                                                in_progress: { label: 'Em Andamento', class: 'bg-blue-50 text-blue-700 border-blue-100' },
                                                finishing: { label: 'Finalizando', class: 'bg-purple-50 text-purple-700 border-purple-100 animate-pulse' }
                                            };
                                            const sConf = statusConfig[order.status as keyof typeof statusConfig] || statusConfig.pending;
                                            // For Licitacao map loop, we handle it separately visually below in the if(isLicitacao) block
                                        }

                                        const isOverdue = order.completionForecast && new Date(order.completionForecast) < new Date();
                                        const priority = content?.priority || 'Normal';
                                        const pStyle = priorityStyles[priority as keyof typeof priorityStyles] || priorityStyles['Normal'];

                                        if (isLicitacao) {
                                            const statusConfig = {
                                                pending: { label: 'Em Elaboração', class: 'bg-slate-100 text-slate-600 border-slate-200' },
                                                completed: { label: 'Concluído', class: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
                                                awaiting_approval: { label: 'Em Aprovação', class: 'bg-amber-50 text-amber-700 border-amber-100' },
                                                approved: { label: 'Aprovado', class: 'bg-indigo-50 text-indigo-700 border-indigo-100' },
                                                in_progress: { label: 'Em Andamento', class: 'bg-blue-50 text-blue-700 border-blue-100' },
                                                finishing: { label: 'Finalizando', class: 'bg-purple-50 text-purple-700 border-purple-100 animate-pulse' }
                                            };
                                            const sConf = statusConfig[order.status as keyof typeof statusConfig] || statusConfig.pending;
                                            const orderDate = formatLocalDateTime(order.createdAt);

                                            let forecastDisplay = '---';
                                            if (content?.completionForecast) {
                                                const match = content.completionForecast.match(/(\d+)/);
                                                if (match) {
                                                    const totalDays = parseInt(match[1], 10);
                                                    const createdAt = new Date(order.createdAt);
                                                    const now = new Date();
                                                    const diffTime = Math.abs(now.getTime() - createdAt.getTime());
                                                    const daysPassed = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                                                    const remaining = totalDays - daysPassed;

                                                    if (remaining < 0) {
                                                        forecastDisplay = `Atrasado (${Math.abs(remaining)}d)`;
                                                    } else {
                                                        const remainingPadded = remaining.toString().padStart(2, '0');
                                                        forecastDisplay = `${remainingPadded} Dias`;
                                                    }
                                                } else {
                                                    forecastDisplay = content.completionForecast;
                                                }
                                            }
                                            const oficioMatch = content?.leftBlockText?.match(/Ofício nº\s*([^\n]+)/i);
                                            const oficioNumber = oficioMatch ? oficioMatch[1] : '---';

                                            return (
                                                <div key={order.id} className="bg-white rounded-2xl border border-slate-200/60 p-5 flex flex-col gap-5 shadow-sm hover:shadow-xl hover:border-blue-200/50 hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden group">
                                                    <div className="absolute top-0 left-0 w-1 rounded-l-2xl h-full bg-gradient-to-b from-blue-500 to-indigo-600 opacity-80 group-hover:opacity-100 transition-opacity" />

                                                    <div className="grid grid-cols-1 md:grid-cols-7 gap-4 items-center">
                                                        <div className="flex flex-col gap-1">
                                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                                                <HashIcon className="w-3 h-3 text-slate-300" /> ID
                                                            </span>
                                                            <span className="font-mono text-xs font-bold text-slate-700 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100 w-fit group-hover:bg-blue-50/50 group-hover:border-blue-100 group-hover:text-blue-700 transition-colors">
                                                                {content?.protocolId || '---'}
                                                            </span>
                                                        </div>

                                                        <div className="flex flex-col gap-1 md:col-span-2">
                                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Objeto</span>
                                                            <span className="text-xs font-bold text-slate-800 line-clamp-1" title={order.title}>{order.title || 'Sem Título'}</span>
                                                        </div>

                                                        <div className="flex flex-col gap-1">
                                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                                                <FileText className="w-3 h-3 text-slate-300" /> Forma
                                                            </span>
                                                            <span className="text-xs font-semibold text-slate-700 truncate" title={content?.processType}>
                                                                {content?.processType || '---'}
                                                            </span>
                                                        </div>

                                                        <div className="flex flex-col gap-1">
                                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Processo</span>
                                                            <span className="font-mono text-xs font-medium text-slate-600">
                                                                {content?.protocol || '---'}
                                                            </span>
                                                        </div>

                                                        <div className="flex flex-col min-w-0">
                                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Status / Etapa</span>
                                                            <div className="flex items-center gap-2 flex-nowrap">
                                                                {order.status === 'pending' ? (
                                                                    <button
                                                                        onClick={() => onUpdateOrderStatus?.(order.id, 'awaiting_approval')}
                                                                        className={`inline-flex px-2.5 py-1 rounded-md text-[9px] font-bold uppercase tracking-wide border shadow-sm whitespace-nowrap transition-all hover:scale-105 active:scale-95 cursor-pointer ${sConf.class}`}
                                                                        title="Clique para enviar para aprovação"
                                                                    >
                                                                        {sConf.label}
                                                                    </button>
                                                                ) : (
                                                                    <span className={`inline-flex px-2.5 py-1 rounded-md text-[9px] font-bold uppercase tracking-wide border shadow-sm whitespace-nowrap ${sConf.class}`}>
                                                                        {sConf.label}
                                                                    </span>
                                                                )}
                                                                <span className="inline-flex px-2.5 py-1 rounded-md text-[9px] font-bold uppercase tracking-wide border bg-blue-50 text-blue-700 border-blue-100 shadow-sm whitespace-nowrap">
                                                                    {order.stage || 'Início'}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        <div className="flex flex-col items-start justify-self-end">
                                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Ações</span>
                                                            <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                                                                <button onClick={() => onEditOrder(order)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all active:scale-95" title={order.status === 'approved' || order.status === 'completed' ? "Visualizar" : "Editar"}>
                                                                    {order.status === 'approved' || order.status === 'completed' ? <Eye className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
                                                                </button>
                                                                <button onClick={() => handleDownload(order)} disabled={downloadingId === order.id} className={`p-1.5 rounded-lg transition-all active:scale-95 ${downloadingId === order.id ? 'text-indigo-400 bg-indigo-50' : 'text-slate-400 hover:bg-indigo-600 hover:text-white'}`} title="Download">
                                                                    {downloadingId === order.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                                                                </button>
                                                                <button onClick={() => setConfirmModal({ isOpen: true, title: "Excluir Registro", message: `Deseja remover "${order.protocol}"?`, type: 'danger', onConfirm: () => { onDeleteOrder(order.id); setConfirmModal({ ...confirmModal, isOpen: false }); } })} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all active:scale-95" title="Excluir">
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent w-full" />

                                                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                                        <div className="flex flex-col">
                                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                                                                <Calendar className="w-3 h-3 text-slate-300" /> Data do Pedido
                                                            </span>
                                                            <span className="text-xs font-medium text-slate-600">
                                                                {orderDate}
                                                            </span>
                                                        </div>

                                                        <div className="flex flex-col">
                                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                                                                <Clock className="w-3 h-3 text-slate-300" /> Previsão de Conclusão
                                                            </span>
                                                            <span className={`text-xs font-bold ${forecastDisplay.includes('Atrasado') ? 'text-rose-500' : 'text-emerald-600'}`}>
                                                                {forecastDisplay}
                                                            </span>
                                                        </div>

                                                        <div className="flex flex-col">
                                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                                                                <User className="w-3 h-3 text-slate-300" /> Solicitante
                                                            </span>
                                                            <span className="text-xs font-semibold text-slate-700" title={content?.requesterName}>
                                                                {content?.requesterName || '---'}
                                                            </span>
                                                        </div>

                                                        <div className="flex flex-col">
                                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                                                                <Network className="w-3 h-3 text-slate-300" /> Setor Solicitante
                                                            </span>
                                                            <span className="text-xs font-medium text-slate-600 truncate" title={content?.requesterSector}>
                                                                {content?.requesterSector || '---'}
                                                            </span>
                                                        </div>

                                                        <div className="flex flex-col">
                                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                                                                <FileText className="w-3 h-3 text-slate-300" /> Ofício do Solicitante
                                                            </span>
                                                            <span className="text-xs font-medium text-slate-600 truncate">
                                                                {oficioNumber !== '---' ? `Nº ${oficioNumber}` : '---'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        }

                                        return (
                                            <div key={order.id} className="grid grid-cols-1 md:grid-cols-12 gap-4 px-8 py-5 hover:bg-slate-50/80 transition-colors items-center">
                                                {/* Date Cell for Compras */}
                                                {isCompras && (
                                                    <div className="md:col-span-1 flex justify-center">
                                                        <div className="w-11 h-11 bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center shadow-sm shrink-0">
                                                            <span className="text-[7px] font-black text-slate-400 uppercase">
                                                                {new Date(order.createdAt).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace(/ de /g, '/').replace('.', '')}
                                                            </span>
                                                            <span className="text-base font-black text-emerald-600 leading-none">{new Date(order.createdAt).getDate()}</span>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Priority for Compras */}
                                                {isCompras && (
                                                    <div className="md:col-span-1 flex justify-center">
                                                        {(priority === 'Alta' || priority === 'Urgência') ? (
                                                            <button
                                                                onClick={() => setPriorityJustificationOrder(order)}
                                                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[8px] font-black uppercase tracking-tight transition-all hover:scale-105 active:scale-95 cursor-pointer hover:shadow-sm ${pStyle.color}`}
                                                                title="Clique para ver a justificativa"
                                                            >
                                                                <pStyle.icon className="w-2.5 h-2.5" />
                                                                {priority}
                                                            </button>
                                                        ) : (
                                                            <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[8px] font-black uppercase tracking-tight ${pStyle.color}`} title={`Prioridade: ${priority}`}>
                                                                <pStyle.icon className="w-2.5 h-2.5" />
                                                                {priority}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Protocol/ID */}
                                                <div className={`${isCompras ? 'md:col-span-1 border-x border-slate-100 flex items-center justify-center' : 'md:col-span-2'} py-4 flex justify-center`}>
                                                    <span className="text-xs font-black text-slate-900 tracking-tighter">
                                                        {isCompras ? order.id.slice(-6).toUpperCase() : (order.blockType === 'oficio' ? ((order.protocol || '').startsWith('OFC-') ? (order.protocol || '').replace('OFC-', 'Nº ') : (order.protocol || '---')) : (order.protocol || '---'))}
                                                    </span>
                                                </div>

                                                {/* Solicitante/Sector */}
                                                <div className={`${isDiarias ? 'md:col-span-4' : isCompras ? 'md:col-span-3 text-center' : 'md:col-span-3'}`}>
                                                    <h3 className="text-sm font-bold text-slate-800 leading-tight">
                                                        {isDiarias ? (content?.requesterName || '---') :
                                                            isCompras ? (content?.requesterSector || 'Sem Setor') :
                                                                (order.blockType === 'oficio' ? (order.requestingSector || 'Sem Setor') : order.userName)}
                                                    </h3>
                                                    {isDiarias ? (
                                                        <p className="text-[10px] text-slate-400 font-medium">
                                                            {content?.destination || '---'}
                                                        </p>
                                                    ) : isCompras ? (
                                                        <p className="text-[10px] text-slate-400 font-medium">
                                                            {order.userName}
                                                        </p>
                                                    ) : (order.blockType === 'oficio' ? (
                                                        <p className="text-[10px] text-slate-400 font-medium">
                                                            {order.userName}
                                                        </p>
                                                    ) : null)}
                                                </div>

                                                {/* Description (Oficio/Diaria/Others) */}
                                                {!isDiarias && !isCompras && !isLicitacao && (
                                                    <div className="md:col-span-3">
                                                        <p className="text-[11px] text-slate-600 font-medium leading-relaxed line-clamp-2 italic" title={order.description}>
                                                            {order.description || <span className="text-slate-300 opacity-50">Sem descrição</span>}
                                                        </p>
                                                    </div>
                                                )}

                                                {/* Diarias Specific Date */}
                                                {isDiarias && (
                                                    <div className="md:col-span-2 text-slate-600 text-xs font-bold">
                                                        {getDepartureDate(order)}
                                                    </div>
                                                )}

                                                {/* Compras Specific: Previsao + Status */}
                                                {isCompras && (
                                                    <>
                                                        <div className="md:col-span-1 flex flex-col items-center">
                                                            {order.completionForecast ? (
                                                                <>
                                                                    <div className={`w-11 h-11 bg-white rounded-xl border flex flex-col items-center justify-center shadow-sm shrink-0 transition-colors ${isOverdue ? 'border-rose-200 shadow-rose-500/5' : 'border-slate-200'}`}>
                                                                        <span className="text-[7px] font-black text-slate-400 uppercase">
                                                                            {new Date(order.completionForecast).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace(/ de /g, '/').replace('.', '')}
                                                                        </span>
                                                                        <span className={`text-base font-black leading-none ${isOverdue ? 'text-rose-500' : 'text-indigo-600'}`}>
                                                                            {new Date(order.completionForecast).getDate()}
                                                                        </span>
                                                                    </div>
                                                                    <span className={`text-[7px] font-black uppercase px-1 mt-1 rounded w-fit ${isOverdue ? 'text-rose-500 bg-rose-50' : 'text-slate-400 bg-slate-50'}`}>
                                                                        {isOverdue ? 'Atrasado' : 'No Prazo'}
                                                                    </span>
                                                                </>
                                                            ) : (
                                                                <span className="text-[10px] text-slate-400 italic">---</span>
                                                            )}
                                                        </div>
                                                        <div className="md:col-span-2 flex justify-center">
                                                            {pStatus ? (
                                                                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[9px] font-black uppercase tracking-wider ${pStatus.color}`}>
                                                                    <pStatus.icon className="w-3.5 h-3.5" />
                                                                    {pStatus.label}
                                                                </div>
                                                            ) : (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        if (order.status === 'pending' && isLicitacao) {
                                                                            onUpdateOrderStatus?.(order.id, 'awaiting_approval');
                                                                        }
                                                                    }}
                                                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest ${order.status === 'awaiting_approval'
                                                                        ? 'bg-amber-50 text-amber-700 border-amber-100 cursor-default'
                                                                        : 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100 transition-colors'
                                                                        }`}
                                                                >
                                                                    {order.status === 'awaiting_approval' ? (
                                                                        <>
                                                                            <Clock className="w-3 h-3 animate-pulse" /> Aguardando Aprovação
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <CheckCircle className="w-3 h-3" /> Enviar para Aprovação
                                                                        </>
                                                                    )}
                                                                </button>
                                                            )}
                                                        </div>
                                                    </>
                                                )}

                                                {/* Diarias Status (Payment) */}
                                                {isDiarias && (() => {
                                                    const pStatusStr = order.paymentStatus || 'pending';
                                                    const isPaid = pStatusStr === 'paid';
                                                    const canAdvanceToPaid = currentUser.permissions.includes('parent_diarias') || currentUser.role === 'admin';

                                                    const statusMap = {
                                                        pending: { label: 'Pendente', icon: Clock, styles: 'bg-amber-50 border-amber-200 text-amber-700 shadow-amber-500/10', pulse: true },
                                                        contabilidade: { label: 'Contabilidade', icon: FileSearch, styles: 'bg-purple-50 border-purple-200 text-purple-700 shadow-purple-500/10', pulse: false },
                                                        paid: { label: 'Pago', icon: CheckCircle2, styles: 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-emerald-500/10', pulse: false }
                                                    };
                                                    const sConf = statusMap[pStatusStr as keyof typeof statusMap] || statusMap.pending;
                                                    const StatusIcon = sConf.icon;

                                                    return (
                                                        <div className="md:col-span-2">
                                                            {isAdmin ? (
                                                                <div className="flex flex-col gap-1">
                                                                    <button
                                                                        onClick={() => {
                                                                            const nextStatus = pStatusStr === 'pending' ? 'contabilidade' : (pStatusStr === 'contabilidade' ? 'paid' : 'pending');
                                                                            onUpdatePaymentStatus?.(order.id, nextStatus as any);
                                                                        }}
                                                                        className={`relative group flex items-center justify-between w-full max-w-[140px] px-3 py-2 rounded-xl border transition-all duration-300 active:scale-95 shadow-sm ${sConf.styles}`}
                                                                    >
                                                                        <div className="flex items-center gap-2">
                                                                            <StatusIcon className={`w-4 h-4 ${sConf.pulse ? 'animate-pulse' : ''}`} />
                                                                            <span className="text-[10px] font-black uppercase tracking-widest">
                                                                                {sConf.label}
                                                                            </span>
                                                                        </div>
                                                                        <div className="hidden group-hover:block transition-all ml-1">
                                                                            <Edit3 className="w-3 h-3 opacity-40" />
                                                                        </div>
                                                                    </button>
                                                                    {isPaid && order.paymentDate && (
                                                                        <span className="text-[9px] font-bold text-emerald-500 ml-2 flex items-center gap-1">
                                                                            <Check className="w-2.5 h-2.5" />
                                                                            {formatLocalDateTime(order.paymentDate)}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <div className="flex flex-col gap-1">
                                                                    {canAdvanceToPaid && !isPaid ? (
                                                                        <button
                                                                            onClick={() => onUpdatePaymentStatus?.(order.id, 'paid')}
                                                                            className={`relative group flex items-center justify-between w-full max-w-[140px] px-3 py-2 rounded-xl border transition-all duration-300 active:scale-95 shadow-sm ${sConf.styles}`}
                                                                            title="Marcar como Pago"
                                                                        >
                                                                            <div className="flex items-center gap-2">
                                                                                <StatusIcon className={`w-4 h-4 ${sConf.pulse ? 'animate-pulse' : ''}`} />
                                                                                <span className="text-[10px] font-black uppercase tracking-widest">
                                                                                    {sConf.label}
                                                                                </span>
                                                                            </div>
                                                                            <div className="hidden group-hover:block transition-all ml-1">
                                                                                <CheckCircle2 className="w-3 h-3 opacity-40 hover:opacity-100 text-emerald-600" />
                                                                            </div>
                                                                        </button>
                                                                    ) : (
                                                                        <div className={`inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full border w-fit shadow-sm ${sConf.styles}`}>
                                                                            <StatusIcon className={`w-3.5 h-3.5 ${sConf.pulse ? 'animate-pulse' : ''}`} />
                                                                            {sConf.label}
                                                                        </div>
                                                                    )}
                                                                    {isPaid && order.paymentDate && (
                                                                        <span className="text-[9px] font-bold text-emerald-500 ml-3">
                                                                            Data: {formatLocalDateTime(order.paymentDate)}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })()}

                                                {/* Creation Date for others */}
                                                {!isCompras && !isDiarias && !isLicitacao && (
                                                    <div className="md:col-span-2 text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 whitespace-nowrap">
                                                        <Calendar className="w-3 h-3" />
                                                        {new Date(order.createdAt).toLocaleDateString('pt-BR')}
                                                    </div>
                                                )}

                                                {/* Actions */}
                                                <div className={`${isCompras ? 'md:col-span-3' : 'md:col-span-2'} flex items-center justify-center gap-1`}>
                                                    {isCompras && (
                                                        <button
                                                            onClick={() => setAttachmentManagerOrder(order)}
                                                            className="p-2 rounded-xl border bg-white text-slate-400 border-slate-200 hover:text-emerald-600 hover:border-emerald-200 transition-all hover:bg-emerald-50/50 relative group"
                                                            title="Gerenciar Anexos"
                                                        >
                                                            <Paperclip className="w-5 h-5" />
                                                            {(order.attachments?.length || 0) > 0 && (
                                                                <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 text-white text-[8px] font-black flex items-center justify-center rounded-full shadow-sm ring-2 ring-white">
                                                                    {order.attachments?.length}
                                                                </span>
                                                            )}
                                                        </button>
                                                    )}

                                                    {(isCompras || order.blockType === 'oficio') && (
                                                        <button
                                                            onClick={() => setPreviewOrder(order)}
                                                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                                                            title="Visualizar"
                                                        >
                                                            <Eye className="w-5 h-5" />
                                                        </button>
                                                    )}

                                                    {isCompras && (
                                                        <button
                                                            onClick={() => setHistoryOrder(order)}
                                                            className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all"
                                                            title="Histórico de Movimentação"
                                                        >
                                                            <History className="w-5 h-5" />
                                                        </button>
                                                    )}

                                                    <button onClick={() => onEditOrder(order)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all" title={order.status === 'approved' || order.status === 'completed' || order.status === 'awaiting_approval' ? "Visualizar" : "Editar"}>
                                                        {order.status === 'approved' || order.status === 'completed' || order.status === 'awaiting_approval' ? <Eye className="w-5 h-5" /> : <Edit3 className="w-5 h-5" />}
                                                    </button>

                                                    {!isOficio && !isDiarias && (
                                                        <button
                                                            onClick={() => handleDownload(order)}
                                                            disabled={downloadingId === order.id}
                                                            className={`p-2 rounded-xl transition-all ${downloadingId === order.id ? 'text-indigo-400 bg-indigo-50' : 'text-indigo-600 hover:bg-indigo-600 hover:text-white'}`}
                                                            title="Download PDF"
                                                        >
                                                            {downloadingId === order.id ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileDown className="w-5 h-5" />}
                                                        </button>
                                                    )}

                                                    <button
                                                        onClick={() => setConfirmModal({
                                                            isOpen: true,
                                                            title: "Excluir Registro",
                                                            message: `Deseja realmente remover o registro "${order.protocol}" do histórico?`,
                                                            type: 'danger',
                                                            onConfirm: () => {
                                                                onDeleteOrder(order.id);
                                                                setConfirmModal({ ...confirmModal, isOpen: false });
                                                            }
                                                        })}
                                                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all" title="Excluir"
                                                    >
                                                        <Trash2 className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 p-12">
                                <PackageX className="w-12 h-12 opacity-30 mb-4" />
                                <p className="text-lg font-bold text-slate-500">Histórico Vazio</p>
                                <p className="text-sm text-slate-400 mt-1 text-center">Nenhum registro encontrado para seu setor ou módulo.</p>
                            </div>
                        )}
                    </div>

                    <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        <span>Exibindo {filteredOrders.length} registros</span>
                        <span>Sistema de Gestão Pública v1.2.0</span>
                    </div>
                </div>

                {
                    confirmModal.isOpen && createPortal(
                        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in">
                            <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl overflow-hidden animate-slide-up border border-white/20">
                                <div className="p-8 text-center">
                                    <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl ${confirmModal.type === 'danger' ? 'bg-rose-50 text-rose-600 shadow-rose-500/10' :
                                        'bg-indigo-50 text-indigo-600 shadow-indigo-500/10'
                                        }`}>
                                        {confirmModal.type === 'danger' ? <Trash className="w-10 h-10" /> : <Info className="w-10 h-10" />}
                                    </div>
                                    <h3 className="text-2xl font-black text-slate-900 tracking-tight mb-2 uppercase">{confirmModal.title}</h3>
                                    <p className="text-slate-500 text-sm font-medium leading-relaxed px-4">{confirmModal.message}</p>
                                </div>
                                <div className="p-6 bg-slate-50 border-t border-slate-100 flex flex-col gap-3">
                                    <button
                                        onClick={confirmModal.onConfirm}
                                        className={`w-full py-4 text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl shadow-xl transition-all active:scale-[0.98] ${confirmModal.type === 'danger' ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20' :
                                            'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20'
                                            }`}
                                    >
                                        Confirmar Ação
                                    </button>
                                    <button
                                        onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                                        className="w-full py-4 bg-white text-slate-400 font-black text-xs uppercase tracking-[0.2em] rounded-2xl border border-slate-200 hover:bg-slate-50 hover:text-slate-600 transition-all"
                                    >
                                        Cancelar
                                    </button>
                                </div>
                            </div>
                        </div>,
                        document.body
                    )
                }

                {/* MODAL OFICIO/DOCUMENT PREVIEW */}
                {previewOrder && previewOrder.documentSnapshot && (
                    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in">
                        <div className="bg-white rounded-[2.5rem] w-full max-w-4xl h-[80vh] overflow-hidden flex flex-col shadow-2xl">
                            <div className="p-4 border-b flex justify-between items-center">
                                <h3 className="font-bold text-slate-700">Visualização</h3>
                                <button onClick={() => setPreviewOrder(null)} className="p-2 hover:bg-slate-100 rounded-full"><X className="w-5 h-5" /></button>
                            </div>
                            <div className="flex-1 overflow-auto bg-slate-100 p-8 flex justify-center">
                                <DocumentPreview
                                    state={{
                                        ...previewOrder.documentSnapshot,
                                        content: {
                                            ...(previewOrder.documentSnapshot?.content || {}),
                                            protocol: previewOrder.protocol,
                                            leftBlockText: `Solicitação Nº: ${previewOrder.protocol}`,
                                            requesterName: previewOrder.documentSnapshot?.content?.requesterName || previewOrder.userName,
                                            globalStatus: previewOrder.status,
                                            paymentStatus: previewOrder.paymentStatus,
                                            paymentDate: previewOrder.paymentDate,
                                            createdAt: previewOrder.createdAt
                                        }
                                    } as any}
                                    scale={0.8}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* MODAL ATTACHMENTS MANAGER */}
                {attachmentManagerOrder && (
                    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in">
                        <div className="bg-white rounded-[2.5rem] w-full max-w-lg overflow-hidden flex flex-col shadow-2xl">
                            <div className="p-6 border-b flex justify-between items-center">
                                <h3 className="font-bold text-slate-800 flex items-center gap-2"><Paperclip className="w-5 h-5" /> Gerenciar Anexos</h3>
                                <button onClick={() => setAttachmentManagerOrder(null)} className="p-2 hover:bg-slate-100 rounded-full"><X className="w-5 h-5" /></button>
                            </div>
                            <div className="p-6 flex-1 overflow-auto">
                                <div className="space-y-3 mb-6">
                                    {attachmentManagerOrder.attachments?.map(att => (
                                        <div key={att.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 bg-white rounded-lg border border-slate-200 flex items-center justify-center">
                                                    <FileText className="w-4 h-4 text-slate-400" />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-bold text-slate-700 truncate max-w-[150px]">{att.name}</span>
                                                    <span className="text-[10px] text-slate-400">{new Date(att.date).toLocaleDateString()}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <a href={att.url} target="_blank" rel="noreferrer" className="p-1.5 text-indigo-500 hover:bg-indigo-50 rounded-lg"><Eye className="w-4 h-4" /></a>
                                                <button onClick={() => removeAttachment(att.id)} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                                            </div>
                                        </div>
                                    ))}
                                    {(!attachmentManagerOrder.attachments || attachmentManagerOrder.attachments.length === 0) && (
                                        <p className="text-center text-slate-400 text-sm py-4">Nenhum anexo encontrado.</p>
                                    )}
                                </div>

                                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-300 border-dashed rounded-2xl cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors">
                                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                        {isUploading ? <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-2" /> : <Upload className="w-8 h-8 text-slate-400 mb-2" />}
                                        <p className="text-xs text-slate-500 font-bold uppercase tracking-wide">Clique para adicionar</p>
                                    </div>
                                    <input ref={genericAttachmentRef} type="file" className="hidden" onChange={handleGenericAttachmentUpload} disabled={isUploading} />
                                </label>
                            </div>
                        </div>
                    </div>
                )}

                {/* MODAL JUSTIFICATION */}
                {priorityJustificationOrder && (
                    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in">
                        <div className="bg-white rounded-[2rem] w-full max-w-md p-8 shadow-2xl relative">
                            <button onClick={() => setPriorityJustificationOrder(null)} className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-full"><X className="w-5 h-5 text-slate-400" /></button>
                            <div className="flex flex-col items-center text-center">
                                <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mb-4 text-amber-600 shadow-sm">
                                    <AlertTriangle className="w-8 h-8" />
                                </div>
                                <h3 className="text-xl font-black text-slate-800 uppercase mb-2">Justificativa de Prioridade</h3>
                                <p className="text-sm text-slate-500 font-medium leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100 w-full">
                                    {/* Accessing internal content for justification if available, assuming it is stored in content or history */}
                                    {/* For now displaying generic message as we dont have direct justification field in core Order type except in history usually */}
                                    Visualização da justificativa não implementada no modelo de dados atual.
                                </p>
                                <button onClick={() => setPriorityJustificationOrder(null)} className="mt-6 w-full py-3 bg-slate-900 text-white font-bold uppercase tracking-widest text-xs rounded-xl hover:bg-indigo-600 transition-colors">Fechar</button>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </>
    );
};
