import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    ArrowLeft, Search, PackageX, FileText, Clock, Trash2,
    FileDown, Calendar, Edit3, TrendingUp, Loader2,
    CheckCircle2, AlertCircle, CalendarCheck, Check, RotateCcw,
    Paperclip, PackageCheck, FileSearch, Scale, Landmark, ShoppingCart, CheckCircle, XCircle,
    Eye, History, X, Lock, User, MessageCircle, Sparkles, Plus, Upload, Download, AlertTriangle, ShieldAlert, Zap, Info, Network, Trash, ArrowRight, Edit2, MapPin, ChevronRight, MousePointer2,
    Filter, ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { User as UserType, Order, AppState, BlockType, Attachment, Sector, PurchaseAccount } from '../types';
import { DocumentPreview } from './DocumentPreview';
import { uploadFile } from '../services/storageService';
import { AccountSelectionModal } from './compras/AccountSelectionModal';
import { updateOrderAccount } from '../services/comprasService';
import { formatLocalDate } from '../utils/dateUtils';
import { useOficios, useOficio, useUpdateOficioDescription, useInfiniteOficios } from '../hooks/useOficios';
import { usePurchaseOrders, usePurchaseOrder, useInfinitePurchaseOrders } from '../hooks/usePurchaseOrders';
import { useServiceRequests, useServiceRequest, useInfiniteServiceRequests } from '../hooks/useServiceRequests';
import { useInfiniteLicitacao } from '../hooks/useLicitacao';

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
    onDownloadPdf: (snapshot: AppState, blockType?: BlockType, order?: Order) => void;
    onClearAll: () => void;
    onEditOrder: (order: Order) => void;
    onDeleteOrder: (id: string) => void;
    onUpdateAttachments?: (orderId: string, attachments: Attachment[]) => void;
    totalCounter: number;
    onUpdatePaymentStatus?: (orderOrId: string | Order, status: 'pending' | 'contabilidade' | 'paid') => void;
    onUpdateOrderStatus?: (orderOrId: string | Order, status: Order['status'], justification?: string) => Promise<void>;
    onUpdatePurchaseStatus?: (orderOrId: string | Order, status: string, justification?: string, budgetFileUrl?: string, completionForecast?: string) => Promise<void>;
    showAllProcesses?: boolean;
    onViewOrder?: (order: Order) => void;
    sectors?: Sector[];
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
    onUpdatePurchaseStatus,
    showAllProcesses = false,
    onViewOrder,
    sectors = []
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [purchaseStatusFilter, setPurchaseStatusFilter] = useState('all');
    const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
    const statusDropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
                setIsStatusDropdownOpen(false);
            }
        };

        if (isStatusDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isStatusDropdownOpen]);

    // OFICIOS
    const {
        data: infiniteOficios,
        fetchNextPage: fetchNextOficios,
        hasNextPage: hasNextOficios,
        isFetchingNextPage: isFetchingStrictOficios,
        isLoading: isOficiosLoading,
        isError: isOficiosError
    } = useInfiniteOficios(20, searchTerm);

    const oficiosData = React.useMemo(() => {
        const remote = infiniteOficios?.pages.flat() || [];
        if (!orders || orders.length === 0) return remote;
        return remote.map(order => {
            const local = orders.find(o => o.id === order.id);
            return local ? { ...order, ...local } : order;
        });
    }, [infiniteOficios, orders]);

    // COMPRAS
    const {
        data: infinitePurchaseOrders,
        fetchNextPage: fetchNextPurchaseOrders,
        hasNextPage: hasNextPurchaseOrders,
        isFetchingNextPage: isFetchingNextPurchaseOrders,
        isLoading: isLoadingPurchaseOrders,
        isError: isPurchaseError
    } = useInfinitePurchaseOrders(
        20,
        searchTerm,
        purchaseStatusFilter === 'pending_approval' ? 'pending_approval' : (purchaseStatusFilter === 'rejected' ? 'rejected' : undefined),
        (purchaseStatusFilter !== 'all' && purchaseStatusFilter !== 'pending_approval' && purchaseStatusFilter !== 'rejected') ? purchaseStatusFilter : undefined
    );

    const { data: remoteAllPurchaseOrders } = usePurchaseOrders();
    const allPurchaseOrders = React.useMemo(() => {
        if (!remoteAllPurchaseOrders) return [];
        if (!orders || orders.length === 0) return remoteAllPurchaseOrders;
        return remoteAllPurchaseOrders.map(order => {
            const local = orders.find(o => o.id === order.id);
            return local ? { ...order, ...local } : order;
        });
    }, [remoteAllPurchaseOrders, orders]);

    const purchaseStatusCounts = React.useMemo(() => {
        const counts: Record<string, number> = { all: 0 };
        if (!allPurchaseOrders) return counts;

        counts.all = allPurchaseOrders.length;
        allPurchaseOrders.forEach(order => {
            const status = order.status;
            const pStatus = order.purchaseStatus || (status === 'approved' ? 'recebido' : null);

            if (status === 'pending' || status === 'awaiting_approval') {
                counts['pending_approval'] = (counts['pending_approval'] || 0) + 1;
            } else if (status === 'rejected') {
                counts['rejected'] = (counts['rejected'] || 0) + 1;
            } else if (pStatus) {
                counts[pStatus] = (counts[pStatus] || 0) + 1;
            }
        });
        return counts;
    }, [allPurchaseOrders]);

    const purchaseOrdersData = React.useMemo(() => {
        const remote = infinitePurchaseOrders?.pages.flat() || [];
        if (!orders || orders.length === 0) return remote;
        return remote.map(order => {
            const local = orders.find(o => o.id === order.id);
            return local ? { ...order, ...local } : order;
        });
    }, [infinitePurchaseOrders, orders]);

    // LICITACAO
    const {
        data: infiniteLicitacao,
        fetchNextPage: fetchNextLicitacao,
        hasNextPage: hasNextLicitacao,
        isFetchingNextPage: isFetchingNextLicitacao,
        isLoading: isLoadingLicitacao,
        isError: isLicitacaoError
    } = useInfiniteLicitacao(20, searchTerm);

    const licitacaoData = React.useMemo(() => {
        const remote = infiniteLicitacao?.pages.flat() || [];
        if (!orders || orders.length === 0) return remote;
        return remote.map(order => {
            const local = orders.find(o => o.id === order.id);
            return local ? { ...order, ...local } : order;
        });
    }, [infiniteLicitacao, orders]);

    // DIARIAS
    const {
        data: infiniteServiceRequests,
        fetchNextPage: fetchNextServiceRequests,
        hasNextPage: hasNextServiceRequests,
        isFetchingNextPage: isFetchingNextServiceRequests,
        isLoading: isLoadingServiceRequests,
        isError: isServiceRequestsError
    } = useInfiniteServiceRequests(20, searchTerm);

    const serviceRequestsData = React.useMemo(() => {
        const remote = infiniteServiceRequests?.pages.flatMap(page => page) || [];
        if (!orders || orders.length === 0) return remote;
        return remote.map(order => {
            const local = orders.find(o => o.id === order.id);
            return local ? { ...order, ...local } : order;
        });
    }, [infiniteServiceRequests, orders]);

    const isInfiniteLoading = isOficiosLoading || isLoadingPurchaseOrders || isLoadingLicitacao || isLoadingServiceRequests;

    const [downloadingId, setDownloadingId] = useState<string | null>(null);
    const [previewOrder, setPreviewOrder] = useState<Order | null>(null);

    // Dynamic hooks for full preview
    const { data: fullPurchaseOrder } = usePurchaseOrder(
        (activeBlock === 'compras' && previewOrder) ? previewOrder.id : null
    );
    const { data: fullServiceRequest } = useServiceRequest(
        (activeBlock === 'diarias' && previewOrder) ? previewOrder.id : null
    );
    const { data: fullOficio } = useOficio(
        (activeBlock === 'oficio' && previewOrder) ? previewOrder.id : null
    );

    const effectivePreviewOrder = (() => {
        if (activeBlock === 'compras' && fullPurchaseOrder) return fullPurchaseOrder;
        if (activeBlock === 'diarias' && fullServiceRequest) return fullServiceRequest;
        if (activeBlock === 'oficio' && fullOficio) return fullOficio;
        return previewOrder;
    })();

    const [historyOrder, setHistoryOrder] = useState<Order | null>(null);
    const [attachmentManagerOrder, setAttachmentManagerOrder] = useState<Order | null>(null);
    const [priorityJustificationOrder, setPriorityJustificationOrder] = useState<Order | null>(null);
    const [adminApprovalOrder, setAdminApprovalOrder] = useState<Order | null>(null);
    const [adminRejectionOrder, setAdminRejectionOrder] = useState<Order | null>(null);
    const [rejectionReason, setRejectionReason] = useState('');
    const [statusSelectionOrder, setStatusSelectionOrder] = useState<Order | null>(null);
    const [accountSelectionOrder, setAccountSelectionOrder] = useState<Order | null>(null);
    const [forecastDate, setForecastDate] = useState('');
    const [pendingStatus, setPendingStatus] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean, title: string, message: string, onConfirm: () => void, type: 'danger' | 'warning' }>({
        isOpen: false, title: '', message: '', onConfirm: () => { }, type: 'warning'
    });
    const updateOficioDescription = useUpdateOficioDescription();

    const extractOficioNumber = (text: string | undefined) => {
        if (!text) return '---';
        const match = text.match(/(?:(?:n[º°o]|\W|^)\s*)(\d+\s*\/\s*\d{4})/i);
        return match ? match[1].replace(/\s/g, '') : '---';
    };

    const genericAttachmentRef = useRef<HTMLInputElement>(null);

    const isAdmin = currentUser.role === 'admin';
    const isComprasUser = currentUser.role === 'compras';

    const getStatusBadge = (status: Order['status']) => {
        switch (status) {
            case 'approved':
                return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100 text-[9px] font-black uppercase tracking-wider"><CheckCircle2 className="w-3 h-3" /> Aprovado</span>;
            case 'payment_account':
                return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-100 text-[9px] font-black uppercase tracking-wider"><RotateCcw className="w-3 h-3 animate-spin-slow" /> Conta de Pagamento</span>;
            case 'rejected':
                return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-100 text-[9px] font-black uppercase tracking-wider"><XCircle className="w-3 h-3" /> Rejeitado</span>;
            case 'pending':
            case 'awaiting_approval':
                return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-100 text-[9px] font-black uppercase tracking-wider"><Clock className="w-3 h-3 animate-pulse" /> Em Aprovação</span>;
            default:
                return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-50 text-slate-700 border border-slate-100 text-[9px] font-black uppercase tracking-wider"><AlertCircle className="w-3 h-3" /> Recebido</span>;
        }
    };
    const isDiarias = activeBlock === 'diarias';
    const isCompras = activeBlock === 'compras';
    const isLicitacao = activeBlock === 'licitacao';

    const getSourceOrders = () => {
        if (activeBlock === 'oficio') return oficiosData;
        if (activeBlock === 'compras') return purchaseOrdersData;
        if (activeBlock === 'diarias') return serviceRequestsData;
        if (activeBlock === 'licitacao') return licitacaoData;
        return orders;
    };

    const filteredOrders = getSourceOrders().filter(order => {
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
        } else if (activeBlock === 'oficio') {
            hasPermission = true; // Oficios are visible to all users
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

        const matchesSearch = true; // Handled Server-Side

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

        onDownloadPdf(snapshotToDownload!, order.blockType, order);
        setTimeout(() => setDownloadingId(null), 2000);
    };

    const getDepartureDate = (order: Order) => {
        const content = order.documentSnapshot?.content;
        return formatLocalDate(content?.departureDateTime);
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

    const handleLoadMore = () => {
        if (activeBlock === 'oficio' && hasNextOficios) {
            fetchNextOficios();
        } else if (activeBlock === 'diarias' && hasNextServiceRequests) {
            fetchNextServiceRequests();
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

    const PurchaseStatusSelector = ({ order }: { order: Order }) => {
        const currentStatus = order.purchaseStatus || 'recebido';
        const config = purchaseStatusMap[currentStatus as keyof typeof purchaseStatusMap] || purchaseStatusMap.recebido;
        const isApproved = order.status === 'approved';
        const isEmAprovacao = !order.status || order.status === 'pending' || order.status === 'awaiting_approval';

        const isLockedForUser = currentStatus === 'aprovacao_orcamento' && !isAdmin;
        const isPaymentAccount = order.status === 'payment_account';
        const canClick = (isAdmin && isEmAprovacao) || (isComprasUser && !isLockedForUser && isApproved) || isPaymentAccount;

        const handleClick = (e: React.MouseEvent) => {
            if (!canClick) return;
            e.stopPropagation();

            if (order.status === 'payment_account') {
                setAccountSelectionOrder(order);
            } else if (isAdmin) {
                setAdminApprovalOrder(order);
            } else if (isComprasUser && isApproved) {
                setStatusSelectionOrder(order);
            }
        };

        if (isApproved || isPaymentAccount) {
            const displayConfig = isPaymentAccount ? {
                label: 'Conta de Pagamento',
                icon: RotateCcw,
                color: 'text-blue-600 bg-blue-50 border-blue-100'
            } : config;

            return (
                <button
                    onClick={handleClick}
                    disabled={isLockedForUser}
                    className={`flex items-center justify-between gap-2 px-3 py-1.5 rounded-full border transition-all duration-300 group
                        ${canClick ? 'cursor-pointer hover:shadow-md active:scale-95' : 'cursor-default'}
                        ${isLockedForUser ? 'bg-purple-50 text-purple-700 border-purple-200 opacity-80' : `${displayConfig.color}`}
                    `}
                >
                    <div className="flex items-center gap-1.5 min-w-0">
                        <displayConfig.icon className={`w-3.5 h-3.5 shrink-0 ${isLockedForUser ? 'animate-pulse' : ''} ${isPaymentAccount ? 'animate-spin-slow' : ''}`} />
                        <span className="text-[9px] font-black uppercase tracking-wider whitespace-nowrap overflow-hidden text-ellipsis">{displayConfig.label}</span>
                    </div>
                    {isLockedForUser ? (
                        <Lock className="w-2.5 h-2.5 text-purple-400 shrink-0" />
                    ) : canClick ? (
                        <ChevronRight className="w-3 h-3 opacity-40 group-hover:translate-x-0.5 transition-transform shrink-0" />
                    ) : null}
                </button>
            );
        }

        return (
            <button
                onClick={handleClick}
                className={`transition-all ${((isAdmin || order.status === 'payment_account') && order.status !== 'rejected') ? 'cursor-pointer hover:scale-105 active:scale-95' : 'cursor-default'}`}
            >
                {getStatusBadge(order.status)}
            </button>
        );
    };

    const handleSelectAccount = async (account: PurchaseAccount, advanceStatus: boolean = false) => {
        if (!accountSelectionOrder) return;
        try {
            await updateOrderAccount(accountSelectionOrder.id, account.description, currentUser.name, advanceStatus, isAdmin);
            setAccountSelectionOrder(null);
            // The order will be updated in the parent state if it's subscribed to realtime or if we trigger a refresh.
            // Since onUpdateOrderStatus is available, maybe we should use it?
            // Actually, updateOrderAccount already does the database work.
            // If we want the UI to update immediately, we might need a refresh callback.
            // But usually the parent App handles the state.
            // For now, let's assume the user will see it after a refresh or if we call onUpdateOrderStatus with specialized trigger.
            if (onUpdateOrderStatus) {
                // Trigger a generic status update to force re-fetch if necessary, 
                // but updateOrderAccount already moved it to 'approved'.
                // To be safe, let's just alert success and close.
                alert(advanceStatus ? 'Conta vinculada e pedido liberado para o setor de compras!' : 'Conta vinculada atualizada com sucesso!');
                window.location.reload(); // Quick way to sync for now, or we could pass a refresh function
            }
        } catch (error: any) {
            console.error("Error selecting account:", error);
            alert(error.message || "Erro ao vincular conta.");
        }
    };

    const priorityStyles = {
        'Normal': { icon: Info, color: 'text-slate-500 bg-slate-50 border-slate-200' },
        'Média': { icon: Zap, color: 'text-indigo-600 bg-indigo-50 border-indigo-100' },
        'Alta': { icon: AlertTriangle, color: 'text-amber-600 bg-amber-50 border-amber-200' },
        'Urgência': { icon: ShieldAlert, color: 'text-rose-600 bg-rose-50 border-rose-200' },
    };

    return (
        <>
            <div className="min-h-screen w-full bg-slate-100/50 backdrop-blur-sm font-sans flex items-center justify-center p-4 desktop:p-8 overflow-hidden animate-fade-in">
                <div className="w-full max-w-6xl bg-white rounded-[2.5rem] shadow-[0_25px_70px_-15px_rgba(0,0,0,0.15)] border border-slate-200 overflow-hidden animate-slide-up flex flex-col h-full max-h-[90vh]">

                    <div className={`${(isDiarias || isCompras || (activeBlock as any) === 'oficio') ? 'p-4' : 'p-8'} border-b border-slate-100 shrink-0 bg-white transition-all`}>
                        <div className={`flex flex-col desktop:flex-row desktop:items-center justify-between ${(isDiarias || isCompras || (activeBlock as any) === 'oficio') ? 'gap-4' : 'gap-6'}`}>
                            <div className={`${(isDiarias || isCompras || (activeBlock as any) === 'oficio') ? 'flex items-center gap-4 flex-1 min-w-0' : ''}`}>
                                <div className={(isDiarias || isCompras || (activeBlock as any) === 'oficio') ? "contents" : "block"}>
                                    <button
                                        onClick={() => {
                                            if ((activeBlock as any) === 'oficio' && onBack) {
                                                onBack();
                                            } else {
                                                onBack();
                                            }
                                        }}
                                        className={`flex items-center gap-2 text-slate-400 hover:text-indigo-600 transition-colors font-bold uppercase tracking-widest group ${(isDiarias || isCompras || (activeBlock as any) === 'oficio') ? 'text-[10px] p-2 hover:bg-slate-50 rounded-lg -ml-2' : 'text-xs mb-4'}`}
                                        title="Voltar"
                                    >
                                        <ArrowLeft className={`transition-transform ${(isDiarias || isCompras || (activeBlock as any) === 'oficio') ? 'w-3 h-3' : 'w-4 h-4 group-hover:-translate-x-1'}`} />
                                        {!((isDiarias || isCompras || (activeBlock as any) === 'oficio')) && ((activeBlock as any) === 'oficio' ? 'Voltar para Oficios' : 'Voltar ao Menu')}
                                    </button>

                                    <h2 className={`${(isDiarias || isCompras || (activeBlock as any) === 'oficio') ? 'text-xl' : 'text-3xl'} font-extrabold text-slate-900 tracking-tight flex items-center gap-3 shrink-0`}>
                                        <div className={`${(isDiarias || isCompras || (activeBlock as any) === 'oficio') ? 'w-8 h-8 rounded-lg' : 'w-10 h-10 rounded-xl'} bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/30`}>
                                            <FileText className={`${(isDiarias || isCompras || (activeBlock as any) === 'oficio') ? 'w-4 h-4' : 'w-6 h-6'} text-white`} />
                                        </div>
                                        <span className="truncate">
                                            {(activeBlock as any) === 'oficio' ? 'Histórico de Ofícios' : ((activeBlock as any) === 'licitacao' && !showAllProcesses) ? 'Meus Processos' : ((activeBlock as any) === 'licitacao' && showAllProcesses) ? 'Processos' : `Histórico: ${activeBlock?.toUpperCase()}`}
                                        </span>
                                    </h2>
                                </div>

                                {!(isDiarias || isCompras || (activeBlock as any) === 'oficio') && (
                                    <p className="text-slate-500 text-sm mt-1 font-medium">
                                        {isAdmin ? 'Gerenciamento global de registros.' : isCompras ? 'Pedidos de compra autorizados para seu setor.' : 'Seus documentos gerados neste módulo.'}
                                    </p>
                                )}
                            </div>

                            <div className={`${(isDiarias || isCompras || activeBlock === 'oficio') ? 'flex-1 max-w-lg flex items-center gap-2' : 'mt-8 flex items-center gap-3 w-full'}`}>
                                <div className="relative flex-1 group">
                                    <input
                                        type="text"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        placeholder={(isDiarias || isCompras || activeBlock === 'oficio') ? "Buscar..." : "Buscar por Setor, Solicitante, Protocolo..."}
                                        className={`w-full bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 font-medium focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all ${(isDiarias || isCompras || activeBlock === 'oficio') ? 'pl-9 pr-3 py-2 text-xs' : 'pl-11 pr-4 py-3.5 text-sm'}`}
                                    />
                                    <Search className={`absolute top-1/2 -translate-y-1/2 text-slate-400 ${(isDiarias || isCompras || activeBlock === 'oficio') ? 'left-3 w-3.5 h-3.5' : 'left-4 w-5 h-5'}`} />
                                </div>
                                {isCompras && (
                                    <div className="relative" ref={statusDropdownRef}>
                                        <button
                                            onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
                                            className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-slate-600 hover:text-indigo-600 hover:border-indigo-200 transition-all font-bold text-[10px] uppercase tracking-widest whitespace-nowrap active:scale-95 shadow-sm"
                                        >
                                            <Filter className="w-3.5 h-3.5 text-indigo-500" />
                                            {purchaseStatusFilter === 'all' ? 'Status' :
                                                [
                                                    { id: 'all', label: 'Todos' },
                                                    { id: 'pending_approval', label: 'Em Aprovação' },
                                                    { id: 'recebido', label: 'Recebido' },
                                                    { id: 'coletando_orcamento', label: 'Orçamento' },
                                                    { id: 'aprovacao_orcamento', label: 'Aprovação' },
                                                    { id: 'coletando_dotacao', label: 'Dotação' },
                                                    { id: 'realizado', label: 'Realizado' },
                                                    { id: 'concluido', label: 'Concluído' },
                                                    { id: 'rejected', label: 'Rejeitado' },
                                                    { id: 'cancelado', label: 'Cancelado' },
                                                ].find(s => s.id === purchaseStatusFilter)?.label}
                                            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 ${isStatusDropdownOpen ? 'rotate-180' : ''}`} />
                                        </button>

                                        <AnimatePresence>
                                            {isStatusDropdownOpen && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                                    className="absolute right-0 mt-3 w-72 bg-white rounded-3xl shadow-[0_30px_90px_-20px_rgba(0,0,0,0.2)] border border-slate-100 py-3 z-[100] flex flex-col overflow-hidden"
                                                >
                                                    <div className="px-6 py-3 mb-1 border-b border-slate-50 flex items-center justify-between">
                                                        <span className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Filtrar por Status</span>
                                                        <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse"></div>
                                                    </div>
                                                    <div className="max-h-[60vh] overflow-y-auto custom-scrollbar px-2 space-y-0.5">
                                                        {[
                                                            { id: 'all', label: 'Todos os Pedidos' },
                                                            { id: 'pending_approval', label: 'Em Aprovação' },
                                                            { id: 'recebido', label: 'Pedido Recebido' },
                                                            { id: 'coletando_orcamento', label: 'Orçamento' },
                                                            { id: 'aprovacao_orcamento', label: 'Aprovação Orçamentária' },
                                                            { id: 'coletando_dotacao', label: 'Dotação' },
                                                            { id: 'realizado', label: 'Pedido Realizado' },
                                                            { id: 'concluido', label: 'Concluído' },
                                                            { id: 'rejected', label: 'Rejeitado' },
                                                            { id: 'cancelado', label: 'Cancelado' },
                                                        ].map(option => {
                                                            const count = purchaseStatusCounts[option.id] || 0;
                                                            const isActive = purchaseStatusFilter === option.id;
                                                            return (
                                                                <button
                                                                    key={option.id}
                                                                    onClick={() => {
                                                                        setPurchaseStatusFilter(option.id);
                                                                        setIsStatusDropdownOpen(false);
                                                                    }}
                                                                    className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl transition-all duration-300 group ${isActive ? 'bg-indigo-600 shadow-lg shadow-indigo-600/20' : 'hover:bg-slate-50'}`}
                                                                >
                                                                    <span className={`text-[11px] font-black uppercase tracking-widest whitespace-nowrap transition-colors ${isActive ? 'text-white' : 'text-slate-600 group-hover:text-indigo-600'}`}>
                                                                        {option.label}
                                                                    </span>
                                                                    <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black font-mono border-2 transition-all ${isActive ? 'bg-white/20 border-white/20 text-white' : 'bg-slate-50 border-slate-100 text-slate-400 group-hover:border-indigo-100 group-hover:text-indigo-500'}`}>
                                                                        {count.toString().padStart(2, '0')}
                                                                    </span>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                )}
                                {isAdmin && filteredOrders.length > 0 && !isCompras && (
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
                                        className={`${(isDiarias || isCompras || activeBlock === 'oficio') ? 'p-2' : 'p-3.5'} bg-red-50 text-red-500 border border-red-100 rounded-2xl hover:bg-red-500 hover:text-white transition-all shadow-sm flex items-center gap-2 font-bold text-xs uppercase`}
                                        title="Limpar Histórico"
                                    >
                                        <Trash2 className={(isDiarias || isCompras || activeBlock === 'oficio') ? 'w-3.5 h-3.5' : 'w-5 h-5'} />
                                        {!(isDiarias || isCompras || activeBlock === 'oficio') && <span className="hidden desktop:inline">Limpar Bloco</span>}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto custom-scrollbar">
                        {isInfiniteLoading ? (
                            <div className="h-full flex flex-col items-center justify-center space-y-4">
                                <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
                                <p className="text-slate-400 font-medium text-sm animate-pulse">Carregando histórico...</p>
                            </div>
                        ) : filteredOrders.length > 0 ? (
                            <div className={`min-w-full ${isLicitacao ? 'px-8 py-4 space-y-4' : ''}`}>
                                {!isLicitacao && (
                                    <div className="border-b border-slate-100 bg-slate-50 hidden desktop:grid desktop:grid-cols-12 gap-4 px-8 py-4 sticky top-0 z-10">
                                        {isCompras && (
                                            <div className="desktop:col-span-1 text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-center gap-2 whitespace-nowrap">
                                                <Calendar className="w-3 h-3" /> Pedido
                                            </div>
                                        )}
                                        {isCompras && (
                                            <div className="md:col-span-1 text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-center gap-2 whitespace-nowrap">
                                                Prioridade
                                            </div>
                                        )}
                                        {activeBlock !== 'oficio' && (
                                            <div className={`${isCompras ? 'md:col-span-1' : 'md:col-span-2'} text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center ${isCompras ? 'justify-center' : 'gap-2'} whitespace-nowrap`}>
                                                <HashIcon className="w-3 h-3" /> {isCompras ? 'ID' : 'Protocolo'}
                                            </div>
                                        )}
                                        {activeBlock === 'oficio' && (
                                            <>
                                                <div className="md:col-span-2 text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 whitespace-nowrap">
                                                    <FileText className="w-3 h-3" /> Número do Ofício
                                                </div>
                                                <div className="md:col-span-3 text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 whitespace-nowrap">
                                                    <Edit2 className="w-3 h-3" /> Descrição
                                                </div>
                                            </>
                                        )}
                                        <div className={`${isDiarias ? 'md:col-span-4' : isCompras ? 'md:col-span-3 text-center' : activeBlock === 'oficio' ? 'md:col-span-3' : 'md:col-span-6'} text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center ${isCompras ? 'justify-center' : 'gap-2'} whitespace-nowrap`}>
                                            {isDiarias ? <><FileText className="w-3 h-3" /> Solicitante + Destino</> : isCompras ? <><Network className="w-3 h-3" /> Setor / Solicitante</> : <><FileText className="w-3 h-3" /> Solicitante</>}
                                        </div>
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
                                            const orderDate = new Date(order.createdAt).toLocaleString('pt-BR');

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

                                                    <div className="grid grid-cols-1 desktop:grid-cols-7 gap-4 items-center">
                                                        <div className="flex flex-col gap-1">
                                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                                                <HashIcon className="w-3 h-3 text-slate-300" /> ID
                                                            </span>
                                                            <span className="font-mono text-xs font-bold text-slate-700 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100 w-fit group-hover:bg-blue-50/50 group-hover:border-blue-100 group-hover:text-blue-700 transition-colors">
                                                                {content?.protocolId || '---'}
                                                            </span>
                                                        </div>

                                                        <div className="flex flex-col gap-1 desktop:col-span-2">
                                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Objeto</span>
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
                                                                        onClick={() => onUpdateOrderStatus?.(order, 'awaiting_approval')}
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
                                                                <button onClick={() => onEditOrder(order)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all active:scale-95" title={order.status === 'approved' || order.status === 'completed' || order.status === 'rejected' ? "Visualizar" : "Editar"}>
                                                                    {order.status === 'approved' || order.status === 'completed' || order.status === 'rejected' ? <Eye className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
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

                                                    <div className="grid grid-cols-2 desktop:grid-cols-5 gap-4">
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
                                                            <span className="text-xs font-medium text-slate-600 truncate" title={content?.requesterSector || order.requestingSector}>
                                                                {content?.requesterSector || order.requestingSector || '---'}
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
                                            <div key={order.id} className="grid grid-cols-1 desktop:grid-cols-12 gap-4 px-8 py-5 hover:bg-slate-50/80 transition-colors items-center">
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

                                                {activeBlock !== 'oficio' && (
                                                    <div className={`${isCompras ? 'md:col-span-1' : 'md:col-span-2'} flex justify-center`}>
                                                        <span className="font-mono text-[10px] font-bold text-indigo-600 bg-indigo-50/50 px-2 py-1 rounded border border-indigo-100/50">
                                                            {order.protocol}
                                                        </span>
                                                    </div>
                                                )}

                                                {activeBlock === 'oficio' && (
                                                    <>
                                                        <div className="md:col-span-2 text-xs font-bold text-slate-700">
                                                            {order.protocol ? (order.protocol.startsWith('OFC-') ? order.protocol.replace('OFC-', 'Nº ') : order.protocol) : '---'}
                                                        </div>
                                                        <div className="md:col-span-3">
                                                            <input
                                                                type="text"
                                                                defaultValue={order.description || ''}
                                                                onBlur={(e) => {
                                                                    if ((order.description || '') !== e.target.value) {
                                                                        updateOficioDescription.mutate({ id: order.id, description: e.target.value });
                                                                    }
                                                                }}
                                                                placeholder="Adicionar descrição..."
                                                                className="w-full bg-transparent border-none text-xs text-slate-600 focus:ring-0 focus:bg-slate-50 rounded px-2 py-1 placeholder:text-slate-300 transition-colors"
                                                            />
                                                        </div>
                                                    </>
                                                )}

                                                <div className={`${isDiarias ? 'md:col-span-4' : isCompras ? 'md:col-span-3 text-center' : activeBlock === 'oficio' ? 'md:col-span-3' : 'md:col-span-6'}`}>
                                                    <h3 className="text-sm font-bold text-slate-800 leading-tight">
                                                        {isDiarias ? (
                                                            <div className="flex flex-col">
                                                                <span>{content?.requesterName || '---'}</span>
                                                                <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wide flex items-center gap-1">
                                                                    <MapPin className="w-3 h-3" /> {content?.destination || 'Destino n/a'}
                                                                </span>
                                                            </div>
                                                        ) : isCompras ? (content?.requesterSector || order.requestingSector || 'Sem Setor') : (activeBlock === 'oficio' ? (
                                                            <span title={`De: ${order.userName}\nSetor: ${content?.requesterSector || content?.signatureSector || 'Não informado'}`} className="cursor-help decoration-dotted underline decoration-slate-300 underline-offset-2">
                                                                {order.userName.split(' ').slice(0, 2).join(' ')}
                                                            </span>
                                                        ) : order.userName)}
                                                    </h3>
                                                    {isCompras ? (
                                                        <p className="text-[10px] text-slate-400 font-medium">
                                                            {order.userName}
                                                        </p>
                                                    ) : null}
                                                </div>

                                                {isDiarias && (
                                                    <div className="desktop:col-span-2 text-slate-600 text-xs font-bold flex flex-col">
                                                        <span>{getDepartureDate(order)}</span>
                                                        {content?.returnDateTime && (
                                                            <span className="text-[9px] text-slate-400 font-medium">Volta: {new Date(content.returnDateTime).toLocaleDateString('pt-BR')}</span>
                                                        )}
                                                    </div>
                                                )}

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
                                                            <PurchaseStatusSelector order={order} />
                                                        </div>
                                                    </>
                                                )}

                                                {isDiarias ? (
                                                    <div className="md:col-span-2">
                                                        {(() => {
                                                            const getPaymentStatusDisplay = (status: Order['paymentStatus']) => {
                                                                switch (status) {
                                                                    case 'paid':
                                                                        return { label: 'Pago', icon: <CheckCircle2 className="w-4 h-4" />, style: 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-emerald-500/10' };
                                                                    case 'contabilidade':
                                                                        return { label: 'Contabilidade', icon: <FileSearch className="w-4 h-4" />, style: 'bg-blue-50 border-blue-200 text-blue-700 shadow-blue-500/10' };
                                                                    case 'pending':
                                                                    default:
                                                                        return { label: 'Pendente', icon: <Clock className="w-4 h-4 animate-pulse" />, style: 'bg-amber-50 border-amber-200 text-amber-700 shadow-amber-500/10' };
                                                                }
                                                            };

                                                            const getNextPaymentStatus = (status: Order['paymentStatus']) => {
                                                                if (status === 'pending' || !status) return 'contabilidade';
                                                                if (status === 'contabilidade') return 'paid';
                                                                return 'pending';
                                                            };

                                                            const currentPaymentStatus = order.paymentStatus || 'pending';
                                                            const paymentDisplay = getPaymentStatusDisplay(currentPaymentStatus);
                                                            const canAdvanceToPaid = currentUser.permissions?.includes('parent_diarias') || isAdmin;

                                                            if (isAdmin) {
                                                                return (
                                                                    <div className="flex flex-col gap-1">
                                                                        <button
                                                                            onClick={() => onUpdatePaymentStatus?.(order, getNextPaymentStatus(currentPaymentStatus))}
                                                                            className={`relative group flex items-center justify-between w-full max-w-[140px] px-3 py-2 rounded-xl border transition-all duration-300 active:scale-95 ${paymentDisplay.style}`}
                                                                        >
                                                                            <div className="flex items-center gap-2">
                                                                                {paymentDisplay.icon}
                                                                                <span className="text-[10px] font-black uppercase tracking-widest truncate">
                                                                                    {paymentDisplay.label}
                                                                                </span>
                                                                            </div>
                                                                            <div className="hidden group-hover:block transition-all ml-1 shrink-0">
                                                                                <Edit3 className="w-3 h-3 opacity-40" />
                                                                            </div>
                                                                        </button>
                                                                        {currentPaymentStatus === 'paid' && order.paymentDate && (
                                                                            <div className="flex flex-col ml-2 mt-0.5">
                                                                                <span className="text-[9px] font-bold text-emerald-600 flex items-center gap-1">
                                                                                    <Check className="w-2.5 h-2.5" />
                                                                                    {new Date(order.paymentDate).toLocaleDateString('pt-BR')} {new Date(order.paymentDate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                                                </span>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            } else {
                                                                return (
                                                                    <div className="flex flex-col gap-1">
                                                                        {canAdvanceToPaid && currentPaymentStatus !== 'paid' ? (
                                                                            <button
                                                                                onClick={() => onUpdatePaymentStatus?.(order, 'paid')}
                                                                                className={`relative group flex items-center justify-between w-full max-w-[140px] px-3 py-2 rounded-xl border transition-all duration-300 active:scale-95 ${paymentDisplay.style}`}
                                                                            >
                                                                                <div className="flex items-center gap-2">
                                                                                    {paymentDisplay.icon}
                                                                                    <span className="text-[10px] font-black uppercase tracking-widest truncate">
                                                                                        Avançar p/ Pago
                                                                                    </span>
                                                                                </div>
                                                                                <div className="hidden group-hover:block transition-all ml-1 shrink-0">
                                                                                    <CheckCircle2 className="w-3 h-3 opacity-40" />
                                                                                </div>
                                                                            </button>
                                                                        ) : (
                                                                            <div className={`inline-flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl border w-full max-w-[140px] ${paymentDisplay.style}`}>
                                                                                {paymentDisplay.icon}
                                                                                <span className="truncate">{paymentDisplay.label}</span>
                                                                            </div>
                                                                        )}

                                                                        {currentPaymentStatus === 'paid' && order.paymentDate && (
                                                                            <div className="flex flex-col ml-2 mt-0.5">
                                                                                <span className="text-[9px] font-bold text-emerald-600 flex items-center gap-1">
                                                                                    <Check className="w-2.5 h-2.5" />
                                                                                    {new Date(order.paymentDate).toLocaleDateString('pt-BR')} {new Date(order.paymentDate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                                                </span>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            }
                                                        })()}
                                                    </div>
                                                ) : null}

                                                {!isCompras && !isDiarias && !isLicitacao && (
                                                    <div className="desktop:col-span-2 text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 whitespace-nowrap">
                                                        <Calendar className="w-3 h-3" />
                                                        {new Date(order.createdAt).toLocaleDateString('pt-BR')}
                                                    </div>
                                                )}

                                                <div className={`${isCompras ? 'desktop:col-span-3' : 'desktop:col-span-2'} flex items-center justify-center gap-1`}>
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



                                                    {isCompras && (
                                                        <button
                                                            onClick={() => setHistoryOrder(order)}
                                                            className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all"
                                                            title="Histórico de Movimentação"
                                                        >
                                                            <History className="w-5 h-5" />
                                                        </button>
                                                    )}

                                                    {activeBlock === 'oficio' && (
                                                        <button
                                                            onClick={() => setPreviewOrder(order)}
                                                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                                                            title="Visualizar"
                                                        >
                                                            <Eye className="w-5 h-5" />
                                                        </button>
                                                    )}

                                                    {activeBlock !== 'oficio' && (activeBlock !== 'diarias') && (
                                                        <button
                                                            onClick={() => onViewOrder?.(order)}
                                                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                                                            title="Visualizar Pedido Completo"
                                                        >
                                                            <Eye className="w-5 h-5" />
                                                        </button>
                                                    )}

                                                    {activeBlock === 'diarias' && (
                                                        <button
                                                            onClick={() => setPreviewOrder(order)}
                                                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                                                            title="Visualizar Diária"
                                                        >
                                                            <Eye className="w-5 h-5" />
                                                        </button>
                                                    )}

                                                    {((activeBlock !== 'oficio' && (!isCompras || order.status === 'pending')) || activeBlock === 'oficio') && (
                                                        <button onClick={() => onEditOrder(order)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all" title={(order.status === 'pending' || activeBlock === 'oficio') ? "Editar" : "Visualizar"}>
                                                            {(order.status === 'pending' || activeBlock === 'oficio') ? <Edit3 className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                                        </button>
                                                    )}

                                                    {activeBlock !== 'oficio' && activeBlock !== 'diarias' && (
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

                                    {/* CONSOLIDATED LOAD MORE BUTTON */}
                                    {(hasNextOficios && activeBlock === 'oficio' ||
                                        hasNextPurchaseOrders && activeBlock === 'compras' ||
                                        hasNextLicitacao && activeBlock === 'licitacao' ||
                                        hasNextServiceRequests && activeBlock === 'diarias') && (
                                            <div className="py-8 flex justify-center border-t border-slate-100 bg-slate-50/30">
                                                <button
                                                    onClick={() => {
                                                        if (activeBlock === 'oficio') fetchNextOficios();
                                                        else if (activeBlock === 'compras') fetchNextPurchaseOrders();
                                                        else if (activeBlock === 'licitacao') fetchNextLicitacao();
                                                        else if (activeBlock === 'diarias') fetchNextServiceRequests();
                                                    }}
                                                    disabled={isFetchingStrictOficios || isFetchingNextPurchaseOrders || isFetchingNextLicitacao || isFetchingNextServiceRequests}
                                                    className="px-8 py-3 bg-white border border-slate-200 rounded-2xl text-slate-600 font-black text-[10px] uppercase tracking-[0.2em] hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all shadow-sm flex items-center gap-3 group disabled:opacity-50 active:scale-95"
                                                >
                                                    {(isFetchingStrictOficios || isFetchingNextPurchaseOrders || isFetchingNextLicitacao || isFetchingNextServiceRequests) ? (
                                                        <>
                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                            Carregando...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform" />
                                                            Carregar Mais Registros
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        )}
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



                {/* MODAL OFICIO/DOCUMENT PREVIEW - TRANSPARENT BLURRED OVERLAY */}
                {previewOrder && (
                    <div className="fixed inset-0 z-[1000] flex flex-col bg-black/10 backdrop-blur-xl animate-fade-in">

                        {/* Minimalist Floating Controls */}
                        <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-start z-[1010] pointer-events-none">
                            <button
                                onClick={() => setPreviewOrder(null)}
                                className="pointer-events-auto group flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900 text-white shadow-xl hover:bg-slate-800 border border-slate-700 transition-all active:scale-95"
                            >
                                <div className="p-1 bg-white/10 rounded-full group-hover:bg-white/20 transition-colors">
                                    <X className="w-4 h-4" />
                                </div>
                                <span className="text-sm font-medium">Fechar</span>
                            </button>

                            {(effectivePreviewOrder?.documentSnapshot) && (
                                <button
                                    onClick={() => onDownloadPdf(effectivePreviewOrder.documentSnapshot!, activeBlock || undefined, effectivePreviewOrder || undefined)}
                                    className="pointer-events-auto group flex items-center gap-2 px-5 py-2.5 rounded-full bg-emerald-600 text-white hover:bg-emerald-500 shadow-xl shadow-emerald-600/20 transition-all active:scale-95 active:shadow-none font-bold text-sm tracking-wide uppercase border border-emerald-500"
                                >
                                    <Download className="w-4 h-4 text-white" />
                                    <span>Baixar</span>
                                </button>
                            )}
                        </div>

                        {/* Content Area */}
                        <div
                            className="flex-1 overflow-y-auto overflow-x-hidden flex items-start justify-center p-8 sm:py-20"
                            onClick={(e) => {
                                // Close if clicking on the backdrop (empty space)
                                if (e.target === e.currentTarget) setPreviewOrder(null);
                            }}
                        >
                            <div className="relative shadow-[0_20px_50px_rgba(0,0,0,0.3)] animate-scale-up origin-top">
                                {/* Show Loading if fetching full details for Lightweight modules */}
                                {(((activeBlock === 'compras' && previewOrder && (!effectivePreviewOrder?.documentSnapshot?.content?.purchaseItems || effectivePreviewOrder.documentSnapshot.content.purchaseItems.length === 0)) ||
                                    (activeBlock === 'diarias' && previewOrder && !effectivePreviewOrder?.documentSnapshot?.content?.requestedValue) ||
                                    (activeBlock === 'oficio' && previewOrder && !effectivePreviewOrder?.documentSnapshot?.content?.body)) ||
                                    (activeBlock === 'oficio' && previewOrder && !fullOficio)) ? (
                                    <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
                                        <div className="relative">
                                            <div className="w-16 h-16 rounded-full border-4 border-slate-900/20 border-t-slate-900 animate-spin"></div>
                                        </div>
                                        <p className="text-sm font-bold text-slate-900 tracking-widest uppercase animate-pulse">Carregando...</p>
                                    </div>
                                ) : effectivePreviewOrder?.documentSnapshot ? (
                                    <DocumentPreview
                                        state={effectivePreviewOrder.documentSnapshot}
                                        scale={1}
                                    />
                                ) : (
                                    <div className="flex flex-col items-center justify-center text-slate-400 h-[60vh] gap-4">
                                        <div className="w-24 h-24 rounded-3xl bg-slate-100 flex items-center justify-center">
                                            <PackageX className="w-10 h-10" />
                                        </div>
                                        <p className="text-lg font-bold text-slate-500">Visualização indisponível</p>
                                    </div>
                                )}
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

                {/* Modal de Auditoria de Histórico */}
                {historyOrder && createPortal(
                    <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 desktop:p-6 bg-slate-900/60 backdrop-blur-md animate-fade-in">
                        <div className="w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl border border-white/20 overflow-hidden flex flex-col animate-slide-up max-h-[85vh]">
                            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-600/20"><History className="w-6 h-6 text-white" /></div>
                                    <div><h3 className="text-xl font-black text-slate-900 tracking-tight uppercase">Auditoria de Movimentação</h3><p className="text-xs font-bold text-indigo-600 font-mono">{historyOrder.protocol} • {historyOrder.title}</p></div>
                                </div>
                                <button onClick={() => setHistoryOrder(null)} className="p-3 hover:bg-white hover:shadow-md rounded-2xl text-slate-400 hover:text-slate-900 transition-all active:scale-90"><X className="w-6 h-6" /></button>
                            </div>
                            <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
                                <div className="relative">
                                    <div className="absolute left-[19px] top-4 bottom-4 w-1 bg-gradient-to-b from-indigo-500 via-indigo-200 to-slate-100 rounded-full"></div>
                                    <div className="space-y-10">
                                        {historyOrder.statusHistory && historyOrder.statusHistory.length > 0 ? (
                                            [...historyOrder.statusHistory].reverse().map((move, idx) => (
                                                <div key={idx} className="relative pl-14 group animate-fade-in" style={{ animationDelay: `${idx * 100}ms` }}>
                                                    <div className={`absolute left-0 top-0 w-10 h-10 rounded-2xl border-4 border-white shadow-md flex items-center justify-center z-10 transition-transform group-hover:scale-110 ${idx === 0 ? (move.statusLabel.includes('Cancela') || move.statusLabel.includes('Rejeição') ? 'bg-rose-600' : 'bg-indigo-600') + ' text-white ring-4 ring-indigo-100' : 'bg-white text-indigo-500 border-indigo-100'}`}>
                                                        {move.statusLabel.includes('Aprova') ? <CheckCircle2 className="w-5 h-5" /> : (move.statusLabel.includes('Cancela') || move.statusLabel.includes('Rejeição')) ? <XCircle className="w-5 h-5" /> : move.statusLabel.includes('Criação') ? <Sparkles className="w-5 h-5" /> : move.statusLabel.includes('Recebido') ? <PackageCheck className="w-5 h-5" /> : move.statusLabel.includes('Dotação') ? <Landmark className="w-5 h-5" /> : move.statusLabel.includes('Orçamento') ? <FileSearch className="w-5 h-5" /> : move.statusLabel.includes('Concluído') ? <CheckCircle className="w-5 h-5" /> : move.statusLabel.includes('Realizado') ? <ShoppingCart className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                                                    </div>
                                                    <div className={`p-6 rounded-[2rem] border transition-all ${idx === 0 ? (move.statusLabel.includes('Cancela') || move.statusLabel.includes('Rejeição') ? 'bg-rose-50/50 border-rose-100' : 'bg-indigo-50/50 border-indigo-100') + ' shadow-sm' : 'bg-white border-slate-100'}`}>
                                                        <div className="flex flex-col desktop:flex-row desktop:items-center justify-between gap-2 mb-3"><h4 className={`text-sm font-black uppercase tracking-wider ${idx === 0 ? (move.statusLabel.includes('Cancela') || move.statusLabel.includes('Rejeição') ? 'text-rose-900' : 'text-indigo-900') : 'text-slate-800'}`}>{move.statusLabel}</h4><div className="flex items-center gap-1.5 px-3 py-1 bg-white rounded-full border border-slate-100 text-[10px] font-bold text-slate-500 shadow-sm"><Calendar className="w-3.5 h-3.5 text-indigo-400" /> {new Date(move.date).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div></div>
                                                        {move.justification && <div className={`mb-4 p-4 rounded-2xl border flex items-start gap-3 ${move.statusLabel.includes('Cancela') || move.statusLabel.includes('Rejeição') ? 'bg-rose-100/50 border-rose-200 text-rose-900' : 'bg-slate-50 border-slate-200 text-slate-700'}`}><MessageCircle className="w-4 h-4 shrink-0 mt-0.5 opacity-60" /><div className="space-y-1"><p className="text-[8px] font-black uppercase tracking-widest opacity-60">Motivo informado:</p><p className="text-xs font-bold leading-relaxed">{move.justification}</p></div></div>}
                                                        <div className="flex items-center gap-2"><div className={`w-6 h-6 rounded-lg ${move.statusLabel.includes('Cancela') || move.statusLabel.includes('Rejeição') ? 'bg-rose-100 text-rose-600' : 'bg-indigo-100 text-indigo-600'} flex items-center justify-center`}><User className="w-3.5 h-3.5" /></div><p className="text-xs font-black text-slate-600">Responsável: <span className={`${move.statusLabel.includes('Cancela') || move.statusLabel.includes('Rejeição') ? 'text-rose-600' : 'text-indigo-600'} ml-1`}>{move.userName || 'Sistema'}</span></p></div>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="py-20 text-center space-y-4"><div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto border-2 border-dashed border-slate-200"><Clock className="w-10 h-10 text-slate-300" /></div><div><p className="text-lg font-black text-slate-400 uppercase tracking-tighter">Nenhum histórico</p><p className="text-sm text-slate-400 font-medium">Este pedido ainda não possui movimentações registradas.</p></div></div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-center"><button onClick={() => setHistoryOrder(null)} className="px-8 py-3 bg-slate-900 text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-slate-900/20 hover:bg-indigo-600 transition-all active:scale-95">Fechar Auditoria</button></div>
                        </div>
                    </div>,
                    document.body
                )}

                {/* MODAL DE SELEÇÃO DE STATUS */}
                {statusSelectionOrder && createPortal(
                    <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in">
                        <div className="w-full max-w-3xl bg-white rounded-[2rem] shadow-2xl border border-white/20 overflow-hidden flex flex-col animate-slide-up max-h-[90vh]">
                            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-600/20">
                                        <MousePointer2 className="w-6 h-6 text-white" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase leading-none">Alterar Status</h3>
                                        <p className="text-xs font-bold text-indigo-600 font-mono mt-1 tracking-wider">{statusSelectionOrder.protocol}</p>
                                    </div>
                                </div>
                                <button onClick={() => setStatusSelectionOrder(null)} className="p-3 hover:bg-white hover:shadow-sm rounded-2xl text-slate-400 hover:text-slate-900 transition-all active:scale-90"><X className="w-6 h-6" /></button>
                            </div>
                            <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
                                {!pendingStatus ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {(Object.keys(purchaseStatusMap) as Array<keyof typeof purchaseStatusMap>).map((key) => {
                                            const cfg = purchaseStatusMap[key];
                                            const isActive = statusSelectionOrder.purchaseStatus === key;
                                            const isDisabled = key === 'aprovacao_orcamento' && !isAdmin;

                                            return (
                                                <button
                                                    key={key}
                                                    onClick={() => {
                                                        if (isDisabled) return;
                                                        if (key === 'realizado') {
                                                            setPendingStatus('realizado');
                                                            setForecastDate(statusSelectionOrder.completionForecast || '');
                                                            return;
                                                        }
                                                        onUpdatePurchaseStatus?.(statusSelectionOrder, key, `Alteração via Histórico por ${currentUser.name}`);
                                                        setStatusSelectionOrder(null);
                                                    }}
                                                    disabled={isDisabled}
                                                    className={`p-6 rounded-[1.5rem] border-2 text-left transition-all relative group overflow-hidden ${isActive ? 'bg-indigo-50 border-indigo-600 text-indigo-900' :
                                                        isDisabled ? 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed opacity-50' :
                                                            'bg-white border-slate-100 text-slate-600 hover:border-indigo-300 hover:bg-slate-50 active:scale-[0.98]'
                                                        }`}
                                                >
                                                    <div className="flex items-start gap-4 h-full relative z-10">
                                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${isActive ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' :
                                                            isDisabled ? 'bg-slate-100 text-slate-300' : 'bg-slate-100 text-slate-400 group-hover:bg-indigo-100 group-hover:text-indigo-600'}`}>
                                                            <cfg.icon className="w-6 h-6" />
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-black uppercase tracking-widest text-[11px] leading-none mb-1">{cfg.label}</span>
                                                                {isActive && <div className="w-2 h-2 bg-indigo-600 rounded-full animate-pulse" />}
                                                                {isDisabled && <Lock className="w-3.5 h-3.5 text-slate-300" />}
                                                            </div>
                                                            <p className="text-xs font-medium leading-relaxed opacity-70">
                                                                {isDisabled ? 'Requer autorização administrativa para prosseguir.' : (key === statusSelectionOrder.purchaseStatus ? 'Status atual deste processo de compra.' : 'Clique para atualizar o processo para esta etapa.')}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="max-w-md mx-auto py-8">
                                        <div className="text-center mb-8">
                                            <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-[2rem] flex items-center justify-center mx-auto mb-4 border-2 border-emerald-100 shadow-xl shadow-emerald-500/10">
                                                <CalendarCheck className="w-10 h-10" />
                                            </div>
                                            <h4 className="text-2xl font-black text-slate-900 uppercase">Previsão de Entrega</h4>
                                            <p className="text-slate-500 font-medium mt-2">Informe a data prevista para a conclusão/entrega deste pedido para prosseguir.</p>
                                        </div>

                                        <div className="space-y-6">
                                            <div className="relative group">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block px-2">Data da Previsão (Obrigatório)</label>
                                                <div className="relative">
                                                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-emerald-600 transition-colors" />
                                                    <input
                                                        type="date"
                                                        value={forecastDate}
                                                        onChange={(e) => setForecastDate(e.target.value)}
                                                        className="w-full pl-12 pr-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:bg-white focus:border-emerald-500 transition-all font-bold text-slate-700"
                                                    />
                                                </div>
                                            </div>

                                            <div className="flex flex-col gap-3 pt-4">
                                                <button
                                                    disabled={!forecastDate}
                                                    onClick={() => {
                                                        onUpdatePurchaseStatus?.(
                                                            statusSelectionOrder,
                                                            'realizado',
                                                            `Pedido realizado com previsão para ${formatLocalDate(forecastDate)}`,
                                                            undefined,
                                                            forecastDate
                                                        );
                                                        setStatusSelectionOrder(null);
                                                        setPendingStatus(null);
                                                        setForecastDate('');
                                                    }}
                                                    className="w-full py-5 bg-emerald-600 text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-emerald-600/20 hover:bg-emerald-700 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                                                >
                                                    <CheckCircle2 className="w-5 h-5" /> Confirmar Realização
                                                </button>
                                                <button
                                                    onClick={() => setPendingStatus(null)}
                                                    className="w-full py-4 text-slate-400 font-black text-[10px] uppercase tracking-widest hover:text-slate-900 transition-colors"
                                                >
                                                    Voltar para a lista de status
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="p-6 bg-slate-50 border-t border-slate-100 text-center">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                                    {pendingStatus ? 'Informação obrigatória para conformidade do processo' : 'Movimentação registrada auditada automaticamente'}
                                </p>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}

                {/* MODAL DE DECISÃO ADMINISTRATIVA (APROVAR/REPROVAR) */}
                {adminApprovalOrder && createPortal(
                    <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in">
                        <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl border border-white/20 overflow-hidden flex flex-col animate-slide-up">
                            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-600/20">
                                        <ShieldAlert className="w-6 h-6 text-white" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase">Decisão Administrativa</h3>
                                        <p className="text-[10px] font-bold text-indigo-600 font-mono tracking-widest">{adminApprovalOrder.protocol}</p>
                                    </div>
                                </div>
                                <button onClick={() => setAdminApprovalOrder(null)} className="p-3 hover:bg-white hover:shadow-md rounded-2xl text-slate-400 transition-all">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            <div className="p-8 text-center">
                                <p className="text-slate-500 text-sm font-medium leading-relaxed mb-6">
                                    Selecione a ação definitiva para este pedido. A aprovação permitirá que o setor de compras prossiga, enquanto a rejeição encerrará o processo.
                                </p>

                                <div className="grid grid-cols-2 gap-4">
                                    <button
                                        onClick={() => {
                                            onUpdateOrderStatus?.(adminApprovalOrder, 'approved', 'Aprovação Administrativa via Histórico');
                                            setAdminApprovalOrder(null);
                                        }}
                                        className="flex flex-col items-center justify-center gap-3 p-6 bg-emerald-50 border border-emerald-100 rounded-3xl hover:bg-emerald-600 group transition-all"
                                    >
                                        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-emerald-600 shadow-sm group-hover:scale-110 transition-transform">
                                            <CheckCircle2 className="w-6 h-6" />
                                        </div>
                                        <span className="text-xs font-black uppercase tracking-widest text-emerald-700 group-hover:text-white text-center">Aprovar</span>
                                    </button>

                                    <button
                                        onClick={() => {
                                            setAdminApprovalOrder(null);
                                            setAdminRejectionOrder(adminApprovalOrder);
                                            setRejectionReason('');
                                        }}
                                        className="flex flex-col items-center justify-center gap-3 p-6 bg-rose-50 border border-rose-100 rounded-3xl hover:bg-rose-600 group transition-all"
                                    >
                                        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-rose-600 shadow-sm group-hover:scale-110 transition-transform">
                                            <XCircle className="w-6 h-6" />
                                        </div>
                                        <span className="text-xs font-black uppercase tracking-widest text-rose-700 group-hover:text-white text-center">Reprovar</span>
                                    </button>
                                </div>
                            </div>

                            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-center">
                                <button onClick={() => setAdminApprovalOrder(null)} className="px-8 py-3 bg-white text-slate-400 font-bold text-xs uppercase tracking-widest rounded-xl border border-slate-200 hover:bg-slate-100 transition-all">Cancelar</button>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}

                {/* MODAL DE JUSTIFICATIVA DE REJEIÇÃO ADMINISTRATIVA */}
                {adminRejectionOrder && createPortal(
                    <div className="fixed inset-0 z-[1300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in">
                        <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl border border-white/20 overflow-hidden flex flex-col animate-slide-up">
                            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-rose-600 rounded-2xl flex items-center justify-center shadow-lg shadow-rose-600/20">
                                        <XCircle className="w-6 h-6 text-white" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase">Justificar Rejeição</h3>
                                        <p className="text-[10px] font-bold text-rose-600 font-mono tracking-widest">{adminRejectionOrder.protocol}</p>
                                    </div>
                                </div>
                                <button onClick={() => setAdminRejectionOrder(null)} className="p-3 hover:bg-white hover:shadow-md rounded-2xl text-slate-400 transition-all">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            <div className="p-8">
                                <div className="space-y-4">
                                    <p className="text-slate-500 text-sm font-medium leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100 italic">
                                        "A rejeição administrativa interrompe permanentemente o fluxo deste processo."
                                    </p>

                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Motivo do Descarte (Obrigatório)</label>
                                        <textarea
                                            value={rejectionReason}
                                            onChange={(e) => setRejectionReason(e.target.value)}
                                            className="w-full h-32 p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:bg-white focus:border-rose-500 transition-all resize-none font-medium text-sm"
                                            placeholder="Descreva detalhadamente o motivo pelo qual este pedido não poderá ser atendido..."
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 bg-slate-50 border-t border-slate-100 flex flex-col gap-3">
                                <button
                                    disabled={!rejectionReason.trim()}
                                    onClick={() => {
                                        onUpdateOrderStatus?.(adminRejectionOrder, 'rejected', rejectionReason);
                                        setAdminRejectionOrder(null);
                                    }}
                                    className="w-full py-4 bg-rose-600 text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-rose-600/20 hover:bg-rose-700 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    <XCircle className="w-4 h-4" /> Confirmar Rejeição
                                </button>
                                <button onClick={() => { setAdminRejectionOrder(null); setAdminApprovalOrder(adminRejectionOrder); }} className="w-full py-4 bg-white text-slate-400 font-black text-xs uppercase tracking-widest rounded-2xl border border-slate-200 hover:bg-slate-50 hover:text-slate-600 transition-all">Voltar</button>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}

            </div >

            {accountSelectionOrder && createPortal(
                <AccountSelectionModal
                    isOpen={!!accountSelectionOrder}
                    onClose={() => setAccountSelectionOrder(null)}
                    onSelect={handleSelectAccount}
                    currentUser={currentUser}
                    sectors={sectors}
                    order={accountSelectionOrder}
                    isAdmin={isAdmin}
                />,
                document.body
            )}
        </>
    );
};
